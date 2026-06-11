import { ChangeEvent, CSSProperties, useEffect, useMemo, useState } from "react";

import type {
  ExecutiveUploadsData,
  UploadIssue,
} from "../types";
import { ExecutiveOverview } from "./ExecutiveOverview";
import { ForecastPanel } from "./ForecastPanel";
import { FunnelPanel } from "./FunnelPanel";
import { HealthScorePanel } from "./HealthScorePanel";
import { parseExecutiveFiles } from "../utils/parseExecutiveFiles";
import {
  readExecutiveFiles,
  saveExecutiveFile,
} from "../utils/persistedExecutiveFiles";
import {
  applyOperationalContext,
  buildHealthRecords,
  type ManualRiskOverride,
} from "../utils/healthScore";

type DashboardTab = "direcionamento" | "implanter" | "fila" | "forecast";
type DashboardArea = "risco" | "gestao";

const DEFAULT_IMPLANTERS = [
  "Aline Andrade",
  "Aline Santos",
  "David Ramos",
  "Maria Marcos",
  "Natieli Ambrosi",
  "Samara Massuchetto",
] as const;

const EXCLUDED_IMPLANTER_PREFIXES = ["julia", "ana cassia", "aily", "ailly"];

interface PreloadedDashboardState {
  executiveData: ExecutiveUploadsData | null;
  executiveUploadIssues: UploadIssue[];
  fileNames?: Partial<Record<
    | "openProjects"
    | "closedProjects"
    | "lostProjects"
    | "cancellationProjects"
    | "newProjects"
    | "delinquencyProjects"
    | "contractValueProjects"
    | "qualitativeProjects",
    string
  >>;
}

declare global {
  interface Window {
    __PRELOADED_DASHBOARD__?: PreloadedDashboardState;
    __EXPORTED_DASHBOARD_STATE__?: PreloadedDashboardState;
  }
}

const preloadedDashboard = readPreloadedDashboardState();
const LOCAL_OVERRIDE_STORAGE_KEY = "mercos-ops-manual-overrides-v1";

