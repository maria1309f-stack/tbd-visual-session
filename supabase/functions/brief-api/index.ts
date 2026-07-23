import { createClient } from "@supabase/supabase-js";
import { allQuestions, briefSections, isAnswered, isQuestionVisible, type Question } from "./brief-config.ts";
import { MAX_FILES, publicCode, randomToken, tokenHash, validateAttachment } from "./validation.ts";

const BUCKET = "brief-attachments";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EDIT_TOKEN_SECRET = Deno.env.get("EDIT_TOKEN_SECRET") || SUPABASE_SERVICE_ROLE_KEY;
const APP_URLS = (Deno.env.get("APP_URL") ?? "").split(",").map((value) => value.trim().replace(/\/$/, "")).filter(Boolean);
const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Payload = Record<string, unknown>;
type SubmissionRow = {
  id: string;
  public_code: string;
  status: string;
  edit_token_hash: string;
  current_section: number;
  current_question: number;
  completion_percent: number;
  started_at: string;
  updated_at: string;
  submitted_at: string | null;
  archived_at: string | null;
  admin_note: string | null;
};
type AttachmentRow = {
  id: string;
  submission_id: string;
  section_id: string;
  question_id: string;
  reference_group_id: string | null;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  caption: string | null;
  upload_status: string;
  created_at: string;
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin")?.replace(/\/$/, "") ?? "";
  if (!origin) return APP_URLS[0] ?? "*";
  if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) return origin;
  if (APP_URLS.includes(origin)) return origin;
  if (!APP_URLS.length) {
    try {
      const host = new URL(origin).hostname;
      if (host.endsWith(".bolt.host") || host.endsWith(".netlify.app") || host.endsWith(".supabase.co")) return origin;
    } catch { /* invalid origin */ }
  }
  return "";
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin || "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(origin: string, data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      ...corsHeaders(origin),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function stringValue(value: unknown, max = 500) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function submissionView(row: SubmissionRow) {
  return {
    id: row.id,
    publicCode: row.public_code,
    status: row.status,
    currentSection: row.current_section,
    currentQuestion: row.current_question,
    completionPercent: row.completion_percent,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
  };
}

function attachmentView(row: AttachmentRow) {
  return {
    id: row.id,
    questionId: row.question_id,
    referenceGroupId: row.reference_group_id,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    caption: row.caption,
    createdAt: row.created_at,
  };
}

function completion(answers: Record<string, unknown>) {
  const visible = allQuestions.filter((question) => isQuestionVisible(question, answers));
  const answered = visible.filter((question) => isAnswered(answers[question.id])).length;
  return visible.length ? Math.round((answered / visible.length) * 100) : 0;
}

async function findSubmission(submissionId: string) {
  const { data, error } = await service.from("submissions").select("*").eq("id", submissionId).maybeSingle();
  if (error) throw new HttpError(500, "Не удалось получить сессию.");
  return data as SubmissionRow | null;
}

async function verifyOwner(submissionId: string, editToken: string, editableOnly = false) {
  if (!submissionId || !editToken) throw new HttpError(404, "Сессия не найдена.");
  const row = await findSubmission(submissionId);
  if (!row) throw new HttpError(404, "Сессия не найдена.");
  if (editableOnly && row.status !== "draft") throw new HttpError(403, "Редактирование недоступно.");
  const hash = await tokenHash(editToken, EDIT_TOKEN_SECRET);
  if (hash !== row.edit_token_hash) throw new HttpError(404, "Сессия не найдена.");
  return row;
}

async function requireAdmin(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new HttpError(401, "Требуется вход.");
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) throw new HttpError(401, "Требуется вход.");
  const { data: profile } = await service.from("admin_profiles").select("id,email,display_name").eq("id", authData.user.id).maybeSingle();
  if (!profile) throw new HttpError(403, "Нет прав администратора.");
  return { user: authData.user, profile };
}

async function insertEvent(submissionId: string, eventType: string, metadata: Record<string, unknown> = {}) {
  const { error } = await service.from("submission_events").insert({
    submission_id: submissionId,
    event_type: eventType,
    metadata,
  });
  if (error) throw new HttpError(500, "Не удалось сохранить событие.");
}

