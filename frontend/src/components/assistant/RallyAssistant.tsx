import { useEffect, useRef, useState } from "react";
import { REDUCED_MOTION, useMediaQuery } from "../../hooks/useMediaQuery";
import { AssistantError, fetchContact, sendChat, type Contact } from "../../services/assistantApi";
import type { Product } from "../../types/models";
import {
  addEntry,
  chatFor,
  contactMessage,
  DEFAULT_CONTACT,
  emptyChat,
  failureMessage,
  greeting,
  loadChat,
  MAX_MESSAGE_LENGTH,
  saveChat,
  SUGGESTIONS,
  toHistory,
  trimMessage,
} from "./rallyChat";
import { BubbleMark, HeaderMark } from "./RallyMarks";
import { RallyMessages } from "./RallyMessages";

/** The panel fills the screen below this width (see global.css). */
const PHONE = "(max-width: 479.98px)";
const storage = () => window.sessionStorage;

/**
 * SCRUM-113. Rally, the shopping assistant: a glass bubble that grows into a chat panel. The
 * conversation is kept in this tab (sessionStorage) and sent to the backend with every message.
 */
export function RallyAssistant({
  userId,
  name,
  openProduct,
}: {
  /** The signed-in account, or null for a guest. */
  userId: string | null;
  /** The signed-in customer's first name, for the greeting. */
  name?: string;
  openProduct: (product: Product) => void;
}) {
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState(() => chatFor(loadChat(storage), userId));
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const phone = useMediaQuery(PHONE);
  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const bubble = useRef<HTMLButtonElement>(null);
  /** The message being answered. Aborting it makes the answer be ignored. */
  const pending = useRef<AbortController | null>(null);
  const owner = useRef(userId);
  const returnToBubble = useRef(false);
  const returnToInput = useRef(false);

  const forgetPending = () => {
    pending.current?.abort();
    pending.current = null;
    setWaiting(false);
  };

  useEffect(() => {
    // Signing out or switching accounts drops the answer on its way and starts a new chat.
    if (owner.current !== null && owner.current !== userId) forgetPending();
    owner.current = userId;
    setChat((current) => chatFor(current, userId));
  }, [userId]);

  useEffect(() => saveChat(storage, chat), [chat]);

  // Leaving the shop (for a staff page) abandons the answer on its way.
  useEffect(() => () => pending.current?.abort(), []);

  useEffect(() => {
    if (open) {
      // On a phone, focusing the input would cover half of the chat with the keyboard.
      const target = phone || input.current?.disabled ? panel.current : input.current;
      target?.focus({ preventScroll: true });
    } else if (returnToBubble.current) {
      returnToBubble.current = false;
      bubble.current?.focus({ preventScroll: true });
    }
    // Only opening and closing move the focus, not a change of screen size.
  }, [open]);

  // The input is disabled while waiting; give it the focus back afterwards.
  useEffect(() => {
    if (waiting || !returnToInput.current) return;
    returnToInput.current = false;
    const focused = document.activeElement;
    if (focused === panel.current || focused === document.body) {
      input.current?.focus({ preventScroll: true });
    }
  }, [waiting]);

  const close = () => {
    returnToBubble.current = true;
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Escape belongs to the chat only when the focus is in it (or nowhere), so another
      // dialog, such as the photo zoom, keeps its own.
      const focused = document.activeElement;
      if (focused === document.body || panel.current?.contains(focused)) close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  /** The backend's contact details, or the last known ones when it cannot be reached. */
  const currentContact = async (): Promise<Contact> => {
    try {
      const contact = await fetchContact();
      setChat((current) => ({ ...current, contact }));
      return contact;
    } catch {
      return chat.contact ?? DEFAULT_CONTACT;
    }
  };

  const send = async (text: string) => {
    const content = trimMessage(text);
    if (!content || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;

    returnToInput.current = !phone || document.activeElement === input.current;
    // Disabled controls lose the focus; keep it in the chat so Escape still works.
    panel.current?.focus({ preventScroll: true });

    const asked = addEntry(chat, { role: "user", text: content });
    setChat(asked);
    setDraft("");
    setWaiting(true);
    try {
      const answer = await sendChat(toHistory(asked.entries), { signal: controller.signal });
      if (controller.signal.aborted) return;
      setChat((current) => ({
        ...addEntry(current, {
          role: "assistant",
          text: answer.reply,
          ...(answer.products.length ? { products: answer.products } : {}),
        }),
        ...(answer.contact ? { contact: answer.contact } : {}),
      }));
    } catch (error) {
      const failure = error instanceof AssistantError ? error : new AssistantError("offline");
      const contact =
        failure.contact ??
        (failure.kind === "offline" ? await currentContact() : (chat.contact ?? DEFAULT_CONTACT));
      if (controller.signal.aborted) return;
      setChat((current) => ({
        ...addEntry(current, {
          role: "assistant",
          text: failureMessage(failure.kind, contact),
          notice: true,
        }),
        ...(failure.contact ? { contact: failure.contact } : {}),
      }));
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setWaiting(false);
      }
    }
  };

  /** Shows the phone number and email. No AI involved. */
  const talkToPerson = async () => {
    const contact = await currentContact();
    setChat((current) => addEntry(current, { role: "assistant", text: contactMessage(contact) }));
  };

  const newChat = () => {
    forgetPending();
    setChat((current) => ({ ...emptyChat(userId), contact: current.contact }));
    setDraft("");
    input.current?.focus({ preventScroll: true });
    // Still disabled if an answer was on its way; focus it once it is enabled again.
    returnToInput.current = input.current?.disabled ?? false;
    if (returnToInput.current) panel.current?.focus({ preventScroll: true });
  };

  const viewProduct = (product: Product) => {
    // The panel covers the whole screen on a phone, so it makes way for the product page.
    if (phone) setOpen(false);
    openProduct(product);
  };

  const askedSomething = chat.entries.some((entry) => entry.role === "user");

  return (
    <div className={`rally${open ? " is-open" : ""}`}>
      {open ? (
        <div
          className="rally-inner"
          id="rally-panel"
          role="dialog"
          aria-label="Rally shopping assistant"
          tabIndex={-1}
          ref={panel}
        >
          <div className="rally-head">
            <HeaderMark />
            <div className="rally-title">
              <span>RALLY</span>
              <small>● online · replies instantly</small>
            </div>
            <button type="button" className="rally-human" onClick={() => void talkToPerson()}>
              Talk to a person
            </button>
            <button type="button" className="rally-close" aria-label="Close chat" onClick={close}>
              ×
            </button>
          </div>
          <RallyMessages
            hello={greeting(name)}
            entries={chat.entries}
            typing={waiting}
            openProduct={viewProduct}
          />
          {!askedSomething && (
            <div className="rally-chips">
              {SUGGESTIONS.map((suggestion) => (
                <button type="button" key={suggestion} onClick={() => void send(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          {chat.entries.length > 0 && (
            <button type="button" className="rally-new" onClick={newChat}>
              New chat
            </button>
          )}
          <form
            className="rally-compose"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <input
              ref={input}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter while an input method is composing picks a character; it must not send.
                if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault();
              }}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="Ask Rally anything…"
              aria-label="Message Rally"
              autoComplete="off"
              enterKeyHint="send"
              disabled={waiting}
            />
            <button type="submit" aria-label="Send" disabled={waiting}>
              ↑
            </button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          className="rally-bubble"
          aria-label="Chat with Rally"
          aria-haspopup="dialog"
          ref={bubble}
          onClick={() => setOpen(true)}
        >
          <BubbleMark ball={!reducedMotion} />
        </button>
      )}
    </div>
  );
}
