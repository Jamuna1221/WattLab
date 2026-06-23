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
              <h1 className="text-xl font-bold text-emerald-900">Live readings</h1>
              <p className="text-sm text-emerald-600">
                Voltage, current, and power — updates every 2s
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <label className="text-xs text-emerald-600 font-medium sm:sr-only">
              Device ID
            </label>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value.trim())}
              className="border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[200px]"
              placeholder="e.g. SIM-DEVICE-001"
            />
            <button
              type="button"
              onClick={() => {
                fetchLive();
                fetchCharts();
                fetchLatestPrediction();
                fetchActivityPrediction();
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
              Which appliance is running?
            </h2>
          </div>
          <p className="text-sm text-emerald-600 mb-4">
            Live bulb activity classifier from the latest {activityPrediction?.window_size || 31}
            &nbsp;power samples. It can show idle, bulb only, other only, or bulb plus other.
          </p>
          <div className={`rounded-xl border px-4 py-4 ${activityStatus.className}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold tracking-wide">
                {activityStatus.badge}
              </span>
              {activityConfidence && (
                <span className="text-xs font-medium opacity-75">
                  {activityConfidence}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold">{activityStatus.title}</p>
            <p className="text-sm mt-1 opacity-80">{activityStatus.description}</p>
            {activityPrediction?.avg_power_watts != null && (
              <p className="text-xs mt-3 opacity-75">
                Avg {Number(activityPrediction.avg_power_watts).toFixed(2)} W, max{' '}
                {Number(activityPrediction.max_power_watts || 0).toFixed(2)} W
              </p>
            )}
          </div>

          {activityError && !activityPrediction && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mt-3">
              {activityError}
            </p>
          )}

          {displayActivityChips.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
              {displayActivityChips.map(([label, value]) => (
                <div
                  key={label}
                  className={`rounded-lg border px-3 py-2 ${
                    hasActivityCorrection
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-emerald-100 bg-white'
                  }`}
                >
                  <p className="text-xs text-emerald-500">
                    {label}
                  </p>
                  <p className="text-sm font-semibold text-emerald-900">
                    {typeof value === 'string'
                      ? value
                      : `${Math.round(Number(value) * 100)}%`}
                  </p>
                </div>
              ))}
            </div>
          )}

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