async function start(payload: Payload) {
  if (payload.website) throw new HttpError(400, "Проверьте заполненные поля.");
  const id = crypto.randomUUID();
  const token = randomToken();
  const editTokenHash = await tokenHash(token, EDIT_TOKEN_SECRET);
  let code = publicCode();
  let inserted = false;
  for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
    const result = await service.from("submissions").insert({
      id,
      public_code: code,
      edit_token_hash: editTokenHash,
    });
    if (!result.error) {
      inserted = true;
      break;
    }
    if (result.error.code !== "23505") throw new HttpError(500, "Не удалось начать сессию.");
    code = publicCode();
  }
  if (!inserted) throw new HttpError(500, "Не удалось создать уникальный код сессии.");
  await insertEvent(id, "started");
  return { id, token, publicCode: code, status: "draft", currentSection: 0, currentQuestion: 0 };
}

async function getSubmission(payload: Payload) {
  const submission = await verifyOwner(stringValue(payload.submissionId), stringValue(payload.editToken, 256));
  const [answersResult, filesResult] = await Promise.all([
    service.from("answers").select("question_id,value").eq("submission_id", submission.id),
    service.from("attachments").select("*").eq("submission_id", submission.id).eq("upload_status", "ready").order("created_at"),
  ]);
  if (answersResult.error || filesResult.error) throw new HttpError(500, "Не удалось восстановить сессию.");
  return {
    submission: submissionView(submission),
    answers: Object.fromEntries((answersResult.data ?? []).map((row) => [row.question_id, row.value])),
    attachments: ((filesResult.data ?? []) as AttachmentRow[]).map(attachmentView),
  };
}

function normalizedReferences(submissionId: string, answers: Record<string, unknown>) {
  const rows: Record<string, unknown>[] = [];
  for (const question of allQuestions) {
    if (question.type !== "references" && question.type !== "antiReferences") continue;
    const cards = answers[question.id];
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      if (!card || typeof card !== "object") continue;
      const value = card as Record<string, unknown>;
      const referenceGroupId = stringValue(value.id, 120);
      if (!referenceGroupId) continue;
      rows.push({
        submission_id: submissionId,
        section_id: question.sectionId,
        question_id: question.id,
        reference_group_id: referenceGroupId,
        reference_type: question.type === "antiReferences" ? "anti-reference" : "reference",
        url: stringValue(value.url, 2000) || null,
        title: stringValue(value.title, 500) || null,
        notes: Array.isArray(value.notes) ? value.notes.map((item) => stringValue(item, 2000)) : [],
        likes_text: stringValue(value.likes, 4000) || null,
        mood_only_text: stringValue(value.mood, 4000) || null,
        avoid_copying_text: stringValue(value.avoid, 4000) || null,
        dislikes_text: stringValue(value.dislikes, 4000) || null,
        updated_at: new Date().toISOString(),
      });
    }
  }
  return rows;
}

async function save(payload: Payload) {
  const submissionId = stringValue(payload.submissionId);
  await verifyOwner(submissionId, stringValue(payload.editToken, 256), true);
  const sourceAnswers = payload.answers && typeof payload.answers === "object" ? payload.answers as Record<string, unknown> : {};
  const known = new Map(allQuestions.map((question) => [question.id, question]));
  const cleaned = Object.fromEntries(Object.entries(sourceAnswers).filter(([questionId]) => known.has(questionId)));
  const now = new Date().toISOString();
  const answerRows = Object.entries(cleaned).map(([questionId, value]) => {
    const question = known.get(questionId)!;
    return {
      submission_id: submissionId,
      section_id: question.sectionId,
      question_id: questionId,
      question_type: question.type,
      value,
      updated_at: now,
    };
  });
  if (answerRows.length) {
    const { error } = await service.from("answers").upsert(answerRows, { onConflict: "submission_id,question_id" });
    if (error) throw new HttpError(500, "Не удалось сохранить ответы.");
  }
  const { error: deleteReferenceError } = await service.from("references").delete().eq("submission_id", submissionId);
  if (deleteReferenceError) throw new HttpError(500, "Не удалось обновить референсы.");
  const references = normalizedReferences(submissionId, cleaned);
  if (references.length) {
    const { error } = await service.from("references").insert(references);
    if (error) throw new HttpError(500, "Не удалось сохранить референсы.");
  }
  const currentSection = Math.max(0, Math.min(Number(payload.currentSection) || 0, briefSections.length - 1));
  const completionPercent = completion(cleaned);
  const { error: updateError } = await service.from("submissions").update({
    current_section: currentSection,
    current_question: 0,
    completion_percent: completionPercent,
    updated_at: now,
  }).eq("id", submissionId).eq("status", "draft");
  if (updateError) throw new HttpError(500, "Не удалось сохранить прогресс.");
  await insertEvent(submissionId, "autosaved", { answerCount: answerRows.length });
  return { savedAt: now, completionPercent };
}

