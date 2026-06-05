import { CSSProperties, useMemo, useState } from "react";

import type { ExecutiveUploadsData, ForecastMovement } from "../types";
import {
  applyOperationalContext,
  buildHealthRecords,
  formatCurrencyBRL,
  type ManualRiskOverride,
} from "../utils/healthScore";

interface ForecastPanelProps {
  executiveData: ExecutiveUploadsData | null;
  implanters: string[];
  selectedImplanter: string;
  onImplanterChange: (value: string) => void;
  manualOverrides: Record<string, ManualRiskOverride>;
}

interface ForecastEntry {
  clientName: string;
  implanter: string;
  movement: ForecastMovement;
  mrr: number;
  impactedMrr: number | null;
  classification: string;
  portfolioClass: "A" | "B" | "C" | "D" | "Não classificado";
  operationalStatus: string;
  note: string;
  nextStep: string;
  source: string;
}

const FORECAST_ORDER: ForecastMovement[] = [
  "Projeto em risco",
  "Em negociação de cancelamento",
  "Cancelado",
  "Concluído como perdido",
  "Revertido",
];

export function ForecastPanel({
  executiveData,
  implanters,
  selectedImplanter,
  onImplanterChange,
  manualOverrides,
}: ForecastPanelProps): JSX.Element {
  const [selectedPortfolio, setSelectedPortfolio] = useState<
    "Todas" | "A" | "B" | "C" | "D" | "Não classificado"
  >("Todas");
  const [selectedMovement, setSelectedMovement] = useState<"Todos" | ForecastMovement>("Todos");
  const [clientSearch, setClientSearch] = useState("");

  const records = useMemo(() => {
    const base = buildHealthRecords(executiveData);
    return applyOperationalContext(base, [], manualOverrides);
  }, [executiveData, manualOverrides]);

  const entries = useMemo<ForecastEntry[]>(() => {
    const recordEntries = records
      .filter((item) => !manualOverrides[item.key]?.excludeFromForecast)
      .filter(
        (item) =>
          item.manualClassification === "Risco" ||
          (Boolean(item.forecastMovement) && FORECAST_ORDER.includes(item.forecastMovement!)),
      )
      .map<ForecastEntry>((item) => ({
        clientName: item.clientName,
        implanter: item.implanter,
        movement: item.forecastMovement ?? "Projeto em risco",
        mrr: item.mrr,
        impactedMrr: item.mrr || null,
        classification: item.effectiveClassification,
        portfolioClass: item.portfolioClass,
        operationalStatus: item.manualOperationalStatus || item.status,
        note: item.manualNote,
        nextStep: item.manualNextStep || item.recommendedAction,
        source: "Fila inteligente",
      }));

    const normalizedSearch = normalize(clientSearch);
    const scoped = recordEntries.filter(
      (item) =>
        (selectedImplanter === "Todos" ? true : item.implanter === selectedImplanter) &&
        (selectedPortfolio === "Todas" ? true : item.portfolioClass === selectedPortfolio) &&
        (selectedMovement === "Todos" ? true : item.movement === selectedMovement) &&
        (normalizedSearch.length === 0
          ? true
          : normalize(item.clientName).includes(normalizedSearch) ||
            normalize(item.implanter).includes(normalizedSearch)),
    );

    return scoped.sort(
      (a, b) =>
        FORECAST_ORDER.indexOf(a.movement) - FORECAST_ORDER.indexOf(b.movement) ||
        b.mrr - a.mrr ||
        a.clientName.localeCompare(b.clientName),
    );
  }, [
    clientSearch,
    manualOverrides,
    records,
    selectedImplanter,
    selectedMovement,
    selectedPortfolio,
  ]);

  const summary = useMemo(() => {
    return FORECAST_ORDER.map((movement) => {
      const movementEntries = entries.filter((item) => item.movement === movement);
      return {
        movement,
        count: movementEntries.length,
        mrr: movementEntries.reduce((sum, item) => sum + item.mrr, 0),
      };
    }).filter((item) => item.count > 0);
  }, [entries]);

  const exitMetrics = useMemo(() => {
    const riskEntries = entries.filter(
      (item) =>
        item.movement === "Projeto em risco" ||
        item.movement === "Em negociação de cancelamento",
    );
    const canceledEntries = entries.filter(
      (item) =>
        item.movement === "Cancelado" ||
        item.movement === "Concluído como perdido",
    );
    const negotiationEntries = entries.filter(
      (item) => item.movement === "Em negociação de cancelamento",
    );
    const realizedExitMrr = canceledEntries.reduce((sum, item) => sum + item.mrr, 0);
    const forecastWeekExitMrr = negotiationEntries.reduce((sum, item) => sum + item.mrr, 0);
    const expectedMonthExitMrr = realizedExitMrr + forecastWeekExitMrr;
    const revertedMrr = entries
      .filter((item) => item.movement === "Revertido")
      .reduce((sum, item) => sum + item.mrr, 0);

    return {
      riskProjectsCount: riskEntries.length,
      riskProjectsMrr: riskEntries.reduce((sum, item) => sum + item.mrr, 0),
      canceledCount: canceledEntries.length,
      realizedExitMrr,
      negotiationCount: negotiationEntries.length,
      forecastWeekExitMrr,
      expectedMonthExitMrr,
      revertedMrr,
    };
  }, [entries]);

  if (!executiveData) {
    return (
      <section style={styles.wrapper}>
        <div style={styles.emptyCard}>
          <p style={styles.eyebrow}>Forecast</p>
          <h2 style={styles.title}>Nenhuma base carregada</h2>
          <p style={styles.subtitle}>
            Suba as planilhas executivas e marque os clientes manualmente na fila para montar o forecast.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.wrapper}>
      <header style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>Forecast operacional</p>
          <h2 style={styles.title}>Exit previsto da carteira</h2>
          <p style={styles.subtitle}>
            Esta aba responde duas perguntas: quem está em risco de cancelamento e quem já cancelou. O movimento revertido continua manual para vocês acompanharem à parte.
          </p>
        </div>
        <div style={styles.filterStack}>
          <label style={styles.field}>
            <span style={styles.label}>Filtrar por implanter</span>
            <select
              value={selectedImplanter}
              onChange={(event) => onImplanterChange(event.target.value)}
              style={styles.input}
            >
              {implanters.map((implanter) => (
                <option key={implanter} value={implanter}>
                  {implanter}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Filtrar por carteira</span>
            <select
              value={selectedPortfolio}
              onChange={(event) =>
                setSelectedPortfolio(
                  event.target.value as "Todas" | "A" | "B" | "C" | "D" | "Não classificado",
                )
              }
              style={styles.input}
            >
              <option value="Todas">Todas</option>
              <option value="A">Carteira A</option>
              <option value="B">Carteira B</option>
              <option value="C">Carteira C</option>
              <option value="D">Carteira D</option>
              <option value="Não classificado">Não classificado</option>
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Filtrar por movimento</span>
            <select
              value={selectedMovement}
              onChange={(event) =>
                setSelectedMovement(event.target.value as "Todos" | ForecastMovement)
              }
              style={styles.input}
            >
              <option value="Todos">Todos</option>
              {FORECAST_ORDER.map((movement) => (
                <option key={movement} value={movement}>
                  {movement}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Buscar cliente</span>
            <input
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
              placeholder="Nome do cliente ou implanter"
              style={styles.input}
            />
          </label>
        </div>
      </header>

      <div style={styles.metricsGrid}>
        <article style={styles.metricCard}>
          <span style={styles.metricLabel}>Clientes em risco de cancelamento</span>
          <strong style={styles.metricValue}>{exitMetrics.riskProjectsCount}</strong>
          <span style={styles.metricHelper}>{formatCurrencyBRL(exitMetrics.riskProjectsMrr)} em risco</span>
        </article>
        <article style={styles.metricCard}>
          <span style={styles.metricLabel}>Já cancelou</span>
          <strong style={styles.metricValue}>{exitMetrics.canceledCount}</strong>
          <span style={styles.metricHelper}>{formatCurrencyBRL(exitMetrics.realizedExitMrr)} cancelado</span>
        </article>
        <article style={styles.metricCard}>
          <span style={styles.metricLabel}>Forecast da semana</span>
          <strong style={styles.metricValue}>{formatCurrencyBRL(exitMetrics.forecastWeekExitMrr)}</strong>
          <span style={styles.metricHelper}>{exitMetrics.negotiationCount} cliente(s) em negociação</span>
        </article>
        <article style={styles.metricCard}>
          <span style={styles.metricLabel}>Expectativa de fechamento do mês</span>
          <strong style={styles.metricValue}>{formatCurrencyBRL(exitMetrics.expectedMonthExitMrr)}</strong>
          <span style={styles.metricHelper}>cancelado + negociação da semana</span>
        </article>
        <article style={styles.metricCard}>
          <span style={styles.metricLabel}>Revertido</span>
          <strong style={styles.metricValue}>{formatCurrencyBRL(exitMetrics.revertedMrr)}</strong>
          <span style={styles.metricHelper}>movimento manual de revertido</span>
        </article>
      </div>

      <div style={styles.metricsGrid}>
        {summary.map((item) => (
          <article key={item.movement} style={styles.metricCard}>
            <span style={styles.metricLabel}>{item.movement}</span>
            <strong style={styles.metricValue}>{item.count}</strong>
            <span style={styles.metricHelper}>{formatCurrencyBRL(item.mrr)}</span>
          </article>
        ))}
      </div>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <p style={styles.panelEyebrow}>Detalhamento</p>
          <h3 style={styles.panelTitle}>Clientes consolidados no forecast</h3>
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Cliente</th>
                <th style={styles.th}>Implanter</th>
                <th style={styles.th}>Movimento</th>
                <th style={styles.th}>MRR</th>
                <th style={styles.th}>MRR impactado</th>
                <th style={styles.th}>Carteira</th>
                <th style={styles.th}>Criticidade</th>
                <th style={styles.th}>Status operacional</th>
                <th style={styles.th}>Próximo passo</th>
                <th style={styles.th}>Observação</th>
                <th style={styles.th}>Origem</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((item) => (
                <tr key={`${item.implanter}-${item.clientName}-${item.movement}`} style={styles.tr}>
                  <td style={styles.tdStrong}>{item.clientName}</td>
                  <td style={styles.td}>{item.implanter}</td>
                  <td style={styles.td}>{item.movement}</td>
                  <td style={styles.td}>{formatCurrencyBRL(item.mrr)}</td>
                  <td style={styles.td}>{item.impactedMrr !== null ? formatCurrencyBRL(item.impactedMrr) : "Sem informação"}</td>
                  <td style={styles.td}>{item.portfolioClass}</td>
                  <td style={styles.td}>{item.classification}</td>
                  <td style={styles.td}>{item.operationalStatus || "Sem marcação"}</td>
                  <td style={styles.td}>{item.nextStep || "Sem próximo passo"}</td>
                  <td style={styles.td}>{item.note || "Sem observação"}</td>
                  <td style={styles.td}>{item.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const styles: Record<string, CSSProperties> = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(240px, 0.5fr)",
    gap: "18px",
    alignItems: "end",
    padding: "28px 30px",
    borderRadius: "28px",
    background: "linear-gradient(135deg, rgba(15, 23, 42, 0.97) 0%, rgba(14, 116, 144, 0.92) 56%, rgba(15, 118, 110, 0.88) 100%)",
    color: "#f8fafc",
  },
  eyebrow: { margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "12px", fontWeight: 800, color: "rgba(255,255,255,0.72)" },
  title: { margin: "10px 0 12px", fontSize: "34px", lineHeight: 1.1, letterSpacing: "-0.03em" },
  subtitle: { margin: 0, lineHeight: 1.7, color: "rgba(248,250,252,0.82)" },
  filterStack: { display: "flex", flexDirection: "column", gap: "12px" },
  field: { display: "flex", flexDirection: "column", gap: "8px" },
  label: { fontWeight: 800, fontSize: "12px", color: "#dbeafe", textTransform: "uppercase", letterSpacing: "0.06em" },
  input: { borderRadius: "14px", border: "1px solid rgba(255,255,255,0.18)", padding: "13px 14px", background: "rgba(255,255,255,0.95)", color: "#0f172a" },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" },
  metricCard: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    minHeight: "130px",
    padding: "20px",
    borderRadius: "22px",
    border: "1px solid #dbeafe",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    boxShadow: "0 18px 34px rgba(15, 23, 42, 0.06)",
  },
  metricLabel: { color: "#475569", fontSize: "13px", lineHeight: 1.5, fontWeight: 700 },
  metricValue: { fontSize: "30px", lineHeight: 1.05, letterSpacing: "-0.03em", color: "#0f172a" },
  metricHelper: { color: "#0f766e", fontSize: "13px", lineHeight: 1.5, fontWeight: 700 },
  panel: {
    padding: "24px",
    borderRadius: "26px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,249,255,0.98) 100%)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 24px 42px rgba(15, 23, 42, 0.06)",
  },
  panelHeader: { marginBottom: "18px" },
  panelEyebrow: { margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 800, color: "#0f766e" },
  panelTitle: { margin: "8px 0 0", fontSize: "24px", lineHeight: 1.2, color: "#0f172a" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", minWidth: "1080px" },
  th: { textAlign: "left", fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 12px 6px" },
  tr: {},
  td: { padding: "16px 12px", background: "#ffffff", borderTop: "1px solid rgba(226, 232, 240, 0.9)", borderBottom: "1px solid rgba(226, 232, 240, 0.9)", color: "#334155", verticalAlign: "top", fontSize: "14px", lineHeight: 1.45 },
  tdStrong: { padding: "16px 12px", background: "#ffffff", borderTop: "1px solid rgba(226, 232, 240, 0.9)", borderBottom: "1px solid rgba(226, 232, 240, 0.9)", color: "#0f172a", verticalAlign: "top", fontSize: "14px", lineHeight: 1.45, fontWeight: 800 },
  emptyCard: { padding: "36px", borderRadius: "28px", background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,249,255,0.98) 100%)", border: "1px solid rgba(148, 163, 184, 0.18)", boxShadow: "0 24px 42px rgba(15, 23, 42, 0.06)" },
};
