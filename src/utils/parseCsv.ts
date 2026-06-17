import type { CsvParseResult, CsvRowRaw, ProjectRow } from "../types";
import { parseFlexibleDate } from "./dateUtils";
import * as XLSX from "xlsx";

const REQUIRED_HEADERS: Array<keyof CsvRowRaw> = [
  "Data Criacao Projeto Cs",
  "Implantador Do Projeto C",
  "Fase Do Projeto",
  "Nome Cliente",
  "Possui Mensalidade Vencida",
  "Aplicativos Integrados",
  "Tem B2B?",
  "Usuarios Com Cadastro Pendente",
  "Usuarios Vendedores",
  "Faixa Engajamento Vendedores Emitindo 5 Pedidos Ou Mais Ult 3 Meses",
  "Faixa Engajamento Vendedores Emitindo 5 Ou Mais Pedidos Ou Orcamentos Ult 3 Meses",
  "Detalhar Cliente",
];

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

export async function parseUploadFiles(files: File[]): Promise<{
  rows: ProjectRow[];
  issues: Array<{ fileName: string; message: string; severity: "warning" | "error" | "info" }>;
}> {
  const csvRows: ProjectRow[] = [];
  const workbookRows: ProjectRow[] = [];
  const overdueActivities: Array<{
    clientName: string;
    subject: string;
    dueDate: Date | null;
  }> = [];
  const issues: Array<{ fileName: string; message: string; severity: "warning" | "error" | "info" }> = [];

  for (const file of files) {
    const lowerName = file.name.toLowerCase();

    try {
      if (lowerName.endsWith(".csv")) {
        const content = await file.text();
        const parsed = parseCsv(content);
        csvRows.push(...parsed.rows);
        issues.push({
          fileName: file.name,
          message: `${parsed.rows.length} registros importados do CSV.`,
          severity: "info",
        });
        continue;
      }

      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
        const workbookResult = await parseWorkbookFile(file);
        workbookRows.push(...workbookResult.rows);
        overdueActivities.push(...workbookResult.overdueActivities);
        issues.push(...workbookResult.issues);
        continue;
      }

      issues.push({
        fileName: file.name,
        message: "Formato não suportado. Envie CSV, XLSX ou XLS.",
        severity: "error",
      });
    } catch (error) {
      issues.push({
        fileName: file.name,
        message: error instanceof Error ? error.message : "Falha ao processar o arquivo.",
        severity: "error",
      });
    }
  }

  const mergedRows = enrichWithOverdueActivities(
    mergeProjectRows(csvRows, workbookRows),
    overdueActivities,
  );
  return { rows: mergedRows, issues };
}

export function parseCsv(content: string): CsvParseResult {
  const normalizedContent = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const matrix = parseRows(normalizedContent);

  if (matrix.length < 2) {
    throw new CsvParseError("O CSV precisa conter cabeçalho e ao menos uma linha de dados.");
  }

  const headers = matrix[0].map(normalizeHeader);
  validateHeaders(headers);

  const rows: ProjectRow[] = matrix.slice(1).reduce<ProjectRow[]>((accumulator, columns, index) => {
    if (columns.every((column) => column.trim() === "")) {
      return accumulator;
    }

    if (columns.length > headers.length) {
      throw new CsvParseError(
        `A linha ${index + 2} possui mais colunas do que o cabeçalho. Verifique vírgulas e aspas.`,
      );
    }

    const rawRow = headers.reduce((record, header, columnIndex) => {
      record[header] = (columns[columnIndex] ?? "").trim();
      return record;
    }, {} as CsvRowRaw);

    if (!rawRow["Nome Cliente"].trim()) {
      throw new CsvParseError(`A linha ${index + 2} não possui "Nome Cliente".`);
    }

    accumulator.push(
      mapRawRow(
        rawRow,
        findColumnValue(headers, columns, "Perc Vendedores Emitindo 5 Pedidos Ou Mais Ult 3 Meses"),
        findColumnValue(
          headers,
          columns,
          "Perc Vendedores Emitindo 5 Ou Mais Pedidos Ou Orcamentos Ult 3 Meses",
        ),
      ),
    );
    return accumulator;
  }, []);

  if (rows.length === 0) {
    throw new CsvParseError("Nenhuma linha válida foi encontrada no arquivo enviado.");
  }

  return { rows, headers };
}

