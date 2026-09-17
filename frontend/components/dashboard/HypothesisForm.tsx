"use client";

import { AlertCircle, Check, Play, RefreshCw, Sparkles, Upload } from "lucide-react";
import { motion } from "motion/react";
import { pressScale } from "@/lib/motion";

interface HypothesisFormProps {
  businessPrompt: string;
  targetMetric: string;
  isLoading: boolean;
  currentDatasetId: string | null;
  errorMessage: string | null;
  recommendedQuestions?: Array<{ title: string; desc: string; prompt: string }>;
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
  recommendedQuestions = [],
  onBusinessPromptChange,
  onTargetMetricChange,
  onRunPipeline,
}: HypothesisFormProps) {
  const trimmedPrompt = businessPrompt.trim();
  const promptWords = trimmedPrompt.split(/\s+/).filter(Boolean);
  const isProperStatement = trimmedPrompt.length >= 10 && promptWords.length >= 3;
  const isRunDisabled = isLoading || !currentDatasetId || !isProperStatement;

  return (
    <div className="bg-surface-1 rounded-2xl p-6 border border-b-subtle shadow-xl flex flex-col justify-between h-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-t-primary flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-warm" />
            <span>Business Hypothesis &amp; Focus Area</span>
          </h2>
          <span className="text-micro text-t-secondary font-mono">Agent 0 Grounding</span>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-caption font-medium text-t-primary flex items-center gap-1.5">
              <span>Business Problem Statement</span>
              <span className="text-[10px] font-semibold text-accent-warm bg-accent-warm/15 px-1.5 py-0.5 rounded border border-accent-warm/30 uppercase tracking-wider">
                Required
              </span>
            </label>
            <span className="text-micro text-t-secondary font-mono">
              {trimmedPrompt.length > 0
                ? `${trimmedPrompt.length} chars • ${promptWords.length} words`
                : "Mandatory to run"}
            </span>
          </div>

          <textarea
            value={businessPrompt}
            onChange={(e) => onBusinessPromptChange(e.target.value)}
            rows={2}
            className={`w-full text-caption sm:text-body rounded-xl border bg-[#0A0B0F] p-3 focus:outline-none transition-all text-t-primary resize-none placeholder:text-t-tertiary shadow-inner ${
              !trimmedPrompt
                ? "border-b-subtle focus:border-accent-warm/60 focus:ring-1 focus:ring-accent-warm/30"
                : isProperStatement
                ? "border-emerald-500/40 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30"
                : "border-amber-500/50 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30"
            }`}
            placeholder="e.g. Predict population after 20 years, or identify why gross margin declined in Q3..."
          />

          <div className="mt-1.5 flex items-center justify-between text-micro font-mono">
            {!currentDatasetId ? (
              <span className="text-t-tertiary">Step 1: Upload a dataset to begin</span>
            ) : !trimmedPrompt ? (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 inline shrink-0" />
                Problem statement is required before running the pipeline
              </span>
            ) : !isProperStatement ? (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 inline shrink-0" />
                Need at least 10 chars &amp; 3 words ({trimmedPrompt.length}/10 chars, {promptWords.length}/3 words)
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <Check className="h-3 w-3 inline shrink-0" />
                Problem statement validated for Agent 0
              </span>
            )}
          </div>

          {recommendedQuestions.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-b-subtle/50">
              <span className="text-[11px] text-t-tertiary font-mono block mb-1.5">
                Recommended problem statements for this dataset:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {recommendedQuestions.slice(0, 3).map((rq, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onBusinessPromptChange(rq.prompt)}
                    className="text-micro px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 border border-b-subtle text-t-secondary hover:text-accent-warm transition-all text-left"
                    title={rq.prompt}
                  >
                    💡 {rq.title || rq.prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
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
              placeholder="e.g. 2022 Population, gross_revenue"
              className="w-full text-caption rounded-xl border border-b-subtle bg-[#0A0B0F] p-2.5 focus:outline-none focus:border-accent-warm/60 focus:ring-1 focus:ring-accent-warm/30 text-t-primary font-mono placeholder:text-t-tertiary shadow-inner"
            />
          </div>

          <div className="flex items-end gap-2">
            <motion.button
              type="button"
              whileTap={pressScale.whileTap}
              onClick={onRunPipeline}
              disabled={isRunDisabled}
              title={
                !currentDatasetId
                  ? "Please upload a dataset first"
                  : !isProperStatement
                  ? "Please enter a valid problem statement (min 10 characters, 3 words) to run the pipeline"
                  : "Execute 7-agent analytical pipeline"
              }
              className={`w-full py-2.5 px-4 rounded-xl font-semibold text-caption transition-all flex items-center justify-center gap-2 ${
                isRunDisabled
                  ? "bg-surface-2 text-t-tertiary border border-b-subtle opacity-60 cursor-not-allowed"
                  : "bg-accent-warm hover:bg-accent-warm/90 text-canvas shadow-warm-glow active:scale-[0.98] cursor-pointer"
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-canvas" />
                  <span>RUNNING 7 AGENTS...</span>
                </>
              ) : !currentDatasetId ? (
                <>
                  <Upload className="h-4 w-4" />
                  <span>UPLOAD DATASET FIRST</span>
                </>
              ) : !isProperStatement ? (
                <>
                  <Play className="h-4 w-4 opacity-50" />
                  <span>ENTER PROBLEM STATEMENT</span>
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
