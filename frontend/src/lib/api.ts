import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(". ");
    if (body.message) return body.message;
  } catch {
    // The body was not JSON; fall through to the generic message.
  }
  return `Request failed (${response.status})`;
}

/** The file name in a Content-Disposition header, or null when there is none. */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted) return quoted[1];
  const plain = /filename=([^;]+)/i.exec(header);
  return plain ? plain[1].trim() : null;
}

/**
 * Downloads a file from the backend (for example an invoice PDF) with the signed-in user's access
 * token. apiFetch cannot do this: it always reads the answer as JSON.
 */
export async function apiFetchFile(path: string): Promise<{ blob: Blob; filename: string | null }> {
  const headers: Record<string, string> = {};
  const { data } = await supabase.auth.getSession();
  if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { headers });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Please try again in a moment.");
  }

  if (!response.ok) throw new ApiError(response.status, await errorMessage(response));
  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(response.headers.get("Content-Disposition")),
  };
}

/** Calls the backend. Sends the signed-in user's access token unless `auth` is false. */
export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean; headers?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.auth !== false) {
    const { data } = await supabase.auth.getSession();
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Please try again in a moment.");
  }

  if (!response.ok) throw new ApiError(response.status, await errorMessage(response));
  return (await response.json()) as T;
}