async function parseWorkbookFile(file: File): Promise<{
  rows: ProjectRow[];
  overdueActivities: Array<{ clientName: string; subject: string; dueDate: Date | null }>;
  issues: Array<{ fileName: string; message: string; severity: "warning" | "error" | "info" }>;
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const rows: ProjectRow[] = [];
  const overdueActivities: Array<{ clientName: string; subject: string; dueDate: Date | null }> = [];
  let importedSheets = 0;
  let importedActivitySheets = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    const openProjectsRows = parseOpenProjectsWorkbook(matrix);
    if (openProjectsRows.length > 0) {
      rows.push(...openProjectsRows);
      importedSheets += 1;
      continue;
    }

    const overdueActivityRows = parseOverdueActivitiesWorkbook(matrix);
    if (overdueActivityRows.length > 0) {
      overdueActivities.push(...overdueActivityRows);
      importedActivitySheets += 1;
      continue;
    }

    const prepared = extractHeaderAlignedMatrix(matrix);
    if (!prepared) {
      continue;
    }

    const csvLikeContent = prepared
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const parsed = parseCsv(csvLikeContent);
    rows.push(...parsed.rows);
    importedSheets += 1;
  }

  if (rows.length === 0) {
    if (overdueActivities.length > 0) {
      return {
        rows: [],
        overdueActivities,
        issues: [
          {
            fileName: file.name,
            message: `${overdueActivities.length} atividades em atraso importadas de ${importedActivitySheets} aba(s).`,
            severity: "info",
          },
        ],
      };
    }

    return {
      rows: [],
      overdueActivities: [],
      issues: [
        {
          fileName: file.name,
          message:
            "Workbook recebido, mas nenhuma aba contém colunas compatíveis com os modelos suportados do dashboard.",
          severity: "warning",
        },
      ],
    };
  }

  return {
    rows,
    overdueActivities,
    issues: [
      {
        fileName: file.name,
        message: `${rows.length} registros importados de ${importedSheets} aba(s) compatíveis.`,
        severity: "info",
      },
      ...(overdueActivities.length > 0
        ? [
            {
              fileName: file.name,
              message: `${overdueActivities.length} atividades em atraso importadas de ${importedActivitySheets} aba(s).`,
              severity: "info" as const,
            },
          ]
        : []),
    ],
  };
}

function parseOverdueActivitiesWorkbook(
  matrix: Array<Array<string | number | boolean | null>>,
): Array<{ clientName: string; subject: string; dueDate: Date | null }> {
  const headerRowIndex = matrix.findIndex((row) =>
    row.some((cell) => String(cell ?? "").includes("Nome da conta")) &&
    row.some((cell) => String(cell ?? "").includes("Assunto")) &&
    row.some((cell) => String(cell ?? "").includes("Data")),
  );

  if (headerRowIndex === -1) {
    return [];
  }

  const header = matrix[headerRowIndex].map((cell) => String(cell ?? "").trim());
  const getIndex = (label: string) =>
    header.findIndex((value) => value.toLowerCase().includes(label.toLowerCase()));

  const idxClient = getIndex("Nome da conta");
  const idxSubject = getIndex("Assunto");
  const idxDate = getIndex("Data");

  if (idxClient === -1 || idxDate === -1) {
    return [];
  }

  return matrix.slice(headerRowIndex + 1).reduce<Array<{ clientName: string; subject: string; dueDate: Date | null }>>(
    (accumulator, row) => {
      const clientName = String(row[idxClient] ?? "").trim();
      if (!clientName) {
        return accumulator;
      }

      accumulator.push({
        clientName: sanitizeClientName(clientName),
        subject: String(row[idxSubject] ?? "").trim(),
        dueDate: parseFlexibleDate(String(row[idxDate] ?? "").trim()),
      });
      return accumulator;
    },
    [],
  );
}

