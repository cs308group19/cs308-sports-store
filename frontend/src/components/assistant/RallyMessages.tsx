import { useEffect, useRef } from "react";
import type { Product } from "../../types/models";
import { type ChatEntry, toCard } from "./rallyChat";
import { RallyProductCard } from "./RallyProductCard";

function Message({
  entry,
  openProduct,
}: {
  entry: Pick<ChatEntry, "role" | "text" | "products">;
  openProduct: (product: Product) => void;
}) {
  const mine = entry.role === "user";
  return (
    <div className={`rally-row${mine ? " is-mine" : ""}`}>
      <div className="rally-message">
        <span className="sr-only">{mine ? "You: " : "Rally: "}</span>
        {entry.text}
        {entry.products && (
          <div className="rally-cards">
            {entry.products.map((item) => {
              const card = toCard(item);
              return (
                <RallyProductCard key={card.id} card={card} onOpen={() => openProduct(card.product)} />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** The conversation. New messages are read out by screen readers (role="log"). */
export function RallyMessages({
  hello,
  entries,
  typing,
  openProduct,
}: {
  hello: string;
  entries: ChatEntry[];
  typing: boolean;
  openProduct: (product: Product) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const newest = entries.at(-1)?.id;

  // Show the newest message: its end, or its beginning when it is taller than the list.
  useEffect(() => {
    const box = list.current;
    if (!box) return;
    const end = box.scrollHeight - box.clientHeight;
    const last = box.lastElementChild as HTMLElement | null;
    box.scrollTop = last ? Math.min(end, last.offsetTop - 12) : end;
  }, [newest, typing]);

  return (
    <div className="rally-messages" ref={list} role="log" aria-live="polite">
      <Message entry={{ role: "assistant", text: hello }} openProduct={openProduct} />
      {entries.map((entry) => (
        <Message key={entry.id} entry={entry} openProduct={openProduct} />
      ))}
      {typing && (
        <div className="rally-row">
          <div className="rally-typing">
            <span className="sr-only">Rally is typing</span>
            <i />
            <i />
            <i />
          </div>
        </div>
      )}
    </div>
  );
}
