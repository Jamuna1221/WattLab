import { useEffect } from "react";
import { supabase } from "./supabaseClient";

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
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
      <h1>Check Console (F12)</h1>
    </div>
  );
}

export default App;