function parseOpenProjectsWorkbook(
  matrix: Array<Array<string | number | boolean | null>>,
): ProjectRow[] {
  const headerRowIndex = matrix.findIndex((row) =>
    row.some((cell) => String(cell ?? "").includes("Nome da Conta: Nome da conta")),
  );

  if (headerRowIndex === -1) {
    return [];
  }

  const header = matrix[headerRowIndex].map((cell) => String(cell ?? "").trim());
  const getIndex = (label: string) => header.indexOf(label);

  const idxImplanter = getIndex("Implantador do projeto: Nome completo  ↑");
  const idxPhase = getIndex("Fase  ↑");
  const idxClient = getIndex("Nome da Conta: Nome da conta");
  const idxKickoff = getIndex("Data do Kick-off");
  const idxDue = getIndex("Data prevista de entrega");
  const idxStatus = getIndex("Status do projeto");
  const idxType = getIndex("Tipo de projeto");
  const idxTypeDetails = getIndex("Detalhes do tipo de projeto");
  const idxAmount = getIndex("Valor pago");
  const idxRisk = getIndex("Fator de risco");
  const idxRiskB2B = getIndex("Fator de Risco do Projeto E-commerce B2B");
  const idxPlannedProjectDays = findHeaderIndex(header, [
    "Tempo previsto do projeto",
    "Tempo previsto de projeto",
  ]);
  const idxProjectDurationDays = findHeaderIndex(header, [
    "Tempo de duração do projeto (dias)",
    "Tempo de duracao do projeto (dias)",
    "Tempo de projeto",
  ]);
  const idxLastActivity = getIndex("Data da última atividade");

  if (idxPhase === -1 || idxClient === -1) {
    return [];
  }

  const rows: ProjectRow[] = [];
  let currentImplanter = "";

  for (const sourceRow of matrix.slice(headerRowIndex + 1)) {
    const phase = String(sourceRow[idxPhase] ?? "").trim();
    const clientName = sanitizeClientName(String(sourceRow[idxClient] ?? "").trim());
    const rawImplanter = idxImplanter >= 0 ? String(sourceRow[idxImplanter] ?? "").trim() : "";

    if (rawImplanter) {
      currentImplanter = rawImplanter;
    }

    if (!clientName || phase === "Subtotal" || phase === "") {
      continue;
    }

    const kickOffDate = idxKickoff >= 0 ? parseFlexibleDate(String(sourceRow[idxKickoff] ?? "")) : null;
    const plannedDeliveryDate = idxDue >= 0 ? parseFlexibleDate(String(sourceRow[idxDue] ?? "")) : null;
    const projectType = idxType >= 0 ? String(sourceRow[idxType] ?? "").trim() : "";
    const projectTypeDetails = idxTypeDetails >= 0 ? String(sourceRow[idxTypeDetails] ?? "").trim() : "";
    const amountPaid = idxAmount >= 0 ? parseNumber(String(sourceRow[idxAmount] ?? "")) : 0;
    const workbookRiskLabel = idxRisk >= 0 ? String(sourceRow[idxRisk] ?? "").trim() : "";
    const workbookRiskB2BLabel = idxRiskB2B >= 0 ? String(sourceRow[idxRiskB2B] ?? "").trim() : "";
    const lastActivityLabel = idxLastActivity >= 0 ? String(sourceRow[idxLastActivity] ?? "").trim() : "";
    const lastActivityAt = lastActivityLabel ? parseFlexibleDate(lastActivityLabel) : null;
    const plannedProjectDays =
      idxPlannedProjectDays >= 0 ? parseNullableNumber(String(sourceRow[idxPlannedProjectDays] ?? "")) : null;
    const projectDurationDays =
      idxProjectDurationDays >= 0 ? parseNullableNumber(String(sourceRow[idxProjectDurationDays] ?? "")) : null;

    rows.push({
      "Data Criacao Projeto Cs": kickOffDate ? formatDateForStorage(kickOffDate) : "",
      "Implantador Do Projeto C": currentImplanter,
      "Fase Do Projeto": phase,
      "Nome Cliente": clientName,
      "Possui Mensalidade Vencida": "Não",
      "Aplicativos Integrados": projectTypeDetails || projectType,
      "Tem B2B?": projectType.toLowerCase() === "b2b" || phase.toLowerCase().includes("b2b") ? "true" : "false",
      "Usuarios Com Cadastro Pendente": "0",
      "Usuarios Vendedores": "0",
      "Faixa Engajamento Vendedores Emitindo 5 Pedidos Ou Mais Ult 3 Meses": "",
      "Faixa Engajamento Vendedores Emitindo 5 Ou Mais Pedidos Ou Orcamentos Ult 3 Meses": "",
      "Detalhar Cliente": "",
      createdAt: kickOffDate,
      implanter: currentImplanter,
      phase,
      clientName,
      hasOverdueSubscription: false,
      integratedAppsLabel: projectTypeDetails || projectType,
      integratedAppsCount: inferIntegrationCount(projectTypeDetails || projectType),
      hasB2B: projectType.toLowerCase() === "b2b" || phase.toLowerCase().includes("b2b"),
      pendingUsers: 0,
      vendorUsers: 0,
      engagementOrdersLabel: "",
      engagementOrdersQuotesLabel: "",
      engagementOrdersPercent: "",
      engagementOrdersQuotesPercent: "",
      detailUrl: "",
      kickOffDate,
      plannedDeliveryDate,
      lastActivityAt,
      lastActivityLabel,
      amountPaid,
      workbookRiskLabel,
      workbookRiskB2BLabel,
      projectType,
      projectTypeDetails,
      projectStatus: idxStatus >= 0 ? String(sourceRow[idxStatus] ?? "").trim() : "",
      plannedProjectDays,
      projectDurationDays,
      deliveryTargetDays: plannedProjectDays ?? inferDeliveryTargetDays(projectTypeDetails),
      dataSources: ["xlsx"],
    });
  }

  return rows;
}

