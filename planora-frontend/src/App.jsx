import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Plans from "./pages/Plans";

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("login");
  const [appPage, setAppPage] = useState("dashboard");

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setPage("app");
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setPage("app");
    setAppPage("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setPage("login");
  };

  if (page === "login") return <Login onLogin={handleLogin} goRegister={() => setPage("register")} />;
  if (page === "register") return <Register onLogin={handleLogin} goLogin={() => setPage("login")} />;
  if (page === "app") {
    if (appPage === "plans") return <Plans user={user} goBack={() => setAppPage("dashboard")} />;
    return <Dashboard user={user} onLogout={handleLogout} goPlans={() => setAppPage("plans")} />;
  }
}