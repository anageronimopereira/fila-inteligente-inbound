import type {
  ClosureEvaluation,
  CoordinatorFocusProject,
  CoordinatorGuide,
  CoordinatorInsights,
  ImpactFactor,
  ImplanterWeeklyPlan,
  PriorityLevel,
  ProjectRow,
  RankedProject,
  RiskFactor,
  RiskResult,
  RiskWeights,
  StrategicInsights,
  WeeklyFocusProject,
} from "../types";
import { diffDaysFromNow, getPhaseSlaDays } from "./dateUtils";

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  overdue: 34,
  engagement: 22,
  pendingUsers: 18,
  integration: 12,
  slaDelay: 10,
  projectDuration: 14,
  workbookRisk: 16,
  inactivity: 12,
  b2b: 4,
};

const INTEGRATION_RISK_NAMES = ["omie", "tiny", "bling"];

export function calculateRisk(row: ProjectRow, weights: RiskWeights = DEFAULT_RISK_WEIGHTS): RiskResult {
  const factors: RiskFactor[] = [];

  pushFactor(factors, "overdue", "Mensalidade vencida", weights.overdue, row.hasOverdueSubscription);

  const engagementSeverity = Math.max(
    mapEngagementSeverity(row.engagementOrdersLabel),
    mapEngagementSeverity(row.engagementOrdersQuotesLabel),
  );
  pushFactor(
    factors,
    "engagement",
    buildEngagementLabel(engagementSeverity),
    Math.round(weights.engagement * engagementSeverity),
    engagementSeverity > 0,
  );

  const pendingSeverity = getPendingUsersSeverity(row.pendingUsers, row.vendorUsers);
  pushFactor(
    factors,
    "pending-users",
    buildPendingUsersLabel(row.pendingUsers, row.vendorUsers),
    Math.round(weights.pendingUsers * pendingSeverity),
    pendingSeverity > 0,
  );

  const integrationSeverity = getIntegrationSeverity(row.integratedAppsLabel, row.integratedAppsCount);
  pushFactor(
    factors,
    "integration",
    buildIntegrationLabel(row.integratedAppsLabel),
    Math.round(weights.integration * integrationSeverity),
    integrationSeverity > 0,
  );

  const slaSeverity = getSlaSeverity(row.phase, row.createdAt);
  pushFactor(
    factors,
    "sla-delay",
    buildSlaLabel(row.phase, row.createdAt),
    Math.round(weights.slaDelay * slaSeverity),
    slaSeverity > 0,
  );

  const projectDurationSeverity = getProjectDurationSeverity(row);
  pushFactor(
    factors,
    "project-duration",
    buildProjectDurationLabel(row),
    Math.round(weights.projectDuration * projectDurationSeverity),
    projectDurationSeverity > 0,
  );

  const workbookRiskSeverity = getWorkbookRiskSeverity(row);
  pushFactor(
    factors,
    "workbook-risk",
    buildWorkbookRiskLabel(row),
    Math.round(weights.workbookRisk * workbookRiskSeverity),
    workbookRiskSeverity > 0,
  );

  const inactivitySeverity = getLastActivitySeverity(row);
  pushFactor(
    factors,
    "last-activity",
    buildLastActivityLabel(row),
    Math.round(weights.inactivity * inactivitySeverity),
    inactivitySeverity > 0,
  );

  factors.push(...getProjectStatusFactors(row.projectStatus));

  pushFactor(factors, "b2b", "Operação B2B demanda acompanhamento extra", weights.b2b, row.hasB2B);

  const rawRisk = clampRisk(factors.reduce((sum, factor) => sum + factor.points, 0));
  const delayDays = getProjectDelayDays(row);
  const risk = applyDelayPriorityFloor(rawRisk, delayDays);
  const priority = getPriority(risk);

  return {
    risk,
    priority,
    recommendation: getRecommendation(row, factors),
    factors: factors.sort((a, b) => b.points - a.points),
  };
}

export function rankProjects(rows: ProjectRow[], weights: RiskWeights = DEFAULT_RISK_WEIGHTS): RankedProject[] {
  return rows
    .map((row) => {
      const result = calculateRisk(row, weights);
      const quadrantEvaluation = evaluateQuadrant(row, result.risk, result.factors);
      return {
        row,
        risk: result.risk,
        priority: result.priority,
        recommendation: result.recommendation,
        factors: result.factors,
        closureEvaluation: evaluateProjectClosure(row),
        quadrantEvaluation,
      };
    })
    .sort((a, b) => {
      return (
        getQuadrantSortOrder(a.quadrantEvaluation.quadrant) -
          getQuadrantSortOrder(b.quadrantEvaluation.quadrant) ||
        b.quadrantEvaluation.impactScore - a.quadrantEvaluation.impactScore ||
        b.quadrantEvaluation.riskScore - a.quadrantEvaluation.riskScore ||
        b.risk - a.risk ||
        a.row.clientName.localeCompare(b.row.clientName)
      );
    });
}

export function getPriority(risk: number): PriorityLevel {
  if (risk >= 70) {
    return "Crítica";
  }
  if (risk >= 50) {
    return "Alta";
  }
  if (risk >= 30) {
    return "Média";
  }
  return "Baixa";
}

