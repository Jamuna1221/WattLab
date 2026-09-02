const { supabase } = require('../config/supabaseClient');

const FLASK_URL = process.env.FLASK_URL || 'http://localhost:5001';

const readingBuffers = {};
const WINDOW_SIZE = 599;

function normalizeTimestamp(inputTimestamp) {
  if (!inputTimestamp) return new Date().toISOString();

  const parsed = new Date(inputTimestamp);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();

  // Guard against UNIX epoch fallback values coming from unsynced devices.
  if (parsed.getTime() === 0) return new Date().toISOString();

  return parsed.toISOString();
}

exports.saveReading = async ({
  device_id,
  user_id,
  voltage,
  current,
  activePower,
  apparentPower,
  powerFactor,
  timestamp,
  applianceLabel,
  streamType,
}) => {
  if (!device_id) throw new Error('device_id is required');
  if (activePower === undefined || activePower === null) throw new Error('activePower is required');

  const cleanPower = Math.max(0, Number(activePower));
  const energy = cleanPower * (6 / 3600) / 1000;

  const normalizedStreamType = streamType === 'appliance' ? 'appliance' : 'aggregate';
  const normalizedApplianceLabel = applianceLabel ? String(applianceLabel).trim().toLowerCase() : null;

  const { data: reading, error } = await supabase
    .from('energy_readings')
    .insert([
      {
        device_id,
        user_id: user_id ?? null,
        voltage: voltage ?? 230.0,
        current: current ?? cleanPower / 230,
        power: cleanPower,
        energy,
        power_factor: powerFactor ?? 0.95,
        timestamp: normalizeTimestamp(timestamp),
        appliance_label: normalizedApplianceLabel,
        stream_type: normalizedStreamType,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (normalizedStreamType === 'aggregate') {
    if (!readingBuffers[device_id]) readingBuffers[device_id] = [];
    readingBuffers[device_id].push(cleanPower);
    if (readingBuffers[device_id].length > WINDOW_SIZE) readingBuffers[device_id].shift();

    // Trigger Tray Engine processing for Candidate Tray
    fetch(`${FLASK_URL}/predict/tray`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: reading.timestamp, power_watts: cleanPower }),
    }).catch(() => {});
  }

  let prediction = null;
  if (normalizedStreamType === 'aggregate' && readingBuffers[device_id].length === WINDOW_SIZE) {
    prediction = await triggerMLPrediction(device_id, user_id, readingBuffers[device_id], reading.timestamp);
  }

  return { reading, prediction };
};

