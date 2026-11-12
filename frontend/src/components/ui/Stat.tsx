export function Stat({
  label,
  value,
  change,
  warning,
}: {
  label: string;
  value: string;
  change: string;
  warning?: boolean;
}) {
  return (
    <article className="stat-card">
      <small>{label}</small>
      <b>{value}</b>
      <span className={warning ? "warning" : ""}>{change}</span>
    </article>
  );
}
