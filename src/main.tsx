import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import AdminDashboard from "./components/AdminDashboard";
import AdminDetail from "./components/AdminDetail";
import AdminLogin from "./components/AdminLogin";
import SessionApp from "./components/SessionApp";
import "./index.css";

function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const continueMatch = path.match(/^\/continue\/([^/]+)$/);
  const adminDetailMatch = path.match(/^\/admin\/submissions\/([^/]+)$/);
  const isAdmin = path.startsWith("/admin");

  useEffect(() => {
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (robots) robots.content = isAdmin ? "noindex, nofollow" : "index, follow";
  }, [isAdmin]);

  if (path === "/admin/login") return <AdminLogin />;
  if (adminDetailMatch) return <AdminDetail id={decodeURIComponent(adminDetailMatch[1])} />;
  if (path === "/admin") return <AdminDashboard />;
  return <SessionApp continueId={continueMatch ? decodeURIComponent(continueMatch[1]) : undefined} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