function parseRows(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      continue;
    }

    currentField += char;
  }

  if (inQuotes) {
    throw new CsvParseError("O CSV contém aspas não fechadas.");
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

function extractHeaderAlignedMatrix(
  matrix: Array<Array<string | number | boolean | null>>,
): string[][] | null {
  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    const candidateHeaders = matrix[rowIndex].map((cell) => normalizeHeader(String(cell ?? "")));
    const hasRequiredHeaders = REQUIRED_HEADERS.every((header) => candidateHeaders.includes(header));

    if (!hasRequiredHeaders) {
      continue;
    }

    return matrix.slice(rowIndex).map((row) => row.map((cell) => String(cell ?? "")));
  }

  return null;
}

function validateHeaders(headers: string[]): asserts headers is Array<keyof CsvRowRaw> {
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new CsvParseError(`Colunas obrigatórias ausentes: ${missing.join(", ")}.`);
  }
}

function normalizeHeader(value: string): keyof CsvRowRaw {
  return value.trim().replace(/\s+/g, " ") as keyof CsvRowRaw;
}

function mapRawRow(
  raw: CsvRowRaw,
  engagementOrdersPercent = "",
  engagementOrdersQuotesPercent = "",
): ProjectRow {
  const integratedAppsLabel = raw["Aplicativos Integrados"].trim();

  return {
    ...raw,
    createdAt: parseFlexibleDate(raw["Data Criacao Projeto Cs"]),
    implanter: raw["Implantador Do Projeto C"].trim(),
    phase: raw["Fase Do Projeto"].trim(),
    clientName: sanitizeClientName(raw["Nome Cliente"].trim()),
    hasOverdueSubscription: parseBoolean(raw["Possui Mensalidade Vencida"]),
    integratedAppsLabel,
    integratedAppsCount: inferIntegrationCount(integratedAppsLabel),
    hasB2B: parseBoolean(raw["Tem B2B?"]),
    pendingUsers: parseNumber(raw["Usuarios Com Cadastro Pendente"]),
    vendorUsers: parseNumber(raw["Usuarios Vendedores"]),
    engagementOrdersLabel:
      raw["Faixa Engajamento Vendedores Emitindo 5 Pedidos Ou Mais Ult 3 Meses"].trim(),
    engagementOrdersQuotesLabel:
      raw[
        "Faixa Engajamento Vendedores Emitindo 5 Ou Mais Pedidos Ou Orcamentos Ult 3 Meses"
      ].trim(),
    engagementOrdersPercent,
    engagementOrdersQuotesPercent,
    detailUrl: raw["Detalhar Cliente"].trim(),
    kickOffDate: null,
    plannedDeliveryDate: null,
    lastActivityAt: null,
    lastActivityLabel: "",
    amountPaid: null,
    workbookRiskLabel: "",
    workbookRiskB2BLabel: "",
    projectType: "",
    projectTypeDetails: "",
    projectStatus: "",
    plannedProjectDays: parseFirstNullableNumber([
      raw["Tempo previsto do projeto"],
      raw["Tempo previsto de projeto"],
    ]),
    projectDurationDays: parseFirstNullableNumber([
      raw["Tempo de duração do projeto (dias)"],
      raw["Tempo de projeto"],
    ]),
    deliveryTargetDays:
      parseFirstNullableNumber([
        raw["Tempo previsto do projeto"],
        raw["Tempo previsto de projeto"],
      ]) ?? null,
    dataSources: ["csv"],
    overdueActivitiesCount: 0,
    overdueActivitiesOldestDate: null,
    overdueActivitiesSubjects: [],
  };
}

