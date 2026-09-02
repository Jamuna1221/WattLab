import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Clock,
  IndianRupee,
  Leaf,
  Lightbulb,
  PieChart as PieIcon,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import api from '../utils/api';
import { supabase } from '../supabaseClient';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

const APPLIANCE_KEYS = [
  { key: 'kettle', label: 'Kettle' },
  { key: 'microwave', label: 'Microwave' },
  { key: 'fridge', label: 'Fridge' },
  { key: 'dishwasher', label: 'Dishwasher' },
  { key: 'washing_machine', label: 'Washing machine' },
];

const CO2_PER_KWH = 0.82; // kg CO2 per kWh (Indian grid average)
const TREES_PER_KG_CO2 = 21; // kg CO2 absorbed per tree per year

function initialDeviceId() {
  const stored = localStorage.getItem('wattlab_device_id');
  if (stored) return stored;
  return import.meta.env.VITE_DEFAULT_DEVICE_ID || 'SIM-DEVICE-001';
}

function predictionsToPieRow(pred) {
  if (!pred) return [];
  return APPLIANCE_KEYS.map(({ key, label }) => ({
    name: label,
    watts: Math.max(0, Number(pred[key]) || 0),
  })).filter((d) => d.watts > 0);
}

function shortDay(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
  });
}

