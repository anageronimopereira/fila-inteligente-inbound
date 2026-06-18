import { CSSProperties, useMemo, useState } from "react";

import type { RankedProject } from "../types";
import { diffDaysFromNow } from "../utils/dateUtils";
import { describeStoppedProject, hasCriticalProjectStatus, hasStoppedProjectStatus, isStoppedProject } from "../utils/riskScore";

type Quadrant = RankedProject["quadrantEvaluation"]["quadrant"];

export function ClientList({ items }: { items: RankedProject[] }): JSX.Element {
  const [meetingMode, setMeetingMode] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const quadrantSummary = useMemo(
    () => [
      { label: "CRÍTICO" as Quadrant, count: items.filter((item) => item.quadrantEvaluation.quadrant === "CRÍTICO").length },
      { label: "ACELERA" as Quadrant, count: items.filter((item) => item.quadrantEvaluation.quadrant === "ACELERA").length },
      { label: "ATENÇÃO" as Quadrant, count: items.filter((item) => item.quadrantEvaluation.quadrant === "ATENÇÃO").length },
      { label: "ROTINA" as Quadrant, count: items.filter((item) => item.quadrantEvaluation.quadrant === "ROTINA").length },
    ],
    [items],
  );

  const weeklyFocus = useMemo(() => buildWeeklyFocus(items), [items]);
  const alerts = useMemo(() => buildAlerts(items), [items]);
  const effortDistribution = useMemo(() => buildEffortDistribution(items), [items]);
  const topProjects = useMemo(() => items.slice(0, 5), [items]);
  const totalMrr = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(item.row.amountPaid ?? 0, 0), 0),
    [items],
  );
  const stoppedProjects = useMemo(
    () =>
      items
        .filter((item) => isStoppedProject(item.row))
        .sort((a, b) => (b.row.amountPaid ?? 0) - (a.row.amountPaid ?? 0) || b.risk - a.risk)
        .slice(0, 5),
    [items],
  );
  const stoppedMrr = useMemo(
    () => stoppedProjects.reduce((sum, item) => sum + Math.max(item.row.amountPaid ?? 0, 0), 0),
    [stoppedProjects],
  );
  const groupedItems = useMemo(
    () => [
      { title: "CRÍTICOS", quadrant: "CRÍTICO" as Quadrant, items: visibleByQuadrant(items, "CRÍTICO", meetingMode) },
      { title: "ACELERA", quadrant: "ACELERA" as Quadrant, items: visibleByQuadrant(items, "ACELERA", meetingMode) },
      { title: "ATENÇÃO", quadrant: "ATENÇÃO" as Quadrant, items: visibleByQuadrant(items, "ATENÇÃO", meetingMode) },
      { title: "ROTINA", quadrant: "ROTINA" as Quadrant, items: visibleByQuadrant(items, "ROTINA", meetingMode) },
    ],
    [items, meetingMode],
  );
  function toggleExpanded(key: string) {
    setExpandedKeys((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div style={styles.page}>
      <section style={styles.planCard}>
        <div style={styles.planHeader}>
          <div>
            <span style={styles.eyebrow}>Plano da semana</span>
            <h2 style={styles.sectionTitle}>O que merece foco agora</h2>
          </div>
          <button
            type="button"
            onClick={() => setMeetingMode((current) => !current)}
            style={meetingMode ? { ...styles.modeButton, ...styles.modeButtonActive } : styles.modeButton}
          >
            {meetingMode ? "Modo reunião ativo" : "Ativar modo reunião"}
          </button>
        </div>

        <div style={styles.planLines}>
          <div style={styles.planLine}><strong>Focos:</strong> {weeklyFocus.mainFocus}</div>
          <div style={styles.planLine}><strong>Prioridades:</strong> {quadrantSummary.map((item) => `${item.label} ${item.count}`).join(" • ")}</div>
          <div style={styles.planLine}><strong>MRR total:</strong> {formatCurrencyBRL(totalMrr)} • <strong>MRR parado:</strong> {formatCurrencyBRL(stoppedMrr)}</div>
          <div style={styles.planLine}><strong>Esforço sugerido:</strong> {effortDistribution}</div>
          <div style={styles.planLine}><strong>Onde agir primeiro:</strong> {weeklyFocus.firstAction}</div>
          <div style={styles.planLine}><strong>Disciplina da semana:</strong> {weeklyFocus.coaching}</div>
        </div>
      </section>

      <section style={styles.actionSection}>
        <div style={styles.sectionHeader}>
          <div>
            <span style={styles.eyebrow}>Onde agir agora</span>
            <h2 style={styles.sectionTitle}>Top 5 prioridades da carteira</h2>
          </div>
        </div>

        <div style={styles.topList}>
          {topProjects.map((item, index) => {
            const tone = getQuadrantTone(item.quadrantEvaluation.quadrant);
            return (
              <article key={`${item.row.clientName}-${index}`} style={styles.topCard}>
                <div style={styles.topCardHeader}>
                  <strong style={styles.topClient}>{item.row.clientName}</strong>
                  <span style={{ ...styles.microBadge, background: tone.bg, color: tone.fg, borderColor: tone.border }}>
                    {item.quadrantEvaluation.quadrant}
                  </span>
                </div>
                <p style={styles.topMeta}>MRR {formatCurrencyBRL(item.row.amountPaid ?? 0)}</p>
                <p style={styles.topReason}>{item.quadrantEvaluation.why}</p>
                <p style={styles.topAction}><strong>Ação:</strong> {item.recommendation}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section style={styles.panelCard}>
        <div style={styles.sectionHeader}>
          <div>
            <span style={styles.eyebrow}>Alertas automáticos</span>
            <h2 style={styles.sectionTitle}>Sinais acionáveis</h2>
          </div>
        </div>

        <div style={styles.alertList}>
          {alerts.map((alert) => (
            <div key={alert} style={styles.alertItem}>
              {alert}
            </div>
          ))}
        </div>
      </section>

      {stoppedProjects.length > 0 ? (
        <section style={styles.panelCard}>
          <div style={styles.sectionHeader}>
            <div>
              <span style={styles.eyebrow}>Insights de priorização</span>
              <h2 style={styles.sectionTitle}>Clientes parados e por que estão parados</h2>
            </div>
            <span style={styles.helperText}>
              {formatCurrencyBRL(stoppedMrr)} em contas sem avanço recente ou com pendências abertas.
            </span>
          </div>

          <div style={styles.stoppedList}>
            {stoppedProjects.map((item) => (
              <article key={`${item.row.clientName}-${item.row.implanter}-stopped`} style={styles.stoppedCard}>
                <div style={styles.stoppedMain}>
                  <strong style={styles.simpleClient}>{item.row.clientName}</strong>
                  <span style={styles.stoppedReason}>{describeStoppedProject(item.row)}</span>
                </div>
                <div style={styles.stoppedMeta}>
                  <span style={styles.simpleScore}>{formatCurrencyBRL(item.row.amountPaid ?? 0)}</span>
                  <span style={styles.stoppedAction}>{item.recommendation}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section style={styles.panelCard}>
        <div style={styles.sectionHeader}>
          <div>
            <span style={styles.eyebrow}>Visão simplificada</span>
            <h2 style={styles.sectionTitle}>
              {meetingMode ? "Modo reunião: críticos e acelera" : "Carteira priorizada por quadrante"}
            </h2>
          </div>
          <span style={styles.helperText}>
            {meetingMode
              ? "Mostrando apenas CRÍTICO e ACELERA, limitado aos 10 primeiros."
              : "Detalhes ficam recolhidos por padrão. Expanda só quando precisar decidir melhor."}
          </span>
        </div>

        <div style={styles.simpleList}>
          {groupedItems
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <section key={group.title} style={styles.groupSection}>
                <div style={styles.groupHeader}>
                  <span style={styles.groupTitle}>{group.title}</span>
                  <span style={styles.groupCount}>{group.items.length} projeto(s)</span>
                </div>

                <div style={styles.groupList}>
                  {group.items.map((item) => {
                    const key = `${item.row.clientName}-${item.row.implanter}`;
                    const expanded = Boolean(expandedKeys[key]);
                    const tone = getQuadrantTone(item.quadrantEvaluation.quadrant);
                    const closureTone = getClosureTone(item.closureEvaluation.status);
                    const overdueActivitiesTone = getOverdueActivitiesTone(item.row.overdueActivitiesCount ?? 0);
                    const durationTone = getDurationTone(item.row.implanter, item.row.kickOffDate ?? item.row.createdAt);
                    const lastActivityTone = getLastActivityTone(item.row.lastActivityAt);

                    return (
                      <article key={key} style={styles.simpleCard}>
                        <button type="button" onClick={() => toggleExpanded(key)} style={styles.simpleRowButton}>
                          <div style={styles.simpleMain}>
                            <strong style={styles.simpleClient}>{item.row.clientName}</strong>
                            <span style={styles.simpleAction}>{item.recommendation}</span>
                          </div>

                          <div style={styles.simpleMetrics}>
                            <span style={styles.simpleScore}>{formatCurrencyBRL(item.row.amountPaid ?? 0)}</span>
                            <span style={styles.simpleScore}>
                              I {item.quadrantEvaluation.impactScore} • R {item.quadrantEvaluation.riskScore}
                            </span>
                            <span style={{ ...styles.microBadge, background: tone.bg, color: tone.fg, borderColor: tone.border }}>
                              {item.quadrantEvaluation.quadrant}
                            </span>
                            <span style={styles.expandHint}>{expanded ? "Ocultar" : "Expandir"}</span>
                          </div>
                        </button>

                        {expanded ? (
                          <div style={styles.expandedArea}>
                            <div style={styles.infoGrid}>
                              <Info label="Implanter" value={item.row.implanter || "-"} />
                              <Info label="Fase" value={item.row.phase || "-"} tone={getPhaseTone(item.row.phase)} />
                              <Info label="Dias de projeto" value={`${getProjectDays(item.row.kickOffDate ?? item.row.createdAt)} dias`} tone={durationTone} />
                              <Info label="Último follow-up" value={item.row.lastActivityLabel || "-"} tone={lastActivityTone} />
                              <Info label="Mensalidade" value={item.row.hasOverdueSubscription ? "Vencida" : "Ok"} tone={item.row.hasOverdueSubscription ? getQuadrantTone("CRÍTICO") : getQuadrantTone("ACELERA")} />
                              <Info label="MRR" value={formatCurrencyBRL(item.row.amountPaid ?? 0)} />
                              <Info label="Atividades em atraso" value={String(item.row.overdueActivitiesCount ?? 0)} tone={overdueActivitiesTone} />
                              <Info label="Conclusão" value={item.closureEvaluation.status} tone={closureTone} />
                            </div>

                            <div style={styles.expandedPanels}>
                              <DecisionPanel title="Por que este projeto está sendo priorizado?" body={item.quadrantEvaluation.why} />
                              <DecisionPanel
                                title="Impacto"
                                body={
                                  item.quadrantEvaluation.impactFactors.length > 0
                                    ? item.quadrantEvaluation.impactFactors.map((factor) => `${factor.label} (+${factor.points})`).join(" • ")
                                    : "Sem sinais fortes de impacto na base atual."
                                }
                              />
                              <DecisionPanel
                                title="Risco"
                                body={
                                  item.quadrantEvaluation.riskFactors.length > 0
                                    ? item.quadrantEvaluation.riskFactors.map((factor) => `${factor.label} (+${factor.points})`).join(" • ")
                                    : "Sem sinais fortes de risco na base atual."
                                }
                              />
                              <DecisionPanel title="O que exatamente deve ser feito?" body={item.recommendation} />
                              <DecisionPanel title="Pergunta de apoio" body={item.quadrantEvaluation.coachingQuestion} />
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>
      </section>
    </div>
  );
}

function DecisionPanel({ title, body }: { title: string; body: string }): JSX.Element {
  return (
    <div style={styles.decisionPanel}>
      <span style={styles.decisionPanelTitle}>{title}</span>
      <p style={styles.decisionPanelText}>{body}</p>
    </div>
  );
}

function Info({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: { bg: string; fg: string; border: string } | null;
}): JSX.Element {
  return (
    <div
      style={{
        ...styles.infoCard,
        ...(tone ? { background: tone.bg, borderColor: tone.border } : null),
      }}
    >
      <span style={styles.infoLabel}>{label}</span>
      <strong style={{ ...styles.infoValue, color: tone?.fg ?? styles.infoValue.color }}>{value}</strong>
    </div>
  );
}

function buildWeeklyFocus(items: RankedProject[]): {
  mainFocus: string;
  firstAction: string;
  coaching: string;
} {
  const critical = items.filter((item) => item.quadrantEvaluation.quadrant === "CRÍTICO").length;
  const accelerate = items.filter((item) => item.quadrantEvaluation.quadrant === "ACELERA").length;
  const overdue = items.filter((item) => item.row.hasOverdueSubscription).length;
  const stale = items.filter((item) => getLastActivityDays(item.row.lastActivityAt) >= 7).length;

  const mainFocus = [
    critical > 0 ? "proteger contas críticas" : null,
    overdue > 0 ? "resolver risco financeiro" : null,
    accelerate > 0 ? "acelerar ganhos rápidos" : null,
    stale > 0 ? "retomar follows atrasados" : null,
  ]
    .filter(Boolean)
    .slice(0, 3)
    .join(" • ") || "manter disciplina na carteira";

  const first = items[0];
  const firstAction = first
    ? `${first.row.clientName} é o primeiro foco porque está em ${first.quadrantEvaluation.quadrant} e exige ${first.recommendation.toLowerCase()}.`
    : "Nenhum projeto carregado para priorização.";

  const coaching =
    critical > accelerate
      ? "Evite dispersão: comece pelos críticos antes de gastar energia em rotina."
      : "Busque equilibrar proteção de risco com aceleração de projetos que podem gerar resultado rápido.";

  return { mainFocus, firstAction, coaching };
}

function buildEffortDistribution(items: RankedProject[]): string {
  const counts = {
    critico: items.filter((item) => item.quadrantEvaluation.quadrant === "CRÍTICO").length,
    acelera: items.filter((item) => item.quadrantEvaluation.quadrant === "ACELERA").length,
    atencao: items.filter((item) => item.quadrantEvaluation.quadrant === "ATENÇÃO").length,
    rotina: items.filter((item) => item.quadrantEvaluation.quadrant === "ROTINA").length,
  };

  const weightedTotal =
    counts.critico * 4 +
    counts.acelera * 3 +
    counts.atencao * 2 +
    Math.max(counts.rotina, 1);

  const asPercent = (value: number) => `${Math.round((value / Math.max(weightedTotal, 1)) * 100)}%`;
  return `CRÍTICO ${asPercent(counts.critico * 4)} • ACELERA ${asPercent(counts.acelera * 3)} • ATENÇÃO ${asPercent(counts.atencao * 2)} • ROTINA ${asPercent(Math.max(counts.rotina, 1))}`;
}

function buildAlerts(items: RankedProject[]): string[] {
  const alerts: string[] = [];
  const financialRisk = items.filter((item) => item.row.hasOverdueSubscription).length;
  const statusCritical = items.filter((item) => hasCriticalProjectStatus(item.row.projectStatus)).length;
  const statusStopped = items.filter((item) => hasStoppedProjectStatus(item.row.projectStatus)).length;
  const stoppedMrr = items
    .filter((item) => isStoppedProject(item.row))
    .reduce((sum, item) => sum + Math.max(item.row.amountPaid ?? 0, 0), 0);
  const aboveSla = items.filter((item) => {
    const startDate = item.row.kickOffDate ?? item.row.createdAt;
    if (!startDate) {
      return false;
    }
    return getProjectDays(startDate) > getImplanterTargetDays(item.row.implanter);
  }).length;
  const staleFollow = items.filter((item) => getLastActivityDays(item.row.lastActivityAt) >= 7).length;
  const byImplanter = items.reduce<Record<string, number>>((accumulator, item) => {
    const key = item.row.implanter || "Sem implantador";
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
  const topBacklog = Object.entries(byImplanter).sort((a, b) => b[1] - a[1])[0];

  if (financialRisk > 0) {
    alerts.push(`${financialRisk} projeto(s) com risco financeiro. Atue primeiro onde há mensalidade vencida.`);
  }
  if (statusCritical > 0) {
    alerts.push(`${statusCritical} projeto(s) já vieram com status crítico. Eles merecem triagem imediata antes de ampliar a rotina da carteira.`);
  }
  if (statusStopped > 0) {
    alerts.push(`${statusStopped} projeto(s) estão com status parado. Valide causa raiz e próximo passo dono a dono para destravar a semana.`);
  }
  if (stoppedMrr > 0) {
    alerts.push(`${formatCurrencyBRL(stoppedMrr)} de MRR está em projetos parados. Destrave primeiro as contas com maior valor e menor distância de ativação.`);
  }
  if (aboveSla > 0) {
    alerts.push(`${aboveSla} projeto(s) acima do SLA. Reavalie prazo e foco antes de aumentar dispersão.`);
  }
  if (staleFollow > 0) {
    alerts.push(`${staleFollow} projeto(s) sem follow-up recente. Retome a cadência antes que o risco vire atraso real.`);
  }
  if (topBacklog) {
    alerts.push(`Concentração de backlog em ${topBacklog[0]} com ${topBacklog[1]} projeto(s). Revise distribuição dentro do segmento.`);
  }

  return alerts.slice(0, 4);
}

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function visibleByQuadrant(
  items: RankedProject[],
  quadrant: Quadrant,
  meetingMode: boolean,
): RankedProject[] {
  const filtered = items.filter((item) => item.quadrantEvaluation.quadrant === quadrant);
  if (!meetingMode) {
    return filtered;
  }
  if (quadrant !== "CRÍTICO" && quadrant !== "ACELERA") {
    return [];
  }
  return filtered.slice(0, 10);
}

function getPhaseTone(phase: string): { bg: string; fg: string; border: string } {
  const normalized = phase.toLowerCase();
  if (normalized.includes("setup")) {
    return { bg: "#eff6ff", fg: "#1d4ed8", border: "#93c5fd" };
  }
  if (normalized.includes("implant")) {
    return { bg: "#fff7ed", fg: "#c2410c", border: "#fdba74" };
  }
  if (normalized.includes("acomp")) {
    return { bg: "#f5f3ff", fg: "#6d28d9", border: "#c4b5fd" };
  }
  return { bg: "#f8fafc", fg: "#475569", border: "#cbd5e1" };
}

function getDurationTone(
  implanter: string,
  startDate?: Date | null,
): { label: string; bg: string; fg: string; border: string } | null {
  if (!startDate) {
    return null;
  }
  const targetDays = getImplanterTargetDays(implanter);
  const age = Math.max(0, Math.floor((Date.now() - startDate.getTime()) / 86400000));
  if (age > targetDays) {
    return { label: `Atrasado ${age - targetDays}d`, bg: "#fff1f2", fg: "#be123c", border: "#fda4af" };
  }
  return { label: `${isMidImplanter(implanter) ? "MID" : "SMB"} no prazo`, bg: "#eff6ff", fg: "#1d4ed8", border: "#93c5fd" };
}

function getProjectDays(startDate?: Date | null): number {
  return startDate ? diffDaysFromNow(startDate) : 0;
}

function getImplanterTargetDays(implanter: string): number {
  return isMidImplanter(implanter) ? 90 : 60;
}

function isMidImplanter(implanter: string): boolean {
  void implanter;
  return false;
}

function getLastActivityTone(
  lastActivityAt?: Date | null,
): { label: string; bg: string; fg: string; border: string } | null {
  if (!lastActivityAt) {
    return null;
  }
  const days = diffDaysFromNow(lastActivityAt);
  if (days >= 30) {
    return { label: `Sem follow-up ${days}d`, bg: "#fff1f2", fg: "#be123c", border: "#fda4af" };
  }
  if (days >= 15) {
    return { label: `Sem follow-up ${days}d`, bg: "#fff7ed", fg: "#c2410c", border: "#fdba74" };
  }
  if (days >= 7) {
    return { label: `Sem follow-up ${days}d`, bg: "#fffbeb", fg: "#a16207", border: "#fde68a" };
  }
  return { label: "Follow-up recente", bg: "#ecfdf3", fg: "#047857", border: "#86efac" };
}

function getLastActivityDays(lastActivityAt?: Date | null): number {
  if (!lastActivityAt) {
    return 999;
  }
  return diffDaysFromNow(lastActivityAt);
}

function getClosureTone(
  status: RankedProject["closureEvaluation"]["status"],
): { bg: string; fg: string; border: string } {
  if (status === "Apto para validação final") {
    return { bg: "#ecfdf3", fg: "#047857", border: "#86efac" };
  }
  if (status === "Quase apto") {
    return { bg: "#fffbeb", fg: "#a16207", border: "#fde68a" };
  }
  return { bg: "#fff1f2", fg: "#be123c", border: "#fda4af" };
}

function getOverdueActivitiesTone(count: number): { bg: string; fg: string; border: string } | null {
  if (count <= 0) {
    return null;
  }
  if (count >= 3) {
    return { bg: "#fff1f2", fg: "#be123c", border: "#fda4af" };
  }
  return { bg: "#fffbeb", fg: "#a16207", border: "#fde68a" };
}

function getQuadrantTone(quadrant: Quadrant): { bg: string; fg: string; border: string } {
  switch (quadrant) {
    case "CRÍTICO":
      return { bg: "#fff1f2", fg: "#be123c", border: "#fda4af" };
    case "ACELERA":
      return { bg: "#ecfdf3", fg: "#047857", border: "#86efac" };
    case "ATENÇÃO":
      return { bg: "#fffbeb", fg: "#a16207", border: "#fde68a" };
    case "ROTINA":
    default:
      return { bg: "#eff6ff", fg: "#1d4ed8", border: "#93c5fd" };
  }
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "grid",
    gap: "18px",
  },
  planCard: {
    background: "linear-gradient(135deg, rgba(106,63,150,0.12) 0%, rgba(255,255,255,0.95) 100%)",
    border: "1px solid rgba(106, 63, 150, 0.14)",
    borderRadius: "24px",
    padding: "20px",
    boxShadow: "0 18px 36px rgba(83, 40, 125, 0.06)",
  },
  planHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: "14px",
  },
  eyebrow: {
    display: "block",
    marginBottom: "6px",
    color: "#5b3a81",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  sectionTitle: {
    margin: 0,
    color: "#24153d",
    fontSize: "28px",
    lineHeight: 1.1,
  },
  modeButton: {
    borderRadius: "999px",
    border: "1px solid rgba(106, 63, 150, 0.16)",
    background: "#ffffff",
    color: "#56317b",
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  modeButtonActive: {
    background: "#56317b",
    color: "#ffffff",
    borderColor: "#56317b",
  },
  planLines: {
    display: "grid",
    gap: "8px",
  },
  planLine: {
    color: "#334155",
    lineHeight: 1.5,
  },
  actionSection: {
    display: "grid",
    gap: "12px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  helperText: {
    color: "#64748b",
    lineHeight: 1.5,
    maxWidth: "500px",
  },
  topList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
  },
  topCard: {
    background: "#ffffff",
    borderRadius: "18px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    padding: "16px",
    boxShadow: "0 12px 24px rgba(15, 23, 42, 0.04)",
  },
  topCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    marginBottom: "10px",
  },
  topClient: {
    color: "#0f172a",
  },
  topReason: {
    margin: "0 0 8px",
    color: "#334155",
    lineHeight: 1.5,
  },
  topMeta: {
    margin: "0 0 8px",
    color: "#5b3a81",
    fontWeight: 700,
  },
  topAction: {
    margin: 0,
    color: "#0f172a",
    lineHeight: 1.5,
  },
  panelCard: {
    background: "#ffffff",
    borderRadius: "22px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    padding: "18px",
    boxShadow: "0 18px 36px rgba(15, 23, 42, 0.05)",
  },
  alertList: {
    display: "grid",
    gap: "10px",
    marginTop: "10px",
  },
  stoppedList: {
    display: "grid",
    gap: "12px",
    marginTop: "10px",
  },
  stoppedCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "flex-start",
    padding: "14px 16px",
    borderRadius: "18px",
    background: "linear-gradient(180deg, #ffffff 0%, #faf7ff 100%)",
    border: "1px solid rgba(106, 63, 150, 0.1)",
  },
  stoppedMain: {
    display: "grid",
    gap: "6px",
  },
  stoppedReason: {
    color: "#475569",
    lineHeight: 1.5,
  },
  stoppedMeta: {
    display: "grid",
    gap: "8px",
    justifyItems: "end",
    minWidth: "180px",
  },
  stoppedAction: {
    color: "#0f172a",
    fontWeight: 600,
    textAlign: "right",
    lineHeight: 1.4,
  },
  alertItem: {
    padding: "12px 14px",
    borderRadius: "14px",
    background: "#faf7ff",
    border: "1px solid rgba(106, 63, 150, 0.1)",
    color: "#334155",
    lineHeight: 1.5,
  },
  simpleList: {
    display: "grid",
    gap: "12px",
  },
  groupSection: {
    display: "grid",
    gap: "10px",
  },
  groupHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    paddingBottom: "4px",
  },
  groupTitle: {
    color: "#24153d",
    fontSize: "18px",
    fontWeight: 800,
  },
  groupCount: {
    color: "#64748b",
    fontSize: "14px",
  },
  groupList: {
    display: "grid",
    gap: "12px",
  },
  simpleCard: {
    borderRadius: "18px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    background: "#ffffff",
    overflow: "hidden",
  },
  simpleRowButton: {
    width: "100%",
    border: 0,
    background: "transparent",
    padding: "16px",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    cursor: "pointer",
    textAlign: "left",
  },
  simpleMain: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
  },
  simpleClient: {
    color: "#0f172a",
    fontSize: "18px",
  },
  simpleAction: {
    color: "#475569",
    lineHeight: 1.45,
  },
  simpleMetrics: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  simpleScore: {
    color: "#334155",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  expandHint: {
    color: "#64748b",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  expandedArea: {
    padding: "0 16px 16px",
    display: "grid",
    gap: "14px",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "12px",
  },
  infoCard: {
    background: "#f8fafc",
    borderRadius: "14px",
    padding: "14px",
    border: "1px solid #e2e8f0",
  },
  infoLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "12px",
    marginBottom: "6px",
  },
  infoValue: {
    color: "#0f172a",
    fontSize: "18px",
  },
  expandedPanels: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
  },
  decisionPanel: {
    padding: "14px",
    borderRadius: "16px",
    background: "#faf7ff",
    border: "1px solid rgba(106, 63, 150, 0.1)",
  },
  decisionPanelTitle: {
    display: "block",
    marginBottom: "8px",
    color: "#5b3a81",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  decisionPanelText: {
    margin: 0,
    color: "#334155",
    lineHeight: 1.55,
  },
  microBadge: {
    padding: "6px 10px",
    borderRadius: "999px",
    borderStyle: "solid",
    borderWidth: "1px",
    fontSize: "12px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
};
