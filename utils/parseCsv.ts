import type { ClienteProjeto, CsvRowRaw } from "../types/priorizacao";

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

export function parseCsv(content: string): ClienteProjeto[] {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const rows = parseDelimitedRows(normalized);

  if (rows.length < 2) {
    throw new CsvParseError("O CSV precisa conter cabeçalho e ao menos uma linha de dados.");
  }

  const headers = rows[0].map(normalizeHeader);
  validateHeaders(headers);

  const records: ClienteProjeto[] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const columns = rows[index];

    if (columns.every((value) => value.trim() === "")) {
      continue;
    }

    if (columns.length > headers.length) {
      throw new CsvParseError(
        `A linha ${index + 1} possui mais colunas do que o cabeçalho. Verifique delimitadores e aspas.`,
      );
    }

    const raw = headers.reduce((accumulator, header, columnIndex) => {
      accumulator[header] = (columns[columnIndex] ?? "").trim();
      return accumulator;
    }, {} as CsvRowRaw);

    if (!raw["Nome Cliente"].trim()) {
      throw new CsvParseError(`A linha ${index + 1} não possui "Nome Cliente".`);
    }

    records.push(mapRawRow(raw));
  }

  if (records.length === 0) {
    throw new CsvParseError("Nenhuma linha válida foi encontrada no arquivo enviado.");
  }

  return records;
}

function parseDelimitedRows(content: string): string[][] {
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

  return rows.filter((row) => row.length > 0);
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

function mapRawRow(raw: CsvRowRaw): ClienteProjeto {
  return {
    ...raw,
    createdAt: parseDate(raw["Data Criacao Projeto Cs"]),
    implanter: raw["Implantador Do Projeto C"].trim(),
    phase: raw["Fase Do Projeto"].trim(),
    clientName: raw["Nome Cliente"].trim(),
    hasOverdueSubscription: parseBoolean(raw["Possui Mensalidade Vencida"]),
    integratedApps: parseNumber(raw["Aplicativos Integrados"]),
    hasB2B: parseBoolean(raw["Tem B2B?"]),
    pendingUsers: parseNumber(raw["Usuarios Com Cadastro Pendente"]),
    vendorUsers: parseNumber(raw["Usuarios Vendedores"]),
    engagementOrdersLabel:
      raw["Faixa Engajamento Vendedores Emitindo 5 Pedidos Ou Mais Ult 3 Meses"].trim(),
    engagementOrdersQuotesLabel:
      raw[
        "Faixa Engajamento Vendedores Emitindo 5 Ou Mais Pedidos Ou Orcamentos Ult 3 Meses"
      ].trim(),
    detailUrl: raw["Detalhar Cliente"].trim(),
  };
}

function parseDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) {
    return date;
  }

  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseNumber(value: string): number {
  const sanitized = value.trim().replace(/\./g, "").replace(",", ".");
  const numeric = Number.parseFloat(sanitized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ["sim", "true", "yes", "y", "1"].includes(normalized);
}
