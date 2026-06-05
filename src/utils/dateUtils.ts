const PHASE_SLA_DAYS: Record<string, number> = {
  setup: 7,
  implantacao: 14,
  "implantação": 14,
  acompanhamento: 21,
};

export function parseFlexibleDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    const normalizedDay = day.padStart(2, "0");
    const normalizedMonth = month.padStart(2, "0");
    const parsed = new Date(`${year}-${normalizedMonth}-${normalizedDay}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const native = new Date(trimmed);
  if (!Number.isNaN(native.getTime())) {
    return native;
  }

  return null;
}

export function diffDaysFromNow(date: Date | null): number {
  if (!date) {
    return 0;
  }

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function getPhaseSlaDays(phase: string): number | null {
  const key = normalizePhase(phase);
  return PHASE_SLA_DAYS[key] ?? null;
}

function normalizePhase(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\d+\s*-\s*/, "")
    .trim()
    .toLowerCase();
}
