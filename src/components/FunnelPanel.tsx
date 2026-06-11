import { CSSProperties, useEffect, useMemo, useState } from "react";

import type { ExecutiveUploadsData, ForecastMovement } from "../types";
import {
  applyOperationalContext,
  buildDistribution,
  buildHealthRecords,
  comparePriority,
  formatCurrencyBRL,
  formatDateBR,
  type HealthClassification,
  type HealthClientRecord,
  type ManualRiskOverride,
} from "../utils/healthScore";

interface FunnelPanelProps {
  executiveData: ExecutiveUploadsData | null;
  implanters: string[];
  selectedImplanter: string;
  onImplanterChange: (value: string) => void;
  manualOverrides: Record<string, ManualRiskOverride>;
  onManualOverrideChange: (override: ManualRiskOverride) => void;
}

const FORECAST_MOVEMENTS: ForecastMovement[] = [
  "Projeto em risco",
  "Em negociação de cancelamento",
  "Cancelado",
  "Concluído como perdido",
  "Revertido",
];

const OPERATIONAL_STATUS_OPTIONS = [
  "Solicitou cancelamento",
  "Em negociação de reversão",
  "Revertido",
  "Aguardando cliente",
  "Bloqueado internamente",
  "Em andamento",
];

const MEETING_NOTES_STORAGE_KEY = "mercos-ops-meeting-notes-v1";

