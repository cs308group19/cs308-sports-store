import { Button } from "./Button";
import { Icon } from "./Icon";

/** What a page shows when it has nothing to list: a message and the next thing to do. */
export function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      <Button onClick={onAction}>{action}</Button>
    </div>
  );
}
