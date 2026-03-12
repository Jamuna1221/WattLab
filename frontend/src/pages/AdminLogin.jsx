import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Zap } from 'lucide-react';
import api from '../utils/api';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/admin/login', form);
      const { token, admin } = response.data;

      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminUser', JSON.stringify(admin));

      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg shadow-emerald-500/40 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-emerald-900">WattLab</h1>
          <p className="text-emerald-600 mt-1">Admin Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-emerald-100 p-8">
          <h2 className="text-xl font-bold text-emerald-900 mb-1">Admin Sign In</h2>
          <p className="text-emerald-600 text-sm mb-6">Access restricted to administrators only</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-emerald-700 mb-1.5">
                Admin Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="admin@wattlab.com"
                required
                className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-emerald-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-emerald-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter admin password"
                  required
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-emerald-900 bg-white pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 hover:text-emerald-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg shadow-lg shadow-emerald-500/30 transition-all transform hover:scale-[1.02] mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </span>
              ) : 'Sign In as Admin'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-emerald-100 text-center">
            <p className="text-xs text-emerald-500">
              Not an admin?{' '}
              <a href="/login" className="text-emerald-700 font-medium hover:underline">
                User Login →
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}