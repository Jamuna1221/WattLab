import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCheck, X } from 'lucide-react';
import SharedLayout from '../components/SharedLayout';
import { supabase } from '../supabaseClient';

function relativeTime(timestamp) {
  if (!timestamp) return 'recently';
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
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function load() {
      setLoading(false);
      try {
        const { data, error } = await supabase
          .from('alerts')
          .select('id, severity, title, message, timestamp, read')
          .order('timestamp', { ascending: false })
          .limit(50);
        if (error) throw error;
        setAlerts(data || []);
      } catch {
        setAlerts([]);
      } finally {
        setLoading(false);
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

  async function markAllRead() {
    const ids = alerts.filter((a) => !a.read).map((a) => a.id);
    if (ids.length === 0) return;
    await supabase.from('alerts').update({ read: true }).in('id', ids);
    setAlerts(alerts.map((alert) => ({ ...alert, read: true })));
  }

  async function markRead(id) {
    await supabase.from('alerts').update({ read: true }).eq('id', id);
    setAlerts(alerts.map((item) => (item.id === id ? { ...item, read: true } : item)));
  }

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
            onClick={markAllRead}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        </div>

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

        {visibleAlerts.length === 0 && !loading && (
          <div className="rounded-xl border border-emerald-100 bg-white p-8 text-center text-emerald-700 shadow-sm">
            No alerts found. Everything is operating normally.
          </div>
        )}

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
                        onClick={() => markRead(alert.id)}
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
