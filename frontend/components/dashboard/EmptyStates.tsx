"use client";

import { motion } from "motion/react";
import { safeVariants, breathe, usePrefersReducedMotion } from "@/lib/motion";
import { Database, ShieldCheck, Sparkles, BrainCircuit } from "lucide-react";

export function QualityEmpty() {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[360px] border border-dashed border-b-subtle rounded-xl bg-canvas text-center">
      <motion.div
        variants={safeVariants(breathe, reducedMotion)}
        initial="initial"
        animate="animate"
        className="mb-4 relative"
      >
        <div className="w-16 h-16 rounded-full border-2 border-b-subtle flex items-center justify-center bg-surface-2">
          <ShieldCheck className="h-8 w-8 text-accent-cool" />
        </div>
      </motion.div>
      <h3 className="text-sm font-semibold text-t-primary mb-1">Quality Profiling Awaiting Run</h3>
      <p className="text-caption text-t-secondary max-w-sm">
        Ingest a dataset and click RUN to trigger automated schema casting, missing value imputation, and scorecard calculation.
      </p>
    </div>
  );
}

export function TransformationEmpty() {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[360px] border border-dashed border-b-subtle rounded-xl bg-canvas text-center">
      <motion.div
        variants={safeVariants(breathe, reducedMotion)}
        initial="initial"
        animate="animate"
        className="mb-4 flex items-center gap-2"
      >
        <div className="w-10 h-10 rounded-lg bg-surface-2 border border-b-subtle flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-accent-warm" />
        </div>
        <div className="w-4 h-[2px] bg-b-subtle" />
        <div className="w-10 h-10 rounded-lg bg-surface-2 border border-b-subtle flex items-center justify-center">
          <span className="text-micro font-mono text-t-secondary font-bold">f(x)</span>
        </div>
      </motion.div>
      <h3 className="text-sm font-semibold text-t-primary mb-1">Feature Engineering Pipeline</h3>
      <p className="text-caption text-t-secondary max-w-sm">
        Automatically engineers standard scalers, quantile bins, cyclical calendar features, and one-hot encoding across high-cardinality dimensions.
      </p>
    </div>
  );
}

export function EDAEmpty() {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[360px] border border-dashed border-b-subtle rounded-xl bg-canvas text-center">
      <div className="mb-5 flex items-end gap-1.5 h-12">
        {[40, 75, 55, 90, 65, 100, 45].map((height, i) => (
          <motion.div
            key={i}
            animate={
              reducedMotion
                ? { height: `${height}%` }
                : {
                    height: [`${height * 0.4}%`, `${height}%`, `${height * 0.5}%`],
                    opacity: [0.4, 0.9, 0.4],
                  }
            }
            transition={{
              duration: 2.2,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
            className="w-3 rounded-sm bg-accent-warm/70"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <h3 className="text-sm font-semibold text-t-primary mb-1">Statistical Distributions &amp; Patterns</h3>
      <p className="text-caption text-t-secondary max-w-sm">
        Calculates skewness, kurtosis, interquartile ranges, outlier anomalies, and Pearson/Spearman correlation matrices.
      </p>
    </div>
  );
}

export function SQLEmpty() {
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[360px] border border-dashed border-b-subtle rounded-xl bg-canvas text-center">
      <div className="w-72 p-3 rounded-xl bg-surface-2 border border-b-subtle mb-4 text-left font-mono text-[11px] space-y-1.5 shadow-subtle">
        <div className="flex items-center gap-1.5 pb-2 border-b border-b-subtle text-t-tertiary">
          <Database className="h-3 w-3 text-accent-warm" />
          <span className="text-[10px]">duckdb_interactive.sql</span>
        </div>
        <div className="h-2 w-3/4 rounded bg-surface-3 shimmer" />
        <div className="h-2 w-1/2 rounded bg-surface-3 shimmer" />
        <div className="h-2 w-5/6 rounded bg-surface-3 shimmer" />
      </div>
      <h3 className="text-sm font-semibold text-t-primary mb-1">DuckDB In-Memory SQL Console</h3>
      <p className="text-caption text-t-secondary max-w-sm">
        Run analytical subqueries, window aggregations, and business metrics directly against the ingested dataset.
      </p>
    </div>
  );
}

export function DiagnosticsEmpty() {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[360px] border border-dashed border-b-subtle rounded-xl bg-canvas text-center">
      <motion.div
        variants={safeVariants(breathe, reducedMotion)}
        initial="initial"
        animate="animate"
        className="mb-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-b-subtle flex items-center justify-center shadow-subtle">
          <BrainCircuit className="h-8 w-8 text-accent-warm" />
        </div>
      </motion.div>
      <h3 className="text-sm font-semibold text-t-primary mb-1">Root-Cause Driver Attribution</h3>
      <p className="text-caption text-t-secondary max-w-sm">
        Isolate variance drivers, cohort divergence, and waterfall attribution models against your focal metric.
      </p>
    </div>
  );
}

export function VisualizationsEmpty() {
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[360px] border border-dashed border-b-subtle rounded-xl bg-canvas text-center">
      <div className="w-56 h-28 rounded-xl bg-surface-2 border border-b-subtle p-3 mb-4 flex items-end justify-between gap-2 shadow-subtle relative overflow-hidden">
        <div className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none" />
        {[30, 60, 45, 80, 50, 95].map((val, idx) => (
          <div key={idx} className="w-6 rounded bg-accent-cool/60" style={{ height: `${val}%` }} />
        ))}
      </div>
      <h3 className="text-sm font-semibold text-t-primary mb-1">Matplotlib &amp; Seaborn Visualizations</h3>
      <p className="text-caption text-t-secondary max-w-sm">
        Renders publication-grade charts with misleading-visualization audits, statistical annotations, and ZIP downloads.
      </p>
    </div>
  );
}

export function PowerBIEmpty() {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[360px] border border-dashed border-b-subtle rounded-xl bg-canvas text-center">
      {/* Rotating Star-Schema Wireframe */}
      <div className="relative w-28 h-28 mb-4 flex items-center justify-center">
        {/* Fact Table Center */}
        <div className="w-12 h-12 rounded-lg bg-surface-3 border-2 border-accent-warm/80 flex items-center justify-center font-mono text-[10px] text-accent-warm font-bold z-10 shadow-warm-glow">
          FACT
        </div>

        {/* Orbiting Dimension Tables */}
        <motion.div
          animate={reducedMotion ? { rotate: 0 } : { rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="absolute -top-1 w-7 h-7 rounded bg-surface-2 border border-accent-cool/60 flex items-center justify-center text-[8px] font-mono text-accent-cool">
            DIM
          </div>
          <div className="absolute -bottom-1 w-7 h-7 rounded bg-surface-2 border border-accent-cool/60 flex items-center justify-center text-[8px] font-mono text-accent-cool">
            DIM
          </div>
          <div className="absolute -left-1 w-7 h-7 rounded bg-surface-2 border border-accent-cool/60 flex items-center justify-center text-[8px] font-mono text-accent-cool">
            DIM
          </div>
          <div className="absolute -right-1 w-7 h-7 rounded bg-surface-2 border border-accent-cool/60 flex items-center justify-center text-[8px] font-mono text-accent-cool">
            DIM
          </div>
        </motion.div>
      </div>

      <h3 className="text-sm font-semibold text-t-primary mb-1">Power BI Star Schema &amp; TMDL</h3>
      <p className="text-caption text-t-secondary max-w-sm">
        Generates Star Schema fact/dim layouts, verified DAX measures, visual JSON specifications, and downloadable .PBIP bundles.
      </p>
    </div>
  );
}
