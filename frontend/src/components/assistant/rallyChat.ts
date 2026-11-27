/** The chat's logic without React: messages, what is sent, what is saved and what cards show. */
import {
  type AssistantFailure,
  type AssistantProduct,
  type ChatTurn,
  type Contact,
  isAssistantProduct,
  isContact,
} from "../../services/assistantApi";
import { cataloguePhoto } from "../../services/cataloguePhoto";
import type { Product } from "../../types/models";
import { shortMoney } from "../../utils/format";
import { productStub } from "../../utils/productStub";

/** The backend's limits (backend/src/assistant/assistant.dto.ts). */
export const MAX_HISTORY = 20;
export const MAX_MESSAGE_LENGTH = 2000;
/** Messages kept on screen and in sessionStorage. */
export const MAX_SAVED = 60;
export const STORAGE_KEY = "rally.assistant";

export const SUGGESTIONS = [
  "Where's my order?",
  "Shoes for running on asphalt?",
  "I want to return something",
] as const;

/** Used only when the backend cannot be reached and has never sent its own details. */
export const DEFAULT_CONTACT: Contact = {
  phone: "+90 000 000 00 00",
  email: "support@rally.store",
  hours: "weekdays 09:00–18:00",
};

export interface ChatEntry {
  id: number;
  role: ChatTurn["role"];
  text: string;
  products?: AssistantProduct[];
  /** A note from the widget itself ("offline", "slow down"): shown, never sent to Rally. */
  notice?: boolean;
}

export interface ChatState {
  /** The account the conversation belongs to, null for a guest. */
  owner: string | null;
  entries: ChatEntry[];
  /** The contact details last received from the backend. */
  contact?: Contact;
}

export function emptyChat(owner: string | null = null): ChatState {
  return { owner, entries: [] };
}

export function addEntry(chat: ChatState, entry: Omit<ChatEntry, "id">): ChatState {
  const id = (chat.entries.at(-1)?.id ?? 0) + 1;
  return { ...chat, entries: [...chat.entries, { ...entry, id }].slice(-MAX_SAVED) };
}

/**
 * The conversation to show to this account. A guest who signs in keeps the chat; after signing out
 * or switching accounts it starts over, so nobody reads another customer's orders.
 */
export function chatFor(chat: ChatState, userId: string | null): ChatState {
  if (chat.owner === userId) return chat;
  if (chat.owner === null) return { ...chat, owner: userId };
  return emptyChat(userId);
}

export function greeting(firstName?: string): string {
  const hey = firstName ? `Hey ${firstName}!` : "Hey!";
  return `${hey} I'm Rally.\nI can find gear, check your orders, or sort out a return. What are you playing these days?`;
}

export function firstName(fullName: string): string | undefined {
  return fullName.trim().split(/\s+/)[0] || undefined;
}

export function trimMessage(text: string): string {
  return text.trim().slice(0, MAX_MESSAGE_LENGTH).trim();
}

/** The messages sent to the backend: the newest 20, trimmed, ending with the user's. */
export function toHistory(entries: readonly ChatEntry[]): ChatTurn[] {
  const turns = entries
    .filter((entry) => !entry.notice)
    .map((entry) => ({ role: entry.role, content: trimMessage(entry.text) }))
    .filter((turn) => turn.content !== "");
  while (turns.length > 0 && turns[turns.length - 1].role !== "user") turns.pop();
  return turns.slice(-MAX_HISTORY);
}

export function contactMessage({ phone, email, hours }: Contact): string {
  return `Of course. You can reach a person from our team here:\nPhone: ${phone} (${hours})\nEmail: ${email}\nMention your order number and they'll pick it up right away.`;
}

export function offlineMessage({ phone, email, hours }: Contact): string {
  return `Rally is offline right now. Our team can still help:\nPhone: ${phone} (${hours})\nEmail: ${email}`;
}

/** What the chat says when a message could not be answered. */
export function failureMessage(kind: AssistantFailure, contact: Contact): string {
  if (kind === "busy") return "Quick feet! That's a lot of messages. Give me a minute, then ask again.";
  if (kind === "invalid") return "I couldn't read that one. Try a shorter message, or start a new chat.";
  return offlineMessage(contact);
}

export function serializeChat(chat: ChatState): string {
  return JSON.stringify({ ...chat, entries: chat.entries.slice(-MAX_SAVED) });
}

function parseEntry(value: unknown): ChatEntry | null {
  const entry = value as Partial<ChatEntry> | null;
  if (
    !entry ||
    typeof entry.id !== "number" ||
    (entry.role !== "user" && entry.role !== "assistant") ||
    typeof entry.text !== "string"
  ) {
    return null;
  }
  const products = Array.isArray(entry.products) ? entry.products.filter(isAssistantProduct) : [];
  return {
    id: entry.id,
    role: entry.role,
    text: entry.text,
    ...(products.length ? { products } : {}),
    ...(entry.notice === true ? { notice: true } : {}),
  };
}

/** Reads a saved chat. Anything missing or damaged is dropped. */
export function parseChat(raw: string | null): ChatState {
  if (!raw) return emptyChat();
  try {
    const saved = JSON.parse(raw) as Partial<ChatState> | null;
    if (!saved || !Array.isArray(saved.entries)) return emptyChat();
    return {
      owner: typeof saved.owner === "string" ? saved.owner : null,
      entries: saved.entries
        .map(parseEntry)
        .filter((entry): entry is ChatEntry => entry !== null)
        .slice(-MAX_SAVED),
      ...(isContact(saved.contact) ? { contact: saved.contact } : {}),
    };
  } catch {
    return emptyChat();
  }
}

type ChatStorage = Pick<Storage, "getItem" | "setItem">;

/** `storage` is a function because reading window.sessionStorage itself can throw. */
export function loadChat(storage: () => ChatStorage): ChatState {
  try {
    return parseChat(storage().getItem(STORAGE_KEY));
  } catch {
    return emptyChat();
  }
}

export function saveChat(storage: () => ChatStorage, chat: ChatState): void {
  try {
    storage().setItem(STORAGE_KEY, serializeChat(chat));
  } catch {
    // Storage is full or blocked: the chat then lasts until the page is closed.
  }
}

export interface RallyCard {
  id: Product["id"];
  name: string;
  /** The price and stock line. */
  meta: string;
  image: string;
  /** What openProduct needs; the product page loads the rest by id. */
  product: Product;
}

export function priceLine({ price, oldPrice, stock }: AssistantProduct): string {
  if (stock <= 0) return `${shortMoney(price)} · Out of stock`;
  if (oldPrice !== undefined && oldPrice > price) {
    return `${shortMoney(price)} · was ${shortMoney(oldPrice)}`;
  }
  return `${shortMoney(price)} · ${stock} in stock`;
}

export function toCard(item: AssistantProduct): RallyCard {
  const image = item.image?.trim() || cataloguePhoto(item.model);
  return {
    id: item.id,
    name: item.name,
    meta: priceLine(item),
    image,
    product: productStub({
      id: item.id,
      name: item.name,
      price: item.price,
      image,
      model: item.model,
    }),
  };
}
