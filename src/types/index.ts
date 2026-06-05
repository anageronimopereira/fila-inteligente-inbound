export type PriorityLevel = "Crítica" | "Alta" | "Média" | "Baixa";

export interface CsvRowRaw {
  "Data Criacao Projeto Cs": string;
  "Implantador Do Projeto C": string;
  "Fase Do Projeto": string;
  "Nome Cliente": string;
  "Possui Mensalidade Vencida": string;
  "Aplicativos Integrados": string;
  "Tem B2B?": string;
  "Usuarios Com Cadastro Pendente": string;
  "Usuarios Vendedores": string;
  "Faixa Engajamento Vendedores Emitindo 5 Pedidos Ou Mais Ult 3 Meses": string;
  "Faixa Engajamento Vendedores Emitindo 5 Ou Mais Pedidos Ou Orcamentos Ult 3 Meses": string;
  "Detalhar Cliente": string;
}

export interface ProjectRow extends CsvRowRaw {
  createdAt: Date | null;
  implanter: string;
  phase: string;
  clientName: string;
  hasOverdueSubscription: boolean;
  integratedAppsLabel: string;
  integratedAppsCount: number;
  hasB2B: boolean;
  pendingUsers: number;
  vendorUsers: number;
  engagementOrdersLabel: string;
  engagementOrdersQuotesLabel: string;
  engagementOrdersPercent?: string;
  engagementOrdersQuotesPercent?: string;
  detailUrl: string;
  kickOffDate?: Date | null;
  plannedDeliveryDate?: Date | null;
  lastActivityAt?: Date | null;
  lastActivityLabel?: string;
  amountPaid?: number | null;
  workbookRiskLabel?: string;
  workbookRiskB2BLabel?: string;
  projectType?: string;
  projectTypeDetails?: string;
  projectStatus?: string;
  deliveryTargetDays?: number | null;
  dataSources?: string[];
  overdueActivitiesCount?: number;
  overdueActivitiesOldestDate?: Date | null;
  overdueActivitiesSubjects?: string[];
}

export interface RiskWeights {
  overdue: number;
  engagement: number;
  pendingUsers: number;
  integration: number;
  slaDelay: number;
  projectDuration: number;
  workbookRisk: number;
  inactivity: number;
  b2b: number;
}

export interface RiskFactor {
  key: string;
  label: string;
  points: number;
}

export interface ImpactFactor {
  key: string;
  label: string;
  points: number;
}

export interface RiskResult {
  risk: number;
  priority: PriorityLevel;
  recommendation: string;
  factors: RiskFactor[];
}

export interface ClosureEvaluation {
  status: "Apto para validação final" | "Quase apto" | "Não apto";
  score: number;
  metCriteria: string[];
  missingCriteria: string[];
  summary: string;
}

export interface QuadrantEvaluation {
  quadrant: "CRÍTICO" | "ACELERA" | "ATENÇÃO" | "ROTINA";
  impactScore: number;
  riskScore: number;
  impactFactors: ImpactFactor[];
  riskFactors: RiskFactor[];
  why: string;
  coachingQuestion: string;
}

export interface RankedProject {
  row: ProjectRow;
  risk: number;
  priority: PriorityLevel;
  recommendation: string;
  factors: RiskFactor[];
  closureEvaluation: ClosureEvaluation;
  quadrantEvaluation: QuadrantEvaluation;
}

export interface DashboardMetrics {
  totalProjects: number;
  criticalProjects: number;
  highPriorityProjects: number;
  overdueSubscriptions: number;
  noFollowUpRecorded: number;
  staleFollowUp7d: number;
  staleFollowUp15d: number;
}

export interface CsvParseResult {
  rows: ProjectRow[];
  headers: Array<keyof CsvRowRaw>;
}

export interface UploadIssue {
  fileName: string;
  message: string;
  severity: "warning" | "error" | "info";
}

export interface WeeklyFocusProject {
  clientName: string;
  risk: number;
  priority: PriorityLevel;
  phase: string;
  ageDays: number;
  recommendation: string;
  whyNow: string;
}

export interface ImplanterWeeklyPlan {
  implanter: string;
  totalProjects: number;
  avgRisk: number;
  criticalCount: number;
  highCount: number;
  overdueCount: number;
  portfolioCall: string;
  weeklyStrategy: string;
  focusProjects: WeeklyFocusProject[];
}

export interface StrategicInsights {
  hasMrrData: boolean;
  totalMrr: number;
  stoppedMrr: number;
  stoppedProjects: Array<{
    clientName: string;
    implanter: string;
    mrr: number;
    reason: string;
  }>;
  globalInsights: string[];
  implanterPlans: ImplanterWeeklyPlan[];
}

