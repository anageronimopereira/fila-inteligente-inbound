import * as XLSX from "xlsx";

import type {
  ExecutiveCancellationProjectRow,
  ExecutiveClosedProjectRow,
  ExecutiveContractValueRow,
  ExecutiveQualitativeRow,
  ExecutiveLostProjectRow,
  ExecutiveNewProjectRow,
  ExecutiveOpenProjectRow,
  ExecutiveUploadsData,
  ExecutiveDelinquencyRow,
  ForecastMovement,
  UploadIssue,
} from "../types";
import { parseFlexibleDate } from "./dateUtils";

type Matrix = Array<Array<string | number | boolean | Date | null>>;

export async function parseExecutiveFiles(files: {
  openProjectsFile?: File | null;
  closedProjectsFile?: File | null;
  lostProjectsFile?: File | null;
  cancellationProjectsFile?: File | null;
  newProjectsFile?: File | null;
  delinquencyProjectsFile?: File | null;
  contractValueProjectsFile?: File | null;
  qualitativeProjectsFile?: File | null;
}): Promise<{ data: ExecutiveUploadsData; issues: UploadIssue[] }> {
  const issues: UploadIssue[] = [];
  const data: ExecutiveUploadsData = {
    openProjects: [],
    closedProjects: [],
    lostProjects: [],
    cancellationProjects: [],
    newProjects: [],
    delinquencyProjects: [],
    contractValueProjects: [],
    qualitativeProjects: [],
  };

  const entries: Array<[keyof ExecutiveUploadsData, File | null | undefined]> = [
    ["openProjects", files.openProjectsFile],
    ["closedProjects", files.closedProjectsFile],
    ["lostProjects", files.lostProjectsFile],
    ["cancellationProjects", files.cancellationProjectsFile],
    ["newProjects", files.newProjectsFile],
    ["delinquencyProjects", files.delinquencyProjectsFile],
    ["contractValueProjects", files.contractValueProjectsFile],
    ["qualitativeProjects", files.qualitativeProjectsFile],
  ];

  for (const [kind, file] of entries) {
    if (!file) {
      continue;
    }

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
        header: 1,
        raw: true,
        defval: null,
      });

      if (kind === "openProjects") {
        data.openProjects = parseOpenProjectsMatrix(matrix);
      } else if (kind === "closedProjects") {
        data.closedProjects = parseClosedProjectsMatrix(matrix);
      } else if (kind === "lostProjects") {
        data.lostProjects = parseLostProjectsMatrix(matrix);
      } else if (kind === "cancellationProjects") {
        data.cancellationProjects = parseCancellationProjectsMatrix(matrix);
      } else if (kind === "newProjects") {
        data.newProjects = parseNewProjectsMatrix(matrix);
      } else if (kind === "delinquencyProjects") {
        data.delinquencyProjects = parseDelinquencyProjectsMatrix(matrix);
      } else if (kind === "contractValueProjects") {
        data.contractValueProjects = parseContractValueProjectsMatrix(matrix);
      } else if (kind === "qualitativeProjects") {
        data.qualitativeProjects = parseQualitativeProjectsMatrix(matrix);
      }

      issues.push({
        fileName: file.name,
        message: `${getExecutiveRowsCount(kind, data)} registro(s) lido(s) para o dashboard executivo.`,
        severity: "info",
      });
    } catch (error) {
      issues.push({
        fileName: file.name,
        message: error instanceof Error ? error.message : "Falha ao processar a planilha executiva.",
        severity: "error",
      });
    }
  }

  if (data.contractValueProjects.length > 0) {
    data.openProjects = mergeContractValuesIntoOpenProjects(data.openProjects, data.contractValueProjects);
  }

  return { data, issues };
}

