import { useEffect } from "react";
import { supabase } from "./supabaseClient";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import UserDashboard from "./pages/UserDashboard";
import LiveDashboard from "./pages/LiveDashboard";
import PredictionsPage from "./pages/PredictionsPage";
import AppliancesPage from "./pages/AppliancesPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import HistoryPage from "./pages/HistoryPage";
import BillPage from "./pages/BillPage";
import AlertsPage from "./pages/AlertsPage";
import SettingsPage from "./pages/SettingsPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogin from "./pages/AdminLogin";
import AdminPrivateRoute from "./components/AdminPrivateRoute";
import "./App.css";

function App() {
  useEffect(() => {
    testConnection();
  }, []);

  async function testConnection() {
    const { data, error } = await supabase.from("users").select("*");
    if (error) {
      console.log("❌ Database NOT connected", error.message);
    } else {
      console.log("✅ Database connected!", data);
    }
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/dashboard/live" element={<LiveDashboard />} />
        <Route path="/dashboard/predictions" element={<PredictionsPage />} />
        <Route path="/dashboard/appliances" element={<AppliancesPage />} />
        <Route path="/dashboard/analytics" element={<AnalyticsPage />} />
        <Route path="/dashboard/history" element={<HistoryPage />} />
        <Route path="/dashboard/bill" element={<BillPage />} />
        <Route path="/dashboard/alerts" element={<AlertsPage />} />
        <Route path="/dashboard/settings" element={<SettingsPage />} />

        {/* Admin routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <AdminPrivateRoute>
              <AdminDashboard />
            </AdminPrivateRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
