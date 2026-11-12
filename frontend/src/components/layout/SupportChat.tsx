import { useState } from "react";
import type { ChatMessage } from "../../types/models";
import { Icon } from "../ui/Icon";
import { attachmentType } from "../../utils/format";

export function SupportChat({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, sender: "agent", text: "Hi! I’m RALLY support. How can we help today?", time: "Now" },
  ]);
  const [message, setMessage] = useState("");
  const send = () => {
    if (!message.trim()) return;
    setMessages([...messages, { id: Date.now(), sender: "user", text: message, time: "Now" }]);
    setMessage("");
  };
  const attach = (file?: File) => {
    if (!file) return;
    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        sender: "user",
        text: "Attachment uploaded",
        time: "Now",
        attachment: { name: file.name, type: attachmentType(file) },
      },
    ]);
  };
  return (
    <>
      <button
        className={`chat-fab ${open ? "open" : ""}`}
        aria-label="Live support chat"
        onClick={() => setOpen(!open)}
      >
        {open ? <Icon name="close" /> : <Icon name="chat" />}
        <span>{open ? "Close" : "Live support"}</span>
      </button>
      {open && (
        <section className="support-widget">
          <div className="widget-head">
            <div>
              <span className="online-dot"></span>
              <div>
                <b>RALLY Support</b>
                <small>Typically replies instantly</small>
              </div>
            </div>
            <button onClick={() => setOpen(false)}>
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="widget-messages">
            {messages.map((m) => (
              <div className={`message ${m.sender}`} key={m.id}>
                <p>{m.text}</p>
                {m.attachment && (
                  <span className="attachment-chip">
                    <Icon name="paperclip" size={14} />
                    {m.attachment.type}: {m.attachment.name}
                  </span>
                )}
                <small>{m.time}</small>
              </div>
            ))}
          </div>
          <div className="widget-compose">
            <button
              aria-label="Attach file"
              onClick={() => document.getElementById("chat-file")?.click()}
            >
              <Icon name="paperclip" />
            </button>
            <input
              id="chat-file"
              hidden
              type="file"
              accept="application/pdf,image/*,video/*"
              onChange={(e) => attach(e.target.files?.[0])}
            />
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type your message..."
            />
            <button onClick={send}>
              <Icon name="arrow" />
            </button>
          </div>
          <small className="guest-note">Guest chat is enabled — no login required</small>
        </section>
      )}
    </>
  );
}
