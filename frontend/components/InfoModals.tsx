"use client";

import React from "react";
import {
  X,
  Database,
  Cpu,
  Sparkles,
  Layers,
  ShieldCheck,
  Workflow,
  BarChart3,
  Code2,
  Table,
  CheckCircle2,
  Terminal,
} from "lucide-react";

export type InfoModalType = "agent-squad" | "architecture" | "powerbi" | null;

interface InfoModalsProps {
  activeModal: InfoModalType;
  onClose: () => void;
}

export const InfoModals: React.FC<InfoModalsProps> = ({ activeModal, onClose }) => {
  if (!activeModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-2xl border border-subtleBorder dark:border-zinc-800 text-primaryText">
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 -left-12 h-32 w-32 rounded-full bg-accent-lime/25 blur-2xl pointer-events-none" />
        <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-accent-violet/25 blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between pb-4 border-b border-subtleBorder/70 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-dark text-accent-lime font-mono font-bold text-sm shadow-sm">
              Δ
            </div>
            <h2 className="text-base font-bold text-primaryText">
              {activeModal === "agent-squad" && "7-Agent Autonomous Pipeline Squad"}
              {activeModal === "architecture" && "Technical Architecture & Compute Layer"}
              {activeModal === "powerbi" && "Power BI Star Schema & TMDL Engine"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-mutedText hover:bg-canvas dark:hover:bg-zinc-800 hover:text-primaryText transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal 1: Agent Squad */}
        {activeModal === "agent-squad" && (
          <div className="mt-5 space-y-4 text-xs">
            <p className="text-mutedText leading-relaxed">
              Our synchronized squad of 7 specialized AI agents operates autonomously across the
              full data analytics lifecycle:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="rounded-xl border border-subtleBorder dark:border-zinc-700/80 bg-canvas dark:bg-zinc-800/60 p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="font-bold text-dark dark:text-white">1. Data Cleaner</span>
                </div>
                <p className="text-mutedText leading-relaxed text-[11px]">
                  Zero-loss schema casting, IQR bounds outlier capping, null imputation, and audit scorecard.
                </p>
              </div>

              <div className="rounded-xl border border-subtleBorder dark:border-zinc-700/80 bg-canvas dark:bg-zinc-800/60 p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Workflow className="h-4 w-4 text-accent-violet" />
                  <span className="font-bold text-dark dark:text-white">2. Data Transformer</span>
                </div>
                <p className="text-mutedText leading-relaxed text-[11px]">
                  Feature engineering, log scaling, one-hot encoding, and cyclical temporal bucket derivation.
                </p>
              </div>

              <div className="rounded-xl border border-subtleBorder dark:border-zinc-700/80 bg-canvas dark:bg-zinc-800/60 p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Cpu className="h-4 w-4 text-blue-600" />
                  <span className="font-bold text-dark dark:text-white">3. EDA & Features</span>
                </div>
                <p className="text-mutedText leading-relaxed text-[11px]">
                  Skewness, correlation matrix computation, distribution shape testing, and anomaly heatmaps.
                </p>
              </div>

              <div className="rounded-xl border border-subtleBorder dark:border-zinc-700/80 bg-canvas dark:bg-zinc-800/60 p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Database className="h-4 w-4 text-amber-600" />
                  <span className="font-bold text-dark dark:text-white">4. SQL Analytics</span>
                </div>
                <p className="text-mutedText leading-relaxed text-[11px]">
                  DuckDB high-speed analytical queries, window functions, and cohort aggregations.
                </p>
              </div>

              <div className="rounded-xl border border-subtleBorder dark:border-zinc-700/80 bg-canvas dark:bg-zinc-800/60 p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="h-4 w-4 text-accent-lime" />
                  <span className="font-bold text-dark dark:text-white">5. Root-Cause Engine</span>
                </div>
                <p className="text-mutedText leading-relaxed text-[11px]">
                  Variance decomposition, regression trees, cohort divergence, and executive action points.
                </p>
              </div>

              <div className="rounded-xl border border-subtleBorder dark:border-zinc-700/80 bg-canvas dark:bg-zinc-800/60 p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                  <span className="font-bold text-dark dark:text-white">6. Data Visualizer</span>
                </div>
                <p className="text-mutedText leading-relaxed text-[11px]">
                  Matplotlib & Seaborn production charts, correlation plots, and distribution histograms.
                </p>
              </div>

              <div className="rounded-xl border border-subtleBorder dark:border-zinc-700/80 bg-canvas dark:bg-zinc-800/60 p-3.5 sm:col-span-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <Layers className="h-4 w-4 text-dark dark:text-white" />
                  <span className="font-bold text-dark dark:text-white">7. Power BI Architect</span>
                </div>
                <p className="text-mutedText leading-relaxed text-[11px]">
                  Star Schema modeling, automated fact/dimension splits, 100% verified DAX formulas, and TMDL & .pbip export.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Modal 2: Architecture */}
        {activeModal === "architecture" && (
          <div className="mt-5 space-y-4 text-xs">
            <p className="text-mutedText leading-relaxed">
              Engineered with a high-throughput hybrid architecture combining Python 3.13, DuckDB vectorized execution, Polars streaming, and Next.js 15:
            </p>

            <div className="rounded-xl bg-dark p-4 text-white font-mono text-[11px] leading-relaxed overflow-x-auto">
              <pre className="text-accent-lime font-bold">
{`[User Input / Ingestion]
        │
        ▼
[FastAPI Orchestrator] ──► [LangGraph State Machine]
        │                         │
        ├── DuckDB In-Memory      ├── AgentState Context
        ├── Polars Zero-Copy      ├── Cyclic Quality Check
        └── Groq LLM Inference    └── TMDL / DAX Generator
        │
        ▼
[Next.js 15 App Shell] ◄── [SSE Real-Time Streaming]`}
              </pre>
            </div>

            <div className="space-y-2 mt-4 text-mutedText">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>DuckDB Analytical Engine:</strong> Sub-second SQL execution across million-row Parquet & CSV files without server overhead.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Groq Cloud Inference:</strong> Ultra-low latency Llama 3.3 70B & 3.1 8B streaming for instant analytics copiloting.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Native Power BI Formats:</strong> Zero vendor lock-in with direct TMDL text files and .pbip project packages.</span>
              </div>
            </div>
          </div>
        )}

        {/* Modal 3: Power BI & TMDL */}
        {activeModal === "powerbi" && (
          <div className="mt-5 space-y-4 text-xs">
            <p className="text-mutedText leading-relaxed">
              Autonomous BI Studio eliminates manual report building by compiling data schemas directly into Microsoft Tabular Model Definition Language (TMDL).
            </p>

            <div className="rounded-xl bg-dark p-4 text-white font-mono text-[11px] leading-relaxed">
              <div className="text-accent-lime mb-1">// Generated TMDL Measure Specification</div>
              <span className="text-white/80">measure &apos;YoY Sales Growth %&apos; =</span><br />
              <span className="text-purple-300">VAR</span> CurrentSales = [Total Sales]<br />
              <span className="text-purple-300">VAR</span> PriorSales = CALCULATE([Total Sales], SAMEPERIODLASTYEAR(&apos;DimDate&apos;[Date]))<br />
              <span className="text-purple-300">RETURN</span> DIVIDE(CurrentSales - PriorSales, PriorSales, 0)<br />
              <span className="text-mutedText">formatString: &quot;0.0%&quot;</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-xl border border-subtleBorder dark:border-zinc-700/80 bg-canvas dark:bg-zinc-800/60 p-3">
                <p className="font-bold text-dark dark:text-white mb-1">Star Schema Fact & Dims</p>
                <p className="text-mutedText text-[11px]">
                  Automatically identifies high-cardinality keys to partition facts from date, customer, and product dimensions.
                </p>
              </div>
              <div className="rounded-xl border border-subtleBorder dark:border-zinc-700/80 bg-canvas dark:bg-zinc-800/60 p-3">
                <p className="font-bold text-dark dark:text-white mb-1">One-Click PBIP Download</p>
                <p className="text-mutedText text-[11px]">
                  Exports a complete zipped .pbip project file that opens immediately in Power BI Desktop without manual imports.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-dark dark:bg-white px-5 py-2 text-xs font-semibold text-white dark:text-dark hover:bg-dark/90 dark:hover:bg-white/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
