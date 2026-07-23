export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_FILES = 25;
export const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "svg", "pdf", "mp4", "mov", "ppt", "pptx",
]);
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
  "application/pdf", "video/mp4", "video/quicktime",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export function extensionOf(name: string) {
  const part = name.split(".").pop()?.toLowerCase() ?? "";
  return part.replace(/[^a-z0-9]/g, "");
}

export function validateAttachment(file: { name: string; type: string; size: number }) {
  const extension = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(file.type)) {
    return { ok: false as const, error: "Недопустимый тип файла." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false as const, error: "Файл больше 50 МБ." };
  }
  return { ok: true as const, extension };
}

export function publicCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `TBD-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function tokenHash(token: string, secret = "") {
  const bytes = new TextEncoder().encode(`${token}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
