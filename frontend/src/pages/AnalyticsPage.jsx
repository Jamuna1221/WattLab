import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  Clock,
  PieChart as PieIcon,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import SharedLayout from '../components/SharedLayout';
import api from '../utils/api';
import { useDeviceId } from '../hooks/useDeviceId';
import { supabase } from '../supabaseClient';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function AnalyticsPage() {
  const { deviceId } = useDeviceId();
  const [timeframe, setTimeframe] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [hourly, setHourly] = useState([]);
  const [daily, setDaily] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [appliance, setAppliance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch Daily & Weekly summaries
      const [dRes, wRes, mRes, appRes] = await Promise.allSettled([
        api.get(`/readings/daily/${encodeURIComponent(deviceId)}`),
        api.get(`/readings/weekly/${encodeURIComponent(deviceId)}`),
        api.get(`/readings/monthly/${encodeURIComponent(deviceId)}`),
        api.get(`/readings/appliances/${encodeURIComponent(deviceId)}?timeframe=${timeframe}`),
      ]);

      if (dRes.status === 'fulfilled') {
        const dailyRows = (dRes.value.data?.summary || []).map((row) => ({
          day: row.date ? new Date(row.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' }) : '',
          kwh: Number(row.total_kwh || 0),
        }));
        setDaily(dailyRows);
      }

      if (wRes.status === 'fulfilled') {
        setWeekly((wRes.value.data?.summary || []).map(r => ({ week: r.week, kwh: Number(r.total_kwh || 0) })));
      }

      if (mRes.status === 'fulfilled') {
        setMonthly((mRes.value.data?.summary || []).map(r => ({ month: r.month, kwh: Number(r.total_kwh || 0) })));
      }

      if (appRes.status === 'fulfilled' && appRes.value.data?.breakdown) {
        setAppliance(appRes.value.data.breakdown);
      }

      // 2. Fetch 24-hour distribution from Supabase
      const { data: rawReadings } = await supabase
        .from('energy_readings')
        .select('power, timestamp')
        .eq('device_id', deviceId)
        .order('timestamp', { ascending: false })
        .limit(500);

      if (rawReadings && rawReadings.length > 0) {
        const hourMap = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, totalWatts: 0, count: 0 }));
        rawReadings.forEach((r) => {
          const dt = new Date(r.timestamp);
          const h = dt.getHours();
          if (h >= 0 && h < 24) {
            hourMap[h].totalWatts += Number(r.power || 0);
            hourMap[h].count += 1;
          }
        });
        setHourly(hourMap.map((h) => ({
          hour: h.hour,
          watts: h.count > 0 ? Math.round(h.totalWatts / h.count) : 0,
        })));
      }
    } catch (err) {
      setErrorMsg(err.message || 'Analytics data unavailable');
    } finally {
      setLoading(false);
    }
  }, [deviceId, timeframe]);

  useEffect(() => {
    load();
  }, [load]);

  const currentSummaryData = useMemo(() => {
    if (timeframe === 'daily') return daily.map(d => ({ label: d.day, kwh: d.kwh }));
    if (timeframe === 'weekly') return weekly.map(w => ({ label: w.week, kwh: w.kwh }));
    return monthly.map(m => ({ label: m.month, kwh: m.kwh }));
  }, [timeframe, daily, weekly, monthly]);

  const totalPeriodKwh = currentSummaryData.reduce((acc, r) => acc + Number(r.kwh || 0), 0);
  const avgPeriodKwh = currentSummaryData.length > 0 ? totalPeriodKwh / currentSummaryData.length : 0;
  const peakHour = hourly.length > 0 ? hourly.reduce((best, row) => (row.watts > (best?.watts || 0) ? row : best), hourly[0]) : null;
  const topAppliance = appliance.length > 0 ? appliance.reduce((best, row) => (row.kwh > (best?.kwh || 0) ? row : best), appliance[0]) : null;

  return (
    <SharedLayout activePage="analytics">
      <div className="space-y-6">
        {/* Header & Timeframe Selector */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-emerald-900">Energy Analytics</h2>
            <p className="text-sm text-emerald-600">
              Detailed breakdown of overall and appliance-level consumption across timeframes.
            </p>
          </div>

          {/* Timeframe Selector Pills */}
          <div className="inline-flex rounded-xl bg-emerald-100/80 p-1 shadow-inner self-start sm:self-auto">
            {[
              { id: 'daily', label: 'Daily (24h / 7 Days)' },
              { id: 'weekly', label: 'Weekly (Last 30 Days)' },
              { id: 'monthly', label: 'Monthly (12 Months)' },
            ].map((tf) => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                  timeframe === tf.id
                    ? 'bg-white text-emerald-900 shadow-sm'
                    : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
            {errorMsg}
          </div>
        )}

        {/* Overview Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-600">Average {timeframe} usage</p>
                <p className="text-2xl font-bold text-emerald-900 mt-1">{avgPeriodKwh.toFixed(2)} kWh</p>
                <p className="text-xs text-emerald-500 mt-1">Total: {totalPeriodKwh.toFixed(2)} kWh for period</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-600">Peak hour power</p>
                <p className="text-2xl font-bold text-emerald-900 mt-1">{peakHour?.hour || '-'}</p>
                <p className="text-xs text-emerald-500 mt-1">{peakHour?.watts ? `${peakHour.watts} W avg load` : 'No load data'}</p>
              </div>
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-teal-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-600">Top appliance</p>
                <p className="text-2xl font-bold text-emerald-900 mt-1 capitalize">{topAppliance?.name || '-'}</p>
                <p className="text-xs text-emerald-500 mt-1">{topAppliance?.kwh ? `${topAppliance.kwh} kWh (${timeframe})` : '-'}</p>
              </div>
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 1: Time Series & Hourly Distribution */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Main Timeframe Consumption Chart */}
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-semibold text-emerald-900 capitalize">
                  Overall {timeframe} trend (kWh)
                </h3>
              </div>
            </div>
            {currentSummaryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={currentSummaryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                  <XAxis dataKey="label" stroke="#059669" fontSize={11} />
                  <YAxis stroke="#059669" fontSize={11} />
                  <Tooltip formatter={(val) => [`${Number(val).toFixed(3)} kWh`, 'Energy']} />
                  <Bar dataKey="kwh" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-16 text-center text-xs text-emerald-600">No consumption data for this timeframe yet.</div>
            )}
          </div>

          {/* 24-Hour Power Profile */}
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-semibold text-emerald-900">24-Hour Load Distribution (W)</h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                <XAxis dataKey="hour" stroke="#059669" fontSize={10} interval={2} />
                <YAxis stroke="#059669" fontSize={11} />
                <Tooltip formatter={(value) => [`${value} W`, 'Average Load']} />
                <Bar dataKey="watts" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Appliance Breakdown Section */}
        <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-semibold text-emerald-900 capitalize">
                Appliance-Wise Breakdown ({timeframe})
              </h3>
            </div>
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Disaggregated by NILM &amp; Candidate Tray
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={appliance} dataKey="kwh" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e) => `${e.name}: ${e.kwh} kWh`}>
                  {appliance.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${Number(value).toFixed(3)} kWh`, 'Consumption']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>

            {/* List View with Progress Bars */}
            <div className="space-y-3">
              {appliance.map((app, idx) => {
                const pct = totalPeriodKwh > 0 ? ((app.kwh / totalPeriodKwh) * 100).toFixed(1) : 25;
                return (
                  <div key={app.name} className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-emerald-900 capitalize">{app.name}</span>
                      <span className="text-xs font-mono font-bold text-emerald-700">{app.kwh} kWh ({pct}%)</span>
                    </div>
                    <div className="w-full bg-emerald-200/60 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </SharedLayout>
  );
}
