const { supabase } = require('../config/supabaseClient');

const FLASK_URL = process.env.FLASK_URL || 'http://localhost:5001';
const BULB_LABEL = (process.env.BULB_LABEL || 'bulb').toLowerCase();
const MIN_BULB_SAMPLES = Number(process.env.MIN_BULB_SAMPLES || 600);
const BULB_FETCH_LIMIT = Number(process.env.BULB_FETCH_LIMIT || 1200);
const BULB_TRAIN_MIN_SAMPLES = Number(process.env.BULB_TRAIN_MIN_SAMPLES || 400);
const BULB_ON_THRESHOLD_WATTS = Number(process.env.BULB_ON_THRESHOLD_WATTS || 8);
const BULB_ACTIVITY_WINDOW_SIZE = Number(process.env.BULB_ACTIVITY_WINDOW_SIZE || 31);
const BULB_ACTIVITY_MAX_AGE_SECONDS = Number(process.env.BULB_ACTIVITY_MAX_AGE_SECONDS || 30);
const TRAIN_COOLDOWN_MS = Number(process.env.BULB_TRAIN_COOLDOWN_MS || 10 * 60 * 1000);

const latestBulbStateByDevice = {};
const latestBulbActivityByDevice = {};
let lastTrainAttemptAt = 0;

exports.getLatestPredictions = async (device_id) => {
  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('device_id', device_id)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  if (error) throw new Error('No predictions found for this device');
  return data;
};

exports.getBillPrediction = async (device_id) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('energy_readings')
    .select('energy, timestamp')
    .eq('device_id', device_id)
    .gte('timestamp', thirtyDaysAgo.toISOString())
    .order('timestamp', { ascending: true });

  if (error) throw new Error(error.message);

  const dailyMap = {};
  (data || []).forEach((row) => {
    const date = row.timestamp.split('T')[0];
    if (!dailyMap[date]) dailyMap[date] = 0;
    dailyMap[date] += row.energy;
  });

  let dailyKwh = Object.values(dailyMap);
  if (dailyKwh.length < 30) {
    const avg = dailyKwh.reduce((a, b) => a + b, 0) / (dailyKwh.length || 1);
    while (dailyKwh.length < 30) dailyKwh.unshift(avg);
  }

  const window30 = dailyKwh.slice(-30);

  const response = await fetch(`${FLASK_URL}/predict/bill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_kwh: window30 }),
  });

  if (!response.ok) throw new Error('Flask bill prediction failed');
  const result = await response.json();

  return {
    last_30_days_kwh: parseFloat(window30.reduce((a, b) => a + b, 0).toFixed(3)),
    next_day_kwh: result.next_day_kwh,
    estimated_cost_inr: result.estimated_cost_inr,
    monthly_estimate_inr: parseFloat((result.estimated_cost_inr * 30).toFixed(2)),
  };
};

async function fetchBulbReadings(device_id) {
  const { data, error } = await supabase
    .from('energy_readings')
    .select('power, timestamp, user_id, appliance_label, stream_type')
    .eq('device_id', device_id)
    .eq('appliance_label', BULB_LABEL)
    .order('timestamp', { ascending: false })
    .limit(BULB_FETCH_LIMIT);

  if (error) throw new Error(error.message);

  const readings = (data || [])
    .map((row) => Number(row.power))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .reverse();

  const newestRow = (data || [])[0];
  return {
    readings,
    user_id: newestRow?.user_id ?? null,
    last_timestamp: newestRow?.timestamp ?? null,
  };
}

async function fetchRecentDevicePowerReadings(device_id, limit = BULB_ACTIVITY_WINDOW_SIZE) {
  const { data, error } = await supabase
    .from('energy_readings')
    .select('power, timestamp, user_id, appliance_label, stream_type')
    .eq('device_id', device_id)
    .or('stream_type.eq.aggregate,stream_type.is.null')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const readings = (data || [])
    .map((row) => Number(row.power))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .reverse();

  const newestRow = (data || [])[0];
  return {
    readings,
    user_id: newestRow?.user_id ?? null,
    last_timestamp: newestRow?.timestamp ?? null,
  };
}

async function callTrayEndpoint(timestamp, powerWatts) {
  const response = await fetch(`${FLASK_URL}/predict/tray`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp, power_watts: powerWatts }),
  });
  const result = await safeJson(response);
  if (!response.ok) throw new Error(result?.error || 'Flask tray prediction failed');
  return result;
}
exports.callTrayEndpoint = callTrayEndpoint;

async function getTrayState() {
  const response = await fetch(`${FLASK_URL}/tray/state`);
  const result = await safeJson(response);
  if (!response.ok) throw new Error(result?.error || 'Flask tray state failed');
  return result;
}
exports.getTrayState = getTrayState;

async function resetTrayState() {
  const response = await fetch(`${FLASK_URL}/tray/reset`, { method: 'POST' });
  const result = await safeJson(response);
  if (!response.ok) throw new Error(result?.error || 'Flask tray reset failed');
  return result;
}
exports.resetTrayState = resetTrayState;

function getAgeSeconds(timestamp) {
  if (!timestamp) return Number.POSITIVE_INFINITY;
  const parsed = new Date(timestamp).getTime();
  if (Number.isNaN(parsed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - parsed) / 1000);
}

exports.getLatestBulbPrediction = async (device_id) => {
  return latestBulbStateByDevice[device_id] || null;
};

exports.predictBulbStateFromHistory = async (device_id) => {
  const { readings, user_id, last_timestamp } = await fetchBulbReadings(device_id);

  if (readings.length < MIN_BULB_SAMPLES) {
    return {
      status: 'skipped',
      reason: `Need at least ${MIN_BULB_SAMPLES} bulb readings`,
      device_id,
      sample_count: readings.length,
    };
  }

  await ensureBulbModelTrainedIfNeeded(readings);

  const response = await fetch(`${FLASK_URL}/predict/bulb/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ readings }),
  });

  if (!response.ok) throw new Error('Flask bulb state prediction failed');
  const result = await response.json();

  const payload = {
    device_id,
    user_id,
    timestamp: last_timestamp || new Date().toISOString(),
    sample_count: readings.length,
    bulb_state: result.bulb_state,
    confidence: result.confidence,
    on_probability: result.on_probability,
    avg_power_watts: result.avg_power_watts,
    source: 'supabase-history',
  };

  latestBulbStateByDevice[device_id] = payload;
  return { status: 'predicted', ...payload };
};

