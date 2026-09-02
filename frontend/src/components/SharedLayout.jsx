import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Gauge,
  History,
  Home,
  IndianRupee,
  LogOut,
  Settings,
  Zap,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { clearSessionData, getStoredUser, getUserEmail, getUserId, getUserName } from '../utils/session';

const sections = [
  {
    title: 'Monitor',
    items: [
      { id: 'overview', label: 'Overview', to: '/dashboard', icon: Home },
      { id: 'live', label: 'Live Readings', to: '/dashboard/live', icon: Activity },
      { id: 'appliances', label: 'Appliances', to: '/dashboard/appliances', icon: Zap },
      { id: 'history', label: 'History', to: '/dashboard/history', icon: History },
    ],
  },
  {
    title: 'Insights',
    items: [
      { id: 'analytics', label: 'Analytics', to: '/dashboard/analytics', icon: BarChart3 },
      { id: 'bill', label: 'Bill Forecast', to: '/dashboard/bill', icon: IndianRupee },
      { id: 'alerts', label: 'Alerts', to: '/dashboard/alerts', icon: AlertTriangle },
      { id: 'settings', label: 'Settings', to: '/dashboard/settings', icon: Settings },
    ],
  },
  {
    title: 'Phase 1 - Live data',
    items: [
      { id: 'predictions', label: 'ML & bill', to: '/dashboard/predictions', icon: Gauge },
    ],
  },
];

function Sidebar({ activePage }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (data?.user) setUser((current) => ({ ...data.user, profile: current?.profile }));
    }
    loadUser();
  }, []);

  const displayName = getUserName(user) || 'User';
  const displayEmail = getUserEmail(user) || 'No email found';
  const userId = getUserId(user);
  const displayId = userId ? userId.slice(0, 8) : '-';

  return (
    <aside className="w-64 bg-white/80 backdrop-blur-lg border-r border-emerald-100 shadow-lg min-h-screen flex flex-col">
      <div className="p-6 border-b border-emerald-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/50">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-emerald-900">WattLab</h1>
            <p className="text-xs text-emerald-600">Energy Monitor</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-5">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <p className="px-4 text-xs font-semibold text-emerald-500 uppercase tracking-wide mb-2">
              {section.title}
            </p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.id;
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                    active
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                      : 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-emerald-100">
        <div className="bg-emerald-50 rounded-lg p-3 mb-3">
          <p className="text-emerald-900 text-sm font-semibold">{displayName}</p>
          <p className="text-emerald-600 text-xs">{displayEmail}</p>
          <p className="text-emerald-500 text-[10px] font-mono mt-0.5">ID: {displayId}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            clearSessionData();
            supabase.auth.signOut();
            navigate('/');
          }}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-600 text-white hover:from-red-600 hover:to-orange-700 transition-all shadow-lg rounded-lg"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default function SharedLayout({ children, activePage }) {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50">
      <Sidebar activePage={activePage} />
      <main className="flex-1 overflow-auto">
        <header className="bg-white/80 backdrop-blur-lg border-b border-emerald-100 shadow-sm">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-emerald-900">WattLab</h1>
              <p className="text-sm text-emerald-600 mt-1">Smart energy monitoring workspace</p>
            </div>
            <Bell className="w-6 h-6 text-emerald-600" />
          </div>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