function parseOpenProjectsMatrix(matrix: Matrix): ExecutiveOpenProjectRow[] {
  const headerIndex = matrix.findIndex((row) => hasCell(row, "Nome da Conta: Nome da conta"));
  if (headerIndex === -1) {
    return [];
  }

  const header = matrix[headerIndex].map(asString);
  const idxImplanter = header.indexOf("Implantador do projeto: Nome completo  ↑");
  const idxProject = header.indexOf("Nome de Projeto");
  const idxClient = header.indexOf("Nome da Conta: Nome da conta");
  const idxKickOff = header.indexOf("Data do Kick-off");
  const idxDue = header.indexOf("Data prevista de entrega");
  const idxStatus = header.indexOf("Status do projeto");
  const idxPartner = header.indexOf("Nome do parceiro");
  const idxType = header.indexOf("Tipo de projeto");
  const idxTypeDetails = header.indexOf("Detalhes do tipo de projeto");
  const idxWhyStopped = header.indexOf("Por que parado?");
  const idxLastActivity = header.indexOf("Data da última atividade");
  const idxRiskFactor = header.indexOf("Fator de risco");
  const idxPortfolioClass = header.indexOf("Classificação da carteira");
  const idxProjectClassification = header.indexOf("Classificação do projeto");
  const idxAmountPaid = header.indexOf("Valor pago");
  const idxContractValue = header.indexOf("Valor Total do Contrato");

  const rows: ExecutiveOpenProjectRow[] = [];
  let currentImplanter = "";

  for (const row of matrix.slice(headerIndex + 1)) {
    const implanterCell = asString(row[idxImplanter]);
    if (implanterCell && implanterCell !== "Subtotal") {
      currentImplanter = implanterCell;
    }

    const projectName = asString(row[idxProject]);
    const clientName = sanitizeClientName(asString(row[idxClient]));
    if (!projectName || !clientName || projectName === "Subtotal") {
      continue;
    }

    rows.push({
      projectName,
      clientName,
      implanter: currentImplanter,
      kickOffDate: parseExcelDate(row[idxKickOff]),
      plannedDeliveryDate: parseExcelDate(row[idxDue]),
      status: asString(row[idxStatus]),
      partnerName: asString(row[idxPartner]),
      projectType: asString(row[idxType]),
      projectTypeDetails: asString(row[idxTypeDetails]),
      whyStopped: asString(row[idxWhyStopped]),
      lastActivityAt: parseExcelDate(row[idxLastActivity]),
      amountPaid: parseNumeric(row[idxAmountPaid]),
      contractValue: parseNumeric(row[idxContractValue]),
      riskFactor: asString(row[idxRiskFactor]),
      portfolioClass: asString(row[idxPortfolioClass >= 0 ? idxPortfolioClass : idxProjectClassification]),
      finalizationNote: asString(row[47]),
      finalizationAccepted: parseBooleanCell(row[48]),
    });
  }

  return rows;
}

function parseContractValueProjectsMatrix(matrix: Matrix): ExecutiveContractValueRow[] {
  const headerIndex = matrix.findIndex(
    (row) => hasCell(row, "Nome da conta") && hasCell(row, "Nome de Projeto") && hasCell(row, "Valor Total do Contrato"),
  );
  if (headerIndex === -1) {
    return [];
  }

  const header = matrix[headerIndex].map(asString);
  const idxClient = header.indexOf("Nome da conta");
  const idxProject = header.indexOf("Nome de Projeto");
  const idxContractValue = header.indexOf("Valor Total do Contrato");

  return matrix.slice(headerIndex + 1).reduce<ExecutiveContractValueRow[]>((accumulator, row) => {
    const clientName = sanitizeClientName(asString(row[idxClient]));
    const projectName = asString(row[idxProject]);
    if (!clientName || !projectName) {
      return accumulator;
    }

    accumulator.push({
      clientName,
      projectName,
      contractValue: parseNumeric(row[idxContractValue]),
    });
    return accumulator;
  }, []);
}

