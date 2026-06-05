import { CSSProperties, useState } from "react";

import type { ExecutiveUploadsData, RankedProject, UploadIssue } from "../types";
import { hasCriticalProjectStatus, hasStoppedProjectStatus } from "../utils/riskScore";

interface ExecutiveOverviewProps {
  projects: RankedProject[];
  executiveData: ExecutiveUploadsData | null;
  executiveIssues: UploadIssue[];
  batidaContext: {
    markedClients: number;
    markedMrr: number;
  };
}

type RiskBucket = "parado" | "em-risco" | "necessita-acao" | "com-problemas" | null;

export function ExecutiveOverview({
  projects,
  executiveData,
  executiveIssues,
  batidaContext,
}: ExecutiveOverviewProps): JSX.Element {
  const [showUploadDetails, setShowUploadDetails] = useState(false);
  const hasAnySource = projects.length > 0 || Boolean(executiveData);

  if (!hasAnySource) {
    return (
      <section style={styles.wrapper}>
        <div style={styles.emptyCard}>
          <p style={styles.eyebrow}>Dashboard executivo</p>
          <h2 style={styles.title}>Nenhuma base carregada</h2>
          <p style={styles.subtitle}>
            Envie a base principal e as planilhas executivas para visualizar os números consolidados.
          </p>
        </div>
      </section>
    );
  }

  const summary = buildExecutiveSummary(projects, executiveData);

  return (
    <section style={styles.wrapper}>
      {executiveIssues.length > 0 ? (
        <section style={styles.issuePanel}>
          <button
            type="button"
            onClick={() => setShowUploadDetails((current) => !current)}
            style={styles.issueToggle}
          >
            <span style={styles.issueToggleTitle}>Detalhes dos uploads</span>
            <span style={styles.issueToggleMeta}>
              {executiveIssues.length} arquivo(s) processado(s) {showUploadDetails ? "▲" : "▼"}
            </span>
          </button>

          {showUploadDetails ? (
            <div style={styles.issueList}>
              {executiveIssues.map((issue, index) => (
                <div
                  key={`${issue.fileName}-${index}`}
                  style={{
                    ...styles.issueItem,
                    borderColor:
                      issue.severity === "error"
                        ? "#fda4af"
                        : issue.severity === "warning"
                          ? "#fcd34d"
                          : "#86efac",
                    background:
                      issue.severity === "error"
                        ? "#fff1f2"
                        : issue.severity === "warning"
                          ? "#fffbeb"
                          : "#f0fdf4",
                  }}
                >
                  <strong>{issue.fileName}</strong>
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <header style={styles.hero}>
        <div style={styles.heroCopy}>
          <p style={styles.eyebrow}>Dashboard executivo</p>
          <h2 style={styles.title}>Direcionamento estratégico da carteira</h2>
          <p style={styles.subtitle}>
            A carteira ativa vem da base principal. Novos, encerrados, perdidos e cancelamentos podem ser refinados pelas planilhas executivas.
          </p>
        </div>
        <div style={styles.heroHighlight}>
          <span style={styles.heroLabel}>Carteira em monitoramento</span>
          <strong style={styles.heroValue}>{summary.totalProjects}</strong>
          <span style={styles.heroMeta}>
            {summary.totalRiskProjects} projeto(s) em risco pela régua executiva
          </span>
        </div>
      </header>

      <div style={styles.topGrid}>
        <MetricCard
          label="Número total de projetos"
          value={summary.totalProjects}
          detail={summary.totalProjectsSource}
          tone="neutral"
        />
        <MetricCard
          label="MRR total"
          value={formatCurrencyBRL(summary.totalMrr)}
          detail={summary.totalMrrSource}
          tone="positive"
        />
        <MetricCard
          label="Projetos em risco"
          value={summary.totalRiskProjects}
          detail={`parado ${summary.riskBreakdown.parado} • crítico ${summary.riskBreakdown.emRisco} • necessita ${summary.riskBreakdown.necessitaAcao}`}
          tone="critical"
        />
        <MetricCard
          label="Projetos atrasados"
          value={summary.delayedProjects}
          detail={summary.delayedSource}
          tone={summary.delayedProjects > 0 ? "warning" : "positive"}
        />
        <MetricCard
          label="MRR dos clientes em risco"
          value={formatCurrencyBRL(summary.riskMrr)}
          detail="parado, crítico, necessita de ação, com problemas ou fator de risco preenchido"
          tone={summary.riskMrr > 0 ? "critical" : "neutral"}
        />
        <MetricCard
          label="ERP cancelados"
          value={summary.cancelledErps.length}
          detail={summary.cancelledErps.slice(0, 2).join(" • ") || "sem planilha de cancelamento"}
          tone={summary.cancelledErps.length > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Carteira A"
          value={summary.portfolioA.totalProjects}
          detail={`${formatCurrencyBRL(summary.portfolioA.totalMrr)} de MRR`}
          tone="positive"
        />
        <MetricCard
          label="Carteira B"
          value={summary.portfolioB.totalProjects}
          detail={`${formatCurrencyBRL(summary.portfolioB.totalMrr)} de MRR`}
          tone="neutral"
        />
        <MetricCard
          label="Risco na carteira A"
          value={summary.portfolioA.riskProjects}
          detail={`${formatCurrencyBRL(summary.portfolioA.riskMrr)} em risco pela régua executiva`}
          tone={summary.portfolioA.riskProjects > 0 ? "critical" : "neutral"}
        />
        <MetricCard
          label="Risco na carteira B"
          value={summary.portfolioB.riskProjects}
          detail={`${formatCurrencyBRL(summary.portfolioB.riskMrr)} em risco pela régua executiva`}
          tone={summary.portfolioB.riskProjects > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Clientes sinalizados na batida"
          value={batidaContext.markedClients}
          detail="clientes com ajuste manual registrado na fila"
          tone={batidaContext.markedClients > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="MRR sinalizado na batida"
          value={formatCurrencyBRL(batidaContext.markedMrr)}
          detail="MRR dos clientes com marcação manual na fila"
          tone={batidaContext.markedMrr > 0 ? "critical" : "neutral"}
        />
      </div>

      <div style={styles.sectionGrid}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <p style={styles.panelEyebrow}>Risco executivo</p>
            <h3 style={styles.panelTitle}>Projetos em risco por leitura de carteira</h3>
          </div>

          <div style={styles.metricGrid}>
            <MetricCard label="Parado" value={summary.riskBreakdown.parado} detail="status parado na planilha" tone="critical" compact />
            <MetricCard label="Em risco" value={summary.riskBreakdown.emRisco} detail="status crítico / em risco na planilha" tone="warning" compact />
            <MetricCard label="Necessita de ação" value={summary.riskBreakdown.necessitaAcao} detail="status sinalizado como necessita de ação" tone="critical" compact />
            <MetricCard label="Com problemas" value={summary.riskBreakdown.comProblemas} detail="status com problemas ou fator de risco preenchido" tone="critical" compact />
            <MetricCard
              label="MRR total de cancelamento"
              value={formatCurrencyBRL(summary.totalCancellationMrr)}
              detail={summary.cancellationSource}
              tone={summary.totalCancellationMrr > 0 ? "critical" : "neutral"}
              compact
            />
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <p style={styles.panelEyebrow}>Movimentação</p>
            <h3 style={styles.panelTitle}>Ciclo da carteira</h3>
          </div>

          <div style={styles.metricGrid}>
            <MetricCard label="Projetos novos" value={summary.newProjects} detail={summary.newProjectsSource} tone="positive" compact />
            <MetricCard label="Projetos encerrados" value={summary.closedProjects} detail={summary.closedProjectsSource} tone="positive" compact />
            <MetricCard
              label="Concluídos com nota"
              value={summary.closedProjectsWithNote}
              detail="finalizações com nota preenchida"
              tone="positive"
              compact
            />
            <MetricCard
              label="Concluídos sem nota"
              value={summary.closedProjectsWithoutNote}
              detail="finalizações sem nota preenchida"
              tone={summary.closedProjectsWithoutNote > 0 ? "warning" : "neutral"}
              compact
            />
            <MetricCard label="Concluídos como perdidos" value={summary.lostProjects} detail={summary.lostProjectsSource} tone={summary.lostProjects > 0 ? "critical" : "neutral"} compact />
            <MetricCard label="MRR perdido" value={formatCurrencyBRL(summary.lostMrr)} detail="soma do Valor Total do Contrato dos projetos perdidos" tone={summary.lostMrr > 0 ? "critical" : "neutral"} compact />
          </div>
        </section>
      </div>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <p style={styles.panelEyebrow}>Cancelamento</p>
          <h3 style={styles.panelTitle}>Oportunidade de cancelamento por tempo de vida</h3>
        </div>

        <div style={{ ...styles.metricGrid, marginBottom: "16px" }}>
          <MetricCard
            label="Total de projetos cancelados"
            value={summary.totalCancellationProjects}
            detail={summary.cancellationSource}
            tone={summary.totalCancellationProjects > 0 ? "critical" : "neutral"}
            compact
          />
        </div>

        <div style={styles.cancellationGrid}>
          <CancellationCard title="Até 3 meses" count={summary.cancellationBuckets.upTo3Months.count} mrr={summary.cancellationBuckets.upTo3Months.mrr} helper={summary.cancellationSource} />
          <CancellationCard title="Até 6 meses" count={summary.cancellationBuckets.upTo6Months.count} mrr={summary.cancellationBuckets.upTo6Months.mrr} helper={summary.cancellationSource} />
          <CancellationCard title="Entre 6 e 12 meses" count={summary.cancellationBuckets.from6To12Months.count} mrr={summary.cancellationBuckets.from6To12Months.mrr} helper={summary.cancellationSource} />
          <CancellationCard title="Mais de 12 meses" count={summary.cancellationBuckets.over12Months.count} mrr={summary.cancellationBuckets.over12Months.mrr} helper={summary.cancellationSource} />
        </div>

        <div style={{ ...styles.sectionGrid, marginTop: "16px" }}>
          <div style={styles.subPanel}>
            <strong style={styles.subPanelTitle}>Fase no cancelamento</strong>
            <div style={styles.list}>
              {summary.cancellationPhaseBreakdown.length > 0 ? (
                summary.cancellationPhaseBreakdown.map((item) => (
                  <article key={item.phase} style={styles.listItem}>
                    <div>
                      <strong style={styles.listTitle}>{item.phase}</strong>
                      <p style={styles.listText}>{item.count} projeto(s)</p>
                    </div>
                  </article>
                ))
              ) : (
                <div style={styles.emptyList}>Nenhuma fase de cancelamento carregada ainda.</div>
              )}
            </div>
          </div>

          <div style={styles.subPanel}>
            <strong style={styles.subPanelTitle}>ERP cancelados</strong>
            <div style={styles.list}>
              {summary.cancelledErpBreakdown.length > 0 ? (
                summary.cancelledErpBreakdown.map((item) => (
                  <article key={item.erp} style={styles.listItem}>
                    <div>
                      <strong style={styles.listTitle}>{item.erp}</strong>
                      <p style={styles.listText}>{item.count} cancelamento(s)</p>
                    </div>
                    <div style={styles.listMeta}>
                      <span style={styles.listBadge}>{formatCurrencyBRL(item.mrr)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <div style={styles.emptyList}>Nenhum ERP cancelado carregado ainda.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <p style={styles.panelEyebrow}>Leitura rápida</p>
          <h3 style={styles.panelTitle}>Top oportunidades de cancelamento por MRR</h3>
        </div>

        <div style={styles.list}>
          {summary.topCancellationAccounts.length > 0 ? (
            summary.topCancellationAccounts.map((item) => (
              <article key={`${item.clientName}-${item.projectName}`} style={styles.listItem}>
                <div>
                  <strong style={styles.listTitle}>{item.clientName}</strong>
                  <p style={styles.listText}>
                    {item.implanter || "Sem implanter"} • {describeBucket(item.monthsOfLife)}
                  </p>
                </div>
                <div style={styles.listMeta}>
                  <span style={styles.listBadge}>{formatCurrencyBRL(item.cancellationMrr)}</span>
                  <span style={styles.listReason}>{item.projectName}</span>
                </div>
              </article>
            ))
          ) : (
            <div style={styles.emptyList}>
              Nenhuma oportunidade de cancelamento carregada pelas planilhas executivas.
            </div>
          )}
        </div>
      </section>

      <div style={styles.sectionGrid}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <p style={styles.panelEyebrow}>Finalização</p>
            <h3 style={styles.panelTitle}>Tabela de notas de finalização</h3>
          </div>

          <div style={styles.metricGrid}>
            <MetricCard
              label="Média das notas"
              value={summary.finalization.averageScore !== null ? summary.finalization.averageScore.toFixed(1) : "-"}
              detail={summary.finalization.scoreCount > 0 ? `${summary.finalization.scoreCount} resposta(s) com nota` : "sem nota preenchida"}
              tone="positive"
              compact
            />
          </div>

          <div style={styles.tableWrap}>
            {summary.finalizationRows.length > 0 ? (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Cliente</th>
                    <th style={styles.th}>Implanter</th>
                    <th style={styles.th}>Fechamento</th>
                    <th style={styles.th}>Nota</th>
                    <th style={styles.th}>Contrato</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.finalizationRows.map((row) => (
                    <tr key={`${row.clientName}-${row.projectName}`} style={styles.tr}>
                      <td style={styles.td}>{row.clientName}</td>
                      <td style={styles.td}>{row.implanter || "-"}</td>
                      <td style={styles.td}>{formatDateBR(row.closedAt)}</td>
                      <td style={styles.td}>{row.finalizationNote || "-"}</td>
                      <td style={styles.td}>{formatCurrencyBRL(row.contractValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={styles.emptyList}>Nenhuma linha de finalização carregada da planilha 2.</div>
            )}
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <p style={styles.panelEyebrow}>Perdidos</p>
            <h3 style={styles.panelTitle}>Perdidos por implanter</h3>
          </div>

          <div style={styles.list}>
            {summary.lostByImplanter.length > 0 ? (
              summary.lostByImplanter.map((item) => (
                <article key={item.implanter} style={styles.listItem}>
                  <div>
                    <strong style={styles.listTitle}>{item.implanter}</strong>
                    <p style={styles.listText}>{item.count} perdido(s)</p>
                  </div>
                  <div style={styles.listMeta}>
                    <span style={styles.listBadge}>{formatCurrencyBRL(item.mrr)}</span>
                  </div>
                </article>
              ))
            ) : (
              <div style={styles.emptyList}>Nenhum perdido por implanter carregado ainda.</div>
            )}
          </div>

          <div style={{ ...styles.list, marginTop: "16px" }}>
            <strong style={styles.subPanelTitle}>Notas por implanter</strong>
            {summary.finalization.byImplanter.length > 0 ? (
              summary.finalization.byImplanter.map((item) => (
                <article key={item.implanter} style={styles.listItem}>
                  <div>
                    <strong style={styles.listTitle}>{item.implanter}</strong>
                    <p style={styles.listText}>{item.count} nota(s) • média {item.average.toFixed(1)}</p>
                  </div>
                </article>
              ))
            ) : (
              <div style={styles.emptyList}>Nenhuma nota por implanter disponível ainda.</div>
            )}
          </div>
        </section>
      </div>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <p style={styles.panelEyebrow}>Inadimplência</p>
          <h3 style={styles.panelTitle}>Visão de inadimplência em implantação</h3>
        </div>

        <div style={styles.metricGrid}>
          <MetricCard
            label="Clientes inadimplentes"
            value={summary.delinquency.total}
            detail={summary.delinquency.source}
            tone={summary.delinquency.total > 0 ? "critical" : "positive"}
            compact
          />
          <MetricCard
            label="Implanters com inadimplência"
            value={summary.delinquency.byImplanter.length}
            detail="quantos responsáveis têm clientes vencidos"
            tone="warning"
            compact
          />
        </div>

        <div style={{ ...styles.list, marginTop: "16px" }}>
          {summary.delinquency.byImplanter.length > 0 ? (
            summary.delinquency.byImplanter.map((item) => (
              <article key={item.implanter} style={styles.listItem}>
                <div>
                  <strong style={styles.listTitle}>{item.implanter}</strong>
                  <p style={styles.listText}>{item.count} cliente(s) com mensalidade vencida</p>
                </div>
              </article>
            ))
          ) : (
            <div style={styles.emptyList}>Nenhum dado de inadimplência carregado ainda.</div>
          )}
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <p style={styles.panelEyebrow}>Cancelamento por implanter</p>
          <h3 style={styles.panelTitle}>Relação de cancelamentos, tempo de vida e MRR por implanter</h3>
        </div>

        <div style={styles.tableWrap}>
          {summary.cancellationByImplanter.length > 0 ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Implanter</th>
                  <th style={styles.th}>Até 3m</th>
                  <th style={styles.th}>Até 6m</th>
                  <th style={styles.th}>6 a 12m</th>
                  <th style={styles.th}>12m+</th>
                  <th style={styles.th}>Projetos</th>
                  <th style={styles.th}>MRR cancelado</th>
                </tr>
              </thead>
              <tbody>
                {summary.cancellationByImplanter.map((row) => (
                  <tr key={row.implanter} style={styles.tr}>
                    <td style={styles.td}>{row.implanter}</td>
                    <td style={styles.td}>{row.upTo3Months}</td>
                    <td style={styles.td}>{row.upTo6Months}</td>
                    <td style={styles.td}>{row.from6To12Months}</td>
                    <td style={styles.td}>{row.over12Months}</td>
                    <td style={styles.td}>{row.totalProjects}</td>
                    <td style={styles.td}>{formatCurrencyBRL(row.totalMrr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={styles.emptyList}>Nenhum cancelamento por implanter carregado ainda.</div>
          )}
        </div>
      </section>
    </section>
  );
}

function buildExecutiveSummary(projects: RankedProject[], executiveData: ExecutiveUploadsData | null) {
  const totalProjects = executiveData?.openProjects.length ?? projects.length;
  const totalMrr = executiveData?.openProjects.length
    ? executiveData.openProjects.reduce((sum, project) => sum + Math.max(project.contractValue, 0), 0)
    : projects.reduce((sum, project) => sum + Math.max(project.row.amountPaid ?? 0, 0), 0);
  const totalProjectsSource = executiveData?.openProjects.length
    ? "lido da planilha de projetos abertos por implanter"
    : "lido da base principal carregada";
  const totalMrrSource = executiveData?.openProjects.length
    ? "soma do Valor Total do Contrato da carteira atual"
    : totalMrr > 0
      ? "lido da base principal com MRR visível"
      : "MRR indisponível nas planilhas executivas";

  const openProjectsRisk = executiveData?.openProjects.length
    ? classifyOpenProjectRisks(executiveData.openProjects)
    : classifyRankedProjectRisks(projects);

  const delayedProjects = executiveData?.openProjects.length
    ? executiveData.openProjects.filter(isDelayedOpenProject).length
    : projects.filter(isDelayedRankedProject).length;
  const riskMrr = executiveData?.openProjects.length
    ? executiveData.openProjects
        .filter((item) => {
          const bucket = classifyOpenProjectRiskBucket(item);
          return bucket === "parado" || bucket === "em-risco" || bucket === "necessita-acao" || bucket === "com-problemas";
        })
        .reduce((sum, item) => sum + Math.max(item.contractValue, 0), 0)
    : 0;
  const openProjects = executiveData?.openProjects ?? [];
  const portfolioAProjects = openProjects.filter((item) => classifyPortfolioClass(item) === "A");
  const portfolioBProjects = openProjects.filter((item) => classifyPortfolioClass(item) === "B");
  const portfolioARiskProjects = portfolioAProjects.filter((item) => isExecutiveRiskProject(item));
  const portfolioBRiskProjects = portfolioBProjects.filter((item) => isExecutiveRiskProject(item));

  const newProjects = executiveData?.newProjects.length ?? projects.filter((project) => getRankedProjectAgeDays(project) <= 30).length;
  const closedProjects = executiveData?.closedProjects.length ?? projects.filter(isClosedRankedProject).length;
  const lostProjects = executiveData?.lostProjects.length ?? projects.filter(isLostRankedProject).length;
  const lostMrr = executiveData?.lostProjects.length
    ? executiveData.lostProjects.reduce((sum, row) => sum + Math.max(row.contractValue, 0), 0)
    : projects.filter(isLostRankedProject).reduce((sum, project) => sum + Math.max(project.row.amountPaid ?? 0, 0), 0);

  const cancellationProjects = executiveData?.cancellationProjects ?? [];
  const totalCancellationProjects = cancellationProjects.length;
  const totalCancellationMrr = cancellationProjects.reduce(
    (sum, item) => sum + item.cancellationMrr,
    0,
  );
  const finalizationRows = (executiveData?.closedProjects ?? [])
    .slice()
    .sort((a, b) => a.clientName.localeCompare(b.clientName) || (a.closedAt?.getTime() ?? 0) - (b.closedAt?.getTime() ?? 0))
    .slice(0, 20);
  const finalizationScores = (executiveData?.closedProjects ?? [])
    .map((item) => item.finalizationScore)
    .filter((value): value is number => value !== null);
  const closedProjectsWithNote = (executiveData?.closedProjects ?? []).filter((item) =>
    item.finalizationNote.trim().length > 0,
  ).length;
  const closedProjectsWithoutNote = Math.max(closedProjects - closedProjectsWithNote, 0);
  const finalizationByImplanter = Array.from(
    (executiveData?.closedProjects ?? []).reduce<Map<string, { implanter: string; count: number; total: number }>>(
      (accumulator, item) => {
        if (item.finalizationScore === null) {
          return accumulator;
        }
        const key = item.implanter || "Sem implanter";
        const current = accumulator.get(key) ?? { implanter: key, count: 0, total: 0 };
        current.count += 1;
        current.total += item.finalizationScore;
        accumulator.set(key, current);
        return accumulator;
      },
      new Map(),
    ).values(),
  )
    .map((item) => ({
      implanter: item.implanter,
      count: item.count,
      average: item.count > 0 ? item.total / item.count : 0,
    }))
    .sort((a, b) => b.average - a.average || b.count - a.count || a.implanter.localeCompare(b.implanter));
  const lostByImplanter = (executiveData?.lostProjects ?? [])
    .reduce<Map<string, { implanter: string; count: number; mrr: number }>>((accumulator, item) => {
      const key = item.implanter || "Sem implanter";
      const current = accumulator.get(key) ?? { implanter: key, count: 0, mrr: 0 };
      current.count += 1;
      current.mrr += Math.max(item.contractValue, 0);
      accumulator.set(key, current);
      return accumulator;
    }, new Map());
  const delinquencyRows = executiveData?.delinquencyProjects ?? [];
  const delinquentClients = delinquencyRows.filter((item) => item.hasOverdueSubscription);
  const delinquencyByImplanter = delinquentClients
    .reduce<Map<string, { implanter: string; count: number }>>((accumulator, item) => {
      const key = item.implanter || "Sem implanter";
      const current = accumulator.get(key) ?? { implanter: key, count: 0 };
      current.count += 1;
      accumulator.set(key, current);
      return accumulator;
    }, new Map());
  const cancellationBuckets = cancellationProjects.reduce(
    (accumulator, item) => {
      if (item.monthsOfLife <= 3) {
        accumulator.upTo3Months.count += 1;
        accumulator.upTo3Months.mrr += item.cancellationMrr;
      } else if (item.monthsOfLife <= 6) {
        accumulator.upTo6Months.count += 1;
        accumulator.upTo6Months.mrr += item.cancellationMrr;
      } else if (item.monthsOfLife <= 12) {
        accumulator.from6To12Months.count += 1;
        accumulator.from6To12Months.mrr += item.cancellationMrr;
      } else {
        accumulator.over12Months.count += 1;
        accumulator.over12Months.mrr += item.cancellationMrr;
      }
      return accumulator;
    },
    {
      upTo3Months: { count: 0, mrr: 0 },
      upTo6Months: { count: 0, mrr: 0 },
      from6To12Months: { count: 0, mrr: 0 },
      over12Months: { count: 0, mrr: 0 },
    },
  );
  const cancellationByImplanter = Array.from(
    cancellationProjects.reduce<
      Map<
        string,
        {
          implanter: string;
          upTo3Months: number;
          upTo6Months: number;
          from6To12Months: number;
          over12Months: number;
          totalProjects: number;
          totalMrr: number;
        }
      >
    >((accumulator, item) => {
      const key = item.implanter || "Sem implanter";
      const current =
        accumulator.get(key) ?? {
          implanter: key,
          upTo3Months: 0,
          upTo6Months: 0,
          from6To12Months: 0,
          over12Months: 0,
          totalProjects: 0,
          totalMrr: 0,
        };
      if (item.monthsOfLife <= 3) {
        current.upTo3Months += 1;
      } else if (item.monthsOfLife <= 6) {
        current.upTo6Months += 1;
      } else if (item.monthsOfLife <= 12) {
        current.from6To12Months += 1;
      } else {
        current.over12Months += 1;
      }
      current.totalProjects += 1;
      current.totalMrr += item.cancellationMrr;
      accumulator.set(key, current);
      return accumulator;
    }, new Map()).values(),
  ).sort((a, b) => b.totalProjects - a.totalProjects || b.totalMrr - a.totalMrr);
  const cancellationPhaseBreakdown = Array.from(
    cancellationProjects.reduce<Map<string, { phase: string; count: number }>>((accumulator, item) => {
      const phase = normalizeCancellationPhase(item.phase);
      const current = accumulator.get(phase) ?? { phase, count: 0 };
      current.count += 1;
      accumulator.set(phase, current);
      return accumulator;
    }, new Map()).values(),
  ).sort((a, b) => b.count - a.count || a.phase.localeCompare(b.phase));
  const cancelledErpBreakdown = Array.from(
    cancellationProjects.reduce<Map<string, { erp: string; count: number; mrr: number }>>((accumulator, item) => {
      const erp = item.erpName || "ERP não informado";
      const current = accumulator.get(erp) ?? { erp, count: 0, mrr: 0 };
      current.count += 1;
      current.mrr += item.cancellationMrr;
      accumulator.set(erp, current);
      return accumulator;
    }, new Map()).values(),
  ).sort((a, b) => b.count - a.count || b.mrr - a.mrr);

  return {
    totalProjects,
    totalMrr,
    totalProjectsSource,
    totalMrrSource,
    totalRiskProjects:
      openProjectsRisk.parado +
      openProjectsRisk.emRisco +
      openProjectsRisk.necessitaAcao +
      openProjectsRisk.comProblemas,
    riskBreakdown: openProjectsRisk,
    delayedProjects,
    riskMrr,
    portfolioA: {
      totalProjects: portfolioAProjects.length,
      totalMrr: portfolioAProjects.reduce((sum, item) => sum + Math.max(item.contractValue, 0), 0),
      riskProjects: portfolioARiskProjects.length,
      riskMrr: portfolioARiskProjects.reduce((sum, item) => sum + Math.max(item.contractValue, 0), 0),
    },
    portfolioB: {
      totalProjects: portfolioBProjects.length,
      totalMrr: portfolioBProjects.reduce((sum, item) => sum + Math.max(item.contractValue, 0), 0),
      riskProjects: portfolioBRiskProjects.length,
      riskMrr: portfolioBRiskProjects.reduce((sum, item) => sum + Math.max(item.contractValue, 0), 0),
    },
    delayedSource: executiveData?.openProjects.length
      ? "SLA executivo calculado na planilha de projetos abertos"
      : "SLA executivo calculado na base principal",
    newProjects,
    newProjectsSource: executiveData?.newProjects.length
      ? "lido da planilha de novos projetos"
      : "estimado pela base principal (até 30 dias)",
    closedProjects,
    closedProjectsWithNote,
    closedProjectsWithoutNote,
    closedProjectsSource: executiveData?.closedProjects.length
      ? "lido da planilha de nota de finalização"
      : "estimado pela fase/status da base principal",
    lostProjects,
    lostProjectsSource: executiveData?.lostProjects.length
      ? "lido da planilha de projetos perdidos"
      : "estimado pela fase/status da base principal",
    lostMrr,
    totalCancellationProjects,
    totalCancellationMrr,
    cancellationBuckets,
    cancellationSource: executiveData?.cancellationProjects.length
      ? "lido da planilha de oportunidade de cancelamento"
      : "envie a planilha de cancelamento para preencher esta visão",
    topCancellationAccounts: cancellationProjects.slice().sort((a, b) => b.cancellationMrr - a.cancellationMrr).slice(0, 6),
    cancelledErps: cancelledErpBreakdown.map((item) => item.erp),
    cancelledErpBreakdown,
    cancellationPhaseBreakdown,
    cancellationByImplanter,
    finalizationRows,
    finalization: {
      averageScore:
        finalizationScores.length > 0
          ? finalizationScores.reduce((sum, item) => sum + item, 0) / finalizationScores.length
          : null,
      scoreCount: finalizationScores.length,
      byImplanter: finalizationByImplanter,
    },
    lostByImplanter: Array.from(lostByImplanter.values()).sort((a, b) => b.count - a.count || b.mrr - a.mrr),
    delinquency: {
      total: delinquentClients.length,
      byImplanter: Array.from(delinquencyByImplanter.values()).sort((a, b) => b.count - a.count || a.implanter.localeCompare(b.implanter)),
      source: delinquencyRows.length
        ? "lido da planilha 6 de resumo de clientes em implantação"
        : "envie a planilha 6 para preencher a inadimplência",
    },
  };
}

function isExecutiveRiskProject(project: ExecutiveUploadsData["openProjects"][number]): boolean {
  const bucket = classifyOpenProjectRiskBucket(project);
  return bucket === "parado" || bucket === "em-risco" || bucket === "necessita-acao" || bucket === "com-problemas";
}

function normalizePortfolioClass(value: string): "A" | "B" | "C" | "D" | "" {
  const normalized = normalize(value);
  if (normalized === "a" || normalized.includes("carteira a")) {
    return "A";
  }
  if (normalized === "b" || normalized.includes("carteira b")) {
    return "B";
  }
  if (normalized === "c" || normalized.includes("carteira c")) {
    return "C";
  }
  if (normalized === "d" || normalized.includes("carteira d")) {
    return "D";
  }
  return "";
}

function classifyPortfolioClass(project: ExecutiveUploadsData["openProjects"][number]): "A" | "B" | "C" | "D" | "" {
  if (project.contractValue >= 4799.64) {
    return "A";
  }
  if (project.contractValue >= 2264.8) {
    return "B";
  }
  if (project.contractValue >= 1105.4) {
    return "C";
  }
  if (project.contractValue >= 0) {
    return "D";
  }
  return normalizePortfolioClass(project.portfolioClass);
}

function classifyOpenProjectRisks(items: ExecutiveUploadsData["openProjects"]) {
  return items.reduce(
    (accumulator, item) => {
      const bucket = classifyOpenProjectRiskBucket(item);
      if (!bucket) {
        return accumulator;
      }
      if (bucket === "parado") {
        accumulator.parado += 1;
      } else if (bucket === "em-risco") {
        accumulator.emRisco += 1;
      } else if (bucket === "necessita-acao") {
        accumulator.necessitaAcao += 1;
      } else {
        accumulator.comProblemas += 1;
      }
      return accumulator;
    },
    { parado: 0, emRisco: 0, necessitaAcao: 0, comProblemas: 0 },
  );
}

function classifyRankedProjectRisks(projects: RankedProject[]) {
  return projects.reduce(
    (accumulator, project) => {
      const bucket = classifyRankedProjectRiskBucket(project);
      if (!bucket) {
        return accumulator;
      }
      if (bucket === "parado") {
        accumulator.parado += 1;
      } else if (bucket === "em-risco") {
        accumulator.emRisco += 1;
      } else if (bucket === "necessita-acao") {
        accumulator.necessitaAcao += 1;
      } else {
        accumulator.comProblemas += 1;
      }
      return accumulator;
    },
    { parado: 0, emRisco: 0, necessitaAcao: 0, comProblemas: 0 },
  );
}

function classifyOpenProjectRiskBucket(project: ExecutiveUploadsData["openProjects"][number]): RiskBucket {
  const status = normalize(project.status);
  const riskFactor = project.riskFactor.trim();

  if (status === "parado" || status.includes("parado")) {
    return "parado";
  }
  if (status === "necessita de acao" || status.includes("necessita de acao")) {
    return "necessita-acao";
  }
  if (status.includes("problemas") || riskFactor.length > 0) {
    return "com-problemas";
  }
  if (
    status === "critico" ||
    status === "em risco" ||
    status.includes("critico") ||
    status.includes("risco")
  ) {
    return "em-risco";
  }
  return null;
}

function classifyRankedProjectRiskBucket(project: RankedProject): RiskBucket {
  const workbookRisk = normalize(`${project.row.workbookRiskLabel ?? ""};${project.row.workbookRiskB2BLabel ?? ""}`);
  const inactivityDays = diffDays(project.row.lastActivityAt ?? null);

  if (hasStoppedProjectStatus(project.row.projectStatus) || inactivityDays >= 15) {
    return "parado";
  }
  if (hasCriticalProjectStatus(project.row.projectStatus) || project.priority === "Crítica" || isDelayedRankedProject(project)) {
    return "em-risco";
  }
  if (project.priority === "Alta" || project.row.pendingUsers > 0 || inactivityDays >= 7) {
    return "necessita-acao";
  }
  if (workbookRisk.length > 0) {
    return "com-problemas";
  }
  return null;
}

function isDelayedOpenProject(project: ExecutiveUploadsData["openProjects"][number]): boolean {
  const target = isMidImplanter(project.implanter) ? 90 : 60;
  return diffDays(project.kickOffDate) > target;
}

function isDelayedRankedProject(project: RankedProject): boolean {
  const target = isMidImplanter(project.row.implanter) ? 90 : 60;
  return getRankedProjectAgeDays(project) > target;
}

function isClosedRankedProject(project: RankedProject): boolean {
  const status = normalize(project.row.projectStatus);
  const phase = normalize(project.row.phase);
  return status.includes("encerr") || status.includes("conclu") || phase.includes("encerr");
}

function isLostRankedProject(project: RankedProject): boolean {
  const combined = normalize(`${project.row.projectStatus ?? ""};${project.row.workbookRiskLabel ?? ""};${project.row.workbookRiskB2BLabel ?? ""}`);
  return combined.includes("perdid") || combined.includes("cancel");
}

function getRankedProjectAgeDays(project: RankedProject): number {
  return diffDays(project.row.kickOffDate ?? project.row.createdAt ?? null);
}

function diffDays(date: Date | null): number {
  if (!date) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function isMidImplanter(implanter: string): boolean {
  const normalized = normalize(implanter);
  return normalized === "aline andrade" || normalized === "aline santos" || normalized === "maria marcos" || normalized === "maria";
}

function describeBucket(monthsOfLife: number): string {
  if (monthsOfLife <= 3) {
    return "ate 3 meses";
  }
  if (monthsOfLife <= 6) {
    return "ate 6 meses";
  }
  return "mais de 6 meses";
}

function normalize(value?: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateBR(value: Date | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("pt-BR").format(value);
}

function normalizeCancellationPhase(value: string): string {
  const normalized = normalize(value);
  if (normalized.includes("perdido")) {
    return "Perdido";
  }
  if (normalized.includes("implant")) {
    return "Implantação";
  }
  if (normalized.includes("acomp")) {
    return "Acompanhamento";
  }
  return value || "Fase não informada";
}

function MetricCard({
  label,
  value,
  detail,
  tone,
  compact = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone: "neutral" | "positive" | "warning" | "critical";
  compact?: boolean;
}): JSX.Element {
  const toneStyles =
    tone === "critical"
      ? { border: "#fecaca", accent: "#b91c1c", bg: "linear-gradient(180deg, #fff8f8 0%, #fff1f2 100%)" }
      : tone === "warning"
        ? { border: "#fed7aa", accent: "#c2410c", bg: "linear-gradient(180deg, #fffaf4 0%, #fff7ed 100%)" }
        : tone === "positive"
          ? { border: "#bbf7d0", accent: "#047857", bg: "linear-gradient(180deg, #f8fffb 0%, #ecfdf3 100%)" }
          : { border: "#dbe3f4", accent: "#1e3a5f", bg: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)" };

  return (
    <article
      style={{
        ...styles.metricCard,
        ...(compact ? styles.metricCardCompact : null),
        borderColor: toneStyles.border,
        background: toneStyles.bg,
        boxShadow: `inset 0 4px 0 ${toneStyles.accent}, 0 18px 34px rgba(15, 23, 42, 0.06)`,
      }}
    >
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
      <span style={styles.metricDetail}>{detail}</span>
    </article>
  );
}

function CancellationCard({
  title,
  count,
  mrr,
  helper,
}: {
  title: string;
  count: number;
  mrr: number;
  helper: string;
}): JSX.Element {
  return (
    <article style={styles.cancellationCard}>
      <span style={styles.cancellationTitle}>{title}</span>
      <strong style={styles.cancellationCount}>{count} projeto(s)</strong>
      <strong style={styles.cancellationMrr}>{formatCurrencyBRL(mrr)}</strong>
      <p style={styles.cancellationHelper}>{helper}</p>
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  issuePanel: {
    borderRadius: "20px",
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.04)",
    overflow: "hidden",
  },
  issueToggle: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    padding: "16px 18px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#0f172a",
    textAlign: "left",
  },
  issueToggleTitle: {
    fontWeight: 800,
    color: "#334155",
  },
  issueToggleMeta: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 700,
  },
  issueList: { display: "grid", gap: "10px" },
  issueItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid transparent",
    color: "#334155",
  },
  hero: { display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(280px, 0.9fr)", gap: "18px" },
  heroCopy: {
    padding: "28px 30px",
    borderRadius: "28px",
    background: "linear-gradient(135deg, rgba(10, 37, 64, 0.96) 0%, rgba(15, 66, 92, 0.92) 56%, rgba(11, 106, 98, 0.9) 100%)",
    color: "#f8fafc",
    boxShadow: "0 30px 60px rgba(15, 23, 42, 0.16)",
  },
  heroHighlight: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "28px",
    borderRadius: "28px",
    background: "linear-gradient(180deg, #fef7e7 0%, #fff1bf 100%)",
    border: "1px solid rgba(217, 119, 6, 0.18)",
    boxShadow: "0 24px 44px rgba(217, 119, 6, 0.12)",
  },
  heroLabel: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#9a6700", fontWeight: 800 },
  heroValue: { fontSize: "54px", lineHeight: 1, color: "#4a2a00" },
  heroMeta: { color: "#6b4f1d", lineHeight: 1.5, fontWeight: 600 },
  eyebrow: { margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "12px", fontWeight: 800, color: "rgba(255,255,255,0.72)" },
  title: { margin: "10px 0 12px", fontSize: "34px", lineHeight: 1.1, letterSpacing: "-0.03em" },
  subtitle: { margin: 0, maxWidth: "680px", lineHeight: 1.7, color: "rgba(248,250,252,0.78)" },
  topGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" },
  sectionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "18px" },
  panel: {
    padding: "24px",
    borderRadius: "26px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,249,255,0.98) 100%)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 24px 42px rgba(15, 23, 42, 0.06)",
  },
  panelHeader: { marginBottom: "18px" },
  panelEyebrow: { margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "11px", fontWeight: 800, color: "#0f766e" },
  panelTitle: { margin: "8px 0 0", fontSize: "24px", lineHeight: 1.2, color: "#0f172a" },
  metricGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" },
  metricCard: { display: "flex", flexDirection: "column", gap: "10px", minHeight: "168px", padding: "20px", borderRadius: "22px", border: "1px solid transparent" },
  metricCardCompact: { minHeight: "156px" },
  metricLabel: { color: "#475569", fontSize: "13px", lineHeight: 1.5, fontWeight: 700 },
  metricValue: { fontSize: "34px", lineHeight: 1.05, letterSpacing: "-0.03em", color: "#0f172a" },
  metricDetail: { marginTop: "auto", color: "#64748b", lineHeight: 1.5, fontSize: "13px" },
  cancellationGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" },
  cancellationCard: {
    padding: "22px",
    borderRadius: "24px",
    background: "linear-gradient(180deg, #fffaf4 0%, #fff4e7 100%)",
    border: "1px solid rgba(234, 179, 8, 0.18)",
    boxShadow: "0 20px 36px rgba(180, 83, 9, 0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  cancellationTitle: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#b45309", fontWeight: 800 },
  cancellationCount: { fontSize: "28px", color: "#3f2d0f" },
  cancellationMrr: { fontSize: "22px", color: "#7c2d12" },
  cancellationHelper: { margin: 0, color: "#7c6a52", lineHeight: 1.5 },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    padding: "16px 18px",
    borderRadius: "18px",
    background: "#ffffff",
    border: "1px solid rgba(148, 163, 184, 0.16)",
  },
  listTitle: { display: "block", color: "#0f172a", marginBottom: "4px" },
  listText: { margin: 0, color: "#64748b", lineHeight: 1.5 },
  listMeta: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", minWidth: "220px" },
  listBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#ecfdf3",
    color: "#047857",
    fontWeight: 800,
    border: "1px solid #86efac",
  },
  listReason: { color: "#7c2d12", textAlign: "right", lineHeight: 1.4, fontSize: "13px" },
  emptyList: { padding: "18px", borderRadius: "18px", background: "#ffffff", border: "1px dashed rgba(148, 163, 184, 0.3)", color: "#64748b" },
  emptyCard: { padding: "26px", borderRadius: "26px", background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,249,255,0.98) 100%)", border: "1px solid rgba(148, 163, 184, 0.18)" },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#ffffff",
    borderRadius: "18px",
    overflow: "hidden",
  },
  th: {
    textAlign: "left",
    padding: "12px 14px",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#475569",
    borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
    background: "#f8fafc",
  },
  tr: {
    borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
  },
  td: {
    padding: "12px 14px",
    color: "#0f172a",
    lineHeight: 1.4,
    verticalAlign: "top",
  },
};
