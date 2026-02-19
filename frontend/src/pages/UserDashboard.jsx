import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, Activity, TrendingUp, Bell, Plus, 
  LogOut, Settings, ChevronDown, AlertTriangle,
  Lightbulb, DollarSign, BarChart3, LayoutDashboard, Home
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function UserDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [appliances, setAppliances] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [energyData, setEnergyData] = useState([]);
  const [stats, setStats] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [billPrediction, setBillPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddAppliance, setShowAddAppliance] = useState(false);
  const [newAppliance, setNewAppliance] = useState({
    name: '',
    type: '',
    ratedPower: '',
    location: ''
  });

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    navigate('/');
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Demo mode - use mock data
    const mockAppliances = [
      { id: 1, name: 'Air Conditioner', type: 'HVAC', ratedPower: 1500, location: 'Living Room', status: 'on' },
      { id: 2, name: 'Refrigerator', type: 'Kitchen', ratedPower: 800, location: 'Kitchen', status: 'on' },
      { id: 3, name: 'Washing Machine', type: 'Laundry', ratedPower: 1200, location: 'Utility Room', status: 'off' },
      { id: 4, name: 'Water Heater', type: 'Bathroom', ratedPower: 2000, location: 'Bathroom', status: 'on' },
    ];

    const mockEnergyData = [
      { name: 'Air Conditioner', total_consumption: 45.5, percentage: 35 },
      { name: 'Refrigerator', total_consumption: 28.3, percentage: 22 },
      { name: 'Water Heater', total_consumption: 32.1, percentage: 25 },
      { name: 'Washing Machine', total_consumption: 23.6, percentage: 18 },
    ];

    const mockAlerts = [
      { id: 1, message: 'High consumption detected on Air Conditioner', type: 'warning', created_at: new Date() },
      { id: 2, message: 'Your monthly usage is 15% higher than usual', type: 'info', created_at: new Date() },
    ];

    const mockRecommendations = [
      { category: 'HVAC', recommendation: 'Set AC to 24°C for optimal efficiency', potential_savings: '15%' },
      { category: 'Lighting', recommendation: 'Replace old bulbs with LED', potential_savings: '30%' },
      { category: 'Kitchen', recommendation: 'Run dishwasher only when full', potential_savings: '10%' },
    ];

    setAppliances(mockAppliances);
    setAlerts(mockAlerts);
    setEnergyData(mockEnergyData);
    setRecommendations(mockRecommendations);

    const totalConsumption = mockEnergyData.reduce((sum, item) => sum + parseFloat(item.total_consumption || 0), 0);
    setStats({
      totalConsumption: totalConsumption.toFixed(2),
      totalAppliances: mockAppliances.length,
      activeAlerts: mockAlerts.length
    });

    setBillPrediction({ predicted_bill: 2847.50, confidence: 0.92 });
    setLoading(false);
  };

  const addAppliance = async (e) => {
    e.preventDefault();
    // Demo mode - just add to state
    const newId = appliances.length + 1;
    setAppliances([...appliances, {
      id: newId,
      ...newAppliance,
      ratedPower: parseFloat(newAppliance.ratedPower),
      status: 'off'
    }]);
    setShowAddAppliance(false);
    setNewAppliance({ name: '', type: '', ratedPower: '', location: '' });
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
    { id: 'appliances', label: 'Appliances', icon: Zap },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'recommendations', label: 'Tips', icon: Lightbulb },
    { id: 'alerts', label: 'Alerts', icon: Bell },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white/80 backdrop-blur-lg border-r border-emerald-100 shadow-lg min-h-screen flex flex-col">
        {/* Logo Section */}
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

        {/* Navigation Menu */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === item.id
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                      : 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                  {item.id === 'alerts' && alerts.length > 0 && activeTab !== 'alerts' && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {alerts.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-emerald-100">
          <div className="bg-emerald-50 rounded-lg p-3 mb-3">
            <p className="text-emerald-900 text-sm font-semibold">User Account</p>
            <p className="text-emerald-600 text-xs">user@wattlab.com</p>
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
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Top Header Bar */}
        <header className="bg-white/80 backdrop-blur-lg border-b border-emerald-100 shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-emerald-900">Energy Dashboard</h1>
                <p className="text-sm text-emerald-600 mt-1">Monitor and manage your energy consumption</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Bell className="w-6 h-6 text-emerald-600 cursor-pointer hover:text-emerald-800 transition-colors" />
                  {alerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {alerts.length}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="px-6 py-8 flex-1">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-6 hover:bg-white hover:shadow-lg transition-all transform hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-600 text-sm">Total Consumption</p>
                <p className="text-3xl font-bold text-emerald-900 mt-1">{stats?.totalConsumption}</p>
                <p className="text-xs text-emerald-500 mt-1">kWh (Last 30 days)</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-6 hover:bg-white hover:shadow-lg transition-all transform hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-600 text-sm">Predicted Bill</p>
                <p className="text-3xl font-bold text-emerald-900 mt-1">${billPrediction?.predictedCost || '0.00'}</p>
                <p className="text-xs text-emerald-500 mt-1">↓ Save ${billPrediction?.savingsPotential || '0.00'}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-teal-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-6 hover:bg-white hover:shadow-lg transition-all transform hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-600 text-sm">Active Appliances</p>
                <p className="text-3xl font-bold text-emerald-900 mt-1">{stats?.totalAppliances}</p>
                <p className="text-xs text-emerald-500 mt-1">Registered devices</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-teal-100 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-6 hover:bg-white hover:shadow-lg transition-all transform hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-600 text-sm">Active Alerts</p>
                <p className="text-3xl font-bold text-emerald-900 mt-1">{stats?.activeAlerts}</p>
                <p className="text-xs text-orange-500 mt-1">Requires attention</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-teal-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Consumption Chart */}
            <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-6 hover:bg-white hover:shadow-lg transition-all">
              <h3 className="text-lg font-semibold text-emerald-900 mb-4">Consumption by Appliance</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={energyData}
                    dataKey="total_consumption"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${entry.name}: ${parseFloat(entry.total_consumption).toFixed(2)} kWh`}
                  >
                    {energyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Recent Alerts */}
            <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-6 hover:bg-white hover:shadow-lg transition-all">
              <h3 className="text-lg font-semibold text-emerald-900 mb-4">Recent Alerts</h3>
              {alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="flex items-start space-x-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                      <AlertTriangle className={`w-5 h-5 ${
                        alert.severity === 'high' ? 'text-red-600' :
                        alert.severity === 'medium' ? 'text-orange-600' :
                        'text-yellow-600'
                      }`} />
                      <div className="flex-1">
                        <p className="text-emerald-900 text-sm">{alert.message}</p>
                        <p className="text-emerald-600 text-xs mt-1">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-emerald-600 text-center py-4">No active alerts</p>
              )}
            </div>
          </div>
        )}

        {/* Appliances Tab */}
        {activeTab === 'appliances' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-emerald-900">My Appliances</h3>
              <button
                onClick={() => setShowAddAppliance(true)}
                className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-4 py-2 rounded-lg transition-all transform hover:scale-105 shadow-md"
              >
                <Plus className="w-5 h-5" />
                <span>Add Appliance</span>
              </button>
            </div>

            {showAddAppliance && (
              <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-6">
                <h4 className="text-emerald-900 font-medium mb-4">Add New Appliance</h4>
                <form onSubmit={addAppliance} className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Appliance Name"
                    required
                    className="bg-white border border-emerald-200 text-emerald-900 placeholder-emerald-500 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    value={newAppliance.name}
                    onChange={(e) => setNewAppliance({ ...newAppliance, name: e.target.value })}
                  />
                  <select
                    required
                    className="bg-white border border-emerald-200 text-emerald-900 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    value={newAppliance.type}
                    onChange={(e) => setNewAppliance({ ...newAppliance, type: e.target.value })}
                  >
                    <option value="">Select Type</option>
                    <option value="AC">Air Conditioner</option>
                    <option value="Refrigerator">Refrigerator</option>
                    <option value="Washing Machine">Washing Machine</option>
                    <option value="TV">Television</option>
                    <option value="Light">Lighting</option>
                    <option value="Other">Other</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Rated Power (Watts)"
                    required
                    className="bg-white border border-emerald-200 text-emerald-900 placeholder-emerald-500 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    value={newAppliance.ratedPower}
                    onChange={(e) => setNewAppliance({ ...newAppliance, ratedPower: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Location"
                    className="bg-white border border-emerald-200 text-emerald-900 placeholder-emerald-500 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    value={newAppliance.location}
                    onChange={(e) => setNewAppliance({ ...newAppliance, location: e.target.value })}
                  />
                  <div className="col-span-2 flex space-x-3">
                    <button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-4 py-2 rounded-lg transition-all transform hover:scale-105 shadow-md"
                    >
                      Add Appliance
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddAppliance(false)}
                      className="flex-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {appliances.map((appliance) => (
                <div key={appliance.id} className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-6 hover:bg-white hover:shadow-lg transition-all transform hover:scale-105">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg flex items-center justify-center">
                      <Zap className="w-6 h-6 text-emerald-600" />
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      appliance.is_active
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                      {appliance.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <h4 className="text-emerald-900 font-medium">{appliance.name}</h4>
                  <p className="text-emerald-600 text-sm mt-1">{appliance.type}</p>
                  <div className="mt-4 pt-4 border-t border-emerald-200">
                    <p className="text-emerald-600 text-xs">Rated Power</p>
                    <p className="text-emerald-900 font-medium">{appliance.rated_power} W</p>
                  </div>
                  {appliance.location && (
                    <p className="text-emerald-600 text-xs mt-2">📍 {appliance.location}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-6 hover:bg-white hover:shadow-lg transition-all">
              <h3 className="text-lg font-semibold text-emerald-900 mb-4">Consumption Analytics</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={energyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                  <XAxis dataKey="name" stroke="#059669" />
                  <YAxis stroke="#059669" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #d1fae5', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                    labelStyle={{ color: '#064e3b' }}
                  />
                  <Legend />
                  <Bar dataKey="total_consumption" fill="#10b981" name="Total Consumption (kWh)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-6 hover:bg-white hover:shadow-lg transition-all">
              <h3 className="text-lg font-semibold text-emerald-900 mb-4">Monthly Bill Prediction</h3>
              {billPrediction && (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-emerald-600 text-sm">Predicted Consumption</p>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">
                      {billPrediction.predictedConsumption} kWh
                    </p>
                  </div>
                  <div>
                    <p className="text-emerald-600 text-sm">Predicted Cost</p>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">
                      ${billPrediction.predictedCost}
                    </p>
                  </div>
                  <div>
                    <p className="text-emerald-600 text-sm">Rate per kWh</p>
                    <p className="text-xl font-medium text-emerald-900 mt-1">
                      ${billPrediction.ratePerKwh}
                    </p>
                  </div>
                  <div>
                    <p className="text-emerald-600 text-sm">Savings Potential</p>
                    <p className="text-xl font-medium text-emerald-500 mt-1">
                      ${billPrediction.savingsPotential}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-emerald-900">Energy Saving Recommendations</h3>
            {recommendations.length > 0 ? (
              recommendations.map((rec) => (
                <div key={rec.id} className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-6 hover:bg-white hover:shadow-lg transition-all">
                  <div className="flex items-start space-x-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      rec.priority === 'high' ? 'bg-red-100 border border-red-200' :
                      rec.priority === 'medium' ? 'bg-orange-100 border border-orange-200' :
                      'bg-yellow-100 border border-yellow-200'
                    }`}>
                      <Lightbulb className={`w-6 h-6 ${
                        rec.priority === 'high' ? 'text-red-600' :
                        rec.priority === 'medium' ? 'text-orange-600' :
                        'text-yellow-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-emerald-900 font-medium">{rec.title}</h4>
                        <span className={`px-2 py-1 rounded text-xs ${
                          rec.priority === 'high' ? 'bg-red-100 text-red-700 border border-red-200' :
                          rec.priority === 'medium' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                          'bg-yellow-100 text-yellow-700 border border-yellow-200'
                        }`}>
                          {rec.priority.toUpperCase()} PRIORITY
                        </span>
                      </div>
                      <p className="text-emerald-700 text-sm mb-2">{rec.description}</p>
                      <p className="text-emerald-600 text-sm mb-3">💡 {rec.suggestion}</p>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-emerald-500">
                          💰 Save ${rec.potentialSavings.amount}/month ({rec.potentialSavings.percentage}%)
                        </span>
                        <span className="text-emerald-600">
                          Difficulty: {rec.difficulty}
                        </span>
                        <span className="text-emerald-600">
                          Impact: {rec.impact}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-emerald-600 text-center py-8">No recommendations available</p>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-emerald-900">All Alerts</h3>
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <div key={alert.id} className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-6 hover:bg-white hover:shadow-lg transition-all">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className={`w-6 h-6 ${
                      alert.severity === 'high' ? 'text-red-600' :
                      alert.severity === 'medium' ? 'text-orange-600' :
                      'text-yellow-600'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-emerald-900 font-medium">{alert.type.replace('_', ' ').toUpperCase()}</h4>
                        <span className={`px-2 py-1 rounded text-xs ${
                          alert.severity === 'high' ? 'bg-red-100 text-red-700 border border-red-200' :
                          alert.severity === 'medium' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                          'bg-yellow-100 text-yellow-700 border border-yellow-200'
                        }`}>
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-emerald-700 text-sm mb-2">{alert.message}</p>
                      <p className="text-emerald-600 text-xs">
                        {new Date(alert.created_at).toLocaleString()}
                        {alert.appliance_name && ` • ${alert.appliance_name}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-emerald-600 text-center py-8">No alerts to display</p>
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