export function Dashboard(): JSX.Element {
  const [activeTab, setActiveTab] = useState<DashboardTab>("fila");
  const [activeArea, setActiveArea] = useState<DashboardArea>("risco");
  const [selectedImplanter, setSelectedImplanter] = useState("Todos");
  const [selectedSegment, setSelectedSegment] = useState<"Todos" | "MID" | "SMB">("Todos");
  const [executiveOpenProjectsFile, setExecutiveOpenProjectsFile] = useState<File | null>(null);
  const [executiveClosedProjectsFile, setExecutiveClosedProjectsFile] = useState<File | null>(null);
  const [executiveLostProjectsFile, setExecutiveLostProjectsFile] = useState<File | null>(null);
  const [executiveCancellationFile, setExecutiveCancellationFile] = useState<File | null>(null);
  const [executiveNewProjectsFile, setExecutiveNewProjectsFile] = useState<File | null>(null);
  const [executiveDelinquencyFile, setExecutiveDelinquencyFile] = useState<File | null>(null);
  const [executiveContractValueFile, setExecutiveContractValueFile] = useState<File | null>(null);
  const [executiveData, setExecutiveData] = useState<ExecutiveUploadsData | null>(preloadedDashboard.executiveData);
  const [executiveUploadIssues, setExecutiveUploadIssues] = useState<UploadIssue[]>(preloadedDashboard.executiveUploadIssues);
  const [manualOverrides, setManualOverrides] = useState<Record<string, ManualRiskOverride>>(() => readManualOverrides());
  const [persistedFilesLoaded, setPersistedFilesLoaded] = useState(false);

  const implanters = useMemo(() => {
    const names = new Set<string>(DEFAULT_IMPLANTERS);

    executiveData?.openProjects.forEach((item) => {
      if (item.implanter) {
        names.add(item.implanter);
      }
    });

    executiveData?.closedProjects.forEach((item) => {
      if (item.implanter) {
        names.add(item.implanter);
      }
    });

    executiveData?.lostProjects.forEach((item) => {
      if (item.implanter) {
        names.add(item.implanter);
      }
    });

    executiveData?.cancellationProjects.forEach((item) => {
      if (item.implanter) {
        names.add(item.implanter);
      }
    });

    executiveData?.newProjects.forEach((item) => {
      if (item.implanter) {
        names.add(item.implanter);
      }
    });

    executiveData?.delinquencyProjects.forEach((item) => {
      if (item.implanter) {
        names.add(item.implanter);
      }
    });

    const filteredNames = Array.from(names)
      .filter((name) => isAllowedImplanterName(name))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    return ["Todos", ...filteredNames];
  }, [executiveData]);

  const filteredExecutiveData = useMemo<ExecutiveUploadsData | null>(() => {
    if (!executiveData) {
      return null;
    }
    if (selectedImplanter === "Todos" && selectedSegment === "Todos") {
      return executiveData;
    }

    const matchesImplanter = (implanter: string) =>
      selectedImplanter === "Todos" || implanter === selectedImplanter;
    const matchesSegment = (segment: string) =>
      selectedSegment === "Todos" || segment === selectedSegment;

    return {
      openProjects: executiveData.openProjects.filter(
        (item) =>
          matchesImplanter(item.implanter) &&
          matchesSegment(inferSegmentFromImplanter(item.implanter)),
      ),
      closedProjects: executiveData.closedProjects.filter(
        (item) =>
          matchesImplanter(item.implanter) &&
          matchesSegment(inferSegmentFromImplanter(item.implanter)),
      ),
      lostProjects: executiveData.lostProjects.filter(
        (item) =>
          matchesImplanter(item.implanter) &&
          matchesSegment(inferSegmentFromImplanter(item.implanter)),
      ),
      cancellationProjects: executiveData.cancellationProjects.filter(
        (item) =>
          matchesImplanter(item.implanter) &&
          matchesSegment(inferSegmentLabel(item.segment, item.implanter)),
      ),
      newProjects: executiveData.newProjects.filter(
        (item) =>
          matchesImplanter(item.implanter) &&
          matchesSegment(inferSegmentFromPortfolio(item.portfolioClass, item.implanter)),
      ),
      delinquencyProjects: executiveData.delinquencyProjects.filter(
        (item) =>
          matchesImplanter(item.implanter) &&
          matchesSegment(inferSegmentFromImplanter(item.implanter)),
      ),
      contractValueProjects: executiveData.contractValueProjects,
      qualitativeProjects: [],
    };
  }, [executiveData, selectedImplanter, selectedSegment]);

  const contextualizedRecords = useMemo(() => {
    if (!filteredExecutiveData) {
      return [];
    }
    return applyOperationalContext(
      buildHealthRecords(filteredExecutiveData),
      [],
      manualOverrides,
    );
  }, [filteredExecutiveData, manualOverrides]);

  const batidaContext = useMemo(() => {
    const markedRecords = contextualizedRecords.filter(
      (item) =>
        item.forecastMovement ||
        item.manualNote ||
        item.manualNextStep ||
        item.manualClassification ||
        item.manualOperationalStatus,
    );
    return {
      markedClients: markedRecords.length,
      markedMrr: markedRecords.reduce((sum, item) => sum + item.mrr, 0),
    };
  }, [contextualizedRecords]);

  async function processExecutiveFiles(nextFiles: {
    openProjectsFile?: File | null;
    closedProjectsFile?: File | null;
    lostProjectsFile?: File | null;
    cancellationProjectsFile?: File | null;
    newProjectsFile?: File | null;
    delinquencyProjectsFile?: File | null;
    contractValueProjectsFile?: File | null;
  }) {
    const result = await parseExecutiveFiles(nextFiles);
    setExecutiveData(result.data);
    setExecutiveUploadIssues(result.issues);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadPersistedFiles() {
      try {
        const files = await readExecutiveFiles();
        if (!isMounted) {
          return;
        }

        setExecutiveOpenProjectsFile(files.openProjects ?? null);
        setExecutiveClosedProjectsFile(files.closedProjects ?? null);
        setExecutiveLostProjectsFile(files.lostProjects ?? null);
        setExecutiveCancellationFile(files.cancellationProjects ?? null);
        setExecutiveNewProjectsFile(files.newProjects ?? null);
        setExecutiveDelinquencyFile(files.delinquencyProjects ?? null);
        setExecutiveContractValueFile(files.contractValueProjects ?? null);

        await processExecutiveFiles({
          openProjectsFile: files.openProjects ?? null,
          closedProjectsFile: files.closedProjects ?? null,
          lostProjectsFile: files.lostProjects ?? null,
          cancellationProjectsFile: files.cancellationProjects ?? null,
          newProjectsFile: files.newProjects ?? null,
          delinquencyProjectsFile: files.delinquencyProjects ?? null,
          contractValueProjectsFile: files.contractValueProjects ?? null,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setExecutiveUploadIssues((current) => [
          ...current,
          {
            fileName: "Planilhas salvas",
            message:
              error instanceof Error
                ? `Não foi possível recarregar as planilhas salvas: ${error.message}`
                : "Não foi possível recarregar as planilhas salvas.",
            severity: "warning",
          },
        ]);
      } finally {
        if (isMounted) {
          setPersistedFilesLoaded(true);
        }
      }
    }

    void loadPersistedFiles();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleExecutiveOpenProjectsUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setExecutiveOpenProjectsFile(file);
    await saveExecutiveFile("openProjects", file);
    await processExecutiveFiles({
      openProjectsFile: file,
      closedProjectsFile: executiveClosedProjectsFile,
      lostProjectsFile: executiveLostProjectsFile,
      cancellationProjectsFile: executiveCancellationFile,
      newProjectsFile: executiveNewProjectsFile,
      delinquencyProjectsFile: executiveDelinquencyFile,
      contractValueProjectsFile: executiveContractValueFile,
    });
    event.target.value = "";
  }

  async function handleExecutiveClosedProjectsUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setExecutiveClosedProjectsFile(file);
    await saveExecutiveFile("closedProjects", file);
    await processExecutiveFiles({
      openProjectsFile: executiveOpenProjectsFile,
      closedProjectsFile: file,
      lostProjectsFile: executiveLostProjectsFile,
      cancellationProjectsFile: executiveCancellationFile,
      newProjectsFile: executiveNewProjectsFile,
      delinquencyProjectsFile: executiveDelinquencyFile,
      contractValueProjectsFile: executiveContractValueFile,
    });
    event.target.value = "";
  }

  async function handleExecutiveLostProjectsUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setExecutiveLostProjectsFile(file);
    await saveExecutiveFile("lostProjects", file);
    await processExecutiveFiles({
      openProjectsFile: executiveOpenProjectsFile,
      closedProjectsFile: executiveClosedProjectsFile,
      lostProjectsFile: file,
      cancellationProjectsFile: executiveCancellationFile,
      newProjectsFile: executiveNewProjectsFile,
      delinquencyProjectsFile: executiveDelinquencyFile,
      contractValueProjectsFile: executiveContractValueFile,
    });
    event.target.value = "";
  }

  async function handleExecutiveCancellationUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setExecutiveCancellationFile(file);
    await saveExecutiveFile("cancellationProjects", file);
    await processExecutiveFiles({
      openProjectsFile: executiveOpenProjectsFile,
      closedProjectsFile: executiveClosedProjectsFile,
      lostProjectsFile: executiveLostProjectsFile,
      cancellationProjectsFile: file,
      newProjectsFile: executiveNewProjectsFile,
      delinquencyProjectsFile: executiveDelinquencyFile,
      contractValueProjectsFile: executiveContractValueFile,
    });
    event.target.value = "";
  }

  async function handleExecutiveNewProjectsUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setExecutiveNewProjectsFile(file);
    await saveExecutiveFile("newProjects", file);
    await processExecutiveFiles({
      openProjectsFile: executiveOpenProjectsFile,
      closedProjectsFile: executiveClosedProjectsFile,
      lostProjectsFile: executiveLostProjectsFile,
      cancellationProjectsFile: executiveCancellationFile,
      newProjectsFile: file,
      delinquencyProjectsFile: executiveDelinquencyFile,
      contractValueProjectsFile: executiveContractValueFile,
    });
    event.target.value = "";
  }

  async function handleExecutiveDelinquencyUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setExecutiveDelinquencyFile(file);
    await saveExecutiveFile("delinquencyProjects", file);
    await processExecutiveFiles({
      openProjectsFile: executiveOpenProjectsFile,
      closedProjectsFile: executiveClosedProjectsFile,
      lostProjectsFile: executiveLostProjectsFile,
      cancellationProjectsFile: executiveCancellationFile,
      newProjectsFile: executiveNewProjectsFile,
      delinquencyProjectsFile: file,
      contractValueProjectsFile: executiveContractValueFile,
    });
    event.target.value = "";
  }

  useEffect(() => {
    window.__EXPORTED_DASHBOARD_STATE__ = {
      executiveData,
      executiveUploadIssues,
      fileNames: {
        openProjects: executiveOpenProjectsFile?.name,
        closedProjects: executiveClosedProjectsFile?.name,
        lostProjects: executiveLostProjectsFile?.name,
        cancellationProjects: executiveCancellationFile?.name,
        newProjects: executiveNewProjectsFile?.name,
        delinquencyProjects: executiveDelinquencyFile?.name,
        contractValueProjects: executiveContractValueFile?.name,
      },
    };
  }, [
    executiveCancellationFile,
    executiveClosedProjectsFile,
    executiveContractValueFile,
    executiveData,
    executiveDelinquencyFile,
    executiveLostProjectsFile,
    executiveNewProjectsFile,
    executiveOpenProjectsFile,
    executiveUploadIssues,
  ]);

  async function handleExecutiveContractValueUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setExecutiveContractValueFile(file);
    await saveExecutiveFile("contractValueProjects", file);
    await processExecutiveFiles({
      openProjectsFile: executiveOpenProjectsFile,
      closedProjectsFile: executiveClosedProjectsFile,
      lostProjectsFile: executiveLostProjectsFile,
      cancellationProjectsFile: executiveCancellationFile,
      newProjectsFile: executiveNewProjectsFile,
      delinquencyProjectsFile: executiveDelinquencyFile,
      contractValueProjectsFile: file,
    });
    event.target.value = "";
  }

  function handleManualOverrideChange(override: ManualRiskOverride) {
    setManualOverrides((current) => {
      const next = { ...current, [override.recordKey]: override };
      persistManualOverrides(next);
      return next;
    });
  }

  function handleAreaChange(area: DashboardArea) {
    setActiveArea(area);
    setActiveTab(area === "risco" ? "fila" : "direcionamento");
  }

  function handleTabChange(tab: DashboardTab) {
    setActiveTab(tab);
    setActiveArea(tab === "fila" || tab === "implanter" ? "risco" : "gestao");
  }

  return (
    <section style={styles.page}>
      <header style={styles.hero}>
        <div>
          <div style={styles.brandRow}>
            <div style={styles.brandMark}>
              <span style={styles.brandMarkGreen} />
              <span style={styles.brandMarkWhite} />
            </div>
            <span style={styles.brandBadge}>Mercos Implantação Ops</span>
          </div>
          <p style={styles.eyebrow}>Priorização de implantação</p>
          <h1 style={styles.title}>Fila inteligente de projetos por risco</h1>
          <p style={styles.subtitle}>
            Suba arquivos CSV ou XLSX do sistema e transforme a carteira do implanter em uma
            fila priorizada com score, motivos e recomendação de ação.
          </p>
        </div>
      </header>
      <section style={styles.workspaceSwitcher}>
        <AreaButton
          title="Risco do cliente"
          description="Fila inteligente, Health Score, sinais de risco e relatorio da batida."
          isActive={activeArea === "risco"}
          onClick={() => handleAreaChange("risco")}
        />
        <AreaButton
          title="Gestao da carteira"
          description="Direcionamento executivo, forecast e visao consolidada da carteira."
          isActive={activeArea === "gestao"}
          onClick={() => handleAreaChange("gestao")}
        />
      </section>
      <nav style={styles.tabs} aria-label="Abas do dashboard">
        <TabButton
          label="Direcionamento estratégico da carteira"
          isVisible={activeArea === "gestao"}
          isActive={activeTab === "direcionamento"}
          onClick={() => handleTabChange("direcionamento")}
        />
        <TabButton
          label="Health Score da carteira"
          isVisible={activeArea === "risco"}
          isActive={activeTab === "implanter"}
          onClick={() => handleTabChange("implanter")}
        />
        <TabButton
          label="Fila inteligente de projetos por risco"
          isVisible={activeArea === "risco"}
          isActive={activeTab === "fila"}
          onClick={() => handleTabChange("fila")}
        />
        <TabButton
          label="Forecast da batida"
          isVisible={activeArea === "gestao"}
          isActive={activeTab === "forecast"}
          onClick={() => handleTabChange("forecast")}
        />
      </nav>

      {activeTab === "direcionamento" ? (
        <>
          <section style={styles.executiveUploadCard}>
            <div style={styles.executiveUploadHeader}>
              <div>
                <strong style={styles.executiveUploadTitle}>Uploads do dashboard executivo</strong>
                <p style={styles.executiveUploadText}>
                  Use estas planilhas para alimentar novos, encerrados, perdidos e oportunidades de cancelamento. Nas amostras recebidas, todos os arquivos vieram em XLSX.
                </p>
                <p style={styles.executiveUploadStorageText}>
                  {persistedFilesLoaded
                    ? "As planilhas ficam salvas neste navegador até você subir outra no mesmo campo."
                    : "Carregando planilhas salvas neste navegador..."}
                </p>
              </div>
              <div style={styles.executiveFilterField}>
                <label htmlFor="executive-implanter-filter" style={styles.executiveFilterLabel}>
                  Filtrar por implanter
                </label>
                <select
                  id="executive-implanter-filter"
                  value={selectedImplanter}
                  onChange={(event) => setSelectedImplanter(event.target.value)}
                  style={styles.executiveFilterInput}
                >
                  {implanters.map((implanter) => (
                    <option key={implanter} value={implanter}>
                      {implanter}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.executiveFilterField}>
                <label htmlFor="executive-segment-filter" style={styles.executiveFilterLabel}>
                  Filtrar por segmento
                </label>
                <select
                  id="executive-segment-filter"
                  value={selectedSegment}
                  onChange={(event) =>
                    setSelectedSegment(event.target.value as "Todos" | "MID" | "SMB")
                  }
                  style={styles.executiveFilterInput}
                >
                  <option value="Todos">Todos</option>
                  <option value="MID">MID</option>
                  <option value="SMB">SMB</option>
                </select>
              </div>
            </div>

            <div style={styles.executiveUploadGrid}>
              <label style={styles.executiveUploadSlot}>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleExecutiveOpenProjectsUpload}
                  style={styles.hiddenInput}
                />
                <span style={styles.executiveUploadSlotTitle}>1. Projetos abertos</span>
                <span style={styles.executiveUploadSlotText}>
                  {executiveOpenProjectsFile?.name ?? preloadedDashboard.fileNames?.openProjects ?? "Suba a planilha de projetos abertos por implanter"}
                </span>
              </label>

              <label style={styles.executiveUploadSlot}>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleExecutiveClosedProjectsUpload}
                  style={styles.hiddenInput}
                />
                <span style={styles.executiveUploadSlotTitle}>2. Nota de finalização</span>
                <span style={styles.executiveUploadSlotText}>
                  {executiveClosedProjectsFile?.name ?? preloadedDashboard.fileNames?.closedProjects ?? "Suba a planilha de encerrados/finalização"}
                </span>
              </label>

              <label style={styles.executiveUploadSlot}>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleExecutiveLostProjectsUpload}
                  style={styles.hiddenInput}
                />
                <span style={styles.executiveUploadSlotTitle}>3. Projetos perdidos</span>
                <span style={styles.executiveUploadSlotText}>
                  {executiveLostProjectsFile?.name ?? preloadedDashboard.fileNames?.lostProjects ?? "Suba a planilha mensal de projetos perdidos"}
                </span>
              </label>

              <label style={styles.executiveUploadSlot}>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleExecutiveCancellationUpload}
                  style={styles.hiddenInput}
                />
                <span style={styles.executiveUploadSlotTitle}>4. Oportunidade de cancelamento</span>
                <span style={styles.executiveUploadSlotText}>
                  {executiveCancellationFile?.name ?? preloadedDashboard.fileNames?.cancellationProjects ?? "Suba a planilha de oportunidade de cancelamento"}
                </span>
              </label>

              <label style={styles.executiveUploadSlot}>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleExecutiveNewProjectsUpload}
                  style={styles.hiddenInput}
                />
                <span style={styles.executiveUploadSlotTitle}>5. Novos projetos</span>
                <span style={styles.executiveUploadSlotText}>
                  {executiveNewProjectsFile?.name ?? preloadedDashboard.fileNames?.newProjects ?? "Suba a planilha de novos projetos"}
                </span>
              </label>

              <label style={styles.executiveUploadSlot}>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleExecutiveDelinquencyUpload}
                  style={styles.hiddenInput}
                />
                <span style={styles.executiveUploadSlotTitle}>6. Inadimplência / resumo em implantação</span>
                <span style={styles.executiveUploadSlotText}>
                  {executiveDelinquencyFile?.name ?? preloadedDashboard.fileNames?.delinquencyProjects ?? "Suba a planilha de resumo de clientes em implantação"}
                </span>
              </label>

              <label style={styles.executiveUploadSlot}>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleExecutiveContractValueUpload}
                  style={styles.hiddenInput}
                />
                <span style={styles.executiveUploadSlotTitle}>7. Valor do contrato</span>
                <span style={styles.executiveUploadSlotText}>
                  {executiveContractValueFile?.name ?? preloadedDashboard.fileNames?.contractValueProjects ?? "Suba a planilha com o valor real do contrato"}
                </span>
              </label>

            </div>
          </section>

          <ExecutiveOverview
            projects={[]}
            executiveData={filteredExecutiveData}
            executiveIssues={executiveUploadIssues}
            batidaContext={batidaContext}
          />
        </>
      ) : null}

      {activeTab === "implanter" ? (
        <HealthScorePanel
          executiveData={executiveData}
          implanters={implanters}
          selectedImplanter={selectedImplanter}
          onImplanterChange={setSelectedImplanter}
        />
      ) : null}

      {activeTab === "fila" ? (
        <FunnelPanel
          executiveData={filteredExecutiveData}
          implanters={implanters}
          selectedImplanter={selectedImplanter}
          onImplanterChange={setSelectedImplanter}
          manualOverrides={manualOverrides}
          onManualOverrideChange={handleManualOverrideChange}
        />
      ) : null}

      {activeTab === "forecast" ? (
        <ForecastPanel
          executiveData={filteredExecutiveData}
          implanters={implanters}
          selectedImplanter={selectedImplanter}
          onImplanterChange={setSelectedImplanter}
          manualOverrides={manualOverrides}
        />
      ) : null}
    </section>
  );
}