export interface CoordinatorFocusProject {
  clientName: string;
  priority: PriorityLevel;
  risk: number;
  phase: string;
  whyNow: string;
  recommendation: string;
}

export interface CoordinatorGuide {
  implanter: string;
  segment: "MID" | "SMB";
  portfolioSummary: string;
  weeklyGoal: string;
  attackOrder: string[];
  managementAlert: string;
  focusProjects: CoordinatorFocusProject[];
}

export interface CoordinatorInsights {
  summary: string[];
  guides: CoordinatorGuide[];
}

export interface WeeklySnapshot {
  id: string;
  weekLabel: string;
  createdAt: string;
  fileSummary: string[];
  projects: RankedProject[];
}

export interface WeeklyMovement {
  clientName: string;
  implanter: string;
  currentRisk: number;
  previousRisk: number;
  delta: number;
  currentPriority: PriorityLevel;
  previousPriority: PriorityLevel;
}

export interface WeeklyComparison {
  currentWeekLabel: string;
  previousWeekLabel: string | null;
  currentTotal: number;
  previousTotal: number;
  enteredCritical: WeeklyMovement[];
  leftCritical: WeeklyMovement[];
  biggestIncrease: WeeklyMovement[];
  biggestDecrease: WeeklyMovement[];
  newProjects: WeeklyMovement[];
  removedProjects: WeeklyMovement[];
  summary: string[];
}

export interface ExecutiveOpenProjectRow {
  projectName: string;
  clientName: string;
  implanter: string;
  kickOffDate: Date | null;
  plannedDeliveryDate: Date | null;
  status: string;
  partnerName: string;
  projectType: string;
  projectTypeDetails: string;
  whyStopped: string;
  lastActivityAt: Date | null;
  amountPaid: number;
  contractValue: number;
  riskFactor: string;
  portfolioClass: string;
  finalizationNote: string;
  finalizationAccepted: boolean;
}

export interface ExecutiveContractValueRow {
  clientName: string;
  projectName: string;
  contractValue: number;
}

export interface ExecutiveClosedProjectRow {
  clientName: string;
  projectName: string;
  closedAt: Date | null;
  implanter: string;
  contractValue: number;
  portfolioClass: string;
  finalizationNote: string;
  finalizationScore: number | null;
}

export interface ExecutiveLostProjectRow {
  clientName: string;
  projectName: string;
  implanter: string;
  projectTypeDetails: string;
  projectClosedAt: Date | null;
  accountClosedAt: Date | null;
  amountPaid: number;
  kickOffDate: Date | null;
  erpName: string;
  contractValue: number;
}

export interface ExecutiveCancellationProjectRow {
  opportunityName: string;
  clientName: string;
  projectName: string;
  erpName: string;
  segment: string;
  implanter: string;
  monthsOfLife: number;
  cancellationMrr: number;
  phase: string;
  projectType: string;
  closeDate: Date | null;
  newBusinessDate: Date | null;
}

export interface ExecutiveNewProjectRow {
  clientName: string;
  projectName: string;
  implanter: string;
  createdAt: Date | null;
  amountPaid: number;
  contractValue: number;
  portfolioClass: string;
}

export interface ExecutiveDelinquencyRow {
  createdAt: Date | null;
  implanter: string;
  phase: string;
  clientName: string;
  hasOverdueSubscription: boolean;
  integratedAppsLabel: string;
  hasB2B: boolean;
  pendingUsers: number;
  vendorUsers: number;
  engagementLabel: string;
  detailUrl: string;
}

export type ForecastMovement =
  | "Projeto em risco"
  | "Em negociação de cancelamento"
  | "Cancelado"
  | "Concluído como perdido"
  | "Revertido";

export interface ExecutiveQualitativeRow {
  weekLabel: string;
  meetingDate: Date | null;
  implanter: string;
  clientName: string;
  recordType: string;
  suggestedCriticality: string;
  forecastMovement: ForecastMovement;
  summary: string;
  nextStep: string;
  responsible: string;
  deadline: string;
  observation: string;
  impactedMrr: number | null;
  actionStatus: string;
}

export interface ExecutiveUploadsData {
  openProjects: ExecutiveOpenProjectRow[];
  closedProjects: ExecutiveClosedProjectRow[];
  lostProjects: ExecutiveLostProjectRow[];
  cancellationProjects: ExecutiveCancellationProjectRow[];
  newProjects: ExecutiveNewProjectRow[];
  delinquencyProjects: ExecutiveDelinquencyRow[];
  contractValueProjects: ExecutiveContractValueRow[];
  qualitativeProjects: ExecutiveQualitativeRow[];
}
