import type { CSSProperties } from "react";

import type { ExecutiveUploadsData } from "../types";

interface PostConclusionCancellationsPanelProps {
  executiveData: ExecutiveUploadsData | null;
}

type CancellationStage = "implantation" | "post-implantation";

interface EarlyCancellationRow {
  companyCode: string;
  contract: string;
  segment: string;
  subscriptionModel: string;
  firstRevenueAt: Date;
  cancellationDate: Date;
  cancellationMonth: string;
  monthsAfterFirstRevenue: number;
  value: number;
  responsibleCs: string;
  seller: string;
  stage: CancellationStage;
}

export function PostConclusionCancellationsPanel({
  executiveData,
}: PostConclusionCancellationsPanelProps): JSX.Element {
  const summary = buildEarlyCancellationSummary(executiveData);
  const hasCancellationRows = (executiveData?.postConclusionSaasCancellation.length ?? 0) > 0;

  return (
    <section style={styles.wrapper}>
      <div style={styles.header}>
        <p style={styles.eyebrow}>Cancelamentos iniciais</p>
        <h2 style={styles.title}>Cancelamentos ate 6 meses apos a 1a receita</h2>
        <p style={styles.subtitle}>
          Esta aba considera apenas clientes de Inbound que cancelaram ate 6 meses depois da
          primeira receita. Se o Responsavel CS for um implanter, classificamos como cancelamento
          na implantacao; caso contrario, como cliente ja concluido que cancelou cedo.
        </p>
      </div>

      <div style={styles.cardGrid}>
        <MetricCard
          label="Clientes encontrados"
          value={`${summary.count}`}
          detail="cancelaram ate 6 meses apos a 1a receita"
          color="#b91c1c"
        />
        <MetricCard
          label="MRR cancelado"
          value={formatCurrencyBRL(summary.mrr)}
          detail="soma dos cancelamentos encontrados"
          color="#dc2626"
        />
        <MetricCard
          label="Ticket medio"
          value={formatCurrencyBRL(summary.averageTicket)}
          detail="MRR medio por cliente cancelado"
          color="#d97706"
        />
        <MetricCard
          label="Na implantacao"
          value={`${summary.implantationCount}`}
          detail={`${formatCurrencyBRL(summary.implantationMrr)} com Responsavel CS implanter`}
          color="#7c2d12"
        />
        <MetricCard
          label="Pos-implantacao"
          value={`${summary.postImplantationCount}`}
          detail={`${formatCurrencyBRL(summary.postImplantationMrr)} apos sair da implantacao`}
          color="#4f46e5"
        />
      </div>

      {!hasCancellationRows ? (
        <div style={styles.emptyState}>
          Suba a planilha Cancelamentos 6m para preencher esta aba.
        </div>
      ) : null}

      {hasCancellationRows && summary.rows.length === 0 ? (
        <div style={styles.emptyState}>
          Nenhum cliente de Inbound cancelou ate 6 meses apos a 1a receita nesta base.
        </div>
      ) : null}

      {summary.rows.length > 0 ? (
        <section>
          <div style={styles.tableHeader}>
            <h3 style={styles.sectionTitle}>Clientes cancelados ate 6 meses da 1a receita</h3>
            <span style={styles.tableMeta}>{summary.rows.length} cliente(s)</span>
          </div>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Codigo</th>
                  <th style={styles.th}>Contrato</th>
                  <th style={styles.th}>Segmento</th>
                  <th style={styles.th}>1a receita</th>
                  <th style={styles.th}>Cancelamento</th>
                  <th style={styles.th}>Tempo</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>MRR</th>
                  <th style={styles.th}>Classificacao</th>
                  <th style={styles.th}>Responsavel CS</th>
                  <th style={styles.th}>Vendedor</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <tr key={`${row.companyCode}-${row.contract}-${row.cancellationMonth}-${row.value}`} style={styles.tr}>
                    <td style={styles.td}>{row.companyCode || "-"}</td>
                    <td style={styles.td}>{row.contract || "-"}</td>
                    <td style={styles.td}>
                      <strong>{row.segment || "-"}</strong>
                      <span style={styles.secondaryText}>{row.subscriptionModel || ""}</span>
                    </td>
                    <td style={styles.td}>{formatDateBR(row.firstRevenueAt)}</td>
                    <td style={styles.td}>{row.cancellationMonth || formatDateBR(row.cancellationDate)}</td>
                    <td style={styles.td}>{row.monthsAfterFirstRevenue} mes(es)</td>
                    <td style={styles.moneyCell}>{formatCurrencyBRL(row.value)}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.stageBadge,
                          ...(row.stage === "implantation"
                            ? styles.stageBadgeImplantation
                            : styles.stageBadgePostImplantation),
                        }}
                      >
                        {row.stage === "implantation" ? "Na implantacao" : "Pos-implantacao"}
                      </span>
                    </td>
                    <td style={styles.td}>{row.responsibleCs || "-"}</td>
                    <td style={styles.td}>{row.seller || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  color: string;
}): JSX.Element {
  return (
    <article style={{ ...styles.metricCard, borderTopColor: color }}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
      <span style={styles.metricDetail}>{detail}</span>
    </article>
  );
}

function buildEarlyCancellationSummary(executiveData: ExecutiveUploadsData | null): {
  count: number;
  mrr: number;
  averageTicket: number;
  implantationCount: number;
  implantationMrr: number;
  postImplantationCount: number;
  postImplantationMrr: number;
  rows: EarlyCancellationRow[];
} {
  const cancellationRows = executiveData?.postConclusionSaasCancellation ?? [];
  const rows = cancellationRows.reduce<EarlyCancellationRow[]>((accumulator, cancellation) => {
    if (!cancellation.referenceDate || !cancellation.firstRevenueAt) {
      return accumulator;
    }

    if (cancellation.firstRevenueAt > cancellation.referenceDate) {
      return accumulator;
    }

    if (addMonths(cancellation.firstRevenueAt, 6) < cancellation.referenceDate) {
      return accumulator;
    }

    const stage: CancellationStage = isImplantationResponsible(cancellation.responsibleCs)
      ? "implantation"
      : "post-implantation";

    accumulator.push({
      companyCode: cancellation.companyCode,
      contract: cancellation.contract,
      segment: cancellation.segment,
      subscriptionModel: cancellation.subscriptionModel,
      firstRevenueAt: cancellation.firstRevenueAt,
      cancellationDate: cancellation.referenceDate,
      cancellationMonth: cancellation.referenceMonth,
      monthsAfterFirstRevenue: diffCalendarMonths(cancellation.firstRevenueAt, cancellation.referenceDate),
      value: cancellation.value,
      responsibleCs: cancellation.responsibleCs,
      seller: cancellation.seller,
      stage,
    });
    return accumulator;
  }, []);

  rows.sort((a, b) => b.value - a.value || b.cancellationDate.getTime() - a.cancellationDate.getTime());

  const mrr = rows.reduce((total, row) => total + row.value, 0);
  const implantationRows = rows.filter((row) => row.stage === "implantation");
  const postImplantationRows = rows.filter((row) => row.stage === "post-implantation");
  const implantationMrr = implantationRows.reduce((total, row) => total + row.value, 0);
  const postImplantationMrr = postImplantationRows.reduce((total, row) => total + row.value, 0);

  return {
    count: rows.length,
    mrr,
    averageTicket: rows.length > 0 ? mrr / rows.length : 0,
    implantationCount: implantationRows.length,
    implantationMrr,
    postImplantationCount: postImplantationRows.length,
    postImplantationMrr,
    rows,
  };
}

function isImplantationResponsible(value: string): boolean {
  const normalized = normalizeKey(value);
  return [
    "maria",
    "aline andrade",
    "aline santos",
    "david",
    "caio",
    "jaqueline",
    "samara",
    "natiele",
    "natieli",
  ].some((name) => normalized.includes(name));
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function diffCalendarMonths(start: Date, end: Date): number {
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
}

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateBR(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(value);
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
    display: "grid",
    gap: 8,
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
    margin: 0,
    color: "#020617",
    fontSize: "clamp(28px, 4vw, 40px)",
    lineHeight: 1.08,
  },
  subtitle: {
    margin: 0,
    color: "#475569",
    fontSize: 16,
    maxWidth: 860,
    lineHeight: 1.5,
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  metricCard: {
    minHeight: 150,
    padding: 22,
    display: "grid",
    alignContent: "space-between",
    gap: 12,
    background: "#fff7f7",
    border: "1px solid #fecaca",
    borderTop: "5px solid #b91c1c",
    borderRadius: 20,
  },
  metricLabel: {
    color: "#334155",
    fontWeight: 800,
    fontSize: 14,
  },
  metricValue: {
    color: "#020617",
    fontSize: "clamp(28px, 5vw, 46px)",
    lineHeight: 1,
  },
  metricDetail: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.4,
  },
  emptyState: {
    padding: "20px 24px",
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    borderRadius: 18,
    color: "#475569",
    fontSize: 17,
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    margin: 0,
    color: "#020617",
    fontSize: 22,
  },
  tableMeta: {
    color: "#475569",
    fontWeight: 700,
  },
  tableWrap: {
    overflowX: "auto",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
  },
  table: {
    width: "100%",
    minWidth: 1080,
    borderCollapse: "collapse",
  },
  th: {
    padding: "14px 16px",
    background: "#5b21b6",
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
    padding: "14px 16px",
    color: "#0f172a",
    fontSize: 14,
    verticalAlign: "top",
    whiteSpace: "nowrap",
  },
  secondaryText: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },
  stageBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 130,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  stageBadgeImplantation: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  stageBadgePostImplantation: {
    background: "#e0e7ff",
    color: "#3730a3",
  },
  moneyCell: {
    padding: "14px 16px",
    color: "#b91c1c",
    fontSize: 14,
    fontWeight: 900,
    textAlign: "right",
    whiteSpace: "nowrap",
  },
};
