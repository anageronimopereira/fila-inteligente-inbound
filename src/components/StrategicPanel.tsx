import { CSSProperties } from "react";

import type { ImplanterWeeklyPlan, StrategicInsights } from "../types";
import { getPriorityColors } from "../utils/riskScore";

export function StrategicPanel({ insights }: { insights: StrategicInsights }): JSX.Element {
  return (
    <section style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Análise semanal</p>
          <h2 style={styles.title}>Direcionamento estratégico da carteira</h2>
        </div>
        <div style={styles.notice}>
          {insights.hasMrrData
            ? "O workbook trouxe 'Valor pago', e a análise também considera follow-up com cliente, aging e risco operacional."
            : "A análise abaixo considera follow-up com cliente, aging e fricção operacional mesmo sem dado financeiro."}
        </div>
      </div>

      <div style={styles.globalList}>
        <div style={styles.globalItemStrong}>
          <strong>MRR total da carteira:</strong> {formatCurrencyBRL(insights.totalMrr)}
        </div>
        <div style={styles.globalItemStrong}>
          <strong>MRR em projetos parados:</strong> {formatCurrencyBRL(insights.stoppedMrr)}
        </div>
        {insights.globalInsights.map((item) => (
          <div key={item} style={styles.globalItem}>
            {item}
          </div>
        ))}
      </div>

      {insights.stoppedProjects.length > 0 ? (
        <div style={styles.stoppedSection}>
          <div style={styles.stoppedHeader}>
            <span style={styles.stoppedLabel}>Clientes parados que merecem leitura gerencial</span>
            <span style={styles.stoppedHelper}>Top contas paradas por impacto financeiro e travamento</span>
          </div>

          <div style={styles.stoppedList}>
            {insights.stoppedProjects.map((project) => (
              <div key={`${project.clientName}-${project.implanter}`} style={styles.stoppedItem}>
                <div>
                  <strong style={styles.stoppedClient}>{project.clientName}</strong>
                  <p style={styles.stoppedReason}>{project.reason}</p>
                </div>
                <div style={styles.stoppedMeta}>
                  <span>{project.implanter || "Sem implanter"}</span>
                  <strong>{formatCurrencyBRL(project.mrr)}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={styles.planList}>
        {insights.implanterPlans.map((plan) => (
          <ImplanterPlanCard key={plan.implanter} plan={plan} />
        ))}
      </div>
    </section>
  );
}

function ImplanterPlanCard({ plan }: { plan: ImplanterWeeklyPlan }): JSX.Element {
  return (
    <article style={styles.card}>
      <div style={styles.cardHeader}>
        <div>
          <h3 style={styles.implanterName}>{plan.implanter}</h3>
          <p style={styles.implanterMeta}>
            {plan.totalProjects} projetos • risco médio {plan.avgRisk} • {plan.criticalCount} críticos •{" "}
            {plan.highCount} altas
          </p>
        </div>
        <div style={styles.counterBadge}>{plan.overdueCount} com financeiro vencido</div>
      </div>

      <p style={styles.callout}>{plan.portfolioCall}</p>
      <p style={styles.strategy}>{plan.weeklyStrategy}</p>

      <div style={styles.focusList}>
        {plan.focusProjects.map((project) => {
          const tone = getPriorityColors(project.priority);
          return (
            <div key={`${plan.implanter}-${project.clientName}`} style={styles.focusCard}>
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
              <p style={styles.focusMeta}>
                {project.phase || "Fase não informada"} • {project.ageDays} dias
              </p>
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
  globalList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "10px",
    marginBottom: "18px",
  },
  globalItem: {
    background: "#ffffff",
    border: "1px solid rgba(106, 63, 150, 0.1)",
    borderRadius: "16px",
    padding: "12px 14px",
    color: "#334155",
    lineHeight: 1.5,
  },
  globalItemStrong: {
    background: "linear-gradient(135deg, rgba(12,207,104,0.10) 0%, rgba(255,255,255,0.98) 100%)",
    border: "1px solid rgba(12, 207, 104, 0.22)",
    borderRadius: "16px",
    padding: "12px 14px",
    color: "#14532d",
    lineHeight: 1.5,
  },
  stoppedSection: {
    marginBottom: "18px",
    background: "linear-gradient(180deg, #ffffff 0%, #faf7ff 100%)",
    border: "1px solid rgba(106, 63, 150, 0.12)",
    borderRadius: "20px",
    padding: "16px",
  },
  stoppedHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "baseline",
    flexWrap: "wrap",
    marginBottom: "10px",
  },
  stoppedLabel: {
    fontSize: "13px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#5b3a81",
  },
  stoppedHelper: {
    color: "#64748b",
    fontSize: "14px",
  },
  stoppedList: {
    display: "grid",
    gap: "10px",
  },
  stoppedItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "flex-start",
    padding: "12px 14px",
    borderRadius: "16px",
    background: "#ffffff",
    border: "1px solid rgba(106, 63, 150, 0.1)",
  },
  stoppedClient: {
    color: "#0f172a",
  },
  stoppedReason: {
    margin: "6px 0 0",
    color: "#475569",
    lineHeight: 1.5,
  },
  stoppedMeta: {
    display: "grid",
    gap: "4px",
    justifyItems: "end",
    color: "#334155",
    whiteSpace: "nowrap",
  },
  planList: {
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
  implanterName: {
    margin: 0,
    fontSize: "22px",
  },
  implanterMeta: {
    margin: "6px 0 0",
    color: "#64748b",
  },
  counterBadge: {
    padding: "10px 12px",
    borderRadius: "999px",
    background: "rgba(12, 207, 104, 0.12)",
    border: "1px solid rgba(12, 207, 104, 0.34)",
    color: "#047857",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  callout: {
    margin: "0 0 8px",
    color: "#0f172a",
    fontWeight: 700,
    lineHeight: 1.5,
  },
  strategy: {
    margin: "0 0 14px",
    color: "#334155",
    lineHeight: 1.6,
  },
  focusList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
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

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}
