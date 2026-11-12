import { DashboardShell } from "../../components/layout/DashboardShell";
import { Button } from "../../components/ui/Button";
import { Stat } from "../../components/ui/Stat";

export function Analytics() {
  const bars = [38, 52, 47, 70, 64, 82, 78, 94, 87, 105, 99, 121];
  return (
    <DashboardShell
      eyebrow="Sales performance"
      title="Revenue overview"
      actions={<span className="status green">Range applied</span>}
    >
      <div className="filters">
        <label>
          From
          <input type="date" defaultValue="2024-06-01" />
        </label>
        <label>
          To
          <input type="date" defaultValue="2025-05-31" />
        </label>
        <Button variant="dark">Update charts</Button>
      </div>
      <div className="stats-row">
        <Stat label="Gross revenue" value="$184.2k" change="+12.4% vs last period" />
        <Stat label="Net profit" value="$48.7k" change="+8.1% vs last period" />
        <Stat label="Average order" value="$116.40" change="+4.6% vs last period" />
        <Stat label="Refund rate" value="2.1%" change="-0.4% vs last period" />
      </div>
      <div className="analytics-grid">
        <article className="chart-card">
          <div className="chart-head">
            <div>
              <small>REVENUE</small>
              <h3>$184,240</h3>
            </div>
            <span className="status green">+12.4%</span>
          </div>
          <div className="bar-chart">
            {bars.map((h, i) => (
              <div key={i}>
                <span style={{ height: `${h}px` }}></span>
                <small>{["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][i]}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="chart-card">
          <small>PROFIT / LOSS</small>
          <h3>$48,720</h3>
          <div className="donut">
            <div>
              <b>26.4%</b>
              <small>margin</small>
            </div>
          </div>
          <div className="legend">
            <span>
              <i className="navy"></i>Revenue <b>$184k</b>
            </span>
            <span>
              <i className="orange-bg"></i>Cost <b>$135k</b>
            </span>
          </div>
        </article>
      </div>
    </DashboardShell>
  );
}
