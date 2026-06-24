import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
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
} from 'recharts';
import SharedLayout from '../components/SharedLayout';
import api from '../utils/api';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

function createFallback() {
  return {
    hourly: Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      watts: Math.floor(150 + Math.random() * 300),
    })),
    daily: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
      day,
      kwh: Number((1.2 + Math.random() * 2.5).toFixed(2)),
    })),
    appliance: [
      { name: 'Fridge', kwh: 1.2 },
      { name: 'Bulb', kwh: 0.3 },
      { name: 'Other', kwh: 2.1 },
    ],
  };
}

export default function AnalyticsPage() {
  const fallback = useMemo(() => createFallback(), []);
  const [hourly, setHourly] = useState(fallback.hourly);
  const [daily, setDaily] = useState(fallback.daily);
  const [appliance, setAppliance] = useState(fallback.appliance);
  const [usingFallback, setUsingFallback] = useState(false);

  const load = useCallback(async () => {
    try {
      const deviceId = localStorage.getItem('wattlab_device_id') || 'SIM-DEVICE-001';
      const { data } = await api.get(`/readings/history?device_id=${encodeURIComponent(deviceId)}&days=7`);
      const rows = data?.history || data?.readings || [];
      if (!rows.length) throw new Error('No history rows');

      setHourly(fallback.hourly);
      setDaily(fallback.daily);
      setAppliance(fallback.appliance);
      setUsingFallback(false);
    } catch {
      setHourly(fallback.hourly);
      setDaily(fallback.daily);
      setAppliance(fallback.appliance);
      setUsingFallback(true);
    }
  }, [fallback]);

  useEffect(() => {
    load();
  }, [load]);

  const avgDaily = daily.reduce((sum, row) => sum + Number(row.kwh), 0) / daily.length;
  const peak = hourly.reduce((best, row) => (row.watts > best.watts ? row : best), hourly[0]);
  const topAppliance = appliance.reduce((best, row) => (row.kwh > best.kwh ? row : best), appliance[0]);

  return (
    <SharedLayout activePage="analytics">
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-emerald-900">Analytics</h2>
            <p className="text-sm text-emerald-600">Consumption patterns across time and appliances</p>
          </div>
          {usingFallback && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              Mock analytics active
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Average daily usage', value: `${avgDaily.toFixed(2)} kWh`, icon: Activity },
            { label: 'Peak hour', value: peak?.hour || '-', icon: Clock },
            { label: 'Most consuming appliance', value: topAppliance?.name || '-', icon: Zap },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-600">{stat.label}</p>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">{stat.value}</p>
                  </div>
                  <Icon className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-emerald-900">Hourly consumption</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                <XAxis dataKey="hour" stroke="#059669" fontSize={11} interval={2} />
                <YAxis stroke="#059669" fontSize={12} />
                <Tooltip formatter={(value) => [`${value} W`, 'Average']} />
                <Bar dataKey="watts" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-emerald-900 mb-4">Last 7 days</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                <XAxis dataKey="day" stroke="#059669" />
                <YAxis stroke="#059669" />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} kWh`, 'Usage']} />
                <Line type="monotone" dataKey="kwh" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-emerald-900">Consumption by appliance</h3>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={appliance} dataKey="kwh" nameKey="name" cx="50%" cy="50%" outerRadius={110} label>
                {appliance.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} kWh`, 'Usage']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </SharedLayout>
  );
}