function mergeProjectRows(primaryRows: ProjectRow[], secondaryRows: ProjectRow[]): ProjectRow[] {
  const merged = new Map<string, ProjectRow>();

  for (const row of primaryRows) {
    merged.set(normalizeClientKey(row.clientName), row);
  }

  for (const row of secondaryRows) {
    const key = normalizeClientKey(row.clientName);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, row);
      continue;
    }

    merged.set(key, {
      ...existing,
      kickOffDate: row.kickOffDate ?? existing.kickOffDate ?? null,
      plannedDeliveryDate: row.plannedDeliveryDate ?? existing.plannedDeliveryDate ?? null,
      lastActivityAt: row.lastActivityAt ?? existing.lastActivityAt ?? null,
      lastActivityLabel: row.lastActivityLabel || existing.lastActivityLabel || "",
      amountPaid: row.amountPaid ?? existing.amountPaid ?? null,
      workbookRiskLabel: row.workbookRiskLabel || existing.workbookRiskLabel || "",
      workbookRiskB2BLabel: row.workbookRiskB2BLabel || existing.workbookRiskB2BLabel || "",
      projectType: row.projectType || existing.projectType || "",
      projectTypeDetails: row.projectTypeDetails || existing.projectTypeDetails || "",
      projectStatus: row.projectStatus || existing.projectStatus || "",
      plannedProjectDays: row.plannedProjectDays ?? existing.plannedProjectDays ?? null,
      projectDurationDays: row.projectDurationDays ?? existing.projectDurationDays ?? null,
      deliveryTargetDays: row.deliveryTargetDays ?? existing.deliveryTargetDays ?? null,
      engagementOrdersPercent: existing.engagementOrdersPercent || row.engagementOrdersPercent || "",
      engagementOrdersQuotesPercent:
        existing.engagementOrdersQuotesPercent || row.engagementOrdersQuotesPercent || "",
      dataSources: Array.from(new Set([...(existing.dataSources ?? []), ...(row.dataSources ?? [])])),
      overdueActivitiesCount: existing.overdueActivitiesCount ?? row.overdueActivitiesCount ?? 0,
      overdueActivitiesOldestDate:
        existing.overdueActivitiesOldestDate ?? row.overdueActivitiesOldestDate ?? null,
      overdueActivitiesSubjects:
        existing.overdueActivitiesSubjects ?? row.overdueActivitiesSubjects ?? [],
    });
  }

  return Array.from(merged.values());
}