function parseClosedProjectsMatrix(matrix: Matrix): ExecutiveClosedProjectRow[] {
  const headerIndex = matrix.findIndex(
    (row) => hasCell(row, "Nome da conta") && hasCell(row, "Implantador do projeto: Nome completo"),
  );
  if (headerIndex === -1) {
    return [];
  }

  const header = matrix[headerIndex].map(asString);
  const indexOf = (label: string) => header.indexOf(label);

  const idxClient = indexOf("Nome da conta");
  const idxProject = indexOf("Nome de Projeto");
  const idxClosedAt = indexOf("Data de fechamento do projeto");
  const idxImplanter = indexOf("Implantador do projeto: Nome completo");
  const idxContractValue = indexOf("Valor Total do Contrato");
  const idxPortfolio = indexOf("Classificação da carteira");
  const idxNote = indexOf("Nota da finalização");

  return matrix.slice(headerIndex + 1).reduce<ExecutiveClosedProjectRow[]>((accumulator, row) => {
    const clientName = sanitizeClientName(asString(row[idxClient]));
    const projectName = asString(row[idxProject]);
    if (!clientName || !projectName) {
      return accumulator;
    }

    const finalizationNote = asString(row[idxNote]);
    accumulator.push({
      clientName,
      projectName,
      closedAt: parseExcelDate(row[idxClosedAt]),
      implanter: asString(row[idxImplanter]),
      contractValue: parseNumeric(row[idxContractValue]),
      portfolioClass: asString(row[idxPortfolio]),
      finalizationNote,
      finalizationScore: parseScore(finalizationNote),
    });
    return accumulator;
  }, []);
}

function parseLostProjectsMatrix(matrix: Matrix): ExecutiveLostProjectRow[] {
  const headerIndex = matrix.findIndex((row) => hasCell(row, "Nome de Projeto") && hasCell(row, "Valor pago"));
  if (headerIndex === -1) {
    return [];
  }

  const rows: ExecutiveLostProjectRow[] = [];
  let currentImplanter = "";

  for (const row of matrix.slice(headerIndex + 1)) {
    const implanterCell = asString(row[1]);
    if (implanterCell) {
      currentImplanter = implanterCell;
    }

    const clientName = sanitizeClientName(asString(row[3]));
    const projectName = asString(row[5]);
    if (!clientName || !projectName) {
      continue;
    }

    rows.push({
      clientName,
      projectName,
      implanter: currentImplanter,
      projectTypeDetails: asString(row[6]),
      projectClosedAt: parseExcelDate(row[7]),
      accountClosedAt: parseExcelDate(row[8]),
      amountPaid: parseNumeric(row[9]),
      kickOffDate: parseExcelDate(row[10]),
      erpName: asString(row[11]),
      contractValue: parseNumeric(row[13]),
    });
  }

  return rows;
}

function parseCancellationProjectsMatrix(matrix: Matrix): ExecutiveCancellationProjectRow[] {
  const header = matrix[0]?.map(asString) ?? [];
  if (!header.includes("nome_oportunidade") || !header.includes("meses_de_vida")) {
    return [];
  }

  const indexOf = (label: string) => header.indexOf(label);

  return matrix.slice(1).reduce<ExecutiveCancellationProjectRow[]>((accumulator, row) => {
    const opportunityName = asString(row[indexOf("nome_oportunidade")]);
    const projectName = asString(row[indexOf("nome_projeto")]);
    if (!opportunityName || !projectName) {
      return accumulator;
    }

    accumulator.push({
      opportunityName,
      clientName: sanitizeCancellationClientName(opportunityName),
      projectName,
      erpName: asString(row[indexOf("nome_parceiro")]),
      segment: asString(row[indexOf("segmento")]),
      implanter: asString(row[indexOf("name")]),
      monthsOfLife: parseNumeric(row[indexOf("meses_de_vida")]),
      cancellationMrr: Math.abs(parseNumeric(row[indexOf("Valor_Final_c")])),
      phase: asString(row[indexOf("fase_c")]),
      projectType: asString(row[indexOf("tipo_de_projeto_c")]),
      closeDate: parseExcelDate(row[indexOf("closedate")]),
      newBusinessDate: parseExcelDate(row[indexOf("data_new_business")]),
    });
    return accumulator;
  }, []);
}

