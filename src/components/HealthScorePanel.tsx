import { CSSProperties, useEffect, useMemo, useState } from "react";

import type { ExecutiveUploadsData } from "../types";
import { buildHealthRecords as buildSharedHealthRecords } from "../utils/healthScore";

interface HealthScorePanelProps {
  executiveData: ExecutiveUploadsData | null;
  implanters: string[];
  selectedImplanter: string;
  onImplanterChange: (value: string) => void;
}

type HealthClassification = "Saudável" | "Atenção" | "Risco";
type PeriodFilter = "Todos" | "30 dias" | "90 dias" | "180 dias";
type BooleanFilter = "Todos" | "Sim";

interface HealthClientRecord {
  key: string;
  clientName: string;
  projectName: string;
  implanter: string;
  phase: string;
  status: string;
  segment: string;
  startedAt: Date | null;
  ageDays: number;
  mrr: number;
  healthScore: number;
  classification: HealthClassification;
  engagementScore: number;
  progressScore: number;
  riskScore: number;
  strategicScore: number;
  engagementApplicable: boolean;
  engagementSummary: string;
  riskSignals: string[];
  recommendedAction: string;
  hasCancellationOpportunity: boolean;
  hasOverdueSubscription: boolean;
  lostHistoryCount: number;
  closedHistoryCount: number;
  hasFinalizationNote: boolean;
  detailUrl: string;
  historyNotes: string[];
}

