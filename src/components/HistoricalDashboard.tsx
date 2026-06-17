import type { CSSProperties } from "react";

export interface HistoricalSnapshot {
  id: string;
  createdAt: string;
  label: string;
  fileSummary: string[];
  totalProjects: number;
  totalMrr: number;
  healthyRate: number;
  riskProjects: number;
  riskMrr: number;
  midHealthyRate: number;
  smbHealthyRate: number;
  midProjects: number;
  smbProjects: number;
  implantationCancellationCount: number;
  implantationCancellationMrr: number;
  expansionMrr: number;
  contractionMrr: number;
}

interface HistoricalDashboardProps {
  snapshots: HistoricalSnapshot[];
  canSave: boolean;
  onSaveSnapshot: () => void;
  onResetHistory: () => void;
}

export function HistoricalDashboard({
  snapshots,
  canSave,
  onSaveSnapshot,
  onResetHistory,
}: HistoricalDashboardProps): JSX.Element {
  const orderedSnapshots = snapshots
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const first = orderedSnapshots[0] ?? null;
  const latest = orderedSnapshots[orderedSnapshots.length - 1] ?? null;

  return (
    <section style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Historico</p>
          <h2 style={styles.title}>Evolucao da carteira</h2>
          <p style={styles.subtitle}>
            Salve snapshots quando atualizar as planilhas para acompanhar evolucao de saude, MRR,
            risco e movimentos SaaS ao longo do tempo.
          </p>
        </div>
        <div style={styles.actions}>
          <button
            type="button"
            style={{ ...styles.button, ...(canSave ? styles.primaryButton : styles.disabledButton) }}
            onClick={onSaveSnapshot}
            disabled={!canSave}
          >
            Salvar snapshot atual
          </button>
          <button
            type="button"
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={onResetHistory}
            disabled={snapshots.length === 0}
          >
            Resetar historico
          </button>
        </div>
      </div>

      {latest ? (
        <>
          <div style={styles.metricGrid}>
            <MetricCard
              label="Snapshots salvos"
              value={`${orderedSnapshots.length}`}
              detail={formatDateTime(latest.createdAt)}
            />
            <MetricCard
              label="Projetos ativos"
              value={`${latest.totalProjects}`}
              detail={buildDeltaText(first?.totalProjects, latest.totalProjects, "proj.")}
            />
            <MetricCard
              label="MRR carteira"
              value={formatCurrencyBRL(latest.totalMrr)}
              detail={buildCurrencyDeltaText(first?.totalMrr, latest.totalMrr)}
            />
            <MetricCard
              label="Saude geral"
              value={`${latest.healthyRate}%`}
              detail={buildDeltaText(first?.healthyRate, latest.healthyRate, "p.p.")}
            />
            <MetricCard
              label="MRR em risco"
              value={formatCurrencyBRL(latest.riskMrr)}
              detail={buildCurrencyDeltaText(first?.riskMrr, latest.riskMrr)}
            />
            <MetricCard
              label="Cancelamento implantacao"
              value={formatCurrencyBRL(latest.implantationCancellationMrr)}
              detail={`${latest.implantationCancellationCount} evento(s)`}
            />
          </div>

          <div style={styles.sectionGrid}>
            <section style={styles.panel}>
              <h3 style={styles.panelTitle}>Saude por segmento</h3>
              <div style={styles.segmentGrid}>
                <SegmentBlock
                  label="Mid-market"
                  rate={latest.midHealthyRate}
                  projects={latest.midProjects}
                  delta={first ? latest.midHealthyRate - first.midHealthyRate : 0}
                />
                <SegmentBlock
                  label="SMB"
                  rate={latest.smbHealthyRate}
                  projects={latest.smbProjects}
                  delta={first ? latest.smbHealthyRate - first.smbHealthyRate : 0}
                />
              </div>
            </section>

            <section style={styles.panel}>
              <h3 style={styles.panelTitle}>Movimentos SaaS</h3>
              <div style={styles.movementRows}>
                <MovementRow label="Cancelamento implantacao" value={latest.implantationCancellationMrr} />
                <MovementRow label="Expansao" value={latest.expansionMrr} />
                <MovementRow label="Contraction" value={latest.contractionMrr} />
              </div>
            </section>
          </div>

          <section style={styles.panel}>
            <h3 style={styles.panelTitle}>Linha do tempo</h3>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Data</th>
                    <th style={styles.th}>Projetos</th>
                    <th style={styles.th}>MRR</th>
                    <th style={styles.th}>Saude</th>
                    <th style={styles.th}>Risco</th>
                    <th style={styles.th}>MRR risco</th>
                    <th style={styles.th}>Canc. implantacao</th>
                    <th style={styles.th}>Arquivos</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedSnapshots
                    .slice()
                    .reverse()
                    .map((snapshot) => (
                      <tr key={snapshot.id} style={styles.tr}>
                        <td style={styles.td}>
                          <strong>{snapshot.label}</strong>
                          <span style={styles.secondaryText}>{formatDateTime(snapshot.createdAt)}</span>
                        </td>
                        <td style={styles.td}>{snapshot.totalProjects}</td>
                        <td style={styles.td}>{formatCurrencyBRL(snapshot.totalMrr)}</td>
                        <td style={styles.td}>{snapshot.healthyRate}%</td>
                        <td style={styles.td}>{snapshot.riskProjects}</td>
                        <td style={styles.td}>{formatCurrencyBRL(snapshot.riskMrr)}</td>
                        <td style={styles.td}>
                          {snapshot.implantationCancellationCount} /{" "}
                          {formatCurrencyBRL(snapshot.implantationCancellationMrr)}
                        </td>
                        <td style={styles.fileCell}>{snapshot.fileSummary.join(" | ") || "-"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <div style={styles.emptyState}>
          Nenhum snapshot salvo ainda. Carregue as planilhas e clique em Salvar snapshot atual.
        </div>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}): JSX.Element {
  return (
    <article style={styles.metricCard}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
      <span style={styles.metricDetail}>{detail}</span>
    </article>
  );
}

function SegmentBlock({
  label,
  rate,
  projects,
  delta,
}: {
  label: string;
  rate: number;
  projects: number;
  delta: number;
}): JSX.Element {
  return (
    <div style={styles.segmentBlock}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{rate}%</strong>
      <span style={styles.metricDetail}>
        {projects} projeto(s) | {delta >= 0 ? "+" : ""}
        {delta} p.p.
      </span>
    </div>
  );
}

function MovementRow({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div style={styles.movementRow}>
      <span>{label}</span>
      <strong>{formatCurrencyBRL(value)}</strong>
    </div>
  );
}

function buildDeltaText(firstValue: number | undefined, latestValue: number, suffix: string): string {
  if (firstValue === undefined) {
    return "primeiro snapshot";
  }
  const delta = latestValue - firstValue;
  return `${delta >= 0 ? "+" : ""}${delta} ${suffix} desde o inicio`;
}

function buildCurrencyDeltaText(firstValue: number | undefined, latestValue: number): string {
  if (firstValue === undefined) {
    return "primeiro snapshot";
  }
  const delta = latestValue - firstValue;
  return `${delta >= 0 ? "+" : ""}${formatCurrencyBRL(delta)} desde o inicio`;
}

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: "grid",
    gap: 24,
    padding: "28px 30px 36px",
    background: "#f8fafc",
    borderRadius: 24,
    border: "1px solid #e2e8f0",
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  eyebrow: {
    margin: 0,
    color: "#00796b",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    margin: "6px 0 0",
    color: "#020617",
    fontSize: "clamp(28px, 4vw, 40px)",
    lineHeight: 1.08,
  },
  subtitle: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: 16,
    maxWidth: 820,
    lineHeight: 1.5,
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  button: {
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 12,
    border: "1px solid transparent",
    fontWeight: 900,
    cursor: "pointer",
  },
  primaryButton: {
    background: "#4f46e5",
    color: "#ffffff",
  },
  secondaryButton: {
    background: "#ffffff",
    color: "#0f172a",
    borderColor: "#cbd5e1",
  },
  disabledButton: {
    background: "#e2e8f0",
    color: "#64748b",
    cursor: "not-allowed",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  metricCard: {
    minHeight: 136,
    padding: 22,
    display: "grid",
    alignContent: "space-between",
    gap: 10,
    background: "#ffffff",
    border: "1px solid #dbeafe",
    borderTop: "5px solid #0f766e",
    borderRadius: 18,
  },
  metricLabel: {
    color: "#334155",
    fontWeight: 800,
    fontSize: 14,
  },
  metricValue: {
    color: "#020617",
    fontSize: "clamp(28px, 5vw, 42px)",
    lineHeight: 1,
  },
  metricDetail: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.4,
  },
  sectionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 18,
  },
  panel: {
    display: "grid",
    gap: 14,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 20,
  },
  panelTitle: {
    margin: 0,
    color: "#020617",
    fontSize: 20,
  },
  segmentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  segmentBlock: {
    display: "grid",
    gap: 10,
    padding: 16,
    borderRadius: 14,
    background: "#f0fdfa",
    border: "1px solid #99f6e4",
  },
  movementRows: {
    display: "grid",
    gap: 10,
  },
  movementRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    padding: "12px 0",
    borderBottom: "1px solid #e2e8f0",
    color: "#0f172a",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
  },
  table: {
    width: "100%",
    minWidth: 980,
    borderCollapse: "collapse",
    background: "#ffffff",
  },
  th: {
    padding: "12px 14px",
    background: "#312e81",
    color: "#ffffff",
    textAlign: "left",
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #e2e8f0",
  },
  td: {
    padding: "12px 14px",
    color: "#0f172a",
    fontSize: 14,
    verticalAlign: "top",
    whiteSpace: "nowrap",
  },
  fileCell: {
    padding: "12px 14px",
    color: "#475569",
    fontSize: 13,
    verticalAlign: "top",
    minWidth: 260,
  },
  secondaryText: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    padding: "28px",
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    borderRadius: 18,
    color: "#475569",
    fontSize: 17,
  },
};
