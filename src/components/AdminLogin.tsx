"use client";

import { useState } from "react";
import { adminApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function AdminLogin() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("Неверный email или пароль.");
      setLoading(false);
      return;
    }
    try {
      await adminApi.me();
    } catch {
      await supabase.auth.signOut();
      setError("У этого пользователя нет прав администратора.");
      setLoading(false);
      return;
    }
    location.href = "/admin";
  };
  return <main className="admin-login"><a className="wordmark" href="/">TBD<span>●</span></a><form onSubmit={submit}><p className="eyebrow">PRIVATE / DESIGN LEAD</p><h1>Административная<br />система TBD</h1><label><span>Email</span><input type="email" name="email" required autoFocus /></label><label><span>Пароль</span><input type="password" name="password" required minLength={8} /></label>{error && <p className="error">{error}</p>}<button className="primary" disabled={loading}>{loading ? "Проверяем…" : "Войти →"}</button></form></main>;
}