export function getPriorityColors(priority: PriorityLevel): { bg: string; fg: string; border: string } {
  switch (priority) {
    case "Crítica":
      return { bg: "#fff1f2", fg: "#be123c", border: "#fda4af" };
    case "Alta":
      return { bg: "#fff7ed", fg: "#c2410c", border: "#fdba74" };
    case "Média":
      return { bg: "#fffbeb", fg: "#a16207", border: "#fde68a" };
    case "Baixa":
    default:
      return { bg: "#ecfdf3", fg: "#047857", border: "#86efac" };
  }
}

export function generateStrategicInsights(
  projects: RankedProject[],
  options?: { hasFinancialValue?: boolean },
): StrategicInsights {
  const implanterMap = new Map<string, RankedProject[]>();

  for (const project of projects) {
    const key = project.row.implanter || "Sem implantador";
    const current = implanterMap.get(key) ?? [];
    current.push(project);
    implanterMap.set(key, current);
  }

  const oldProjects = projects.filter((project) => diffDaysFromNow(project.row.createdAt) >= 120).length;
  const pendingAboveVendorBase = projects.filter(
    (project) => project.row.vendorUsers > 0 && project.row.pendingUsers > project.row.vendorUsers,
  ).length;
  const overdueProjects = projects.filter((project) => project.row.hasOverdueSubscription).length;
  const statusCriticalProjects = projects.filter((project) => hasCriticalProjectStatus(project.row.projectStatus)).length;
  const statusStoppedProjects = projects.filter((project) => hasStoppedProjectStatus(project.row.projectStatus)).length;
  const workbookRiskProjects = projects.filter(
    (project) => (project.row.workbookRiskLabel ?? "").trim() || (project.row.workbookRiskB2BLabel ?? "").trim(),
  ).length;
  const inactiveProjects = projects.filter((project) => getLastActivityDays(project.row) >= 15).length;
  const noFollowUpWeek = projects.filter((project) => getLastActivityDays(project.row) >= 7).length;
  const setupAging = projects.filter((project) => {
    return normalizePhase(project.row.phase) === "setup" && diffDaysFromNow(project.row.createdAt) > 21;
  }).length;
  const totalMrr = projects.reduce((sum, project) => sum + Math.max(project.row.amountPaid ?? 0, 0), 0);
  const stoppedProjects = projects
    .filter((project) => isStoppedProject(project.row))
    .map((project) => ({
      clientName: project.row.clientName,
      implanter: project.row.implanter,
      mrr: Math.max(project.row.amountPaid ?? 0, 0),
      reason: describeStoppedProject(project.row),
    }))
    .sort((a, b) => b.mrr - a.mrr || a.clientName.localeCompare(b.clientName));
  const stoppedMrr = stoppedProjects.reduce((sum, project) => sum + project.mrr, 0);

  const globalInsights = [
    totalMrr > 0
      ? `MRR total visível na carteira: ${formatCurrencyBRL(totalMrr)}, com ${formatCurrencyBRL(stoppedMrr)} em projetos parados.`
      : "A base atual não trouxe MRR para resumir peso financeiro da carteira.",
    `${projects.length} projetos carregados nesta visão, com ${overdueProjects} contas em risco financeiro imediato.`,
    `${statusCriticalProjects} projeto(s) vieram marcados como críticos no status e ${statusStoppedProjects} aparecem como parados na planilha.`,
    `${oldProjects} projetos têm mais de 120 dias, sinal de aging estrutural na carteira.`,
    `${setupAging} projetos em Setup já passaram 21 dias e merecem revisão de processo.`,
    `${pendingAboveVendorBase} contas têm mais usuários pendentes do que vendedores ativos, indicando travas de adoção ou inconsistência cadastral.`,
    `${workbookRiskProjects} projetos já vieram com fator de risco explícito no workbook.`,
    `${noFollowUpWeek} clientes estão há pelo menos 7 dias sem follow-up, o que reduz tração da semana.`,
    `${inactiveProjects} clientes estão há 15+ dias sem follow-up e pedem retomada ativa imediata.`,
  ];

  const implanterPlans = Array.from(implanterMap.entries())
    .map(([implanter, items]) => buildImplanterPlan(implanter, items))
    .sort((a, b) => {
      return (
        b.criticalCount - a.criticalCount ||
        b.avgRisk - a.avgRisk ||
        b.highCount - a.highCount ||
        a.implanter.localeCompare(b.implanter)
      );
    });

  return {
    hasMrrData:
      options?.hasFinancialValue ?? projects.some((project) => (project.row.amountPaid ?? 0) > 0),
    totalMrr,
    stoppedMrr,
    stoppedProjects: stoppedProjects.slice(0, 5),
    globalInsights,
    implanterPlans,
  };
}

