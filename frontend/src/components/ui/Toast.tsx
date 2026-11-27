import type { Product } from "../../types/models";
import { Icon } from "./Icon";

export type ToastContent = { message: string } | { added: Product };

export function Toast({ toast, onViewCart }: { toast: ToastContent; onViewCart: () => void }) {
  return (
    <div className="toast" role="status">
      {"added" in toast ? (
        <>
          <img src={toast.added.image} alt="" width="40" height="40" />
          <span>
            Added <b>{toast.added.name}</b> to your cart
          </span>
          <button onClick={onViewCart}>View cart →</button>
        </>
      ) : (
        <>
          <span className="toast-check">
            <Icon name="check" size={15} />
          </span>
          <span>{toast.message}</span>
        </>
      )}
    </div>
  );
}
