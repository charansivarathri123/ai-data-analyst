"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  ShieldCheck, 
  Sparkles, 
  BarChart2, 
  Database, 
  BrainCircuit, 
  TrendingUp, 
  Layers, 
  Check, 
  X,
  Play,
  RotateCcw
} from "lucide-react";
import { AgentRole, PipelineStatus } from "@/lib/types";
import {
  checkDraw,
  energyPulse,
  pipelineNode,
  ringDraw,
  safeVariants,
  usePrefersReducedMotion
} from "@/lib/motion";

interface PipelineTrackProps {
  pipelineStatus: PipelineStatus;
  activeAgent: AgentRole;
  completedAgents: {
    data_cleaner: boolean;
    data_transformer: boolean;
    eda_features: boolean;
    sql_analytics: boolean;
    root_cause_engine: boolean;
    data_visualizer: boolean;
    powerbi_architect: boolean;
  };
}

const AGENTS = [
  { id: "data_cleaner" as AgentRole, name: "Data Wrangling & Quality", shortName: "Quality", icon: ShieldCheck },
  { id: "data_transformer" as AgentRole, name: "Feature Engineering", shortName: "Features", icon: Sparkles },
  { id: "eda_features" as AgentRole, name: "Exploratory Analysis", shortName: "EDA", icon: BarChart2 },
  { id: "sql_analytics" as AgentRole, name: "SQL Analytics Studio", shortName: "DuckDB", icon: Database },
  { id: "root_cause_engine" as AgentRole, name: "Root-Cause Diagnostics", shortName: "Drivers", icon: BrainCircuit },
  { id: "data_visualizer" as AgentRole, name: "Data Visualizations", shortName: "Charts", icon: TrendingUp },
  { id: "powerbi_architect" as AgentRole, name: "Power BI Architect", shortName: "Power BI", icon: Layers },
];

