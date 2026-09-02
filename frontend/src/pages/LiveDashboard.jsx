import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Gauge,
  RefreshCw,
  Zap,
  Plug,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../utils/api';

function initialDeviceId() {
  const stored = localStorage.getItem('wattlab_device_id');
  if (stored) return stored;
  return import.meta.env.VITE_DEFAULT_DEVICE_ID || 'SIM-DEVICE-001';
}

/** Supabase / API column names → display labels */
const APPLIANCE_KEYS = [
  { key: 'kettle', label: 'Kettle' },
  { key: 'microwave', label: 'Microwave' },
  { key: 'fridge', label: 'Fridge' },
  { key: 'dishwasher', label: 'Dishwasher' },
  { key: 'washing_machine', label: 'Washing machine' },
];

const RUNNING_THRESHOLD_W = 50;

const ACTIVITY_DISPLAY = {
  idle: {
    title: 'Idle',
    badge: 'NO APPLIANCE ON',
    description: 'No clear appliance activity detected in the latest window.',
    className: 'border-slate-200 bg-slate-50 text-slate-900',
  },
  bulb_only: {
    title: 'Bulb ON',
    badge: 'ON-BULB',
    description: 'The latest power pattern matches the bulb load.',
    className: 'border-amber-200 bg-amber-50 text-amber-950',
  },
  other_only: {
    title: 'Other appliance ON',
    badge: 'ON-OTHER',
    description: 'The model sees appliance activity, but not the bulb signature.',
    className: 'border-sky-200 bg-sky-50 text-sky-950',
  },
  bulb_plus_other: {
    title: 'Bulb + other appliance ON',
    badge: 'BULB + OTHER',
    description: 'The model sees the bulb running together with another appliance.',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  },
};

function activeAppliancesFromPrediction(pred) {
  if (!pred) return [];
  return APPLIANCE_KEYS.map(({ key, label }) => ({
    key,
    label,
    watts: Math.max(0, Number(pred[key]) || 0),
  }))
    .filter((a) => a.watts >= RUNNING_THRESHOLD_W)
    .sort((a, b) => b.watts - a.watts);
}

function activityDisplay(activity) {
  if (!activity?.activity_label) {
    return {
      title: 'Waiting for activity model',
      badge: 'COLLECTING',
      description:
        activity?.reason ||
        'Send at least 31 recent readings, then this card will classify bulb/other activity.',
      className: 'border-emerald-100 bg-white text-emerald-900',
    };
  }

  return ACTIVITY_DISPLAY[activity.activity_label] || {
    title: activity.activity_label,
    badge: 'MODEL RESULT',
    description: 'The model returned a label that is not in the dashboard display map yet.',
    className: 'border-emerald-100 bg-white text-emerald-900',
  };
}

function formatApplianceName(appliance) {
  return String(appliance || '').replace(/_/g, ' ');
}

const CONFIRM_SECONDS = {
  kettle: 30,
  microwave: 20,
  fridge: 300,
  washing_machine: 900,
  dishwasher: 1800,
  other: 30,
};

