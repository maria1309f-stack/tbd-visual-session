import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { allQuestions, briefSections, isAnswered, isQuestionVisible } from "../src/content/brief-config.ts";
import { allQuestions as edgeQuestions } from "../supabase/functions/_shared/brief-config.ts";
import {
  MAX_FILE_SIZE, publicCode, randomToken, tokenHash, validateAttachment,
} from "../src/lib/validation.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("создание анкеты генерирует непрозрачный token и публичный код", () => {
  const token = randomToken();
  assert.equal(token.length, 64);
  assert.match(publicCode(), /^TBD-[A-HJ-NP-Z2-9]{8}$/);
});

test("edit token хранится как hash и неверный token не совпадает", async () => {
  const token = randomToken();
  const hash = await tokenHash(token, "secret");
  assert.notEqual(hash, token);
  assert.equal(hash, await tokenHash(token, "secret"));
  assert.notEqual(hash, await tokenHash(`${token}x`, "secret"));
});

test("конфигурация анкеты одинакова в интерфейсе и Edge Function", () => {
  assert.deepEqual(
    edgeQuestions.map(({ id, sectionId, type, required }) => ({ id, sectionId, type, required })),
    allQuestions.map(({ id, sectionId, type, required }) => ({ id, sectionId, type, required })),
  );
  assert.equal(briefSections.at(-1)?.id, "review");
});

test("условная логика и необязательные вопросы сохраняются", () => {
  const conditional = allQuestions.find((question) => question.id === "logo-symbol-role");
  assert.ok(conditional);
  assert.equal(isQuestionVisible(conditional, { "logo-symbol-need": "достаточно текстового логотипа" }), false);
  assert.equal(isQuestionVisible(conditional, { "logo-symbol-need": "нужен дополнительный символ" }), true);
  assert.equal(allQuestions.every((question) => !question.required), true);
  assert.ok(allQuestions.length > 70);
  assert.equal(isAnswered([]), false);
  assert.equal(isAnswered(["Точный"]), true);
});

test("допустимые и запрещённые файлы проверяются", () => {
  assert.deepEqual(
    validateAttachment({ name: "reference.webp", type: "image/webp", size: 1024 }),
    { ok: true, extension: "webp" },
  );
  assert.equal(validateAttachment({ name: "payload.exe", type: "application/octet-stream", size: 10 }).ok, false);
  assert.equal(validateAttachment({ name: "video.mp4", type: "video/mp4", size: MAX_FILE_SIZE + 1 }).ok, false);
});

test("анонимный старт и восстановление проходят через Edge Function", async () => {
  const edge = await read("../supabase/functions/brief-api/index.ts");
  const session = await read("../src/components/SessionApp.tsx");
  assert.match(edge, /case "start"/);
  assert.match(edge, /edit_token_hash/);
  assert.doesNotMatch(edge, /respondent_first_name/);
  assert.match(session, /publicApi\.getSubmission/);
  assert.doesNotMatch(session, /localStorage\.setItem\([^,]+,\s*JSON\.stringify\(answers\)/);
});

test("публичный клиент не содержит service role key", async () => {
  const api = await read("../src/lib/api.ts");
  const client = await read("../src/lib/supabase.ts");
  assert.doesNotMatch(api + client, /SERVICE_ROLE|service_role/i);
  assert.match(client, /VITE_SUPABASE_ANON_KEY/);
});

test("административные операции требуют Supabase Auth и admin_profiles", async () => {
  const edge = await read("../supabase/functions/brief-api/index.ts");
  assert.match(edge, /auth\.getUser/);
  assert.match(edge, /admin_profiles/);
  assert.match(edge, /Нет прав администратора/);
});

test("SQL включает RLS, приватный bucket и назначение администратора", async () => {
  const sql = await read("../supabase/initial-setup.sql");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /'brief-attachments'/);
  assert.match(sql, /false,\s*52428800/);
  assert.match(sql, /grant_admin/);
  assert.match(sql, /create policy "Admins can read brief attachments"/);
});

test("переносимая версия не зависит от OpenAI Sites, D1 или FILES", async () => {
  const files = await Promise.all([
    read("../package.json"),
    read("../src/lib/api.ts"),
    read("../supabase/functions/brief-api/index.ts"),
  ]);
  const source = files.join("\n");
  assert.doesNotMatch(source, /cloudflare:workers|runtime\(\)\.DB|runtime\(\)\.FILES|chatgpt-team\.site|openai\/hosting/i);
});