async function submit(payload: Payload) {
  const submissionId = stringValue(payload.submissionId);
  const submission = await verifyOwner(submissionId, stringValue(payload.editToken, 256), true);
  if (payload.confirmed !== true) throw new HttpError(400, "Подтвердите проверку ответов.");
  const { data: answerRows, error: answerError } = await service.from("answers").select("question_id,value").eq("submission_id", submissionId);
  if (answerError) throw new HttpError(500, "Не удалось проверить ответы.");
  const answers = Object.fromEntries((answerRows ?? []).map((row) => [row.question_id, row.value]));
  const missing = allQuestions.filter((question) =>
    question.required && isQuestionVisible(question, answers) && !isAnswered(answers[question.id])
  );
  if (missing.length) throw new HttpError(400, "Заполните обязательные ответы.");
  const now = new Date().toISOString();
  const { error } = await service.from("submissions").update({
    status: "submitted",
    completion_percent: 100,
    submitted_at: now,
    updated_at: now,
  }).eq("id", submissionId).eq("status", "draft");
  if (error) throw new HttpError(500, "Не удалось отправить анкету.");
  await insertEvent(submissionId, "submitted");
  return { publicCode: submission.public_code, submittedAt: now };
}

function questionForUpload(questionId: string): Question {
  const question = allQuestions.find((item) => item.id === questionId && item.allowFiles);
  if (!question) throw new HttpError(400, "Некорректная загрузка.");
  return question;
}

async function prepareUpload(payload: Payload) {
  const submissionId = stringValue(payload.submissionId);
  await verifyOwner(submissionId, stringValue(payload.editToken, 256), true);
  const questionId = stringValue(payload.questionId, 160);
  const question = questionForUpload(questionId);
  const filename = stringValue(payload.filename, 240);
  const mimeType = stringValue(payload.mimeType, 160);
  const sizeBytes = Number(payload.sizeBytes);
  const validation = validateAttachment({ name: filename, type: mimeType, size: sizeBytes });
  if (!validation.ok) throw new HttpError(400, validation.error);
  const { count, error: countError } = await service.from("attachments").select("id", { count: "exact", head: true }).eq("submission_id", submissionId);
  if (countError) throw new HttpError(500, "Не удалось проверить лимит файлов.");
  if ((count ?? 0) >= MAX_FILES) throw new HttpError(400, "Достигнут лимит 25 файлов.");
  const attachmentId = crypto.randomUUID();
  const path = `submissions/${submissionId}/${attachmentId}.${validation.extension}`;
  const { error: insertError } = await service.from("attachments").insert({
    id: attachmentId,
    submission_id: submissionId,
    section_id: question.sectionId,
    question_id: questionId,
    reference_group_id: stringValue(payload.referenceGroupId, 160) || null,
    storage_path: path,
    original_filename: filename,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    upload_status: "pending",
  });
  if (insertError) throw new HttpError(500, "Не удалось подготовить загрузку.");
  const { data, error } = await service.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) {
    await service.from("attachments").delete().eq("id", attachmentId);
    throw new HttpError(500, "Не удалось подготовить загрузку.");
  }
  return { attachmentId, path, signedToken: data.token };
}

async function pendingAttachment(payload: Payload) {
  const submissionId = stringValue(payload.submissionId);
  await verifyOwner(submissionId, stringValue(payload.editToken, 256), true);
  const attachmentId = stringValue(payload.attachmentId);
  const { data, error } = await service.from("attachments").select("*").eq("id", attachmentId).eq("submission_id", submissionId).maybeSingle();
  if (error || !data) throw new HttpError(404, "Файл не найден.");
  return data as AttachmentRow;
}

