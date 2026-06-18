import type {
  ExecutiveCancellationProjectRow,
  ExecutiveClosedProjectRow,
  ExecutiveDelinquencyRow,
  ExecutiveLostProjectRow,
  ExecutiveNewProjectRow,
  ExecutiveOpenProjectRow,
  ExecutiveQualitativeRow,
  ExecutiveUploadsData,
  ForecastMovement,
} from "../types";

export type HealthClassification = "Saudável" | "Atenção" | "Risco";

const PORTFOLIO_A_MIN_MRR = 6000;
const PORTFOLIO_B_MIN_MRR = 2500;
const PORTFOLIO_C_MIN_MRR = 530;

export interface HealthClientRecord {
  key: string;
  clientName: string;
  projectName: string;
  implanter: string;
  erpName: string;
  phase: string;
  status: string;
  segment: string;
  portfolioClass: "A" | "B" | "C" | "D" | "Não classificado";
  startedAt: Date | null;
  ageDays: number;
  mrr: number;
  healthScore: number;
  priorityScore: number;
  priorityImpactScore: number;
  classification: HealthClassification;
  engagementScore: number;
  progressScore: number;
  riskScore: number;
  strategicScore: number;
  engagementApplicable: boolean;
  engagementSummary: string;
  riskFactorDescription: string;
  whyStoppedDescription: string;
  projectDescription: string;
  executiveRiskLabel: "Parado" | "Em risco" | "Necessita de ação" | "Com problemas" | null;
  hasExecutiveRisk: boolean;
  riskSignals: string[];
  recommendedAction: string;
  hasCancellationOpportunity: boolean;
  hasOverdueSubscription: boolean;
  lostHistoryCount: number;
  closedHistoryCount: number;
  hasFinalizationNote: boolean;
  detailUrl: string;
  historyNotes: string[];
  priorityReason: string;
  effectiveClassification: HealthClassification;
  manualClassification: HealthClassification | null;
  forecastMovement: ForecastMovement | null;
  manualOperationalStatus: string;
  manualNote: string;
  manualNextStep: string;
  hasManualOverride: boolean;
}

export interface ManualRiskOverride {
  recordKey: string;
  clientName: string;
  manualClassification: HealthClassification | "";
  forecastMovement: ForecastMovement | "";
  excludeFromForecast: boolean;
  operationalStatus: string;
  note: string;
  nextStep: string;
  updatedAt: string;
}

