import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Users, Activity, AlertTriangle, TrendingUp,
  LogOut, BarChart3, Settings, Shield, DollarSign,
  LayoutDashboard, UserCog, Bell, Menu, X, UserPlus
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [systemStats, setSystemStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    status: 'active'
  });

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    navigate('/');
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Demo mode - use mock data
    const mockUsers = [
      { id: 1, name: 'John Doe', email: 'john@example.com', total_consumption: 245.5, appliances_count: 5, status: 'active' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', total_consumption: 198.3, appliances_count: 4, status: 'active' },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com', total_consumption: 312.7, appliances_count: 6, status: 'active' },
      { id: 4, name: 'Alice Brown', email: 'alice@example.com', total_consumption: 156.2, appliances_count: 3, status: 'inactive' },
    ];

    const mockStats = {
      total_users: 4,
      active_users: 3,
      total_appliances: 18,
      total_consumption: 912.7,
      total_alerts: 12,
      system_efficiency: 87.5,
    };

    const mockAlerts = [
      { id: 1, user_name: 'Bob Johnson', message: 'Excessive consumption detected', type: 'critical', created_at: new Date() },
      { id: 2, user_name: 'John Doe', message: 'Appliance malfunction suspected', type: 'warning', created_at: new Date() },
    ];

    setUsers(mockUsers);
    setSystemStats(mockStats);
    setAlerts(mockAlerts);
    setLoading(false);
  };

  const deleteUser = (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    // Demo mode - just remove from state
    setUsers(users.filter(u => u.id !== userId));
  };

  const handleAddUser = (e) => {
    e.preventDefault();
    
    // Validation
    if (!newUser.name || !newUser.email || !newUser.password) {
      alert('Please fill in all fields');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUser.email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Demo mode - add to state with mock data
    const newUserData = {
      id: users.length + 1,
      name: newUser.name,
      email: newUser.email,
      total_consumption: 0,
      appliances_count: 0,
      status: newUser.status
    };

    setUsers([...users, newUserData]);
    
    // Update system stats
    setSystemStats({
      ...systemStats,
      total_users: (systemStats?.total_users || 0) + 1,
      active_users: newUser.status === 'active' ? (systemStats?.active_users || 0) + 1 : systemStats?.active_users
    });

    // Reset form and close modal
    setNewUser({ name: '', email: '', password: '', status: 'active' });
    setShowAddUserModal(false);
    
    alert('User added successfully!');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewUser(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: UserCog },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white/80 backdrop-blur-lg border-r border-emerald-100 shadow-lg min-h-screen flex flex-col transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Logo Section */}
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
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-emerald-700 hover:text-emerald-900"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === item.id
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                      : 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* User Info & Logout */}
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
        {/* Top Header Bar */}
        <header className="bg-white/80 backdrop-blur-lg border-b border-emerald-100 shadow-sm sticky top-0 z-30">
          <div className="px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden text-emerald-700 hover:text-emerald-900"
                >
                  <Menu className="w-6 h-6" />
                </button>
                <div>
                  <h1 className="text-lg sm:text-2xl font-bold text-emerald-900">WattLab Admin</h1>
                  <p className="text-xs sm:text-sm text-emerald-600 mt-1 hidden sm:block">Monitor and manage your energy monitoring system</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="bg-emerald-50 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg hidden md:block">
                  <p className="text-emerald-900 text-xs sm:text-sm font-semibold">Administrator</p>
                  <p className="text-emerald-600 text-xs">admin@wattlab.com</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="lg:hidden flex items-center space-x-1 px-3 py-1.5 bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-lg text-sm"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="px-4 sm:px-6 py-4 sm:py-8 flex-1">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-700 text-xs sm:text-sm font-medium">Total Users</p>
                <p className="text-2xl sm:text-3xl font-bold text-emerald-900 mt-1">{systemStats?.total_users || 0}</p>
                <p className="text-xs text-emerald-600 mt-1">Active accounts</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-700 text-xs sm:text-sm font-medium">Total Appliances</p>
                <p className="text-2xl sm:text-3xl font-bold text-emerald-900 mt-1">{systemStats?.total_appliances || 0}</p>
                <p className="text-xs text-emerald-600 mt-1">Registered devices</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-700 text-xs sm:text-sm font-medium">System Consumption</p>
                <p className="text-2xl sm:text-3xl font-bold text-emerald-900 mt-1">
                  {systemStats?.total_consumption?.toFixed(2) || '912.70'}
                </p>
                <p className="text-xs text-emerald-600 mt-1">kWh (Last 30 days)</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-100 to-emerald-100 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-700 text-xs sm:text-sm font-medium">Active Alerts</p>
                <p className="text-2xl sm:text-3xl font-bold text-emerald-900 mt-1">{systemStats?.total_alerts || 2}</p>
                <p className="text-xs text-orange-600 mt-1">Requires attention</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Consumption Trend */}
            <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-base sm:text-lg font-semibold text-emerald-900 mb-4">System Consumption Trend (Last 7 Days)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={[
                  { date: '2026-02-06', total_consumption: 125 },
                  { date: '2026-02-07', total_consumption: 138 },
                  { date: '2026-02-08', total_consumption: 142 },
                  { date: '2026-02-09', total_consumption: 135 },
                  { date: '2026-02-10', total_consumption: 148 },
                  { date: '2026-02-11', total_consumption: 152 },
                  { date: '2026-02-12', total_consumption: 145 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#059669"
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="#059669" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #d1fae5', borderRadius: '8px' }}
                    labelStyle={{ color: '#064e3b' }}
                    labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="total_consumption" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    name="Total Consumption (kWh)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Top Consuming Users */}
            <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-base sm:text-lg font-semibold text-emerald-900 mb-4">Top Consuming Users (Last 30 Days)</h3>
              <div className="space-y-3">
                {users.slice(0, 3).sort((a, b) => b.total_consumption - a.total_consumption).map((topUser, index) => (
                  <div key={topUser.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg hover:shadow-md transition-shadow space-y-3 sm:space-y-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-md flex-shrink-0">
                        <span className="text-white font-bold text-xs sm:text-sm">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="text-emerald-900 font-semibold text-sm sm:text-base">{topUser.name}</p>
                        <p className="text-emerald-600 text-xs sm:text-sm">{topUser.email}</p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right pl-11 sm:pl-0">
                      <p className="text-emerald-900 font-bold text-sm sm:text-base">{parseFloat(topUser.total_consumption || 0).toFixed(2)} kWh</p>
                      <p className="text-emerald-600 text-xs sm:text-sm">Total Consumption</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 sm:p-6 border-b border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-emerald-900">User Management</h3>
                <p className="text-emerald-700 text-xs sm:text-sm mt-1">Manage and monitor all registered users</p>
              </div>
              <button
                onClick={() => setShowAddUserModal(true)}
                className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/30 text-sm"
              >
                <UserPlus className="w-5 h-5" />
                <span>Add User</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gradient-to-r from-emerald-100 to-teal-100">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                      Consumption
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                      Appliances
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  {users.map((userData) => (
                    <tr key={userData.id} className="hover:bg-emerald-50 transition-colors">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div className="ml-3">
                            <p className="text-emerald-900 font-semibold text-sm">{userData.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <p className="text-emerald-700 text-sm">{userData.email}</p>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          userData.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {userData.status}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <p className="text-emerald-900 font-semibold text-sm">{userData.total_consumption.toFixed(2)} kWh</p>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <p className="text-emerald-700 text-sm">{userData.appliances_count} devices</p>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <button
                          onClick={() => deleteUser(userData.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-base sm:text-lg font-semibold text-emerald-900 mb-4">System Analytics</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg">
                  <p className="text-emerald-700 text-sm font-medium">Average Consumption/User</p>
                  <p className="text-2xl font-bold text-emerald-900 mt-2">
                    {(systemStats?.total_consumption / systemStats?.total_users || 228.18).toFixed(2)} kWh
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-lg">
                  <p className="text-teal-700 text-sm font-medium">Appliances/User Ratio</p>
                  <p className="text-2xl font-bold text-teal-900 mt-2">
                    {(systemStats?.total_appliances / systemStats?.total_users || 4.5).toFixed(1)}
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-br from-cyan-50 to-emerald-50 border border-cyan-200 rounded-lg">
                  <p className="text-cyan-700 text-sm font-medium">Alert Rate</p>
                  <p className="text-2xl font-bold text-cyan-900 mt-2">
                    {systemStats?.total_alerts || 2} active
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-base sm:text-lg font-semibold text-emerald-900 mb-4">Weekly Consumption Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  { date: '2026-02-06', total_consumption: 125 },
                  { date: '2026-02-07', total_consumption: 138 },
                  { date: '2026-02-08', total_consumption: 142 },
                  { date: '2026-02-09', total_consumption: 135 },
                  { date: '2026-02-10', total_consumption: 148 },
                  { date: '2026-02-11', total_consumption: 152 },
                  { date: '2026-02-12', total_consumption: 145 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#059669"
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                  />
                  <YAxis stroke="#059669" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #d1fae5', borderRadius: '8px' }}
                    labelStyle={{ color: '#064e3b' }}
                  />
                  <Legend />
                  <Bar dataKey="total_consumption" fill="#10b981" name="Consumption (kWh)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-base sm:text-lg font-semibold text-emerald-900 mb-4">System Alerts</h3>
              {alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="flex items-start space-x-2 sm:space-x-3 p-3 sm:p-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg">
                      <AlertTriangle className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-1 ${
                        alert.type === 'critical' ? 'text-red-600' : 'text-orange-600'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 space-y-2 sm:space-y-0">
                          <div className="min-w-0">
                            <h4 className="text-emerald-900 font-semibold text-sm sm:text-base">{alert.message}</h4>
                            <p className="text-emerald-700 text-xs sm:text-sm">User: {alert.user_name}</p>
                          </div>
                          <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold self-start ${
                            alert.type === 'critical' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {alert.type}
                          </span>
                        </div>
                        <p className="text-emerald-600 text-xs">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-emerald-700 text-center py-8">No alerts to display</p>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-base sm:text-lg font-semibold text-emerald-900 mb-4 sm:mb-6">System Settings</h3>
              <div className="space-y-4 sm:space-y-6">
                <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg">
                  <h4 className="text-emerald-900 font-semibold mb-2 text-sm sm:text-base">Alert Retention</h4>
                  <p className="text-emerald-700 text-xs sm:text-sm mb-3">Configure how long alerts are stored in the system</p>
                  <input
                    type="number"
                    defaultValue={30}
                    className="bg-white border-2 border-emerald-200 text-emerald-900 px-3 sm:px-4 py-2 rounded-lg w-24 sm:w-32 text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-emerald-700 ml-2 font-medium text-sm">days</span>
                </div>

                <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg">
                  <h4 className="text-emerald-900 font-semibold mb-2 text-sm sm:text-base">Data Retention</h4>
                  <p className="text-emerald-700 text-xs sm:text-sm mb-3">Configure how long energy consumption data is retained</p>
                  <input
                    type="number"
                    defaultValue={365}
                    className="bg-white border-2 border-teal-200 text-emerald-900 px-3 sm:px-4 py-2 rounded-lg w-24 sm:w-32 text-sm focus:outline-none focus:border-teal-500"
                  />
                  <span className="text-emerald-700 ml-2 font-medium text-sm">days</span>
                </div>

                <div className="p-4 sm:p-5 bg-gradient-to-r from-cyan-50 to-emerald-50 border border-cyan-200 rounded-lg">
                  <h4 className="text-emerald-900 font-semibold mb-2 text-sm sm:text-base">Energy Rate</h4>
                  <p className="text-emerald-700 text-xs sm:text-sm mb-3">Set the current energy rate per kWh</p>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={0.12}
                    className="bg-white border-2 border-cyan-200 text-emerald-900 px-3 sm:px-4 py-2 rounded-lg w-24 sm:w-32 text-sm focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-emerald-700 ml-2 font-medium text-sm">$/kWh</span>
                </div>

                <button className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg shadow-lg shadow-emerald-500/30 transition-all transform hover:scale-105 text-sm sm:text-base">
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </main>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-emerald-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg flex items-center justify-center">
                    <UserPlus className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold text-emerald-900">Add New User</h3>
                </div>
                <button
                  onClick={() => {
                    setShowAddUserModal(false);
                    setNewUser({ name: '', email: '', password: '', status: 'active' });
                  }}
                  className="text-emerald-700 hover:text-emerald-900 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleAddUser} className="p-6 space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-emerald-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={newUser.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-emerald-900"
                  placeholder="Enter user's full name"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-emerald-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={newUser.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-emerald-900"
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-emerald-700 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={newUser.password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-emerald-900"
                  placeholder="Enter password"
                  required
                  minLength={6}
                />
                <p className="text-xs text-emerald-600 mt-1">Minimum 6 characters</p>
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-emerald-700 mb-2">
                  Account Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={newUser.status}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-emerald-900 bg-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUserModal(false);
                    setNewUser({ name: '', email: '', password: '', status: 'active' });
                  }}
                  className="flex-1 px-4 py-3 border-2 border-emerald-200 text-emerald-700 rounded-lg font-medium hover:bg-emerald-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-4 py-3 rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/30"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
