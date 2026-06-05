import { CSSProperties, ChangeEvent, useState } from "react";

import type { UploadIssue, WeeklyComparison, WeeklyMovement, WeeklySnapshot } from "../types";

interface WeeklyHistoryPanelProps {
  currentSnapshot: WeeklySnapshot | null;
  previousSnapshot: WeeklySnapshot | null;
  comparison: WeeklyComparison | null;
  previousCsvFileName: string;
  previousWorkbookFileName: string;
  onPreviousCsvUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onPreviousWorkbookUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  previousUploadIssues: UploadIssue[];
  previousErrorMessage: string;
}

export function WeeklyHistoryPanel(props: WeeklyHistoryPanelProps): JSX.Element {
  const {
    currentSnapshot,
    previousSnapshot,
    comparison,
    previousCsvFileName,
    previousWorkbookFileName,
    onPreviousCsvUpload,
    onPreviousWorkbookUpload,
    previousUploadIssues,
    previousErrorMessage,
  } = props;
  const [isManualUploadCollapsed, setIsManualUploadCollapsed] = useState(false);
  const [isComparisonCollapsed, setIsComparisonCollapsed] = useState(false);

  return (
    <section style={styles.wrapper}>
      <div style={styles.manualUpload}>
        <div style={styles.manualUploadHeader}>
          <div style={styles.sectionHeader}>
            <p style={styles.eyebrow}>Semana Passada</p>
            <h2 style={styles.title}>Upload manual para comparação</h2>
          </div>

          <button
            type="button"
            onClick={() => setIsManualUploadCollapsed((current) => !current)}
            style={styles.toggleButton}
          >
            {isManualUploadCollapsed ? "Maximizar" : "Minimizar"}
          </button>
        </div>

        {!isManualUploadCollapsed ? (
          <>
            <p style={styles.helperText}>
              Envie 1 CSV e 1 XLS/XLSX da semana passada para comparar explicitamente com a semana atual.
            </p>

            <div style={styles.uploadGrid}>
              <label style={styles.uploadSlot}>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={onPreviousCsvUpload}
                  style={styles.hiddenInput}
                />
                <span style={styles.uploadLabel}>CSV semana passada</span>
                <span style={styles.uploadValue}>
                  {previousCsvFileName || "Selecione o CSV da semana passada"}
                </span>
              </label>

              <label style={styles.uploadSlot}>
                <input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={onPreviousWorkbookUpload}
                  style={styles.hiddenInput}
                />
                <span style={styles.uploadLabel}>XLS/XLSX semana passada</span>
                <span style={styles.uploadValue}>
                  {previousWorkbookFileName || "Selecione a planilha da semana passada"}
                </span>
              </label>
            </div>

            {previousErrorMessage ? <div style={styles.errorBox}>{previousErrorMessage}</div> : null}

            {previousUploadIssues.length > 0 ? (
              <div style={styles.issueList}>
                {previousUploadIssues.map((issue, index) => (
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
          </>
        ) : null}
      </div>

      <div style={styles.comparisonSection}>
        <div style={styles.comparisonHeader}>
          <div>
            <p style={styles.eyebrow}>Comparativo semanal</p>
            <h2 style={styles.title}>Snapshots e comparação histórica</h2>
          </div>

          <button
            type="button"
            onClick={() => setIsComparisonCollapsed((current) => !current)}
            style={styles.toggleButton}
          >
            {isComparisonCollapsed ? "Maximizar" : "Minimizar"}
          </button>
        </div>

        {!isComparisonCollapsed ? (
          <>
            <div style={styles.sectionGrid}>
              <div style={styles.column}>
                <div style={styles.sectionHeader}>
                  <p style={styles.eyebrow}>Semana Atual</p>
                  <h2 style={styles.title}>Snapshot da semana em análise</h2>
                </div>

                {currentSnapshot ? (
                  <div style={styles.snapshotCard}>
                    <strong style={styles.snapshotTitle}>{currentSnapshot.weekLabel}</strong>
                    <p style={styles.snapshotText}>
                      {currentSnapshot.projects.length} projetos salvos nesta semana.
                    </p>
                    <p style={styles.snapshotText}>
                      Arquivos: {currentSnapshot.fileSummary.join(" + ")}
                    </p>
                  </div>
                ) : (
                  <div style={styles.emptyCard}>Nenhum snapshot salvo para a semana atual.</div>
                )}
              </div>

              <div style={styles.column}>
                <div style={styles.sectionHeader}>
                  <p style={styles.eyebrow}>Histórico</p>
                  <h2 style={styles.title}>Comparação com a semana passada</h2>
                </div>

                {previousSnapshot ? (
                  <div style={styles.snapshotCardMuted}>
                    <strong style={styles.snapshotTitle}>{previousSnapshot.weekLabel}</strong>
                    <p style={styles.snapshotText}>
                      {previousSnapshot.projects.length} projetos na semana anterior.
                    </p>
                    <p style={styles.snapshotText}>
                      Arquivos: {previousSnapshot.fileSummary.join(" + ")}
                    </p>
                  </div>
                ) : (
                  <div style={styles.emptyCard}>
                    Ainda não existe semana anterior salva. O histórico começará no próximo upload semanal.
                  </div>
                )}
              </div>
            </div>

            {comparison ? (
              <>
                <div style={styles.summaryGrid}>
                  {comparison.summary.map((item) => (
                    <div key={item} style={styles.summaryCard}>
                      {item}
                    </div>
                  ))}
                </div>

                <div style={styles.movementGrid}>
                  <MovementList
                    title="Entraram em crítico"
                    items={comparison.enteredCritical}
                    emptyText="Nenhum cliente entrou em crítico nesta semana."
                  />
                  <MovementList
                    title="Saíram de crítico"
                    items={comparison.leftCritical}
                    emptyText="Nenhum cliente saiu de crítico nesta semana."
                  />
                  <MovementList
                    title="Maiores pioras"
                    items={comparison.biggestIncrease}
                    emptyText="Nenhuma piora relevante nesta semana."
                  />
                  <MovementList
                    title="Maiores melhoras"
                    items={comparison.biggestDecrease}
                    emptyText="Nenhuma melhora relevante nesta semana."
                  />
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function MovementList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: WeeklyMovement[];
  emptyText: string;
}): JSX.Element {
  return (
    <article style={styles.movementCard}>
      <h3 style={styles.movementTitle}>{title}</h3>
      {items.length === 0 ? (
        <p style={styles.movementEmpty}>{emptyText}</p>
      ) : (
        <div style={styles.movementList}>
          {items.map((item) => (
            <div key={`${title}-${item.clientName}`} style={styles.movementItem}>
              <strong>{item.clientName}</strong>
              <span style={styles.movementMeta}>{item.implanter}</span>
              <span style={styles.movementMeta}>
                {item.previousRisk} → {item.currentRisk} ({item.delta >= 0 ? "+" : ""}
                {item.delta})
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,244,255,0.98) 100%)",
    border: "1px solid rgba(106, 63, 150, 0.12)",
    borderRadius: "28px",
    padding: "24px",
    marginBottom: "20px",
    boxShadow: "0 24px 44px rgba(83, 40, 125, 0.08)",
  },
  manualUpload: {
    marginBottom: "18px",
    padding: "18px",
    borderRadius: "20px",
    background: "linear-gradient(180deg, #ffffff 0%, #faf7ff 100%)",
    border: "1px solid rgba(106, 63, 150, 0.1)",
  },
  manualUploadHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "8px",
  },
  comparisonSection: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  comparisonHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  sectionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "16px",
    marginBottom: "16px",
  },
  column: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  sectionHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  toggleButton: {
    border: "1px solid rgba(106, 63, 150, 0.18)",
    background: "#ffffff",
    color: "#5b3c88",
    borderRadius: "999px",
    padding: "10px 16px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(83, 40, 125, 0.08)",
    whiteSpace: "nowrap",
  },
  eyebrow: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontSize: "12px",
    fontWeight: 800,
    color: "#0dcc68",
  },
  title: {
    margin: 0,
    fontSize: "24px",
    lineHeight: 1.15,
    color: "#3d215f",
  },
  snapshotCard: {
    padding: "16px",
    borderRadius: "20px",
    background: "linear-gradient(180deg, rgba(12,207,104,0.08) 0%, rgba(255,255,255,0.92) 100%)",
    border: "1px solid rgba(12, 207, 104, 0.32)",
  },
  snapshotCardMuted: {
    padding: "16px",
    borderRadius: "20px",
    background: "linear-gradient(180deg, #ffffff 0%, #faf7ff 100%)",
    border: "1px solid rgba(106, 63, 150, 0.1)",
  },
  snapshotTitle: {
    display: "block",
    color: "#0f172a",
    marginBottom: "6px",
  },
  snapshotText: {
    margin: "4px 0 0",
    color: "#475569",
    lineHeight: 1.5,
  },
  emptyCard: {
    padding: "16px",
    borderRadius: "18px",
    background: "#fff7ed",
    border: "1px dashed #fdba74",
    color: "#9a3412",
    lineHeight: 1.5,
  },
  helperText: {
    margin: "0 0 12px",
    color: "#475569",
    lineHeight: 1.5,
  },
  uploadGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
    marginBottom: "12px",
  },
  hiddenInput: {
    display: "none",
  },
  uploadSlot: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid rgba(106, 63, 150, 0.12)",
    background: "#ffffff",
    cursor: "pointer",
  },
  uploadLabel: {
    color: "#5b3a81",
    fontWeight: 700,
  },
  uploadValue: {
    color: "#64748b",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  errorBox: {
    marginBottom: "10px",
    padding: "12px 14px",
    borderRadius: "14px",
    color: "#be123c",
    background: "#fff1f2",
    border: "1px solid #fda4af",
  },
  issueList: {
    display: "grid",
    gap: "10px",
  },
  issueItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid transparent",
    color: "#334155",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  summaryCard: {
    padding: "14px",
    borderRadius: "18px",
    background: "#ffffff",
    border: "1px solid rgba(106, 63, 150, 0.1)",
    color: "#334155",
    lineHeight: 1.5,
  },
  movementGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
  },
  movementCard: {
    padding: "14px",
    borderRadius: "18px",
    background: "#fff",
    border: "1px solid rgba(106, 63, 150, 0.1)",
  },
  movementTitle: {
    margin: "0 0 10px",
    color: "#0f172a",
    fontSize: "18px",
  },
  movementEmpty: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.5,
  },
  movementList: {
    display: "grid",
    gap: "10px",
  },
  movementItem: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "10px 12px",
    borderRadius: "14px",
    background: "#faf7ff",
    border: "1px solid rgba(106, 63, 150, 0.08)",
  },
  movementMeta: {
    color: "#64748b",
    fontSize: "13px",
  },
};
