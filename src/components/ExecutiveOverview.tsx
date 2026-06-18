import { CSSProperties, useState } from "react";

import type { ExecutiveSaasMovementRow, ExecutiveUploadsData, RankedProject, UploadIssue } from "../types";
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

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <p style={styles.panelEyebrow}>Visão geral</p>
          <h3 style={styles.panelTitle}>Visão Geral da Implantação — Inbound</h3>
        </div>

        <div style={styles.metricGrid}>
          <MetricCard label="Projetos ativos" value={summary.totalProjects} detail={summary.totalProjectsSource} tone="neutral" compact />
          <MetricCard label="MRR total carteira" value={formatCurrencyBRL(summary.totalMrr)} detail={summary.totalMrrSource} tone="positive" compact />
          <MetricCard label="MRR Mid-market" value={formatCurrencyBRL(summary.midMarket.totalMrr)} detail={`${summary.midMarket.totalProjects} projeto(s)`} tone="neutral" compact />
          <MetricCard label="Saúde Mid-market" value={`${summary.midMarket.healthyRate}%`} detail={`${summary.midMarket.healthyProjects} saudável(is) • ${summary.midMarket.riskProjects} em risco`} tone={summary.midMarket.healthyRate >= 80 ? "positive" : "warning"} compact />
          <MetricCard label="MRR SMB" value={formatCurrencyBRL(summary.smb.totalMrr)} detail={`${summary.smb.totalProjects} projeto(s)`} tone="neutral" compact />
          <MetricCard label="Saúde SMB" value={`${summary.smb.healthyRate}%`} detail={`${summary.smb.healthyProjects} saudável(is) • ${summary.smb.riskProjects} em risco`} tone={summary.smb.healthyRate >= 80 ? "positive" : "warning"} compact />
          <MetricCard label="Projetos saudáveis" value={`${summary.healthyRate}%`} detail={`${summary.healthyProjects} saudável(is) • ${summary.totalRiskProjects} em risco`} tone={summary.healthyRate >= 80 ? "positive" : "warning"} compact />
        </div>

        <div style={{ ...styles.sectionGrid, marginTop: "18px" }}>
          <div style={styles.subPanel}>
            <strong style={styles.subPanelTitle}>Projetos por implanter</strong>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Implanter</th>
                    <th style={styles.th}>Proj</th>
                    <th style={styles.th}>MRR Total</th>
                    <th style={styles.th}>Em risco</th>
                    <th style={styles.th}>MRR risco</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.projectsByImplanter.map((row) => (
                    <tr key={row.implanter} style={styles.tr}>
                      <td style={styles.td}>{row.implanter}</td>
                      <td style={styles.td}>{row.totalProjects}</td>
                      <td style={styles.td}>{formatCurrencyBRL(row.totalMrr)}</td>
                      <td style={styles.td}>{row.riskProjects}</td>
                      <td style={styles.td}>{formatCurrencyBRL(row.riskMrr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={styles.subPanel}>
            <strong style={styles.subPanelTitle}>Carteiras — risco e saúde</strong>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Cart.</th>
                    <th style={styles.th}>Total</th>
                    <th style={styles.th}>MRR Total</th>
                    <th style={styles.th}>Em risco</th>
                    <th style={styles.th}>MRR risco</th>
                    <th style={styles.th}>% risco</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.portfolioBreakdown.map((row) => (
                    <tr key={row.portfolioClass} style={styles.tr}>
                      <td style={styles.td}>{row.portfolioClass}</td>
                      <td style={styles.td}>{row.totalProjects}</td>
                      <td style={styles.td}>{formatCurrencyBRL(row.totalMrr)}</td>
                      <td style={styles.td}>{row.riskProjects}</td>
                      <td style={styles.td}>{formatCurrencyBRL(row.riskMrr)}</td>
                      <td style={styles.td}>{row.riskRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <p style={styles.panelEyebrow}>Cancelamentos</p>
          <h3 style={styles.panelTitle}>Cancelamentos — Total e implantação</h3>
        </div>

        <div style={styles.metricGrid}>
          <MetricCard label="Cancelamentos implantação" value={summary.totalCancellationProjects} detail="eventos SaaS de Inbound com Responsável CS implanter" tone="critical" compact />
          <MetricCard label="MRR cancelamento implantação" value={formatCurrencyBRL(summary.totalCancellationMrr)} detail="soma do Valor Cancelled no Metrics" tone="critical" compact />
          <MetricCard label="Ticket médio" value={formatCurrencyBRL(summary.averageCancellationTicket)} detail="MRR médio por cancelamento de implantação" tone="warning" compact />
        </div>

        <div style={{ ...styles.list, marginTop: "18px" }}>
          <strong style={styles.subPanelTitle}>Clientes cancelados</strong>
          {summary.topCancellationAccounts.length > 0 ? (
            summary.topCancellationAccounts.map((item) => (
              <article key={`${item.companyCode}-${item.contract}-${item.referenceMonth}`} style={styles.listItem}>
                <div>
                  <strong style={styles.listTitle}>
                    {item.companyCode ? `Cliente ${item.companyCode}` : `Contrato ${item.contract}`}
                  </strong>
                  <p style={styles.listText}>
                    1a receita: {formatDateBR(item.firstRevenueAt)} • Implanter: {item.responsibleCs || "Sem responsável"}
                  </p>
                </div>
                <span style={styles.listBadge}>{formatCurrencyBRL(item.value)}</span>
              </article>
            ))
          ) : (
            <div style={styles.emptyList}>Suba a planilha SaaS cancelamento para listar os cancelamentos da implantação.</div>
          )}
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <p style={styles.panelEyebrow}>Resultados</p>
          <h3 style={styles.panelTitle}>Projetos Concluídos e Perdidos</h3>
        </div>

        <div style={styles.metricGrid}>
          <MetricCard label="Total fechados" value={summary.closedLost.total} detail="concluídos + perdidos" tone="neutral" compact />
          <MetricCard label="Concluídos" value={summary.closedLost.closed} detail="projetos concluídos com sucesso" tone="positive" compact />
          <MetricCard label="Perdidos" value={summary.closedLost.lost} detail="perdidos / não concluídos" tone="critical" compact />
          <MetricCard label="Taxa de sucesso" value={`${summary.closedLost.successRate}%`} detail="concluídos sobre total fechado" tone={summary.closedLost.successRate >= 75 ? "positive" : "warning"} compact />
        </div>

        <div style={{ ...styles.sectionGrid, marginTop: "18px" }}>
          <div style={styles.subPanel}>
            <strong style={styles.subPanelTitle}>Detalhamento por implanter</strong>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Implanter</th>
                    <th style={styles.th}>Concluídos</th>
                    <th style={styles.th}>Perdidos</th>
                    <th style={styles.th}>Total</th>
                    <th style={styles.th}>Nota média</th>
                    <th style={styles.th}>Taxa sucesso</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.closedLost.byImplanter.map((row) => (
                    <tr key={row.implanter} style={styles.tr}>
                      <td style={styles.td}>{row.implanter}</td>
                      <td style={styles.td}>{row.closed}</td>
                      <td style={styles.td}>{row.lost}</td>
                      <td style={styles.td}>{row.total}</td>
                      <td style={styles.td}>{row.averageScore !== null ? row.averageScore.toFixed(1) : "-"}</td>
                      <td style={styles.td}>{row.successRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={styles.subPanel}>
            <strong style={styles.subPanelTitle}>Voz do cliente na conclusão</strong>
            <div style={styles.list}>
              {summary.voiceOfCustomer.length > 0 ? (
                summary.voiceOfCustomer.map((row) => (
                  <article key={`${row.clientName}-${row.projectName}`} style={styles.listItem}>
                    <div>
                      <strong style={styles.listTitle}>{row.clientName}</strong>
                      <p style={styles.listText}>{row.implanter || "Sem implanter"} • Cart. {row.portfolioClass || "-"}</p>
                      <p style={styles.listText}>{row.finalizationNote}</p>
                    </div>
                    <span style={styles.listBadge}>{row.finalizationScore ?? "-"}</span>
                  </article>
                ))
              ) : (
                <div style={styles.emptyList}>Suba a planilha de nota de finalização para ver a voz do cliente.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <p style={styles.panelEyebrow}>Retenção SaaS</p>
          <h3 style={styles.panelTitle}>MRR total e MRR da implantação</h3>
        </div>

        <div style={styles.metricGrid}>
          <MetricCard
            label="MRR cancelamento total"
            value={formatCurrencyBRL(summary.saasRetention.cancellation.totalValue)}
            detail={`${summary.saasRetention.cancellation.totalCount} evento(s) em Inbound`}
            tone={summary.saasRetention.cancellation.totalValue > 0 ? "critical" : "neutral"}
            compact
          />
          <MetricCard
            label="MRR cancelamento implantação"
            value={formatCurrencyBRL(summary.saasRetention.cancellation.implantationValue)}
            detail={`${summary.saasRetention.cancellation.implantationCount} evento(s) com Responsável CS dos implanters`}
            tone={summary.saasRetention.cancellation.implantationValue > 0 ? "critical" : "neutral"}
            compact
          />
          <MetricCard
            label="MRR contraction total"
            value={formatCurrencyBRL(summary.saasRetention.contraction.totalValue)}
            detail={`${summary.saasRetention.contraction.totalCount} evento(s) em Inbound`}
            tone={summary.saasRetention.contraction.totalValue > 0 ? "warning" : "neutral"}
            compact
          />
          <MetricCard
            label="MRR contraction implantação"
            value={formatCurrencyBRL(summary.saasRetention.contraction.implantationValue)}
            detail={`${summary.saasRetention.contraction.implantationCount} evento(s) com Responsável CS dos implanters`}
            tone={summary.saasRetention.contraction.implantationValue > 0 ? "warning" : "neutral"}
            compact
          />
          <MetricCard
            label="MRR expansão total"
            value={formatCurrencyBRL(summary.saasRetention.expansion.totalValue)}
            detail={`${summary.saasRetention.expansion.totalCount} evento(s) em Inbound`}
            tone={summary.saasRetention.expansion.totalValue > 0 ? "positive" : "neutral"}
            compact
          />
          <MetricCard
            label="MRR expansão implantação"
            value={formatCurrencyBRL(summary.saasRetention.expansion.implantationValue)}
            detail={`${summary.saasRetention.expansion.implantationCount} evento(s) com Responsável CS dos implanters`}
            tone={summary.saasRetention.expansion.implantationValue > 0 ? "positive" : "neutral"}
            compact
          />
        </div>

        <div style={{ ...styles.sectionGrid, marginTop: "18px" }}>
          <SaasImplantationMovementList
            title="Cancelamentos da implantação"
            rows={summary.saasRetention.implantationLists.cancellation}
            emptyText="Nenhum cancelamento de implantação encontrado."
            tone="critical"
          />
          <SaasImplantationMovementList
            title="Contractions da implantação"
            rows={summary.saasRetention.implantationLists.contraction}
            emptyText="Nenhuma contraction de implantação encontrada."
            tone="warning"
          />
          <SaasImplantationMovementList
            title="Expansões da implantação"
            rows={summary.saasRetention.implantationLists.expansion}
            emptyText="Nenhuma expansão de implantação encontrada."
            tone="positive"
          />
        </div>

      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <p style={styles.panelEyebrow}>Carteiras A e B</p>
          <h3 style={styles.panelTitle}>Saúde, risco e cancelamentos</h3>
        </div>

        <div style={styles.metricGrid}>
          <MetricCard label="Projetos A" value={summary.portfolioA.totalProjects} detail={formatCurrencyBRL(summary.portfolioA.totalMrr)} tone="positive" compact />
          <MetricCard label="Saúde A" value={`${summary.portfolioA.healthyRate}%`} detail={`${summary.portfolioA.riskProjects} em risco`} tone={summary.portfolioA.healthyRate >= 80 ? "positive" : "warning"} compact />
          <MetricCard label="Risco A" value={summary.portfolioA.riskProjects} detail={`${formatCurrencyBRL(summary.portfolioA.riskMrr)} em risco`} tone={summary.portfolioA.riskProjects > 0 ? "critical" : "neutral"} compact />
          <MetricCard label="Projetos B" value={summary.portfolioB.totalProjects} detail={formatCurrencyBRL(summary.portfolioB.totalMrr)} tone="neutral" compact />
          <MetricCard label="Saúde B" value={`${summary.portfolioB.healthyRate}%`} detail={`${summary.portfolioB.riskProjects} em risco`} tone={summary.portfolioB.healthyRate >= 80 ? "positive" : "warning"} compact />
          <MetricCard label="Risco B" value={summary.portfolioB.riskProjects} detail={`${formatCurrencyBRL(summary.portfolioB.riskMrr)} em risco`} tone={summary.portfolioB.riskProjects > 0 ? "critical" : "neutral"} compact />
        </div>

        <div style={{ ...styles.sectionGrid, marginTop: "18px" }}>
          <div style={styles.subPanel}>
            <strong style={styles.subPanelTitle}>Clientes A e B em risco</strong>
            <div style={styles.tableWrap}>
              {summary.portfolioRiskClients.length > 0 ? (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Cliente</th>
                      <th style={styles.th}>Cart.</th>
                      <th style={styles.th}>MRR</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Implanter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.portfolioRiskClients.map((item) => (
                      <tr key={`${item.clientName}-${item.projectName}`} style={styles.tr}>
                        <td style={styles.td}>{item.clientName}</td>
                        <td style={styles.td}>{item.portfolioClass}</td>
                        <td style={styles.td}>{formatCurrencyBRL(item.mrr)}</td>
                        <td style={styles.td}>{item.status || "Sem status"}</td>
                        <td style={styles.td}>{item.implanter || "Sem implanter"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={styles.emptyList}>Nenhum cliente das carteiras A e B em risco.</div>
              )}
            </div>
          </div>

          <div style={styles.subPanel}>
            <strong style={styles.subPanelTitle}>Clientes acima de R$ 6 mil</strong>
            <div style={styles.list}>
              {summary.highMrrClients.length > 0 ? (
                summary.highMrrClients.map((item) => (
                  <article key={`${item.clientName}-${item.projectName}`} style={styles.listItem}>
                    <div>
                      <strong style={styles.listTitle}>{item.clientName}</strong>
                      <p style={styles.listText}>
                        Cart. {item.portfolioClass} • {item.implanter || "Sem implanter"} • {item.status || "Sem status"}
                      </p>
                    </div>
                    <div style={styles.listMeta}>
                      <span style={item.isRisk ? styles.riskBadge : styles.healthyBadge}>
                        {item.isRisk ? "Em risco" : "Saudável"}
                      </span>
                      <span style={styles.listBadge}>{formatCurrencyBRL(item.mrr)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <div style={styles.emptyList}>Nenhum cliente com MRR acima de R$ 6 mil.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div style={{ display: "none" }}>
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

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <p style={styles.panelEyebrow}>Retenção SaaS</p>
          <h3 style={styles.panelTitle}>Cancelamento, expansão e contraction por implantação</h3>
        </div>

        <div style={styles.metricGrid}>
          <MetricCard
            label="Cancelamento total"
            value={formatCurrencyBRL(summary.saasRetention.cancellation.totalValue)}
            detail={`${summary.saasRetention.cancellation.totalCount} evento(s) • implantação ${formatCurrencyBRL(summary.saasRetention.cancellation.implantationValue)}`}
            tone={summary.saasRetention.cancellation.totalValue > 0 ? "critical" : "neutral"}
            compact
          />
          <MetricCard
            label="Cancelamento implantação"
            value={formatCurrencyBRL(summary.saasRetention.cancellation.implantationValue)}
            detail={`${summary.saasRetention.cancellation.implantationCount} evento(s) com Responsável CS dos implanters`}
            tone={summary.saasRetention.cancellation.implantationValue > 0 ? "critical" : "neutral"}
            compact
          />
          <MetricCard
            label="Expansão total"
            value={formatCurrencyBRL(summary.saasRetention.expansion.totalValue)}
            detail={`${summary.saasRetention.expansion.totalCount} evento(s) • implantação ${formatCurrencyBRL(summary.saasRetention.expansion.implantationValue)}`}
            tone={summary.saasRetention.expansion.totalValue > 0 ? "positive" : "neutral"}
            compact
          />
          <MetricCard
            label="Expansão implantação"
            value={formatCurrencyBRL(summary.saasRetention.expansion.implantationValue)}
            detail={`${summary.saasRetention.expansion.implantationCount} evento(s) com Responsável CS dos implanters`}
            tone={summary.saasRetention.expansion.implantationValue > 0 ? "positive" : "neutral"}
            compact
          />
          <MetricCard
            label="Contraction total"
            value={formatCurrencyBRL(summary.saasRetention.contraction.totalValue)}
            detail={`${summary.saasRetention.contraction.totalCount} evento(s) • implantação ${formatCurrencyBRL(summary.saasRetention.contraction.implantationValue)}`}
            tone={summary.saasRetention.contraction.totalValue > 0 ? "warning" : "neutral"}
            compact
          />
          <MetricCard
            label="Saldo líquido implantação"
            value={formatCurrencyBRL(summary.saasRetention.implantationNetMrr)}
            detail="expansão - contraction - cancelamento dos nomes dos implanters"
            tone={summary.saasRetention.implantationNetMrr >= 0 ? "positive" : "critical"}
            compact
          />
        </div>

        <div style={{ ...styles.sectionGrid, marginTop: "18px" }}>
          <div style={styles.subPanel}>
            <strong style={styles.subPanelTitle}>Movimento por mês</strong>
            <div style={styles.tableWrap}>
              {summary.saasRetention.byMonth.length > 0 ? (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Mês</th>
                      <th style={styles.th}>Expansão</th>
                      <th style={styles.th}>Contraction</th>
                      <th style={styles.th}>Cancelamento</th>
                      <th style={styles.th}>Saldo</th>
                      <th style={styles.th}>Saldo implantação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.saasRetention.byMonth.map((row) => (
                      <tr key={row.key} style={styles.tr}>
                        <td style={styles.td}>{row.label}</td>
                        <td style={styles.td}>{formatCurrencyBRL(row.expansion)}</td>
                        <td style={styles.td}>{formatCurrencyBRL(row.contraction)}</td>
                        <td style={styles.td}>{formatCurrencyBRL(row.cancellation)}</td>
                        <td style={styles.td}>{formatCurrencyBRL(row.net)}</td>
                        <td style={styles.td}>{formatCurrencyBRL(row.implantationNet)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={styles.emptyList}>Suba as três planilhas SaaS para preencher retenção.</div>
              )}
            </div>
          </div>

          <div style={styles.subPanel}>
            <strong style={styles.subPanelTitle}>Responsável CS da implantação</strong>
            <div style={styles.tableWrap}>
              {summary.saasRetention.byResponsible.length > 0 ? (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Responsável</th>
                      <th style={styles.th}>Expansão</th>
                      <th style={styles.th}>Contraction</th>
                      <th style={styles.th}>Cancelamento</th>
                      <th style={styles.th}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.saasRetention.byResponsible.map((row) => (
                      <tr key={row.responsible} style={styles.tr}>
                        <td style={styles.td}>{row.responsible}</td>
                        <td style={styles.td}>{formatCurrencyBRL(row.expansion)}</td>
                        <td style={styles.td}>{formatCurrencyBRL(row.contraction)}</td>
                        <td style={styles.td}>{formatCurrencyBRL(row.cancellation)}</td>
                        <td style={styles.td}>{formatCurrencyBRL(row.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={styles.emptyList}>Nenhum movimento SaaS com Responsável CS da implantação.</div>
              )}
            </div>
          </div>
        </div>
      </section>

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
              <article key={`${item.companyCode}-${item.contract}-${item.referenceMonth}`} style={styles.listItem}>
                <div>
                  <strong style={styles.listTitle}>
                    {item.companyCode ? `Cliente ${item.companyCode}` : `Contrato ${item.contract}`}
                  </strong>
                  <p style={styles.listText}>
                    1a receita: {formatDateBR(item.firstRevenueAt)} • {item.responsibleCs || "Sem responsável"}
                  </p>
                </div>
                <div style={styles.listMeta}>
                  <span style={styles.listBadge}>{formatCurrencyBRL(item.value)}</span>
                  <span style={styles.listReason}>{item.referenceMonth}</span>
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
      </div>
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
  const portfolioRiskClients = [...portfolioARiskProjects, ...portfolioBRiskProjects]
    .map((item) => ({
      clientName: item.clientName,
      projectName: item.projectName,
      implanter: item.implanter,
      status: item.status,
      portfolioClass: classifyPortfolioClass(item),
      mrr: Math.max(item.contractValue, 0),
    }))
    .sort((a, b) => b.mrr - a.mrr || a.clientName.localeCompare(b.clientName));
  const highMrrClients = openProjects
    .filter((item) => Math.max(item.contractValue, 0) >= 6000)
    .map((item) => ({
      clientName: item.clientName,
      projectName: item.projectName,
      implanter: item.implanter,
      status: item.status,
      portfolioClass: classifyPortfolioClass(item),
      mrr: Math.max(item.contractValue, 0),
      isRisk: isExecutiveRiskProject(item),
    }))
    .sort((a, b) => b.mrr - a.mrr || a.clientName.localeCompare(b.clientName));
  const healthyProjects = Math.max(totalProjects - (
    openProjectsRisk.parado +
    openProjectsRisk.emRisco +
    openProjectsRisk.necessitaAcao +
    openProjectsRisk.comProblemas
  ), 0);
  const totalRiskProjects =
    openProjectsRisk.parado +
    openProjectsRisk.emRisco +
    openProjectsRisk.necessitaAcao +
    openProjectsRisk.comProblemas;
  const healthyRate = totalProjects > 0 ? Math.round((healthyProjects / totalProjects) * 100) : 0;
  const midMarketProjects = openProjects.filter((item) => isMidImplanter(item.implanter));
  const smbProjects = openProjects.filter((item) => !isMidImplanter(item.implanter));
  const midMarketRiskProjects = midMarketProjects.filter(isExecutiveRiskProject);
  const smbRiskProjects = smbProjects.filter(isExecutiveRiskProject);
  const midMarketHealthyProjects = Math.max(midMarketProjects.length - midMarketRiskProjects.length, 0);
  const smbHealthyProjects = Math.max(smbProjects.length - smbRiskProjects.length, 0);
  const projectsByImplanter = buildProjectsByImplanter(openProjects);
  const portfolioBreakdown = buildPortfolioBreakdown(openProjects);

  const newProjects = executiveData?.newProjects.length ?? projects.filter((project) => getRankedProjectAgeDays(project) <= 30).length;
  const closedProjects = executiveData?.closedProjects.length ?? projects.filter(isClosedRankedProject).length;
  const lostProjects = executiveData?.lostProjects.length ?? projects.filter(isLostRankedProject).length;
  const lostMrr = executiveData?.lostProjects.length
    ? executiveData.lostProjects.reduce((sum, row) => sum + Math.max(row.contractValue, 0), 0)
    : projects.filter(isLostRankedProject).reduce((sum, project) => sum + Math.max(project.row.amountPaid ?? 0, 0), 0);

  const cancellationProjects = executiveData?.cancellationProjects ?? [];
  const implantationCancellationRows = (executiveData?.saasCancellation ?? []).filter(
    (item) => item.isImplantation,
  );
  const totalCancellationProjects = implantationCancellationRows.length;
  const totalCancellationMrr = implantationCancellationRows.reduce(
    (sum, item) => sum + item.value,
    0,
  );
  const cancellationPhaseGroups = buildCancellationPhaseGroups(cancellationProjects);
  const saasRetention = buildSaasRetentionSummary(
    executiveData?.saasCancellation ?? [],
    executiveData?.saasExpansion ?? [],
    executiveData?.saasContraction ?? [],
  );
  const postConclusionCancellations = buildPostConclusionCancellations(
    executiveData?.closedProjects ?? [],
    executiveData?.saasCancellation ?? [],
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
  const closedLost = buildClosedLostSummary(executiveData?.closedProjects ?? [], executiveData?.lostProjects ?? []);
  const voiceOfCustomer = (executiveData?.closedProjects ?? [])
    .filter((item) => item.finalizationNote.trim().length > 0 || item.finalizationScore !== null)
    .sort((a, b) => (b.finalizationScore ?? 0) - (a.finalizationScore ?? 0) || a.clientName.localeCompare(b.clientName))
    .slice(0, 6);
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
    totalRiskProjects,
    healthyProjects,
    healthyRate,
    midMarket: {
      totalProjects: midMarketProjects.length,
      totalMrr: midMarketProjects.reduce((sum, item) => sum + Math.max(item.contractValue, 0), 0),
      healthyProjects: midMarketHealthyProjects,
      riskProjects: midMarketRiskProjects.length,
      healthyRate: midMarketProjects.length > 0 ? Math.round((midMarketHealthyProjects / midMarketProjects.length) * 100) : 0,
    },
    smb: {
      totalProjects: smbProjects.length,
      totalMrr: smbProjects.reduce((sum, item) => sum + Math.max(item.contractValue, 0), 0),
      healthyProjects: smbHealthyProjects,
      riskProjects: smbRiskProjects.length,
      healthyRate: smbProjects.length > 0 ? Math.round((smbHealthyProjects / smbProjects.length) * 100) : 0,
    },
    projectsByImplanter,
    portfolioBreakdown,
    portfolioRiskClients,
    highMrrClients,
    riskBreakdown: openProjectsRisk,
    delayedProjects,
    riskMrr,
    portfolioA: {
      totalProjects: portfolioAProjects.length,
      totalMrr: portfolioAProjects.reduce((sum, item) => sum + Math.max(item.contractValue, 0), 0),
      riskProjects: portfolioARiskProjects.length,
      riskMrr: portfolioARiskProjects.reduce((sum, item) => sum + Math.max(item.contractValue, 0), 0),
      healthyRate: portfolioAProjects.length > 0 ? Math.round(((portfolioAProjects.length - portfolioARiskProjects.length) / portfolioAProjects.length) * 100) : 0,
    },
    portfolioB: {
      totalProjects: portfolioBProjects.length,
      totalMrr: portfolioBProjects.reduce((sum, item) => sum + Math.max(item.contractValue, 0), 0),
      riskProjects: portfolioBRiskProjects.length,
      riskMrr: portfolioBRiskProjects.reduce((sum, item) => sum + Math.max(item.contractValue, 0), 0),
      healthyRate: portfolioBProjects.length > 0 ? Math.round(((portfolioBProjects.length - portfolioBRiskProjects.length) / portfolioBProjects.length) * 100) : 0,
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
    averageCancellationTicket: totalCancellationProjects > 0 ? totalCancellationMrr / totalCancellationProjects : 0,
    cancellationPhaseGroups,
    postConclusionCancellations,
    saasRetention,
    cancellationBuckets,
    cancellationSource: (executiveData?.saasCancellation.length ?? 0) > 0
      ? "lido da planilha SaaS cancelamento do Metrics"
      : "envie a planilha SaaS cancelamento para preencher esta visão",
    topCancellationAccounts: implantationCancellationRows.slice().sort((a, b) => b.value - a.value).slice(0, 10),
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
    closedLost,
    voiceOfCustomer,
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

function buildProjectsByImplanter(openProjects: ExecutiveUploadsData["openProjects"]) {
  return Array.from(
    openProjects.reduce<
      Map<string, { implanter: string; totalProjects: number; totalMrr: number; riskProjects: number; riskMrr: number }>
    >((accumulator, project) => {
      const implanter = project.implanter || "Sem implanter";
      const current = accumulator.get(implanter) ?? {
        implanter,
        totalProjects: 0,
        totalMrr: 0,
        riskProjects: 0,
        riskMrr: 0,
      };
      const mrr = Math.max(project.contractValue, 0);
      current.totalProjects += 1;
      current.totalMrr += mrr;
      if (isExecutiveRiskProject(project)) {
        current.riskProjects += 1;
        current.riskMrr += mrr;
      }
      accumulator.set(implanter, current);
      return accumulator;
    }, new Map()).values(),
  ).sort((a, b) => b.riskMrr - a.riskMrr || b.riskProjects - a.riskProjects || a.implanter.localeCompare(b.implanter));
}

function buildPortfolioBreakdown(openProjects: ExecutiveUploadsData["openProjects"]) {
  return ["A", "B", "C", "D"].map((portfolioClass) => {
    const rows = openProjects.filter((project) => classifyPortfolioClass(project) === portfolioClass);
    const riskRows = rows.filter(isExecutiveRiskProject);
    const totalMrr = rows.reduce((sum, project) => sum + Math.max(project.contractValue, 0), 0);
    const riskMrr = riskRows.reduce((sum, project) => sum + Math.max(project.contractValue, 0), 0);
    return {
      portfolioClass,
      totalProjects: rows.length,
      totalMrr,
      riskProjects: riskRows.length,
      riskMrr,
      riskRate: rows.length > 0 ? Math.round((riskRows.length / rows.length) * 100) : 0,
    };
  });
}

function buildCancellationPhaseGroups(cancellationProjects: ExecutiveUploadsData["cancellationProjects"]) {
  return cancellationProjects.reduce(
    (accumulator, project) => {
      const phase = normalize(project.phase);
      const target = phase.includes("perdido")
        ? accumulator.lost
        : phase.includes("implant")
          ? accumulator.active
          : accumulator.portfolio;
      target.count += 1;
      target.mrr += project.cancellationMrr;
      return accumulator;
    },
    {
      active: { count: 0, mrr: 0 },
      lost: { count: 0, mrr: 0 },
      portfolio: { count: 0, mrr: 0 },
    },
  );
}

function buildPostConclusionCancellations(
  closedProjects: ExecutiveUploadsData["closedProjects"],
  cancellationRows: ExecutiveUploadsData["saasCancellation"],
) {
  const closedByKey = new Map<string, ExecutiveUploadsData["closedProjects"]>();
  closedProjects.forEach((project) => {
    const keys = [
      project.accountCode,
      normalize(project.clientName),
    ].filter(Boolean);
    keys.forEach((key) => {
      const current = closedByKey.get(key) ?? [];
      current.push(project);
      closedByKey.set(key, current);
    });
  });

  const rows = cancellationRows.reduce<
    Array<{
      clientName: string;
      implanter: string;
      closedAt: Date | null;
      cancellationMonth: string;
      value: number;
      monthsAfter: number;
      isImplantation: boolean;
    }>
  >((accumulator, cancellation) => {
    const cancellationDate = cancellation.referenceDate;
    if (!cancellationDate) {
      return accumulator;
    }

    const keys = [
      cancellation.companyCode,
      cancellation.contract,
      normalize(cancellation.contract),
    ].filter(Boolean);
    const candidates = keys.flatMap((key) => closedByKey.get(key) ?? []);
    const matchedProject = candidates
      .filter((project) => project.closedAt && project.closedAt <= cancellationDate && addMonths(project.closedAt, 6) >= cancellationDate)
      .sort((a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0))[0];

    if (!matchedProject?.closedAt) {
      return accumulator;
    }

    accumulator.push({
      clientName: matchedProject.clientName,
      implanter: matchedProject.implanter,
      closedAt: matchedProject.closedAt,
      cancellationMonth: cancellation.referenceMonth,
      value: cancellation.value,
      monthsAfter: diffCalendarMonths(matchedProject.closedAt, cancellationDate),
      isImplantation: cancellation.isImplantation,
    });
    return accumulator;
  }, []);

  const sortedRows = rows.sort((a, b) => b.value - a.value || a.clientName.localeCompare(b.clientName));
  return {
    count: rows.length,
    mrr: rows.reduce((sum, item) => sum + item.value, 0),
    implantationCount: rows.filter((item) => item.isImplantation).length,
    implantationMrr: rows.filter((item) => item.isImplantation).reduce((sum, item) => sum + item.value, 0),
    rows: sortedRows.slice(0, 8),
  };
}

function buildClosedLostSummary(
  closedProjects: ExecutiveUploadsData["closedProjects"],
  lostProjects: ExecutiveUploadsData["lostProjects"],
) {
  const byImplanter = new Map<
    string,
    { implanter: string; closed: number; lost: number; total: number; scoreTotal: number; scoreCount: number }
  >();

  closedProjects.forEach((project) => {
    const implanter = project.implanter || "Sem implanter";
    const current = byImplanter.get(implanter) ?? {
      implanter,
      closed: 0,
      lost: 0,
      total: 0,
      scoreTotal: 0,
      scoreCount: 0,
    };
    current.closed += 1;
    current.total += 1;
    if (project.finalizationScore !== null) {
      current.scoreTotal += project.finalizationScore;
      current.scoreCount += 1;
    }
    byImplanter.set(implanter, current);
  });

  lostProjects.forEach((project) => {
    const implanter = project.implanter || "Sem implanter";
    const current = byImplanter.get(implanter) ?? {
      implanter,
      closed: 0,
      lost: 0,
      total: 0,
      scoreTotal: 0,
      scoreCount: 0,
    };
    current.lost += 1;
    current.total += 1;
    byImplanter.set(implanter, current);
  });

  const closed = closedProjects.length;
  const lost = lostProjects.length;
  const total = closed + lost;

  return {
    closed,
    lost,
    total,
    successRate: total > 0 ? Math.round((closed / total) * 100) : 0,
    byImplanter: Array.from(byImplanter.values())
      .map((item) => ({
        implanter: item.implanter,
        closed: item.closed,
        lost: item.lost,
        total: item.total,
        averageScore: item.scoreCount > 0 ? item.scoreTotal / item.scoreCount : null,
        successRate: item.total > 0 ? Math.round((item.closed / item.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total || a.implanter.localeCompare(b.implanter)),
  };
}

function buildSaasRetentionSummary(
  cancellationRows: ExecutiveUploadsData["saasCancellation"],
  expansionRows: ExecutiveUploadsData["saasExpansion"],
  contractionRows: ExecutiveUploadsData["saasContraction"],
) {
  const cancellation = summarizeSaasMovement(cancellationRows);
  const expansion = summarizeSaasMovement(expansionRows);
  const contraction = summarizeSaasMovement(contractionRows);
  const byMonth = buildSaasMonthlyRows(cancellationRows, expansionRows, contractionRows);
  const byResponsible = buildSaasResponsibleRows(cancellationRows, expansionRows, contractionRows);

  return {
    cancellation,
    expansion,
    contraction,
    totalNetMrr: expansion.totalValue - contraction.totalValue - cancellation.totalValue,
    implantationNetMrr: expansion.implantationValue - contraction.implantationValue - cancellation.implantationValue,
    baseNetMrr: expansion.baseValue - contraction.baseValue - cancellation.baseValue,
    byMonth,
    byResponsible,
    implantationLists: {
      cancellation: buildImplantationMovementList(cancellationRows),
      expansion: buildImplantationMovementList(expansionRows),
      contraction: buildImplantationMovementList(contractionRows),
    },
  };
}

function buildImplantationMovementList(rows: ExecutiveSaasMovementRow[]) {
  return rows
    .filter((row) => row.isImplantation)
    .sort((a, b) => b.value - a.value || a.responsibleCs.localeCompare(b.responsibleCs))
    .slice(0, 12);
}

function summarizeSaasMovement(rows: ExecutiveUploadsData["saasCancellation"]) {
  const result = rows.reduce(
    (accumulator, row) => {
      accumulator.totalCount += 1;
      accumulator.totalValue += row.value;
      if (row.isImplantation) {
        accumulator.implantationCount += 1;
        accumulator.implantationValue += row.value;
      } else {
        accumulator.baseCount += 1;
        accumulator.baseValue += row.value;
      }
      return accumulator;
    },
    {
      totalCount: 0,
      totalValue: 0,
      implantationCount: 0,
      implantationValue: 0,
      baseCount: 0,
      baseValue: 0,
    },
  );
  return {
    ...result,
    averageTicket: result.totalCount > 0 ? result.totalValue / result.totalCount : 0,
  };
}

function buildSaasMonthlyRows(
  cancellationRows: ExecutiveUploadsData["saasCancellation"],
  expansionRows: ExecutiveUploadsData["saasExpansion"],
  contractionRows: ExecutiveUploadsData["saasContraction"],
) {
  const monthly = new Map<
    string,
    {
      key: string;
      label: string;
      timestamp: number;
      cancellation: number;
      contraction: number;
      expansion: number;
      implantationCancellation: number;
      implantationContraction: number;
      implantationExpansion: number;
    }
  >();

  const addRows = (
    rows: ExecutiveUploadsData["saasCancellation"],
    field: "cancellation" | "contraction" | "expansion",
    implantationField: "implantationCancellation" | "implantationContraction" | "implantationExpansion",
  ) => {
    rows.forEach((row) => {
      const key = row.referenceDate
        ? `${row.referenceDate.getFullYear()}-${String(row.referenceDate.getMonth() + 1).padStart(2, "0")}`
        : row.referenceMonth;
      const current =
        monthly.get(key) ?? {
          key,
          label: row.referenceMonth || key,
          timestamp: row.referenceDate?.getTime() ?? 0,
          cancellation: 0,
          contraction: 0,
          expansion: 0,
          implantationCancellation: 0,
          implantationContraction: 0,
          implantationExpansion: 0,
        };
      current[field] += row.value;
      if (row.isImplantation) {
        current[implantationField] += row.value;
      }
      monthly.set(key, current);
    });
  };

  addRows(cancellationRows, "cancellation", "implantationCancellation");
  addRows(expansionRows, "expansion", "implantationExpansion");
  addRows(contractionRows, "contraction", "implantationContraction");

  return Array.from(monthly.values())
    .map((row) => ({
      ...row,
      net: row.expansion - row.contraction - row.cancellation,
      implantationNet: row.implantationExpansion - row.implantationContraction - row.implantationCancellation,
    }))
    .sort((a, b) => b.timestamp - a.timestamp || b.key.localeCompare(a.key))
    .slice(0, 12);
}

function buildSaasResponsibleRows(
  cancellationRows: ExecutiveUploadsData["saasCancellation"],
  expansionRows: ExecutiveUploadsData["saasExpansion"],
  contractionRows: ExecutiveUploadsData["saasContraction"],
) {
  const responsible = new Map<string, { responsible: string; cancellation: number; contraction: number; expansion: number }>();

  const addRows = (
    rows: ExecutiveUploadsData["saasCancellation"],
    field: "cancellation" | "contraction" | "expansion",
  ) => {
    rows
      .filter((row) => row.isImplantation)
      .forEach((row) => {
        const key = row.responsibleCs || "Sem responsável";
        const current = responsible.get(key) ?? { responsible: key, cancellation: 0, contraction: 0, expansion: 0 };
        current[field] += row.value;
        responsible.set(key, current);
      });
  };

  addRows(cancellationRows, "cancellation");
  addRows(expansionRows, "expansion");
  addRows(contractionRows, "contraction");

  return Array.from(responsible.values())
    .map((row) => ({
      ...row,
      net: row.expansion - row.contraction - row.cancellation,
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || b.cancellation - a.cancellation || a.responsible.localeCompare(b.responsible));
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

  if (isDelayedOpenProject(project)) {
    return "em-risco";
  }
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
  const target = project.plannedProjectDays ?? (isMidImplanter(project.implanter) ? 90 : 60);
  if (project.projectDurationDays !== null && project.projectDurationDays !== undefined) {
    return project.projectDurationDays > target;
  }
  return diffDays(project.kickOffDate) > target;
}

function isDelayedRankedProject(project: RankedProject): boolean {
  const target = project.row.plannedProjectDays ?? project.row.deliveryTargetDays ?? (isMidImplanter(project.row.implanter) ? 90 : 60);
  if (project.row.projectDurationDays !== null && project.row.projectDurationDays !== undefined) {
    return project.row.projectDurationDays > target;
  }
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

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function diffCalendarMonths(start: Date, end: Date): number {
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
}

function isMidImplanter(implanter: string): boolean {
  const normalized = normalize(implanter);
  return normalized === "aline andrade" || normalized === "aline santos" || normalized === "maria marcos" || normalized === "maria";
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

function SaasImplantationMovementList({
  title,
  rows,
  emptyText,
  tone,
}: {
  title: string;
  rows: ExecutiveSaasMovementRow[];
  emptyText: string;
  tone: "positive" | "warning" | "critical";
}): JSX.Element {
  const badgeStyle =
    tone === "positive"
      ? { background: "#dcfce7", color: "#047857", borderColor: "#86efac" }
      : tone === "warning"
        ? { background: "#ffedd5", color: "#c2410c", borderColor: "#fdba74" }
        : { background: "#fee2e2", color: "#b91c1c", borderColor: "#fca5a5" };

  return (
    <div style={styles.subPanel}>
      <strong style={styles.subPanelTitle}>{title}</strong>
      <div style={styles.list}>
        {rows.length > 0 ? (
          rows.map((item) => (
            <article key={`${item.kind}-${item.companyCode}-${item.contract}-${item.referenceMonth}-${item.value}`} style={styles.listItem}>
              <div>
                <strong style={styles.listTitle}>
                  {item.companyCode ? `Cliente ${item.companyCode}` : `Contrato ${item.contract || "-"}`}
                </strong>
                <p style={styles.listText}>Implanter: {item.responsibleCs || "Sem responsável"}</p>
                <p style={styles.listText}>
                  Contrato: {item.contract || "-"} • Ref.: {item.referenceMonth || "-"} • 1a receita: {formatDateBR(item.firstRevenueAt)}
                </p>
              </div>
              <span style={{ ...styles.listBadge, ...badgeStyle }}>{formatCurrencyBRL(item.value)}</span>
            </article>
          ))
        ) : (
          <div style={styles.emptyList}>{emptyText}</div>
        )}
      </div>
    </div>
  );
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
  riskBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 11px",
    borderRadius: "999px",
    background: "#fff1f2",
    color: "#be123c",
    fontWeight: 900,
    border: "1px solid #fda4af",
    textTransform: "uppercase",
    fontSize: "11px",
    letterSpacing: "0.06em",
  },
  healthyBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 11px",
    borderRadius: "999px",
    background: "#ecfdf5",
    color: "#047857",
    fontWeight: 900,
    border: "1px solid #86efac",
    textTransform: "uppercase",
    fontSize: "11px",
    letterSpacing: "0.06em",
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



