import * as XLSX from "xlsx";

import type {
  ExecutiveCancellationProjectRow,
  ExecutiveClosedProjectRow,
  ExecutiveContractValueRow,
  ExecutiveQualitativeRow,
  ExecutiveLostProjectRow,
  ExecutiveNewProjectRow,
  ExecutiveOpenProjectRow,
  ExecutiveSaasMovementRow,
  ExecutiveUploadsData,
  ExecutiveDelinquencyRow,
  ForecastMovement,
  SaasMovementKind,
  UploadIssue,
} from "../types";
import { parseFlexibleDate } from "./dateUtils";

type Matrix = Array<Array<string | number | boolean | Date | null>>;

const IMPLANTATION_RESPONSIBLE_MATCHES = [
  "maria",
  "aline andrade",
  "aline santos",
  "david",
  "caio",
  "jaqueline",
  "samara",
  "natiele",
  "natieli",
];

export async function parseExecutiveFiles(files: {
  openProjectsFile?: File | null;
  closedProjectsFile?: File | null;
  lostProjectsFile?: File | null;
  cancellationProjectsFile?: File | null;
  newProjectsFile?: File | null;
  delinquencyProjectsFile?: File | null;
  contractValueProjectsFile?: File | null;
  qualitativeProjectsFile?: File | null;
  saasCancellationFile?: File | null;
  saasExpansionFile?: File | null;
  saasContractionFile?: File | null;
  postConclusionClosedProjectsFile?: File | null;
  postConclusionSaasCancellationFile?: File | null;
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
    saasCancellation: [],
    saasExpansion: [],
    saasContraction: [],
    postConclusionClosedProjects: [],
    postConclusionSaasCancellation: [],
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
    ["saasCancellation", files.saasCancellationFile],
    ["saasExpansion", files.saasExpansionFile],
    ["saasContraction", files.saasContractionFile],
    ["postConclusionClosedProjects", files.postConclusionClosedProjectsFile],
    ["postConclusionSaasCancellation", files.postConclusionSaasCancellationFile],
  ];

  for (const [kind, file] of entries) {
    if (!file) {
      continue;
    }

    try {
      if (
        kind === "saasCancellation" ||
        kind === "saasExpansion" ||
        kind === "saasContraction" ||
        kind === "postConclusionSaasCancellation"
      ) {
        data[kind] = parseSaasMovementRows(
          await file.text(),
          kind === "saasCancellation" || kind === "postConclusionSaasCancellation"
            ? "cancelled"
            : kind === "saasExpansion"
              ? "expansion"
              : "contraction",
        );
        issues.push({
          fileName: file.name,
          message: `${getExecutiveRowsCount(kind, data)} registro(s) lido(s) para retenção SaaS.`,
          severity: "info",
        });
        continue;
      }
      if (kind === "cancellationProjects" && file.name.toLowerCase().endsWith(".csv")) {
        data.cancellationProjects = parseCancellationProjectsMatrix(parseCsvLikeMatrix(await file.text()));
        issues.push({
          fileName: file.name,
          message: `${getExecutiveRowsCount(kind, data)} registro(s) lido(s) para oportunidade de cancelamento.`,
          severity: "info",
        });
        continue;
      }

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
      } else if (kind === "postConclusionClosedProjects") {
        data.postConclusionClosedProjects = parseClosedProjectsMatrix(matrix);
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
  const idxDescription = header.findIndex((label) => normalizeLabel(label) === "descricao");
  const idxPortfolioClass = header.indexOf("Classificação da carteira");
  const idxProjectClassification = header.indexOf("Classificação do projeto");
  const idxAmountPaid = header.indexOf("Valor pago");
  const idxContractValue = header.indexOf("Valor Total do Contrato");
  const idxPlannedProjectDays = findHeaderIndex(header, [
    "Tempo previsto do projeto",
    "Tempo previsto de projeto",
  ]);
  const idxProjectDurationDays = findHeaderIndex(header, [
    "Tempo de duração do projeto (dias)",
    "Tempo de duracao do projeto (dias)",
    "Tempo de projeto",
  ]);

  const rows: ExecutiveOpenProjectRow[] = [];
  let currentImplanter = "";

  for (const row of matrix.slice(headerIndex + 1)) {
    const implanterCell = asString(row[idxImplanter]);
    if (implanterCell && implanterCell !== "Subtotal") {
      currentImplanter = implanterCell;
    }

    const projectName = asString(row[idxProject]);
    const rawClientName = asString(row[idxClient]);
    const clientName = sanitizeClientName(rawClientName);
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
      plannedProjectDays: parseNullableNumeric(row[idxPlannedProjectDays]),
      projectDurationDays: parseNullableNumeric(row[idxProjectDurationDays]),
      amountPaid: parseNumeric(row[idxAmountPaid]),
      contractValue: parseNumeric(row[idxContractValue]),
      riskFactor: asString(row[idxRiskFactor]),
      description: asString(row[idxDescription]),
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
    const rawClientName = asString(row[idxClient]);
    const clientName = sanitizeClientName(rawClientName);
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
  const idxPortfolioFixed = indexOf("Classificação da carteira");
  const idxNoteFixed = indexOf("Nota da finalização");
  const idxPortfolio = indexOf("Classificação da carteira");
  const idxNote = indexOf("Nota da finalização");

  return matrix.slice(headerIndex + 1).reduce<ExecutiveClosedProjectRow[]>((accumulator, row) => {
    const rawClientName = asString(row[idxClient]);
    const clientName = sanitizeClientName(rawClientName);
    const projectName = asString(row[idxProject]);
    if (!clientName || !projectName) {
      return accumulator;
    }

    const finalizationNote = asString(row[idxNoteFixed >= 0 ? idxNoteFixed : idxNote]);
    accumulator.push({
      accountCode: extractLeadingCode(rawClientName),
      clientName,
      projectName,
      closedAt: parseExcelDate(row[idxClosedAt]),
      implanter: asString(row[idxImplanter]),
      contractValue: parseNumeric(row[idxContractValue]),
      portfolioClass: asString(row[idxPortfolioFixed >= 0 ? idxPortfolioFixed : idxPortfolio]),
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
      cancellationMrr: Math.abs(parseBrazilianCurrency(row[indexOf("Valor_Final_c")])),
      phase: asString(row[indexOf("fase_c")]),
      projectType: asString(row[indexOf("tipo_de_projeto_c")]),
      description: [asString(row[indexOf("motivo_da_solicitacao")]), asString(row[indexOf("observacoes_sobre_a_conta")])]
        .filter(Boolean)
        .join(" | "),
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

  const indexOf = (label: string) => header.findIndex((item) => normalizeLabel(item) === normalizeLabel(label));

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
      engagementOrdersPercent: parseNullablePercentage(row[indexOf("Perc Vendedores Emitindo 5 Pedidos Ou Mais Ult 3 Meses")]),
      engagementOrdersQuotesPercent: parseNullablePercentage(row[indexOf("Perc Vendedores Emitindo 5 Ou Mais Pedidos Ou Orcamentos Ult 3 Meses")]),
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

function parseSaasMovementRows(content: string, kind: SaasMovementKind): ExecutiveSaasMovementRow[] {
  const matrix = parseCsvLikeMatrix(content);
  const header = matrix[0]?.map(asString) ?? [];
  const indexOf = (label: string) => header.findIndex((item) => normalizeLabel(item) === normalizeLabel(label));
  const valueColumn =
    kind === "cancelled"
      ? "Valor Cancelled"
      : kind === "expansion"
        ? "Valor Expansion"
        : "Valor Contraction";
  const idxReferenceMonth = indexOf("Mês de Referência");
  const idxContract = indexOf("Contrato");
  const idxCompanyCode = indexOf("Código da Empresa");
  const idxSegment = indexOf("Segmento Mercos");
  const idxSubscriptionModel = indexOf("Modelo de Assinatura");
  const idxAcquisitionChannel = indexOf("Canal de Aquisição");
  const idxBilledBy = indexOf("Faturado Por");
  const idxFirstRevenue = indexOf("1a Receita");
  const idxResponsibleCs = indexOf("Responsável CS");
  const idxSeller = indexOf("Vendedor");
  const idxValue = indexOf(valueColumn);
  const resolvedIdxReferenceMonth =
    idxReferenceMonth >= 0 ? idxReferenceMonth : indexOf("Mês de Referência");
  const resolvedIdxCompanyCode = idxCompanyCode >= 0 ? idxCompanyCode : indexOf("Código da Empresa");
  const resolvedIdxAcquisitionChannel =
    idxAcquisitionChannel >= 0 ? idxAcquisitionChannel : indexOf("Canal de Aquisição");
  const resolvedIdxResponsibleCs = idxResponsibleCs >= 0 ? idxResponsibleCs : indexOf("Responsável CS");

  return matrix.slice(1).reduce<ExecutiveSaasMovementRow[]>((accumulator, row) => {
    const acquisitionChannel = asString(row[resolvedIdxAcquisitionChannel]);
    if (normalizeLabel(acquisitionChannel) !== "inbound") {
      return accumulator;
    }

    const responsibleCs = asString(row[resolvedIdxResponsibleCs]);
    const referenceMonth = asString(row[resolvedIdxReferenceMonth]);
    const value = parseNumeric(row[idxValue]);
    if (!referenceMonth || value <= 0) {
      return accumulator;
    }

    accumulator.push({
      kind,
      referenceMonth,
      referenceDate: parseReferenceMonth(referenceMonth),
      contract: asString(row[idxContract]),
      companyCode: asString(row[resolvedIdxCompanyCode]),
      segment: asString(row[idxSegment]),
      subscriptionModel: asString(row[idxSubscriptionModel]),
      acquisitionChannel,
      billedBy: asString(row[idxBilledBy]),
      firstRevenueAt: parseExcelDate(row[idxFirstRevenue]),
      responsibleCs,
      seller: asString(row[idxSeller]),
      value,
      isImplantation: isImplantationResponsible(responsibleCs),
    });
    return accumulator;
  }, []);
}

function isImplantationResponsible(value: string): boolean {
  const normalized = normalizeLabel(value);
  return IMPLANTATION_RESPONSIBLE_MATCHES.some((name) => normalized.includes(name));
}

function parseCsvLikeMatrix(content: string): Matrix {
  const delimiter = detectDelimiter(content);
  const rows: Matrix = [];
  let currentRow: Array<string | null> = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      if (currentRow.some((cell) => asString(cell).length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => asString(cell).length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function detectDelimiter(content: string): string {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
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

function parseReferenceMonth(value: string): Date | null {
  const normalized = normalizeLabel(value);
  const match = normalized.match(/^([a-z.]+)\s+de\s+(\d{4})$/);
  if (!match) {
    return null;
  }

  const monthMap: Record<string, number> = {
    "jan.": 0,
    "fev.": 1,
    "mar.": 2,
    "abr.": 3,
    "mai.": 4,
    "jun.": 5,
    "jul.": 6,
    "ago.": 7,
    "set.": 8,
    "out.": 9,
    "nov.": 10,
    "dez.": 11,
  };
  const month = monthMap[match[1]];
  const year = Number.parseInt(match[2], 10);
  if (month === undefined || !Number.isFinite(year)) {
    return null;
  }
  return new Date(year, month, 1);
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

function parseBrazilianCurrency(value: string | number | boolean | Date | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const cleaned = asString(value).trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) {
    return 0;
  }

  const isNegative = cleaned.includes("-");
  const unsigned = cleaned.replace(/-/g, "");
  let normalized = unsigned;

  if (unsigned.includes(",")) {
    normalized = unsigned.replace(/\./g, "").replace(",", ".");
  } else {
    const dotParts = unsigned.split(".");
    if (dotParts.length > 1 && dotParts.every(Boolean) && dotParts.slice(1).every((part) => part.length === 3)) {
      normalized = dotParts.join("");
    }
  }

  const result = Number.parseFloat(normalized);
  if (!Number.isFinite(result)) {
    return 0;
  }
  return isNegative ? -result : result;
}

function parseNullableNumeric(value: string | number | boolean | Date | null | undefined): number | null {
  if (value === null || value === undefined || asString(value) === "") {
    return null;
  }
  return parseNumeric(value);
}

function parseNullablePercentage(value: string | number | boolean | Date | null | undefined): number | null {
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

function findHeaderIndex(header: string[], labels: string[]): number {
  const normalizedLabels = labels.map(normalizeLabel);
  return header.findIndex((item) => normalizedLabels.includes(normalizeLabel(item)));
}

function sanitizeClientName(value: string): string {
  return value.replace(/^\d+\s*-\s*/, "").trim();
}

function extractLeadingCode(value: string): string {
  return value.match(/^\s*(\d+)/)?.[1] ?? "";
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
