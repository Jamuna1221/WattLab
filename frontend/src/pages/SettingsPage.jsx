import { useEffect, useState } from 'react';
import { Bell, Cpu, Save, User, Wallet } from 'lucide-react';
import SharedLayout from '../components/SharedLayout';
import api from '../utils/api';
import { supabase } from '../supabaseClient';
import { getStoredUser, getUserEmail, getUserName, getUserProfile } from '../utils/session';

const defaultPrefs = {
  highConsumption: true,
  applianceDetection: true,
  dailySummary: false,
  weeklyReport: false,
};

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-emerald-100 bg-white px-4 py-3">
      <span className="text-sm font-medium text-emerald-900">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-emerald-600"
      />
    </label>
  );
}

export default function SettingsPage() {
  const storedUser = getStoredUser();
  const [name, setName] = useState(() => localStorage.getItem('wattlab_user_name') || getUserName(storedUser));
  const [email, setEmail] = useState(() => getUserEmail(storedUser));
  const [deviceId, setDeviceId] = useState(
    () => localStorage.getItem('wattlab_device_id') || import.meta.env.VITE_DEFAULT_DEVICE_ID || ''
  );
  const [deviceOnline, setDeviceOnline] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState('Not linked');
  const [tariff, setTariff] = useState(localStorage.getItem('wattlab_tariff') || '8.50');
  const [stateName, setStateName] = useState(localStorage.getItem('wattlab_state') || 'Tamil Nadu');
  const [budgetGoal, setBudgetGoal] = useState(localStorage.getItem('wattlab_budget_goal') || '1500');
  const [prefs, setPrefs] = useState(() => {
    try {
      return { ...defaultPrefs, ...JSON.parse(localStorage.getItem('wattlab_notification_prefs') || '{}') };
    } catch {
      return defaultPrefs;
    }
  });

  useEffect(() => {
    async function loadAccountAndDevice() {
      const stored = getStoredUser();
      const storedProfile = getUserProfile(stored);
      if (stored) {
        setEmail(getUserEmail(stored));
        setName((current) => current || getUserName(stored));
      }

      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        if (!storedProfile?.email) {
          setEmail(data.user.email);
        }
        if (data.user.user_metadata?.name) {
          setName(data.user.user_metadata.name);
          localStorage.setItem('wattlab_user_name', data.user.user_metadata.name);
        }
      }

      let resolvedDeviceId = deviceId;
      try {
        const { data: devicesData } = await api.get('/devices');
        const devices = Array.isArray(devicesData?.devices) ? devicesData.devices : [];
        if (devices.length > 0) {
          const activeDevice =
            devices.find((device) => ['ONLINE', 'ASSIGNED'].includes(device.status)) || devices[0];
          resolvedDeviceId = activeDevice.device_id || '';
          setDeviceId(resolvedDeviceId);
          setDeviceStatus(activeDevice.status || 'Linked');
          if (resolvedDeviceId) localStorage.setItem('wattlab_device_id', resolvedDeviceId);
        } else {
          setDeviceStatus('No device linked');
        }
      } catch {
        setDeviceStatus(resolvedDeviceId ? 'Saved locally' : 'No device linked');
      }
    }
    loadAccountAndDevice();
  }, []);

  useEffect(() => {
    async function checkDeviceStatus() {
      try {
        if (!deviceId) throw new Error('No device selected');
        await api.get(`/readings/live/${encodeURIComponent(deviceId)}`);
        setDeviceOnline(true);
      } catch {
        setDeviceOnline(false);
      }
    }
    checkDeviceStatus();
  }, [deviceId]);

  function saveProfile() {
    localStorage.setItem('wattlab_user_name', name);
  }

  function saveDevice() {
    localStorage.setItem('wattlab_device_id', deviceId);
  }

  function saveTariff() {
    localStorage.setItem('wattlab_tariff', tariff);
    localStorage.setItem('wattlab_state', stateName);
  }

  function saveBudget() {
    localStorage.setItem('wattlab_budget_goal', budgetGoal);
  }

  function savePrefs() {
    localStorage.setItem('wattlab_notification_prefs', JSON.stringify(prefs));
  }

  return (
    <SharedLayout activePage="settings">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-emerald-900">Settings</h2>
          <p className="text-sm text-emerald-600">Profile, device, tariff, and notification preferences</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <User className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-emerald-900">Profile</h3>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-emerald-700">
                Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 text-emerald-900"
                />
              </label>
              <label className="block text-sm font-medium text-emerald-700">
                Email
                <input
                  value={email}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-800"
                />
              </label>
              <button onClick={saveProfile} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
                <Save className="w-4 h-4" />
                Save profile
              </button>
            </div>
          </section>

          <section className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Cpu className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-emerald-900">Device</h3>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-emerald-700">
                Device ID
                <input
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 text-emerald-900"
                  placeholder="No linked device"
                />
              </label>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  deviceOnline
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-100'
                }`}
              >
                {deviceOnline ? 'Connected' : deviceStatus}
              </span>
              <div>
                <button onClick={saveDevice} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
                  <Save className="w-4 h-4" />
                  Save device
                </button>
              </div>
            </div>
          </section>

          <section className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Wallet className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-emerald-900">Tariff</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-sm font-medium text-emerald-700">
                Current tariff (Rs/kWh)
                <input
                  type="number"
                  step="0.01"
                  value={tariff}
                  onChange={(event) => setTariff(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 text-emerald-900"
                />
              </label>
              <label className="block text-sm font-medium text-emerald-700">
                State
                <select
                  value={stateName}
                  onChange={(event) => setStateName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 text-emerald-900"
                >
                  {['Tamil Nadu', 'Karnataka', 'Maharashtra', 'Delhi', 'Other'].map((state) => (
                    <option key={state}>{state}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-emerald-600 mt-3">This affects all bill estimates shown in the app.</p>
            <button onClick={saveTariff} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
              <Save className="w-4 h-4" />
              Save tariff
            </button>
          </section>

          <section className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Wallet className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-emerald-900">Budget Goal</h3>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-emerald-700">
                Monthly bill target (Rs)
                <input
                  type="number"
                  step="50"
                  value={budgetGoal}
                  onChange={(event) => setBudgetGoal(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 text-emerald-900"
                />
              </label>
              <p className="text-xs text-emerald-600">Set a monthly spending target. The Bill Forecast and Dashboard will show your progress against this goal.</p>
              <button onClick={saveBudget} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
                <Save className="w-4 h-4" />
                Save budget goal
              </button>
            </div>
          </section>

          <section className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Bell className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-emerald-900">Notifications</h3>
            </div>
            <div className="space-y-3">
              <Toggle checked={prefs.highConsumption} onChange={(value) => setPrefs({ ...prefs, highConsumption: value })} label="High consumption alerts" />
              <Toggle checked={prefs.applianceDetection} onChange={(value) => setPrefs({ ...prefs, applianceDetection: value })} label="Appliance detection notifications" />
              <Toggle checked={prefs.dailySummary} onChange={(value) => setPrefs({ ...prefs, dailySummary: value })} label="Daily summary email" />
              <Toggle checked={prefs.weeklyReport} onChange={(value) => setPrefs({ ...prefs, weeklyReport: value })} label="Weekly report" />
            </div>
            <button onClick={savePrefs} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
              <Save className="w-4 h-4" />
              Save preferences
            </button>
          </section>
        </div>
      </div>
    </SharedLayout>
  );
}
