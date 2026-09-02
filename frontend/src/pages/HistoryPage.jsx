import { useEffect, useMemo, useState } from 'react';
import { Download, History } from 'lucide-react';
import SharedLayout from '../components/SharedLayout';
import { supabase } from '../supabaseClient';
import { useDeviceId } from '../hooks/useDeviceId';

function exportCSV(rows) {
  const header = 'Timestamp,Power(W),Type,Label\n';
  const body = rows
    .map((row) => `${row.timestamp},${row.power},${row.stream_type},${row.appliance_label || ''}`)
    .join('\n');
  const blob = new Blob([header + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wattlab_readings.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function powerClass(power) {
  const watts = Number(power);
  if (watts > 500) return 'text-red-600';
  if (watts >= 200) return 'text-orange-600';
  return 'text-emerald-600';
}

export default function HistoryPage() {
  const { deviceId } = useDeviceId();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const { data, error } = await supabase
          .from('energy_readings')
          .select('timestamp, power, stream_type, appliance_label')
          .eq('device_id', deviceId)
          .order('timestamp', { ascending: false })
          .limit(200);

        if (error) throw error;
        setRows(data || []);
      } catch (err) {
        setRows([]);
        setErrorMsg(err.message || 'Unable to load readings');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [deviceId]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const time = new Date(row.timestamp).getTime();
      if (from && time < new Date(`${from}T00:00:00`).getTime()) return false;
      if (to && time > new Date(`${to}T23:59:59`).getTime()) return false;
      return true;
    });
  }, [from, rows, to]);

  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = filtered.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <SharedLayout activePage="history">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <History className="w-6 h-6 text-emerald-600" />
              <h2 className="text-2xl font-bold text-emerald-900">Reading History</h2>
            </div>
            <p className="text-sm text-emerald-600 mt-1">Recent aggregate power readings</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-emerald-600">
              From
              <input
                type="date"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(0);
                }}
                className="block mt-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-900"
              />
            </label>
            <label className="text-xs font-medium text-emerald-600">
              To
              <input
                type="date"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(0);
                }}
                className="block mt-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-900"
              />
            </label>
            <button
              type="button"
              onClick={() => exportCSV(filtered)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {errorMsg && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </p>
        )}

        {!loading && rows.length === 0 && !errorMsg && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            No energy readings found for this device yet. Start your ESP32 sensor or simulator script (09_simulate_esp32.py) to populate live data.
          </p>
        )}

        <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-emerald-100 text-emerald-600">
                <th className="py-3 pr-4 font-semibold">Timestamp</th>
                <th className="py-3 pr-4 font-semibold">Power (W)</th>
                <th className="py-3 pr-4 font-semibold">Type</th>
                <th className="py-3 pr-4 font-semibold">Label</th>
                <th className="py-3 pr-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => {
                const high = Number(row.power) >= 500;
                return (
                  <tr key={`${row.timestamp}-${index}`} className="border-b border-emerald-50">
                    <td className="py-3 pr-4 text-emerald-900">
                      {new Date(row.timestamp).toLocaleString(undefined, {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className={`py-3 pr-4 font-semibold tabular-nums ${powerClass(row.power)}`}>
                      {Number(row.power).toFixed(1)}
                    </td>
                    <td className="py-3 pr-4 text-emerald-700">{row.stream_type || 'aggregate'}</td>
                    <td className="py-3 pr-4 text-emerald-700">{row.appliance_label || '-'}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          high
                            ? 'bg-red-50 text-red-700 border border-red-100'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}
                      >
                        {high ? 'High' : 'Normal'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-emerald-600">
            Page {page + 1} of {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
            className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </SharedLayout>
  );
}
