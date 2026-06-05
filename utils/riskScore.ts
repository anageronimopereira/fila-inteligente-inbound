import type { ClienteProjeto, PriorityLevel, RiskScoreBreakdown } from "../types/priorizacao";

const PHASE_WEIGHTS: Record<string, number> = {
  kickoff: 5,
  implantacao: 15,
  treinamento: 18,
  configuracao: 14,
  pendente: 20,
  atrasado: 26,
  pausado: 24,
};

const ENGAGEMENT_WEIGHTS: Record<string, number> = {
  sem_engajamento: 25,
  muito_baixo: 22,
  baixo: 18,
  medio: 10,
  alto: 2,
};

export function calculateRiskScore(cliente: ClienteProjeto): RiskScoreBreakdown {
  let score = 0;
  const reasons: string[] = [];

  if (cliente.hasOverdueSubscription) {
    score += 25;
    reasons.push("Mensalidade vencida");
  }

  if (cliente.pendingUsers >= 20) {
    score += 20;
    reasons.push("Muitos usuários pendentes");
  } else if (cliente.pendingUsers >= 5) {
    score += 12;
    reasons.push("Usuários pendentes de cadastro");
  }

  if (cliente.vendorUsers > 0) {
    const adoptionRatio = 1 - Math.min(cliente.pendingUsers / cliente.vendorUsers, 1);
    if (adoptionRatio < 0.35) {
      score += 18;
      reasons.push("Adoção baixa entre vendedores");
    } else if (adoptionRatio < 0.6) {
      score += 10;
      reasons.push("Adoção parcial entre vendedores");
    }
  }

  if (cliente.integratedApps === 0) {
    score += 15;
    reasons.push("Sem integrações ativas");
  } else if (cliente.integratedApps <= 2) {
    score += 6;
  }

  if (cliente.hasB2B) {
    score += 4;
    reasons.push("Operação com B2B exige acompanhamento");
  }

  const phaseKey = normalizeLookup(cliente.phase);
  score += PHASE_WEIGHTS[phaseKey] ?? 8;
  if ((PHASE_WEIGHTS[phaseKey] ?? 0) >= 18) {
    reasons.push(`Fase sensível: ${cliente.phase}`);
  }

  const engagementOrders = getEngagementWeight(cliente.engagementOrdersLabel);
  const engagementQuotes = getEngagementWeight(cliente.engagementOrdersQuotesLabel);
  score += Math.max(engagementOrders, engagementQuotes);
  if (Math.max(engagementOrders, engagementQuotes) >= 18) {
    reasons.push("Engajamento comercial baixo");
  }

  const daysSinceCreation = getDaysSince(cliente.createdAt);
  if (daysSinceCreation >= 120) {
    score += 16;
    reasons.push("Projeto antigo sem estabilização");
  } else if (daysSinceCreation >= 60) {
    score += 8;
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const priority = getPriorityLabel(boundedScore);

  return {
    score: boundedScore,
    priority,
    nextAction: recommendNextAction(cliente, priority),
    reasons,
  };
}

export function getPriorityLabel(score: number): PriorityLevel {
  if (score >= 75) {
    return "Critica";
  }
  if (score >= 55) {
    return "Alta";
  }
  if (score >= 35) {
    return "Media";
  }
  return "Baixa";
}

export function getPriorityTone(priority: PriorityLevel): { bg: string; fg: string; border: string } {
  switch (priority) {
    case "Critica":
      return { bg: "#fff1f0", fg: "#b42318", border: "#fda29b" };
    case "Alta":
      return { bg: "#fff7ed", fg: "#c2410c", border: "#fdba74" };
    case "Media":
      return { bg: "#fffbeb", fg: "#a16207", border: "#fde68a" };
    case "Baixa":
    default:
      return { bg: "#ecfdf3", fg: "#027a48", border: "#86efac" };
  }
}

function recommendNextAction(cliente: ClienteProjeto, priority: PriorityLevel): string {
  if (cliente.hasOverdueSubscription) {
    return "Acionar financeiro e alinhar retomada com CS antes de avançar na implantação.";
  }

  if (cliente.pendingUsers >= 10) {
    return "Executar força-tarefa de cadastro com o patrocinador do cliente nesta semana.";
  }

  if (getEngagementWeight(cliente.engagementOrdersLabel) >= 18) {
    return "Agendar treinamento prático com vendedores e revisar meta mínima de uso.";
  }

  if (cliente.integratedApps === 0) {
    return "Priorizar setup de integração principal para reduzir fricção operacional.";
  }

  if (priority === "Critica" || priority === "Alta") {
    return "Abrir plano de ação executivo com checkpoint em 48 horas.";
  }

  if (cliente.phase.trim()) {
    return `Manter acompanhamento da fase "${cliente.phase}" com próximo marco definido.`;
  }

  return "Seguir rotina de acompanhamento semanal com validação de adoção.";
}

function getEngagementWeight(value: string): number {
  const normalized = normalizeLookup(value);
  return ENGAGEMENT_WEIGHTS[normalized] ?? 8;
}

function normalizeLookup(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function getDaysSince(date: Date | null): number {
  if (!date) {
    return 0;
  }

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}