export function generateCoordinatorInsights(projects: RankedProject[]): CoordinatorInsights {
  const groups = new Map<string, RankedProject[]>();

  for (const project of projects) {
    const key = project.row.implanter || "Sem implantador";
    const current = groups.get(key) ?? [];
    current.push(project);
    groups.set(key, current);
  }

  const guides = Array.from(groups.entries())
    .map(([implanter, items]) => buildCoordinatorGuide(implanter, items))
    .sort((a, b) => {
      const aCritical = a.focusProjects.filter((item) => item.priority === "Crítica").length;
      const bCritical = b.focusProjects.filter((item) => item.priority === "Crítica").length;
      return bCritical - aCritical || a.implanter.localeCompare(b.implanter);
    });

  const criticalPortfolios = guides.filter((guide) =>
    guide.portfolioSummary.toLowerCase().includes("carteira pressionada"),
  ).length;
  const backlogPortfolios = guides.filter((guide) =>
    guide.managementAlert.toLowerCase().includes("backlog"),
  ).length;
  const statusStoppedProjects = projects.filter((project) => hasStoppedProjectStatus(project.row.projectStatus)).length;
  const statusCriticalProjects = projects.filter((project) => hasCriticalProjectStatus(project.row.projectStatus)).length;

  return {
    summary: [
      `${guides.length} carteiras analisadas com orientação de coordenação para a semana.`,
      `${statusCriticalProjects} projeto(s) estão marcados como críticos no status e ${statusStoppedProjects} aparecem como parados na base.`,
      `${criticalPortfolios} carteiras exigem atuação muito próxima da liderança por concentração de críticos.`,
      `${backlogPortfolios} carteiras têm sinal de backlog estrutural e pedem menos dispersão operacional.`,
    ],
    guides,
  };
}

function mapEngagementSeverity(value: string): number {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return 0;
  }

  if (normalized.includes("01") || normalized.includes("0-20")) {
    return 1;
  }
  if (normalized.includes("02") || normalized.includes("20-40")) {
    return 0.75;
  }
  if (normalized.includes("03") || normalized.includes("40-60")) {
    return 0.5;
  }
  if (normalized.includes("04") || normalized.includes("60-80")) {
    return 0.25;
  }
  if (normalized.includes("05") || normalized.includes("80-100")) {
    return 0.1;
  }
  if (normalized.includes("06") || normalized.includes("100%")) {
    return 0;
  }

  return 0.35;
}

function getPendingUsersSeverity(pendingUsers: number, vendorUsers: number): number {
  if (pendingUsers <= 0) {
    return 0;
  }

  if (vendorUsers <= 0) {
    return 1;
  }

  const ratio = pendingUsers / vendorUsers;
  if (ratio > 0.6) {
    return 1;
  }
  if (ratio > 0.3) {
    return 0.6;
  }
  return 0.25;
}

function getIntegrationSeverity(label: string, count: number): number {
  const normalized = label.toLowerCase();
  const hasNamedRiskIntegration = INTEGRATION_RISK_NAMES.some((name) => normalized.includes(name));
  if (count > 1 || hasNamedRiskIntegration) {
    return 1;
  }
  if (count === 1) {
    return 0.5;
  }
  return 0;
}

function getSlaSeverity(phase: string, createdAt: Date | null): number {
  const slaDays = getPhaseSlaDays(phase);
  if (!slaDays || !createdAt) {
    return 0;
  }

  const age = diffDaysFromNow(createdAt);
  if (age <= slaDays) {
    return 0;
  }

  const overflowRatio = (age - slaDays) / slaDays;
  if (overflowRatio >= 1) {
    return 1;
  }
  if (overflowRatio >= 0.5) {
    return 0.65;
  }
  return 0.35;
}

function getRecommendation(row: ProjectRow, factors: RiskFactor[]): string {
  const factorKeys = factors.filter((factor) => factor.points > 0).map((factor) => factor.key);

  if (factorKeys.includes("overdue")) {
    return "Resolver financeiro imediatamente";
  }
  if (factorKeys.includes("pending-users")) {
    return "Fazer mutirão de cadastro com cliente";
  }
  if (factorKeys.includes("workbook-risk")) {
    return "Atacar o risco operacional apontado na planilha e alinhar plano de reversão com o cliente.";
  }
  if (factorKeys.includes("last-activity")) {
    return "Retomar contato com o cliente imediatamente e redefinir próximo passo com data fechada.";
  }
  if (factorKeys.includes("engagement")) {
    return "Reativar uso e reforçar treinamento";
  }
  if (factorKeys.includes("integration")) {
    return "Priorizar validação da integração";
  }
  if (factorKeys.includes("project-duration")) {
    return "Replanejar cronograma imediatamente";
  }
  if (factorKeys.includes("sla-delay")) {
    return "Replanejar cronograma imediatamente";
  }
  if (row.phase) {
    return `Conduzir a próxima entrega da fase "${row.phase}" e revisar o avanço semanalmente.`;
  }
  return "Manter acompanhamento operacional e revisar sinais de risco semanalmente.";
}

function buildEngagementLabel(severity: number): string {
  if (severity >= 1) {
    return "Baixo engajamento comercial";
  }
  if (severity >= 0.75) {
    return "Engajamento comercial abaixo do ideal";
  }
  if (severity > 0) {
    return "Engajamento comercial moderado";
  }
  return "Engajamento saudável";
}

function buildPendingUsersLabel(pendingUsers: number, vendorUsers: number): string {
  if (vendorUsers <= 0) {
    return `${pendingUsers} usuários pendentes sem base de vendedores informada`;
  }
  const ratio = Math.round((pendingUsers / vendorUsers) * 100);
  return `${pendingUsers} usuários pendentes (${ratio}% da base de vendedores)`;
}

function buildIntegrationLabel(integratedAppsLabel: string): string {
  return integratedAppsLabel
    ? `Integração exige validação: ${integratedAppsLabel}`
    : "Integração ainda não informada";
}

function buildSlaLabel(phase: string, createdAt: Date | null): string {
  const slaDays = getPhaseSlaDays(phase);
  const age = diffDaysFromNow(createdAt);
  if (!slaDays) {
    return "Tempo em aberto sem SLA mapeado";
  }
  return `Projeto há ${age} dias na fase ${phase} (SLA ${slaDays} dias)`;
}