function parseNewProjectsMatrix(matrix: Matrix): ExecutiveNewProjectRow[] {
  const headerIndex = matrix.findIndex((row) => hasCell(row, "Nome de Projeto") && hasCell(row, "Data de criação"));
  if (headerIndex === -1) {
    return [];
  }

  const rows: ExecutiveNewProjectRow[] = [];
  let currentImplanter = "";

  for (const row of matrix.slice(headerIndex + 1)) {
    const implanterCell = asString(row[1]);
    if (implanterCell) {
      currentImplanter = implanterCell;
    }

    const clientName = sanitizeClientName(asString(row[3]));
    const projectName = asString(row[4]);
    if (!clientName || !projectName) {
      continue;
    }

    rows.push({
      clientName,
      projectName,
      implanter: currentImplanter,
      createdAt: parseExcelDate(row[9]),
      amountPaid: parseNumeric(row[8]),
      contractValue: parseNumeric(row[11]),
      portfolioClass: asString(row[10]),
    });
  }

  return rows;
}

function parseDelinquencyProjectsMatrix(matrix: Matrix): ExecutiveDelinquencyRow[] {
  const header = matrix[0]?.map(asString) ?? [];
  if (!header.includes("Possui Mensalidade Vencida") || !header.includes("Nome Cliente")) {
    return [];
  }

  const indexOf = (label: string) => header.indexOf(label);

  return matrix.slice(1).reduce<ExecutiveDelinquencyRow[]>((accumulator, row) => {
    const clientName = sanitizeClientName(asString(row[indexOf("Nome Cliente")]));
    if (!clientName) {
      return accumulator;
    }

    accumulator.push({
      createdAt: parseExcelDate(row[indexOf("Data Criacao Projeto Cs")]),
      implanter: asString(row[indexOf("Implantador Do Projeto C")]),
      phase: asString(row[indexOf("Fase Do Projeto")]),
      clientName,
      hasOverdueSubscription: parseBooleanCell(row[indexOf("Possui Mensalidade Vencida")]),
      integratedAppsLabel: asString(row[indexOf("Aplicativos Integrados")]),
      hasB2B: parseBooleanCell(row[indexOf("Tem B2B?")]),
      pendingUsers: parseNumeric(row[indexOf("Usuarios Com Cadastro Pendente")]),
      vendorUsers: parseNumeric(row[indexOf("Usuarios Vendedores")]),
      engagementLabel: asString(row[indexOf("Faixa Engajamento Vendedores Emitindo 5 Pedidos Ou Mais Ult 3 Meses")]),
      detailUrl: asString(row[indexOf("Detalhar Cliente")]),
    });
    return accumulator;
  }, []);
}

function parseQualitativeProjectsMatrix(matrix: Matrix): ExecutiveQualitativeRow[] {
  const headerIndex = matrix.findIndex(
    (row) => hasCell(row, "Cliente / tema") && hasCell(row, "Movimento forecast"),
  );
  if (headerIndex === -1) {
    return [];
  }

  const header = matrix[headerIndex].map(asString);
  const indexOf = (label: string) => header.indexOf(label);

  const idxWeek = indexOf("Semana");
  const idxDate = indexOf("Data da batida");
  const idxImplanter = indexOf("Implanter");
  const idxClient = indexOf("Cliente / tema");
  const idxType = indexOf("Tipo de registro");
  const idxCriticality = indexOf("Criticidade sugerida");
  const idxMovement = indexOf("Movimento forecast");
  const idxSummary = indexOf("Situação resumida");
  const idxNextStep = indexOf("Próximo passo");
  const idxResponsible = indexOf("Responsável");
  const idxDeadline = indexOf("Prazo");
  const idxObservation = indexOf("Observação");
  const idxMrr = indexOf("MRR impactado (preencher)");
  const idxActionStatus = indexOf("Status da ação");

  return matrix.slice(headerIndex + 1).reduce<ExecutiveQualitativeRow[]>((accumulator, row) => {
    const clientName = sanitizeClientName(asString(row[idxClient]));
    const forecastMovement = normalizeForecastMovement(asString(row[idxMovement]));
    if (!clientName || !forecastMovement) {
      return accumulator;
    }

    accumulator.push({
      weekLabel: asString(row[idxWeek]),
      meetingDate: parseExcelDate(row[idxDate]),
      implanter: asString(row[idxImplanter]),
      clientName,
      recordType: asString(row[idxType]),
      suggestedCriticality: asString(row[idxCriticality]),
      forecastMovement,
      summary: asString(row[idxSummary]),
      nextStep: asString(row[idxNextStep]),
      responsible: asString(row[idxResponsible]),
      deadline: asString(row[idxDeadline]),
      observation: asString(row[idxObservation]),
      impactedMrr: parseNullableNumeric(row[idxMrr]),
      actionStatus: asString(row[idxActionStatus]),
    });
    return accumulator;
  }, []);
}