export function FunnelPanel({
  executiveData,
  implanters,
  selectedImplanter,
  onImplanterChange,
  manualOverrides,
  onManualOverrideChange,
}: FunnelPanelProps): JSX.Element {
  const [selectedClassifications, setSelectedClassifications] = useState<HealthClassification[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<"Todos" | "MID" | "SMB" | "Sem informação">(
    "Todos",
  );
  const [selectedPortfolio, setSelectedPortfolio] = useState<"Todas" | "A" | "B" | "C" | "D" | "Não classificado">(
    "Todas",
  );
  const [selectedExecutiveRisk, setSelectedExecutiveRisk] = useState<
    "Todos" | "Somente risco executivo"
  >("Todos");
  const [selectedPhase, setSelectedPhase] = useState("Todas");
  const [cancellationOnly, setCancellationOnly] = useState<"Todos" | "Sim">("Todos");
  const [search, setSearch] = useState("");
  const [selectedClientKey, setSelectedClientKey] = useState("");
  const [draftOverride, setDraftOverride] = useState<ManualRiskOverride | null>(null);
  const [saveFeedback, setSaveFeedback] = useState("");
  const [meetingNotes, setMeetingNotes] = useState<Record<string, string>>(() => readMeetingNotes());
  const [draftMeetingNote, setDraftMeetingNote] = useState("");
  const [meetingFeedback, setMeetingFeedback] = useState("");

  const records = useMemo(() => {
    const baseRecords = buildHealthRecords(executiveData);
    return applyOperationalContext(baseRecords, [], manualOverrides);
  }, [executiveData, manualOverrides]);

  const phases = useMemo(() => {
    return ["Todas", ...new Set(records.map((item) => item.phase).filter(Boolean))];
  }, [records]);

  const scopedRecords = useMemo(() => {
    return records.filter((item) => {
      const matchesImplanter =
        selectedImplanter === "Todos" || item.implanter === selectedImplanter;
      const matchesSegment =
        selectedSegment === "Todos" || item.segment === selectedSegment;

      return matchesImplanter && matchesSegment;
    });
  }, [records, selectedImplanter, selectedSegment]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return scopedRecords
      .filter((item) => {
        const matchesClassification =
          selectedClassifications.length === 0 ||
          selectedClassifications.includes(item.classification);
        const matchesPortfolio =
          selectedPortfolio === "Todas" || item.portfolioClass === selectedPortfolio;
        const matchesExecutiveRisk =
          selectedExecutiveRisk === "Todos" || item.hasExecutiveRisk;
        const matchesPhase = selectedPhase === "Todas" || item.phase === selectedPhase;
        const matchesCancellation =
          cancellationOnly === "Todos" || item.hasCancellationOpportunity;
        const matchesSearch =
          normalizedSearch.length === 0 ||
          item.clientName.toLowerCase().includes(normalizedSearch) ||
          item.projectName.toLowerCase().includes(normalizedSearch);

        return (
          matchesClassification &&
          matchesPortfolio &&
          matchesExecutiveRisk &&
          matchesPhase &&
          matchesCancellation &&
          matchesSearch
        );
      })
      .slice()
      .sort(comparePriority);
  }, [
    cancellationOnly,
    scopedRecords,
    search,
    selectedClassifications,
    selectedExecutiveRisk,
    selectedPhase,
    selectedPortfolio,
  ]);

  function clearSecondaryFilters() {
    setSelectedClassifications([]);
    setSelectedPhase("Todas");
    setCancellationOnly("Todos");
    setSearch("");
  }

  function applyExecutiveRiskFocus(portfolio: "A" | "B") {
    clearSecondaryFilters();
    setSelectedPortfolio(portfolio);
    setSelectedExecutiveRisk("Somente risco executivo");
  }

  function toggleClassification(classification: HealthClassification) {
    setSelectedClassifications((current) =>
      current.includes(classification)
        ? current.filter((item) => item !== classification)
        : [...current, classification],
    );
  }

  useEffect(() => {
    if (filteredRecords.length === 0) {
      setSelectedClientKey("");
      return;
    }
    if (!filteredRecords.some((item) => item.key === selectedClientKey)) {
      setSelectedClientKey(filteredRecords[0].key);
    }
  }, [filteredRecords, selectedClientKey]);

  const selectedRecord = filteredRecords.find((item) => item.key === selectedClientKey) ?? null;
  const meetingNotesKey = selectedImplanter || "Todos";

  useEffect(() => {
    setDraftMeetingNote(meetingNotes[meetingNotesKey] ?? "");
    setMeetingFeedback("");
  }, [meetingNotes, meetingNotesKey]);

  useEffect(() => {
    if (!selectedRecord) {
      setDraftOverride(null);
      setSaveFeedback("");
      return;
    }
    const currentOverride = manualOverrides[selectedRecord.key];
    setSaveFeedback("");
    setDraftOverride({
      recordKey: selectedRecord.key,
      clientName: selectedRecord.clientName,
      manualClassification: currentOverride?.manualClassification ?? "",
      forecastMovement: currentOverride?.forecastMovement ?? "",
      excludeFromForecast: currentOverride?.excludeFromForecast ?? false,
      operationalStatus: currentOverride?.operationalStatus ?? "",
      note: currentOverride?.note ?? selectedRecord.manualNote ?? "",
      nextStep: currentOverride?.nextStep ?? selectedRecord.manualNextStep ?? "",
      updatedAt: currentOverride?.updatedAt ?? "",
    });
  }, [manualOverrides, selectedRecord]);

  const summary = useMemo(() => {
    const totalProjects = filteredRecords.length;
    const totalMrr = filteredRecords.reduce((sum, item) => sum + item.mrr, 0);
    const riskProjects = filteredRecords.filter((item) => item.classification === "Risco");
    const attentionProjects = filteredRecords.filter((item) => item.classification === "Atenção");
    const healthyProjects = filteredRecords.filter((item) => item.classification === "Saudável");
    const averageScore =
      totalProjects > 0
        ? filteredRecords.reduce((sum, item) => sum + item.healthScore, 0) / totalProjects
        : 0;
    const portfolioACount = filteredRecords.filter((item) => item.portfolioClass === "A").length;
    const portfolioARiskProjects = scopedRecords.filter(
      (item) => item.portfolioClass === "A" && item.hasExecutiveRisk,
    );
    const portfolioAExecutiveRiskMrr = portfolioARiskProjects.reduce((sum, item) => sum + item.mrr, 0);
    const portfolioBRiskProjects = scopedRecords.filter(
      (item) => item.portfolioClass === "B" && item.hasExecutiveRisk,
    );
    const portfolioBExecutiveRiskMrr = portfolioBRiskProjects.reduce((sum, item) => sum + item.mrr, 0);
    const riskMrr = riskProjects.reduce((sum, item) => sum + item.mrr, 0);
    const topPriority = filteredRecords[0] ?? null;

    const mrrByPortfolio = ["A", "B", "C", "D", "Não classificado"].map((portfolio) => ({
      label: portfolio,
      value: filteredRecords
        .filter((item) => item.portfolioClass === portfolio)
        .reduce((sum, item) => sum + item.mrr, 0),
    }));

    return {
      totalProjects,
      totalMrr,
      riskMrr,
      averageScore,
      riskCount: riskProjects.length,
      attentionCount: attentionProjects.length,
      healthyCount: healthyProjects.length,
      portfolioACount,
      portfolioARiskCount: portfolioARiskProjects.length,
      portfolioARiskClients: portfolioARiskProjects.map((item) => item.clientName),
      portfolioAExecutiveRiskMrr,
      portfolioBRiskCount: portfolioBRiskProjects.length,
      portfolioBRiskClients: portfolioBRiskProjects.map((item) => item.clientName),
      portfolioBExecutiveRiskMrr,
      topPriority,
      topFive: filteredRecords.slice(0, 5),
      scoreDistribution: [
        { label: "Saudável", value: healthyProjects.length, color: "#16a34a", helper: `${healthyProjects.length} cliente(s)` },
        { label: "Atenção", value: attentionProjects.length, color: "#d97706", helper: `${attentionProjects.length} cliente(s)` },
        { label: "Risco", value: riskProjects.length, color: "#dc2626", helper: `${riskProjects.length} cliente(s)` },
      ],
      mrrByPortfolio: mrrByPortfolio.map((item) => ({
        ...item,
        color:
          item.label === "A"
            ? "#2563eb"
            : item.label === "B"
              ? "#7c3aed"
              : item.label === "C"
                ? "#64748b"
                : "#94a3b8",
        helper: formatCurrencyBRL(item.value),
      })),
      projectsByImplanter: buildDistribution(filteredRecords, (item) => item.implanter)
        .slice(0, 8)
        .map((item) => ({ ...item, color: "#0f766e", helper: `${item.value} projeto(s)` })),
    };
  }, [filteredRecords, scopedRecords]);

  function handleDraftOverrideChange<K extends keyof ManualRiskOverride>(field: K, value: ManualRiskOverride[K]) {
    setDraftOverride((current) => {
      if (!current || !selectedRecord) {
        return current;
      }
      return {
        ...current,
        clientName: selectedRecord.clientName,
        [field]: value,
      };
    });
  }

  function persistOverride(override: ManualRiskOverride) {
    onManualOverrideChange({
      ...override,
      updatedAt: new Date().toISOString(),
    });
    setSaveFeedback("Ajuste salvo na batida.");
  }

  function buildOverrideForRecord(record: HealthClientRecord): ManualRiskOverride {
    const currentOverride = manualOverrides[record.key];
    return {
      recordKey: record.key,
      clientName: record.clientName,
      manualClassification: currentOverride?.manualClassification ?? "",
      forecastMovement: currentOverride?.forecastMovement ?? "",
      excludeFromForecast: currentOverride?.excludeFromForecast ?? false,
      operationalStatus: currentOverride?.operationalStatus ?? "",
      note: currentOverride?.note ?? record.manualNote ?? "",
      nextStep: currentOverride?.nextStep ?? record.manualNextStep ?? "",
      updatedAt: currentOverride?.updatedAt ?? "",
    };
  }

  function toggleForecastInclusion(excludeFromForecast: boolean) {
    if (!draftOverride || !selectedRecord) {
      return;
    }
    const nextDraft = {
      ...draftOverride,
      clientName: selectedRecord.clientName,
      excludeFromForecast,
    };
    setDraftOverride(nextDraft);
    persistOverride(nextDraft);
  }

  function handleSaveOverride() {
    if (!draftOverride) {
      return;
    }
    persistOverride(draftOverride);
  }

  function handleSaveMeetingNote() {
    const nextNotes = {
      ...meetingNotes,
      [meetingNotesKey]: draftMeetingNote,
    };
    setMeetingNotes(nextNotes);
    persistMeetingNotes(nextNotes);
    setMeetingFeedback("Transcrição salva para este implanter.");
  }

  function addRecordToForecast(record: HealthClientRecord) {
    const nextOverride = {
      ...buildOverrideForRecord(record),
      manualClassification: "Risco" as HealthClassification,
      forecastMovement: "Projeto em risco" as ForecastMovement,
      excludeFromForecast: false,
    };
    if (selectedRecord?.key === record.key) {
      setDraftOverride(nextOverride);
    }
    persistOverride(nextOverride);
  }

  function removeRecordFromForecast(record: HealthClientRecord) {
    const nextOverride = {
      ...buildOverrideForRecord(record),
      excludeFromForecast: true,
    };
    if (selectedRecord?.key === record.key) {
      setDraftOverride(nextOverride);
    }
    persistOverride(nextOverride);
  }

  function handleDownloadPriorityDocument() {
    const itemsByMrr = filteredRecords
      .slice()
      .sort((a, b) => b.mrr - a.mrr || comparePriority(a, b));
    const documentHtml = buildPriorityDocument({
      implanter: selectedImplanter,
      generatedAt: new Date(),
      summary,
      items: itemsByMrr,
      meetingNote: meetingNotes[meetingNotesKey] ?? "",
    });
    const blob = new Blob([documentHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (selectedImplanter === "Todos" ? "carteira-geral" : selectedImplanter)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    link.href = url;
    link.download = `priorizacao-semanal-${safeName}.html`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!executiveData || records.length === 0) {
    return (
      <section style={styles.wrapper}>
        <div style={styles.emptyCard}>
          <p style={styles.eyebrow}>Batida de funil</p>
          <h2 style={styles.title}>Nenhuma base carregada para priorização</h2>
          <p style={styles.subtitle}>
            Suba as planilhas executivas para montar a carteira, calcular o Health Score e priorizar
            a semana do time de implantação.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.wrapper}>
      <header style={styles.hero}>
        <div style={styles.heroCopy}>
          <p style={styles.eyebrow}>Batida de funil</p>
          <h2 style={styles.title}>Fila de decisão da liderança</h2>
          <p style={styles.subtitle}>
            A carteira agora está ordenada para responder rapidamente quem precisa de energia
            primeiro, quanto de MRR está exposto e quais clientes do implanter exigem ação nesta semana.
          </p>
        </div>
        <div style={styles.heroHighlight}>
          <span style={styles.heroLabel}>Cliente para priorizar na semana</span>
          <strong style={styles.heroName}>
            {summary.topPriority?.clientName ?? "Sem informação"}
          </strong>
          <span style={styles.heroMeta}>
            {summary.topPriority
              ? `${summary.topPriority.priorityReason} • ${formatCurrencyBRL(summary.topPriority.mrr)}`
              : "Nenhum cliente com os filtros atuais"}
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

          <FilterField label="Classificação do score">
            <div style={styles.multiSelectGroup}>
              {(["Saudável", "Atenção", "Risco"] as HealthClassification[]).map((classification) => {
                const isActive = selectedClassifications.includes(classification);
                return (
                  <button
                    key={classification}
                    type="button"
                    onClick={() => toggleClassification(classification)}
                    style={{
                      ...styles.filterChip,
                      ...(isActive ? styles.filterChipActive : null),
                    }}
                  >
                    {classification}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedClassifications([])}
                style={{
                  ...styles.filterChip,
                  ...(selectedClassifications.length === 0 ? styles.filterChipActiveNeutral : null),
                }}
              >
                Todas
              </button>
            </div>
          </FilterField>

          <FilterField label="Carteira">
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
          </FilterField>

          <FilterField label="Curva A/B em risco">
            <div style={styles.multiSelectGroup}>
              <button
                type="button"
                onClick={() => applyExecutiveRiskFocus("A")}
                style={styles.filterChip}
              >
                Carteira A em risco
              </button>
              <button
                type="button"
                onClick={() => applyExecutiveRiskFocus("B")}
                style={styles.filterChip}
              >
                Carteira B em risco
              </button>
              <button
                type="button"
                onClick={() => {
                  clearSecondaryFilters();
                  setSelectedPortfolio("Todas");
                  setSelectedExecutiveRisk("Todos");
                }}
                style={{
                  ...styles.filterChip,
                  ...(selectedPortfolio === "Todas" && selectedExecutiveRisk === "Todos"
                    ? styles.filterChipActiveNeutral
                    : null),
                }}
              >
                Limpar
              </button>
            </div>
          </FilterField>

          <FilterField label="Segmento">
            <select
              value={selectedSegment}
              onChange={(event) =>
                setSelectedSegment(
                  event.target.value as "Todos" | "MID" | "SMB" | "Sem informação",
                )
              }
              style={styles.input}
            >
              <option value="Todos">Todos</option>
              <option value="MID">MID</option>
              <option value="SMB">SMB</option>
              <option value="Sem informação">Sem informação</option>
            </select>
          </FilterField>

          <FilterField label="Risco executivo">
            <select
              value={selectedExecutiveRisk}
              onChange={(event) =>
                setSelectedExecutiveRisk(
                  event.target.value as "Todos" | "Somente risco executivo",
                )
              }
              style={styles.input}
            >
              <option value="Todos">Todos</option>
              <option value="Somente risco executivo">Somente risco executivo</option>
            </select>
          </FilterField>

          <FilterField label="Fase">
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

          <FilterField label="Oportunidade de cancelamento">
            <select
              value={cancellationOnly}
              onChange={(event) => setCancellationOnly(event.target.value as "Todos" | "Sim")}
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

      <section style={styles.meetingCard}>
        <div style={styles.meetingHeader}>
          <div>
            <p style={styles.panelEyebrow}>Batida do implanter</p>
            <h3 style={styles.panelTitle}>Transcrição e orientações da semana</h3>
          </div>
          <button type="button" onClick={handleSaveMeetingNote} style={styles.downloadButton}>
            Salvar transcrição
          </button>
        </div>
        <textarea
          value={draftMeetingNote}
          onChange={(event) => setDraftMeetingNote(event.target.value)}
          placeholder="Cole aqui a transcrição da batida, decisões, combinados e pontos de atenção deste implanter."
          style={styles.meetingTextarea}
          rows={6}
        />
        <div style={styles.meetingFooter}>
          <span style={styles.downloadHint}>
            Esta transcrição fica salva para {selectedImplanter === "Todos" ? "a carteira geral" : selectedImplanter} e entra no relatório baixado.
          </span>
          {meetingFeedback ? <strong style={styles.saveFeedback}>{meetingFeedback}</strong> : null}
        </div>
      </section>

      <div style={styles.metricsGrid}>
        <MetricCard label="Projetos em aberto" value={summary.totalProjects} tone="neutral" />
        <MetricCard label="MRR total da carteira" value={formatCurrencyBRL(summary.totalMrr)} tone="positive" />
        <MetricCard label="MRR em risco" value={formatCurrencyBRL(summary.riskMrr)} tone="critical" />
        <MetricCard label="Health Score médio" value={Math.round(summary.averageScore)} tone="neutral" />
        <MetricCard label="Projetos em risco" value={summary.riskCount} tone="critical" />
        <MetricCard label="Projetos em atenção" value={summary.attentionCount} tone="warning" />
        <MetricCard label="Projetos saudáveis" value={summary.healthyCount} tone="positive" />
        <MetricCard label="Projetos carteira A" value={summary.portfolioACount} tone="portfolioA" />
        <MetricCard
          label="Carteira A em risco"
          value={summary.portfolioARiskCount}
          tone={summary.portfolioARiskCount > 0 ? "critical" : "neutral"}
          helper={summary.portfolioARiskClients.slice(0, 2).join(" • ")}
        />
        <MetricCard
          label="MRR A em risco"
          value={formatCurrencyBRL(summary.portfolioAExecutiveRiskMrr)}
          tone={summary.portfolioAExecutiveRiskMrr > 0 ? "critical" : "neutral"}
        />
        <MetricCard
          label="Carteira B em risco"
          value={summary.portfolioBRiskCount}
          tone={summary.portfolioBRiskCount > 0 ? "warning" : "neutral"}
          helper={summary.portfolioBRiskClients.slice(0, 2).join(" • ")}
        />
        <MetricCard
          label="MRR B em risco"
          value={formatCurrencyBRL(summary.portfolioBExecutiveRiskMrr)}
          tone={summary.portfolioBExecutiveRiskMrr > 0 ? "warning" : "neutral"}
        />
      </div>

      <div style={styles.topGrid}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <p style={styles.panelEyebrow}>Prioridade da semana</p>
              <h3 style={styles.panelTitle}>Top 5 clientes para atacar agora</h3>
            </div>
            <div style={styles.downloadBox}>
              <button type="button" onClick={handleDownloadPriorityDocument} style={styles.downloadButton}>
                Baixar HTML compartilhável
              </button>
              <span style={styles.downloadHint}>
                Gera um arquivo `.html` standalone para enviar ao implanter.
              </span>
            </div>
          </div>

          <div style={styles.priorityList}>
            {summary.topFive.map((item, index) => (
              <article key={item.key} style={styles.priorityCard} onClick={() => setSelectedClientKey(item.key)}>
                <div style={styles.priorityTop}>
                  <span style={styles.priorityIndex}>{index + 1}</span>
                  <div>
                    <strong style={styles.priorityClient}>{item.clientName}</strong>
                    <p style={styles.priorityMeta}>
                      {item.implanter} • {item.erpName} • {item.status} • {item.portfolioClass}
                    </p>
                  </div>
                </div>
                <p style={styles.priorityReason}>{item.priorityReason}</p>
                <div style={styles.priorityBottom}>
                  <span style={styles.priorityBadge}>{formatCurrencyBRL(item.mrr)}</span>
                  <span style={styles.priorityAction}>{item.recommendedAction}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <p style={styles.panelEyebrow}>Distribuição</p>
            <h3 style={styles.panelTitle}>Health Score da carteira</h3>
          </div>
          <BarList items={summary.scoreDistribution} />
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <p style={styles.panelEyebrow}>MRR</p>
            <h3 style={styles.panelTitle}>MRR por classificação de carteira</h3>
          </div>
          <BarList items={summary.mrrByPortfolio} />
        </section>
      </div>

      <div style={styles.tableLayout}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <p style={styles.panelEyebrow}>Carteira completa</p>
            <h3 style={styles.panelTitle}>Todos os projetos priorizados</h3>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Cliente</th>
                  <th style={styles.th}>Implanter</th>
                  <th style={styles.th}>Carteira</th>
                  <th style={styles.th}>Prioridade</th>
                  <th style={styles.th}>MRR</th>
                  <th style={styles.th}>Forecast</th>
                  <th style={styles.th}>ERP</th>
                  <th style={styles.th}>Mensalidade</th>
                  <th style={styles.th}>Risco executivo</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Fase</th>
                  <th style={styles.th}>Tempo de vida</th>
                  <th style={styles.th}>Health Score</th>
                  <th style={styles.th}>Classificação</th>
                  <th style={styles.th}>Sinais de risco</th>
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
                    <td style={styles.td}>{item.implanter}</td>
                    <td style={styles.td}>
                      <span style={portfolioPillStyle(item.portfolioClass)}>{item.portfolioClass}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.priorityScorePill}>{item.priorityScore}</span>
                    </td>
                    <td style={styles.td}>{formatCurrencyBRL(item.mrr)}</td>
                    <td style={styles.td}>
                      {item.forecastMovement && !manualOverrides[item.key]?.excludeFromForecast ? (
                        <div style={styles.forecastCell}>
                          <span style={styles.forecastActivePill}>{item.forecastMovement}</span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeRecordFromForecast(item);
                            }}
                            style={styles.inlineActionButton}
                          >
                            Remover
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            addRecordToForecast(item);
                          }}
                          style={styles.inlinePrimaryButton}
                        >
                          Adicionar
                        </button>
                      )}
                    </td>
                    <td style={styles.td}>{item.erpName}</td>
                    <td style={styles.td}>
                      {item.hasOverdueSubscription ? (
                        <span style={styles.overduePill}>Vencida</span>
                      ) : (
                        <span style={styles.neutralText}>Em dia</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      {item.executiveRiskLabel ? (
                        <span style={styles.executiveRiskPill}>{item.executiveRiskLabel}</span>
                      ) : (
                        <span style={styles.neutralText}>Sem risco</span>
                      )}
                    </td>
                    <td style={styles.td}>{item.status}</td>
                    <td style={styles.td}>{item.phase}</td>
                    <td style={styles.td}>{item.ageDays} dias</td>
                    <td style={styles.td}>
                      <span style={scorePillStyle(item.classification)}>{item.healthScore}</span>
                    </td>
                    <td style={styles.td}>{item.classification}</td>
                    <td style={styles.td}>{item.riskSignals.join(" • ") || "Sem sinais"}</td>
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
                <p style={styles.detailText}>
                  {selectedRecord.implanter} • {selectedRecord.projectName}
                </p>
              </div>

              <div style={styles.detailHero}>
                <span style={portfolioPillStyle(selectedRecord.portfolioClass)}>
                  Carteira {selectedRecord.portfolioClass}
                </span>
                <strong style={styles.detailScore}>{selectedRecord.healthScore}</strong>
                <span style={scorePillStyle(selectedRecord.classification)}>
                  {selectedRecord.classification}
                </span>
              </div>

              <div style={styles.detailGrid}>
                <DetailMetric label="MRR" value={formatCurrencyBRL(selectedRecord.mrr)} />
                <DetailMetric label="Prioridade da fila" value={String(selectedRecord.priorityScore)} />
                <DetailMetric label="Impacto financeiro" value={String(selectedRecord.priorityImpactScore)} />
                <DetailMetric label="ERP" value={selectedRecord.erpName} />
                <DetailMetric label="Status" value={selectedRecord.status} />
                <DetailMetric
                  label="Risco executivo"
                  value={selectedRecord.executiveRiskLabel ?? "Sem risco"}
                />
                <DetailMetric label="Fase" value={selectedRecord.phase} />
                <DetailMetric label="Tempo de vida" value={`${selectedRecord.ageDays} dias`} />
                <DetailMetric
                  label="Mensalidade"
                  value={selectedRecord.hasOverdueSubscription ? "Vencida" : "Em dia"}
                />
                <DetailMetric
                  label="Engajamento"
                  value={
                    selectedRecord.engagementApplicable
                      ? String(selectedRecord.engagementScore)
                      : "N/A antes do go-live"
                  }
                />
                <DetailMetric label="Risco" value={String(selectedRecord.riskScore)} />
              </div>

              <div style={styles.detailSection}>
                <strong style={styles.detailTitle}>Informações do projeto</strong>
                <p style={styles.detailText}>Status: {selectedRecord.status}</p>
                <p style={styles.detailText}>Fase: {selectedRecord.phase}</p>
                <p style={styles.detailText}>
                  Fator de risco: {selectedRecord.riskFactorDescription || "Sem fator sinalizado"}
                </p>
                <p style={styles.detailText}>
                  Por que parado: {selectedRecord.whyStoppedDescription || "Sem motivo preenchido"}
                </p>
                <p style={styles.detailText}>
                  Descrição: {selectedRecord.projectDescription || "Sem descrição preenchida"}
                </p>
              </div>

              <div style={styles.detailSection}>
                <strong style={styles.detailTitle}>Motivo da priorização</strong>
                <p style={styles.detailText}>{selectedRecord.priorityReason}</p>
              </div>

              <div style={styles.detailSection}>
                <strong style={styles.detailTitle}>Contexto da batida</strong>
                <p style={styles.detailText}>
                  Origem: {manualOverrides[selectedRecord.key] ? "Ajuste manual da fila" : "Sem contexto adicional"}
                </p>
                <p style={styles.detailText}>
                  Movimento: {selectedRecord.forecastMovement ?? "Sem marcação de exit"}
                </p>
                <p style={styles.detailText}>
                  Status da ação: {selectedRecord.manualOperationalStatus || "Sem marcação"}
                </p>
                <p style={styles.detailText}>
                  Forecast ativo: {manualOverrides[selectedRecord.key]?.excludeFromForecast ? "Não, retirado manualmente" : "Sim"}
                </p>
                <p style={styles.detailText}>
                  Próximo passo: {selectedRecord.manualNextStep || "Sem próximo passo"}
                </p>
                <p style={styles.detailText}>
                  Observação: {selectedRecord.manualNote || "Sem observação manual"}
                </p>
              </div>

              <div style={styles.detailSection}>
                <strong style={styles.detailTitle}>Sinais de risco</strong>
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
                <strong style={styles.detailTitle}>Observações relevantes</strong>
                <ul style={styles.detailList}>
                  {selectedRecord.historyNotes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                  <li>Início: {formatDateBR(selectedRecord.startedAt)}</li>
                </ul>
              </div>

              <div style={styles.detailSection}>
                <strong style={styles.detailTitle}>Ação recomendada</strong>
                <p style={styles.detailText}>{selectedRecord.recommendedAction}</p>
              </div>

              <div style={styles.detailSection}>
                <strong style={styles.detailTitle}>Ajuste manual da batida</strong>
                <div style={styles.forecastActionRow}>
                  <button
                    type="button"
                    onClick={() => toggleForecastInclusion(true)}
                    style={{
                      ...styles.secondaryButton,
                      ...(draftOverride?.excludeFromForecast ? styles.secondaryButtonActiveCritical : null),
                    }}
                  >
                    Remover do forecast agora
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleForecastInclusion(false)}
                    style={{
                      ...styles.secondaryButton,
                      ...styles.secondaryButtonPositive,
                      ...(!draftOverride?.excludeFromForecast ? styles.secondaryButtonActivePositive : null),
                    }}
                  >
                    Voltar para o forecast
                  </button>
                </div>

                <div style={styles.overrideGrid}>
                  <label style={styles.field}>
                    <span style={styles.label}>Criticidade manual</span>
                    <select
                      value={draftOverride?.manualClassification ?? ""}
                      onChange={(event) =>
                        handleDraftOverrideChange(
                          "manualClassification",
                          event.target.value as HealthClassification | "",
                        )
                      }
                      style={styles.input}
                    >
                      <option value="">Automática</option>
                      <option value="Saudável">Saudável</option>
                      <option value="Atenção">Atenção</option>
                      <option value="Risco">Risco</option>
                    </select>
                  </label>

                  <label style={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={draftOverride?.excludeFromForecast ?? false}
                      onChange={(event) => toggleForecastInclusion(event.target.checked)}
                    />
                    <span style={styles.checkboxLabel}>Tirar este cliente do forecast</span>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Movimento forecast</span>
                    <select
                      value={draftOverride?.forecastMovement ?? ""}
                      onChange={(event) =>
                        handleDraftOverrideChange(
                          "forecastMovement",
                          event.target.value as ForecastMovement | "",
                        )
                      }
                      style={styles.input}
                    >
                      <option value="">Sem marcação</option>
                      {FORECAST_MOVEMENTS.map((movement) => (
                        <option key={movement} value={movement}>
                          {movement}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Situação operacional</span>
                    <select
                      value={draftOverride?.operationalStatus ?? ""}
                      onChange={(event) =>
                        handleDraftOverrideChange("operationalStatus", event.target.value)
                      }
                      style={styles.input}
                    >
                      <option value="">Sem marcação</option>
                      {OPERATIONAL_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Próximo passo</span>
                    <input
                      type="text"
                      value={draftOverride?.nextStep ?? ""}
                      onChange={(event) =>
                        handleDraftOverrideChange("nextStep", event.target.value)
                      }
                      placeholder="Defina a próxima ação da semana"
                      style={styles.input}
                    />
                  </label>
                </div>

                <label style={styles.field}>
                  <span style={styles.label}>Observação da batida</span>
                  <textarea
                    value={draftOverride?.note ?? ""}
                    onChange={(event) => handleDraftOverrideChange("note", event.target.value)}
                    placeholder="Registre o contexto decidido na reunião"
                    style={styles.textarea}
                    rows={4}
                  />
                </label>

                <div style={styles.overrideFooter}>
                  <button type="button" onClick={handleSaveOverride} style={styles.downloadButton}>
                    Salvar ajuste manual
                  </button>
                  {saveFeedback ? <strong style={styles.saveFeedback}>{saveFeedback}</strong> : null}
                  <span style={styles.downloadHint}>
                    O ajuste alimenta a fila e a nova aba de forecast.
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div style={styles.emptyText}>Nenhum cliente disponível com os filtros atuais.</div>
          )}
        </aside>
      </div>
    </section>
  );
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
  helper,
}: {
  label: string;
  value: string | number;
  tone: "neutral" | "positive" | "warning" | "critical" | "portfolioA";
  helper?: string;
}): JSX.Element {
  const toneStyles =
    tone === "critical"
      ? { border: "#fecaca", accent: "#b91c1c", bg: "linear-gradient(180deg, #fff8f8 0%, #fff1f2 100%)" }
      : tone === "warning"
        ? { border: "#fed7aa", accent: "#c2410c", bg: "linear-gradient(180deg, #fffaf4 0%, #fff7ed 100%)" }
        : tone === "positive"
          ? { border: "#bbf7d0", accent: "#047857", bg: "linear-gradient(180deg, #f8fffb 0%, #ecfdf3 100%)" }
          : tone === "portfolioA"
            ? { border: "#bfdbfe", accent: "#2563eb", bg: "linear-gradient(180deg, #f4f8ff 0%, #eaf2ff 100%)" }
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
      {helper ? <span style={styles.metricHelper}>{helper}</span> : null}
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
          <div style={styles.barHeader}>
            <strong style={styles.barLabel}>{item.label}</strong>
            <span style={styles.barValue}>{item.helper}</span>
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
        </article>
      ))}
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <article style={styles.detailMetric}>
      <span style={styles.detailMetricLabel}>{label}</span>
      <strong style={styles.detailMetricValue}>{value}</strong>
    </article>
  );
}

function scorePillStyle(classification: HealthClassification): CSSProperties {
  if (classification === "Risco") {
    return { ...styles.pill, background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" };
  }
  if (classification === "Atenção") {
    return { ...styles.pill, background: "#ffedd5", color: "#9a3412", borderColor: "#fed7aa" };
  }
  return { ...styles.pill, background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" };
}

function portfolioPillStyle(portfolio: HealthClientRecord["portfolioClass"]): CSSProperties {
  if (portfolio === "A") {
    return { ...styles.pill, background: "#dbeafe", color: "#1d4ed8", borderColor: "#bfdbfe" };
  }
  if (portfolio === "B") {
    return { ...styles.pill, background: "#ede9fe", color: "#6d28d9", borderColor: "#ddd6fe" };
  }
  if (portfolio === "C") {
    return { ...styles.pill, background: "#f1f5f9", color: "#334155", borderColor: "#cbd5e1" };
  }
  if (portfolio === "D") {
    return { ...styles.pill, background: "#fff7ed", color: "#c2410c", borderColor: "#fed7aa" };
  }
  return { ...styles.pill, background: "#f8fafc", color: "#475569", borderColor: "#e2e8f0" };
}

const styles: Record<string, CSSProperties> = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  hero: { display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(300px, 0.95fr)", gap: "18px" },
  heroCopy: {
    padding: "28px 30px",
    borderRadius: "28px",
    background: "linear-gradient(135deg, rgba(15, 23, 42, 0.97) 0%, rgba(29, 78, 216, 0.92) 56%, rgba(8, 145, 178, 0.88) 100%)",
    color: "#f8fafc",
    boxShadow: "0 30px 60px rgba(15, 23, 42, 0.16)",
  },
  heroHighlight: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "28px",
    borderRadius: "28px",
    background: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)",
    border: "1px solid rgba(37, 99, 235, 0.18)",
    boxShadow: "0 24px 44px rgba(37, 99, 235, 0.12)",
  },
  heroLabel: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#1d4ed8", fontWeight: 800 },
  heroName: { fontSize: "30px", lineHeight: 1.1, color: "#0f172a" },
  heroMeta: { color: "#334155", lineHeight: 1.5, fontWeight: 600 },
  eyebrow: { margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "12px", fontWeight: 800, color: "rgba(255,255,255,0.72)" },
  title: { margin: "10px 0 12px", fontSize: "34px", lineHeight: 1.1, letterSpacing: "-0.03em" },
  subtitle: { margin: 0, maxWidth: "760px", lineHeight: 1.7, color: "rgba(248,250,252,0.8)" },
  filtersCard: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,244,255,0.96) 100%)",
    border: "1px solid rgba(106, 63, 150, 0.12)",
    borderRadius: "24px",
    padding: "22px",
    boxShadow: "0 20px 40px rgba(83, 40, 125, 0.08)",
  },
  filtersGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" },
  meetingCard: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(240,253,250,0.96) 100%)",
    border: "1px solid rgba(15, 118, 110, 0.14)",
    borderRadius: "24px",
    padding: "22px",
    boxShadow: "0 20px 40px rgba(15, 118, 110, 0.08)",
  },
  meetingHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "14px",
    flexWrap: "wrap",
  },
  meetingTextarea: {
    width: "100%",
    borderRadius: "16px",
    border: "1px solid rgba(15, 118, 110, 0.18)",
    padding: "14px 16px",
    background: "#fff",
    color: "#0f172a",
    resize: "vertical",
    minHeight: "150px",
    fontFamily: "inherit",
    lineHeight: 1.55,
  },
  meetingFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginTop: "10px",
    flexWrap: "wrap",
  },
  field: { display: "flex", flexDirection: "column", gap: "8px" },
  checkboxField: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid rgba(106, 63, 150, 0.16)",
    background: "#fff",
  },
  checkboxLabel: { color: "#334155", fontWeight: 700, lineHeight: 1.4 },
  saveFeedback: { color: "#0f766e", fontSize: "12px", fontWeight: 800 },
  forecastActionRow: { display: "flex", gap: "10px", flexWrap: "wrap" },
  secondaryButton: {
    borderRadius: "14px",
    border: "1px solid rgba(220, 38, 38, 0.18)",
    padding: "12px 14px",
    background: "#fff",
    color: "#991b1b",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButtonPositive: {
    borderColor: "rgba(15, 118, 110, 0.2)",
    color: "#0f766e",
  },
  secondaryButtonActiveCritical: {
    background: "#fee2e2",
    borderColor: "#fecaca",
  },
  secondaryButtonActivePositive: {
    background: "#dcfce7",
    borderColor: "#bbf7d0",
  },
  label: { fontWeight: 800, fontSize: "12px", color: "#5b3a81", textTransform: "uppercase", letterSpacing: "0.06em" },
  multiSelectGroup: { display: "flex", flexWrap: "wrap", gap: "8px" },
  filterChip: {
    borderRadius: "999px",
    border: "1px solid rgba(106, 63, 150, 0.18)",
    padding: "10px 12px",
    background: "#ffffff",
    color: "#334155",
    fontWeight: 700,
    cursor: "pointer",
  },
  filterChipActive: {
    background: "#ede9fe",
    color: "#5b21b6",
    borderColor: "#c4b5fd",
  },
  filterChipActiveNeutral: {
    background: "#e0f2fe",
    color: "#075985",
    borderColor: "#bae6fd",
  },
  input: {
    borderRadius: "14px",
    border: "1px solid rgba(106, 63, 150, 0.16)",
    padding: "13px 14px",
    background: "#fff",
    color: "#0f172a",
  },
  textarea: {
    borderRadius: "14px",
    border: "1px solid rgba(106, 63, 150, 0.16)",
    padding: "13px 14px",
    background: "#fff",
    color: "#0f172a",
    resize: "vertical",
    minHeight: "110px",
    fontFamily: "inherit",
  },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" },
  metricCard: { display: "flex", flexDirection: "column", gap: "10px", minHeight: "130px", padding: "20px", borderRadius: "22px", border: "1px solid transparent" },
  metricLabel: { color: "#475569", fontSize: "13px", lineHeight: 1.5, fontWeight: 700 },
  metricValue: { fontSize: "30px", lineHeight: 1.05, letterSpacing: "-0.03em", color: "#0f172a" },
  metricHelper: { color: "#64748b", fontSize: "12px", lineHeight: 1.5, fontWeight: 600 },
  topGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(300px, 0.8fr) minmax(300px, 0.8fr)", gap: "18px" },
  tableLayout: { display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(320px, 0.8fr)", gap: "18px", alignItems: "start" },
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
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 24px 42px rgba(15, 23, 42, 0.06)",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  panelHeader: { marginBottom: "18px", display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" },
  panelEyebrow: { margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 800, color: "#0f766e" },
  panelTitle: { margin: "8px 0 0", fontSize: "24px", lineHeight: 1.2, color: "#0f172a" },
  downloadButton: {
    border: "none",
    borderRadius: "14px",
    padding: "12px 14px",
    background: "#0f766e",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(15, 118, 110, 0.18)",
  },
  downloadBox: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    alignItems: "flex-end",
  },
  downloadHint: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 600,
    textAlign: "right",
    maxWidth: "220px",
    lineHeight: 1.4,
  },
  priorityList: { display: "flex", flexDirection: "column", gap: "12px" },
  priorityCard: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "18px",
    borderRadius: "20px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    border: "1px solid rgba(191, 219, 254, 0.9)",
    cursor: "pointer",
  },
  priorityTop: { display: "flex", gap: "14px", alignItems: "flex-start" },
  priorityIndex: {
    width: "32px",
    height: "32px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: 800,
  },
  priorityClient: { color: "#0f172a" },
  priorityMeta: { margin: "4px 0 0", color: "#64748b", lineHeight: 1.5 },
  priorityReason: { margin: 0, color: "#334155", lineHeight: 1.5, fontWeight: 600 },
  priorityBottom: { display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between" },
  priorityBadge: { color: "#1d4ed8", fontWeight: 800 },
  priorityScorePill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "38px",
    padding: "7px 10px",
    borderRadius: "999px",
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
    fontSize: "12px",
    fontWeight: 900,
  },
  priorityAction: { color: "#475569", fontSize: "13px", lineHeight: 1.5 },
  barList: { display: "flex", flexDirection: "column", gap: "14px" },
  barItem: { display: "flex", flexDirection: "column", gap: "8px" },
  barHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" },
  barLabel: { color: "#1f2937" },
  barValue: { color: "#475569", fontWeight: 700, fontSize: "13px" },
  barTrack: { width: "100%", height: "12px", background: "#e5eef9", borderRadius: "999px", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: "999px" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", minWidth: "1280px" },
  th: { textAlign: "left", fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 12px 6px" },
  tr: { cursor: "pointer" },
  trSelected: { outline: "2px solid rgba(37, 99, 235, 0.18)" },
  td: { padding: "16px 12px", background: "#ffffff", borderTop: "1px solid rgba(226, 232, 240, 0.9)", borderBottom: "1px solid rgba(226, 232, 240, 0.9)", color: "#334155", verticalAlign: "top", fontSize: "14px", lineHeight: 1.45 },
  tdStrong: { padding: "16px 12px", background: "#ffffff", borderTop: "1px solid rgba(226, 232, 240, 0.9)", borderBottom: "1px solid rgba(226, 232, 240, 0.9)", color: "#0f172a", verticalAlign: "top", fontSize: "14px", lineHeight: 1.45, fontWeight: 800 },
  tdAction: { padding: "16px 12px", background: "#ffffff", borderTop: "1px solid rgba(226, 232, 240, 0.9)", borderBottom: "1px solid rgba(226, 232, 240, 0.9)", color: "#334155", verticalAlign: "top", fontSize: "13px", lineHeight: 1.5, minWidth: "280px" },
  forecastCell: { display: "flex", flexDirection: "column", gap: "8px", minWidth: "170px" },
  forecastActivePill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: 800,
    border: "1px solid #bfdbfe",
  },
  inlineActionButton: {
    borderRadius: "12px",
    border: "1px solid rgba(220, 38, 38, 0.16)",
    padding: "9px 10px",
    background: "#fff",
    color: "#991b1b",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  inlinePrimaryButton: {
    borderRadius: "12px",
    border: "1px solid rgba(15, 118, 110, 0.18)",
    padding: "9px 10px",
    background: "#ecfdf5",
    color: "#0f766e",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  pill: { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "6px 10px", borderRadius: "999px", border: "1px solid transparent", fontWeight: 800, minWidth: "48px" },
  detailHeader: { display: "flex", flexDirection: "column", gap: "8px" },
  detailHero: { display: "flex", flexDirection: "column", gap: "12px", padding: "18px", borderRadius: "22px", background: "linear-gradient(180deg, #f8fbff 0%, #eff6ff 100%)", border: "1px solid rgba(191, 219, 254, 0.8)" },
  detailScore: { fontSize: "42px", lineHeight: 1, color: "#0f172a" },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" },
  detailMetric: { padding: "14px", borderRadius: "18px", background: "#fff", border: "1px solid rgba(226, 232, 240, 0.9)", display: "flex", flexDirection: "column", gap: "6px" },
  detailMetricLabel: { color: "#64748b", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" },
  detailMetricValue: { color: "#0f172a", fontSize: "15px" },
  detailSection: { display: "flex", flexDirection: "column", gap: "10px" },
  overrideGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" },
  overrideFooter: { display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" },
  detailTitle: { color: "#0f172a", fontSize: "15px" },
  detailText: { margin: 0, color: "#334155", lineHeight: 1.6 },
  detailList: { margin: 0, paddingLeft: "18px", color: "#334155", lineHeight: 1.7 },
  tagList: { display: "flex", flexWrap: "wrap", gap: "8px" },
  tag: { display: "inline-flex", alignItems: "center", padding: "7px 10px", borderRadius: "999px", background: "#fee2e2", color: "#991b1b", fontSize: "12px", fontWeight: 700 },
  tagNeutral: { display: "inline-flex", alignItems: "center", padding: "7px 10px", borderRadius: "999px", background: "#e2e8f0", color: "#334155", fontSize: "12px", fontWeight: 700 },
  overduePill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: "12px",
    fontWeight: 800,
    border: "1px solid #fecaca",
  },
  executiveRiskPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#ffedd5",
    color: "#9a3412",
    fontSize: "12px",
    fontWeight: 800,
    border: "1px solid #fed7aa",
  },
  neutralText: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 600,
  },
  emptyCard: { padding: "36px", borderRadius: "28px", background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,249,255,0.98) 100%)", border: "1px solid rgba(148, 163, 184, 0.18)", boxShadow: "0 24px 42px rgba(15, 23, 42, 0.06)" },
  emptyText: { color: "#64748b", lineHeight: 1.6 },
};

