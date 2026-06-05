import type { RankedProject, WeeklyComparison, WeeklyMovement, WeeklySnapshot } from "../types";

const STORAGE_KEY = "dashboard-priorizacao-weekly-snapshots";

export function saveWeeklySnapshot(snapshot: WeeklySnapshot): WeeklySnapshot[] {
  const existing = loadWeeklySnapshots().filter((item) => item.weekLabel !== snapshot.weekLabel);
  const next = [snapshot, ...existing].sort((a, b) => b.weekLabel.localeCompare(a.weekLabel));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function loadWeeklySnapshots(): WeeklySnapshot[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as WeeklySnapshot[];
  } catch {
    return [];
  }
}

export function getCurrentWeekLabel(date: Date = new Date()): string {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

export function buildWeeklySnapshot(input: {
  weekLabel?: string;
  fileSummary: string[];
  projects: RankedProject[];
}): WeeklySnapshot {
  const weekLabel = input.weekLabel ?? getCurrentWeekLabel();

  return {
    id: `${weekLabel}-${Date.now()}`,
    weekLabel,
    createdAt: new Date().toISOString(),
    fileSummary: input.fileSummary,
    projects: input.projects,
  };
}

export function compareSnapshots(
  current: WeeklySnapshot | null,
  previous: WeeklySnapshot | null,
): WeeklyComparison | null {
  if (!current) {
    return null;
  }

  const currentMap = new Map(current.projects.map((project) => [normalizeClientKey(project.row.clientName), project]));
  const previousMap = new Map(
    (previous?.projects ?? []).map((project) => [normalizeClientKey(project.row.clientName), project]),
  );

  const enteredCritical: WeeklyMovement[] = [];
  const leftCritical: WeeklyMovement[] = [];
  const biggestIncrease: WeeklyMovement[] = [];
  const biggestDecrease: WeeklyMovement[] = [];
  const newProjects: WeeklyMovement[] = [];
  const removedProjects: WeeklyMovement[] = [];

  for (const [key, currentProject] of currentMap.entries()) {
    const previousProject = previousMap.get(key);

    if (!previousProject) {
      newProjects.push(toMovement(currentProject, null));
      continue;
    }

    const movement = toMovement(currentProject, previousProject);
    if (movement.currentPriority === "Crítica" && movement.previousPriority !== "Crítica") {
      enteredCritical.push(movement);
    }
    if (movement.currentPriority !== "Crítica" && movement.previousPriority === "Crítica") {
      leftCritical.push(movement);
    }
    if (movement.delta > 0) {
      biggestIncrease.push(movement);
    }
    if (movement.delta < 0) {
      biggestDecrease.push(movement);
    }
  }

  for (const [key, previousProject] of previousMap.entries()) {
    if (!currentMap.has(key)) {
      removedProjects.push(toMovement(null, previousProject));
    }
  }

  biggestIncrease.sort((a, b) => b.delta - a.delta);
  biggestDecrease.sort((a, b) => a.delta - b.delta);

  const summary = buildSummary(current, previous, enteredCritical.length, leftCritical.length);

  return {
    currentWeekLabel: current.weekLabel,
    previousWeekLabel: previous?.weekLabel ?? null,
    currentTotal: current.projects.length,
    previousTotal: previous?.projects.length ?? 0,
    enteredCritical: enteredCritical.slice(0, 5),
    leftCritical: leftCritical.slice(0, 5),
    biggestIncrease: biggestIncrease.slice(0, 5),
    biggestDecrease: biggestDecrease.slice(0, 5),
    newProjects: newProjects.slice(0, 5),
    removedProjects: removedProjects.slice(0, 5),
    summary,
  };
}

function toMovement(
  currentProject: RankedProject | null,
  previousProject: RankedProject | null,
): WeeklyMovement {
  const currentRisk = currentProject?.risk ?? 0;
  const previousRisk = previousProject?.risk ?? 0;

  return {
    clientName: currentProject?.row.clientName ?? previousProject?.row.clientName ?? "Cliente sem nome",
    implanter: currentProject?.row.implanter ?? previousProject?.row.implanter ?? "Sem implantador",
    currentRisk,
    previousRisk,
    delta: currentRisk - previousRisk,
    currentPriority: currentProject?.priority ?? "Baixa",
    previousPriority: previousProject?.priority ?? "Baixa",
  };
}

function buildSummary(
  current: WeeklySnapshot,
  previous: WeeklySnapshot | null,
  enteredCriticalCount: number,
  leftCriticalCount: number,
): string[] {
  if (!previous) {
    return [
      `Semana ${current.weekLabel} registrada como baseline inicial do histórico.`,
      "Faça o upload novamente na próxima semana para habilitar comparações automáticas.",
    ];
  }

  const currentCritical = current.projects.filter((project) => project.priority === "Crítica").length;
  const previousCritical = previous.projects.filter((project) => project.priority === "Crítica").length;
  const currentAverage = averageRisk(current.projects);
  const previousAverage = averageRisk(previous.projects);

  return [
    `Críticos: ${currentCritical} nesta semana vs ${previousCritical} na semana passada.`,
    `Risco médio: ${currentAverage} nesta semana vs ${previousAverage} na semana passada.`,
    `${enteredCriticalCount} contas entraram em crítico e ${leftCriticalCount} saíram de crítico.`,
  ];
}

function averageRisk(projects: RankedProject[]): number {
  if (projects.length === 0) {
    return 0;
  }
  return Math.round(projects.reduce((sum, project) => sum + project.risk, 0) / projects.length);
}

function normalizeClientKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