function getExecutiveRowsCount(kind: keyof ExecutiveUploadsData, data: ExecutiveUploadsData): number {
  return data[kind].length;
}

function normalizeForecastMovement(value: string): ForecastMovement | null {
  const normalized = normalizeLabel(value);
  if (!normalized) return null;
  if (normalized.includes("risco de exit") || normalized.includes("risco de cancelamento")) {
    return "Projeto em risco";
  }
  if (normalized.includes("negociacao de cancelamento")) return "Em negociação de cancelamento";
  if (normalized.includes("risco de projeto")) return "Projeto em risco";
  if (normalized.includes("projeto travado")) return "Projeto em risco";
  if (normalized.includes("cancelado") || normalized === "cancelamento") return "Cancelado";
  if (normalized.includes("concluido como perdido") || normalized === "perdido") return "Concluído como perdido";
  if (normalized.includes("cancelamento revertido") || normalized === "revertido") return "Revertido";
  return null;
}

function mergeContractValuesIntoOpenProjects(
  openProjects: ExecutiveOpenProjectRow[],
  contractValueProjects: ExecutiveContractValueRow[],
): ExecutiveOpenProjectRow[] {
  const byProjectKey = new Map<string, number>();
  const byClient = new Map<string, ExecutiveContractValueRow[]>();

  contractValueProjects.forEach((row) => {
    byProjectKey.set(`${row.clientName}::${row.projectName}`, row.contractValue);
    const current = byClient.get(row.clientName) ?? [];
    current.push(row);
    byClient.set(row.clientName, current);
  });

  return openProjects.map((project) => {
    const projectMatch = byProjectKey.get(`${project.clientName}::${project.projectName}`);
    if (projectMatch !== undefined) {
      return { ...project, contractValue: projectMatch };
    }

    const clientMatches = byClient.get(project.clientName) ?? [];
    if (clientMatches.length === 1) {
      return { ...project, contractValue: clientMatches[0].contractValue };
    }

    return project;
  });
}

function parseExcelDate(value: string | number | boolean | Date | null | undefined): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  return parseFlexibleDate(asString(value));
}

function parseNumeric(value: string | number | boolean | Date | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const cleaned = asString(value).trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) {
    return 0;
  }

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastDot > lastComma ? cleaned.replace(/,/g, "") : cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastComma >= 0) {
    normalized = cleaned.replace(",", ".");
  }

  const result = Number.parseFloat(normalized);
  return Number.isFinite(result) ? result : 0;
}

function parseNullableNumeric(value: string | number | boolean | Date | null | undefined): number | null {
  if (value === null || value === undefined || asString(value) === "") {
    return null;
  }
  return parseNumeric(value);
}

function asString(value: string | number | boolean | Date | null | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value ?? "").trim();
}

function parseBooleanCell(value: string | number | boolean | Date | null | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = asString(value).toLowerCase();
  return normalized === "sim" || normalized === "true" || normalized === "1";
}

function parseScore(value: string): number | null {
  const cleaned = value.trim().replace(",", ".").replace(/[^\d.]/g, "");
  if (!cleaned) {
    return null;
  }
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasCell(row: Array<string | number | boolean | Date | null>, label: string): boolean {
  return row.some((cell) => asString(cell) === label);
}

function sanitizeClientName(value: string): string {
  return value.replace(/^\d+\s*-\s*/, "").trim();
}

function sanitizeCancellationClientName(value: string): string {
  return value
    .replace(/^\d+\s*-\s*/, "")
    .replace(/\(\s*INADIMPLENCIA\s*\)/gi, "")
    .replace(/\|\s*Cancelamento.*$/i, "")
    .replace(/-\s*Cancelamento.*$/i, "")
    .trim();
}

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