async function completeUpload(payload: Payload) {
  const attachment = await pendingAttachment(payload);
  const parts = attachment.storage_path.split("/");
  const filename = parts.pop()!;
  const folder = parts.join("/");
  const { data: objects, error: storageError } = await service.storage.from(BUCKET).list(folder, { search: filename, limit: 1 });
  if (storageError || !objects?.some((item) => item.name === filename)) {
    throw new HttpError(400, "Файл не был загружен.");
  }
  const { error } = await service.from("attachments").update({ upload_status: "ready" }).eq("id", attachment.id);
  if (error) throw new HttpError(500, "Не удалось завершить загрузку.");
  await insertEvent(attachment.submission_id, "file_uploaded", { attachmentId: attachment.id, size: attachment.size_bytes });
  return attachmentView({ ...attachment, upload_status: "ready" });
}

async function cancelUpload(payload: Payload) {
  const attachment = await pendingAttachment(payload);
  await Promise.all([
    service.storage.from(BUCKET).remove([attachment.storage_path]),
    service.from("attachments").delete().eq("id", attachment.id),
  ]);
  return { deleted: true };
}

async function deleteFile(payload: Payload) {
  const attachment = await pendingAttachment(payload);
  const { error: storageError } = await service.storage.from(BUCKET).remove([attachment.storage_path]);
  if (storageError) throw new HttpError(500, "Не удалось удалить файл.");
  const { error } = await service.from("attachments").delete().eq("id", attachment.id);
  if (error) throw new HttpError(500, "Не удалось удалить файл.");
  await insertEvent(attachment.submission_id, "file_deleted", { attachmentId: attachment.id });
  return { deleted: true };
}

async function adminMe(request: Request) {
  const { profile } = await requireAdmin(request);
  return { id: profile.id, email: profile.email, displayName: profile.display_name };
}

async function adminList(request: Request, payload: Payload) {
  await requireAdmin(request);
  const search = stringValue(payload.search, 100).toLowerCase();
  const status = stringValue(payload.status, 20);
  let query = service.from("submissions").select("*").limit(250);
  if (status && status !== "all") query = query.eq("status", status);
  query = stringValue(payload.sort, 20) === "completion"
    ? query.order("completion_percent", { ascending: false })
    : query.order("updated_at", { ascending: false });
  const { data, error } = await query;
  if (error) throw new HttpError(500, "Не удалось загрузить список.");
  const rows = (data ?? []) as SubmissionRow[];
  const ids = rows.map((row) => row.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: files } = await service.from("attachments").select("submission_id").in("submission_id", ids).eq("upload_status", "ready");
    for (const file of files ?? []) counts.set(file.submission_id, (counts.get(file.submission_id) ?? 0) + 1);
  }
  const submissions = rows.map((row) => ({
    ...submissionView(row),
    firstName: null,
    lastName: null,
    role: null,
    contact: null,
    fileCount: counts.get(row.id) ?? 0,
  })).filter((row) => !search || row.publicCode.toLowerCase().includes(search));
  return { submissions };
}

async function adminDetail(request: Request, payload: Payload) {
  await requireAdmin(request);
  const submissionId = stringValue(payload.submissionId);
  const [submissionResult, answersResult, filesResult] = await Promise.all([
    service.from("submissions").select("*").eq("id", submissionId).maybeSingle(),
    service.from("answers").select("section_id,question_id,question_type,value,updated_at").eq("submission_id", submissionId).order("created_at"),
    service.from("attachments").select("*").eq("submission_id", submissionId).eq("upload_status", "ready").order("created_at"),
  ]);
  if (!submissionResult.data) throw new HttpError(404, "Сессия не найдена.");
  if (answersResult.error || filesResult.error) throw new HttpError(500, "Не удалось загрузить сессию.");
  const row = submissionResult.data as SubmissionRow;
  return {
    submission: {
      ...submissionView(row),
      firstName: null,
      lastName: null,
      role: null,
      contact: null,
      comment: null,
      adminNote: row.admin_note,
    },
    answers: (answersResult.data ?? []).map((answer) => ({
      sectionId: answer.section_id,
      questionId: answer.question_id,
      questionType: answer.question_type,
      value: answer.value,
      updatedAt: answer.updated_at,
    })),
    attachments: ((filesResult.data ?? []) as AttachmentRow[]).map(attachmentView),
  };
}