function readPreloadedDashboardState(): PreloadedDashboardState {
  if (typeof window === "undefined" || !window.__PRELOADED_DASHBOARD__) {
    return { executiveData: null, executiveUploadIssues: [], fileNames: {} };
  }

  const payload = window.__PRELOADED_DASHBOARD__;
  return {
    executiveData: payload.executiveData ? reviveExecutiveData(payload.executiveData) : null,
    executiveUploadIssues: payload.executiveUploadIssues ?? [],
    fileNames: payload.fileNames ?? {},
  };
}

function reviveExecutiveData(data: ExecutiveUploadsData): ExecutiveUploadsData {
  return {
    openProjects: data.openProjects.map((item) => ({
      ...item,
      kickOffDate: reviveDate(item.kickOffDate),
      plannedDeliveryDate: reviveDate(item.plannedDeliveryDate),
      lastActivityAt: reviveDate(item.lastActivityAt),
    })),
    closedProjects: data.closedProjects.map((item) => ({
      ...item,
      closedAt: reviveDate(item.closedAt),
    })),
    lostProjects: data.lostProjects.map((item) => ({
      ...item,
      projectClosedAt: reviveDate(item.projectClosedAt),
      accountClosedAt: reviveDate(item.accountClosedAt),
      kickOffDate: reviveDate(item.kickOffDate),
    })),
    cancellationProjects: data.cancellationProjects.map((item) => ({
      ...item,
      closeDate: reviveDate(item.closeDate),
      newBusinessDate: reviveDate(item.newBusinessDate),
    })),
    newProjects: data.newProjects.map((item) => ({
      ...item,
      createdAt: reviveDate(item.createdAt),
    })),
    delinquencyProjects: data.delinquencyProjects.map((item) => ({
      ...item,
      createdAt: reviveDate(item.createdAt),
    })),
    contractValueProjects: data.contractValueProjects.map((item) => ({ ...item })),
    qualitativeProjects: [],
  };
}

function reviveDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isAllowedImplanterName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) {
    return false;
  }

  const normalized = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return false;
  }

  return !EXCLUDED_IMPLANTER_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function inferSegmentFromImplanter(implanter: string): "MID" | "SMB" {
  const normalized = normalizeText(implanter);
  if (
    normalized === "aline andrade" ||
    normalized === "aline santos" ||
    normalized === "maria marcos" ||
    normalized === "maria"
  ) {
    return "MID";
  }
  return "SMB";
}

function inferSegmentFromPortfolio(portfolioClass: string, implanter: string): "MID" | "SMB" {
  const normalizedPortfolio = normalizeText(portfolioClass);
  if (normalizedPortfolio.includes("mid")) {
    return "MID";
  }
  if (normalizedPortfolio.includes("smb")) {
    return "SMB";
  }
  return inferSegmentFromImplanter(implanter);
}

function inferSegmentLabel(segment: string, implanter: string): "MID" | "SMB" {
  const normalizedSegment = normalizeText(segment);
  if (normalizedSegment.includes("mid")) {
    return "MID";
  }
  if (normalizedSegment.includes("smb")) {
    return "SMB";
  }
  return inferSegmentFromImplanter(implanter);
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function readManualOverrides(): Record<string, ManualRiskOverride> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const payload = window.localStorage.getItem(LOCAL_OVERRIDE_STORAGE_KEY);
    if (!payload) {
      return {};
    }
    const parsed = JSON.parse(payload) as Record<string, Partial<ManualRiskOverride>>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [
        key,
        {
          recordKey: value.recordKey ?? key,
          clientName: value.clientName ?? "",
          manualClassification: value.manualClassification ?? "",
          forecastMovement: value.forecastMovement ?? "",
          excludeFromForecast: value.excludeFromForecast ?? false,
          operationalStatus: value.operationalStatus ?? "",
          note: value.note ?? "",
          nextStep: value.nextStep ?? "",
          updatedAt: value.updatedAt ?? "",
        },
      ]),
    );
  } catch {
    return {};
  }
}