export function PipelineTrack({ pipelineStatus, activeAgent, completedAgents }: PipelineTrackProps) {
  const reducedMotion = usePrefersReducedMotion();

  // Dev-only demo replay simulation
  const [isSimulating, setIsSimulating] = useState(false);
  const [simIndex, setSimIndex] = useState<number>(-1);

  const isRunningReal = pipelineStatus !== "idle" && pipelineStatus !== "completed" && pipelineStatus !== "failed";
  const isRunning = isRunningReal || isSimulating;

  useEffect(() => {
    if (!isSimulating) return;

    if (simIndex < AGENTS.length) {
      const timer = setTimeout(() => {
        setSimIndex((prev) => prev + 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      const endTimer = setTimeout(() => {
        setIsSimulating(false);
      }, 1200);
      return () => clearTimeout(endTimer);
    }
  }, [isSimulating, simIndex]);

  const handleStartSimulation = () => {
    setIsSimulating(true);
    setSimIndex(0);
  };

  const handleResetSimulation = () => {
    setIsSimulating(false);
    setSimIndex(-1);
  };

  const getStageState = (index: number, id: AgentRole) => {
    if (isSimulating) {
      if (index < simIndex) return "complete";
      if (index === simIndex) return "active";
      return "pending";
    }

    if (pipelineStatus === "failed") return "error";
    if (id !== "orchestrator" && completedAgents[id as keyof typeof completedAgents]) return "complete";
    if (activeAgent === id && isRunningReal) return "active";
    return "pending";
  };

  // Status text determination
  const getCurrentStageName = () => {
    if (isSimulating) {
      if (simIndex >= AGENTS.length) return "All Stages Complete";
      return AGENTS[simIndex]?.name || "Simulating";
    }

    if (pipelineStatus === "completed") return "All 7 Stages Complete";
    if (pipelineStatus === "failed") return "Execution Interrupted";
    if (pipelineStatus === "idle") return "Pipeline Idle";

    const current = AGENTS.find((a) => a.id === activeAgent);
    return current ? current.name : "Processing";
  };

  const currentName = getCurrentStageName();

  return (
    <div className="bg-surface-1 rounded-2xl p-6 border border-b-subtle shadow-xl w-full">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold text-t-primary tracking-tight">
              Autonomous Agent Pipeline Progression
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-2 border border-b-subtle text-t-secondary font-medium">
              7 Specialized Agents
            </span>
          </div>
          <p className="text-caption text-t-secondary mt-1">
            Data Quality → Feature Engineering → EDA → DuckDB SQL → Drivers → Matplotlib → Power BI
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Dev-only simulation control */}
          {process.env.NODE_ENV === "development" && (
            <div className="flex items-center gap-1.5">
              {!isSimulating ? (
                <button
                  type="button"
                  onClick={handleStartSimulation}
                  disabled={isRunningReal}
                  className="px-2.5 py-1 bg-surface-2 hover:bg-surface-3 border border-b-subtle hover:border-b-hover text-t-secondary hover:text-t-primary rounded-md flex items-center gap-1.5 text-micro font-mono transition-colors disabled:opacity-40"
                  title="Replay 7-agent motion sequence"
                >
                  <Play className="h-3 w-3 text-accent-warm" />
                  <span>Demo Track</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResetSimulation}
                  className="px-2.5 py-1 bg-surface-2 hover:bg-surface-3 border border-b-subtle text-t-secondary hover:text-t-primary rounded-md flex items-center gap-1.5 text-micro font-mono transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          )}

          {/* Dynamic Status Chip with Breathing Dot */}
          <div className="inline-flex items-center gap-2 bg-surface-2 px-3.5 py-1.5 rounded-full border border-b-subtle shadow-subtle">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                isRunning
                  ? "bg-accent-warm breathing-dot shadow-warm-glow"
                  : pipelineStatus === "completed" || simIndex >= AGENTS.length
                  ? "bg-accent-cool"
                  : pipelineStatus === "failed"
                  ? "bg-accent-danger"
                  : "bg-t-tertiary"
              }`}
            />
            <span className="text-caption text-t-secondary font-medium">
              {isRunning ? (
                <span className="text-accent-warm font-medium">Running: {currentName}</span>
              ) : pipelineStatus === "completed" || simIndex >= AGENTS.length ? (
                <span className="text-accent-cool font-medium">Verified: Complete</span>
              ) : pipelineStatus === "failed" ? (
                <span className="text-accent-danger font-medium">Failed</span>
              ) : (
                <span className="text-t-secondary font-mono text-micro uppercase tracking-wider">Ready to Ingest</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Horizontal Connected Track */}
      <div className="overflow-x-auto pb-4 custom-scrollbar">
        <div className="flex items-center min-w-[760px] px-3 pt-3">
          {AGENTS.map((agent, index) => {
            const status = getStageState(index, agent.id);
            const Icon = agent.icon;
            const isLast = index === AGENTS.length - 1;
            const isComplete = status === "complete";
            const isActive = status === "active";
            const isError = status === "error";

            return (
              <div key={agent.id} className="flex items-center flex-1">
                {/* Node */}
                <motion.div
                  className="relative flex flex-col items-center gap-2.5 z-10"
                  variants={safeVariants(pipelineNode, reducedMotion)}
                  initial="pending"
                  animate={status}
                  transition={{ duration: 0.3 }}
                >
                  {/* Circle Ring Container */}
                  <div
                    className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                      isActive
                        ? "bg-surface-3 shadow-warm-glow"
                        : isComplete
                        ? "bg-surface-2"
                        : "bg-surface-2/80"
                    }`}
                  >
                    <svg
                      className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                      viewBox="0 0 100 100"
                    >
                      {/* Base Track */}
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        className="stroke-b-subtle fill-none stroke-[3]"
                        strokeDasharray="4 4"
                      />

                      {/* Active SVG pathLength draw */}
                      {isActive && (
                        <motion.circle
                          cx="50"
                          cy="50"
                          r="45"
                          className="stroke-accent-warm fill-none stroke-[3.5]"
                          variants={safeVariants(ringDraw, reducedMotion)}
                          initial="hidden"
                          animate="visible"
                        />
                      )}

                      {/* Complete Ring */}
                      {isComplete && (
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          className="stroke-accent-cool fill-none stroke-[3.5]"
                        />
                      )}

                      {/* Error Ring */}
                      {isError && (
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          className="stroke-accent-danger fill-none stroke-[3.5]"
                        />
                      )}
                    </svg>

                    {/* Node Icon or Checkmark */}
                    {isComplete ? (
                      <motion.div
                        variants={safeVariants(checkDraw, reducedMotion)}
                        initial="hidden"
                        animate="visible"
                        className="text-accent-cool"
                      >
                        <Check className="h-5 w-5 stroke-[2.5]" />
                      </motion.div>
                    ) : isError ? (
                      <X className="h-5 w-5 text-accent-danger" />
                    ) : (
                      <Icon
                        className={`h-5 w-5 transition-colors ${
                          isActive
                            ? "text-accent-warm"
                            : "text-t-secondary"
                        }`}
                      />
                    )}
                  </div>

                  {/* Stage Label */}
                  <div className="text-center w-24">
                    <div className="text-micro font-mono text-t-tertiary font-bold mb-0.5">
                      0{index + 1}
                    </div>
                    <div
                      className={`text-[11px] font-medium leading-tight line-clamp-2 ${
                        isActive
                          ? "text-t-primary font-semibold"
                          : isComplete
                          ? "text-t-primary"
                          : "text-t-secondary"
                      }`}
                    >
                      {agent.name}
                    </div>
                  </div>
                </motion.div>

                {/* Connector Strip between nodes */}
                {!isLast && (
                  <div className="flex-1 h-[2px] mx-1 relative top-[-16px] bg-b-subtle rounded-full overflow-hidden">
                    {/* If completed, connector is filled solid pale green */}
                    {isComplete && (
                      <div className="absolute inset-0 bg-accent-cool" />
                    )}

                    {/* If active, pulse travels toward next node */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 bg-accent-warm w-1/3 rounded-full"
                        variants={safeVariants(energyPulse, reducedMotion)}
                        initial="hidden"
                        animate="visible"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default PipelineTrack;