function buildPriorityDocument(input: {
  implanter: string;
  generatedAt: Date;
  meetingNote: string;
  summary: {
    totalProjects: number;
    totalMrr: number;
    riskMrr: number;
    averageScore: number;
    riskCount: number;
    attentionCount: number;
    healthyCount: number;
    portfolioACount: number;
    topPriority: HealthClientRecord | null;
    topFive: HealthClientRecord[];
  };
  items: HealthClientRecord[];
}): string {
  const agenda = buildAgendaSuggestions(input.items);
  const topFive = input.items
    .slice()
    .sort(comparePriority)
    .slice(0, 5);
  const title =
    input.implanter === "Todos"
      ? "Documento de priorização da carteira"
      : `Documento de priorização semanal - ${input.implanter}`;
  const scopeLabel =
    input.implanter === "Todos" ? "Carteira consolidada" : `Implanter: ${input.implanter}`;

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --bg: #f3f6fb;
        --card: #ffffff;
        --text: #0f172a;
        --muted: #475569;
        --line: #dbe4f0;
        --brand: #1d4ed8;
        --brand-dark: #0f172a;
        --ok: #166534;
        --warn: #9a3412;
        --risk: #991b1b;
      }
      * { box-sizing: border-box; }
      @page { size: A4; margin: 12mm; }
      body { font-family: Arial, sans-serif; margin: 0; background: var(--bg); color: var(--text); }
      .page { max-width: 1024px; margin: 0 auto; padding: 32px; }
      .hero {
        background: linear-gradient(135deg, var(--brand-dark) 0%, var(--brand) 58%, #0891b2 100%);
        color: white;
        padding: 30px;
        border-radius: 24px;
      }
      .brand-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 18px;
      }
      .brand-badge {
        display: inline-flex;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(255,255,255,0.14);
        border: 1px solid rgba(255,255,255,0.18);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .doc-meta {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-top: 20px;
      }
      .doc-meta-card {
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.14);
      }
      .doc-meta-label {
        display: block;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        opacity: 0.82;
        margin-bottom: 8px;
      }
      .doc-meta-value {
        font-size: 16px;
        font-weight: 700;
        line-height: 1.4;
      }
      .hero h1 { margin: 0 0 10px; font-size: 34px; line-height: 1.1; }
      .hero p { margin: 6px 0; line-height: 1.6; }
      .toolbar {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
        margin: 18px 0 0;
        color: rgba(255,255,255,0.84);
        font-size: 13px;
      }
      .toolbar button {
        border: none;
        border-radius: 12px;
        padding: 10px 14px;
        background: rgba(255,255,255,0.14);
        color: white;
        font-weight: 700;
        cursor: pointer;
      }
      .section-title {
        margin: 30px 0 14px;
        font-size: 24px;
        line-height: 1.2;
      }
      .section-subtitle {
        margin: -6px 0 16px;
        color: var(--muted);
        line-height: 1.6;
      }
      .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 22px 0; }
      .card {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 18px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
      }
      .card-label {
        display: block;
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .card strong { display: block; font-size: 28px; margin-top: 10px; }
      .priority {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 20px;
        margin-bottom: 14px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
      }
      .priority-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }
      .priority h3 { margin: 0 0 8px; font-size: 20px; }
      .priority-index {
        min-width: 34px;
        height: 34px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #dbeafe;
        color: #1d4ed8;
        font-weight: 800;
      }
      .meta { color: var(--muted); margin: 0 0 10px; line-height: 1.5; }
      .priority-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px 18px;
        margin: 14px 0;
      }
      .priority-grid div {
        padding: 10px 12px;
        border-radius: 14px;
        background: #f8fbff;
        border: 1px solid #e5eef9;
      }
      .priority-grid strong {
        display: block;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--muted);
        margin-bottom: 6px;
      }
      .tags span {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        margin: 0 8px 8px 0;
        font-size: 12px;
        font-weight: bold;
        background: #fee2e2;
        color: var(--risk);
      }
      .agenda {
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 18px;
        padding: 20px;
      }
      .agenda li { margin: 0 0 10px; line-height: 1.6; }
      .footer-note {
        margin-top: 26px;
        padding: 16px 18px;
        border-radius: 16px;
        background: #fff;
        border: 1px solid var(--line);
        color: var(--muted);
        line-height: 1.6;
      }
      .meeting-note {
        white-space: pre-wrap;
        line-height: 1.65;
        color: var(--muted);
      }
      @media (max-width: 820px) {
        .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .doc-meta { grid-template-columns: 1fr; }
        .priority-grid { grid-template-columns: 1fr; }
      }
      @media print {
        body { background: #fff; }
        .page { max-width: none; padding: 0; }
        .hero { box-shadow: none; }
        .card, .priority, .agenda, .footer-note { box-shadow: none; }
        .toolbar { display: none; }
        .priority { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <section class="hero">
        <div class="brand-row">
          <div>
            <div class="brand-badge">Mercos Implantação Ops</div>
            <h1>${escapeHtml(title)}</h1>
            <p>Objetivo: orientar a batida de funil da semana com foco em risco, MRR protegido e avanço da carteira.</p>
          </div>
          <div class="brand-badge">Relatório compartilhável</div>
        </div>
        <div class="doc-meta">
          <div class="doc-meta-card">
            <span class="doc-meta-label">Escopo</span>
            <span class="doc-meta-value">${escapeHtml(scopeLabel)}</span>
          </div>
          <div class="doc-meta-card">
            <span class="doc-meta-label">Gerado em</span>
            <span class="doc-meta-value">${escapeHtml(formatDateTimeBR(input.generatedAt))}</span>
          </div>
          <div class="doc-meta-card">
            <span class="doc-meta-label">Cliente #1 da semana</span>
            <span class="doc-meta-value">${escapeHtml(input.summary.topPriority?.clientName ?? "Sem informação")}</span>
          </div>
        </div>
        <div class="toolbar">
          <span>Abra no navegador e use “Imprimir” para salvar em PDF se quiser compartilhar em outro formato.</span>
          <button onclick="window.print()">Imprimir / Salvar em PDF</button>
        </div>
      </section>

      <section class="grid">
        <div class="card"><span class="card-label">Projetos em aberto</span><strong>${input.summary.totalProjects}</strong></div>
        <div class="card"><span class="card-label">MRR total</span><strong>${escapeHtml(formatCurrencyBRL(input.summary.totalMrr))}</strong></div>
        <div class="card"><span class="card-label">MRR em risco</span><strong>${escapeHtml(formatCurrencyBRL(input.summary.riskMrr))}</strong></div>
        <div class="card"><span class="card-label">Health Score médio</span><strong>${Math.round(input.summary.averageScore)}</strong></div>
        <div class="card"><span class="card-label">Projetos em risco</span><strong>${input.summary.riskCount}</strong></div>
        <div class="card"><span class="card-label">Projetos em atenção</span><strong>${input.summary.attentionCount}</strong></div>
        <div class="card"><span class="card-label">Projetos saudáveis</span><strong>${input.summary.healthyCount}</strong></div>
        <div class="card"><span class="card-label">Projetos carteira A</span><strong>${input.summary.portfolioACount}</strong></div>
      </section>

      <h2 class="section-title">Orientações registradas na batida</h2>
      <section class="card meeting-note">
        ${escapeHtml(input.meetingNote.trim() || "Sem transcrição registrada para este implanter.")}
      </section>

      <h2 class="section-title">Top 5 clientes para priorizar</h2>
      <p class="section-subtitle">A lista abaixo já está ordenada pela lógica de carteira, score, MRR exposto e risco operacional.</p>
      ${topFive
        .map(
          (item, index) => `
        <article class="priority">
          <div class="priority-head">
            <div>
              <h3>${escapeHtml(item.clientName)}</h3>
              <p class="meta">${escapeHtml(item.implanter)} • ${escapeHtml(item.erpName)} • ${escapeHtml(item.status)} • Carteira ${escapeHtml(item.portfolioClass)} • ${escapeHtml(formatCurrencyBRL(item.mrr))}</p>
            </div>
            <span class="priority-index">${index + 1}</span>
          </div>
          <p><strong>Motivo da priorização:</strong> ${escapeHtml(item.priorityReason)}</p>
          <div class="priority-grid">
            <div><strong>Health Score</strong>${item.healthScore} (${escapeHtml(item.classification)})</div>
            <div><strong>Fase e tempo de vida</strong>${escapeHtml(item.phase)} • ${item.ageDays} dias</div>
            <div><strong>Ação recomendada</strong>${escapeHtml(item.recommendedAction)}</div>
            <div><strong>Fator de risco</strong>${escapeHtml(item.riskFactorDescription || "Sem fator sinalizado")}</div>
          </div>
          <div class="tags">
            ${(item.riskSignals.length > 0 ? item.riskSignals : ["Sem sinais relevantes"])
              .map((signal) => `<span>${escapeHtml(signal)}</span>`)
              .join("")}
          </div>
        </article>`,
        )
        .join("")}

      <h2 class="section-title">Carteira completa ordenada por MRR</h2>
      <p class="section-subtitle">Todos os projetos do escopo atual, do maior para o menor MRR, para apoiar distribuição de agenda e acompanhamento da carteira.</p>
      ${input.items
        .map(
          (item, index) => `
        <article class="priority">
          <div class="priority-head">
            <div>
              <h3>${index + 1}. ${escapeHtml(item.clientName)}</h3>
              <p class="meta">${escapeHtml(item.implanter)} • ${escapeHtml(item.erpName)} • ${escapeHtml(item.status)} • Carteira ${escapeHtml(item.portfolioClass)}</p>
            </div>
            <span class="priority-index">${escapeHtml(formatCurrencyBRL(item.mrr))}</span>
          </div>
          <div class="priority-grid">
            <div><strong>Projeto</strong>${escapeHtml(item.projectName)}</div>
            <div><strong>ERP</strong>${escapeHtml(item.erpName)}</div>
            <div><strong>Health Score</strong>${item.healthScore} (${escapeHtml(item.classification)})</div>
            <div><strong>Fase e tempo de vida</strong>${escapeHtml(item.phase)} • ${item.ageDays} dias</div>
            <div><strong>Risco executivo</strong>${escapeHtml(item.executiveRiskLabel ?? "Sem risco")}</div>
            <div><strong>Ação recomendada</strong>${escapeHtml(item.recommendedAction)}</div>
          </div>
        </article>`,
        )
        .join("")}

      <h2 class="section-title">Sugestão de agenda da semana</h2>
      <p class="section-subtitle">Uma recomendação prática para distribuir a energia do implanter entre clientes críticos, follow-ups e avanço de fase.</p>
      <section class="agenda">
        <ol>
          ${agenda.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ol>
      </section>

      <section class="footer-note">
        Este documento foi gerado a partir da fila inteligente de projetos por risco. Ele resume a prioridade semanal com base em Health Score, carteira, MRR, sinais de risco, oportunidade de cancelamento e evolução do projeto.
      </section>
    </div>
  </body>
</html>`;
}

function buildAgendaSuggestions(items: HealthClientRecord[]): string[] {
  if (items.length === 0) {
    return ["Sem clientes priorizados com os filtros atuais."];
  }

  const first = items[0];
  const second = items[1];
  const third = items[2];

  return [
    `Comece a semana revisando ${first.clientName}, que hoje concentra a maior prioridade operacional por ${first.priorityReason.toLowerCase()}.`,
    second
      ? `Reserve um bloco dedicado para destravar ${second.clientName} e confirmar próximo passo com prazo e responsável definido.`
      : "Reserve um bloco para revisar o segundo cliente mais crítico da carteira.",
    third
      ? `Use um checkpoint com liderança para validar riscos de churn e exposição de MRR em ${third.clientName} e nos demais casos de atenção.`
      : "Use um checkpoint com liderança para validar riscos de churn e exposição de MRR da carteira.",
    "Separe um momento no meio da semana para registrar evolução, atualizar bloqueios e reordenar prioridades se algum cliente mudar de status.",
    "Feche a semana validando quais contas podem avançar de fase, quais exigem escalonamento e quais precisam permanecer no topo da pauta seguinte.",
  ];
}

function formatDateTimeBR(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function readMeetingNotes(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const payload = window.localStorage.getItem(MEETING_NOTES_STORAGE_KEY);
    if (!payload) {
      return {};
    }
    return JSON.parse(payload) as Record<string, string>;
  } catch {
    return {};
  }
}

function persistMeetingNotes(notes: Record<string, string>): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(MEETING_NOTES_STORAGE_KEY, JSON.stringify(notes));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
