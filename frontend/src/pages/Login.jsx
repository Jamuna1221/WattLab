import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Mail, Lock } from 'lucide-react';
import loginBg from '../assets/wattlabloginpage.png';
  import { supabase } from '../supabaseClient'; 

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

// add this at top of file

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError('');

  // 🔐 Login using Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.email.trim(),
    password: formData.password.trim(),
  });

  if (error) {
    setError("Invalid email or password");
    setLoading(false);
    return;
  }

  // 🔎 Get user from users table
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

  setLoading(false);

  if (userError || !userData) {
    setError("User profile not found");
    return;
  }

  // 🚀 Since no role column → redirect all to dashboard
  navigate('/dashboard');
};


  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-8 relative"
      style={{ 
        backgroundImage: `url(${loginBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: 'brightness(1.1)'
      }}
    >
      <div className="absolute inset-0 bg-black/5"></div>
      <div className="max-w-md w-full relative z-10 md:mr-[28rem]">
        <div className="text-center mb-6 sm:mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 sm:space-x-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/50">
              <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-xl sm:text-2xl font-bold text-emerald-900">WattLab</h1>
              <p className="text-xs text-emerald-600">Natural Power of Energy</p>
            </div>
          </Link>
        </div>

        <div className="bg-white/90 backdrop-blur-sm border border-emerald-100 rounded-xl shadow-xl overflow-hidden">
          {/* Welcome Back Container - Now connected to the form */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 py-6 sm:py-8 md:py-10 px-4 sm:px-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid-white/10"></div>
            <div className="relative z-10 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 sm:mb-3">Welcome Back!</h2>
              <p className="text-sm sm:text-base text-emerald-50">Sign in to your energy dashboard</p>
            </div>
          </div>

          <div className="p-4 sm:p-6 md:p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500 rounded text-red-500 text-sm">
                {error}
              </div>
            )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-sm font-medium text-emerald-900 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                <input
                  type="email"
                  required
                  className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-sm sm:text-base bg-white border-2 border-emerald-200 rounded-lg text-emerald-900 placeholder-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-emerald-900 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                <input
                  type="password"
                  required
                  className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-sm sm:text-base bg-white border-2 border-emerald-200 rounded-lg text-emerald-900 placeholder-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-2.5 sm:py-3 px-4 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30 text-sm sm:text-base"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-emerald-900 text-xs sm:text-sm font-semibold mb-2 sm:mb-3 text-center">
              💡 Demo Login Guide
            </p>
            <div className="text-xs text-emerald-700 space-y-1.5 sm:space-y-2">
              <div className="flex items-start space-x-2">
                <span className="font-semibold min-w-[50px] sm:min-w-[60px]">Admin:</span>
                <span className="text-[11px] sm:text-xs">Use email with "admin" (e.g., admin@wattlab.com)</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-semibold min-w-[50px] sm:min-w-[60px]">User:</span>
                <span className="text-[11px] sm:text-xs">Use any other email (e.g., user@wattlab.com)</span>
              </div>
              <p className="text-emerald-600 italic mt-1.5 sm:mt-2 text-[11px] sm:text-xs">Password can be anything in demo mode</p>
            </div>
          </div>

          {/* <p className="mt-4 sm:mt-6 text-center text-xs sm:text-sm text-emerald-700">
            Don't have an account?{' '}
            <Link to="/register" className="text-emerald-600 hover:text-emerald-800 font-semibold">
              Sign up
            </Link>
          </p> */}
          </div>
        </div>
      </div>
    </div>
  );
}
