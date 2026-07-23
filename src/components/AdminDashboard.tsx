"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";

type Row = {
  id: string; publicCode: string; firstName?: string | null; lastName?: string | null; role?: string | null;
  contact?: string | null; status: string; completionPercent: number; fileCount: number;
  startedAt: string; updatedAt: string; submittedAt?: string;
};

const date = (value?: string) => value ? new Intl.DateTimeFormat("ru", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";

export default function AdminDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("date");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return void (location.href = "/admin/login");
    try {
      const data = await adminApi.list(search, status, sort);
      setRows((data.submissions ?? []) as Row[]);
      setLoading(false);
    } catch {
      location.href = "/admin/login";
    }
  }, [search, sort, status]);
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer); }, [load]);
  const archive = async (id: string) => {
    if (!confirm("Архивировать эту сессию?")) return;
    await adminApi.update(id, { status: "archived" });
    void load();
  };
  return <main className="admin-shell"><header className="admin-header"><a className="wordmark" href="/">TBD<span>●</span></a><div><span className="mono">DESIGN LEAD SYSTEM</span><button onClick={async () => { await supabase.auth.signOut(); location.href = "/admin/login"; }}>Выйти</button></div></header><section className="admin-hero"><p className="eyebrow">VISUAL IDENTITY SESSIONS</p><h1>Собранные<br />портреты</h1><div className="admin-stats"><span><strong>{rows.length}</strong>сессий</span><span><strong>{rows.filter((row) => row.status === "submitted").length}</strong>отправлено</span><span><strong>{rows.filter((row) => row.status === "draft").length}</strong>черновиков</span></div></section><section className="admin-content"><div className="admin-filters"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по коду или старым данным…" /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Все статусы</option><option value="draft">Черновики</option><option value="submitted">Отправленные</option><option value="archived">Архив</option></select><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="date">Сначала новые</option><option value="completion">По заполненности</option></select></div><div className="submission-table"><div className="table-head mono"><span>СЕССИЯ</span><span>СТАТУС</span><span>ПРОГРЕСС</span><span>ФАЙЛЫ</span><span>ИЗМЕНЕНО</span><span /></div>{loading ? <p className="loading-line">Собираем данные…</p> : rows.length ? rows.map((row) => <article key={row.id}><div><strong>{row.publicCode}</strong><span>{row.firstName ? `${row.firstName} ${row.lastName ?? ""}`.trim() : "Анонимная сессия"}</span>{(row.role || row.contact) && <small>{[row.role, row.contact].filter(Boolean).join(" · ")}</small>}</div><div><i className={`status ${row.status}`}>{row.status}</i></div><div><strong>{row.completionPercent}%</strong><i className="mini-progress"><b style={{ width: `${row.completionPercent}%` }} /></i></div><div>{row.fileCount}</div><div>{date(row.updatedAt)}</div><div className="row-actions"><a href={`/admin/submissions/${row.id}`}>Открыть ↗</a>{row.status !== "archived" && <button onClick={() => void archive(row.id)}>Архив</button>}</div></article>) : <p className="empty-state">Сессии не найдены.</p>}</div></section></main>;
}