async function adminUpdate(request: Request, payload: Payload) {
  await requireAdmin(request);
  const submissionId = stringValue(payload.submissionId);
  const existing = await findSubmission(submissionId);
  if (!existing) throw new HttpError(404, "Сессия не найдена.");
  const allowed = new Set(["draft", "submitted", "archived"]);
  const requestedStatus = stringValue(payload.status, 20);
  const status = allowed.has(requestedStatus) ? requestedStatus : existing.status;
  const note = typeof payload.adminNote === "string" ? payload.adminNote.slice(0, 8000) : existing.admin_note;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, admin_note: note, updated_at: now };
  if (status === "archived" && existing.status !== "archived") patch.archived_at = now;
  const { error } = await service.from("submissions").update(patch).eq("id", submissionId);
  if (error) throw new HttpError(500, "Не удалось обновить сессию.");
  if (status === "archived" && existing.status !== "archived") await insertEvent(submissionId, "archived");
  return { status, adminNote: note ?? "", updatedAt: now };
}

async function attachmentForAdmin(request: Request, attachmentId: string) {
  await requireAdmin(request);
  const { data, error } = await service.from("attachments").select("*").eq("id", attachmentId).eq("upload_status", "ready").maybeSingle();
  if (error || !data) throw new HttpError(404, "Файл не найден.");
  return data as AttachmentRow;
}

async function adminFileUrl(request: Request, payload: Payload) {
  const attachment = await attachmentForAdmin(request, stringValue(payload.attachmentId));
  const options = payload.download === true ? { download: attachment.original_filename } : undefined;
  const { data, error } = await service.storage.from(BUCKET).createSignedUrl(attachment.storage_path, 120, options);
  if (error) throw new HttpError(500, "Не удалось открыть файл.");
  return { signedUrl: data.signedUrl, filename: attachment.original_filename };
}

async function adminZipFiles(request: Request, payload: Payload) {
  await requireAdmin(request);
  const submissionId = stringValue(payload.submissionId);
  const { data, error } = await service.from("attachments").select("*").eq("submission_id", submissionId).eq("upload_status", "ready").order("created_at");
  if (error) throw new HttpError(500, "Не удалось получить список файлов.");
  const files = [];
  for (const attachment of (data ?? []) as AttachmentRow[]) {
    const signed = await service.storage.from(BUCKET).createSignedUrl(
      attachment.storage_path,
      300,
      { download: attachment.original_filename },
    );
    if (!signed.error) files.push({ signedUrl: signed.data.signedUrl, filename: attachment.original_filename });
  }
  return { files };
}

function dispatch(request: Request, payload: Payload) {
  switch (stringValue(payload.action, 60)) {
    case "start": return start(payload);
    case "get-submission": return getSubmission(payload);
    case "save": return save(payload);
    case "submit": return submit(payload);
    case "prepare-upload": return prepareUpload(payload);
    case "complete-upload": return completeUpload(payload);
    case "cancel-upload": return cancelUpload(payload);
    case "delete-file": return deleteFile(payload);
    case "admin-me": return adminMe(request);
    case "admin-list": return adminList(request, payload);
    case "admin-detail": return adminDetail(request, payload);
    case "admin-update": return adminUpdate(request, payload);
    case "admin-file-url": return adminFileUrl(request, payload);
    case "admin-zip-files": return adminZipFiles(request, payload);
    default: throw new HttpError(404, "Неизвестная операция.");
  }
}

Deno.serve(async (request) => {
  const origin = allowedOrigin(request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (!origin) return json(origin, { error: "Источник запроса не разрешён." }, 403);
  if (request.method !== "POST") return json(origin, { error: "Метод не поддерживается." }, 405);
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !EDIT_TOKEN_SECRET) {
      throw new HttpError(500, "Edge Function не настроена.");
    }
    const payload = await request.json().catch(() => null) as Payload | null;
    if (!payload) throw new HttpError(400, "Некорректный запрос.");
    return json(origin, await dispatch(request, payload));
  } catch (cause) {
    if (cause instanceof HttpError) return json(origin, { error: cause.message }, cause.status);
    console.error(cause);
    return json(origin, { error: "Внутренняя ошибка." }, 500);
  }
});