function enrichWithOverdueActivities(
  rows: ProjectRow[],
  activities: Array<{ clientName: string; subject: string; dueDate: Date | null }>,
): ProjectRow[] {
  if (activities.length === 0) {
    return rows;
  }

  const activityMap = activities.reduce<Map<string, Array<{ subject: string; dueDate: Date | null }>>>(
    (accumulator, activity) => {
      const key = normalizeClientKey(activity.clientName);
      const current = accumulator.get(key) ?? [];
      current.push({ subject: activity.subject, dueDate: activity.dueDate });
      accumulator.set(key, current);
      return accumulator;
    },
    new Map(),
  );

  return rows.map((row) => {
    const relatedActivities = activityMap.get(normalizeClientKey(row.clientName)) ?? [];
    if (relatedActivities.length === 0) {
      return row;
    }

    const oldestDate = relatedActivities
      .map((activity) => activity.dueDate)
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

    return {
      ...row,
      overdueActivitiesCount: relatedActivities.length,
      overdueActivitiesOldestDate: oldestDate,
      overdueActivitiesSubjects: Array.from(
        new Set(relatedActivities.map((activity) => activity.subject).filter(Boolean)),
      ),
      dataSources: Array.from(new Set([...(row.dataSources ?? []), "follows-overdue"])),
    };
  });
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ["sim", "true", "1", "yes", "y"].includes(normalized);
}

function parseNumber(value: string): number {
  const cleaned = value.trim().replace(/[^\d,.-]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized = cleaned;

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastDot > lastComma) {
      normalized = cleaned.replace(/,/g, "");
    } else {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    }
  } else if (lastComma >= 0) {
    normalized = cleaned.replace(",", ".");
  }

  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseNullableNumber(value: string | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }
  const parsed = parseNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFirstNullableNumber(values: Array<string | undefined>): number | null {
  for (const value of values) {
    const parsed = parseNullableNumber(value);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function findHeaderIndex(header: string[], labels: string[]): number {
  const normalizedLabels = labels.map(normalizeLooseLabel);
  return header.findIndex((item) => normalizedLabels.includes(normalizeLooseLabel(item)));
}

function normalizeLooseLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function inferIntegrationCount(value: string): number {
  const normalized = value.trim();
  if (!normalized) {
    return 0;
  }

  const explicitNumber = parseNumber(normalized);
  if (explicitNumber > 0) {
    return explicitNumber;
  }

  return normalized
    .split(/[;|,/]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function inferDeliveryTargetDays(details: string): number | null {
  const normalized = details.trim().toLowerCase();

  if (normalized.includes("90 dias") || normalized.includes("mid")) {
    return 90;
  }

  if (normalized.includes("60 dias") || normalized.includes("smb")) {
    return 60;
  }

  if (normalized.includes("45 dias")) {
    return 45;
  }

  if (normalized.includes("30 dias")) {
    return 30;
  }

  return null;
}

function normalizeClientKey(value: string): string {
  return sanitizeClientName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function sanitizeClientName(value: string): string {
  return value
    .replace(/^\s*\d+\s*-\s*/, "")
    .replace(/\t+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateForStorage(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function findColumnValue(headers: string[], columns: string[], headerName: string): string {
  const index = headers.findIndex((header) => header === headerName);
  return index >= 0 ? String(columns[index] ?? "").trim() : "";
}
