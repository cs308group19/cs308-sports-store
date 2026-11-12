import { useState } from "react";
import type { ChatMessage } from "../../types/models";
import { products, orders } from "../../services/mockStore";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { money, attachmentType } from "../../utils/format";

export function SupportDesk({ notify }: { notify: (s: string) => void }) {
  const [claimed, setClaimed] = useState(false);
  const [selectedChat, setSelectedChat] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      sender: "user",
      text: "Hi! Can I change the delivery address for my current order?",
      time: "10:42",
    },
  ]);
  const [message, setMessage] = useState("");
  const send = () => {
    if (!message.trim()) return;
    setMessages([...messages, { id: Date.now(), sender: "agent", text: message, time: "Now" }]);
    setMessage("");
  };
  const attach = (file?: File) => {
    if (!file || !claimed) return;
    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        sender: "agent",
        text: "Attachment sent",
        time: "Now",
        attachment: { name: file.name, type: attachmentType(file) },
      },
    ]);
  };
  const conversations = [
    ["Jamie Taylor", "Order address update", "2m", "member"],
    ["Aylin Demir", "Return eligibility", "6m", "member"],
    ["Omar S.", "Product sizing", "9m", "guest"],
  ];
  return (
    <DashboardShell eyebrow="Customer care" title="Support desk">
      <div className="support-layout">
        <aside className="chat-queue">
          <div className="queue-title">
            <h3>Waiting queue</h3>
            <span>3</span>
          </div>
          {conversations.map((c, i) => (
            <button
              className={i === selectedChat ? "active" : ""}
              key={c[0]}
              onClick={() => setSelectedChat(i)}
            >
              <span className="queue-avatar">{c[0][0]}</span>
              <span>
                <b>{c[0]}</b>
                <small>{c[1]}</small>
              </span>
              <em>{c[2]}</em>
            </button>
          ))}
        </aside>
        <section className="agent-chat">
          <div className="agent-chat-head">
            <div>
              <span className="online-dot"></span>
              <div>
                <b>{conversations[selectedChat][0]}</b>
                <small>
                  {conversations[selectedChat][3] === "guest"
                    ? "Guest"
                    : "Logged-in customer · Order #RLY-81142"}
                </small>
              </div>
            </div>
            {!claimed ? (
              <Button
                onClick={() => {
                  setClaimed(true);
                  notify("Conversation claimed");
                }}
              >
                Claim chat
              </Button>
            ) : (
              <span className="status green">Claimed by you</span>
            )}
          </div>
          <div className="messages">
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
          <div className="agent-compose">
            <button
              aria-label="Attach PDF, image, or video"
              onClick={() => document.getElementById("agent-chat-file")?.click()}
            >
              <Icon name="paperclip" />
            </button>
            <input
              id="agent-chat-file"
              hidden
              type="file"
              accept="application/pdf,image/*,video/*"
              onChange={(e) => attach(e.target.files?.[0])}
            />
            <input
              placeholder={claimed ? "Type a reply..." : "Claim chat to reply"}
              disabled={!claimed}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <Button disabled={!claimed} onClick={send}>
              Send
            </Button>
          </div>
        </section>
        <aside className="customer-panel">
          {conversations[selectedChat][3] === "guest" ? (
            <div className="guest-profile">
              <div className="avatar">G</div>
              <h3>Guest</h3>
              <p>No profile, cart, orders, or wishlist is available.</p>
            </div>
          ) : (
            <>
              <div className="customer-profile">
                <div className="avatar">JT</div>
                <h3>{conversations[selectedChat][0]}</h3>
                <p>jamie.taylor@example.com</p>
                <small>123 Fast Lane, Istanbul</small>
              </div>
              <h4>CURRENT CART</h4>
              <div className="mini-item">
                <img src={products[2].image} alt="" />
                <span>
                  <b>Velocity Knit</b>
                  <small>$99.00 · Qty 1</small>
                </span>
              </div>
              <h4>PREVIOUS ORDERS</h4>
              {orders.slice(0, 2).map((o) => (
                <div className="mini-order" key={o.id}>
                  <span>
                    <b>#{o.id}</b>
                    <small>{o.date}</small>
                  </span>
                  <span className="status green">{o.status}</span>
                </div>
              ))}
              <h4>WISHLIST</h4>
              <div className="mini-item">
                <img src={products[0].image} alt="" />
                <span>
                  <b>{products[0].name}</b>
                  <small>{money(products[0].price)}</small>
                </span>
              </div>
            </>
          )}
        </aside>
      </div>
    </DashboardShell>
  );
}
