import { supabase } from "../lib/supabase";
import type { Product } from "../types/models";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

/** Longer than the backend's 30 seconds for a reply, so the backend's answer arrives first. */
export const CHAT_TIMEOUT_MS = 35_000;
export const CONTACT_TIMEOUT_MS = 4_000;

/** One message as POST /api/assistant/chat takes it. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** How to reach a person (backend/src/assistant/assistant.types.ts). */
export interface Contact {
  phone: string;
  email: string;
  hours: string;
}

export interface AssistantProduct {
  id: Product["id"];
  name: string;
  brand: string | null;
  price: number;
  oldPrice?: number;
  stock: number;
  /** The uploaded photo, or null: the catalogue photo of `model` is shown then. */
  image: string | null;
  model: string;
}

export interface ChatReply {
  reply: string;
  products: AssistantProduct[];
  contact?: Contact;
}

/** "offline": Rally cannot answer. "busy": too many messages. "invalid": the message was refused. */
export type AssistantFailure = "offline" | "busy" | "invalid";

export class AssistantError extends Error {
  readonly kind: AssistantFailure;
  /** Sent along by the backend when Rally is offline. */
  readonly contact?: Contact;

  constructor(kind: AssistantFailure, contact?: Contact) {
    super(`Rally request failed: ${kind}`);
    this.name = "AssistantError";
    this.kind = kind;
    this.contact = contact;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isContact(value: unknown): value is Contact {
  return (
    isRecord(value) &&
    [value.phone, value.email, value.hours].every((field) => typeof field === "string")
  );
}

export function isAssistantProduct(value: unknown): value is AssistantProduct {
  return (
    isRecord(value) &&
    (typeof value.id === "number" || typeof value.id === "string") &&
    typeof value.name === "string" &&
    typeof value.model === "string" &&
    typeof value.price === "number" &&
    typeof value.stock === "number" &&
    (value.oldPrice === undefined || typeof value.oldPrice === "number") &&
    (value.image === null || typeof value.image === "string")
  );
}

/** Fetches JSON, giving up after `timeoutMs` or when the caller's signal aborts. */
async function request(
  path: string,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort);
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal });
    const body: unknown = await response.json().catch(() => null);
    return { status: response.status, body };
  } catch {
    throw new AssistantError("offline");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

/** The signed-in user's token, if any. Without one Rally answers as to a guest. */
async function authorization(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
  } catch {
    return {};
  }
}

/** SCRUM-113. Sends the conversation and returns Rally's answer, or throws an AssistantError. */
export async function sendChat(
  messages: ChatTurn[],
  options: { signal?: AbortSignal } = {},
): Promise<ChatReply> {
  const { status, body } = await request(
    "/assistant/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authorization()) },
      body: JSON.stringify({ messages }),
    },
    CHAT_TIMEOUT_MS,
    options.signal,
  );

  if (status === 429) throw new AssistantError("busy");
  if (status === 400 || status === 413) throw new AssistantError("invalid");
  if (status !== 200 || !isRecord(body) || typeof body.reply !== "string") {
    const contact = isRecord(body) && isContact(body.contact) ? body.contact : undefined;
    throw new AssistantError("offline", contact);
  }
  return {
    reply: body.reply,
    products: Array.isArray(body.products) ? body.products.filter(isAssistantProduct) : [],
    ...(isContact(body.contact) ? { contact: body.contact } : {}),
  };
}

/** Phone, email and opening hours for "Talk to a person". */
export async function fetchContact(): Promise<Contact> {
  const { status, body } = await request(
    "/assistant/contact",
    { method: "GET" },
    CONTACT_TIMEOUT_MS,
  );
  if (status !== 200 || !isContact(body)) throw new AssistantError("offline");
  return body;
}
