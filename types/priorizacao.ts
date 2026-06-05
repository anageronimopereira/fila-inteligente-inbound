export type PriorityLevel = "Critica" | "Alta" | "Media" | "Baixa";

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

export interface ClienteProjeto extends CsvRowRaw {
  createdAt: Date | null;
  implanter: string;
  phase: string;
  clientName: string;
  hasOverdueSubscription: boolean;
  integratedApps: number;
  hasB2B: boolean;
  pendingUsers: number;
  vendorUsers: number;
  engagementOrdersLabel: string;
  engagementOrdersQuotesLabel: string;
  detailUrl: string;
}

export interface RiskScoreBreakdown {
  score: number;
  priority: PriorityLevel;
  nextAction: string;
  reasons: string[];
}

export interface DashboardMetrics {
  totalClientes: number;
  riscoMedio: number;
  criticos: number;
  comMensalidadeVencida: number;
}
