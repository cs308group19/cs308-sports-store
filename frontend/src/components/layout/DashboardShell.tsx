import { type ReactNode } from "react";

export function DashboardShell({
  eyebrow,
  title,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="dashboard page">
      <div className="dashboard-head">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}