export function buildHealthRecords(executiveData: ExecutiveUploadsData | null): HealthClientRecord[] {
  if (!executiveData) {
    return [];
  }

  const keys = new Set<string>();
  const baseRows =
    executiveData.openProjects.length > 0
      ? executiveData.openProjects
      : [
          ...executiveData.delinquencyProjects,
          ...executiveData.cancellationProjects,
          ...executiveData.newProjects,
        ];

  baseRows.forEach((item) => item.clientName && keys.add(item.clientName));

  return Array.from(keys)
    .map((clientName) => {
      const openRows = executiveData.openProjects.filter((item) => item.clientName === clientName);
      const delinquencyRows = executiveData.delinquencyProjects.filter((item) => item.clientName === clientName);
      const cancellationRows = executiveData.cancellationProjects.filter((item) => item.clientName === clientName);
      const newRows = executiveData.newProjects.filter((item) => item.clientName === clientName);
      const lostRows = executiveData.lostProjects.filter((item) => item.clientName === clientName);
      const closedRows = executiveData.closedProjects.filter((item) => item.clientName === clientName);

      const openRow = openRows[0] ?? null;
      const delinquencyRow = delinquencyRows[0] ?? null;
      const latestCancellation =
        cancellationRows.slice().sort((a, b) => (b.closeDate?.getTime() ?? 0) - (a.closeDate?.getTime() ?? 0))[0] ?? null;
      const latestNew = newRows.slice().sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0] ?? null;

      const implanter = firstNonEmpty(
        delinquencyRow?.implanter,
        openRow?.implanter,
        latestNew?.implanter,
        latestCancellation?.implanter,
        lostRows[0]?.implanter,
      );
      const projectName = firstNonEmpty(
        openRow?.projectName,
        latestNew?.projectName,
        latestCancellation?.projectName,
        closedRows[0]?.projectName,
      );
      const erpName = firstNonEmpty(
        openRow?.partnerName,
        latestCancellation?.erpName,
      );
      const phase = firstNonEmpty(
        delinquencyRow?.phase,
        normalizeCancellationPhase(latestCancellation?.phase ?? ""),
        inferPhaseFromOpenProject(openRow),
        "Sem informação",
      );
      const status = openRow?.status ?? "Sem informação";
      const segment = inferSegment(openRow, latestCancellation, latestNew, implanter);
      const startedAt =
        openRow?.kickOffDate ??
        latestNew?.createdAt ??
        delinquencyRow?.createdAt ??
        latestCancellation?.newBusinessDate ??
        null;
      const ageDays = diffDays(startedAt);
      const mrr = Math.max(
        openRow?.contractValue ?? 0,
        latestNew?.contractValue ?? 0,
        latestCancellation?.cancellationMrr ?? 0,
      );
      const portfolioClass = inferPortfolioClass(openRow, latestNew, mrr);
      const engagementApplicable = isEngagementApplicable(phase);

      const engagement = calculateEngagementScore(delinquencyRow);
      const projectDelayDays = getExecutiveProjectDelayDays(openRow);
      const progressScore = calculateProgressScore({
        phase,
        status,
        ageDays,
        projectDelayDays,
        implanter,
        lastActivityAt: openRow?.lastActivityAt ?? null,
      });
      const executiveRiskLabel = classifyExecutiveRisk(openRow);
      const riskEvaluation = calculateRiskScore({
        engagementScore: engagement.score,
        engagementApplicable,
        delinquencyRow,
        openRow,
        cancellationRows,
        lostRows,
        projectDelayDays,
      });
      const strategicScore = calculateStrategicScore({
        mrr,
        segment,
        ageDays,
        openRow,
        latestNew,
        cancellationRows,
        portfolioClass,
      });

      const healthScore = calculateOverallHealthScore({
        engagementScore: engagement.score,
        progressScore,
        riskScore: riskEvaluation.score,
        strategicScore,
        engagementApplicable,
        ageDays,
        status,
        hasOverdueSubscription: delinquencyRow?.hasOverdueSubscription ?? false,
        hasRiskFactor: hasProjectTextRisk(openRow),
        isDelayed: projectDelayDays > 0,
      });
      const classification = classifyOperationalHealth({
        score: healthScore,
        status,
        riskFactor: openRow?.riskFactor ?? "",
        whyStopped: openRow?.whyStopped ?? "",
        description: openRow?.description ?? "",
        isDelayed: projectDelayDays > 0,
      });
      const recommendedAction = getRecommendedAction(healthScore);
      const priorityImpactScore = calculatePriorityImpactScore(mrr, portfolioClass);
      const priorityScore = calculatePriorityScore({
        healthScore,
        classification,
        impactScore: priorityImpactScore,
        hasCancellationOpportunity: cancellationRows.length > 0,
        hasOverdueSubscription: delinquencyRow?.hasOverdueSubscription ?? false,
        executiveRiskLabel,
        ageDays,
        projectDelayDays,
      });
      const priorityReason = buildPriorityReason({
        portfolioClass,
        classification,
        mrr,
        hasCancellationOpportunity: cancellationRows.length > 0,
        ageDays,
        projectDelayDays,
        status,
      });

      return {
        key: `${clientName}-${projectName}`,
        clientName,
        projectName: projectName || "Sem informação",
        implanter: implanter || "Sem informação",
        erpName: erpName || "ERP não informado",
        phase,
        status,
        segment,
        portfolioClass,
        startedAt,
        ageDays,
        mrr,
        healthScore,
        priorityScore,
        priorityImpactScore,
        classification,
        engagementScore: engagement.score,
        progressScore,
        riskScore: riskEvaluation.score,
        strategicScore,
        engagementApplicable,
        engagementSummary: engagement.summary,
        riskFactorDescription: openRow?.riskFactor.trim() || "",
        whyStoppedDescription: openRow?.whyStopped.trim() || "",
        projectDescription: openRow?.description.trim() || "",
        executiveRiskLabel,
        hasExecutiveRisk: executiveRiskLabel !== null,
        riskSignals: riskEvaluation.signals,
        recommendedAction,
        hasCancellationOpportunity: cancellationRows.length > 0,
        hasOverdueSubscription: delinquencyRow?.hasOverdueSubscription ?? false,
        lostHistoryCount: lostRows.length,
        closedHistoryCount: closedRows.length,
        hasFinalizationNote: closedRows.some((item) => item.finalizationNote.trim().length > 0),
        detailUrl: delinquencyRow?.detailUrl ?? "",
        historyNotes: buildHistoryNotes({
          openRow,
          cancellationRows,
          closedRows,
          lostRows,
          latestNew,
          delinquencyRow,
        }),
        priorityReason,
        effectiveClassification: classification,
        manualClassification: null,
        forecastMovement: null,
        manualOperationalStatus: "",
        manualNote: "",
        manualNextStep: "",
        hasManualOverride: false,
      };
    })
    .sort(comparePriority);
}