function getProjectDurationSeverity(row: ProjectRow): number {
  const targetDays = inferTargetFromRow(row);
  const anchorDate = row.kickOffDate ?? row.createdAt;

  if (!targetDays) {
    return 0;
  }

  const age = row.projectDurationDays ?? (anchorDate ? diffDaysFromNow(anchorDate) : 0);
  if (!age) {
    return 0;
  }

  if (age <= targetDays) {
    return 0;
  }

  const overflowRatio = (age - targetDays) / targetDays;
  if (overflowRatio >= 1) {
    return 1;
  }
  if (overflowRatio >= 0.4) {
    return 0.7;
  }
  return 0.35;
}

function buildProjectDurationLabel(row: ProjectRow): string {
  const targetDays = inferTargetFromRow(row);
  const anchorDate = row.kickOffDate ?? row.createdAt;
  const age = row.projectDurationDays ?? diffDaysFromNow(anchorDate);

  if (!targetDays) {
    return "Prazo total do projeto sem meta definida";
  }

  const delayDays = Math.max(0, age - targetDays);
  if (delayDays > 0) {
    return `Projeto com ${age} dias e atraso de ${delayDays} dias sobre a meta`;
  }

  return `Projeto com ${age} dias para meta total de ${targetDays} dias`;
}

function getWorkbookRiskSeverity(row: ProjectRow): number {
  const combined = `${row.workbookRiskLabel ?? ""};${row.workbookRiskB2BLabel ?? ""}`.toLowerCase();
  if (!combined.trim()) {
    return 0;
  }

  let severity = 0.4;

  if (combined.includes("problemas financeiros") || combined.includes("aditivo de cancelamento")) {
    severity = Math.max(severity, 1);
  }
  if (
    combined.includes("cliente sem fit") ||
    combined.includes("alinhamento de expectativa") ||
    combined.includes("troca do erp")
  ) {
    severity = Math.max(severity, 0.8);
  }
  if (combined.includes("problemas com integração") || combined.includes("integração atrasada")) {
    severity = Math.max(severity, 0.7);
  }
  if (combined.includes("engajamento")) {
    severity = Math.max(severity, 0.65);
  }
  if (combined.includes("parceiro")) {
    severity = Math.max(severity, 0.55);
  }

  const factorCount = combined
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean).length;

  return Math.min(1, severity + Math.max(0, factorCount - 1) * 0.12);
}

function buildWorkbookRiskLabel(row: ProjectRow): string {
  const items = [row.workbookRiskLabel, row.workbookRiskB2BLabel]
    .flatMap((value) => String(value ?? "").split(";"))
    .map((item) => item.trim())
    .filter(Boolean);

  if (items.length === 0) {
    return "Planilha sinaliza risco operacional";
  }

  return `Risco mapeado no workbook: ${items.slice(0, 2).join(" • ")}`;
}

function getLastActivitySeverity(row: ProjectRow): number {
  const days = getLastActivityDays(row);

  if (days >= 30) {
    return 1;
  }
  if (days >= 15) {
    return 0.7;
  }
  if (days >= 7) {
    return 0.35;
  }

  return 0;
}

function buildLastActivityLabel(row: ProjectRow): string {
  const days = getLastActivityDays(row);
  if (days <= 0) {
    return "Follow-up recente";
  }

  return `Cliente sem follow-up há ${days} dias`;
}

function pushFactor(
  factors: RiskFactor[],
  key: string,
  label: string,
  points: number,
  shouldInclude: boolean,
): void {
  if (!shouldInclude || points <= 0) {
    return;
  }

  factors.push({ key, label, points });
}