export function HealthScorePanel({
  executiveData,
  implanters,
  selectedImplanter,
  onImplanterChange,
}: HealthScorePanelProps): JSX.Element {
  const [selectedPhase, setSelectedPhase] = useState("Todas");
  const [selectedClassification, setSelectedClassification] = useState<HealthClassification | "Todas">(
    "Todas",
  );
  const [selectedSegment, setSelectedSegment] = useState("Todos");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>("Todos");
  const [riskOnly, setRiskOnly] = useState<BooleanFilter>("Todos");
  const [cancellationOnly, setCancellationOnly] = useState<BooleanFilter>("Todos");
  const [search, setSearch] = useState("");
  const [selectedClientKey, setSelectedClientKey] = useState("");

  const records = useMemo(() => buildSharedHealthRecords(executiveData), [executiveData]);

  const phases = useMemo(() => {
    return ["Todas", ...new Set(records.map((item) => item.phase).filter(Boolean))];
  }, [records]);

  const segments = useMemo(() => {
    return ["Todos", ...new Set(records.map((item) => item.segment).filter(Boolean))];
  }, [records]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return records.filter((item) => {
      const matchesImplanter =
        selectedImplanter === "Todos" || item.implanter === selectedImplanter;
      const matchesPhase = selectedPhase === "Todas" || item.phase === selectedPhase;
      const matchesClassification =
        selectedClassification === "Todas" || item.classification === selectedClassification;
      const matchesSegment = selectedSegment === "Todos" || item.segment === selectedSegment;
      const matchesPeriod = matchesPeriodFilter(item.startedAt, selectedPeriod);
      const matchesRisk = riskOnly === "Todos" || item.classification === "Risco";
      const matchesCancellation =
        cancellationOnly === "Todos" || item.hasCancellationOpportunity;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.clientName.toLowerCase().includes(normalizedSearch) ||
        item.projectName.toLowerCase().includes(normalizedSearch);

      return (
        matchesImplanter &&
        matchesPhase &&
        matchesClassification &&
        matchesSegment &&
        matchesPeriod &&
        matchesRisk &&
        matchesCancellation &&
        matchesSearch
      );
    });
  }, [
    cancellationOnly,
    records,
    riskOnly,
    search,
    selectedClassification,
    selectedImplanter,
    selectedPeriod,
    selectedPhase,
    selectedSegment,
  ]);

  useEffect(() => {
    if (filteredRecords.length === 0) {
      setSelectedClientKey("");
      return;
    }

    const stillVisible = filteredRecords.some((item) => item.key === selectedClientKey);
    if (!stillVisible) {
      setSelectedClientKey(filteredRecords[0].key);
    }
  }, [filteredRecords, selectedClientKey]);

  const selectedRecord = filteredRecords.find((item) => item.key === selectedClientKey) ?? null;

  const summary = useMemo(() => {
    const healthy = filteredRecords.filter((item) => item.classification === "Saudável").length;
    const attention = filteredRecords.filter((item) => item.classification === "Atenção").length;
    const risk = filteredRecords.filter((item) => item.classification === "Risco").length;
    const riskMrr = filteredRecords
      .filter((item) => item.classification === "Risco")
      .reduce((sum, item) => sum + item.mrr, 0);
    const averageScore =
      filteredRecords.length > 0
        ? filteredRecords.reduce((sum, item) => sum + item.healthScore, 0) / filteredRecords.length
        : 0;

    const scopedLostProjects = filterProjectsByImplanterAndPeriod(
      executiveData?.lostProjects ?? [],
      selectedImplanter,
      selectedPeriod,
      (item) => item.projectClosedAt ?? item.accountClosedAt ?? item.kickOffDate,
      (item) => item.implanter,
    );
    const scopedNewProjects = filterProjectsByImplanterAndPeriod(
      executiveData?.newProjects ?? [],
      selectedImplanter,
      selectedPeriod,
      (item) => item.createdAt,
      (item) => item.implanter,
    );
    const scopedClosedProjects = filterProjectsByImplanterAndPeriod(
      executiveData?.closedProjects ?? [],
      selectedImplanter,
      selectedPeriod,
      (item) => item.closedAt,
      (item) => item.implanter,
    );

    const conversionBase = scopedClosedProjects.length + scopedLostProjects.length;
    const conversionRate =
      conversionBase > 0 ? (scopedClosedProjects.length / conversionBase) * 100 : null;

    return {
      totalOpenProjects: filteredRecords.length,
      healthy,
      attention,
      risk,
      riskMrr,
      lostInPeriod: scopedLostProjects.length,
      newInPeriod: scopedNewProjects.length,
      conversionRate,
      averageScore,
      implantersActive: new Set(filteredRecords.map((item) => item.implanter).filter(Boolean)).size,
      scoreDistribution: [
        { label: "Saudável", value: healthy, color: "#0f9d58" },
        { label: "Atenção", value: attention, color: "#d97706" },
        { label: "Risco", value: risk, color: "#dc2626" },
      ],
      phaseDistribution: buildDistribution(filteredRecords, (item) => item.phase).slice(0, 8),
      implanterDistribution: buildDistribution(filteredRecords, (item) => item.implanter).slice(0, 8),
    };
  }, [executiveData, filteredRecords, selectedImplanter, selectedPeriod]);

  if (!executiveData || records.length === 0) {
    return (
      <section style={styles.wrapper}>
        <div style={styles.emptyCard}>
          <p style={styles.eyebrow}>Health Score</p>
          <h2 style={styles.title}>Nenhuma base suficiente para calcular o score</h2>
          <p style={styles.subtitle}>
            Suba as planilhas executivas para cruzar clientes, calcular o Health Score e priorizar
            a ação do time de implantação.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.wrapper}>
      <header style={styles.hero}>
        <div style={styles.heroCopy}>
          <p style={styles.eyebrow}>Health Score</p>
          <h2 style={styles.title}>Batida de funil da implantação SaaS</h2>
          <p style={styles.subtitle}>
            O score cruza engajamento, progresso, risco e contexto estratégico para transformar a
            carteira em prioridade clara de ação para implanters e liderança.
          </p>
        </div>
        <div style={styles.heroHighlight}>
          <span style={styles.heroLabel}>Score médio da carteira filtrada</span>
          <strong style={styles.heroValue}>{Math.round(summary.averageScore)}</strong>
          <span style={styles.heroMeta}>
            {summary.risk} cliente(s) em risco e {formatCurrencyBRL(summary.riskMrr)} de MRR exposto
          </span>
        </div>
      </header>

      <section style={styles.filtersCard}>
        <div style={styles.filtersGrid}>
          <FilterField label="Implanter">
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
          </FilterField>

          <FilterField label="Fase do projeto">
            <select
              value={selectedPhase}
              onChange={(event) => setSelectedPhase(event.target.value)}
              style={styles.input}
            >
              {phases.map((phase) => (
                <option key={phase} value={phase}>
                  {phase}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Classificação do score">
            <select
              value={selectedClassification}
              onChange={(event) =>
                setSelectedClassification(event.target.value as HealthClassification | "Todas")
              }
              style={styles.input}
            >
              <option value="Todas">Todas</option>
              <option value="Saudável">Saudável</option>
              <option value="Atenção">Atenção</option>
              <option value="Risco">Risco</option>
            </select>
          </FilterField>

          <FilterField label="Segmento">
            <select
              value={selectedSegment}
              onChange={(event) => setSelectedSegment(event.target.value)}
              style={styles.input}
            >
              {segments.map((segment) => (
                <option key={segment} value={segment}>
                  {segment}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Período">
            <select
              value={selectedPeriod}
              onChange={(event) => setSelectedPeriod(event.target.value as PeriodFilter)}
              style={styles.input}
            >
              <option value="Todos">Todos</option>
              <option value="30 dias">Últimos 30 dias</option>
              <option value="90 dias">Últimos 90 dias</option>
              <option value="180 dias">Últimos 180 dias</option>
            </select>
          </FilterField>

          <FilterField label="Cliente em risco">
            <select
              value={riskOnly}
              onChange={(event) => setRiskOnly(event.target.value as BooleanFilter)}
              style={styles.input}
            >
              <option value="Todos">Todos</option>
              <option value="Sim">Somente em risco</option>
            </select>
          </FilterField>

          <FilterField label="Oportunidade de cancelamento">
            <select
              value={cancellationOnly}
              onChange={(event) => setCancellationOnly(event.target.value as BooleanFilter)}
              style={styles.input}
            >
              <option value="Todos">Todos</option>
              <option value="Sim">Somente com oportunidade</option>
            </select>
          </FilterField>

          <FilterField label="Buscar cliente">
            <input
              type="search"
              placeholder="Digite cliente ou projeto"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={styles.input}
            />
          </FilterField>
        </div>
      </section>

      <div style={styles.metricsGrid}>
        <MetricCard label="Projetos em aberto" value={summary.totalOpenProjects} tone="neutral" />
        <MetricCard label="Implanters ativos" value={summary.implantersActive} tone="positive" />
        <MetricCard label="Clientes saudáveis" value={summary.healthy} tone="positive" />
        <MetricCard label="Clientes em atenção" value={summary.attention} tone="warning" />
        <MetricCard label="Clientes em risco" value={summary.risk} tone="critical" />
        <MetricCard
          label="MRR em risco"
          value={formatCurrencyBRL(summary.riskMrr)}
          tone={summary.riskMrr > 0 ? "critical" : "neutral"}
        />
        <MetricCard label="Projetos perdidos" value={summary.lostInPeriod} tone="critical" />
        <MetricCard label="Novos projetos" value={summary.newInPeriod} tone="positive" />
        <MetricCard
          label="Taxa de conversão"
          value={summary.conversionRate === null ? "Sem base" : `${summary.conversionRate.toFixed(0)}%`}
          tone="neutral"
        />
      </div>

      <div style={styles.chartGrid}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <p style={styles.panelEyebrow}>Distribuição</p>
            <h3 style={styles.panelTitle}>Health Score da carteira</h3>
          </div>
          <BarList
            items={summary.scoreDistribution.map((item) => ({
              ...item,
              helper:
                summary.totalOpenProjects > 0
                  ? `${Math.round((item.value / summary.totalOpenProjects) * 100)}% da carteira`
                  : "0% da carteira",
            }))}
          />
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <p style={styles.panelEyebrow}>Fases</p>
            <h3 style={styles.panelTitle}>Projetos por fase</h3>
          </div>
          <BarList
            items={summary.phaseDistribution.map((item) => ({
              ...item,
              color: "#2563eb",
              helper: `${item.value} projeto(s)`,
            }))}
          />
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <p style={styles.panelEyebrow}>Carteira</p>
            <h3 style={styles.panelTitle}>Projetos por implanter</h3>
          </div>
          <BarList
            items={summary.implanterDistribution.map((item) => ({
              ...item,
              color: "#7c3aed",
              helper: `${item.value} projeto(s)`,
            }))}
          />
        </section>
      </div>

      <div style={styles.rankingLayout}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <p style={styles.panelEyebrow}>Prioridade</p>
            <h3 style={styles.panelTitle}>Ranking de prioridade por cliente</h3>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Cliente</th>
                  <th style={styles.th}>Implanter</th>
                  <th style={styles.th}>Score</th>
                  <th style={styles.th}>Classificação</th>
                  <th style={styles.th}>Fase</th>
                  <th style={styles.th}>Tempo de vida</th>
                  <th style={styles.th}>Engajamento</th>
                  <th style={styles.th}>Sinais de risco</th>
                  <th style={styles.th}>MRR</th>
                  <th style={styles.th}>Ação recomendada</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((item) => (
                  <tr
                    key={item.key}
                    style={{
                      ...styles.tr,
                      ...(item.key === selectedClientKey ? styles.trSelected : null),
                    }}
                    onClick={() => setSelectedClientKey(item.key)}
                  >
                    <td style={styles.tdStrong}>{item.clientName}</td>
                    <td style={styles.td}>{item.implanter || "Sem informação"}</td>
                    <td style={styles.td}>
                      <span style={scorePillStyle(item.classification)}>{item.healthScore}</span>
                    </td>
                    <td style={styles.td}>{item.classification}</td>
                    <td style={styles.td}>{item.phase}</td>
                    <td style={styles.td}>{item.ageDays} dias</td>
                    <td style={styles.td}>{item.engagementSummary}</td>
                    <td style={styles.td}>{item.riskSignals.slice(0, 2).join(" • ") || "Sem sinais"}</td>
                    <td style={styles.td}>{formatCurrencyBRL(item.mrr)}</td>
                    <td style={styles.tdAction}>{item.recommendedAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside style={styles.sidePanel}>
          {selectedRecord ? (
            <>
              <div style={styles.detailHeader}>
                <p style={styles.panelEyebrow}>Detalhe do cliente</p>
                <h3 style={styles.panelTitle}>{selectedRecord.clientName}</h3>
                <p style={styles.detailSubtext}>
                  {selectedRecord.implanter || "Sem implanter"} • {selectedRecord.phase} •{" "}
                  {selectedRecord.projectName || "Projeto sem nome"}
                </p>
              </div>

              <div style={styles.detailScoreCard}>
                <span style={styles.detailScoreLabel}>Health Score total</span>
                <strong style={styles.detailScoreValue}>{selectedRecord.healthScore}</strong>
                <span style={scorePillStyle(selectedRecord.classification)}>
                  {selectedRecord.classification}
                </span>
              </div>

              <div style={styles.detailBlocks}>
                <BlockScore
                  title="Engajamento"
                  value={
                    selectedRecord.engagementApplicable
                      ? String(selectedRecord.engagementScore)
                      : "N/A"
                  }
                />
                <BlockScore title="Progresso" value={selectedRecord.progressScore} />
                <BlockScore title="Risco" value={selectedRecord.riskScore} />
                <BlockScore title="Estratégico" value={selectedRecord.strategicScore} />
              </div>

              <div style={styles.detailSection}>
                <strong style={styles.detailSectionTitle}>Dados gerais</strong>
                <p style={styles.detailText}>Segmento: {selectedRecord.segment}</p>
                <p style={styles.detailText}>Tempo de vida: {selectedRecord.ageDays} dias</p>
                <p style={styles.detailText}>MRR: {formatCurrencyBRL(selectedRecord.mrr)}</p>
                <p style={styles.detailText}>
                  Início: {selectedRecord.startedAt ? formatDateBR(selectedRecord.startedAt) : "Sem informação"}
                </p>
              </div>

              <div style={styles.detailSection}>
                <strong style={styles.detailSectionTitle}>Principais sinais de risco</strong>
                <div style={styles.tagList}>
                  {selectedRecord.riskSignals.length > 0 ? (
                    selectedRecord.riskSignals.map((signal) => (
                      <span key={signal} style={styles.tag}>
                        {signal}
                      </span>
                    ))
                  ) : (
                    <span style={styles.tagNeutral}>Sem sinais relevantes</span>
                  )}
                </div>
              </div>

              <div style={styles.detailSection}>
                <strong style={styles.detailSectionTitle}>Histórico encontrado nas bases</strong>
                <ul style={styles.detailList}>
                  {selectedRecord.historyNotes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div style={styles.detailSection}>
                <strong style={styles.detailSectionTitle}>Ação sugerida</strong>
                <p style={styles.detailText}>{selectedRecord.recommendedAction}</p>
              </div>

              {selectedRecord.detailUrl ? (
                <a href={selectedRecord.detailUrl} target="_blank" rel="noreferrer" style={styles.detailLink}>
                  Abrir detalhe do cliente
                </a>
              ) : null}
            </>
          ) : (
            <div style={styles.emptyList}>Nenhum cliente disponível com os filtros atuais.</div>
          )}
        </aside>
      </div>
    </section>
  );
}

function buildDistribution(
  records: HealthClientRecord[],
  getLabel: (item: HealthClientRecord) => string,
): Array<{ label: string; value: number }> {
  return Array.from(
    records.reduce<Map<string, number>>((accumulator, item) => {
      const key = getLabel(item) || "Sem informação";
      accumulator.set(key, (accumulator.get(key) ?? 0) + 1);
      return accumulator;
    }, new Map()).entries(),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function filterProjectsByImplanterAndPeriod<T>(
  items: T[],
  selectedImplanter: string,
  selectedPeriod: PeriodFilter,
  getDate: (item: T) => Date | null,
  getImplanter: (item: T) => string,
): T[] {
  return items.filter((item) => {
    const matchesImplanter =
      selectedImplanter === "Todos" || getImplanter(item) === selectedImplanter;
    const matchesPeriod = matchesPeriodFilter(getDate(item), selectedPeriod);
    return matchesImplanter && matchesPeriod;
  });
}

function matchesPeriodFilter(date: Date | null, filter: PeriodFilter): boolean {
  if (filter === "Todos") {
    return true;
  }
  const age = diffDays(date);
  if (filter === "30 dias") {
    return age <= 30;
  }
  if (filter === "90 dias") {
    return age <= 90;
  }
  return age <= 180;
}

function diffDays(date: Date | null): number {
  if (!date) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDateBR(value: Date | null): string {
  if (!value) {
    return "Sem informação";
  }
  return new Intl.DateTimeFormat("pt-BR").format(value);
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "neutral" | "positive" | "warning" | "critical";
}): JSX.Element {
  const toneStyles =
    tone === "critical"
      ? { border: "#fecaca", accent: "#b91c1c", bg: "linear-gradient(180deg, #fff8f8 0%, #fff1f2 100%)" }
      : tone === "warning"
        ? { border: "#fed7aa", accent: "#c2410c", bg: "linear-gradient(180deg, #fffaf4 0%, #fff7ed 100%)" }
        : tone === "positive"
          ? { border: "#bbf7d0", accent: "#047857", bg: "linear-gradient(180deg, #f8fffb 0%, #ecfdf3 100%)" }
          : { border: "#dbe3f4", accent: "#1e3a5f", bg: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)" };

  return (
    <article
      style={{
        ...styles.metricCard,
        borderColor: toneStyles.border,
        background: toneStyles.bg,
        boxShadow: `inset 0 4px 0 ${toneStyles.accent}, 0 18px 34px rgba(15, 23, 42, 0.06)`,
      }}
    >
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
    </article>
  );
}

function BarList({
  items,
}: {
  items: Array<{ label: string; value: number; color: string; helper: string }>;
}): JSX.Element {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div style={styles.barList}>
      {items.map((item) => (
        <article key={item.label} style={styles.barItem}>
          <div style={styles.barLabelRow}>
            <strong style={styles.barLabel}>{item.label}</strong>
            <span style={styles.barValue}>{item.value}</span>
          </div>
          <div style={styles.barTrack}>
            <div
              style={{
                ...styles.barFill,
                width: `${(item.value / maxValue) * 100}%`,
                background: item.color,
              }}
            />
          </div>
          <span style={styles.barHelper}>{item.helper}</span>
        </article>
      ))}
    </div>
  );
}

function BlockScore({ title, value }: { title: string; value: string | number }): JSX.Element {
  return (
    <article style={styles.blockScore}>
      <span style={styles.blockScoreLabel}>{title}</span>
      <strong style={styles.blockScoreValue}>{value}</strong>
    </article>
  );
}

function scorePillStyle(classification: HealthClassification): CSSProperties {
  if (classification === "Risco") {
    return {
      ...styles.scorePill,
      color: "#991b1b",
      background: "#fee2e2",
      borderColor: "#fecaca",
    };
  }
  if (classification === "Atenção") {
    return {
      ...styles.scorePill,
      color: "#9a3412",
      background: "#ffedd5",
      borderColor: "#fed7aa",
    };
  }
  return {
    ...styles.scorePill,
    color: "#166534",
    background: "#dcfce7",
    borderColor: "#bbf7d0",
  };
}

const styles: Record<string, CSSProperties> = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  hero: { display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(280px, 0.9fr)", gap: "18px" },
  heroCopy: {
    padding: "28px 30px",
    borderRadius: "28px",
    background:
      "linear-gradient(135deg, rgba(17, 24, 39, 0.96) 0%, rgba(30, 41, 59, 0.95) 45%, rgba(12, 148, 136, 0.9) 100%)",
    color: "#f8fafc",
    boxShadow: "0 30px 60px rgba(15, 23, 42, 0.16)",
  },
  heroHighlight: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "28px",
    borderRadius: "28px",
    background: "linear-gradient(180deg, #eefbf5 0%, #dff7eb 100%)",
    border: "1px solid rgba(15, 118, 110, 0.16)",
    boxShadow: "0 24px 44px rgba(15, 118, 110, 0.12)",
  },
  heroLabel: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#0f766e", fontWeight: 800 },
  heroValue: { fontSize: "54px", lineHeight: 1, color: "#134e4a" },
  heroMeta: { color: "#115e59", lineHeight: 1.5, fontWeight: 600 },
  eyebrow: { margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "12px", fontWeight: 800, color: "rgba(255,255,255,0.72)" },
  title: { margin: "10px 0 12px", fontSize: "34px", lineHeight: 1.1, letterSpacing: "-0.03em" },
  subtitle: { margin: 0, maxWidth: "720px", lineHeight: 1.7, color: "rgba(248,250,252,0.78)" },
  filtersCard: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,244,255,0.96) 100%)",
    border: "1px solid rgba(106, 63, 150, 0.12)",
    borderRadius: "24px",
    padding: "22px",
    boxShadow: "0 20px 40px rgba(83, 40, 125, 0.08)",
  },
  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  field: { display: "flex", flexDirection: "column", gap: "8px" },
  label: {
    fontWeight: 800,
    fontSize: "12px",
    color: "#5b3a81",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  input: {
    borderRadius: "14px",
    border: "1px solid rgba(106, 63, 150, 0.16)",
    padding: "13px 14px",
    background: "#fff",
    color: "#0f172a",
    boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.04)",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
  },
  metricCard: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    minHeight: "134px",
    padding: "20px",
    borderRadius: "22px",
    border: "1px solid transparent",
  },
  metricLabel: { color: "#475569", fontSize: "13px", lineHeight: 1.5, fontWeight: 700 },
  metricValue: { fontSize: "32px", lineHeight: 1.05, letterSpacing: "-0.03em", color: "#0f172a" },
  chartGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px" },
  rankingLayout: { display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(300px, 0.8fr)", gap: "18px", alignItems: "start" },
  panel: {
    padding: "24px",
    borderRadius: "26px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,249,255,0.98) 100%)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 24px 42px rgba(15, 23, 42, 0.06)",
  },
  sidePanel: {
    position: "sticky",
    top: "24px",
    padding: "24px",
    borderRadius: "26px",
    background: "linear-gradient(180deg, #ffffff 0%, #f5fbff 100%)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 24px 42px rgba(15, 23, 42, 0.06)",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  panelHeader: { marginBottom: "18px" },
  panelEyebrow: { margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 800, color: "#0f766e" },
  panelTitle: { margin: "8px 0 0", fontSize: "24px", lineHeight: 1.2, color: "#0f172a" },
  barList: { display: "flex", flexDirection: "column", gap: "14px" },
  barItem: { display: "flex", flexDirection: "column", gap: "8px" },
  barLabelRow: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" },
  barLabel: { color: "#1f2937", fontSize: "14px" },
  barValue: { color: "#475569", fontSize: "13px", fontWeight: 700 },
  barTrack: { width: "100%", height: "12px", background: "#e5eef9", borderRadius: "999px", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: "999px" },
  barHelper: { color: "#64748b", fontSize: "13px" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", minWidth: "1080px" },
  th: {
    textAlign: "left",
    fontSize: "12px",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "0 12px 6px",
  },
  tr: { cursor: "pointer" },
  trSelected: { outline: "2px solid rgba(14, 165, 233, 0.18)" },
  td: {
    padding: "16px 12px",
    background: "#ffffff",
    borderTop: "1px solid rgba(226, 232, 240, 0.9)",
    borderBottom: "1px solid rgba(226, 232, 240, 0.9)",
    color: "#334155",
    verticalAlign: "top",
    fontSize: "14px",
    lineHeight: 1.45,
  },
  tdStrong: {
    padding: "16px 12px",
    background: "#ffffff",
    borderTop: "1px solid rgba(226, 232, 240, 0.9)",
    borderBottom: "1px solid rgba(226, 232, 240, 0.9)",
    color: "#0f172a",
    verticalAlign: "top",
    fontSize: "14px",
    lineHeight: 1.45,
    fontWeight: 800,
  },
  tdAction: {
    padding: "16px 12px",
    background: "#ffffff",
    borderTop: "1px solid rgba(226, 232, 240, 0.9)",
    borderBottom: "1px solid rgba(226, 232, 240, 0.9)",
    color: "#334155",
    verticalAlign: "top",
    fontSize: "13px",
    lineHeight: 1.5,
    minWidth: "280px",
  },
  scorePill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "48px",
    padding: "6px 10px",
    borderRadius: "999px",
    border: "1px solid transparent",
    fontWeight: 800,
  },
  detailHeader: { display: "flex", flexDirection: "column", gap: "8px" },
  detailSubtext: { margin: 0, color: "#64748b", lineHeight: 1.5 },
  detailScoreCard: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "20px",
    borderRadius: "22px",
    background: "linear-gradient(180deg, #effcf6 0%, #ddfbe8 100%)",
    border: "1px solid rgba(16, 185, 129, 0.16)",
  },
  detailScoreLabel: { color: "#0f766e", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "12px" },
  detailScoreValue: { fontSize: "44px", lineHeight: 1, color: "#14532d" },
  detailBlocks: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" },
  blockScore: {
    padding: "16px",
    borderRadius: "18px",
    background: "#f8fafc",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  blockScoreLabel: { color: "#64748b", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" },
  blockScoreValue: { fontSize: "26px", color: "#0f172a" },
  detailSection: { display: "flex", flexDirection: "column", gap: "10px" },
  detailSectionTitle: { color: "#0f172a", fontSize: "15px" },
  detailText: { margin: 0, color: "#334155", lineHeight: 1.6 },
  detailList: { margin: 0, paddingLeft: "18px", color: "#334155", lineHeight: 1.7 },
  tagList: { display: "flex", flexWrap: "wrap", gap: "8px" },
  tag: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: "999px",
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: "12px",
    fontWeight: 700,
  },
  tagNeutral: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: "999px",
    background: "#e2e8f0",
    color: "#334155",
    fontSize: "12px",
    fontWeight: 700,
  },
  detailLink: {
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "12px 14px",
    borderRadius: "14px",
    background: "#0f766e",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 800,
  },
  emptyCard: {
    padding: "36px",
    borderRadius: "28px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,249,255,0.98) 100%)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 24px 42px rgba(15, 23, 42, 0.06)",
  },
  emptyList: { color: "#64748b", lineHeight: 1.6 },
};
