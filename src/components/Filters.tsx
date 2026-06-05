import { CSSProperties } from "react";

import type { PriorityLevel, RiskWeights } from "../types";

interface FiltersProps {
  implanters: string[];
  selectedImplanter: string;
  onImplanterChange: (value: string) => void;
  selectedOverdue: "Todas" | "Somente vencidas";
  onOverdueChange: (value: "Todas" | "Somente vencidas") => void;
  priorities: Array<PriorityLevel | "Todas">;
  selectedPriority: PriorityLevel | "Todas";
  onPriorityChange: (value: PriorityLevel | "Todas") => void;
  phases: string[];
  selectedPhase: string;
  onPhaseChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  weights: RiskWeights;
  onWeightChange: (key: keyof RiskWeights, value: number) => void;
}

const SLIDER_CONFIG: Array<{ key: keyof RiskWeights; label: string; max: number }> = [
  { key: "overdue", label: "Mensalidade vencida", max: 40 },
  { key: "engagement", label: "Baixo engajamento", max: 30 },
  { key: "pendingUsers", label: "Usuários pendentes", max: 30 },
  { key: "integration", label: "Integração", max: 20 },
  { key: "slaDelay", label: "Tempo vs SLA", max: 20 },
  { key: "projectDuration", label: "Prazo total", max: 20 },
  { key: "workbookRisk", label: "Fator de risco", max: 20 },
  { key: "inactivity", label: "Último follow-up", max: 20 },
  { key: "b2b", label: "B2B", max: 10 },
];

export function Filters(props: FiltersProps): JSX.Element {
  const {
    implanters,
    selectedImplanter,
    onImplanterChange,
    selectedOverdue,
    onOverdueChange,
    priorities,
    selectedPriority,
    onPriorityChange,
    phases,
    selectedPhase,
    onPhaseChange,
    search,
    onSearchChange,
    weights,
    onWeightChange,
  } = props;

  return (
    <section style={styles.wrapper}>
      <div style={styles.controlsRow}>
        <div style={styles.field}>
          <label htmlFor="implanter-filter" style={styles.label}>
            Implantador
          </label>
          <select
            id="implanter-filter"
            value={selectedImplanter}
            onChange={(event) => onImplanterChange(event.target.value)}
            style={styles.input}
          >
            {implanters.map((implanter) => (
              <option key={implanter} value={implanter}>
                {implanter}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.field}>
          <label htmlFor="client-search" style={styles.label}>
            Buscar cliente
          </label>
          <input
            id="client-search"
            type="search"
            placeholder="Digite o nome do cliente"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label htmlFor="overdue-filter" style={styles.label}>
            Mensalidade
          </label>
          <select
            id="overdue-filter"
            value={selectedOverdue}
            onChange={(event) => onOverdueChange(event.target.value as "Todas" | "Somente vencidas")}
            style={styles.input}
          >
            <option value="Todas">Todas</option>
            <option value="Somente vencidas">Somente vencidas</option>
          </select>
        </div>

        <div style={styles.field}>
          <label htmlFor="priority-filter" style={styles.label}>
            Prioridade
          </label>
          <select
            id="priority-filter"
            value={selectedPriority}
            onChange={(event) => onPriorityChange(event.target.value as PriorityLevel | "Todas")}
            style={styles.input}
          >
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.field}>
          <label htmlFor="phase-filter" style={styles.label}>
            Fase do projeto
          </label>
          <select
            id="phase-filter"
            value={selectedPhase}
            onChange={(event) => onPhaseChange(event.target.value)}
            style={styles.input}
          >
            {phases.map((phase) => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.sliderGrid}>
        {SLIDER_CONFIG.map((slider) => (
          <label key={slider.key} style={styles.sliderCard}>
            <span style={styles.sliderHeader}>
              <span>{slider.label}</span>
              <strong>{weights[slider.key]}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={slider.max}
              step={1}
              value={weights[slider.key]}
              onChange={(event) => onWeightChange(slider.key, Number(event.target.value))}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,244,255,0.96) 100%)",
    border: "1px solid rgba(106, 63, 150, 0.12)",
    borderRadius: "24px",
    padding: "22px",
    marginBottom: "20px",
    boxShadow: "0 20px 40px rgba(83, 40, 125, 0.08)",
  },
  controlsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
    marginBottom: "18px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontWeight: 800,
    fontSize: "12px",
    color: "#5b3a81",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  input: {
    borderRadius: "14px",
    border: "1px solid rgba(106, 63, 150, 0.16)",
    padding: "13px 14px",
    background: "#fff",
    color: "#0f172a",
    boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.04)",
  },
  sliderGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  sliderCard: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    background: "linear-gradient(180deg, #ffffff 0%, #f7f3ff 100%)",
    borderRadius: "18px",
    padding: "14px",
    border: "1px solid rgba(106, 63, 150, 0.1)",
  },
  sliderHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    color: "#2f1c4a",
    fontSize: "13px",
    fontWeight: 700,
  },
};