function clampRisk(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildImplanterPlan(implanter: string, projects: RankedProject[]): ImplanterWeeklyPlan {
  const totalProjects = projects.length;
  const criticalCount = projects.filter((project) => project.priority === "Crítica").length;
  const highCount = projects.filter((project) => project.priority === "Alta").length;
  const overdueCount = projects.filter((project) => project.row.hasOverdueSubscription).length;
  const avgRisk = Math.round(projects.reduce((sum, project) => sum + project.risk, 0) / totalProjects);

  const focusProjects = projects
    .slice()
    .sort((a, b) => {
      return (
        b.risk - a.risk ||
        diffDaysFromNow(b.row.createdAt) - diffDaysFromNow(a.row.createdAt) ||
        a.row.clientName.localeCompare(b.row.clientName)
      );
    })
    .slice(0, 3)
    .map((project) => buildWeeklyFocusProject(project));

  return {
    implanter,
    totalProjects,
    avgRisk,
    criticalCount,
    highCount,
    overdueCount,
    portfolioCall: buildPortfolioCall({ totalProjects, avgRisk, criticalCount, highCount, overdueCount }),
    weeklyStrategy: buildWeeklyStrategy(projects),
    focusProjects,
  };
}

function buildWeeklyFocusProject(project: RankedProject): WeeklyFocusProject {
  const ageDays = diffDaysFromNow(project.row.createdAt);
  const topFactorLabels = project.factors.slice(0, 3).map((factor) => factor.label);

  return {
    clientName: project.row.clientName,
    risk: project.risk,
    priority: project.priority,
    phase: project.row.phase,
    ageDays,
    recommendation: project.recommendation,
    whyNow:
      topFactorLabels.length > 0
        ? `${topFactorLabels.join(" • ")}${ageDays >= 90 ? ` • ${ageDays} dias de projeto` : ""}`
        : `Projeto com ${ageDays} dias e atenção imediata.`,
  };
}

function buildPortfolioCall(input: {
  totalProjects: number;
  avgRisk: number;
  criticalCount: number;
  highCount: number;
  overdueCount: number;
}): string {
  const { totalProjects, avgRisk, criticalCount, highCount, overdueCount } = input;

  if (criticalCount >= 3 || avgRisk >= 55) {
    return `Carteira pressionada para a semana: ${criticalCount} críticos, ${highCount} altas e risco médio ${avgRisk}.`;
  }

  if (overdueCount >= 2) {
    return `Carteira com viés financeiro: ${overdueCount} contas vencidas exigem foco antes do restante da fila.`;
  }

  if (totalProjects >= 30) {
    return `Carteira volumosa: priorizar poucos projetos de alto impacto será mais eficiente do que distribuir esforço.`;
  }

  return `Carteira relativamente controlada, com espaço para atuar nos projetos de maior aging e destravar ativação.`;
}

function buildWeeklyStrategy(projects: RankedProject[]): string {
  const overdue = projects.filter((project) => project.row.hasOverdueSubscription).length;
  const implementationAging = projects.filter((project) => {
    const phase = normalizePhase(project.row.phase);
    const age = diffDaysFromNow(project.row.createdAt);
    return (phase === "implantacao" || phase === "setup") && age > 30;
  }).length;
  const onboardingBlockers = projects.filter((project) => {
    return project.row.pendingUsers > 0 && project.row.vendorUsers > 0;
  }).length;

  if (overdue >= 2) {
    return "Comece a semana salvando receita: tratar financeiro vencido primeiro, depois atacar os casos de ativação travada.";
  }

  if (implementationAging >= 3) {
    return "A prioridade deve ser destravar projetos antigos em Setup/Implantação antes que virem backlog crônico de carteira.";
  }

  if (onboardingBlockers >= 4) {
    return "A semana deve focar em adoção: mutirão de cadastro, revisão de treinamento e alinhamento de próximo passo com o cliente.";
  }

  return "Organize a carteira em 3 a 5 projetos foco e mantenha o restante em monitoramento leve, evitando dispersão operacional.";
}

function buildCoordinatorGuide(implanter: string, projects: RankedProject[]): CoordinatorGuide {
  const totalProjects = projects.length;
  const criticalCount = projects.filter((project) => project.priority === "Crítica").length;
  const highCount = projects.filter((project) => project.priority === "Alta").length;
  const overdueCount = projects.filter((project) => project.row.hasOverdueSubscription).length;
  const delayedCount = projects.filter((project) => getProjectDelayDays(project.row) >= 7).length;
  const adoptionBlockers = projects.filter((project) => project.row.pendingUsers > 0).length;
  const staleFollowUps = projects.filter((project) => getLastActivityDays(project.row) >= 7).length;
  const avgRisk = Math.round(projects.reduce((sum, project) => sum + project.risk, 0) / totalProjects);
  const segment = isMidImplanterName(implanter) ? "MID" : "SMB";

  const focusProjects = projects
    .slice()
    .sort((a, b) => {
      return (
        b.risk - a.risk ||
        getProjectDelayDays(b.row) - getProjectDelayDays(a.row) ||
        diffDaysFromNow(b.row.kickOffDate ?? b.row.createdAt) -
          diffDaysFromNow(a.row.kickOffDate ?? a.row.createdAt) ||
        a.row.clientName.localeCompare(b.row.clientName)
      );
    })
    .slice(0, 5)
    .map((project) => buildCoordinatorFocusProject(project));

  return {
    implanter,
    segment,
    portfolioSummary: buildCoordinatorPortfolioSummary({
      totalProjects,
      criticalCount,
      highCount,
      overdueCount,
      avgRisk,
    }),
    weeklyGoal: buildCoordinatorWeeklyGoal({
      overdueCount,
      delayedCount,
      adoptionBlockers,
      staleFollowUps,
      segment,
    }),
    attackOrder: buildCoordinatorAttackOrder({
      overdueCount,
      delayedCount,
      adoptionBlockers,
      staleFollowUps,
    }),
    managementAlert: buildCoordinatorManagementAlert({
      totalProjects,
      criticalCount,
      delayedCount,
      adoptionBlockers,
      staleFollowUps,
      segment,
    }),
    focusProjects,
  };
}

function buildCoordinatorFocusProject(project: RankedProject): CoordinatorFocusProject {
  const ageDays = diffDaysFromNow(project.row.kickOffDate ?? project.row.createdAt);
  const delayDays = getProjectDelayDays(project.row);
  const reasons = project.factors.slice(0, 3).map((factor) => factor.label).join(" • ");

  return {
    clientName: project.row.clientName,
    priority: project.priority,
    risk: project.risk,
    phase: project.row.phase,
    whyNow: delayDays > 0 ? `${reasons} • ${ageDays} dias de projeto` : reasons || `${ageDays} dias de projeto`,
    recommendation: project.recommendation,
  };
}

function buildCoordinatorPortfolioSummary(input: {
  totalProjects: number;
  criticalCount: number;
  highCount: number;
  overdueCount: number;
  avgRisk: number;
}): string {
  const { totalProjects, criticalCount, highCount, overdueCount, avgRisk } = input;

  if (criticalCount >= 8 || avgRisk >= 55) {
    return `Carteira pressionada: ${criticalCount} críticos, ${highCount} altas e risco médio ${avgRisk}.`;
  }

  if (overdueCount >= 2) {
    return `Carteira com pressão financeira: ${overdueCount} contas vencidas precisam entrar na frente.`;
  }

  if (totalProjects >= 28) {
    return `Carteira volumosa: a eficiência da semana virá de foco em poucos projetos de alto impacto.`;
  }

  return `Carteira mais controlada, com espaço para atacar backlog e consolidar ativação.`;
}

function buildCoordinatorWeeklyGoal(input: {
  overdueCount: number;
  delayedCount: number;
  adoptionBlockers: number;
  staleFollowUps: number;
  segment: "MID" | "SMB";
}): string {
  const { overdueCount, delayedCount, adoptionBlockers, staleFollowUps, segment } = input;

  if (overdueCount >= 2) {
    return "Salvar receita primeiro e só depois redistribuir energia para os demais projetos.";
  }

  if (delayedCount >= 5) {
    return `Reduzir o backlog de atraso ${segment} antes que a carteira continue acumulando risco estrutural.`;
  }

  if (staleFollowUps >= 5) {
    return "Retomar follow-ups com clientes sem contato recente para recuperar tração e evitar projetos órfãos na carteira.";
  }

  if (adoptionBlockers >= 5) {
    return "Concentrar a semana em destravar cadastro, ativação e próximos passos combinados com o cliente.";
  }

  return "Manter 3 a 5 projetos foco com cadência forte e o restante em monitoramento leve.";
}

function buildCoordinatorAttackOrder(input: {
  overdueCount: number;
  delayedCount: number;
  adoptionBlockers: number;
  staleFollowUps: number;
}): string[] {
  const { overdueCount, delayedCount, adoptionBlockers, staleFollowUps } = input;
  const items: string[] = [];

  if (overdueCount > 0) {
    items.push("Financeiro vencido e contas com risco imediato de receita.");
  }

  if (delayedCount > 0) {
    items.push("Projetos atrasados acima do prazo da carteira, começando pelos que já estão críticos.");
  }

  if (staleFollowUps > 0) {
    items.push("Clientes sem follow-up recente, para recuperar tração e fechar próximo passo ainda nesta semana.");
  }

  if (adoptionBlockers > 0) {
    items.push("Casos com cadastro pendente, baixa ativação ou engajamento fraco.");
  }

  items.push("Restante da carteira em monitoramento leve, sem dispersar esforço.");
  return items;
}

function buildCoordinatorManagementAlert(input: {
  totalProjects: number;
  criticalCount: number;
  delayedCount: number;
  adoptionBlockers: number;
  staleFollowUps: number;
  segment: "MID" | "SMB";
}): string {
  const { totalProjects, criticalCount, delayedCount, adoptionBlockers, staleFollowUps, segment } = input;

  if (criticalCount >= 10) {
    return "Alerta de coordenação: carteira precisa de acompanhamento próximo da liderança e revisão diária dos focos.";
  }

  if (delayedCount >= 6) {
    return `Alerta de backlog: há muitos projetos ${segment} fora do prazo e a cadência padrão não é mais suficiente.`;
  }

  if (adoptionBlockers >= 6) {
    return "Alerta operacional: a carteira está travando mais por ativação do que por cronograma; vale montar mutirão com playbook claro.";
  }

  if (staleFollowUps >= 6) {
    return "Alerta de cadência: há muitos clientes sem follow-up recente e isso tende a corroer avanço mesmo quando o risco operacional parece controlado.";
  }

  if (totalProjects <= 5) {
    return "Carteira pequena: a expectativa é resolver integralmente os casos críticos nesta semana, não apenas acompanhar.";
  }

  return "Carteira pede disciplina de priorização, mas sem necessidade de intervenção extraordinária da coordenação.";
}

function inferTargetFromRow(row: ProjectRow): number | null {
  if (row.plannedProjectDays && row.plannedProjectDays > 0) {
    return row.plannedProjectDays;
  }

  if (row.deliveryTargetDays && row.deliveryTargetDays > 0) {
    return row.deliveryTargetDays;
  }

  const implanter = row.implanter.trim().toLowerCase();
  if (isMidImplanterName(implanter)) {
    return 90;
  }

  if (implanter) {
    return 60;
  }

  const details = `${row.projectTypeDetails ?? ""} ${row.projectType ?? ""}`.toLowerCase();

  if (details.includes("90 dias") || details.includes("mid")) {
    return 90;
  }

  if (details.includes("60 dias") || details.includes("smb")) {
    return 60;
  }

  if (details.includes("45 dias")) {
    return 45;
  }

  if (details.includes("30 dias")) {
    return 30;
  }

  return null;
}

function isMidImplanterName(implanter: string): boolean {
  void implanter;
  return false;
}

function getProjectDelayDays(row: ProjectRow): number {
  const targetDays = inferTargetFromRow(row);
  if (targetDays && row.projectDurationDays !== null && row.projectDurationDays !== undefined) {
    return Math.max(0, row.projectDurationDays - targetDays);
  }

  const anchorDate = row.kickOffDate ?? row.createdAt;

  if (!targetDays || !anchorDate) {
    return 0;
  }

  return Math.max(0, diffDaysFromNow(anchorDate) - targetDays);
}

function getLastActivityDays(row: ProjectRow): number {
  return row.lastActivityAt ? diffDaysFromNow(row.lastActivityAt) : 0;
}

export function hasCriticalProjectStatus(status?: string): boolean {
  const normalized = normalizeProjectStatus(status);
  return normalized.includes("critico");
}

export function hasStoppedProjectStatus(status?: string): boolean {
  const normalized = normalizeProjectStatus(status);
  return normalized.includes("parado");
}

export function isStoppedProject(row: ProjectRow): boolean {
  return (
    hasStoppedProjectStatus(row.projectStatus) ||
    getLastActivityDays(row) >= 7 ||
    (row.overdueActivitiesCount ?? 0) > 0 ||
    getProjectDelayDays(row) >= 7 ||
    row.pendingUsers > 0
  );
}

export function describeStoppedProject(row: ProjectRow): string {
  const reasons: string[] = [];

  if (hasStoppedProjectStatus(row.projectStatus)) {
    reasons.push(`status ${String(row.projectStatus ?? "").trim()}`);
  }

  const inactivityDays = getLastActivityDays(row);
  if (inactivityDays >= 7) {
    reasons.push(`${inactivityDays} dias sem follow-up`);
  }

  if ((row.overdueActivitiesCount ?? 0) > 0) {
    reasons.push(`${row.overdueActivitiesCount} atividade(s) em atraso`);
  }

  const delayDays = getProjectDelayDays(row);
  if (delayDays >= 7) {
    reasons.push(`${delayDays} dias acima do prazo`);
  }

  if (row.pendingUsers > 0) {
    reasons.push(`${row.pendingUsers} usuário(s) pendente(s)`);
  }

  if (row.hasOverdueSubscription) {
    reasons.push("mensalidade vencida");
  }

  return reasons.slice(0, 3).join(" • ") || "sem avanço claro na carteira";
}

function evaluateQuadrant(
  row: ProjectRow,
  riskScore: number,
  riskFactors: RiskFactor[],
): RankedProject["quadrantEvaluation"] {
  const impactFactors = calculateImpactFactors(row);
  const impactScore = clampRisk(impactFactors.reduce((sum, factor) => sum + factor.points, 0));
  const forcedCritical = isForcedCriticalProject(row);
  const highImpact = impactScore >= 50;
  const highRisk = riskScore >= 50;

  const quadrant =
    forcedCritical
      ? "CRÍTICO"
      : highImpact && highRisk
      ? "CRÍTICO"
      : highImpact
        ? "ACELERA"
        : highRisk
          ? "ATENÇÃO"
          : "ROTINA";

  const why =
    forcedCritical
      ? "Projeto crítico por regra operacional: está parado, marcado como crítico ou acima da SLA e exige atuação imediata."
      : quadrant === "CRÍTICO"
      ? "Projeto com peso estratégico alto e risco real de atraso, travamento ou baixa adoção."
      : quadrant === "ACELERA"
        ? "Projeto com alto impacto e baixa fricção relativa, ideal para gerar resultado rápido."
        : quadrant === "ATENÇÃO"
          ? "Projeto menos estratégico no momento, mas com risco suficiente para exigir acompanhamento disciplinado."
          : "Projeto de menor impacto e baixo risco, adequado para acompanhamento operacional."

  const coachingQuestion =
    quadrant === "CRÍTICO"
      ? "Este projeto exige atuação imediata porque combina peso estratégico com risco real?"
      : quadrant === "ACELERA"
        ? "Este é um ganho rápido que vale acelerar antes de gastar energia em problemas menores?"
        : quadrant === "ATENÇÃO"
          ? "Existe risco real aqui ou estamos dando atenção demais a uma conta de baixo impacto?"
          : "Estou gastando tempo demais em projetos de rotina em vez de atuar nos quadrantes acima?"

  return {
    quadrant,
    impactScore,
    riskScore,
    impactFactors,
    riskFactors: riskFactors.slice(0, 4),
    why,
    coachingQuestion,
  };
}

function calculateImpactFactors(row: ProjectRow): ImpactFactor[] {
  const factors: ImpactFactor[] = [];
  const phase = normalizePhase(row.phase);

  if ((row.amountPaid ?? 0) >= 3000) {
    factors.push({ key: "mrr-high", label: "Conta com valor pago alto", points: 34 });
  } else if ((row.amountPaid ?? 0) > 0) {
    factors.push({ key: "mrr", label: "Conta com valor pago registrado", points: 22 });
  }

  if (
    phase.includes("go live") ||
    phase.includes("golive") ||
    phase.includes("valid") ||
    phase.includes("encerr") ||
    phase.includes("acomp")
  ) {
    factors.push({ key: "moment", label: "Projeto em momento decisivo de ativação/go-live", points: 24 });
  } else if (phase.includes("implant") || phase.includes("setup")) {
    factors.push({ key: "moment-mid", label: "Projeto ainda em etapa estrutural de implantação", points: 10 });
  }

  if (row.hasB2B || row.integratedAppsCount >= 3) {
    factors.push({ key: "expansion", label: "Conta com potencial de expansão ou operação mais estratégica", points: 18 });
  }

  if (row.vendorUsers >= 8) {
    factors.push({ key: "team-size", label: "Operação com base relevante de usuários/comercial", points: 16 });
  } else if (row.vendorUsers >= 3) {
    factors.push({ key: "team-size-mid", label: "Conta com operação comercial ativa", points: 10 });
  }

  if ((row.workbookRiskLabel ?? "").trim() || (row.workbookRiskB2BLabel ?? "").trim()) {
    factors.push({ key: "relevance", label: "Conta marcada com fator relevante no workbook", points: 12 });
  }

  return factors.slice(0, 4);
}

function getQuadrantSortOrder(quadrant: RankedProject["quadrantEvaluation"]["quadrant"]): number {
  switch (quadrant) {
    case "CRÍTICO":
      return 0;
    case "ACELERA":
      return 1;
    case "ATENÇÃO":
      return 2;
    case "ROTINA":
    default:
      return 3;
  }
}

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function getProjectStatusFactors(status?: string): RiskFactor[] {
  const factors: RiskFactor[] = [];

  if (hasCriticalProjectStatus(status)) {
    factors.push({
      key: "project-status-critical",
      label: "Status do projeto marcado como crítico",
      points: 26,
    });
  }

  if (hasStoppedProjectStatus(status)) {
    factors.push({
      key: "project-status-stopped",
      label: "Status do projeto marcado como parado",
      points: 20,
    });
  }

  return factors;
}

function normalizeProjectStatus(status?: string): string {
  return String(status ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function evaluateProjectClosure(row: ProjectRow): ClosureEvaluation {
  const metCriteria: string[] = [];
  const missingCriteria: string[] = [];
  let score = 0;

  const phase = normalizePhase(row.phase);
  const status = String(row.projectStatus ?? "").toLowerCase();
  const lastActivityDays = getLastActivityDays(row);
  const pendingUsers = row.pendingUsers;
  const engagementSeverity = Math.max(
    mapEngagementSeverity(row.engagementOrdersLabel),
    mapEngagementSeverity(row.engagementOrdersQuotesLabel),
  );
  const integrationReady =
    row.integratedAppsCount === 0 ||
    (!row.workbookRiskLabel && !row.workbookRiskB2BLabel && !status.includes("erro"));
  const advancedPhase =
    phase.includes("acomp") ||
    phase.includes("valid") ||
    phase.includes("final") ||
    phase.includes("encerr") ||
    phase.includes("go live") ||
    phase.includes("golive");
  const positiveStatus =
    status.includes("concl") ||
    status.includes("ativo") ||
    status.includes("implant") ||
    status.includes("go live");

  if (advancedPhase || positiveStatus) {
    metCriteria.push("Projeto em etapa final ou status avançado");
    score += 2;
  } else {
    missingCriteria.push("Projeto ainda não está em etapa compatível com encerramento");
  }

  if (!row.hasOverdueSubscription) {
    metCriteria.push("Sem pendência financeira identificada");
    score += 2;
  } else {
    missingCriteria.push("Existe pendência financeira");
  }

  if (pendingUsers === 0) {
    metCriteria.push("Sem usuários pendentes no escopo visível");
    score += 1;
  } else {
    missingCriteria.push("Ainda há usuários pendentes ou configuração em aberto");
  }

  if (engagementSeverity <= 0.35 && row.vendorUsers > 0) {
    metCriteria.push("Uso/engajamento compatível com operação ativa");
    score += 1;
  } else if (row.vendorUsers > 0) {
    missingCriteria.push("Engajamento ainda não sinaliza operação estabilizada");
  }

  if (integrationReady) {
    metCriteria.push("Sem sinal visível de falha de integração");
    score += 1;
  } else {
    missingCriteria.push("Há indícios de risco ou pendência na integração");
  }

  if (lastActivityDays > 0 && lastActivityDays <= 7) {
    metCriteria.push("Follow-up recente para validar fechamento");
    score += 1;
  } else {
    missingCriteria.push("Falta follow-up recente para validar encerramento");
  }

  missingCriteria.push("Confirmar reunião final de alinhamento com o cliente");
  missingCriteria.push("Confirmar validação verbal de encerramento e satisfação na reunião");
  missingCriteria.push("Confirmar treinamento concluído e equipe apta a operar");
  missingCriteria.push("Confirmar ausência de dúvidas operacionais e desativação da solução anterior, quando aplicável");

  const uniqueMissing = Array.from(new Set(missingCriteria));
  const statusLabel =
    score >= 6 && uniqueMissing.length <= 4
      ? "Apto para validação final"
      : score >= 4
        ? "Quase apto"
        : "Não apto";

  const summary =
    statusLabel === "Apto para validação final"
      ? "Os sinais da base indicam que o projeto pode entrar em validação final de encerramento."
      : statusLabel === "Quase apto"
        ? "O projeto está próximo de concluir, mas ainda precisa validar itens do playbook antes do encerramento."
        : "Ainda não há evidência suficiente para considerar o projeto apto à conclusão.";

  return {
    status: statusLabel,
    score,
    metCriteria,
    missingCriteria: uniqueMissing.slice(0, 5),
    summary,
  };
}

function applyDelayPriorityFloor(risk: number, delayDays: number): number {
  if (delayDays > 0) {
    return Math.max(risk, 70);
  }

  if (delayDays >= 15) {
    return Math.max(risk, 70);
  }

  if (delayDays >= 7) {
    return Math.max(risk, 50);
  }

  return risk;
}

function isForcedCriticalProject(row: ProjectRow): boolean {
  return hasCriticalProjectStatus(row.projectStatus) || hasStoppedProjectStatus(row.projectStatus) || getProjectDelayDays(row) > 0;
}

function normalizePhase(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\d+\s*-\s*/, "")
    .trim()
    .toLowerCase();
}
