"use client";

import { AlertCircle, Play, RefreshCw, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { pressScale } from "@/lib/motion";

interface HypothesisFormProps {
  businessPrompt: string;
  targetMetric: string;
  isLoading: boolean;
  currentDatasetId: string | null;
  errorMessage: string | null;
  onBusinessPromptChange: (value: string) => void;
  onTargetMetricChange: (value: string) => void;
  onRunPipeline: () => void;
}

export function HypothesisForm({
  businessPrompt,
  targetMetric,
  isLoading,
  currentDatasetId,
  errorMessage,
  onBusinessPromptChange,
  onTargetMetricChange,
  onRunPipeline,
}: HypothesisFormProps) {
  return (
    <div className="bg-surface-1 rounded-2xl p-6 border border-b-subtle shadow-xl flex flex-col justify-between h-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-t-primary flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-warm" />
            <span>Business Hypothesis &amp; Focus Area</span>
          </h2>
          <span className="text-micro text-t-secondary font-mono">Strategic Context</span>
        </div>

        <div>
          <label className="block text-caption font-medium text-t-secondary mb-1.5">
            What business problem or anomaly would you like the agents to solve?
          </label>
          <textarea
            value={businessPrompt}
            onChange={(e) => onBusinessPromptChange(e.target.value)}
            rows={2}
            className="w-full text-caption sm:text-body rounded-xl border border-b-subtle bg-[#0A0B0F] p-3 focus:outline-none focus:border-accent-warm/60 focus:ring-1 focus:ring-accent-warm/30 transition-all text-t-primary resize-none placeholder:text-t-tertiary shadow-inner"
            placeholder="e.g. Identify why gross margin declined in Q3 and uncover primary churn drivers..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-caption font-medium text-t-secondary mb-1">
              Focal Target Metric <span className="text-micro text-t-tertiary font-mono">(Optional)</span>
            </label>
            <input
              type="text"
              value={targetMetric}
              onChange={(e) => onTargetMetricChange(e.target.value)}
              placeholder="e.g. gross_revenue, profit_margin"
              className="w-full text-caption rounded-xl border border-b-subtle bg-[#0A0B0F] p-2.5 focus:outline-none focus:border-accent-warm/60 focus:ring-1 focus:ring-accent-warm/30 text-t-primary font-mono placeholder:text-t-tertiary shadow-inner"
            />
          </div>

          <div className="flex items-end gap-2">
            <motion.button
              type="button"
              whileTap={pressScale.whileTap}
              onClick={onRunPipeline}
              disabled={isLoading || !currentDatasetId}
              className="w-full py-2.5 px-4 rounded-xl bg-accent-warm hover:bg-accent-warm/90 text-canvas font-semibold text-caption transition-all flex items-center justify-center gap-2 shadow-warm-glow active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-canvas" />
                  <span>RUNNING 7 AGENTS...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-canvas text-canvas" />
                  <span>RUN PIPELINE</span>
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-3 p-3 rounded-xl bg-surface-2 border border-accent-danger/40 text-caption text-t-primary flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-accent-danger" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

export default HypothesisForm;