export default function PredictionsPage() {
  const [deviceId, setDeviceId] = useState(initialDeviceId);
  const [predictions, setPredictions] = useState(null);
  const [bill, setBill] = useState(null);
  const [predError, setPredError] = useState(null);
  const [billError, setBillError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Derived analytics state
  const [trustInfo, setTrustInfo] = useState(null);
  const [dailyRows, setDailyRows] = useState([]);
  const [trayState, setTrayState] = useState(null);
  const [hourlyProfile, setHourlyProfile] = useState([]);
  const [hourlyProfileAvail, setHourlyProfileAvail] = useState(false);

  const [reductions, setReductions] = useState({
    kettle: 0,
    microwave: 0,
    fridge: 0,
    dishwasher: 0,
    washing_machine: 0,
  });

  const tariff = Number(localStorage.getItem('wattlab_tariff') || 8.50);
  const budgetGoal = Number(localStorage.getItem('wattlab_budget_goal') || 1500);

  const load = useCallback(async () => {
    setLoading(true);
    setPredError(null);
    setBillError(null);
    const id = encodeURIComponent(deviceId);

    // 1. Latest ML prediction + bill forecast (existing behavior)
    try {
      const pRes = await api.get(`/predictions/${id}`);
      setPredictions(pRes.data?.predictions || null);
    } catch (err) {
      setPredictions(null);
      setPredError(
        err.response?.data?.message ||
          (err.response?.status === 404
            ? 'No predictions yet for this device.'
            : err.message)
      );
    }

    try {
      const bRes = await api.get(`/predictions/bill/${id}`);
      setBill(bRes.data?.bill || null);
    } catch (err) {
      setBill(null);
      setBillError(
        err.response?.data?.message ||
          err.message ||
          'Bill forecast unavailable'
      );
    }

    // 2. Candidate tray state (appliance health + what-if base costs)
    try {
      const { data: tray } = await api.get('/tray/state');
      setTrayState(tray);
    } catch {
      setTrayState(null);
    }

    // 3. Last 7-day daily summary (trajectory + day costs + today vs last week)
    let daily = [];
    try {
      const { data: dRes } = await api.get(`/readings/daily/${id}`);
      daily = dRes?.summary || [];
      setDailyRows(daily);
    } catch {
      setDailyRows([]);
    }

    // 4. Forecast trustworthiness: past predictions vs actual power
    try {
      const { data: preds } = await supabase
        .from('predictions')
        .select('*')
        .eq('device_id', deviceId)
        .order('timestamp', { ascending: false })
        .limit(30);
      if (preds && preds.length > 0) {
        const ts = preds.map((p) => p.timestamp);
        const { data: matchReadings } = await supabase
          .from('energy_readings')
          .select('power, timestamp')
          .in('timestamp', ts)
          .limit(500);
        const powerMap = {};
        (matchReadings || []).forEach((r) => {
          powerMap[r.timestamp] = Number(r.power || 0);
        });
        let totalErr = 0;
        let valid = 0;
        preds.forEach((p) => {
          const actual = powerMap[p.timestamp];
          if (!actual || actual <= 0) return;
          const predictedTotal = APPLIANCE_KEYS.reduce(
            (s, a) => s + (Number(p[a.key]) || 0),
            0
          );
          if (predictedTotal <= 0) return;
          totalErr += (Math.abs(predictedTotal - actual) / actual) * 100;
          valid += 1;
        });
        setTrustInfo({
          count: preds.length,
          samples: valid,
          avgErrorPct: valid > 0 ? totalErr / valid : null,
        });
      } else {
        setTrustInfo({ count: 0, samples: 0, avgErrorPct: null });
      }
    } catch {
      setTrustInfo(null);
    }

    // 5. 24-hour load profile (tariff plan comparison)
    try {
      const { data: raw } = await supabase
        .from('energy_readings')
        .select('power, timestamp')
        .eq('device_id', deviceId)
        .order('timestamp', { ascending: false })
        .limit(3000);
      if (raw && raw.length > 0) {
        const hourMap = Array.from({ length: 24 }, (_, h) => ({
          hour: h,
          totalWatts: 0,
          count: 0,
        }));
        raw.forEach((r) => {
          const h = new Date(r.timestamp).getHours();
          if (h >= 0 && h < 24) {
            hourMap[h].totalWatts += Number(r.power || 0);
            hourMap[h].count += 1;
          }
        });
        setHourlyProfile(
          hourMap.map((h) => ({
            hour: h.hour,
            watts: h.count > 0 ? Math.round(h.totalWatts / h.count) : 0,
            count: h.count,
          }))
        );
        setHourlyProfileAvail(true);
      } else {
        setHourlyProfileAvail(false);
      }
    } catch {
      setHourlyProfileAvail(false);
    }

    setLoading(false);
  }, [deviceId]);

  useEffect(() => {
    localStorage.setItem('wattlab_device_id', deviceId);
  }, [deviceId]);

  useEffect(() => {
    load();
  }, [load]);

  // ---------- Derived calculations ----------

  const pieData = predictionsToPieRow(predictions);
  const totalW = pieData.reduce((s, d) => s + d.watts, 0);

  const monthlyKwh =
    bill?.monthly_estimate_kwh != null
      ? Number(bill.monthly_estimate_kwh)
      : bill?.last_30_days_kwh != null
        ? Number(bill.last_30_days_kwh)
        : dailyRows.length > 0
          ? (dailyRows.reduce((s, d) => s + Number(d.total_kwh || 0), 0) / dailyRows.length) * 30
          : null;
  const monthlyCost =
    bill?.monthly_estimate_inr != null
      ? Number(bill.monthly_estimate_inr)
      : monthlyKwh != null
        ? monthlyKwh * tariff
        : null;

  // Feature 2: Bill trajectory (cumulative cost over last 7 days + projection)
  const trajectory = useMemo(() => {
    let cum = 0;
    const rows = dailyRows.map((d) => {
      cum += Number(d.total_kwh || 0) * tariff;
      return {
        day: shortDay(d.date),
        cost: Number(cum.toFixed(2)),
        kwh: Number(d.total_kwh || 0),
      };
    });
    return rows;
  }, [dailyRows, tariff]);

  const trajectoryProjection =
    trajectory.length > 0
      ? (trajectory[trajectory.length - 1].cost / trajectory.length) * 30
      : null;
  const budgetDailyPace = budgetGoal / 30;

  // Feature 4: Day-by-day costs (last 7 days, sorted by cost desc)
  const dayCosts = useMemo(
    () =>
      dailyRows
        .map((d) => ({
          day: shortDay(d.date),
          date: d.date,
          kwh: Number(d.total_kwh || 0),
          cost: Number((Number(d.total_kwh || 0) * tariff).toFixed(2)),
        }))
        .sort((a, b) => b.cost - a.cost),
    [dailyRows, tariff]
  );

  // Feature 5: Carbon footprint
  const co2Kg = monthlyKwh != null ? monthlyKwh * CO2_PER_KWH : null;
  const treesEquivalent = co2Kg != null ? co2Kg / TREES_PER_KG_CO2 : null;

  // Feature 7: Forecast vs budget gap
  const budgetDiff = monthlyCost != null ? monthlyCost - budgetGoal : null;
  const remainingDays = Math.max(1, 30 - new Date().getDate());
  const kwhToCut = budgetDiff != null && budgetDiff > 0 ? budgetDiff / tariff : 0;

  // Feature 3: What-if simulator base appliance costs
  const applianceBase = useMemo(() => {
    const confirmed = trayState?.total_confirmed_kwh || {};
    return APPLIANCE_KEYS.map(({ key, label }) => ({
      key,
      label,
      kwh: Number(confirmed[key] || 0),
    }));
  }, [trayState]);

  const whatIfSavings = applianceBase.reduce(
    (sum, a) => sum + a.kwh * (reductions[a.key] / 100) * tariff,
    0
  );
  const whatIfBill = monthlyCost != null ? Math.max(0, monthlyCost - whatIfSavings) : null;

  // Feature 8: Tariff plan comparison (night-tariff vs flat rate)
  const tariffCompare = useMemo(() => {
    if (!hourlyProfileAvail || hourlyProfile.length === 0) return null;
    if (monthlyKwh == null || monthlyCost == null) return null;
    const totalWatts = hourlyProfile.reduce((s, h) => s + h.watts * h.count, 0);
    if (totalWatts <= 0) return null;
    let nightWatts = 0;
    hourlyProfile.forEach((h) => {
      if (h.hour >= 22 || h.hour < 6) nightWatts += h.watts * h.count;
    });
    const nightShare = nightWatts / totalWatts;
    const nightRate = tariff * 0.7; // discounted off-peak
    const dayRate = tariff * 1.1; // peak surcharge
    const blendedRate = nightShare * nightRate + (1 - nightShare) * dayRate;
    const touMonthly = monthlyKwh * blendedRate;
    return {
      nightShare: nightShare * 100,
      flatMonthly: monthlyCost,
      touMonthly,
      savings: monthlyCost - touMonthly,
      nightRate,
      dayRate,
    };
  }, [hourlyProfile, hourlyProfileAvail, monthlyKwh, monthlyCost, tariff]);

  // Feature 9: Weekday vs weekend (from 24h profile + daily rows)
  const weekPattern = useMemo(() => {
    if (dailyRows.length < 7) return null;
    const weekday = [];
    const weekend = [];
    dailyRows.forEach((d) => {
      const dt = new Date(d.date + 'T12:00:00');
      const dow = dt.getDay();
      if (dow === 0 || dow === 6) weekend.push(Number(d.total_kwh || 0));
      else weekday.push(Number(d.total_kwh || 0));
    });
    const wdAvg = weekday.length ? weekday.reduce((a, b) => a + b, 0) / weekday.length : 0;
    const weAvg = weekend.length ? weekend.reduce((a, b) => a + b, 0) / weekend.length : 0;
    if (!wdAvg && !weAvg) return null;
    const diffPct = wdAvg > 0 ? ((weAvg - wdAvg) / wdAvg) * 100 : 0;
    return { wdAvg, weAvg, diffPct };
  }, [dailyRows]);

  // Feature 10: Today vs same day last week
  const todayVsLast = useMemo(() => {
    if (dailyRows.length < 8) return null;
    const today = dailyRows[dailyRows.length - 1];
    const lastWeek = dailyRows[dailyRows.length - 8];
    if (!today || !lastWeek) return null;
    const todayKwh = Number(today.total_kwh || 0);
    const lastKwh = Number(lastWeek.total_kwh || 0);
    const diffPct = lastKwh > 0 ? ((todayKwh - lastKwh) / lastKwh) * 100 : todayKwh > 0 ? 100 : 0;
    return {
      todayKwh,
      lastKwh,
      diffPct,
      todayCost: todayKwh * tariff,
      lastCost: lastKwh * tariff,
      todayDay: shortDay(today.date),
      lastDay: shortDay(lastWeek.date),
    };
  }, [dailyRows, tariff]);

  // Feature 6: Appliance health flags from tray events
  const healthFlags = useMemo(() => {
    const flags = [];
    const events = trayState?.active_events || [];
    const signatureMax = {
      kettle: 300,
      microwave: 600,
      fridge: 2400,
      washing_machine: 5400,
      dishwasher: 7200,
    };
    const signatureMin = {
      kettle: 30,
      microwave: 20,
      fridge: 300,
      washing_machine: 900,
      dishwasher: 1800,
    };
    events.forEach((event) => {
      const appliance = event.confirmed_appliance;
      if (!appliance || appliance === 'other') return;
      const elapsed = Number(event.elapsed_seconds || 0);
      const max = signatureMax[appliance];
      const min = signatureMin[appliance];
      if (max && elapsed > max) {
        flags.push({
          appliance,
          severity: 'high',
          message: `${appliance.replace(/_/g, ' ')} cycle has run ${Math.round(elapsed / 60)} min — well beyond the normal ${Math.round(max / 60)} min. Check for a fault (e.g., fridge door gasket).`,
        });
      } else if (min && elapsed < min) {
        flags.push({
          appliance,
          severity: 'info',
          message: `${appliance.replace(/_/g, ' ')} cycle still in progress (${Math.round(elapsed)}s). Monitoring…`,
        });
      } else {
        flags.push({
          appliance,
          severity: 'ok',
          message: `${appliance.replace(/_/g, ' ')} cycle within normal duration range (${Math.round(elapsed / 60)} min).`,
        });
      }
    });
    const baseline = Number(trayState?.baseline_watts || 0);
    if (baseline > 60) {
      flags.push({
        appliance: 'standby',
        severity: 'medium',
        message: `Baseline (standby) load is ${Math.round(baseline)}W — unusually high. Unplug idle devices to reduce waste.`,
      });
    }
    return flags;
  }, [trayState]);

  const handleSlider = (key, value) => {
    setReductions((prev) => ({ ...prev, [key]: Number(value) }));
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50">
      <header className="bg-white/80 backdrop-blur-lg border-b border-emerald-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-emerald-700 hover:text-emerald-900 text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <div>
              <h1 className="text-xl font-bold text-emerald-900">ML predictions &amp; Bill Intelligence</h1>
              <p className="text-sm text-emerald-600">
                Appliance breakdown, bill forecast, and data-driven insights
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value.trim())}
              className="border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[200px]"
              placeholder="Device ID"
            />
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
            >
              Reload
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Existing: Appliance breakdown + Bill forecast */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <PieIcon className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-emerald-900">
                Latest appliance breakdown
              </h2>
            </div>
            {loading ? (
              <div className="h-[320px] flex items-center justify-center text-emerald-600 text-sm">
                Loading…
              </div>
            ) : predError && !predictions ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                {predError} After ~599 samples, the backend triggers ML and stores a row. Keep the
                simulator running.
              </p>
            ) : pieData.length === 0 ? (
              <p className="text-sm text-emerald-600">
                All appliance estimates are zero for the latest prediction.
              </p>
            ) : (
              <>
                {predictions?.timestamp && (
                  <p className="text-xs text-emerald-600 mb-2">
                    Timestamp:{' '}
                    <span className="text-emerald-900">
                      {new Date(predictions.timestamp).toLocaleString()}
                    </span>
                  </p>
                )}
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="watts"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${Number(value).toFixed(1)} W`, 'Estimated']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-xs text-emerald-600 mt-2 text-center">
                  Share of estimated power (W) across appliances — total {totalW.toFixed(0)} W
                </p>
              </>
            )}
          </div>

          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <IndianRupee className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-emerald-900">Bill forecast</h2>
            </div>
            {loading ? (
              <div className="h-[200px] flex items-center justify-center text-emerald-600 text-sm">
                Loading…
              </div>
            ) : billError && !bill ? (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                {billError}. Ensure Flask is running on{' '}
                <code className="bg-red-100 px-1 rounded">FLASK_URL</code> (default{' '}
                <code className="bg-red-100 px-1 rounded">http://localhost:5001</code>).
              </p>
            ) : bill ? (
              <div className="space-y-6">
                <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 shadow-lg">
                  <p className="text-sm text-emerald-100 font-medium">Estimated cost (next day)</p>
                  <p className="text-4xl font-bold mt-1 flex items-baseline gap-1">
                    <span className="text-2xl">₹</span>
                    {bill.estimated_cost_inr != null
                      ? Number(bill.estimated_cost_inr).toFixed(2)
                      : '—'}
                  </p>
                  <p className="text-sm text-emerald-100 mt-3">
                    Next day:{' '}
                    <span className="text-white font-semibold">
                      {bill.next_day_kwh != null
                        ? `${Number(bill.next_day_kwh).toFixed(3)} kWh`
                        : '—'}
                    </span>
                  </p>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="border border-emerald-100 rounded-lg p-4 bg-emerald-50/50">
                    <dt className="text-emerald-600 font-medium">Last 30 days (kWh)</dt>
                    <dd className="text-2xl font-bold text-emerald-900 mt-1">
                      {bill.last_30_days_kwh != null
                        ? Number(bill.last_30_days_kwh).toFixed(3)
                        : '—'}
                    </dd>
                  </div>
                  <div className="border border-emerald-100 rounded-lg p-4 bg-emerald-50/50">
                    <dt className="text-emerald-600 font-medium">Monthly estimate (INR)</dt>
                    <dd className="text-2xl font-bold text-emerald-900 mt-1 flex items-baseline gap-0.5">
                      <span className="text-lg">₹</span>
                      {bill.monthly_estimate_inr != null
                        ? Number(bill.monthly_estimate_inr).toFixed(2)
                        : '—'}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-emerald-600 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                  Bill values come from Flask <code className="bg-emerald-100 px-1 rounded">/predict/bill</code>{' '}
                  using recent daily kWh from this device.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Feature 1, 5, 7: Trust / Carbon / Budget gap */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-semibold text-emerald-900">How trustworthy is this forecast?</h3>
            </div>
            {loading ? (
              <p className="text-sm text-emerald-600">Loading…</p>
            ) : !trustInfo ? (
              <p className="text-xs text-emerald-600">Could not load prediction history.</p>
            ) : trustInfo.samples > 0 ? (
              <div>
                <p className="text-3xl font-bold text-emerald-900">
                  ±{trustInfo.avgErrorPct.toFixed(1)}%
                </p>
                <p className="text-xs text-emerald-600 mt-2">
                  Average error of the disaggregation model vs actual readings across{' '}
                  {trustInfo.samples} prediction{trustInfo.samples === 1 ? '' : 's'}.
                </p>
                <span
                  className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                    trustInfo.avgErrorPct <= 15
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {trustInfo.avgErrorPct <= 15 ? 'Reliable' : 'Needs more data'}
                </span>
              </div>
            ) : (
              <p className="text-xs text-emerald-600">
                No comparison data yet. Once the ML model stores a few predictions with matching
                readings, the accuracy estimate will appear here.
              </p>
            )}
          </div>

          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Leaf className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-semibold text-emerald-900">Carbon footprint</h3>
            </div>
            {loading ? (
              <p className="text-sm text-emerald-600">Loading…</p>
            ) : co2Kg == null ? (
              <p className="text-xs text-emerald-600">
                No usage data yet. Once the device streams readings, your carbon footprint will
                appear here.
              </p>
            ) : (
              <div>
                <p className="text-3xl font-bold text-emerald-900">~{co2Kg.toFixed(0)} kg</p>
                <p className="text-xs text-emerald-600 mt-2">
                  CO₂ this month from ~{monthlyKwh.toFixed(0)} kWh (at 0.82 kg/kWh).
                </p>
                <p className="text-xs text-emerald-700 mt-2">
                  Equivalent to planting <strong>{treesEquivalent.toFixed(1)}</strong> trees per year
                  to offset.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-semibold text-emerald-900">Forecast vs budget</h3>
            </div>
            {loading ? (
              <p className="text-sm text-emerald-600">Loading…</p>
            ) : budgetDiff == null ? (
              <p className="text-xs text-emerald-600">
                No bill forecast available yet. Keep the device streaming and your budget status
                will appear here.
              </p>
            ) : budgetDiff > 0 ? (
              <div>
                <p className="text-2xl font-bold text-red-600">₹{budgetDiff.toFixed(0)} over</p>
                <p className="text-xs text-emerald-600 mt-2">
                  On track to exceed your ₹{budgetGoal.toFixed(0)} budget. To stay on target, cut{' '}
                  <strong>{kwhToCut.toFixed(1)} kWh</strong> over the next {remainingDays} days (~{' '}
                  {(kwhToCut / remainingDays).toFixed(2)} kWh/day).
                </p>
                <span className="mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                  Action needed
                </span>
              </div>
            ) : (
              <div>
                <p className="text-2xl font-bold text-emerald-900">₹{Math.abs(budgetDiff).toFixed(0)} under</p>
                <p className="text-xs text-emerald-600 mt-2">
                  Projected bill is within your ₹{budgetGoal.toFixed(0)} budget. Keep it up.
                </p>
                <span className="mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  On track
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Feature 2: Bill trajectory graph */}
        {trajectory.length > 0 && (
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-semibold text-emerald-900">Bill trajectory (last 7 days)</h3>
            </div>
            <p className="text-xs text-emerald-600 mb-4">
              Cumulative spend vs your budget pace. Projected month-end:{' '}
              <strong>₹{trajectoryProjection.toFixed(0)}</strong>
              {trajectoryProjection > budgetGoal
                ? ' — over budget'
                : ' — within budget'}.
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trajectory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                <XAxis dataKey="day" stroke="#059669" fontSize={11} />
                <YAxis stroke="#059669" fontSize={11} label={{ value: '₹', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value, name) => [name === 'budgetPace' ? `₹${value}` : `₹${value}`, name === 'budgetPace' ? 'Budget pace' : 'Cumulative cost']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #d1fae5' }}
                />
                <Legend />
                <ReferenceLine
                  y={budgetGoal / 2}
                  stroke="#f59e0b"
                  strokeDasharray="5 5"
                  label={{ value: 'Budget pace', fill: '#d97706', fontSize: 11, position: 'insideBottomRight' }}
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.15}
                  name="Cumulative cost"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Feature 3: What-if simulator */}
        {applianceBase.some((a) => a.kwh > 0) && (
        <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-emerald-900">What-if savings simulator</h3>
          </div>
          <p className="text-xs text-emerald-600 mb-4">
            Drag the sliders to see how reducing each appliance affects your projected bill.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              {applianceBase.map((a) => (
                <div key={a.key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-emerald-900 font-medium">{a.label}</span>
                    <span className="text-emerald-600 text-xs">
                      {a.kwh.toFixed(1)} kWh · {reductions[a.key]}% reduction
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={reductions[a.key]}
                    onChange={(e) => handleSlider(a.key, e.target.value)}
                    className="w-full accent-emerald-600"
                  />
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 shadow-lg flex flex-col justify-center">
              <p className="text-sm text-emerald-100 font-medium">Projected monthly bill</p>
              {whatIfBill == null ? (
                <p className="text-sm text-emerald-100 mt-2">
                  No bill data yet — the projected bill will appear here once readings are
                  available.
                </p>
              ) : (
                <>
                  <p className="text-4xl font-bold mt-1">₹{whatIfBill.toFixed(0)}</p>
                  <p className="text-sm text-emerald-100 mt-2">
                    vs ₹{monthlyCost.toFixed(0)} currently — you'd save{' '}
                    <span className="text-white font-semibold">
                      ₹{whatIfSavings.toFixed(0)}/month
                    </span>{' '}
                    (₹{(whatIfSavings * 12).toFixed(0)}/year).
                  </p>
                  {whatIfSavings <= 0 && (
                    <p className="text-xs text-emerald-100 mt-3">
                      Move a slider to see potential savings.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Feature 4 + 8: Day costs + tariff comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-semibold text-emerald-900">Costliest days (last 7 days)</h3>
            </div>
            {dayCosts.length === 0 ? (
              <p className="text-xs text-emerald-600">No daily data available yet.</p>
            ) : (
              <div className="space-y-2">
                {dayCosts.map((d, i) => (
                  <div
                    key={d.date}
                    className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${
                      i === 0 && d.cost > 0
                        ? 'border-red-200 bg-red-50/60'
                        : 'border-emerald-100 bg-emerald-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{i === 0 && d.cost > 0 ? '🔥' : '⚡'}</span>
                      <div>
                        <p className="text-sm font-medium text-emerald-900">{d.day}</p>
                        <p className="text-xs text-emerald-600">{d.kwh.toFixed(3)} kWh</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-900">₹{d.cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-semibold text-emerald-900">Tariff plan comparison</h3>
            </div>
            {loading ? (
              <p className="text-sm text-emerald-600">Loading…</p>
            ) : !tariffCompare ? (
              <p className="text-xs text-emerald-600">
                Not enough usage data to compute a plan comparison yet.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                    <p className="text-xs text-emerald-600 font-semibold uppercase">Current (flat)</p>
                    <p className="text-xl font-bold text-emerald-900">₹{tariffCompare.flatMonthly.toFixed(0)}</p>
                  </div>
                  <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-3">
                    <p className="text-xs text-teal-600 font-semibold uppercase">Night-tariff</p>
                    <p className="text-xl font-bold text-teal-900">₹{tariffCompare.touMonthly.toFixed(0)}</p>
                  </div>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  About <strong>{tariffCompare.nightShare.toFixed(0)}%</strong> of your usage falls in
                  off-peak hours (10pm–6am). A night-tariff plan (₹{tariffCompare.nightRate.toFixed(2)}/kWh
                  off-peak, ₹{tariffCompare.dayRate.toFixed(2)}/kWh peak) could save you{' '}
                  <strong>
                    ₹{tariffCompare.savings > 0 ? tariffCompare.savings.toFixed(0) : 0}/month
                  </strong>
                  {tariffCompare.savings <= 0 ? ' — worth shifting more load to night hours' : ''}.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Features 6, 9, 10: Health flags + patterns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-semibold text-emerald-900">Appliance health</h3>
            </div>
            {healthFlags.length === 0 ? (
              <p className="text-xs text-emerald-600">
                No appliance cycles detected yet. Keep the device streaming and cycles will be
                analyzed here.
              </p>
            ) : (
              <div className="space-y-2">
                {healthFlags.map((f, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border px-3 py-2.5 text-xs ${
                      f.severity === 'high'
                        ? 'border-red-200 bg-red-50 text-red-800'
                        : f.severity === 'medium'
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : f.severity === 'info'
                            ? 'border-sky-200 bg-sky-50 text-sky-800'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {f.message}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-semibold text-emerald-900">Weekday vs weekend</h3>
            </div>
            {!weekPattern ? (
              <p className="text-xs text-emerald-600">Need at least a week of daily data.</p>
            ) : (
              <div>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <div className="h-24 flex items-end rounded-lg bg-emerald-100 overflow-hidden">
                      <div
                        className="w-full bg-emerald-500 rounded-t-lg"
                        style={{ height: `${Math.min(100, (weekPattern.wdAvg / Math.max(weekPattern.wdAvg, weekPattern.weAvg)) * 100)}%` }}
                      />
                    </div>
                    <p className="text-center text-xs text-emerald-600 mt-1">
                      Weekday · {weekPattern.wdAvg.toFixed(2)} kWh
                    </p>
                  </div>
                  <div className="flex-1">
                    <div className="h-24 flex items-end rounded-lg bg-teal-100 overflow-hidden">
                      <div
                        className="w-full bg-teal-500 rounded-t-lg"
                        style={{ height: `${Math.min(100, (weekPattern.weAvg / Math.max(weekPattern.wdAvg, weekPattern.weAvg)) * 100)}%` }}
                      />
                    </div>
                    <p className="text-center text-xs text-teal-600 mt-1">
                      Weekend · {weekPattern.weAvg.toFixed(2)} kWh
                    </p>
                  </div>
                </div>
                <p className="text-xs text-emerald-700 mt-3">
                  {weekPattern.diffPct >= 0
                    ? `Weekends use ${weekPattern.diffPct.toFixed(0)}% more power than weekdays.`
                    : `Weekdays use ${Math.abs(weekPattern.diffPct).toFixed(0)}% more power than weekends.`}
                </p>
              </div>
            )}
          </div>

          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-semibold text-emerald-900">Today vs last week</h3>
            </div>
            {!todayVsLast ? (
              <p className="text-xs text-emerald-600">Need 8 days of daily data to compare.</p>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                    <p className="text-xs text-emerald-600 font-semibold">{todayVsLast.todayDay}</p>
                    <p className="text-xl font-bold text-emerald-900">
                      ₹{todayVsLast.todayCost.toFixed(2)}
                    </p>
                    <p className="text-xs text-emerald-600">{todayVsLast.todayKwh.toFixed(3)} kWh</p>
                  </div>
                  <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-3">
                    <p className="text-xs text-teal-600 font-semibold">{todayVsLast.lastDay}</p>
                    <p className="text-xl font-bold text-teal-900">
                      ₹{todayVsLast.lastCost.toFixed(2)}
                    </p>
                    <p className="text-xs text-teal-600">{todayVsLast.lastKwh.toFixed(3)} kWh</p>
                  </div>
                </div>
                <p className="text-xs text-emerald-700 mt-3">
                  {todayVsLast.diffPct >= 0
                    ? `Up ${todayVsLast.diffPct.toFixed(0)}% vs the same day last week.`
                    : `Down ${Math.abs(todayVsLast.diffPct).toFixed(0)}% vs the same day last week.`}
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-emerald-600">
          <Link to="/dashboard/live" className="font-medium text-emerald-800 hover:underline">
            ← Live voltage / current / power
          </Link>
        </p>
      </main>
    </div>
  );
}
