import React, { ChangeEvent, CSSProperties, useMemo, useState } from "react";

import type { ClienteProjeto, DashboardMetrics, PriorityLevel } from "../types/priorizacao";
import { CsvParseError, parseCsv } from "../utils/parseCsv";
import { calculateRiskScore, getPriorityTone } from "../utils/riskScore";

interface ClienteComScore {
  cliente: ClienteProjeto;
  score: number;
  priority: PriorityLevel;
  nextAction: string;
  reasons: string[];
}

export function DashboardPriorizacao(): JSX.Element {
  const [rows, setRows] = useState<ClienteProjeto[]>([]);
  const [selectedImplanter, setSelectedImplanter] = useState<string>("Todos");
  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const implanters = useMemo(() => {
    return ["Todos", ...new Set(rows.map((row) => row.implanter).filter(Boolean))];
  }, [rows]);

  const scoredRows = useMemo<ClienteComScore[]>(() => {
    return rows
      .map((cliente) => {
        const risk = calculateRiskScore(cliente);
        return {
          cliente,
          score: risk.score,
          priority: risk.priority,
          nextAction: risk.nextAction,
          reasons: risk.reasons,
        };
      })
      .sort((a, b) => b.score - a.score || a.cliente.clientName.localeCompare(b.cliente.clientName));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return scoredRows.filter(({ cliente }) => {
      const matchesImplanter =
        selectedImplanter === "Todos" || cliente.implanter === selectedImplanter;
      const matchesClient =
        normalizedSearch.length === 0 ||
        cliente.clientName.toLowerCase().includes(normalizedSearch);

      return matchesImplanter && matchesClient;
    });
  }, [scoredRows, search, selectedImplanter]);

  const metrics = useMemo<DashboardMetrics>(() => {
    if (filteredRows.length === 0) {
      return {
        totalClientes: 0,
        riscoMedio: 0,
        criticos: 0,
        comMensalidadeVencida: 0,
      };
    }

    const totalScore = filteredRows.reduce((sum, item) => sum + item.score, 0);

    return {
      totalClientes: filteredRows.length,
      riscoMedio: Math.round(totalScore / filteredRows.length),
      criticos: filteredRows.filter((item) => item.priority === "Critica").length,
      comMensalidadeVencida: filteredRows.filter(
        (item) => item.cliente.hasOverdueSubscription,
      ).length,
    };
  }, [filteredRows]);

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setErrorMessage("");

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setRows([]);
      setFileName("");
      setErrorMessage("Envie um arquivo CSV válido.");
      return;
    }

    setIsLoading(true);
    setFileName(file.name);

    try {
      const content = await file.text();
      const parsedRows = parseCsv(content);
      setRows(parsedRows);
      setSelectedImplanter("Todos");
      setSearch("");
    } catch (error) {
      setRows([]);
      setFileName("");
      setErrorMessage(getUploadErrorMessage(error));
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  }

  return (
    <section style={styles.page}>
      <header style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>Priorizacao de implantacao</p>
          <h1 style={styles.title}>Dashboard de risco por cliente</h1>
          <p style={styles.subtitle}>
            Faça upload do CSV, filtre por implantador e acompanhe a fila ordenada do maior
            risco para o menor.
          </p>
        </div>

        <label style={styles.uploadBox}>
          <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} style={styles.hiddenInput} />
          <span style={styles.uploadLabel}>{isLoading ? "Processando..." : "Enviar CSV"}</span>
          <span style={styles.uploadHint}>
            {fileName ? `Arquivo carregado: ${fileName}` : "Selecione um CSV com a base de implantação"}
          </span>
        </label>
      </header>

      {errorMessage ? (
        <div role="alert" aria-live="polite" style={styles.errorBanner}>
          {errorMessage}
        </div>
      ) : null}

      <div style={styles.summaryGrid}>
        <SummaryCard label="Clientes na fila" value={metrics.totalClientes} accent="#0f766e" />
        <SummaryCard label="Risco medio" value={metrics.riscoMedio} accent="#b45309" />
        <SummaryCard label="Prioridade critica" value={metrics.criticos} accent="#b42318" />
        <SummaryCard
          label="Mensalidade vencida"
          value={metrics.comMensalidadeVencida}
          accent="#7c2d12"
        />
      </div>

      <div style={styles.filters}>
        <div style={styles.filterBlock}>
          <label htmlFor="implanter-filter" style={styles.filterLabel}>
            Filtrar por implantador
          </label>
          <select
            id="implanter-filter"
            value={selectedImplanter}
            onChange={(event) => setSelectedImplanter(event.target.value)}
            style={styles.input}
          >
            {implanters.map((implanter) => (
              <option key={implanter} value={implanter}>
                {implanter}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.filterBlock}>
          <label htmlFor="client-search" style={styles.filterLabel}>
            Buscar cliente
          </label>
          <input
            id="client-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Digite o nome do cliente"
            style={styles.input}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState />
      ) : filteredRows.length === 0 ? (
        <div style={styles.emptyPanel}>
          <h2 style={styles.emptyTitle}>Nenhum cliente encontrado</h2>
          <p style={styles.emptyText}>
            Ajuste os filtros para visualizar clientes compatíveis com a seleção atual.
          </p>
        </div>
      ) : (
        <div style={styles.list}>
          {filteredRows.map((item) => (
            <ClientRiskCard key={`${item.cliente.clientName}-${item.cliente.implanter}`} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}): JSX.Element {
  return (
    <article style={{ ...styles.summaryCard, borderTop: `4px solid ${accent}` }}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </article>
  );
}

function ClientRiskCard({ item }: { item: ClienteComScore }): JSX.Element {
  const tone = getPriorityTone(item.priority);

  return (
    <article style={styles.clientCard}>
      <div style={styles.clientHeader}>
        <div>
          <h3 style={styles.clientName}>{item.cliente.clientName}</h3>
          <p style={styles.metaText}>
            {item.cliente.implanter || "Sem implantador"} • {item.cliente.phase || "Fase não informada"}
          </p>
        </div>

        <div
          style={{
            ...styles.priorityBadge,
            backgroundColor: tone.bg,
            color: tone.fg,
            borderColor: tone.border,
          }}
        >
          {item.priority} • {item.score}
        </div>
      </div>

      <div style={styles.infoGrid}>
        <InfoPill label="Mensalidade vencida" value={item.cliente.hasOverdueSubscription ? "Sim" : "Nao"} />
        <InfoPill label="Apps integrados" value={String(item.cliente.integratedApps)} />
        <InfoPill label="Usuarios pendentes" value={String(item.cliente.pendingUsers)} />
        <InfoPill label="Usuarios vendedores" value={String(item.cliente.vendorUsers)} />
      </div>

      <div style={styles.actionPanel}>
        <div>
          <span style={styles.panelLabel}>Próxima ação</span>
          <p style={styles.actionText}>{item.nextAction}</p>
        </div>

        <div>
          <span style={styles.panelLabel}>Drivers de risco</span>
          <p style={styles.reasonText}>{item.reasons.length > 0 ? item.reasons.join(" • ") : "Sem alertas relevantes"}</p>
        </div>
      </div>

      {item.cliente.detailUrl ? (
        <a href={item.cliente.detailUrl} target="_blank" rel="noreferrer" style={styles.detailLink}>
          Abrir detalhamento
        </a>
      ) : null}
    </article>
  );
}

function InfoPill({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={styles.infoPill}>
      <span style={styles.infoLabel}>{label}</span>
      <strong style={styles.infoValue}>{value}</strong>
    </div>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div style={styles.emptyPanel}>
      <h2 style={styles.emptyTitle}>Nenhum dado carregado</h2>
      <p style={styles.emptyText}>
        Envie um arquivo CSV para calcular o score, classificar prioridades e gerar a próxima
        ação recomendada por cliente.
      </p>
    </div>
  );
}

function getUploadErrorMessage(error: unknown): string {
  if (error instanceof CsvParseError) {
    return error.message;
  }

  return "Não foi possível processar o arquivo enviado. Verifique o formato do CSV e tente novamente.";
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "32px",
    background:
      "radial-gradient(circle at top left, rgba(15, 118, 110, 0.12), transparent 30%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
    color: "#0f172a",
    fontFamily:
      'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: "24px",
    alignItems: "flex-start",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  eyebrow: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#0f766e",
    fontSize: "12px",
    fontWeight: 700,
  },
  title: {
    margin: "8px 0 12px",
    fontSize: "36px",
    lineHeight: 1.1,
  },
  subtitle: {
    margin: 0,
    maxWidth: "720px",
    color: "#475467",
    fontSize: "16px",
  },
  uploadBox: {
    minWidth: "280px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "18px",
    borderRadius: "20px",
    border: "1px dashed #99f6e4",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
    cursor: "pointer",
  },
  hiddenInput: {
    display: "none",
  },
  uploadLabel: {
    fontWeight: 700,
    color: "#0f766e",
  },
  uploadHint: {
    color: "#475467",
    fontSize: "14px",
  },
  errorBanner: {
    padding: "14px 16px",
    borderRadius: "14px",
    backgroundColor: "#fff1f0",
    border: "1px solid #fda29b",
    color: "#b42318",
    marginBottom: "20px",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: "18px",
    padding: "20px",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.06)",
  },
  summaryLabel: {
    display: "block",
    color: "#475467",
    marginBottom: "12px",
    fontSize: "14px",
  },
  summaryValue: {
    fontSize: "32px",
    lineHeight: 1,
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  filterBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  filterLabel: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#344054",
  },
  input: {
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #d0d5dd",
    backgroundColor: "#ffffff",
    color: "#101828",
    outline: "none",
  },
  list: {
    display: "grid",
    gap: "16px",
  },
  clientCard: {
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "20px",
    boxShadow: "0 12px 36px rgba(15, 23, 42, 0.06)",
    border: "1px solid rgba(15, 23, 42, 0.06)",
  },
  clientHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  clientName: {
    margin: 0,
    fontSize: "22px",
  },
  metaText: {
    margin: "6px 0 0",
    color: "#667085",
  },
  priorityBadge: {
    padding: "10px 14px",
    borderRadius: "999px",
    fontWeight: 700,
    borderStyle: "solid",
    borderWidth: "1px",
    whiteSpace: "nowrap",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  infoPill: {
    padding: "14px",
    borderRadius: "16px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  infoLabel: {
    display: "block",
    fontSize: "12px",
    color: "#667085",
    marginBottom: "6px",
  },
  infoValue: {
    fontSize: "18px",
  },
  actionPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "16px",
    marginBottom: "12px",
  },
  panelLabel: {
    display: "block",
    marginBottom: "6px",
    color: "#344054",
    fontWeight: 700,
    fontSize: "13px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  actionText: {
    margin: 0,
    color: "#101828",
    lineHeight: 1.5,
  },
  reasonText: {
    margin: 0,
    color: "#475467",
    lineHeight: 1.5,
  },
  detailLink: {
    display: "inline-flex",
    marginTop: "4px",
    color: "#0f766e",
    textDecoration: "none",
    fontWeight: 700,
  },
  emptyPanel: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    border: "1px dashed #cbd5e1",
    borderRadius: "24px",
    padding: "48px 24px",
    textAlign: "center",
  },
  emptyTitle: {
    margin: "0 0 12px",
    fontSize: "24px",
  },
  emptyText: {
    margin: 0,
    color: "#667085",
    maxWidth: "640px",
    marginInline: "auto",
    lineHeight: 1.6,
  },
};

export default DashboardPriorizacao;
