import { useEffect } from "react";
import { supabase } from "./supabaseClient";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";

import "./App.css";

function App() {

  useEffect(() => {
    testConnection();
  }, []);

  async function testConnection() {
    const { data, error } = await supabase
      .from("users")   // make sure table exists
      .select("*");

    if (error) {
      console.log("❌ Database NOT connected");
      console.log(error.message);
    } else {
      console.log("✅ Database connected successfully!");
      console.log(data);
    }
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />

        {/* optional fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
