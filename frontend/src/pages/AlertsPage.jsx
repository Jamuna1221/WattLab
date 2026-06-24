import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCheck, X } from 'lucide-react';
import SharedLayout from '../components/SharedLayout';
import { supabase } from '../supabaseClient';

const mockAlerts = [
  {
    id: 1,
    severity: 'high',
    title: 'Unusual power spike detected',
    message: 'Power jumped to 4200W at 2:34 PM - possible appliance fault.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    read: false,
  },
  {
    id: 2,
    severity: 'medium',
    title: 'High consumption day',
    message: "Today's usage is 40% above your daily average.",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    read: false,
  },
  {
    id: 3,
    severity: 'low',
    title: 'Fridge model trained',
    message: 'Fridge classifier ready - 78.7% accuracy on UK-DALE dataset.',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    read: true,
  },
  {
    id: 4,
    severity: 'low',
    title: 'Device connected',
    message: 'SIM-DEVICE-001 successfully linked to your account.',
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    read: true,
  },
];

function relativeTime(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const hours = Math.max(1, Math.round(diff / 3600000));
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const severityStyles = {
  high: 'border-red-500 text-red-700 bg-red-50',
  medium: 'border-orange-500 text-orange-700 bg-orange-50',
  low: 'border-emerald-500 text-emerald-700 bg-emerald-50',
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(mockAlerts);
  const [filter, setFilter] = useState('all');
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('alerts')
          .select('id, severity, title, message, timestamp, read')
          .order('timestamp', { ascending: false })
          .limit(50);
        if (error || !data?.length) throw error || new Error('No alerts');
        setAlerts(data);
        setUsingFallback(false);
      } catch {
        setAlerts(mockAlerts);
        setUsingFallback(true);
      }
    }
    load();
  }, []);

  const unread = alerts.filter((alert) => !alert.read).length;
  const visibleAlerts = useMemo(() => {
    if (filter === 'all') return alerts;
    if (filter === 'unread') return alerts.filter((alert) => !alert.read);
    return alerts.filter((alert) => alert.severity === filter);
  }, [alerts, filter]);

  return (
    <SharedLayout activePage="alerts">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-emerald-900">Alerts</h2>
              <span className="rounded-full bg-red-50 border border-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                {unread} unread
              </span>
            </div>
            <p className="text-sm text-emerald-600 mt-1">Device events and model notifications</p>
          </div>
          <button
            type="button"
            onClick={() => setAlerts(alerts.map((alert) => ({ ...alert, read: true })))}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        </div>

        {usingFallback && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Alerts table is unavailable, so sample alerts are shown.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {['all', 'unread', 'high', 'medium', 'low'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`rounded-full px-4 py-2 text-sm font-medium capitalize ${
                filter === tab
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-emerald-100 text-emerald-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {visibleAlerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-white/90 border border-emerald-100 rounded-xl shadow-sm overflow-hidden"
            >
              <div className="flex">
                <div className={`w-1.5 ${severityStyles[alert.severity]?.split(' ')[0] || 'border-emerald-500'}`} />
                <div className="flex-1 p-5">
                  <div className="flex items-start gap-4">
                    <AlertTriangle
                      className={`w-5 h-5 mt-0.5 ${
                        alert.severity === 'high'
                          ? 'text-red-600'
                          : alert.severity === 'medium'
                            ? 'text-orange-600'
                            : 'text-emerald-600'
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={`text-base text-emerald-900 ${alert.read ? 'font-medium' : 'font-bold'}`}>
                          {alert.title}
                        </h3>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${severityStyles[alert.severity]}`}>
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-sm text-emerald-700 mt-1">{alert.message}</p>
                      <p className="text-xs text-emerald-500 mt-2">{relativeTime(alert.timestamp)}</p>
                    </div>
                    {!alert.read && (
                      <button
                        type="button"
                        onClick={() =>
                          setAlerts(alerts.map((item) => (item.id === alert.id ? { ...item, read: true } : item)))
                        }
                        className="rounded-full border border-emerald-100 p-1.5 text-emerald-600 hover:bg-emerald-50"
                        aria-label="Mark as read"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SharedLayout>
  );
}