function persistManualOverrides(overrides: Record<string, ManualRiskOverride>): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LOCAL_OVERRIDE_STORAGE_KEY, JSON.stringify(overrides));
}

function TabButton({
  label,
  isVisible = true,
  isActive,
  onClick,
}: {
  label: string;
  isVisible?: boolean;
  isActive: boolean;
  onClick: () => void;
}): JSX.Element | null {
  if (!isVisible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.tabButton,
        ...(isActive ? styles.tabButtonActive : null),
      }}
    >
      {label}
    </button>
  );
}

function AreaButton({
  title,
  description,
  isActive,
  onClick,
}: {
  title: string;
  description: string;
  isActive: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.areaButton,
        ...(isActive ? styles.areaButtonActive : null),
      }}
    >
      <strong style={styles.areaButtonTitle}>{title}</strong>
      <span style={styles.areaButtonText}>{description}</span>
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "32px",
    background:
      "radial-gradient(circle at top left, rgba(105, 58, 146, 0.36), transparent 26%), radial-gradient(circle at top right, rgba(12, 207, 104, 0.14), transparent 24%), linear-gradient(180deg, #f5f1fb 0%, #eef3ff 100%)",
    color: "#0f172a",
    fontFamily: '"Segoe UI", ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: "24px",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: "24px",
    padding: "28px",
    borderRadius: "30px",
    background: "linear-gradient(135deg, #6a3f96 0%, #5a2d8a 62%, #47206d 100%)",
    boxShadow: "0 28px 60px rgba(74, 31, 114, 0.22)",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  brandMark: {
    position: "relative",
    width: "54px",
    height: "34px",
  },
  brandMarkGreen: {
    position: "absolute",
    left: 0,
    top: "6px",
    width: "34px",
    height: "22px",
    background: "#0dcc68",
    borderRadius: "10px",
    transform: "rotate(-45deg)",
  },
  brandMarkWhite: {
    position: "absolute",
    left: "18px",
    top: "6px",
    width: "34px",
    height: "22px",
    background: "#ffffff",
    borderRadius: "10px",
    transform: "rotate(-45deg)",
  },
  brandBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#f8fafc",
    fontWeight: 700,
    letterSpacing: "0.01em",
  },
  eyebrow: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontSize: "12px",
    fontWeight: 800,
    color: "#7ef0a8",
  },
  title: {
    margin: "8px 0 12px",
    fontSize: "38px",
    lineHeight: 1.08,
    color: "#ffffff",
  },
  subtitle: {
    margin: 0,
    maxWidth: "760px",
    color: "rgba(255,255,255,0.82)",
    fontSize: "16px",
    lineHeight: 1.6,
  },
  uploadCard: {
    minWidth: "300px",
    maxWidth: "340px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "14px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.12)",
    border: "1px dashed rgba(126, 240, 168, 0.7)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14)",
    backdropFilter: "blur(6px)",
  },
  hiddenInput: {
    display: "none",
  },
  uploadTitle: {
    color: "#ffffff",
    fontWeight: 800,
    fontSize: "15px",
  },
  uploadText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  uploadFormats: {
    color: "rgba(255,255,255,0.58)",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  uploadGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
  },
  uploadSlot: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.14)",
    cursor: "pointer",
  },
  slotTitle: {
    color: "#7ef0a8",
    fontWeight: 700,
    fontSize: "13px",
  },
  slotText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: "13px",
    lineHeight: 1.4,
  },
  error: {
    marginBottom: "18px",
    padding: "14px 16px",
    borderRadius: "14px",
    color: "#be123c",
    background: "#fff1f2",
    border: "1px solid #fda4af",
  },
  issueList: {
    display: "grid",
    gap: "10px",
    marginBottom: "18px",
  },
  executiveUploadCard: {
    marginBottom: "20px",
    padding: "22px",
    borderRadius: "24px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(247,250,255,0.98) 100%)",
    border: "1px solid rgba(106, 63, 150, 0.12)",
    boxShadow: "0 18px 34px rgba(83, 40, 125, 0.06)",
  },
  executiveUploadHeader: {
    marginBottom: "16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
  },
  executiveUploadTitle: {
    display: "block",
    color: "#24153d",
    marginBottom: "8px",
    fontSize: "18px",
  },
  executiveUploadText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.6,
  },
  executiveUploadStorageText: {
    margin: "8px 0 0",
    color: "#0f7a45",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.45,
  },
  executiveFilterField: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: "240px",
  },
  executiveFilterLabel: {
    fontWeight: 800,
    fontSize: "12px",
    color: "#5b3a81",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  executiveFilterInput: {
    borderRadius: "14px",
    border: "1px solid rgba(106, 63, 150, 0.16)",
    padding: "13px 14px",
    background: "#fff",
    color: "#0f172a",
    boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.04)",
  },
  executiveUploadGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
  },
  executiveUploadSlot: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid rgba(106, 63, 150, 0.12)",
    background: "#ffffff",
    cursor: "pointer",
    minHeight: "110px",
  },
  executiveUploadSlotTitle: {
    color: "#56317b",
    fontWeight: 800,
    fontSize: "13px",
  },
  executiveUploadSlotText: {
    color: "#64748b",
    lineHeight: 1.45,
    fontSize: "13px",
  },
  tabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "20px",
  },
  workspaceSwitcher: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "14px",
    marginBottom: "14px",
  },
  areaButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    padding: "20px",
    borderRadius: "22px",
    border: "1px solid rgba(106, 63, 150, 0.14)",
    background: "rgba(255,255,255,0.9)",
    color: "#0f172a",
    cursor: "pointer",
    textAlign: "left",
    boxShadow: "0 16px 30px rgba(83, 40, 125, 0.08)",
  },
  areaButtonActive: {
    borderColor: "rgba(13, 204, 104, 0.48)",
    background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)",
    boxShadow: "0 18px 36px rgba(13, 204, 104, 0.14)",
  },
  areaButtonTitle: {
    color: "#4c1d95",
    fontSize: "18px",
    fontWeight: 900,
  },
  areaButtonText: {
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.5,
    fontWeight: 600,
  },
  tabButton: {
    borderRadius: "999px",
    border: "1px solid rgba(106, 63, 150, 0.16)",
    background: "rgba(255,255,255,0.88)",
    color: "#56317b",
    padding: "13px 16px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(83, 40, 125, 0.08)",
  },
  tabButtonActive: {
    background: "linear-gradient(135deg, #6a3f96 0%, #0dcc68 140%)",
    color: "#ffffff",
    borderColor: "transparent",
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
  empty: {
    background: "rgba(255,255,255,0.76)",
    border: "1px dashed #cbd5e1",
    borderRadius: "24px",
    padding: "54px 24px",
    textAlign: "center",
  },
  emptyTitle: {
    margin: "0 0 10px",
    fontSize: "24px",
  },
  emptyText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.6,
    maxWidth: "680px",
    marginInline: "auto",
  },
};

export default Dashboard;
