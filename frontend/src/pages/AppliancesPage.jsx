import { useCallback, useEffect, useState } from 'react';
import {
  Coffee,
  Lightbulb,
  Microwave,
  Thermometer,
  Utensils,
  WashingMachine,
  Wind,
} from 'lucide-react';
import SharedLayout from '../components/SharedLayout';
import api from '../utils/api';

const MODEL_ACCURACY = {
  bulb: '77.0%',
  fridge: '78.7%',
  kettle: '-',
  microwave: '-',
  washing_machine: '-',
  dishwasher: '-',
};

const APPLIANCES = [
  { key: 'bulb', name: 'Bulb', icon: Lightbulb },
  { key: 'fridge', name: 'Fridge', icon: Thermometer },
  { key: 'kettle', name: 'Kettle', icon: Coffee },
  { key: 'microwave', name: 'Microwave', icon: Microwave || Wind },
  { key: 'washing_machine', name: 'Washing Machine', icon: WashingMachine || Wind },
  { key: 'dishwasher', name: 'Dishwasher', icon: Utensils },
];

export default function AppliancesPage() {
  const [health, setHealth] = useState(null);
  const [trayState, setTrayState] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const load = useCallback(async () => {
    setErrorMsg(null);
    try {
      const [healthRes, trayRes] = await Promise.all([
        api.get('/predictions/health').catch(() => api.get('/health')),
        api.get('/tray/state'),
      ]);
      setHealth(healthRes.data || null);
      setTrayState(trayRes.data || null);
    } catch (err) {
      setErrorMsg(err.message || 'Error loading appliance data');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loaded = new Set(health?.activity_models_loaded || []);
  const totals = trayState?.total_confirmed_kwh || {};

  return (
    <SharedLayout activePage="appliances">
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-emerald-900">Appliances</h2>
            <p className="text-sm text-emerald-600">
              Track each appliance&apos;s energy usage and status
            </p>
          </div>
          {errorMsg && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              {errorMsg}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {APPLIANCES.map((appliance) => {
            const Icon = appliance.icon || Wind;
            const trained = loaded.has(appliance.key);
            const kwh = Number(totals[appliance.key] || 0);
            const cost = kwh * Number(localStorage.getItem('wattlab_tariff') || 8.5);

            return (
              <div
                key={appliance.key}
                className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-emerald-900">{appliance.name}</h3>
                      <p className="text-sm text-emerald-600">Live disaggregation model</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      trained
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-50 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {trained ? 'Trained OK' : 'Training pending'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-6">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                    <p className="text-xs text-emerald-600">Accuracy</p>
                    <p className="text-lg font-bold text-emerald-900">{MODEL_ACCURACY[appliance.key]}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                    <p className="text-xs text-emerald-600">Session kWh</p>
                    <p className="text-lg font-bold text-emerald-900">{kwh.toFixed(3)}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                    <p className="text-xs text-emerald-600">Est. cost</p>
                    <p className="text-lg font-bold text-emerald-900">Rs {cost.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SharedLayout>
  );
}