exports.getLatestBulbActivity = async (device_id) => {
  return latestBulbActivityByDevice[device_id] || null;
};

exports.predictBulbActivityFromHistory = async (device_id) => {
  const { readings, user_id, last_timestamp } = await fetchRecentDevicePowerReadings(
    device_id,
    BULB_ACTIVITY_WINDOW_SIZE
  );
  const latestAgeSeconds = getAgeSeconds(last_timestamp);

  if (latestAgeSeconds > BULB_ACTIVITY_MAX_AGE_SECONDS) {
    return {
      status: 'skipped',
      reason: `Latest live sample is ${Math.round(latestAgeSeconds)}s old. Start ESP32 streaming for a fresh prediction.`,
      device_id,
      sample_count: readings.length,
      required_samples: BULB_ACTIVITY_WINDOW_SIZE,
      max_age_seconds: BULB_ACTIVITY_MAX_AGE_SECONDS,
      last_timestamp,
    };
  }

  if (readings.length < BULB_ACTIVITY_WINDOW_SIZE) {
    return {
      status: 'skipped',
      reason: `Need at least ${BULB_ACTIVITY_WINDOW_SIZE} recent readings for activity classification`,
      device_id,
      sample_count: readings.length,
      required_samples: BULB_ACTIVITY_WINDOW_SIZE,
      max_age_seconds: BULB_ACTIVITY_MAX_AGE_SECONDS,
      last_timestamp,
    };
  }

  const response = await fetch(`${FLASK_URL}/predict/bulb/activity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ readings }),
  });

  const result = await safeJson(response);
  if (!response.ok) {
    throw new Error(result?.error || 'Flask bulb activity prediction failed');
  }

  const probabilities = result.class_probabilities || result.probabilities || {};
  const payload = {
    status: 'predicted',
    device_id,
    user_id,
    timestamp: last_timestamp || new Date().toISOString(),
    sample_count: readings.length,
    activity_label: result.activity_label,
    model_activity_label: result.model_activity_label,
    correction_applied: result.correction_applied,
    confidence: result.confidence,
    probabilities,
    avg_power_watts: result.avg_power_watts,
    max_power_watts: result.max_power_watts,
    window_size: result.window_size,
    source: 'recent-device-history',
  };

  latestBulbActivityByDevice[device_id] = payload;
  return payload;
};

async function predictApplianceActivity(device_id, appliance) {
  const prefix = String(appliance || '').trim().toLowerCase();
  if (!prefix) throw new Error('appliance is required');

  const { readings, user_id, last_timestamp } = await fetchRecentDevicePowerReadings(device_id, 50);
  const latestAgeSeconds = getAgeSeconds(last_timestamp);

  if (latestAgeSeconds > BULB_ACTIVITY_MAX_AGE_SECONDS) {
    return {
      status: 'skipped',
      reason: `Latest live sample is ${Math.round(latestAgeSeconds)}s old. Start ESP32 streaming for a fresh prediction.`,
      device_id,
      appliance: prefix,
      sample_count: readings.length,
      max_age_seconds: BULB_ACTIVITY_MAX_AGE_SECONDS,
      last_timestamp,
    };
  }

  const response = await fetch(`${FLASK_URL}/predict/activity/${prefix}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ readings }),
  });

  const result = await safeJson(response);
  if (!response.ok) {
    return {
      status: 'skipped',
      reason: result?.error || `${prefix} activity classifier unavailable`,
      device_id,
      appliance: prefix,
      sample_count: readings.length,
      last_timestamp,
    };
  }

  const probabilities = result.class_probabilities || result.probabilities || {};
  return {
    status: 'predicted',
    device_id,
    appliance: prefix,
    user_id,
    timestamp: last_timestamp || new Date().toISOString(),
    sample_count: readings.length,
    activity_label: result.activity_label,
    model_activity_label: result.model_activity_label,
    correction_applied: result.correction_applied,
    confidence: result.confidence,
    probabilities,
    avg_power_watts: result.avg_power_watts,
    max_power_watts: result.max_power_watts,
    window_size: result.window_size,
    source: 'recent-device-history',
  };
}
exports.predictApplianceActivity = predictApplianceActivity;

