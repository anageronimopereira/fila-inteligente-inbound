import { CSSProperties } from "react";

import type { CoordinatorGuide, CoordinatorInsights } from "../types";
import { getPriorityColors } from "../utils/riskScore";

export function CoordinatorPanel({ insights }: { insights: CoordinatorInsights }): JSX.Element {
  return (
    <section style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Plano da coordenadora</p>
          <h2 style={styles.title}>Como cada implanter deve priorizar a semana</h2>
        </div>
        <div style={styles.notice}>
          Direcionamento operacional para atacar receita, atraso, follow-up estagnado e travas de ativação sem dispersar a carteira.
        </div>
      </div>

      <div style={styles.summaryList}>
        {insights.summary.map((item) => (
          <div key={item} style={styles.summaryItem}>
            {item}
          </div>
        ))}
      </div>

      <div style={styles.guideList}>
        {insights.guides.map((guide) => (
          <CoordinatorGuideCard key={guide.implanter} guide={guide} />
        ))}
      </div>
    </section>
  );
}

function CoordinatorGuideCard({ guide }: { guide: CoordinatorGuide }): JSX.Element {
  return (
    <article style={styles.card}>
      <div style={styles.cardHeader}>
        <div>
          <h3 style={styles.implanter}>{guide.implanter}</h3>
          <p style={styles.segment}>{guide.segment} • orientação da semana</p>
        </div>
        <span
          style={{
            ...styles.segmentBadge,
            background: guide.segment === "MID" ? "#eff6ff" : "#ecfdf3",
            color: guide.segment === "MID" ? "#1d4ed8" : "#047857",
            borderColor: guide.segment === "MID" ? "#93c5fd" : "#86efac",
          }}
        >
          {guide.segment}
        </span>
      </div>

      <p style={styles.portfolioSummary}>{guide.portfolioSummary}</p>
      <p style={styles.weeklyGoal}>{guide.weeklyGoal}</p>

      <div style={styles.columns}>
        <div style={styles.column}>
          <span style={styles.columnLabel}>Ordem de ataque</span>
          <div style={styles.stack}>
            {guide.attackOrder.map((item, index) => (
              <div key={`${guide.implanter}-attack-${index}`} style={styles.attackItem}>
                <span style={styles.attackNumber}>{index + 1}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.column}>
          <span style={styles.columnLabel}>Alerta de gestão</span>
          <div style={styles.alertBox}>{guide.managementAlert}</div>
        </div>
      </div>

      <div style={styles.focusList}>
        {guide.focusProjects.map((project) => {
          const tone = getPriorityColors(project.priority);
          return (
            <div key={`${guide.implanter}-${project.clientName}`} style={styles.focusCard}>
              <div style={styles.focusHeader}>
                <strong style={styles.focusClient}>{project.clientName}</strong>
                <span
                  style={{
                    ...styles.priorityBadge,
                    background: tone.bg,
                    color: tone.fg,
                    borderColor: tone.border,
                  }}
                >
                  {project.priority} • {project.risk}
                </span>
              </div>
              <p style={styles.focusMeta}>{project.phase || "Fase não informada"}</p>
              <p style={styles.focusWhy}>{project.whyNow}</p>
              <p style={styles.focusAction}>{project.recommendation}</p>
            </div>
          );
        })}
      </div>
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,244,255,0.98) 100%)",
    border: "1px solid rgba(106, 63, 150, 0.12)",
    borderRadius: "28px",
    padding: "24px",
    marginBottom: "20px",
    boxShadow: "0 24px 44px rgba(83, 40, 125, 0.08)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
  eyebrow: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontSize: "12px",
    fontWeight: 800,
    color: "#0dcc68",
  },
  title: {
    margin: "6px 0 0",
    fontSize: "28px",
    lineHeight: 1.15,
    color: "#3d215f",
  },
  notice: {
    maxWidth: "420px",
    padding: "14px 16px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, rgba(106,63,150,0.12) 0%, rgba(12,207,104,0.08) 100%)",
    border: "1px solid rgba(106, 63, 150, 0.18)",
    color: "#56317b",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  summaryList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "10px",
    marginBottom: "18px",
  },
  summaryItem: {
    background: "#ffffff",
    border: "1px solid rgba(106, 63, 150, 0.1)",
    borderRadius: "16px",
    padding: "12px 14px",
    color: "#334155",
    lineHeight: 1.5,
  },
  guideList: {
    display: "grid",
    gap: "16px",
  },
  card: {
    background: "#fff",
    borderRadius: "22px",
    border: "1px solid rgba(106, 63, 150, 0.12)",
    padding: "20px",
    boxShadow: "0 14px 28px rgba(83, 40, 125, 0.06)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: "10px",
  },
  implanter: {
    margin: 0,
    fontSize: "22px",
    color: "#0f172a",
  },
  segment: {
    margin: "6px 0 0",
    color: "#64748b",
  },
  segmentBadge: {
    padding: "8px 12px",
    borderRadius: "999px",
    borderStyle: "solid",
    borderWidth: "1px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  portfolioSummary: {
    margin: "0 0 8px",
    color: "#0f172a",
    fontWeight: 700,
    lineHeight: 1.55,
  },
  weeklyGoal: {
    margin: "0 0 14px",
    color: "#334155",
    lineHeight: 1.6,
  },
  columns: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1.1fr) minmax(220px, 0.9fr)",
    gap: "14px",
    marginBottom: "14px",
  },
  column: {
    minWidth: 0,
  },
  columnLabel: {
    display: "block",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#475569",
    marginBottom: "8px",
  },
  stack: {
    display: "grid",
    gap: "8px",
  },
  attackItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    background: "#ffffff",
    border: "1px solid rgba(106, 63, 150, 0.1)",
    borderRadius: "16px",
    padding: "10px 12px",
    color: "#334155",
    lineHeight: 1.5,
  },
  attackNumber: {
    width: "22px",
    height: "22px",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #6a3f96 0%, #0dcc68 140%)",
    color: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 800,
    flexShrink: 0,
    marginTop: "1px",
  },
  alertBox: {
    background: "linear-gradient(180deg, #fff8ef 0%, #fffef9 100%)",
    border: "1px solid #fdba74",
    borderRadius: "16px",
    padding: "12px 14px",
    color: "#9a3412",
    lineHeight: 1.55,
  },
  focusList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
  },
  focusCard: {
    background: "linear-gradient(180deg, #ffffff 0%, #faf7ff 100%)",
    borderRadius: "18px",
    border: "1px solid rgba(106, 63, 150, 0.1)",
    padding: "14px",
  },
  focusHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    marginBottom: "8px",
  },
  focusClient: {
    color: "#0f172a",
  },
  priorityBadge: {
    padding: "6px 10px",
    borderRadius: "999px",
    borderStyle: "solid",
    borderWidth: "1px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  focusMeta: {
    margin: "0 0 8px",
    color: "#64748b",
    fontSize: "14px",
  },
  focusWhy: {
    margin: "0 0 8px",
    color: "#0f172a",
    lineHeight: 1.55,
    fontWeight: 600,
  },
  focusAction: {
    margin: 0,
    color: "#334155",
    lineHeight: 1.55,
  },
};
