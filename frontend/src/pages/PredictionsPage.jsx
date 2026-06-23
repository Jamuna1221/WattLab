import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, IndianRupee, PieChart as PieIcon, Sparkles } from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import api from '../utils/api';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

const APPLIANCE_KEYS = [
  { key: 'kettle', label: 'Kettle' },
  { key: 'microwave', label: 'Microwave' },
  { key: 'fridge', label: 'Fridge' },
  { key: 'dishwasher', label: 'Dishwasher' },
  { key: 'washing_machine', label: 'Washing machine' },
];

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

export default function PredictionsPage() {
  const [deviceId, setDeviceId] = useState(initialDeviceId);
  const [predictions, setPredictions] = useState(null);
  const [bill, setBill] = useState(null);
  const [predError, setPredError] = useState(null);
  const [billError, setBillError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem('wattlab_device_id', deviceId);
  }, [deviceId]);

  const load = useCallback(async () => {
    setLoading(true);
    setPredError(null);
    setBillError(null);
    const id = encodeURIComponent(deviceId);

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
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    load();
  }, [load]);

  const pieData = predictionsToPieRow(predictions);
  const totalW = pieData.reduce((s, d) => s + d.watts, 0);

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
              <h1 className="text-xl font-bold text-emerald-900">ML predictions</h1>
              <p className="text-sm text-emerald-600">
                Appliance breakdown and next-day bill estimate (INR)
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

        <p className="text-center text-sm text-emerald-600">
          <Link to="/dashboard/live" className="font-medium text-emerald-800 hover:underline">
            ← Live voltage / current / power
          </Link>
        </p>
      </main>
    </div>
  );
}