async function ensureBulbModelTrainedIfNeeded(readings) {
  const healthResponse = await fetch(`${FLASK_URL}/health`);
  if (!healthResponse.ok) return;

  const health = await healthResponse.json();
  if (health.bulb_state_model) return;

  const now = Date.now();
  if (now - lastTrainAttemptAt < TRAIN_COOLDOWN_MS) return;
  if (readings.length < BULB_TRAIN_MIN_SAMPLES) return;

  lastTrainAttemptAt = now;
  const trainResponse = await fetch(`${FLASK_URL}/train/bulb/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      readings,
      on_threshold_watts: BULB_ON_THRESHOLD_WATTS,
    }),
  });

  if (!trainResponse.ok) {
    const errBody = await safeJson(trainResponse);
    throw new Error(errBody?.error || 'Auto bulb training failed');
  }
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (err) {
    return null;
  }
}

exports.runAutoBulbPredictionCycle = async () => {
  const { data: devices, error } = await supabase
    .from('devices')
    .select('device_id')
    .eq('status', 'ASSIGNED');

  if (error) throw new Error(error.message);

  const results = [];
  for (const device of devices || []) {
    try {
      const predicted = await exports.predictBulbStateFromHistory(device.device_id);
      results.push(predicted);
    } catch (err) {
      results.push({
        status: 'error',
        device_id: device.device_id,
        message: err.message,
      });
    }
  }

  return results;
};