export function applyOperationalContext(
  records: HealthClientRecord[],
  qualitativeRows: ExecutiveQualitativeRow[],
  overrides: Record<string, ManualRiskOverride>,
): HealthClientRecord[] {
  return records
    .map((record) => {
      const qualitative = findQualitativeMatch(record, qualitativeRows);
      const override = overrides[record.key] ?? findOverrideByClient(record, overrides);
      const qualitativeClassification = mapSuggestedCriticality(qualitative?.suggestedCriticality ?? "");
      const manualClassification = override?.manualClassification || null;
      const effectiveClassification =
        manualClassification ??
        qualitativeClassification ??
        record.classification;
      const excludeFromForecast = override?.excludeFromForecast ?? false;
      const forecastMovement =
        excludeFromForecast
          ? null
          : (override?.forecastMovement
              ? override.forecastMovement
              : qualitative?.forecastMovement) ?? null;
      const manualOperationalStatus = override?.operationalStatus || qualitative?.actionStatus || "";
      const manualNote = override?.note || qualitative?.observation || "";
      const manualNextStep = override?.nextStep || qualitative?.nextStep || "";
      const hasManualOverride = Boolean(
        manualClassification ||
          excludeFromForecast ||
          forecastMovement ||
          manualOperationalStatus ||
          override?.note ||
          override?.nextStep,
      );
      const priorityScore = adjustPriorityForManualClassification(
        record.priorityScore,
        effectiveClassification,
        record.classification,
      );

      return {
        ...record,
        classification: effectiveClassification,
        effectiveClassification,
        priorityScore,
        manualClassification,
        forecastMovement,
        manualOperationalStatus,
        manualNote,
        manualNextStep,
        hasManualOverride,
        recommendedAction:
          manualNextStep ||
          record.recommendedAction,
      };
    })
    .sort(comparePriority);
}

export function comparePriority(a: HealthClientRecord, b: HealthClientRecord): number {
  if (a.priorityScore !== b.priorityScore) return b.priorityScore - a.priorityScore;
  if (a.hasCancellationOpportunity !== b.hasCancellationOpportunity) {
    return a.hasCancellationOpportunity ? -1 : 1;
  }
  const riskLevelDelta = classificationWeight(a.classification) - classificationWeight(b.classification);
  if (riskLevelDelta !== 0) return riskLevelDelta;
  if (a.mrr !== b.mrr) return b.mrr - a.mrr;
  if (a.ageDays !== b.ageDays) return b.ageDays - a.ageDays;
  return a.clientName.localeCompare(b.clientName);
}

