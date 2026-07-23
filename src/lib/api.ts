import { ATTACHMENTS_BUCKET, supabase } from "./supabase";

type JsonObject = Record<string, unknown>;

async function invoke<T>(action: string, payload: JsonObject = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("brief-api", {
    body: { action, ...payload },
  });
  if (error) {
    const context = error.context as Response | undefined;
    const details = await context?.json().catch(() => null) as { error?: string } | null;
    throw new Error(details?.error ?? error.message ?? "Не удалось выполнить запрос.");
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export const publicApi = {
  start: () => invoke<{ id: string; token: string; publicCode: string }>("start", { website: "" }),
  getSubmission: (id: string, editToken: string) =>
    invoke<{ submission: Record<string, unknown>; answers: Record<string, unknown>; attachments: unknown[] }>(
      "get-submission",
      { submissionId: id, editToken },
    ),
  save: (submissionId: string, editToken: string, answers: Record<string, unknown>, currentSection: number) =>
    invoke<{ savedAt: string; completionPercent: number }>("save", {
      submissionId,
      editToken,
      answers,
      currentSection,
      currentQuestion: 0,
    }),
  submit: (submissionId: string, editToken: string) =>
    invoke<{ publicCode: string; submittedAt: string }>("submit", {
      submissionId,
      editToken,
      confirmed: true,
    }),
  async upload(
    submissionId: string,
    editToken: string,
    questionId: string,
    referenceGroupId: string,
    file: File,
  ) {
    const prepared = await invoke<{
      attachmentId: string;
      path: string;
      signedToken: string;
    }>("prepare-upload", {
      submissionId,
      editToken,
      questionId,
      referenceGroupId,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .uploadToSignedUrl(prepared.path, prepared.signedToken, file, {
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) {
      await invoke("cancel-upload", {
        submissionId,
        editToken,
        attachmentId: prepared.attachmentId,
      }).catch(() => undefined);
      throw new Error(uploadError.message);
    }
    return invoke<{
      id: string;
      questionId: string;
      referenceGroupId: string;
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
    }>("complete-upload", {
      submissionId,
      editToken,
      attachmentId: prepared.attachmentId,
    });
  },
  deleteFile: (submissionId: string, editToken: string, attachmentId: string) =>
    invoke<{ deleted: true }>("delete-file", { submissionId, editToken, attachmentId }),
};

export const adminApi = {
  me: () => invoke<{ id: string; email: string; displayName: string | null }>("admin-me"),
  list: (search: string, status: string, sort: string) =>
    invoke<{ submissions: unknown[] }>("admin-list", { search, status, sort }),
  detail: (submissionId: string) =>
    invoke<{ submission: Record<string, unknown>; answers: unknown[]; attachments: unknown[] }>(
      "admin-detail",
      { submissionId },
    ),
  update: (submissionId: string, patch: { status?: string; adminNote?: string }) =>
    invoke<{ status: string; adminNote: string; updatedAt: string }>("admin-update", {
      submissionId,
      ...patch,
    }),
  fileUrl: (attachmentId: string, download = false) =>
    invoke<{ signedUrl: string; filename: string }>("admin-file-url", { attachmentId, download }),
  zipFiles: (submissionId: string) =>
    invoke<{ files: Array<{ signedUrl: string; filename: string }> }>("admin-zip-files", { submissionId }),
};
