import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import loginBg from "../assets/wattlabloginpage.png";
import { supabase } from "../supabaseClient";

export default function Register() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signUp({
      email: formData.email.trim(),
      password: formData.password.trim(),
      options: {
        data: {
          name: formData.name,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("User creation failed");
      setLoading(false);
      return;
    }

    setLoading(false);
    alert("Registration successful! Please login.");
    navigate("/login");
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        backgroundImage: `url(${loginBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="max-w-md w-full bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-center mb-6 text-emerald-600">
          Get Started!
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-600 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            required
            placeholder="Full Name"
            className="w-full border p-3 rounded"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
          />

          <input
            type="email"
            required
            placeholder="Email"
            className="w-full border p-3 rounded"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />

          <input
            type="password"
            required
            placeholder="Password"
            className="w-full border p-3 rounded"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 text-white p-3 rounded"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          Already have an account?{" "}
          <Link to="/login" className="text-emerald-600 font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}