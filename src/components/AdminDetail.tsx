import { useCallback, useEffect, useMemo, useState } from "react";
import { zipSync } from "fflate";
import { editableSections } from "@/content/brief-config";
import { adminApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";

type Answer = { sectionId: string; questionId: string; questionType: string; value: unknown };
type FileRow = { id: string; questionId: string; originalFilename: string; mimeType: string; sizeBytes: number };
type Data = {
  submission: {
    id: string; publicCode: string; firstName?: string | null; lastName?: string | null; role?: string | null; contact?: string | null;
    comment?: string; status: string; completionPercent: number; startedAt: string; updatedAt: string;
    submittedAt?: string; adminNote?: string;
  };
  answers: Answer[];
  attachments: FileRow[];
};

const text = (value: unknown): string => {
  if (value == null || value === "") return "Не указано";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(text).join(", ");
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${text(item)}`).join(" · ");
  return String(value);
};

function downloadBlob(bytes: Uint8Array, filename: string, type: string) {
  const blob = new Blob([bytes as BlobPart], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function AdminFile({ file }: { file: FileRow }) {
  const [previewUrl, setPreviewUrl] = useState("");
  useEffect(() => {
    if (!file.mimeType.startsWith("image/")) return;
    let active = true;
    void adminApi.fileUrl(file.id).then((result) => {
      if (active) setPreviewUrl(result.signedUrl);
    });
    return () => { active = false; };
  }, [file.id, file.mimeType]);

  const open = async (download: boolean) => {
    const result = await adminApi.fileUrl(file.id, download);
    const link = document.createElement("a");
    link.href = result.signedUrl;
    link.target = download ? "_self" : "_blank";
    if (download) link.download = result.filename;
    link.rel = "noreferrer";
    link.click();
  };

  return <article>
    {previewUrl ? <button className="file-preview-button" onClick={() => void open(false)}><img src={previewUrl} alt={file.originalFilename} /></button> : <i>{file.mimeType.split("/")[1]?.toUpperCase()}</i>}
    <strong>{file.originalFilename}</strong>
    <span>{(file.sizeBytes / 1024 / 1024).toFixed(1)} МБ</span>
    <button className="file-download-button" onClick={() => void open(true)}>Скачать ↓</button>
  </article>;
}

export default function AdminDetail({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [note, setNote] = useState("");
  const [zipLoading, setZipLoading] = useState(false);
  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return void (location.href = "/admin/login");
    try {
      const next = await adminApi.detail(id) as Data;
      setData(next);
      setNote(next.submission.adminNote ?? "");
    } catch {
      location.href = "/admin/login";
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  const answerMap = useMemo(() => Object.fromEntries(data?.answers.map((answer) => [answer.questionId, answer.value]) ?? []), [data]);
  if (!data) return <main className="admin-detail loading-line">Загружаем визуальный портрет…</main>;

  const originalSubmission = data.submission;
  const s = {
    ...originalSubmission,
    firstName: originalSubmission.firstName || "Анонимный",
    lastName: originalSubmission.firstName ? originalSubmission.lastName : "респондент",
    role: originalSubmission.role || "Анонимная сессия",
    contact: originalSubmission.contact || "",
  };
  const summary = {
    qualities: text(answerMap["perception-three-qualities"]),
    impression: text(answerMap["perception-first-impression"]),
    scales: text({
      "сдержанная — экспрессивная": answerMap["character-reserved-expressive"],
      "дружелюбная — авторитетная": answerMap["character-friendly-authoritative"],
      "простая — сложная": answerMap["character-simple-complex"],
    }),
    directions: text(answerMap["dna-direction-ratings"]),
    avoid: text(answerMap["dna-forbidden-techniques"]),
    colors: text(answerMap["dna-organic-colors"]),
    logo: text(answerMap["logo-wordmark-character"]),
    symbol: text(answerMap["logo-symbol-need"]),
  };

  const saveNote = async () => {
    await adminApi.update(id, { adminNote: note });
  };
  const updateStatus = async (status: string) => {
    await adminApi.update(id, { status });
    await load();
  };
  const exportJson = () => {
    const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2));
    downloadBlob(bytes, `${s.publicCode}.json`, "application/json");
  };
  const exportZip = async () => {
    setZipLoading(true);
    try {
      const result = await adminApi.zipFiles(id);
      const entries: Record<string, Uint8Array> = {};
      for (const [index, file] of result.files.entries()) {
        const response = await fetch(file.signedUrl);
        if (!response.ok) continue;
        const safe = file.filename.replace(/[^\p{L}\p{N}._ -]/gu, "_");
        entries[`${String(index + 1).padStart(2, "0")}-${safe}`] = new Uint8Array(await response.arrayBuffer());
      }
      downloadBlob(zipSync(entries, { level: 0 }), `TBD-${id.slice(0, 8)}-files.zip`, "application/zip");
    } finally {
      setZipLoading(false);
    }
  };

  return <main className="admin-detail">
    <header className="detail-header"><a href="/admin">← Все сессии</a><span className="wordmark">TBD<span>●</span></span><div><button onClick={exportJson}>JSON</button><button onClick={() => print()}>PDF / Печать</button><button disabled={zipLoading} onClick={() => void exportZip()}>{zipLoading ? "Готовим ZIP…" : "ZIP файлов"}</button></div></header>
    <section className="detail-title"><div><p className="eyebrow">{s.publicCode} / {s.status}</p><h1>{s.firstName}<br />{s.lastName}</h1><p>{s.role} · <a href={s.contact.includes("@") && !s.contact.startsWith("@") ? `mailto:${s.contact}` : undefined}>{s.contact}</a></p></div><div className="detail-meta"><dl><dt>Начало</dt><dd>{new Date(s.startedAt).toLocaleString("ru")}</dd></dl><dl><dt>Изменено</dt><dd>{new Date(s.updatedAt).toLocaleString("ru")}</dd></dl><dl><dt>Отправлено</dt><dd>{s.submittedAt ? new Date(s.submittedAt).toLocaleString("ru") : "—"}</dd></dl><dl><dt>Прогресс</dt><dd>{s.completionPercent}%</dd></dl><label><span>Статус</span><select value={s.status} onChange={(event) => void updateStatus(event.target.value)}><option value="draft">draft</option><option value="submitted">submitted</option><option value="archived">archived</option></select></label></div></section>
    <section className="summary-block"><div className="section-label mono">AUTO / STRUCTURED SUMMARY</div><h2>Сводка визуального<br />характера</h2><div className="summary-grid">{Object.entries({ "Три качества": summary.qualities, "Первое впечатление": summary.impression, "Положение на шкалах": summary.scales, "Визуальные направления": summary.directions, "Нежелательные решения": summary.avoid, "Цветовые ассоциации": summary.colors, "Пожелания к логотипу": summary.logo, "Дополнительный знак": summary.symbol }).map(([label, value]) => <dl key={label}><dt>{label}</dt><dd>{value}</dd></dl>)}</div></section>
    <section className="answer-groups">{editableSections.map((section) => <article key={section.id}><div className="answer-section-title"><span>{section.number}</span><h2>{section.title}</h2></div>{section.questions.map((question) => <div className="answer-row" key={question.id}><div><span className="mono">{question.number}</span><h3>{question.title}</h3></div><div>{question.type === "scales" && answerMap[question.id] && typeof answerMap[question.id] === "object" ? <div className="admin-scales">{Object.entries(answerMap[question.id] as Record<string, unknown>).map(([pair, value]) => <div key={pair}><span>{pair}</span><strong>{text(value)}</strong><i><b style={{ width: `${typeof value === "number" ? ((value - 1) / 6) * 100 : 0}%` }} /></i></div>)}</div> : <p>{text(answerMap[question.id])}</p>}</div></div>)}</article>)}</section>
    <section className="admin-files"><p className="eyebrow">ATTACHMENTS / {data.attachments.length}</p><h2>Референсы и файлы</h2><div>{data.attachments.map((file) => <AdminFile key={file.id} file={file} />)}</div></section>
    <section className="admin-note"><div><p className="eyebrow">PRIVATE NOTE</p><h2>Внутренняя заметка</h2><p>Видна только администратору.</p></div><div><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={6} placeholder="Наблюдения дизайн-лида…" /><button className="primary" onClick={() => void saveNote()}>Сохранить заметку</button></div></section>
  </main>;
}