export function buildDistribution<T>(
  records: T[],
  getLabel: (item: T) => string,
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

export function formatCurrencyBRL(value: number): string {
  if (!value) return "Sem informação";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateBR(value: Date | null): string {
  if (!value) return "Sem informação";
  return new Intl.DateTimeFormat("pt-BR").format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

function calculateEngagementScore(row: ExecutiveDelinquencyRow | null): { score: number; summary: string } {
  if (!row) return { score: 15, summary: "Sem informação" };

  const observedPercent = Math.max(
    row.engagementOrdersPercent ?? -1,
    row.engagementOrdersQuotesPercent ?? -1,
  );
  if (observedPercent >= 0) {
    const summary = `${formatPercent(observedPercent)}%`;
    if (observedPercent >= 100) return { score: 95, summary };
    if (observedPercent >= 80) return { score: 88, summary };
    if (observedPercent >= 60) return { score: 72, summary };
    if (observedPercent >= 20) return { score: 42, summary };
    return { score: 12, summary };
  }

  const normalizedLabel = normalize(row.engagementLabel);
  const percent = extractPercentage(row.engagementLabel);
  if (percent !== null) {
    const summary = `${formatPercent(percent)}%`;
    if (percent >= 80) return { score: 95, summary };
    if (percent >= 50) return { score: 72, summary };
    if (percent > 0) return { score: 40, summary };
    return { score: 12, summary };
  }
  if (normalizedLabel.includes("alto") || normalizedLabel.includes("excelente")) return { score: 94, summary: "Alto" };
  if (normalizedLabel.includes("medio") || normalizedLabel.includes("regular")) return { score: 70, summary: "Médio" };
  if (normalizedLabel.includes("baixo")) return { score: 35, summary: "Baixo" };

  const activeUsers = Math.max(row.vendorUsers, 0);
  const pendingUsers = Math.max(row.pendingUsers, 0);
  const totalUsers = activeUsers + pendingUsers;
  if (totalUsers === 0) return { score: 18, summary: "Sem informação" };

  const ratio = activeUsers / totalUsers;
  if (ratio >= 0.75) return { score: 90, summary: "Alto" };
  if (ratio >= 0.45) return { score: 68, summary: "Médio" };
  if (ratio > 0) return { score: 38, summary: "Baixo" };
  return { score: 10, summary: "Sem uso" };
}
function calculateOverallHealthScore(input: {
  engagementScore: number;
  progressScore: number;
  riskScore: number;
  strategicScore: number;
  engagementApplicable: boolean;
  ageDays: number;
  status: string;
  hasOverdueSubscription: boolean;
  hasRiskFactor: boolean;
  isDelayed: boolean;
}): number {
  const isEarlyProjectWithoutCriticalSignals =
    input.ageDays < 40 &&
    !input.hasOverdueSubscription &&
    !input.hasRiskFactor &&
    !input.isDelayed &&
    !isStoppedOrRiskStatus(input.status);

  if (!input.engagementApplicable) {
    const reweightedScore =
      (input.progressScore * 0.45 + input.riskScore * 0.55);
    const adjustedScore = clampScore(reweightedScore);
    return isEarlyProjectWithoutCriticalSignals ? Math.max(80, adjustedScore) : adjustedScore;
  }

  const fullScore = clampScore(
    input.engagementScore * 0.3 +
      input.progressScore * 0.3 +
      input.riskScore * 0.4,
  );
  return isEarlyProjectWithoutCriticalSignals ? Math.max(80, fullScore) : fullScore;
}

function calculateProgressScore(input: {
  phase: string;
  status: string;
  ageDays: number;
  projectDelayDays: number;
  implanter: string;
  lastActivityAt: Date | null;
}): number {
  const normalizedPhase = normalize(input.phase);
  const normalizedStatus = normalize(input.status);
  let score = 62;

  if (normalizedPhase.includes("acomp") || normalizedPhase.includes("resultado") || normalizedPhase.includes("final")) {
    score = 94;
  } else if (normalizedPhase.includes("implant") || normalizedPhase.includes("trein") || normalizedPhase.includes("ativ")) {
    score = 76;
  } else if (normalizedPhase.includes("kick") || normalizedPhase.includes("inici")) {
    score = 64;
  }

  if (normalizedStatus.includes("parado")) {
    score = Math.min(score, 28);
  } else if (normalizedStatus.includes("critico")) {
    score = Math.min(score, 32);
  } else if (normalizedStatus.includes("necessita")) {
    score = Math.min(score, 48);
  } else if (normalizedStatus.includes("problemas")) {
    score = Math.min(score, 42);
  } else if (normalizedStatus.includes("risco")) {
    score = Math.min(score, 45);
  } else if (normalizedStatus && !isHealthyProjectStatus(normalizedStatus)) {
    score = Math.min(score, 58);
  }

  const targetDays = isMidImplanter(input.implanter) ? 90 : 60;
  if (input.ageDays > targetDays + 30) score = Math.min(score, 34);
  else if (input.ageDays > targetDays) score = Math.min(score, 55);
  if (input.projectDelayDays > 0) score = Math.min(score, input.projectDelayDays >= 15 ? 28 : 42);
  if (diffDays(input.lastActivityAt) >= 14) score = Math.max(20, score - 12);
  return clampScore(score);
}

function calculateRiskScore(input: {
  engagementScore: number;
  engagementApplicable: boolean;
  delinquencyRow: ExecutiveDelinquencyRow | null;
  openRow: ExecutiveOpenProjectRow | null;
  cancellationRows: ExecutiveCancellationProjectRow[];
  lostRows: ExecutiveLostProjectRow[];
  projectDelayDays: number;
}): { score: number; signals: string[] } {
  let score = 100;
  const signals: string[] = [];

  if (input.delinquencyRow?.hasOverdueSubscription) {
    score -= 30;
    signals.push("Mensalidade vencida");
  }
  if (input.cancellationRows.length > 0) {
    score -= 25;
    signals.push("Oportunidade de cancelamento");
  }
  if (input.openRow?.riskFactor.trim()) {
    score -= 18;
    signals.push(`Fator de risco: ${input.openRow.riskFactor}`);
  }
  if (input.openRow?.whyStopped.trim()) {
    score -= 16;
    signals.push(`Por que parado: ${input.openRow.whyStopped}`);
  }
  if (input.projectDelayDays > 0) {
    score -= input.projectDelayDays >= 15 ? 24 : 16;
    signals.push(`${input.projectDelayDays} dia(s) acima do tempo previsto`);
  }
  const textSignals = detectProjectTextRiskSignals(input.openRow);
  if (textSignals.length > 0) {
    score -= Math.min(24, 10 + textSignals.length * 4);
    signals.push(...textSignals);
  }
  const normalizedStatus = normalize(input.openRow?.status ?? "");
  if (hasAttentionStatus(normalizedStatus)) {
    score -= 28;
    signals.push("Projeto parado");
  } else if (normalizedStatus.includes("critico")) {
    score -= 30;
    signals.push("Status critico");
  } else if (normalizedStatus.includes("necessita")) {
    score -= 22;
    signals.push("Necessita de ação");
  } else if (normalizedStatus.includes("problemas")) {
    score -= 24;
    signals.push("Projeto com problemas");
  } else if (hasProjectRiskStatus(normalizedStatus)) {
    score -= 22;
    signals.push("Projeto em risco");
  } else if (normalizedStatus && !isHealthyProjectStatus(normalizedStatus)) {
    score -= 14;
    signals.push(`Status exige atencao: ${input.openRow?.status}`);
  }
  const pendingUsers = input.delinquencyRow?.pendingUsers ?? 0;
  if (pendingUsers >= 10) {
    score -= 14;
    signals.push("Muitos usuários pendentes");
  } else if (pendingUsers > 0) {
    score -= 8;
    signals.push("Usuários pendentes");
  }
  if (input.engagementApplicable && input.engagementScore < 50) {
    score -= 14;
    signals.push("Baixo engajamento");
  }
  if (input.lostRows.length > 0) {
    score -= 8;
    signals.push("Cliente com histórico de perdido");
  }
  return { score: clampScore(score), signals };
}

function calculateStrategicScore(input: {
  mrr: number;
  segment: string;
  ageDays: number;
  openRow: ExecutiveOpenProjectRow | null;
  latestNew: ExecutiveNewProjectRow | null;
  cancellationRows: ExecutiveCancellationProjectRow[];
  portfolioClass: HealthClientRecord["portfolioClass"];
}): number {
  let score = 35;
  if (input.mrr >= PORTFOLIO_A_MIN_MRR) score = 95;
  else if (input.mrr >= PORTFOLIO_B_MIN_MRR) score = 85;
  else if (input.mrr >= PORTFOLIO_C_MIN_MRR) score = 75;
  else if (input.mrr > 0) score = 60;

  const normalizedSegment = normalize(input.segment);
  const portfolioHint = normalize(`${input.openRow?.portfolioClass ?? ""};${input.latestNew?.portfolioClass ?? ""}`);

  if (
    normalizedSegment.includes("mid") ||
    normalizedSegment.includes("estrateg") ||
    portfolioHint.includes("mid") ||
    portfolioHint.includes("estrateg") ||
    input.portfolioClass === "A"
  ) {
    score += 10;
  }

  if (input.portfolioClass === "B") score += 5;
  if (input.cancellationRows.length > 0 && input.ageDays > 180) score -= 15;
  if (input.ageDays <= 60 && input.mrr > 0) score += 5;
  return clampScore(score);
}

function calculatePriorityImpactScore(
  mrr: number,
  portfolioClass: HealthClientRecord["portfolioClass"],
): number {
  if (portfolioClass === "A") return 100;
  if (portfolioClass === "B") return 78;
  if (portfolioClass === "C") return 48;
  if (portfolioClass === "D") return 20;
  if (mrr > 0) return 12;
  return 0;
}

function calculatePriorityScore(input: {
  healthScore: number;
  classification: HealthClassification;
  impactScore: number;
  hasCancellationOpportunity: boolean;
  hasOverdueSubscription: boolean;
  executiveRiskLabel: HealthClientRecord["executiveRiskLabel"];
  ageDays: number;
  projectDelayDays: number;
}): number {
  const operationalRisk = 100 - input.healthScore;
  const normalizedClassification = normalize(input.classification);
  const classificationBoost =
    normalizedClassification === "risco" ? 16 : normalizedClassification === "atencao" ? 8 : 0;
  const statusBoost = input.executiveRiskLabel ? 10 : 0;
  const cancellationBoost = input.hasCancellationOpportunity ? 10 : 0;
  const delinquencyBoost = input.hasOverdueSubscription ? 8 : 0;
  const ageBoost = input.ageDays > 120 ? 6 : input.ageDays > 90 ? 3 : 0;
  const delayBoost = input.projectDelayDays > 0 ? (input.projectDelayDays >= 15 ? 12 : 8) : 0;

  return clampScore(
    operationalRisk * 0.68 +
      input.impactScore * 0.32 +
      classificationBoost +
      statusBoost +
      cancellationBoost +
      delinquencyBoost +
      ageBoost +
      delayBoost,
  );
}

function adjustPriorityForManualClassification(
  priorityScore: number,
  effectiveClassification: HealthClassification,
  automaticClassification: HealthClassification,
): number {
  if (effectiveClassification === automaticClassification) {
    return priorityScore;
  }
  if (effectiveClassification === "Risco") {
    return clampScore(priorityScore + 18);
  }
  if (normalize(effectiveClassification) === "atencao") {
    return clampScore(priorityScore + 8);
  }
  return clampScore(priorityScore - 12);
}

function inferPortfolioClass(
  openRow: ExecutiveOpenProjectRow | null,
  newRow: ExecutiveNewProjectRow | null,
  mrr: number,
): HealthClientRecord["portfolioClass"] {
  const byMrr = inferPortfolioClassFromMrr(mrr);
  if (byMrr) return byMrr;

  const rawValue = firstNonEmpty(openRow?.portfolioClass, newRow?.portfolioClass);
  const normalized = normalize(rawValue);
  if (normalized === "a" || normalized.includes("carteira a")) return "A";
  if (normalized === "b" || normalized.includes("carteira b")) return "B";
  if (normalized === "c" || normalized.includes("carteira c")) return "C";
  if (normalized === "d" || normalized.includes("carteira d")) return "D";
  return "Não classificado";
}

function buildPriorityReason(input: {
  portfolioClass: HealthClientRecord["portfolioClass"];
  classification: HealthClassification;
  mrr: number;
  hasCancellationOpportunity: boolean;
  ageDays: number;
  projectDelayDays: number;
  status: string;
}): string {
  const reasons: string[] = [];
  if (input.portfolioClass === "A") reasons.push("Carteira A");
  if (input.classification === "Risco") reasons.push("Health Score em risco");
  if (input.hasCancellationOpportunity) reasons.push("Oportunidade de cancelamento");
  if (input.mrr >= PORTFOLIO_B_MIN_MRR) reasons.push("MRR relevante");
  if (normalize(input.status).includes("parado")) reasons.push("Projeto parado");
  if (input.projectDelayDays > 0) reasons.push(`${input.projectDelayDays} dia(s) acima do tempo previsto`);
  if (input.ageDays > 90) reasons.push("Tempo de vida alto");
  return reasons.join(" â€¢ ") || "Acompanhamento de rotina";
}

function inferPortfolioClassFromMrr(
  mrr: number,
): HealthClientRecord["portfolioClass"] | null {
  if (mrr >= PORTFOLIO_A_MIN_MRR) return "A";
  if (mrr >= PORTFOLIO_B_MIN_MRR) return "B";
  if (mrr >= PORTFOLIO_C_MIN_MRR) return "C";
  if (mrr > 0 && Number.isFinite(mrr)) return "D";
  return null;
}

function buildHistoryNotes(input: {
  openRow: ExecutiveOpenProjectRow | null;
  cancellationRows: ExecutiveCancellationProjectRow[];
  closedRows: ExecutiveClosedProjectRow[];
  lostRows: ExecutiveLostProjectRow[];
  latestNew: ExecutiveNewProjectRow | null;
  delinquencyRow: ExecutiveDelinquencyRow | null;
}): string[] {
  const items: string[] = [];
  if (input.latestNew?.createdAt) items.push(`Projeto novo encontrado em ${formatDateBR(input.latestNew.createdAt)}`);
  if (input.openRow?.status) items.push(`Status atual: ${input.openRow.status}`);
  if (input.openRow?.whyStopped) items.push(`Por que parado: ${input.openRow.whyStopped}`);
  if (input.openRow?.riskFactor) items.push(`Fator de risco: ${input.openRow.riskFactor}`);
  if (input.openRow?.description) items.push(`Descricao do projeto: ${input.openRow.description}`);
  const projectDelayDays = getExecutiveProjectDelayDays(input.openRow);
  if (projectDelayDays > 0) items.push(`${projectDelayDays} dia(s) acima do tempo previsto do projeto`);
  if (input.delinquencyRow?.hasOverdueSubscription) items.push("Cliente aparece com inadimplência na base de implantação");
  if (input.cancellationRows.length > 0) items.push(`${input.cancellationRows.length} registro(s) em oportunidade de cancelamento`);
  if (input.closedRows.length > 0) items.push(`${input.closedRows.length} finalização(ões) encontrada(s) na base de notas`);
  if (input.lostRows.length > 0) items.push(`${input.lostRows.length} registro(s) na base de perdidos`);
  if (items.length === 0) items.push("Sem histórico adicional encontrado nas demais planilhas");
  return items;
}

function getExecutiveProjectDelayDays(openRow: ExecutiveOpenProjectRow | null): number {
  const targetDays = openRow?.plannedProjectDays ?? null;
  const currentDays = openRow?.projectDurationDays ?? null;
  if (!targetDays || currentDays === null || currentDays === undefined) {
    return 0;
  }
  return Math.max(0, currentDays - targetDays);
}

function inferPhaseFromOpenProject(project: ExecutiveOpenProjectRow | null): string {
  if (!project) return "";
  const source = normalize(`${project.projectTypeDetails};${project.projectType};${project.status}`);
  if (source.includes("acomp")) return "Acompanhamento";
  if (source.includes("implant")) return "Implantação";
  if (source.includes("kick")) return "Kickoff";
  return project.status || project.projectTypeDetails || "Sem informação";
}

function isEngagementApplicable(phase: string): boolean {
  const normalized = normalize(phase);
  return normalized.includes("acompanhamento") || normalized.includes("analise de resultados");
}

function inferSegment(
  openRow: ExecutiveOpenProjectRow | null,
  cancellationRow: ExecutiveCancellationProjectRow | null,
  newRow: ExecutiveNewProjectRow | null,
  implanter: string,
): string {
  const combined = normalize(`${cancellationRow?.segment ?? ""};${openRow?.portfolioClass ?? ""};${newRow?.portfolioClass ?? ""};${openRow?.projectTypeDetails ?? ""}`);
  if (combined.includes("mid") || isMidImplanter(implanter)) return "MID";
  if (combined.includes("smb")) return "SMB";
  if (combined.includes("estrateg")) return "Estratégico";
  return "Sem informação";
}

function classificationWeight(classification: HealthClassification): number {
  return classification === "Risco" ? 0 : classification === "Atenção" ? 1 : 2;
}

function classifyHealthScore(score: number): HealthClassification {
  if (score >= 80) return "Saudável";
  if (score >= 50) return "Atenção";
  return "Risco";
}

function classifyOperationalHealth(input: {
  score: number;
  status: string;
  riskFactor: string;
  whyStopped: string;
  description: string;
  isDelayed: boolean;
}): HealthClassification {
  if (
    input.isDelayed ||
    hasAttentionStatus(input.status) ||
    hasProjectRiskStatus(input.status) ||
    !isHealthyProjectStatus(input.status) ||
    input.riskFactor.trim().length > 0 ||
    input.whyStopped.trim().length > 0 ||
    detectTextRiskSignals(input.description).length > 0
  ) {
    return "Risco";
  }
  return classifyHealthScore(input.score);
}

function classifyExecutiveRisk(
  openRow: ExecutiveOpenProjectRow | null,
): "Parado" | "Em risco" | "Necessita de ação" | "Com problemas" | null {
  const normalizedStatus = normalize(openRow?.status ?? "");
  const riskFactor = String(openRow?.riskFactor ?? "").trim();
  const hasTextRisk = hasProjectTextRisk(openRow);
  if (hasAttentionStatus(normalizedStatus)) {
    return "Parado";
  }
  if (isHealthyProjectStatus(normalizedStatus) && !hasTextRisk) {
    return null;
  }
  if (normalizedStatus === "necessita de acao" || normalizedStatus.includes("necessita de acao")) {
    return "Necessita de ação";
  }
  if (normalizedStatus.includes("problemas") || riskFactor.length > 0 || hasTextRisk) {
    return "Com problemas";
  }
  if (
    normalizedStatus === "critico" ||
    normalizedStatus === "em risco" ||
    normalizedStatus.includes("risco") ||
    normalizedStatus.includes("critic")
  ) {
    return "Em risco";
  }
  return normalizedStatus ? "Em risco" : null;
}

function isStoppedOrRiskStatus(status: string): boolean {
  return hasProjectAnyAlertStatus(status) || !isHealthyProjectStatus(status);
}

function hasAttentionStatus(status: string): boolean {
  const normalizedStatus = normalize(status);
  return normalizedStatus.includes("parado");
}

function hasProjectRiskStatus(status: string): boolean {
  const normalizedStatus = normalize(status);
  return (
    normalizedStatus.includes("necessita") ||
    normalizedStatus.includes("problemas") ||
    normalizedStatus.includes("risco") ||
    normalizedStatus.includes("critico")
  );
}

function hasProjectAnyAlertStatus(status: string): boolean {
  return hasAttentionStatus(status) || hasProjectRiskStatus(status);
}

function isHealthyProjectStatus(status: string): boolean {
  return normalize(status) === "em andamento";
}

function hasProjectTextRisk(openRow: ExecutiveOpenProjectRow | null): boolean {
  if (!openRow) {
    return false;
  }
  return Boolean(
    openRow.riskFactor.trim() ||
      openRow.whyStopped.trim() ||
      detectProjectTextRiskSignals(openRow).length > 0,
  );
}

function detectProjectTextRiskSignals(openRow: ExecutiveOpenProjectRow | null): string[] {
  if (!openRow) {
    return [];
  }
  return detectTextRiskSignals(`${openRow.description} ${openRow.whyStopped} ${openRow.riskFactor}`);
}

function detectTextRiskSignals(value: string): string[] {
  const normalized = normalize(value);
  if (!normalized) {
    return [];
  }

  const categories: Array<[string, RegExp]> = [
    ["Cliente sem retorno", /\b(sem retorno|nao responde|aguardando cliente|retorno do cliente)\b/],
    ["Problema financeiro", /\b(financeir|inadimpl|pagamento|mensalidade|boleto|cobranca)\b/],
    ["Troca de ERP", /\b(troca de erp|mudanca de erp|erp)\b/],
    ["Integracao com problema", /\b(integracao|api|bling|tiny|webmais|mercos|sincron)\b/],
    ["Parceiro ou alinhamento externo", /\b(parceiro|contador|consultor|terceiro|alinhamento)\b/],
    ["Baixo engajamento", /\b(engaj|sem uso|nao usa|usuarios pendentes|treinamento pendente)\b/],
    ["Escopo fora do padrao", /\b(fora do padrao|custom|personaliz|escopo)\b/],
    ["Bloqueio interno", /\b(bloqueio interno|produto|suporte|dev|desenvolvimento|bug)\b/],
  ];

  return categories
    .filter(([, pattern]) => pattern.test(normalized))
    .map(([label]) => label);
}

function getRecommendedAction(score: number): string {
  if (score < 50) return "Prioridade máxima: revisar plano de ação, envolver liderança e mapear risco de churn.";
  if (score < 80) return "Atenção: investigar bloqueios, reforçar próximos passos e acompanhar evolução.";
  return "Saudável: manter avanço, buscar conclusão, case ou oportunidade de expansão.";
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  return values.find((value) => String(value ?? "").trim().length > 0) ?? "";
}

function extractPercentage(value: string): number | null {
  const match = value.match(/(\d{1,3})\s*%/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isMidImplanter(implanter: string): boolean {
  void implanter;
  return false;
}

function diffDays(date: Date | null): number {
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function normalize(value?: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeCancellationPhase(value: string): string {
  const normalized = normalize(value);
  if (normalized.includes("implant")) return "Implantação";
  if (normalized.includes("perd")) return "Perdido";
  if (normalized.includes("acomp")) return "Acompanhamento";
  return value || "";
}

function mapSuggestedCriticality(value: string): HealthClassification | null {
  const normalized = normalize(value);
  if (normalized.includes("risco")) return "Risco";
  if (normalized.includes("atenc")) return "Atenção";
  if (normalized.includes("saud")) return "Saudável";
  return null;
}

function findQualitativeMatch(
  record: HealthClientRecord,
  qualitativeRows: ExecutiveQualitativeRow[],
): ExecutiveQualitativeRow | null {
  const recordClient = normalize(record.clientName);
  const recordProject = normalize(record.projectName);
  const sameImplanterRows = qualitativeRows.filter(
    (row) => normalize(row.implanter) === normalize(record.implanter),
  );
  return (
    sameImplanterRows.find((row) => {
      const qualitativeClient = normalize(row.clientName);
      return (
        qualitativeClient === recordClient ||
        qualitativeClient.includes(recordClient) ||
        recordClient.includes(qualitativeClient) ||
        (recordProject && qualitativeClient.includes(recordProject))
      );
    }) ?? null
  );
}

function findOverrideByClient(
  record: HealthClientRecord,
  overrides: Record<string, ManualRiskOverride>,
): ManualRiskOverride | null {
  const recordClient = normalize(record.clientName);
  return (
    Object.values(overrides).find((item) => normalize(item.clientName) === recordClient) ?? null
  );
}