async function triggerMLPrediction(device_id, user_id, window599, timestamp) {
  const appliances = ['kettle', 'microwave', 'fridge', 'dishwasher', 'washing_machine'];
  const predictions = {};

  for (const appliance of appliances) {
    try {
      const response = await fetch(`${FLASK_URL}/predict/appliance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appliance, window: window599 }),
      });

      if (response.ok) {
        const result = await response.json();
        predictions[appliance] = result.predicted_watts;
      }
    } catch (err) {
      console.log(`ML prediction skipped for ${appliance}: ${err.message}`);
    }
  }

  if (Object.keys(predictions).length > 0) {
    const { error } = await supabase.from('predictions').insert([
      {
        device_id,
        user_id: user_id ?? null,
        timestamp,
        kettle: predictions.kettle || 0,
        microwave: predictions.microwave || 0,
        fridge: predictions.fridge || 0,
        dishwasher: predictions.dishwasher || 0,
        washing_machine: predictions.washing_machine || 0,
      },
    ]);

    if (error) console.log('Prediction save error:', error.message);
  }

  return predictions;
}

exports.getLiveReading = async (device_id) => {
  const { data, error } = await supabase
    .from('energy_readings')
    .select('*')
    .eq('device_id', device_id)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  if (error) throw new Error('No readings found for this device');
  return data;
};

exports.getDailySummary = async (device_id) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('energy_readings')
    .select('power, energy, timestamp')
    .eq('device_id', device_id)
    .gte('timestamp', sevenDaysAgo.toISOString())
    .order('timestamp', { ascending: true });

  if (error) throw new Error(error.message);

  const dailyMap = {};
  (data || []).forEach((row) => {
    const date = row.timestamp.split('T')[0];
    if (!dailyMap[date]) dailyMap[date] = { date, total_kwh: 0, avg_power: 0, count: 0 };
    dailyMap[date].total_kwh += row.energy;
    dailyMap[date].avg_power += row.power;
    dailyMap[date].count += 1;
  });

  return Object.values(dailyMap).map((d) => ({
    date: d.date,
    total_kwh: parseFloat(d.total_kwh.toFixed(4)),
    avg_power: parseFloat((d.avg_power / d.count).toFixed(2)),
  }));
};

exports.getWeeklySummary = async (device_id) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('energy_readings')
    .select('energy, timestamp')
    .eq('device_id', device_id)
    .gte('timestamp', thirtyDaysAgo.toISOString())
    .order('timestamp', { ascending: true });

  if (error) throw new Error(error.message);

  const weeklyMap = {};
  (data || []).forEach((row) => {
    const date = new Date(row.timestamp);
    const weekNo = `Week-${Math.ceil(date.getDate() / 7)}`;
    if (!weeklyMap[weekNo]) weeklyMap[weekNo] = { week: weekNo, total_kwh: 0 };
    weeklyMap[weekNo].total_kwh += row.energy || 0;
  });

  return Object.values(weeklyMap).map((w) => ({
    week: w.week,
    total_kwh: parseFloat(w.total_kwh.toFixed(4)),
  }));
};

exports.getMonthlySummary = async (device_id) => {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data, error } = await supabase
    .from('energy_readings')
    .select('energy, timestamp')
    .eq('device_id', device_id)
    .gte('timestamp', oneYearAgo.toISOString())
    .order('timestamp', { ascending: true });

  if (error) throw new Error(error.message);

  const monthlyMap = {};
  (data || []).forEach((row) => {
    const monthKey = row.timestamp.substring(0, 7); // YYYY-MM
    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { month: monthKey, total_kwh: 0 };
    monthlyMap[monthKey].total_kwh += row.energy || 0;
  });

  return Object.values(monthlyMap).map((m) => ({
    month: m.month,
    total_kwh: parseFloat(m.total_kwh.toFixed(4)),
  }));
};

exports.getApplianceBreakdown = async (device_id, timeframe = 'monthly') => {
  // Try candidate tray state first for active confirmed appliances
  let trayConfirmed = {};
  try {
    const res = await fetch(`${FLASK_URL}/tray/state`);
    if (res.ok) {
      const trayData = await res.json();
      trayConfirmed = trayData.total_confirmed_kwh || {};
    }
  } catch {}

  const result = [];
  const entries = Object.entries(trayConfirmed);

  // Timeframe scaling factors relative to lifetime confirmed readings
  let scale = 1.0;
  if (timeframe === 'daily') scale = 0.15;
  if (timeframe === 'weekly') scale = 0.50;

  entries.forEach(([name, kwh]) => {
    if (Number(kwh) > 0) {
      result.push({
        name: name.replace(/_/g, ' '),
        kwh: parseFloat((Number(kwh) * scale).toFixed(4)),
        key: name,
      });
    }
  });

  // Fallback defaults if no confirmed candidate tray data yet
  if (result.length === 0) {
    const defaults = [
      { name: 'Fridge', kwh: timeframe === 'daily' ? 0.45 : timeframe === 'weekly' ? 3.15 : 13.50, key: 'fridge' },
      { name: 'Kettle', kwh: timeframe === 'daily' ? 0.20 : timeframe === 'weekly' ? 1.40 : 6.00, key: 'kettle' },
      { name: 'Microwave', kwh: timeframe === 'daily' ? 0.12 : timeframe === 'weekly' ? 0.84 : 3.60, key: 'microwave' },
      { name: 'Washing machine', kwh: timeframe === 'daily' ? 0.35 : timeframe === 'weekly' ? 2.45 : 10.50, key: 'washing_machine' },
    ];
    return defaults;
  }

  return result;
};

