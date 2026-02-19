import { Link } from 'react-router-dom';
import { 
  Zap, TrendingDown, Bell, BarChart3, 
  Shield, Lightbulb, Activity, DollarSign,
  ArrowRight, CheckCircle, Users, Clock,
  Mail, Phone, MapPin, Send
} from 'lucide-react';

export default function Home() {
  const features = [
    {
      icon: Activity,
      title: 'Real-Time Monitoring',
      description: 'Track your energy consumption in real-time with live updates and interactive dashboards.',
      color: 'emerald'
    },
    {
      icon: BarChart3,
      title: 'Smart Analytics',
      description: 'Get detailed insights with appliance-wise breakdown and consumption patterns.',
      color: 'blue'
    },
    {
      icon: TrendingDown,
      title: 'Bill Predictions',
      description: 'ML-powered monthly bill predictions to help you plan and budget better.',
      color: 'purple'
    },
    {
      icon: Lightbulb,
      title: 'Save Energy',
      description: 'Receive personalized recommendations to reduce consumption and save money.',
      color: 'orange'
    },
    {
      icon: Bell,
      title: 'Smart Alerts',
      description: 'Get notified about abnormal usage patterns and high consumption instantly.',
      color: 'red'
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your data is encrypted and protected with enterprise-grade security.',
      color: 'indigo'
    }
  ];

  const stats = [
    { value: '45%', label: 'Average Savings', icon: DollarSign },
    { value: '1000+', label: 'Active Users', icon: Users },
    { value: '24/7', label: 'Monitoring', icon: Clock },
    { value: '99.9%', label: 'Uptime', icon: CheckCircle }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50">
    {/* Navigation */}
<nav className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur-lg border-b border-emerald-100 z-50 shadow-sm">
  <div className="flex items-center justify-between h-16 px-6 lg:px-12">

    {/* Logo - Now Proper Left Corner */}
    <div className="flex items-center space-x-3">
      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/50">
        <Zap className="w-6 h-6 text-white" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-emerald-900">WattLab</h1>
        <p className="text-xs text-emerald-600">Natural Power of Energy</p>
      </div>
    </div>

    {/* Right Side Buttons */}
    <div className="flex items-center space-x-4">
      <Link
        to="/login"
        className="text-emerald-700 hover:text-emerald-900 transition-colors font-medium"
      >
        Sign In
      </Link>
      <Link
        to="/register"
        className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6 py-2 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/30"
      >
        Get Started
      </Link>
    </div>

  </div>
</nav>


      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 bg-emerald-100 border border-emerald-200 rounded-full px-4 py-2 mb-6">
              <Zap className="w-4 h-4 text-emerald-600" />
              <span className="text-emerald-700 text-sm font-medium">Powered by AI & Machine Learning</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-emerald-900 mb-6 leading-tight">
              Monitor. Analyze.
              <br />
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                Save Energy.
              </span>
            </h1>
            
            <p className="text-xl text-emerald-700 mb-8 max-w-3xl mx-auto leading-relaxed">
              Take control of your energy consumption with WattLab's intelligent monitoring system. 
              Get real-time insights, predict your bills, and save up to 45% on electricity costs.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link
                to="/register"
                className="group bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-8 py-4 rounded-lg font-medium transition-all transform hover:scale-105 shadow-xl shadow-emerald-500/30 flex items-center space-x-2"
              >
                <span>Start Monitoring Free</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/login"
                className="bg-white hover:bg-emerald-50 text-emerald-700 px-8 py-4 rounded-lg font-medium transition-all border border-emerald-200 shadow-md"
              >
                Sign In to Dashboard
              </Link>
            </div>

            {/* Animated Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-6 hover:bg-white hover:shadow-lg transition-all transform hover:scale-105"
                >
                  <stat.icon className="w-8 h-8 text-emerald-600 mb-3 mx-auto" />
                  <div className="text-3xl font-bold text-emerald-900 mb-1">{stat.value}</div>
                  <div className="text-sm text-emerald-600">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-emerald-900 mb-4">
              Everything You Need to Save Energy
            </h2>
            <p className="text-xl text-emerald-700 max-w-2xl mx-auto">
              Powerful features designed to help you understand and optimize your energy consumption
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-8 hover:bg-white hover:border-emerald-300 hover:shadow-xl transition-all transform hover:scale-105"
              >
                <div className={`w-14 h-14 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg flex items-center justify-center mb-6 group-hover:from-emerald-200 group-hover:to-teal-200 transition-colors`}>
                  <feature.icon className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold text-emerald-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-emerald-700 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-emerald-900 mb-4">
              How WattLab Works
            </h2>
            <p className="text-xl text-emerald-700 max-w-2xl mx-auto">
              Get started in minutes with our simple three-step process
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="relative">
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-8 text-center shadow-md hover:shadow-xl transition-shadow">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6 shadow-lg">
                  1
                </div>
                <h3 className="text-xl font-semibold text-emerald-900 mb-3">Create Account</h3>
                <p className="text-emerald-700">
                  Sign up for free and set up your profile in seconds
                </p>
              </div>
              <div className="hidden md:block absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2">
                <ArrowRight className="w-8 h-8 text-emerald-500" />
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-8 text-center shadow-md hover:shadow-xl transition-shadow">
                <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6 shadow-lg">
                  2
                </div>
                <h3 className="text-xl font-semibold text-emerald-900 mb-3">Add Appliances</h3>
                <p className="text-emerald-700">
                  Register your home appliances to start tracking consumption
                </p>
              </div>
              <div className="hidden md:block absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2">
                <ArrowRight className="w-8 h-8 text-teal-500" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-cyan-50 to-emerald-50 border border-cyan-200 rounded-xl p-8 text-center shadow-md hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-emerald-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6 shadow-lg">
                3
              </div>
              <h3 className="text-xl font-semibold text-emerald-900 mb-3">Monitor & Save</h3>
              <p className="text-emerald-700">
                Track usage, get insights, and start saving on your energy bills
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-12 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-grid-white/10"></div>
            <div className="relative z-10">
              <h2 className="text-4xl font-bold text-white mb-4">
                Ready to Take Control?
              </h2>
              <p className="text-xl text-emerald-50 mb-8 max-w-2xl mx-auto">
                Join thousands of users who are already saving energy and money with WattLab
              </p>
              <Link
                to="/register"
                className="inline-flex items-center space-x-2 bg-white hover:bg-gray-100 text-emerald-600 px-8 py-4 rounded-lg font-semibold transition-all transform hover:scale-105 shadow-xl"
              >
                <span>Get Started for Free</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-emerald-900 mb-4">
              Get in Touch
            </h2>
            <p className="text-xl text-emerald-700 max-w-2xl mx-auto">
              Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-8 shadow-lg">
              <h3 className="text-2xl font-semibold text-emerald-900 mb-6">Send us a Message</h3>
              <form className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-emerald-700 mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    className="w-full px-4 py-3 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-emerald-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="w-full px-4 py-3 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-emerald-700 mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    rows="5"
                    className="w-full px-4 py-3 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none"
                    placeholder="Tell us how we can help..."
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/30 flex items-center justify-center space-x-2"
                >
                  <span>Send Message</span>
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>

            {/* Contact Information */}
            <div className="space-y-8">
              <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-8 shadow-lg">
                <h3 className="text-2xl font-semibold text-emerald-900 mb-6">Contact Information</h3>
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-emerald-900 mb-1">Email</h4>
                      <p className="text-emerald-700">support@wattlab.com</p>
                      <p className="text-emerald-700">info@wattlab.com</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Phone className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-emerald-900 mb-1">Phone</h4>
                      <p className="text-emerald-700">+1 (555) 123-4567</p>
                      <p className="text-emerald-700">Mon-Fri, 9am-6pm EST</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-emerald-900 mb-1">Office</h4>
                      <p className="text-emerald-700">123 Energy Street</p>
                      <p className="text-emerald-700">San Francisco, CA 94102</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-8">
                <h4 className="text-lg font-semibold text-emerald-900 mb-3">Need Immediate Help?</h4>
                <p className="text-emerald-700 mb-4">
                  Check out our comprehensive FAQ section or reach out to our support team for instant assistance.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                >
                  Visit Help Center
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-emerald-100 bg-white/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-900">WattLab</h3>
                <p className="text-sm text-emerald-600">Natural Power of Energy</p>
              </div>
            </div>
            <div className="text-emerald-600 text-sm">
              © 2026 WattLab. Making energy monitoring intelligent.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
