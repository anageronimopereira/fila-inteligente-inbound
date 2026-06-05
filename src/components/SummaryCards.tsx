import { CSSProperties } from "react";

import type { DashboardMetrics } from "../types";

export function SummaryCards({ metrics }: { metrics: DashboardMetrics }): JSX.Element {
  return (
    <div style={styles.grid}>
      <Card label="Projetos" value={metrics.totalProjects} accent="#0f766e" />
      <Card label="Críticos" value={metrics.criticalProjects} accent="#be123c" />
      <Card label="Alta Prioridade" value={metrics.highPriorityProjects} accent="#c2410c" />
      <Card label="Mensalidade Vencida" value={metrics.overdueSubscriptions} accent="#7c2d12" />
      <Card label="Sem Follow Registrado" value={metrics.noFollowUpRecorded} accent="#475569" />
      <Card label="Sem Follow 7+ Dias" value={metrics.staleFollowUp7d} accent="#a16207" />
      <Card label="Sem Follow 15+ Dias" value={metrics.staleFollowUp15d} accent="#be123c" />
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: number; accent: string }): JSX.Element {
  return (
    <article style={{ ...styles.card, boxShadow: `inset 0 4px 0 ${accent}, 0 18px 36px rgba(83, 40, 125, 0.08)` }}>
      <span style={styles.label}>{label}</span>
      <strong style={{ ...styles.value, color: accent }}>{value}</strong>
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },
  card: {
    background: "linear-gradient(180deg, #ffffff 0%, #faf7ff 100%)",
    borderRadius: "22px",
    padding: "22px",
    border: "1px solid rgba(106, 63, 150, 0.12)",
  },
  label: {
    display: "block",
    color: "#6b7280",
    fontSize: "12px",
    marginBottom: "12px",
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  value: {
    fontSize: "34px",
    lineHeight: 1,
    color: "#0f172a",
  },
};