function CandidateTray({ trayState, trayError }) {
  const events = trayState?.active_events || [];
  const hasEvents = events.length > 0;

  return (
    <div className="mt-6 border-t border-emerald-100 pt-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
          Candidate tray
        </h3>
        {trayState?.current_power_watts != null && (
          <span className="text-xs text-emerald-500 tabular-nums">
            {Math.round(Number(trayState.current_power_watts))} W now
          </span>
        )}
      </div>

      {trayError && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          {trayError}
        </p>
      )}

      {!hasEvents && !trayError && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-4 flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-600" />
          </span>
          <div>
            <p className="font-semibold text-emerald-900">All quiet - monitoring for appliance activity</p>
            <p className="text-xs text-emerald-600">A new power step will open candidates here.</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {events.map((event) => {
          const candidates = event.candidates || [];
          const elapsed = Number(event.elapsed_seconds || 0);
          const targetSeconds = Math.max(
            1,
            ...candidates.map((candidate) => CONFIRM_SECONDS[candidate] || 30)
          );
          const progress = Math.min(100, (elapsed / targetSeconds) * 100);
          const confirmedKwh =
            trayState?.total_confirmed_kwh?.[event.confirmed_appliance] || 0;

          return (
            <div
              key={event.event_id}
              className={`rounded-xl border px-4 py-4 ${
                event.status === 'confirmed'
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-emerald-100 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white tabular-nums">
                  {event.delta_watts >= 0 ? '+' : ''}
                  {Number(event.delta_watts || 0).toFixed(0)} W detected
                </span>
                <div className="text-xs text-emerald-500 tabular-nums">
                  {event.status === 'pending'
                    ? `Analyzing for ${Math.round(elapsed)}s...`
                    : `${Math.round(elapsed)}s window`}
                </div>
              </div>

              {event.status === 'pending' && (
                <>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-emerald-600">Could be:</span>
                    {candidates.map((candidate) => (
                      <span
                        key={candidate}
                        className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-900 transition-all"
                      >
                        {formatApplianceName(candidate)}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-emerald-100">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </>
              )}

              {event.status === 'confirmed' && (
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-2xl font-bold text-white">
                    OK
                  </div>
                  <div>
                    <p className="text-xl font-bold text-emerald-900">
                      {formatApplianceName(event.confirmed_appliance)} confirmed
                    </p>
                    <p className="text-sm text-emerald-700">
                      Added {Number(confirmedKwh).toFixed(3)} kWh to{' '}
                      {formatApplianceName(event.confirmed_appliance)}
                    </p>
                  </div>
                </div>
              )}

              {event.status === 'eliminated' && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                  Classified as other
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApplianceConsumption({ trayState }) {
  if (!trayState?.total_confirmed_kwh) return null;

  const entries = Object.entries(trayState.total_confirmed_kwh)
    .filter(([, kwh]) => Number(kwh) > 0)
    .sort(([, a], [, b]) => Number(b) - Number(a));

  if (!entries.length) return null;

  const tariff = Number(localStorage.getItem('wattlab_tariff') || 8.5);
  const durations = (trayState.active_events || []).reduce((acc, event) => {
    if (event.confirmed_appliance) {
      acc[event.confirmed_appliance] = Math.max(
        acc[event.confirmed_appliance] || 0,
        Number(event.elapsed_seconds || 0)
      );
    }
    return acc;
  }, {});

  return (
    <div className="mt-6 border-t border-emerald-100 pt-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-600 mb-3">
        Session summary
      </h3>
      <div className="overflow-x-auto rounded-lg border border-emerald-100 bg-white">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-emerald-100 text-emerald-600">
              <th className="px-4 py-3 font-semibold">Appliance</th>
              <th className="px-4 py-3 font-semibold">Duration</th>
              <th className="px-4 py-3 font-semibold">kWh</th>
              <th className="px-4 py-3 font-semibold">Est. Cost (Rs)</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([appliance, kwh]) => (
              <tr key={appliance} className="border-b border-emerald-50">
                <td className="px-4 py-3 font-medium capitalize text-emerald-900">
                  {formatApplianceName(appliance)}
                </td>
                <td className="px-4 py-3 text-emerald-700">
                  {durations[appliance] ? `${Math.round(durations[appliance])}s` : '-'}
                </td>
                <td className="px-4 py-3 tabular-nums text-emerald-700">
                  {Number(kwh).toFixed(3)}
                </td>
                <td className="px-4 py-3 tabular-nums text-emerald-700">
                  {(Number(kwh) * tariff).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LiveDashboard() {
  const [deviceId, setDeviceId] = useState(initialDeviceId);
  const [live, setLive] = useState(null);
  const [daily, setDaily] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [liveError, setLiveError] = useState(null);
  const [chartsError, setChartsError] = useState(null);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [latestPrediction, setLatestPrediction] = useState(null);
  const [predictionError, setPredictionError] = useState(null);
  const [activityPrediction, setActivityPrediction] = useState(null);
  const [activityError, setActivityError] = useState(null);
  const [trayState, setTrayState] = useState(null);
  const [trayError, setTrayError] = useState(null);

  // On mount: auto-load the user's assigned device from the backend
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('http://localhost:5000/api/devices', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.devices) && data.devices.length > 0) {
          const firstDeviceId = data.devices[0].device_id;
          setDeviceId(firstDeviceId);
          localStorage.setItem('wattlab_device_id', firstDeviceId);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem('wattlab_device_id', deviceId);
  }, [deviceId]);

  const fetchLive = useCallback(async () => {
    try {
      const { data } = await api.get(`/readings/live/${encodeURIComponent(deviceId)}`);
      setLive(data.reading);
      setLiveError(null);
    } catch (err) {
      setLive(null);
      setLiveError(
        err.response?.data?.message || err.message || 'No live reading'
      );
    }
  }, [deviceId]);

  const fetchLatestPrediction = useCallback(async () => {
    try {
      const { data } = await api.get(
        `/predictions/${encodeURIComponent(deviceId)}`
      );
      setLatestPrediction(data.predictions || null);
      setPredictionError(null);
    } catch (err) {
      setLatestPrediction(null);
      setPredictionError(
        err.response?.status === 404
          ? 'No ML row yet — send ~599 samples so the backend runs disaggregation.'
          : err.response?.data?.message || err.message || 'Predictions unavailable'
      );
    }
  }, [deviceId]);

  const fetchActivityPrediction = useCallback(async () => {
    try {
      const { data } = await api.get(
        `/predictions/activity/${encodeURIComponent(deviceId)}`
      );
      setActivityPrediction(data.activity || null);
      setActivityError(null);
    } catch (err) {
      setActivityPrediction(null);
      setActivityError(
        err.response?.data?.message || err.message || 'Bulb activity model unavailable'
      );
    }
  }, [deviceId]);

  const fetchTrayState = useCallback(async () => {
    try {
      const { data } = await api.get('/tray/state');
      setTrayState(data);
      setTrayError(null);
    } catch (err) {
      setTrayError(err.response?.data?.message || err.message || 'Candidate tray unavailable');
    }
  }, []);

  const fetchCharts = useCallback(async () => {
    setLoadingCharts(true);
    setChartsError(null);
    try {
      const [dRes, wRes] = await Promise.all([
        api.get(`/readings/daily/${encodeURIComponent(deviceId)}`),
        api.get(`/readings/weekly/${encodeURIComponent(deviceId)}`),
      ]);
      setDaily(dRes.data?.summary || []);
      setWeekly(wRes.data?.summary || []);
    } catch (err) {
      setChartsError(err.response?.data?.message || err.message || 'Failed to load summaries');
      setDaily([]);
      setWeekly([]);
    } finally {
      setLoadingCharts(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchLive();
    const id = setInterval(fetchLive, 2000);
    return () => clearInterval(id);
  }, [fetchLive]);

  useEffect(() => {
    fetchLatestPrediction();
    const id = setInterval(fetchLatestPrediction, 4000);
    return () => clearInterval(id);
  }, [fetchLatestPrediction]);

  useEffect(() => {
    fetchActivityPrediction();
    const id = setInterval(fetchActivityPrediction, 4000);
    return () => clearInterval(id);
  }, [fetchActivityPrediction]);

  useEffect(() => {
    fetchTrayState();
    const id = setInterval(fetchTrayState, 10000);
    return () => clearInterval(id);
  }, [fetchTrayState]);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  const dailyChart = daily.map((row) => ({
    ...row,
    label: row.date
      ? new Date(row.date + 'T12:00:00').toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        })
      : '',
  }));

  const runningAppliances = activeAppliancesFromPrediction(latestPrediction);
  const activityStatus = activityDisplay(activityPrediction);
  const hasActivityCorrection = Boolean(activityPrediction?.correction_applied);
  const activityConfidence =
    activityPrediction?.confidence != null && !hasActivityCorrection
      ? `${Math.round(Number(activityPrediction.confidence) * 100)}% confidence`
      : null;
  const activityProbabilities = activityPrediction?.probabilities
    ? Object.entries(activityPrediction.probabilities)
    : [];
  const displayActivityChips = hasActivityCorrection && activityPrediction?.activity_label
    ? [[activityPrediction.activity_label, 'active']]
    : activityProbabilities;

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
              <h1 className="text-xl font-bold text-emerald-900">Day-Wise Live Readings</h1>
              <p className="text-sm text-emerald-600">
                Real-time 2s telemetry feed &amp; NILM Candidate Tray
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="e.g. SIM-DEVICE-001"
              className="px-3 py-2 border border-emerald-200 rounded-lg text-sm text-emerald-900"
            />
            <button
              type="button"
              onClick={() => {
                fetchLive();
                fetchCharts();
                fetchLatestPrediction();
                fetchActivityPrediction();
                fetchTrayState();
              }}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh charts
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-emerald-600 font-medium">Voltage</span>
              <Gauge className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-emerald-900">
              {live?.voltage != null ? Number(live.voltage).toFixed(1) : '—'}
            </p>
            <p className="text-xs text-emerald-500 mt-1">Volts (V)</p>
          </div>
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-emerald-600 font-medium">
                Total aggregated current
              </span>
              <Activity className="w-5 h-5 text-teal-500" />
            </div>
            <p className="text-3xl font-bold text-emerald-900">
              {live?.current != null ? Number(live.current).toFixed(3) : '—'}
            </p>
            <p className="text-xs text-emerald-500 mt-1">
              Whole-home (A) — one measurement for all loads
            </p>
          </div>
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-emerald-600 font-medium">Active power</span>
              <Zap className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-emerald-900">
              {live?.power != null ? Math.round(Number(live.power)) : '—'}
            </p>
            <p className="text-xs text-emerald-500 mt-1">
              Total active power (W) — same aggregate as current × voltage (≈)
            </p>
          </div>
        </div>

        <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Plug className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-emerald-900">
              Predicted Appliances Over Time
            </h2>
          </div>
          <p className="text-sm text-emerald-600 mb-4">
            Live multi-appliance candidate tray and consumption tracking.
          </p>

          <CandidateTray trayState={trayState} trayError={trayError} />
          <ApplianceConsumption trayState={trayState} />

          {runningAppliances.length > 0 && (
          <div className="mt-6 border-t border-emerald-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500 mb-3">
              Reference watt-estimate disaggregation
            </p>
          {predictionError && !latestPrediction ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              {predictionError}
            </p>
          ) : runningAppliances.length === 0 ? (
            <p className="text-emerald-800 font-medium">
              No strong appliance signature — likely idle or only baseline loads (
              {RUNNING_THRESHOLD_W}&nbsp;W threshold).
            </p>
          ) : (
            <ul className="space-y-3">
              {runningAppliances.map((a, i) => (
                <li
                  key={a.key}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                    i === 0
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-emerald-100 bg-white'
                  }`}
                >
                  <span className="text-emerald-900 font-medium">
                    {i === 0 ? 'Most likely: ' : ''}
                    {a.label}
                  </span>
                  <span className="text-emerald-700 tabular-nums">
                    ~{Math.round(a.watts)} W
                  </span>
                </li>
              ))}
            </ul>
          )}
          </div>
          )}
          {latestPrediction?.timestamp && (
            <p className="text-xs text-emerald-500 mt-4">
              ML snapshot:{' '}
              {new Date(latestPrediction.timestamp).toLocaleString()}
            </p>
          )}
        </div>

        {liveError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm px-4 py-3">
            {liveError}. Run <code className="bg-amber-100 px-1 rounded">09_simulate_esp32.py</code> and
            confirm the device ID matches.
          </div>
        )}

        {live?.timestamp && (
          <p className="text-sm text-emerald-600">
            Last sample:{' '}
            <span className="text-emerald-900 font-medium">
              {new Date(live.timestamp).toLocaleString()}
            </span>
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-emerald-900 mb-4">
              Daily energy (7 days)
            </h2>
            {loadingCharts ? (
              <div className="h-[280px] flex items-center justify-center text-emerald-600 text-sm">
                Loading…
              </div>
            ) : chartsError ? (
              <p className="text-sm text-red-600">{chartsError}</p>
            ) : dailyChart.length === 0 ? (
              <p className="text-sm text-emerald-600">No data in the last 7 days.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                  <XAxis dataKey="label" stroke="#059669" fontSize={12} />
                  <YAxis
                    stroke="#059669"
                    fontSize={12}
                    label={{ value: 'kWh', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    formatter={(v) => [`${Number(v).toFixed(4)} kWh`, 'Total']}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.date || ''
                    }
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #d1fae5',
                    }}
                  />
                  <Bar dataKey="total_kwh" fill="#10b981" name="kWh" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-emerald-900 mb-4">
              Energy trend (30 days, by week bucket)
            </h2>
            {loadingCharts ? (
              <div className="h-[280px] flex items-center justify-center text-emerald-600 text-sm">
                Loading…
              </div>
            ) : chartsError ? (
              <p className="text-sm text-red-600">{chartsError}</p>
            ) : weekly.length === 0 ? (
              <p className="text-sm text-emerald-600">No data in the last 30 days.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={weekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                  <XAxis dataKey="week" stroke="#059669" fontSize={12} />
                  <YAxis
                    stroke="#059669"
                    fontSize={12}
                    label={{ value: 'kWh', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    formatter={(v) => [`${Number(v).toFixed(4)} kWh`, 'Total']}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #d1fae5',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total_kwh"
                    stroke="#0d9488"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#0d9488' }}
                    name="kWh"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-emerald-600">
          <Link to="/dashboard/predictions" className="font-medium text-emerald-800 hover:underline">
            ML predictions & bill forecast →
          </Link>
        </p>
      </main>
    </div>
  );
}
