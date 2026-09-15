"use client";

import React, { KeyboardEvent, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import { tabPanel, safeVariants, usePrefersReducedMotion } from "@/lib/motion";

export type TabId =
  | "scorecard"
  | "preview"
  | "transformation"
  | "eda"
  | "sql"
  | "rootcause"
  | "visualizations"
  | "powerbi";

interface ResultTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  scorecardScore: number | null;
  previewMode: string;
  featuresCreated: number | null;
  numericSummaryCount: number | null;
  executedQueryCount: number | null;
  driverCount: number | null;
  chartCount: number | null;
  daxCount: number | null;
  currentDatasetId: string | null;
  currentSessionId: string | null;
  hasScorecard: boolean;
  hasTransformation: boolean;
  hasVisualization: boolean;
  hasPowerBI: boolean;
  children: React.ReactNode;
}

export function ResultTabs({
  activeTab,
  onTabChange,
  scorecardScore,
  previewMode,
  featuresCreated,
  numericSummaryCount,
  executedQueryCount,
  driverCount,
  chartCount,
  daxCount,
  currentDatasetId,
  currentSessionId,
  hasScorecard,
  hasTransformation,
  hasVisualization,
  hasPowerBI,
  children,
}: ResultTabsProps) {
  const reducedMotion = usePrefersReducedMotion();
  const tabsListRef = useRef<HTMLDivElement>(null);

  const tabs: { id: TabId; label: string; hasData: boolean }[] = [
    {
      id: "scorecard",
      label: `1. Quality & Profiling ${scorecardScore ? `(${scorecardScore}/100)` : ""}`,
      hasData: hasScorecard,
    },
    {
      id: "preview",
      label: `Dataset Preview (${previewMode})`,
      hasData: !!currentDatasetId,
    },
    {
      id: "transformation",
      label: `2. Data Transformation ${featuresCreated ? `(+${featuresCreated})` : ""}`,
      hasData: hasTransformation,
    },
    {
      id: "eda",
      label: `3. EDA & Insights ${numericSummaryCount ? `(${numericSummaryCount} cols)` : ""}`,
      hasData: (numericSummaryCount ?? 0) > 0,
    },
    {
      id: "sql",
      label: `4. SQL Studio ${executedQueryCount ? `(${executedQueryCount})` : ""}`,
      hasData: (executedQueryCount ?? 0) > 0,
    },
    {
      id: "rootcause",
      label: `5. Diagnostics ${driverCount ? `(${driverCount} drivers)` : ""}`,
      hasData: (driverCount ?? 0) > 0,
    },
    {
      id: "visualizations",
      label: `6. Visualizations ${chartCount ? `(${chartCount})` : ""}`,
      hasData: hasVisualization,
    },
    {
      id: "powerbi",
      label: `7. Power BI ${daxCount ? `(${daxCount} measures)` : ""}`,
      hasData: hasPowerBI,
    },
  ];

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let newIndex = index;
    if (e.key === "ArrowRight") {
      newIndex = (index + 1) % tabs.length;
    } else if (e.key === "ArrowLeft") {
      newIndex = (index - 1 + tabs.length) % tabs.length;
    }

    if (newIndex !== index) {
      onTabChange(tabs[newIndex].id);
      const buttons = tabsListRef.current?.querySelectorAll("button");
      if (buttons && buttons[newIndex]) {
        buttons[newIndex].focus();
      }
    }
  };

  return (
    <div className="bg-surface-1 rounded-2xl border border-b-subtle shadow-xl overflow-hidden flex flex-col min-h-[520px]">
      {/* Tab bar header */}
      <div
        className="border-b border-b-subtle px-6 py-3.5 flex items-center justify-between flex-wrap gap-3"
        role="tablist"
        ref={tabsListRef}
      >
        <div className="bg-canvas p-1.5 rounded-xl border border-b-subtle flex items-center gap-1 text-caption font-medium overflow-x-auto max-w-full custom-scrollbar">
          {tabs.map((tab, idx) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              onClick={() => onTabChange(tab.id)}
              className={`relative py-2 px-3 whitespace-nowrap outline-none transition-colors cursor-pointer rounded-lg flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "text-t-primary font-semibold"
                  : "text-t-secondary hover:text-t-primary bg-transparent border-none"
              }`}
            >
              {/* Sliding Layout Indicator */}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute inset-0 bg-surface-2 rounded-lg border border-b-subtle shadow-subtle -z-10"
                  transition={{ type: "spring", stiffness: 350, damping: 32 }}
                />
              )}

              {/* Dot marking tabs that have results */}
              {tab.hasData && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-accent-cool shrink-0 shadow-cool-glow"
                  title="Results ready"
                />
              )}

              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Global Export / Download Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {currentDatasetId && hasScorecard && (
            <a
              href={api.getDownloadUrl(currentDatasetId)}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-b-subtle hover:border-b-hover text-t-secondary hover:text-t-primary text-micro font-mono flex items-center gap-1.5 transition-colors"
              title="Download Cleaned CSV"
            >
              <Download className="h-3 w-3 text-accent-cool" />
              <span>Cleaned CSV</span>
            </a>
          )}
          {currentDatasetId && hasTransformation && (
            <a
              href={api.getTransformedDownloadUrl(currentDatasetId)}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-b-subtle hover:border-b-hover text-t-secondary hover:text-t-primary text-micro font-mono flex items-center gap-1.5 transition-colors"
              title="Download Transformed Features CSV"
            >
              <Download className="h-3 w-3 text-accent-cool" />
              <span>Features CSV</span>
            </a>
          )}
          {currentSessionId && hasVisualization && (
            <a
              href={api.getVisualizationBundleUrl(currentSessionId)}
              className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-b-subtle hover:border-b-hover text-t-secondary hover:text-t-primary text-micro font-mono flex items-center gap-1.5 transition-colors"
              title="Download Publication Charts ZIP"
            >
              <Download className="h-3 w-3 text-accent-warm" />
              <span>Charts ZIP</span>
            </a>
          )}
          {currentSessionId && hasPowerBI && (
            <a
              href={api.getPbipDownloadUrl(currentSessionId)}
              className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-b-subtle hover:border-b-hover text-t-secondary hover:text-t-primary text-micro font-mono flex items-center gap-1.5 transition-colors"
              title="Download Power BI .PBIP Project Bundle"
            >
              <Download className="h-3 w-3 text-accent-warm" />
              <span>.PBIP Bundle</span>
            </a>
          )}
        </div>
      </div>

      {/* Cross-fading tab panel with 8px translate */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={safeVariants(tabPanel, reducedMotion)}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ResultTabs;
