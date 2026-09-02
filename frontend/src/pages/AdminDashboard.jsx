import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Users, Activity, AlertTriangle,
  LogOut, BarChart3, Settings, Shield,
  LayoutDashboard, UserCog, Bell, Menu, X, Plus, Cpu
} from 'lucide-react';

const API = 'http://localhost:5000/api';

function getToken() {
  return localStorage.getItem('adminToken');
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [systemStats, setSystemStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState(null);

  // Create + Assign Device Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [createForm, setCreateForm] = useState({ device_id: '', device_secret: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/');
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || 'Failed to load dashboard');
      } else {
        setUsers(data.users || []);
        setSystemStats(data.stats || null);
      }
    } catch (err) {
      setError('Could not connect to backend. Make sure Node server is running.');
    }
    setLoading(false);
  };

  const openCreateModal = (user) => {
    setSelectedUser(user);
    setCreateForm({ device_id: '', device_secret: '' });
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleCreateDevice = async (e) => {
    e.preventDefault();
    if (!createForm.device_id.trim() || !createForm.device_secret.trim()) {
      setCreateError('Both Device ID and Device Secret are required.');
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
      const res = await fetch(`${API}/admin/create-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          device_id: createForm.device_id.trim(),
          device_secret: createForm.device_secret.trim(),
          user_id: selectedUser.id
        })
      });
      const data = await res.json();
      if (!data.success) {
        setCreateError(data.message || 'Failed to create device');
      } else {
        setShowCreateModal(false);
        fetchDashboard();
      }
    } catch (err) {
      setCreateError('Network error. Try again.');
    }
    setCreateLoading(false);
  };

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: UserCog },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white/80 backdrop-blur-lg border-r border-emerald-100 shadow-lg min-h-screen flex flex-col transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 sm:p-6 border-b border-emerald-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/50">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-emerald-900">WattLab</h1>
                <p className="text-xs text-emerald-600">Admin Panel</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-emerald-700 hover:text-emerald-900">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${activeTab === item.id ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30' : 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-600'}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-emerald-100">
          <div className="bg-emerald-50 rounded-lg p-3 mb-3">
            <p className="text-emerald-900 text-sm font-semibold">Administrator</p>
            <p className="text-emerald-600 text-xs">admin@wattlab.com</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-600 text-white hover:from-red-600 hover:to-orange-700 transition-all shadow-lg rounded-lg"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col w-full">
        {/* Top Header */}
        <header className="bg-white/80 backdrop-blur-lg border-b border-emerald-100 shadow-sm sticky top-0 z-30">
          <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-emerald-700 hover:text-emerald-900">
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-emerald-900">WattLab Admin</h1>
                <p className="text-xs sm:text-sm text-emerald-600 hidden sm:block">Monitor and manage your energy monitoring system</p>
              </div>
            </div>
            <div className="hidden md:block bg-emerald-50 px-4 py-2 rounded-lg">
              <p className="text-emerald-900 text-sm font-semibold">Administrator</p>
              <p className="text-emerald-600 text-xs">admin@wattlab.com</p>
            </div>
          </div>
        </header>

        <div className="px-4 sm:px-6 py-4 sm:py-8 flex-1">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white/80 border border-emerald-100 rounded-xl p-4 sm:p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-700 text-xs sm:text-sm font-medium">Total Users</p>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-900 mt-1">{loading ? '…' : (systemStats?.total_users ?? 0)}</p>
                  <p className="text-xs text-emerald-600 mt-1">Registered accounts</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="bg-white/80 border border-emerald-100 rounded-xl p-4 sm:p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-700 text-xs sm:text-sm font-medium">Total Devices</p>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-900 mt-1">{loading ? '…' : (systemStats?.total_appliances ?? 0)}</p>
                  <p className="text-xs text-emerald-600 mt-1">Registered in system</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-lg flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-teal-600" />
                </div>
              </div>
            </div>

            <div className="bg-white/80 border border-emerald-100 rounded-xl p-4 sm:p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-700 text-xs sm:text-sm font-medium">Active Users</p>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-900 mt-1">{loading ? '…' : (systemStats?.active_users ?? 0)}</p>
                  <p className="text-xs text-emerald-600 mt-1">With devices assigned</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-100 to-emerald-100 rounded-lg flex items-center justify-center">
                  <Activity className="w-6 h-6 text-cyan-600" />
                </div>
              </div>
            </div>

            <div className="bg-white/80 border border-emerald-100 rounded-xl p-4 sm:p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-700 text-xs sm:text-sm font-medium">System Health</p>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-900 mt-1">{systemStats?.system_efficiency ?? 95}%</p>
                  <p className="text-xs text-emerald-600 mt-1">Operational efficiency</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
              <button onClick={fetchDashboard} className="ml-auto text-xs bg-red-100 text-red-700 px-3 py-1 rounded-lg hover:bg-red-200">Retry</button>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="bg-white/80 border border-emerald-100 rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 sm:p-6 border-b border-emerald-200">
                <h3 className="text-base sm:text-lg font-semibold text-emerald-900">User Management</h3>
                <p className="text-emerald-600 text-sm mt-1">
                  All registered users. Click <strong>Add &amp; Assign Device</strong> to create a new device and link it to the user.
                </p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
                </div>
              ) : users.length === 0 ? (
                <div className="py-16 text-center text-emerald-600">No users found in database.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-gradient-to-r from-emerald-100 to-teal-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-900 uppercase tracking-wider">User</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-900 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-900 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-900 uppercase tracking-wider">Assigned Devices</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-900 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-emerald-50 transition-colors">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Users className="w-4 h-4 text-emerald-600" />
                              </div>
                              <p className="text-emerald-900 font-semibold text-sm">{user.name || <span className="text-gray-400 italic">No name</span>}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-emerald-700 text-sm">{user.email}</td>
                          <td className="px-4 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${user.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                              {user.status}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            {user.devices && user.devices.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {user.devices.map(d => (
                                  <span key={d} className="bg-teal-100 text-teal-800 text-xs font-mono font-medium px-2 py-0.5 rounded-md">{d}</span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs italic">No device assigned</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => openCreateModal(user)}
                              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add &amp; Assign Device
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="bg-white/80 border border-emerald-100 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-emerald-900 mb-2">Overview</h3>
              <p className="text-emerald-600 text-sm">Go to <strong>Users</strong> tab to manage users and assign devices.</p>
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="bg-white/80 border border-emerald-100 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-emerald-900 mb-4">System Alerts</h3>
              <p className="text-emerald-500 text-sm text-center py-8">No active alerts.</p>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white/80 border border-emerald-100 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-emerald-900 mb-4">System Settings</h3>
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-emerald-700 text-sm font-medium">Electricity Tariff</p>
                  <p className="text-emerald-600 text-xs mt-1">Default: ₹8.50/kWh (users can override in their Settings page)</p>
                </div>
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
                  <p className="text-teal-700 text-sm font-medium">Data Retention</p>
                  <p className="text-teal-600 text-xs mt-1">Energy readings are retained indefinitely in Supabase.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create & Assign Device Modal */}
      {showCreateModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-emerald-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-emerald-900">Add &amp; Assign Device</h3>
                  <p className="text-xs text-emerald-600 mt-1">
                    Assigning to: <span className="font-semibold text-emerald-800">{selectedUser.name || selectedUser.email}</span>
                    <span className="ml-1 text-gray-400">({selectedUser.email})</span>
                  </p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-emerald-700 hover:text-emerald-900">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateDevice} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-emerald-700 mb-1">Device ID *</label>
                <input
                  type="text"
                  value={createForm.device_id}
                  onChange={e => setCreateForm(p => ({ ...p, device_id: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-emerald-900 font-mono text-sm"
                  placeholder="e.g. ESP32-HOME-001"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">This is what the ESP32 will send in its POST requests.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-emerald-700 mb-1">Device Secret *</label>
                <input
                  type="text"
                  value={createForm.device_secret}
                  onChange={e => setCreateForm(p => ({ ...p, device_secret: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-emerald-900 font-mono text-sm"
                  placeholder="e.g. mySecretKey123"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Flash this secret onto the ESP32 firmware. It's stored hashed.</p>
              </div>

              {createError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 border-2 border-emerald-200 text-emerald-700 rounded-lg font-medium hover:bg-emerald-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-4 py-3 rounded-lg font-medium transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-60"
                >
                  {createLoading ? 'Assigning…' : 'Create & Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
