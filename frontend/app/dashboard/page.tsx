"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Download,
  Copy,
  Check,
  ChevronRight,
  Database,
  BarChart2,
  BrainCircuit,
  Layers,
  ShieldCheck,
  RefreshCw,
  Table,
  Play,
  FileCheck,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  FileCode,
  LayoutGrid,
  Image as ImageIcon,
  Terminal,
  Search,
  ExternalLink,
  Maximize2,
  X,
  Sliders,
} from "lucide-react";

import { PipelineTrack } from "@/components/dashboard/PipelineTrack";
import { Dropzone } from "@/components/dashboard/Dropzone";
import { HypothesisForm } from "@/components/dashboard/HypothesisForm";
import { ResultTabs, TabId } from "@/components/dashboard/ResultTabs";
import { 
  QualityEmpty, 
  TransformationEmpty, 
  EDAEmpty, 
  SQLEmpty, 
  DiagnosticsEmpty, 
  VisualizationsEmpty, 
  PowerBIEmpty 
} from "@/components/dashboard/EmptyStates";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { LogoMark } from "@/components/LogoMark";

import { api, CleanDatasetResult, UploadDatasetResult } from "@/lib/api";
import {
  AgentRole,
  PipelineStatus,
  DatasetMetadata,
  CleaningQualityScorecard,
  AuditRuleLog,
  ColumnProfilingSummary,
  RecommendationItem,
  BeforeAfterComparison,
  DataTransformationOutput,
  TransformedFeatureMeta,
  TransformationStepLog,
  NumericSummary,
  CategoricalSummary,
  CorrelationEntry,
  OutlierAnomaly,
  BusinessInsightItem,
  ExecutiveDataStory,
  EDAFeatureOutput,
  SQLQueryResult,
  SQLTableSchema,
  SQLTemplate,
  SQLAnalyticsOutput,
  KeyDriver,
  CohortComparison,
  NarrativeSummary,
  RootCauseOutput,
  RenderedChart,
  ChartRecommendation,
  VisualKPICard,
  DataVisualizationOutput,
  StarSchemaDimension,
  StarSchemaRelationship,
  StarSchemaLayout,
  DAXMeasure,
  VisualSpecification,
  PowerBIArchitectOutput,
  AgentState,
} from "@/lib/types";

export default function DashboardPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentDatasetId, setCurrentDatasetId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [datasetMeta, setDatasetMeta] = useState<DatasetMetadata | null>(null);
  const [rawPreview, setRawPreview] = useState<Record<string, unknown>[]>([]);
  const [cleanPreview, setCleanPreview] = useState<Record<string, unknown>[]>([]);
  const [transformedPreview, setTransformedPreview] = useState<Record<string, unknown>[]>([]);
  const [previewMode, setPreviewMode] = useState<"raw" | "cleaned" | "transformed" | "sql">("raw");

  const [businessPrompt, setBusinessPrompt] = useState("");
  const [targetMetric, setTargetMetric] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>("idle");
  const [activeTab, setActiveTab] = useState<
    | "scorecard"
    | "preview"
    | "transformation"
    | "eda"
    | "sql"
    | "rootcause"
    | "visualizations"
    | "powerbi"
  >("scorecard");
  const [activeAgent, setActiveAgent] = useState<AgentRole>("data_cleaner");

  // Multi-Agent Outputs (7 Agents)
  // Agent 1: Data Cleaner
  const [scorecard, setScorecard] = useState<CleaningQualityScorecard | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditRuleLog[]>([]);
  const [profiling, setProfiling] = useState<ColumnProfilingSummary[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [beforeAfter, setBeforeAfter] = useState<BeforeAfterComparison | null>(null);

  // Agent 2: Data Transformer
  const [transformationOutput, setTransformationOutput] = useState<DataTransformationOutput | null>(null);

  // Agent 3: EDA & Features
  const [edaOutput, setEdaOutput] = useState<EDAFeatureOutput | null>(null);

  // Agent 4: SQL Analytics
  const [sqlOutput, setSqlOutput] = useState<SQLAnalyticsOutput | null>(null);
  const [sqlQuery, setSqlQuery] = useState<string>("SELECT * FROM analytics_data LIMIT 10;");
  const [sqlQueryName, setSqlQueryName] = useState<string>("Custom Query");
  const [sqlResult, setSqlResult] = useState<SQLQueryResult | null>(null);
  const [sqlTemplates, setSqlTemplates] = useState<SQLTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [sqlRunning, setSqlRunning] = useState<boolean>(false);
  const [sqlError, setSqlError] = useState<string | null>(null);

  // Agent 5: Root-Cause Diagnostics
  const [rootCauseOutput, setRootCauseOutput] = useState<RootCauseOutput | null>(null);

  // Agent 6: Data Visualizations (Matplotlib & Seaborn)
  const [visualizationOutput, setVisualizationOutput] = useState<DataVisualizationOutput | null>(null);
  const [customChartType, setCustomChartType] = useState<string>("bar");
  const [customXCol, setCustomXCol] = useState<string>("");
  const [customYCol, setCustomYCol] = useState<string>("");
  const [customHueCol, setCustomHueCol] = useState<string>("");
  const [customTitle, setCustomTitle] = useState<string>("");
  const [customChart, setCustomChart] = useState<RenderedChart | null>(null);
  const [customVizRunning, setCustomVizRunning] = useState<boolean>(false);
  const [customVizError, setCustomVizError] = useState<string | null>(null);
  const [zoomChart, setZoomChart] = useState<RenderedChart | null>(null);

  // Agent 7: Power BI Architect
  const [powerbiOutput, setPowerbiOutput] = useState<PowerBIArchitectOutput | null>(null);

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 7-Agent Architecture Roster
  const agents = [
    {
      id: "data_cleaner" as AgentRole,
      name: "Data Wrangling & Quality",
      icon: ShieldCheck,
      desc: "Schema casting, missing imputation & deduplication",
    },
    {
      id: "data_transformer" as AgentRole,
      name: "Feature Engineering",
      icon: Sparkles,
      desc: "Scaling, binning, encoding & calendar extraction",
    },
    {
      id: "eda_features" as AgentRole,
      name: "Exploratory Data Analysis",
      icon: BarChart2,
      desc: "Distributions, correlations, outliers & data story",
    },
    {
      id: "sql_analytics" as AgentRole,
      name: "SQL Analytics Studio",
      icon: Database,
      desc: "DuckDB in-memory analytical queries & KPI templates",
    },
    {
      id: "root_cause_engine" as AgentRole,
      name: "Root-Cause Diagnostics",
      icon: BrainCircuit,
      desc: "Key driver attribution & cohort divergence",
    },
    {
      id: "data_visualizer" as AgentRole,
      name: "Data Visualizations",
      icon: TrendingUp,
      desc: "Matplotlib & Seaborn publication charts & bias audit",
    },
    {
      id: "powerbi_architect" as AgentRole,
      name: "Power BI Architect",
      icon: Layers,
      desc: "Star Schema, verified DAX & downloadable .pbip",
    },
  ];

  // Fetch SQL Templates on component mount
  useEffect(() => {
    api
      .getSQLTemplates()
      .then((res: { templates?: SQLTemplate[] } | SQLTemplate[]) => {
        if (Array.isArray(res)) {
          setSqlTemplates(res);
        } else if (res && Array.isArray(res.templates)) {
          setSqlTemplates(res.templates);
        } else {
          setSqlTemplates([]);
        }
      })
      .catch(() => {
        setSqlTemplates([]);
      });
  }, []);

  // Update default X and Y columns when metadata arrives
  useEffect(() => {
    if (datasetMeta && datasetMeta.columns.length > 0) {
      const numCols = datasetMeta.columns
        .filter((c) => c.inferred_type.includes("Int") || c.inferred_type.includes("Float"))
        .map((c) => c.name);
      const catCols = datasetMeta.columns
        .filter((c) => !c.inferred_type.includes("Int") && !c.inferred_type.includes("Float"))
        .map((c) => c.name);

      if (catCols.length > 0) {
        setCustomXCol(catCols[0]);
      } else if (datasetMeta.columns.length > 0) {
        setCustomXCol(datasetMeta.columns[0].name);
      }

      if (numCols.length > 0) {
        setCustomYCol(numCols[0]);
      } else if (datasetMeta.columns.length > 1) {
        setCustomYCol(datasetMeta.columns[1].name);
      }
    }
  }, [datasetMeta]);

  // Copy DAX to Clipboard
  const handleCopyDax = (dax: string, index: number) => {
    navigator.clipboard.writeText(dax);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Copy SQL to Clipboard
  const handleCopySql = (queryText: string) => {
    navigator.clipboard.writeText(queryText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Load Demo Dataset
  const handleLoadDemo = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.loadSampleDataset();
      setCurrentDatasetId(res.dataset_id);
      setDatasetMeta(res.metadata);
      setRawPreview(res.preview_rows);
      setCleanPreview([]);
      setTransformedPreview([]);
      setScorecard(null);
      setAuditTrail([]);
      setProfiling([]);
      setRecommendations([]);
      setBeforeAfter(null);
      setTransformationOutput(null);
      setEdaOutput(null);
      setSqlOutput(null);
      setSqlResult(null);
      setRootCauseOutput(null);
      setVisualizationOutput(null);
      setCustomChart(null);
      setPowerbiOutput(null);
      setCurrentSessionId(null);
      setPipelineStatus("idle");
      setPreviewMode("raw");

      if (typeof window !== "undefined") {
        localStorage.setItem(
          "active_dataset",
          JSON.stringify({
            dataset_id: res.dataset_id,
            filename: res.metadata.file_name || "sample_business_sales.csv",
            row_count: res.metadata.row_count,
            column_count: res.metadata.column_count,
            recommended_questions: res.recommended_questions || [],
          })
        );
        window.dispatchEvent(new Event("active_dataset_updated"));
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load sample dataset");
    } finally {
      setIsLoading(false);
    }
  };

  // Upload File
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await api.uploadDataset(file);
        setCurrentDatasetId(res.dataset_id);
        setDatasetMeta(res.metadata);
        setRawPreview(res.preview_rows);
        setCleanPreview([]);
        setTransformedPreview([]);
        setScorecard(null);
        setAuditTrail([]);
        setProfiling([]);
        setRecommendations([]);
        setBeforeAfter(null);
        setTransformationOutput(null);
        setEdaOutput(null);
        setSqlOutput(null);
        setSqlResult(null);
        setRootCauseOutput(null);
        setVisualizationOutput(null);
        setCustomChart(null);
        setPowerbiOutput(null);
        setCurrentSessionId(null);
        setPipelineStatus("idle");
        setPreviewMode("raw");

        if (typeof window !== "undefined") {
          localStorage.setItem(
            "active_dataset",
            JSON.stringify({
              dataset_id: res.dataset_id,
              filename: file.name,
              row_count: res.metadata.row_count,
              column_count: res.metadata.column_count,
              recommended_questions: res.recommended_questions || [],
            })
          );
          window.dispatchEvent(new Event("active_dataset_updated"));
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to upload file");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Run Full Multi-Agent Pipeline (All 7 Agents: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7)
  const handleRunFullPipeline = async () => {
    if (!currentDatasetId) {
      setErrorMessage("Please upload a dataset or load the demo dataset first.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setPipelineStatus("cleaning");
    setActiveAgent("data_cleaner");

    try {
      const state: AgentState = await api.startPipeline(
        currentDatasetId,
        businessPrompt,
        targetMetric,
        (liveState) => {
          if (liveState.status) {
            setPipelineStatus(liveState.status as PipelineStatus);
          }
          if (liveState.current_agent) {
            setActiveAgent(liveState.current_agent as AgentRole);
          }
          if (liveState.session_id) {
            setCurrentSessionId(liveState.session_id);
          }
        }
      );

      setCurrentSessionId(state.session_id);

      // Unpack Agent 1: Data Cleaner
      if (state.cleaning) {
        setScorecard(state.cleaning.scorecard);
        setAuditTrail(state.cleaning.audit_trail);
        if (state.cleaning.profiling) setProfiling(state.cleaning.profiling);
        if (state.cleaning.recommendations) setRecommendations(state.cleaning.recommendations);
        if (state.cleaning.before_after) setBeforeAfter(state.cleaning.before_after);
      }

      // Unpack Agent 2: Data Transformer
      if (state.transformation) {
        setTransformationOutput(state.transformation);
      }

      // Unpack Agent 3: EDA & Features
      if (state.eda) {
        setEdaOutput(state.eda);
      }

      // Unpack Agent 4: SQL Analytics
      if (state.sql_analytics) {
        setSqlOutput(state.sql_analytics);
        if (state.sql_analytics.available_templates.length > 0) {
          setSqlTemplates(state.sql_analytics.available_templates);
        }
        if (state.sql_analytics.executed_queries.length > 0) {
          setSqlResult(state.sql_analytics.executed_queries[0]);
          setSqlQuery(state.sql_analytics.executed_queries[0].sql_query);
          setSqlQueryName(state.sql_analytics.executed_queries[0].query_name);
        }
      }

      // Unpack Agent 5: Root-Cause Diagnostics
      if (state.root_cause) {
        setRootCauseOutput(state.root_cause);
      }

      // Unpack Agent 6: Matplotlib & Seaborn Visualizations
      if (state.visualization) {
        setVisualizationOutput(state.visualization);
      }

      // Unpack Agent 7: Power BI Architect
      if (state.powerbi) {
        setPowerbiOutput(state.powerbi);
      }

      // Fetch cleaned & transformed previews
      const prev = await api.getDatasetPreview(currentDatasetId);
      if (prev.clean_preview) setCleanPreview(prev.clean_preview);
      if (prev.transformed_preview) setTransformedPreview(prev.transformed_preview);

      setPipelineStatus("completed");
      setActiveTab("visualizations");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Multi-agent pipeline failed");
      setPipelineStatus("failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Interactive SQL Runner
  const handleRunSQL = async () => {
    if (!currentDatasetId) {
      setSqlError("Please load a dataset first.");
      return;
    }
    setSqlRunning(true);
    setSqlError(null);
    try {
      const res = await api.executeSQL({
        dataset_id: currentDatasetId,
        sql_query: sqlQuery,
        query_name: sqlQueryName || "Interactive Query",
      });
      setSqlResult(res);
      setPreviewMode("sql");
    } catch (err: unknown) {
      setSqlError(err instanceof Error ? err.message : "SQL execution failed");
    } finally {
      setSqlRunning(false);
    }
  };

  // Select Template SQL
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = sqlTemplates?.find((t) => t.template_id === templateId);
    if (tmpl) {
      setSqlQuery(tmpl.sql_query);
      setSqlQueryName(tmpl.name);
    }
  };

  // Interactive Custom Chart Generator
  const handleGenerateCustomChart = async () => {
    if (!currentDatasetId) {
      setCustomVizError("Please load a dataset first.");
      return;
    }
    if (!customXCol) {
      setCustomVizError("Please select an X column.");
      return;
    }
    setCustomVizRunning(true);
    setCustomVizError(null);
    try {
      const res = await api.generateCustomChart({
        dataset_id: currentDatasetId,
        chart_type: customChartType,
        x_col: customXCol,
        y_col: customYCol || undefined,
        hue_col: customHueCol || undefined,
        title: customTitle || `${customChartType.toUpperCase()} of ${customXCol}${customYCol ? ` vs ${customYCol}` : ""}`,
      });
      setCustomChart(res);
    } catch (err: unknown) {
      setCustomVizError(err instanceof Error ? err.message : "Custom chart generation failed");
    } finally {
      setCustomVizRunning(false);
    }
  };

  // Determine rows for Table Preview
  let displayRows: Record<string, unknown>[] = [];
  if (previewMode === "raw") {
    displayRows = rawPreview;
  } else if (previewMode === "cleaned") {
    displayRows = cleanPreview.length > 0 ? cleanPreview : rawPreview;
  } else if (previewMode === "transformed") {
    displayRows = transformedPreview.length > 0 ? transformedPreview : cleanPreview.length > 0 ? cleanPreview : rawPreview;
  } else if (previewMode === "sql" && sqlResult && sqlResult.rows) {
    displayRows = sqlResult.rows;
  }
  const tableColumns = displayRows.length > 0 ? Object.keys(displayRows[0]) : [];

  
  const completedAgents = {
    data_cleaner: scorecard !== null,
    data_transformer: transformationOutput !== null,
    eda_features: edaOutput !== null,
    sql_analytics: sqlOutput !== null,
    root_cause_engine: rootCauseOutput !== null,
    data_visualizer: visualizationOutput !== null,
    powerbi_architect: powerbiOutput !== null,
  };

  return (
    <div className="min-h-screen bg-canvas pb-24 text-t-primary">
      {/* Top Header */}
      <header className="border-b border-b-subtle bg-surface-2/95 backdrop-blur-md sticky top-0 z-40">
        <div className="w-full px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className=" px-3 py-1.5 text-xs font-semibold gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Link>
            <div className="h-4 w-px bg-b-subtle" />
            <div className="flex items-center gap-2.5">
              <LogoMark
                size={28}
                state={
                  pipelineStatus !== "idle" && pipelineStatus !== "completed" && pipelineStatus !== "failed"
                    ? "think"
                    : pipelineStatus === "completed"
                    ? "done"
                    : "idle"
                }
              />
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-t-primary">
                  DataAnalyst<span className="font-medium text-t-secondary opacity-75">.Ai</span>
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 border border-b-subtle text-t-secondary font-mono">
                  Workspace
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-6 lg:px-8 pt-8 space-y-8">
        {/* Row 1: Dropzone + HypothesisForm */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Dropzone
              datasetMeta={datasetMeta}
              isLoading={isLoading}
              onFileChange={handleFileChange}
              onLoadDemo={handleLoadDemo}
            />
          </div>
          <div className="lg:col-span-2">
            <HypothesisForm
              businessPrompt={businessPrompt}
              targetMetric={targetMetric}
              isLoading={isLoading}
              currentDatasetId={currentDatasetId}
              errorMessage={errorMessage}
              onBusinessPromptChange={setBusinessPrompt}
              onTargetMetricChange={setTargetMetric}
              onRunPipeline={handleRunFullPipeline}
            />
          </div>
        </section>

        {/* Row 2: Pipeline Track */}
        <PipelineTrack
          pipelineStatus={pipelineStatus}
          activeAgent={activeAgent}
          completedAgents={completedAgents}
        />

        {/* Row 3: Result Tabs with content */}
        <ResultTabs
          activeTab={activeTab as TabId}
          onTabChange={(t) => setActiveTab(t as any)}
          scorecardScore={scorecard?.overall_score ?? null}
          previewMode={previewMode}
          featuresCreated={transformationOutput?.features_created ?? null}
          numericSummaryCount={edaOutput?.numeric_summaries?.length ?? null}
          executedQueryCount={sqlOutput?.executed_queries?.length ?? null}
          driverCount={rootCauseOutput?.drivers?.length ?? null}
          chartCount={visualizationOutput?.rendered_charts?.length ?? null}
          daxCount={powerbiOutput?.dax_catalog?.length ?? null}
          currentDatasetId={currentDatasetId}
          currentSessionId={currentSessionId}
          hasScorecard={scorecard !== null}
          hasTransformation={transformationOutput !== null}
          hasVisualization={visualizationOutput !== null}
          hasPowerBI={powerbiOutput !== null}
        >
          <div className="p-6">
{/* ========================================================================= */}
            {/* TAB 1: Quality Scorecard & Column Profiling (Agent 1)                      */}
            {/* ========================================================================= */}
            {activeTab === "scorecard" && (
              <div className="space-y-6">
                {scorecard ? (
                  <>
                    {/* Scorecard Summary Metrics */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                      <div className="p-4 rounded-xl bg-surface-2 border border-b-subtle">
                        <span className="text-xs text-t-secondary">Overall Quality Score</span>
                        <p className="text-2xl font-mono font-bold text-t-primary mt-1">
                          <AnimatedNumber value={scorecard.overall_score} /> <span className="text-xs text-t-secondary">/ 100</span>
                        </p>
                        <span className="text-[11px] text-accent-cool font-medium">
                          ✓ Ready for Analysis &amp; Modeling
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-surface-2 border border-b-subtle">
                        <span className="text-xs text-t-secondary">Completeness</span>
                        <p className="text-2xl font-mono font-bold text-t-primary mt-1">
                          <AnimatedNumber value={scorecard.completeness} />%
                        </p>
                        <span className="text-[11px] text-t-secondary font-mono">
                          {scorecard.total_nulls_imputed} nulls imputed
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-surface-2 border border-b-subtle">
                        <span className="text-xs text-t-secondary">Type Validity</span>
                        <p className="text-2xl font-mono font-bold text-t-primary mt-1">
                          <AnimatedNumber value={scorecard.type_validity} />%
                        </p>
                        <span className="text-[11px] text-t-secondary font-mono">
                          Strict Polars schema casting
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-surface-2 border border-b-subtle">
                        <span className="text-xs text-t-secondary">Duplicate-Free</span>
                        <p className="text-2xl font-mono font-bold text-t-primary mt-1">
                          <AnimatedNumber value={scorecard.duplicate_free} />%
                        </p>
                        <span className="text-[11px] text-t-secondary font-mono">
                          Exact &amp; key deduplication
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-surface-2 border border-b-subtle">
                        <span className="text-xs text-t-secondary">Cleaned Rows</span>
                        <p className="text-2xl font-mono font-bold text-t-primary mt-1">
                          <AnimatedNumber value={scorecard.total_rows_cleaned} />
                        </p>
                        <span className="text-[11px] text-t-secondary font-mono">
                          Consistency: {scorecard.consistency ?? 95}%
                        </span>
                      </div>
                    </div>

                    {/* Before vs After Comparison Card */}
                    {beforeAfter && (
                      <div className="p-5 rounded-2xl bg-surface-2 border border-b-subtle">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-semibold text-t-primary flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-t-secondary" />
                            Before vs. After Cleaning Audit Comparison
                          </h4>
                          <span className="text-[11px] font-mono font-bold text-t-primary">
                            +{beforeAfter.null_improvement_pct}% Null Reduction
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
                          <div className="bg-surface-1 p-3 rounded-xl border border-b-subtle">
                            <span className="text-[10px] text-t-secondary uppercase">Total Rows</span>
                            <div className="font-bold text-t-primary text-sm mt-0.5">
                              {beforeAfter.before_rows} → {beforeAfter.after_rows}
                            </div>
                          </div>
                          <div className="bg-surface-1 p-3 rounded-xl border border-b-subtle">
                            <span className="text-[10px] text-t-secondary uppercase">Missing / Nulls</span>
                            <div className="font-bold text-t-primary text-sm mt-0.5">
                              <span>{beforeAfter.before_nulls}</span> → <span className="text-t-primary">{beforeAfter.after_nulls}</span>
                            </div>
                          </div>
                          <div className="bg-surface-1 p-3 rounded-xl border border-b-subtle">
                            <span className="text-[10px] text-t-secondary uppercase">Duplicates</span>
                            <div className="font-bold text-t-primary text-sm mt-0.5">
                              <span>{beforeAfter.before_duplicates}</span> → <span className="text-t-primary">{beforeAfter.after_duplicates}</span>
                            </div>
                          </div>
                          <div className="bg-surface-1 p-3 rounded-xl border border-b-subtle">
                            <span className="text-[10px] text-t-secondary uppercase">Outliers Handled</span>
                            <div className="font-bold text-t-primary text-sm mt-0.5">
                              {beforeAfter.before_outliers} flags
                            </div>
                          </div>
                          <div className="bg-surface-1 p-3 rounded-xl border border-b-subtle">
                            <span className="text-[10px] text-t-secondary uppercase">Deduplication</span>
                            <div className="font-bold text-t-primary text-sm mt-0.5">
                              {beforeAfter.duplicate_improvement_pct}% clean
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Column Profiling Summary Table */}
                    {profiling.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-semibold text-t-primary flex items-center gap-2">
                            <FileCheck className="h-4 w-4 text-t-secondary" />
                            Column Profiling &amp; Role Classification
                          </h4>
                          <span className="text-[11px] font-mono text-t-secondary">
                            {profiling.length} Columns Profiled
                          </span>
                        </div>
                        <div className="rounded-xl border border-b-subtle overflow-x-auto text-xs bg-surface-2">
                          <table className="w-full text-left">
                            <thead className="bg-surface-1 border-b border-b-subtle text-t-secondary font-medium font-mono text-[11px]">
                              <tr>
                                <th className="p-3">Column</th>
                                <th className="p-3">Role</th>
                                <th className="p-3">Polars Type</th>
                                <th className="p-3">Missing %</th>
                                <th className="p-3">Unique</th>
                                <th className="p-3">Outliers</th>
                                <th className="p-3">Summary Stats / Top Category</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2c2c2e] font-mono text-t-secondary">
                              {profiling.map((col) => (
                                <tr key={col.column_name} className="hover:bg-surface-1/50 transition-colors">
                                  <td className="p-3 font-semibold text-t-primary">{col.column_name}</td>
                                  <td className="p-3">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-1 border border-b-subtle text-t-primary">
                                      {col.role}
                                    </span>
                                  </td>
                                  <td className="p-3 text-t-secondary">{col.data_type}</td>
                                  <td className="p-3">
                                    <span className={col.missing_pct > 0 ? "text-t-primary font-bold" : "text-t-secondary"}>
                                      {col.missing_pct}% ({col.missing_count})
                                    </span>
                                  </td>
                                  <td className="p-3 text-t-secondary">{col.unique_count}</td>
                                  <td className="p-3">
                                    <span className={col.outlier_count > 0 ? "text-t-primary font-bold" : "text-t-secondary"}>
                                      {col.outlier_count}
                                    </span>
                                  </td>
                                  <td className="p-3 text-t-secondary truncate max-w-xs">
                                    {col.role === "numerical"
                                      ? `mean=${col.mean_val?.toLocaleString()} [${col.min_val}..${col.max_val}]`
                                      : col.top_categories.length > 0
                                      ? `top="${col.top_categories[0].value}" (${col.top_categories[0].count})`
                                      : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Cleaning Recommendations */}
                    {recommendations.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-t-primary mb-3 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-t-secondary" />
                          Proactive Data Quality Recommendations
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {recommendations.map((rec, i) => (
                            <div
                              key={i}
                              className="p-3.5 rounded-xl bg-surface-2 border border-b-subtle space-y-1.5 shadow-subtle"
                            >
                              <div className="flex items-center justify-between font-mono">
                                <span className="font-bold text-t-primary">{rec.column}</span>
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-surface-1 border border-b-subtle text-t-secondary">
                                  {rec.severity}
                                </span>
                              </div>
                              <p className="text-xs text-t-primary font-medium">{rec.issue}</p>
                              <div className="text-[11px] text-t-secondary bg-surface-1 p-2 rounded-lg font-mono border border-b-subtle">
                                <strong className="text-t-primary">Action:</strong> {rec.recommended_action}
                              </div>
                              <p className="text-[10px] text-t-secondary">{rec.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Audit Trail */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-t-primary">
                          Polars Automated Transformation Audit Trail
                        </h4>
                        <span className="text-[11px] font-mono text-t-secondary">
                          {auditTrail.length} Rules Executed
                        </span>
                      </div>
                      <div className="rounded-xl border border-b-subtle overflow-x-auto text-xs bg-surface-2">
                        <table className="w-full text-left">
                          <thead className="bg-surface-1 border-b border-b-subtle text-t-secondary font-medium">
                            <tr>
                              <th className="p-3">Column</th>
                              <th className="p-3">Operation</th>
                              <th className="p-3">Rationale</th>
                              <th className="p-3">Rows Impacted</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2c2c2e] text-t-secondary">
                            {auditTrail.map((log, i) => (
                              <tr key={i} className="hover:bg-surface-1/50 transition-colors">
                                <td className="p-3 font-mono font-medium text-t-primary">{log.column}</td>
                                <td className="p-3 font-semibold text-t-primary">{log.operation}</td>
                                <td className="p-3 text-t-secondary">{log.rationale}</td>
                                <td className="p-3 font-mono text-t-primary">{log.affected_rows}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 space-y-3">
                    <ShieldCheck className="h-10 w-10 text-b-hover mx-auto" />
                    <h4 className="text-sm font-semibold text-t-primary">
                      No Cleaning Run Yet
                    </h4>
                    <p className="text-xs text-t-secondary max-w-md mx-auto">
                      Load the demo dataset and click &quot;Run End-to-End Pipeline&quot; to inspect automated schema cleaning, profiling, and quality scoring.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB: Table Preview (Raw, Cleaned, Transformed, SQL Result)                 */}
            {/* ========================================================================= */}
            {activeTab === "preview" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className=" p-1 rounded-lg inline-flex text-xs font-medium">
                    <button
                      onClick={() => setPreviewMode("raw")}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        previewMode === "raw" ? "bg-surface-1 text-t-primary border border-b-hover shadow-sm font-bold" : "text-t-secondary hover:text-t-primary"
                      }`}
                    >
                      Raw Input ({rawPreview.length})
                    </button>
                    <button
                      onClick={() => setPreviewMode("cleaned")}
                      disabled={cleanPreview.length === 0}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        previewMode === "cleaned"
                          ? "bg-surface-1 text-t-primary border border-b-hover shadow-sm font-bold"
                          : cleanPreview.length === 0
                          ? "opacity-30 cursor-not-allowed"
                          : "text-t-secondary hover:text-t-primary"
                      }`}
                    >
                      Cleaned ({cleanPreview.length})
                    </button>
                    <button
                      onClick={() => setPreviewMode("transformed")}
                      disabled={transformedPreview.length === 0}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        previewMode === "transformed"
                          ? "bg-surface-1 text-t-primary border border-b-hover shadow-sm font-bold"
                          : transformedPreview.length === 0
                          ? "opacity-30 cursor-not-allowed"
                          : "text-t-secondary hover:text-t-primary"
                      }`}
                    >
                      Transformed ({transformedPreview.length})
                    </button>
                    <button
                      onClick={() => setPreviewMode("sql")}
                      disabled={!sqlResult}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        previewMode === "sql"
                          ? "bg-surface-1 text-t-primary border border-b-hover shadow-sm font-bold"
                          : !sqlResult
                          ? "opacity-30 cursor-not-allowed"
                          : "text-t-secondary hover:text-t-primary"
                      }`}
                    >
                      SQL Result ({sqlResult ? sqlResult.row_count : 0})
                    </button>
                  </div>
                </div>

                {displayRows.length > 0 ? (
                  <div className="rounded-xl border border-b-subtle overflow-x-auto text-xs max-h-[500px] bg-surface-2">
                    <table className="w-full text-left">
                      <thead className="bg-surface-1 border-b border-b-subtle text-t-secondary font-medium sticky top-0">
                        <tr>
                          {tableColumns.map((col) => (
                            <th key={col} className="p-3 font-mono whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2c2c2e]">
                        {displayRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-surface-1/50 transition-colors font-mono text-t-secondary">
                            {tableColumns.map((col) => (
                              <td key={col} className="p-3 truncate max-w-xs whitespace-nowrap">
                                {row[col] === null || row[col] === undefined ? (
                                  <span className="text-b-hover italic">null</span>
                                ) : (
                                  String(row[col])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <TransformationEmpty />
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: Feature Engineering & Data Transformation (Agent 2)               */}
            {/* ========================================================================= */}
            {activeTab === "transformation" && (
              <div className="space-y-6">
                {transformationOutput ? (
                  <>
                    {/* Transformation Overview Counters */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-surface-2 border border-b-subtle">
                        <span className="text-xs text-t-secondary">Total Features</span>
                        <p className="text-2xl font-mono font-bold text-t-primary mt-1">
                          {transformationOutput.total_features}
                        </p>
                        <span className="text-[11px] text-t-secondary font-mono">
                          Ready for modeling &amp; analytics
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-surface-2 border border-b-subtle">
                        <span className="text-xs text-t-secondary">Engineered Features Created</span>
                        <p className="text-2xl font-mono font-bold text-t-primary mt-1">
                          +{transformationOutput.features_created}
                        </p>
                        <span className="text-[11px] text-accent-cool font-mono">
                          Scaling, binning, temporal &amp; encodings
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-surface-2 border border-b-subtle">
                        <span className="text-xs text-t-secondary">Pipeline Operations Executed</span>
                        <p className="text-2xl font-mono font-bold text-t-primary mt-1">
                          {transformationOutput.transformation_history.length}
                        </p>
                        <span className="text-[11px] text-t-secondary font-mono">
                          Deterministic Polars pipeline
                        </span>
                      </div>
                    </div>

                    {/* Transformed Feature Catalog */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-t-primary flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-t-secondary" />
                          Engineered Features Catalog
                        </h4>
                        <span className="text-[11px] font-mono text-t-secondary">
                          {transformationOutput.feature_catalog.length} Engineered Features
                        </span>
                      </div>
                      <div className="rounded-xl border border-b-subtle overflow-x-auto text-xs bg-surface-2">
                        <table className="w-full text-left">
                          <thead className="bg-surface-1 border-b border-b-subtle text-t-secondary font-medium font-mono text-[11px]">
                            <tr>
                              <th className="p-3">Feature Name</th>
                              <th className="p-3">Type</th>
                              <th className="p-3">Data Type</th>
                              <th className="p-3">Formula / Logic</th>
                              <th className="p-3">Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2c2c2e] font-mono text-t-secondary">
                            {transformationOutput.feature_catalog.map((feat) => (
                              <tr key={feat.feature_name} className="hover:bg-surface-1/50 transition-colors">
                                <td className="p-3 font-semibold text-t-primary">{feat.feature_name}</td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-surface-1 border border-b-subtle text-t-primary">
                                    {feat.feature_type}
                                  </span>
                                </td>
                                <td className="p-3 text-t-secondary">{feat.data_type}</td>
                                <td className="p-3 font-mono text-t-primary truncate max-w-xs">
                                  {feat.formula}
                                </td>
                                <td className="p-3 text-t-secondary font-sans text-xs">
                                  {feat.description}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Step-by-Step Transformation History Log */}
                    <div>
                      <h4 className="text-xs font-semibold text-t-primary mb-3">
                        Transformation Execution Trace
                      </h4>
                      <div className="space-y-2">
                        {transformationOutput.transformation_history.map((step) => (
                          <div
                            key={step.step_index}
                            className="p-3 rounded-xl bg-surface-2 border border-b-subtle flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2 font-mono"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-t-secondary">0{step.step_index}.</span>
                              <span className="font-semibold text-t-primary">{step.operation}</span>
                              <span className="text-t-secondary">on</span>
                              <span className="font-bold text-t-primary">{step.column}</span>
                            </div>
                            <div className="text-t-secondary text-[11px] truncate">
                              <code>{step.formula}</code>
                            </div>
                            <div className="text-[11px] text-t-secondary">
                              {step.rows_affected.toLocaleString()} rows affected
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <TransformationEmpty />
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: Exploratory Data Analysis & Business Insights (Agent 3)            */}
            {/* ========================================================================= */}
            {activeTab === "eda" && (
              <div className="space-y-6">
                {edaOutput ? (
                  <>
                    {/* Executive Data Story Banner */}
                    {edaOutput.data_story && (
                      <div className="p-5 rounded-2xl bg-surface-2 border border-b-subtle space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-t-primary flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-t-secondary" />
                            Executive Data Story &amp; Synthesis
                          </h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-1 border border-b-subtle text-t-secondary font-semibold">
                            Agent 3 Automated Synthesis
                          </span>
                        </div>
                        <p className="text-xs text-t-secondary leading-relaxed">
                          {edaOutput.data_story.dataset_overview}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                          <div className="p-3 bg-surface-1 rounded-xl border border-b-subtle">
                            <span className="font-bold text-[11px] text-t-primary block mb-1">Key Patterns &amp; Trends:</span>
                            <ul className="space-y-1 text-t-secondary text-[11px]">
                              {edaOutput.data_story.key_patterns.map((p, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="text-t-primary">•</span>
                                  <span>{p}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="p-3 bg-surface-1 rounded-xl border border-b-subtle">
                            <span className="font-bold text-[11px] text-t-primary block mb-1">Recommended Next Analyses:</span>
                            <ul className="space-y-1 text-t-secondary text-[11px]">
                              {edaOutput.data_story.recommended_next_analysis.map((r, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="text-t-primary">→</span>
                                  <span>{r}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Automated Business Insights */}
                    {edaOutput.insights && edaOutput.insights.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-t-primary mb-3 flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-t-secondary" />
                          Automated Business Insights &amp; Findings
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                          {edaOutput.insights.map((ins, i) => (
                            <div
                              key={i}
                              className="p-3.5 rounded-xl bg-surface-2 border border-b-subtle space-y-1.5 shadow-subtle flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1 font-mono text-[10px]">
                                  <span className="uppercase text-t-secondary font-semibold">{ins.insight_type}</span>
                                  <span className="px-1.5 py-0.5 rounded font-bold uppercase bg-surface-1 border border-b-subtle text-t-secondary">
                                    {ins.severity}
                                  </span>
                                </div>
                                <h5 className="font-bold text-xs text-t-primary">{ins.title}</h5>
                                <p className="text-[11px] text-t-secondary mt-1">{ins.observation}</p>
                              </div>
                              <div className="pt-2 border-t border-b-subtle text-[10px] text-t-secondary font-mono">
                                <strong className="text-t-primary">Implication:</strong> {ins.business_implication}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Numeric Distribution Parameters */}
                    <div>
                      <h4 className="text-xs font-semibold text-t-primary mb-3">
                        Numeric Distribution Parameters &amp; Shape Classification
                      </h4>
                      <div className="rounded-xl border border-b-subtle overflow-x-auto text-xs bg-surface-2">
                        <table className="w-full text-left">
                          <thead className="bg-surface-1 border-b border-b-subtle text-t-secondary font-medium font-mono text-[11px]">
                            <tr>
                              <th className="p-3">Feature</th>
                              <th className="p-3">Count</th>
                              <th className="p-3">Mean</th>
                              <th className="p-3">Std Dev</th>
                              <th className="p-3">Median</th>
                              <th className="p-3">IQR</th>
                              <th className="p-3">Skewness</th>
                              <th className="p-3">Kurtosis</th>
                              <th className="p-3">Distribution Shape</th>
                              <th className="p-3">Recommended Transform</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2c2c2e] font-mono text-t-secondary">
                            {edaOutput.numeric_summaries.map((num) => (
                              <tr key={num.column} className="hover:bg-surface-1/50 transition-colors">
                                <td className="p-3 font-semibold text-t-primary">{num.column}</td>
                                <td className="p-3 text-t-secondary">{num.count}</td>
                                <td className="p-3">{num.mean.toLocaleString()}</td>
                                <td className="p-3 text-t-secondary">{num.std.toLocaleString()}</td>
                                <td className="p-3 font-bold text-t-primary">{num.median.toLocaleString()}</td>
                                <td className="p-3 text-t-secondary">{num.iqr.toLocaleString()}</td>
                                <td className="p-3">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-1 border border-b-subtle text-t-primary">
                                    {num.skewness}
                                  </span>
                                </td>
                                <td className="p-3 text-t-secondary">{num.kurtosis ?? 0}</td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-surface-1 border border-b-subtle text-t-secondary font-semibold">
                                    {num.distribution_shape ?? "normal_like"}
                                  </span>
                                </td>
                                <td className="p-3 text-t-primary font-bold text-[11px]">
                                  {num.recommended_transform ?? "None"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Categorical Summaries */}
                    {edaOutput.categorical_summaries && edaOutput.categorical_summaries.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-t-primary mb-3">
                          Categorical Cardinality &amp; Frequency Analysis
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                          {edaOutput.categorical_summaries.map((cat) => (
                            <div key={cat.column} className="p-3.5 rounded-xl bg-surface-2 border border-b-subtle space-y-1.5 font-mono">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-t-primary">{cat.column}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] bg-surface-1 border border-b-subtle text-t-secondary">
                                  {cat.cardinality_status}
                                </span>
                              </div>
                              <div className="text-[11px] text-t-secondary">
                                Unique Values: <strong className="text-t-primary">{cat.unique_count}</strong>
                              </div>
                              {cat.dominant_category && (
                                <div className="text-[11px] text-t-secondary">
                                  Dominant: <strong className="text-t-primary">{cat.dominant_category}</strong> ({cat.dominant_pct}%)
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cross-Feature Correlation Matrix */}
                    <div>
                      <h4 className="text-xs font-semibold text-t-primary mb-3">
                        Cross-Feature Correlation Matrix (Top Pairs)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                        {edaOutput.correlations.slice(0, 9).map((corr, idx) => {
                          const isPos = corr.pearson_r > 0;
                          return (
                            <div
                              key={idx}
                              className="p-3 rounded-xl bg-surface-2 border border-b-subtle flex items-center justify-between"
                            >
                              <div className="font-mono truncate pr-2 text-[11px]">
                                <span className="font-medium text-t-primary">{corr.feature_x}</span>
                                <span className="text-t-secondary mx-1">↔</span>
                                <span className="font-medium text-t-primary">{corr.feature_y}</span>
                              </div>
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-surface-1 border border-b-subtle text-t-primary">
                                {isPos ? `+${corr.pearson_r}` : corr.pearson_r}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Outlier Anomalies */}
                    {edaOutput.outliers.length > 0 && (
                      <div className="p-4 rounded-xl bg-surface-2 border border-b-subtle">
                        <div className="flex items-center gap-2 text-t-primary font-semibold text-xs mb-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-t-secondary" />
                          <span>Outlier Anomalies Detected (Tukey IQR &amp; Z-Score Methods)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {edaOutput.outliers.map((o) => (
                            <div key={o.column} className="bg-surface-1 border border-b-subtle p-2.5 rounded-lg font-mono">
                              <span className="font-bold text-t-primary">{o.column}:</span>{" "}
                              <span className="text-t-secondary font-semibold">{o.anomaly_count} outliers</span> ({o.outlier_pct ?? 0}%) beyond bounds [
                              {o.lower_bound} to {o.upper_bound}]
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <EDAEmpty />
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: SQL Studio & DuckDB Analytical Queries (Agent 4)                   */}
            {/* ========================================================================= */}
            {activeTab === "sql" && (
              <div className="space-y-6">
                {/* Engine Banner */}
                <div className="p-4 rounded-xl bg-surface-2 border border-b-subtle text-t-primary flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-t-primary" />
                    <div>
                      <h4 className="text-xs font-bold font-mono text-t-primary">DuckDB In-Memory Analytical Engine</h4>
                      <p className="text-[11px] text-t-secondary">
                        Columnar OLAP query execution with zero-copy table registration and SQL dialect harmonization.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-surface-1 border border-b-subtle text-t-secondary text-[11px] font-mono">
                    Read-Only Analytical Sandbox
                  </span>
                </div>

                {/* Templates Selector */}
                {(sqlTemplates?.length ?? 0) > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-t-primary mb-1.5">
                      Pre-Configured Business Query Templates:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {sqlTemplates?.map((t) => (
                        <button
                          key={t.template_id}
                          onClick={() => handleSelectTemplate(t.template_id)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-mono transition-all cursor-pointer ${
                            selectedTemplateId === t.template_id
                              ? "bg-surface-3 border border-b-hover text-t-primary font-bold shadow-sm"
                              : "bg-surface-2 border border-b-subtle text-t-secondary hover:text-t-primary hover:bg-surface-3"
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactive SQL Editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-t-primary flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-t-secondary" />
                      SQL Query Console:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopySql(sqlQuery)}
                        className="px-2.5 py-1 text-[11px] font-mono text-t-secondary hover:text-t-primary rounded bg-surface-2 border border-b-subtle hover:bg-surface-3 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {copiedSql ? <Check className="h-3 w-3 text-t-primary" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedSql ? "Copied" : "Copy SQL"}</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    rows={4}
                    className="w-full font-mono text-xs rounded-xl border border-b-subtle p-3 bg-surface-1 text-t-primary focus:outline-none focus:border-b-hover resize-none"
                    placeholder="SELECT * FROM analytics_data LIMIT 10;"
                  />

                  <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                    <input
                      type="text"
                      value={sqlQueryName}
                      onChange={(e) => setSqlQueryName(e.target.value)}
                      placeholder="Query name (optional)"
                      className="text-xs border border-b-subtle bg-surface-1 rounded-lg px-3 py-1.5 w-64 text-t-primary font-mono placeholder:text-t-secondary"
                    />
                    <button
                      onClick={handleRunSQL}
                      disabled={sqlRunning || !currentDatasetId}
                      className="px-4 py-2 text-xs font-semibold text-t-primary rounded-lg bg-surface-2 hover:bg-surface-3 border border-b-subtle hover:border-b-hover inline-flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      {sqlRunning ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Executing in DuckDB...</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-t-primary" />
                          <span>Run Query</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {sqlError && (
                  <div className="p-3 rounded-xl bg-surface-2 border border-b-hover text-xs text-t-primary flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-accent-warm" />
                    <span>{sqlError}</span>
                  </div>
                )}

                {/* Query Result Section */}
                {sqlResult ? (
                  <div className="space-y-4 pt-2 border-t border-b-subtle">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-surface-2 border border-b-subtle">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-xs font-mono text-t-primary">{sqlResult.query_name}</span>
                        <span className="text-[11px] font-mono text-t-secondary">
                          Rows: <strong className="text-t-primary">{sqlResult.row_count}</strong> • Time: <strong className="text-t-primary">{sqlResult.execution_time_ms} ms</strong>
                        </span>
                      </div>
                      {sqlResult.chart_recommendation && (
                        <span className="px-2.5 py-0.5 rounded-full bg-surface-1 border border-b-subtle text-t-secondary text-[11px] font-mono font-semibold">
                          Recommended Viz: {sqlResult.chart_recommendation}
                        </span>
                      )}
                    </div>

                    {sqlResult.explanation && (
                      <div className="p-3 rounded-xl bg-surface-2 border border-b-subtle text-xs text-t-secondary">
                        <strong className="text-t-primary">Business Logic:</strong> {sqlResult.explanation}
                      </div>
                    )}

                    {/* Result Table Preview */}
                    <div className="rounded-xl border border-b-subtle overflow-x-auto text-xs max-h-80 bg-surface-2">
                      <table className="w-full text-left">
                        <thead className="bg-surface-1 border-b border-b-subtle text-t-secondary font-medium sticky top-0 font-mono">
                          <tr>
                            {sqlResult.columns.map((c, i) => (
                              <th key={c} className="p-3 whitespace-nowrap">
                                <div>{c}</div>
                                <div className="text-[9px] text-t-secondary/80 font-normal">
                                  {sqlResult.column_types[i] ?? ""}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2c2c2e] font-mono text-t-secondary">
                          {sqlResult.rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-surface-1/50 transition-colors">
                              {sqlResult.columns.map((c) => (
                                <td key={c} className="p-3 whitespace-nowrap">
                                  {row[c] === null ? (
                                    <span className="text-t-secondary italic">null</span>
                                  ) : (
                                    String(row[c])
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <SQLEmpty />
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 5: Root-Cause Diagnostics & Drivers (Agent 5)                         */}
            {/* ========================================================================= */}
            {activeTab === "rootcause" && (
              <div className="space-y-6">
                {rootCauseOutput ? (
                  <>
                    {/* Executive Narrative */}
                    <div className="p-6 rounded-2xl bg-surface-2 border border-b-subtle space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-t-primary flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-t-secondary" />
                          Executive Diagnostic Narrative
                        </h4>
                        <span className="px-2.5 py-0.5 rounded-full bg-surface-1 border border-b-subtle text-t-secondary text-[11px] font-mono font-semibold">
                          Target: {rootCauseOutput.target_metric}
                        </span>
                      </div>

                      <div className="space-y-3 text-xs leading-relaxed text-t-secondary">
                        <p>
                          <strong className="text-t-primary">Macro Overview:</strong> {rootCauseOutput.narrative.what_happened}
                        </p>
                        <p>
                          <strong className="text-t-primary">Statistical Attribution:</strong> {rootCauseOutput.narrative.why_it_happened}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-b-subtle">
                        <h5 className="text-xs font-semibold text-t-primary flex items-center gap-1.5 mb-2">
                          <Lightbulb className="h-3.5 w-3.5 text-t-secondary" />
                          Strategic Recommendations
                        </h5>
                        <ul className="space-y-1.5 text-xs text-t-secondary">
                          {rootCauseOutput.narrative.recommended_interventions.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-t-primary font-bold font-mono">0{i + 1}.</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Key Drivers Ranking */}
                    <div>
                      <h4 className="text-xs font-semibold text-t-primary mb-3">
                        Key Statistical Drivers (Feature Importance)
                      </h4>
                      <div className="space-y-3">
                        {rootCauseOutput.drivers.map((driver) => (
                          <div
                            key={driver.feature}
                            className="p-4 rounded-xl bg-surface-2 border border-b-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-t-primary">{driver.feature}</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-1 border border-b-subtle text-t-secondary">
                                  {driver.impact_direction === "positive" ? (
                                    <TrendingUp className="h-3 w-3 text-accent-cool" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3 text-accent-warm" />
                                  )}
                                  {driver.impact_direction} correlation
                                </span>
                              </div>
                              <p className="text-t-secondary text-[11px]">{driver.description}</p>
                            </div>

                            <div className="sm:w-44 shrink-0 flex items-center gap-3">
                              <div className="flex-1 bg-surface-1 border border-b-subtle h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-accent-cool h-full rounded-full"
                                  style={{ width: `${driver.importance_score}%` }}
                                />
                              </div>
                              <span className="font-mono font-bold text-t-primary text-xs w-12 text-right">
                                {driver.importance_score}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cohort Divergence Analysis */}
                    {rootCauseOutput.cohorts.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-t-primary mb-3">
                          Cohort Performance Divergence
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                          {rootCauseOutput.cohorts.map((cohort, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 rounded-xl bg-surface-2 border border-b-subtle space-y-1.5"
                            >
                              <div className="flex items-center justify-between font-mono">
                                <span className="font-bold text-t-primary truncate">{cohort.cohort_name}</span>
                                <span className="text-[11px] text-t-secondary">n = {cohort.sample_size}</span>
                              </div>
                              <div className="text-xs font-mono text-t-secondary">
                                Avg: <span className="font-bold text-t-primary">{cohort.metrics.avg?.toLocaleString()}</span> • Total: {cohort.metrics.total?.toLocaleString()}
                              </div>
                              <p className="text-[11px] text-t-secondary">
                                {cohort.key_differentiators[0]}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <DiagnosticsEmpty />
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 6: Data Visualizations (Matplotlib & Seaborn) (Agent 6)                 */}
            {/* ========================================================================= */}
            {activeTab === "visualizations" && (
              <div className="space-y-8">
                {visualizationOutput ? (
                  <>
                    {/* Header with Bundle Download */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-surface-2 border border-b-subtle">
                      <div>
                        <h4 className="text-xs font-bold text-t-primary flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-t-secondary" />
                          Matplotlib &amp; Seaborn Publication-Grade Visualizations
                        </h4>
                        <p className="text-[11px] text-t-secondary mt-0.5">
                          High-resolution 300 DPI figures with anti-misleading data audit checks &amp; base64 instant rendering.
                        </p>
                      </div>
                      {currentSessionId && (
                        <a
                          href={api.getVisualizationBundleUrl(currentSessionId)}
                          className=" px-3 py-1.5 text-xs font-semibold gap-1.5 inline-flex items-center"
                        >
                          <Download className="h-3.5 w-3.5 text-t-primary" />
                          <span>Download All Charts (.ZIP)</span>
                        </a>
                      )}
                    </div>

                    {/* KPI Metric Cards */}
                    {visualizationOutput.kpi_cards.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {visualizationOutput.kpi_cards.map((kpi, i) => (
                          <div key={i} className="p-4 rounded-xl bg-surface-2 border border-b-subtle shadow-subtle space-y-1">
                            <span className="text-xs text-t-secondary">{kpi.title}</span>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-2xl font-mono font-bold text-t-primary">{kpi.formatted_value}</p>
                              {kpi.change_pct !== null && kpi.change_pct !== undefined && (
                                <span className="inline-flex items-center gap-0.5 text-xs font-mono font-bold px-2 py-0.5 rounded bg-surface-1 border border-b-subtle text-t-secondary">
                                  {kpi.trend_direction === "up" ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : kpi.trend_direction === "down" ? (
                                    <TrendingDown className="h-3 w-3" />
                                  ) : null}
                                  {kpi.change_pct > 0 ? `+${kpi.change_pct}%` : `${kpi.change_pct}%`}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-t-secondary font-mono">{kpi.description}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Chart Gallery Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {visualizationOutput.rendered_charts.map((chart) => (
                        <div
                          key={chart.chart_id}
                          className="bg-surface-2 rounded-2xl border border-b-subtle shadow-subtle overflow-hidden flex flex-col justify-between"
                        >
                          <div>
                            {/* Chart Card Header */}
                            <div className="p-4 border-b border-b-subtle flex items-center justify-between">
                              <div>
                                <h5 className="font-bold text-xs text-t-primary">{chart.title}</h5>
                                <p className="text-[10px] text-t-secondary font-mono">{chart.description}</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded uppercase text-[10px] font-mono font-semibold bg-surface-1 border border-b-subtle text-t-secondary">
                                  {chart.chart_type}
                                </span>
                                <button
                                  onClick={() => setZoomChart(chart)}
                                  className=" p-1.5 text-t-secondary hover:text-t-primary transition-colors cursor-pointer"
                                  title="Zoom Chart"
                                >
                                  <Maximize2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Chart Image (Rendered with Matplotlib / Seaborn) */}
                            <div className="p-4 bg-canvas flex items-center justify-center">
                              {chart.image_base64 ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={`data:image/png;base64,${chart.image_base64}`}
                                  alt={chart.title}
                                  className="w-full h-auto rounded-lg shadow-sm border border-b-subtle max-h-80 object-contain bg-white cursor-pointer"
                                  onClick={() => setZoomChart(chart)}
                                />
                              ) : (
                                <div className="py-12 text-xs text-t-secondary">Image preview not available</div>
                              )}
                            </div>

                            {/* Anti-Misleading Data Audit Warnings */}
                            {chart.misleading_warnings.length > 0 && (
                              <div className="mx-4 mt-3 p-2.5 rounded-lg bg-surface-1 border border-b-subtle text-[11px] text-t-secondary space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-t-primary">
                                  <AlertTriangle className="h-3.5 w-3.5 text-t-secondary" />
                                  <span>Data Presentation Audit Notice:</span>
                                </div>
                                <ul className="list-disc pl-4 space-y-0.5">
                                  {chart.misleading_warnings.map((w, wi) => (
                                    <li key={wi}>{w}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Key Insights List */}
                            {chart.insights.length > 0 && (
                              <div className="p-4 pt-3 space-y-1 text-xs text-t-secondary">
                                <span className="text-[11px] font-bold text-t-primary block">Key Insights:</span>
                                <ul className="space-y-1 text-[11px]">
                                  {chart.insights.map((ins, ii) => (
                                    <li key={ii} className="flex items-start gap-1.5">
                                      <span className="text-t-primary">•</span>
                                      <span>{ins}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Footer Action */}
                          <div className="px-4 py-2.5 border-t border-b-subtle bg-surface-2 flex items-center justify-between text-[11px]">
                            <span className="font-mono text-t-secondary">
                              300 DPI Seaborn/Matplotlib
                            </span>
                            <a
                              href={`data:image/png;base64,${chart.image_base64}`}
                              download={`${chart.chart_id}.png`}
                              className=" px-2.5 py-1 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="h-3 w-3" />
                              <span>Save PNG</span>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Interactive Custom Chart Generator Studio */}
                    <div className="p-6 rounded-2xl bg-surface-2 border border-b-subtle shadow-subtle space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-t-primary flex items-center gap-2">
                          <Sliders className="h-4 w-4 text-t-secondary" />
                          On-Demand Custom Chart Studio
                        </h4>
                        <span className="text-[11px] font-mono text-t-secondary">
                          Generate dynamic Matplotlib &amp; Seaborn visualizations
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                        <div>
                          <label className="block text-t-secondary mb-1 font-medium">Chart Type</label>
                          <select
                            value={customChartType}
                            onChange={(e) => setCustomChartType(e.target.value)}
                            className="w-full border border-b-subtle rounded-lg p-2 font-mono text-t-primary bg-surface-1"
                          >
                            <option value="bar">Bar (Ranking / Comparison)</option>
                            <option value="line">Line (Time-Series Trend)</option>
                            <option value="grouped_bar">Grouped Bar</option>
                            <option value="hist">Histogram (KDE Distribution)</option>
                            <option value="box">Box Plot (Dispersion &amp; Outliers)</option>
                            <option value="heatmap">Correlation Heatmap</option>
                            <option value="scatter">Scatter Plot (Regression)</option>
                            <option value="donut">Donut Composition</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-t-secondary mb-1 font-medium">X Axis Feature</label>
                          <select
                            value={customXCol}
                            onChange={(e) => setCustomXCol(e.target.value)}
                            className="w-full border border-b-subtle rounded-lg p-2 font-mono text-t-primary bg-surface-1"
                          >
                            {datasetMeta?.columns.map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.name} ({c.inferred_type})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-t-secondary mb-1 font-medium">Y Axis Feature (Optional)</label>
                          <select
                            value={customYCol}
                            onChange={(e) => setCustomYCol(e.target.value)}
                            className="w-full border border-b-subtle rounded-lg p-2 font-mono text-t-primary bg-surface-1"
                          >
                            <option value="">None / Frequency Count</option>
                            {datasetMeta?.columns.map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.name} ({c.inferred_type})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-t-secondary mb-1 font-medium">Hue / Segment (Optional)</label>
                          <select
                            value={customHueCol}
                            onChange={(e) => setCustomHueCol(e.target.value)}
                            className="w-full border border-b-subtle rounded-lg p-2 font-mono text-t-primary bg-surface-1"
                          >
                            <option value="">None</option>
                            {datasetMeta?.columns.map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-end">
                          <button
                            onClick={handleGenerateCustomChart}
                            disabled={customVizRunning || !currentDatasetId}
                            className=" w-full py-2 text-xs font-semibold text-t-primary inline-flex items-center justify-center gap-1.5"
                          >
                            {customVizRunning ? (
                              <>
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                <span>Rendering...</span>
                              </>
                            ) : (
                              <>
                                <ImageIcon className="h-3.5 w-3.5" />
                                <span>Render Chart</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {customVizError && (
                        <div className="p-3 rounded-xl bg-surface-2 border border-b-hover text-xs text-t-primary flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 text-t-secondary" />
                          <span>{customVizError}</span>
                        </div>
                      )}

                      {/* Custom Rendered Chart Result */}
                      {customChart && (
                        <div className="p-4 rounded-xl bg-surface-1 border border-b-subtle space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="font-bold text-xs text-t-primary">{customChart.title}</h5>
                            <a
                              href={`data:image/png;base64,${customChart.image_base64}`}
                              download="custom_chart.png"
                              className=" px-2.5 py-1 text-xs font-mono text-t-secondary hover:text-t-primary inline-flex items-center gap-1"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>Download PNG</span>
                            </a>
                          </div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`data:image/png;base64,${customChart.image_base64}`}
                            alt={customChart.title}
                            className="w-full max-h-96 object-contain rounded-lg border border-b-subtle bg-white"
                          />
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <VisualizationsEmpty />
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 7: Power BI Studio Deliverables (Agent 7)                             */}
            {/* ========================================================================= */}
            {activeTab === "powerbi" && (
              <div className="space-y-8">
                {powerbiOutput ? (
                  <>
                    {/* PBIP Bundle Download Banner */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-surface-2 border border-b-subtle text-t-primary">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-t-primary">
                            Production-Ready Power BI Project (.PBIP + TMDL)
                          </h4>
                        </div>
                        <p className="text-xs text-t-secondary max-w-xl">
                          Complete Tabular Model Definition Language (TMDL) semantic model with star schema relationships, verified DAX measure catalog, and visual blueprints ready for Power BI Desktop.
                        </p>
                      </div>
                      {currentSessionId && (
                        <a
                          href={api.getPbipDownloadUrl(currentSessionId)}
                          className=" px-5 py-2.5 text-xs font-semibold text-t-primary gap-2 inline-flex items-center"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download .PBIP Project (.ZIP)</span>
                        </a>
                      )}
                    </div>

                    {/* Star Schema Architecture Viewer */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-t-primary flex items-center gap-2">
                          <LayoutGrid className="h-4 w-4 text-t-secondary" />
                          Star Schema Architecture
                        </h4>
                        <span className="text-[11px] font-mono text-t-secondary">
                          Fact: {powerbiOutput.star_schema.fact_table_name} • {powerbiOutput.star_schema.dimensions.length} Dimensions
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Central Fact Card */}
                        <div className="p-4 rounded-xl border-2 border-b-hover bg-surface-1 text-t-primary space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-t-secondary font-bold">
                              FACT TABLE
                            </span>
                            <span className="text-[10px] font-mono text-t-secondary">Grain: Transaction</span>
                          </div>
                          <h5 className="font-bold text-sm text-t-primary font-mono">
                            {powerbiOutput.star_schema.fact_table_name}
                          </h5>
                          <div className="text-[11px] text-t-secondary space-y-0.5 pt-1">
                            <div>• Additive Facts: Metrics &amp; Values</div>
                            <div>• Foreign Keys: Dates, Segments, Regions</div>
                          </div>
                        </div>

                        {/* Dimension Cards */}
                        {powerbiOutput.star_schema.dimensions.map((dim) => (
                          <div
                            key={dim.table_name}
                            className="p-4 rounded-xl border border-b-subtle bg-surface-2 space-y-2"
                          >
                            <div className="flex items-center justify-between text-[10px] font-mono text-t-secondary">
                              <span>DIMENSION</span>
                              <span className="text-t-secondary font-semibold">*:1 Relationship</span>
                            </div>
                            <h5 className="font-bold text-sm text-t-primary font-mono">{dim.table_name}</h5>
                            <div className="text-[11px] text-t-secondary space-y-0.5 pt-1 font-mono">
                              <div>Key: {dim.key_column}</div>
                              <div className="text-[10px] text-t-secondary">
                                Attributes: {dim.attributes.slice(0, 3).join(", ")}
                                {dim.attributes.length > 3 ? "..." : ""}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Syntactically Verified DAX Measure Catalog */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-t-primary flex items-center gap-2">
                          <FileCode className="h-4 w-4 text-t-secondary" />
                          Syntactically Verified DAX Measure Catalog
                        </h4>
                        <span className="text-[11px] font-mono text-t-secondary font-medium">
                          100% Valid Syntax
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {powerbiOutput.dax_catalog.map((m, idx) => (
                          <div
                            key={m.name}
                            className="p-4 rounded-xl bg-surface-2 border border-b-subtle flex flex-col justify-between space-y-2.5"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-xs text-t-primary font-mono">{m.name}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-1 border border-b-subtle text-t-secondary">
                                  {m.category}
                                </span>
                              </div>
                              <p className="text-[11px] text-t-secondary">{m.description}</p>
                            </div>

                            <div className="relative rounded-lg bg-surface-1 border border-b-subtle p-3 text-t-primary font-mono text-xs overflow-x-auto">
                              <pre className="text-t-primary whitespace-pre-wrap">{m.dax_expression}</pre>
                              <button
                                onClick={() => handleCopyDax(m.dax_expression, idx)}
                                className=" absolute top-2 right-2 p-1.5 rounded-md text-t-secondary hover:text-t-primary transition-colors cursor-pointer"
                                title="Copy DAX"
                              >
                                {copiedIndex === idx ? (
                                  <Check className="h-3.5 w-3.5 text-t-primary" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Visual Layout Specifications */}
                    {powerbiOutput.visual_layout.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-t-primary mb-3">
                          Report Layout Visual Blueprint
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                          {powerbiOutput.visual_layout.map((v, i) => (
                            <div key={i} className="p-3.5 rounded-xl bg-surface-2 border border-b-subtle space-y-1">
                              <div className="flex items-center justify-between text-[11px] font-mono">
                                <span className="font-bold text-t-primary">{v.title}</span>
                                <span className="text-t-secondary font-semibold uppercase">{v.visual_type}</span>
                              </div>
                              <div className="text-[11px] text-t-secondary">
                                Measures: <span className="font-mono text-t-primary">{v.assigned_measures.join(", ")}</span>
                              </div>
                              {v.assigned_dimensions.length > 0 && (
                                <div className="text-[11px] text-t-secondary">
                                  Axes: <span className="font-mono text-t-primary">{v.assigned_dimensions.join(", ")}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <PowerBIEmpty />
                )}
              </div>
            )}
          </div>
        </ResultTabs>
      </main>


      {/* Chart Zoom Modal */}
      {zoomChart && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-b-subtle rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-floating text-t-primary">
            <div className="flex items-center justify-between border-b border-b-subtle pb-3">
              <div>
                <h3 className="font-bold text-sm text-t-primary">{zoomChart.title}</h3>
                <p className="text-xs text-t-secondary font-mono">{zoomChart.description}</p>
              </div>
              <button
                onClick={() => setZoomChart(null)}
                className=" p-1.5 rounded-lg text-t-secondary hover:text-t-primary transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-center bg-surface-2 rounded-xl p-4 border border-b-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${zoomChart.image_base64}`}
                alt={zoomChart.title}
                className="w-full h-auto max-h-[60vh] object-contain rounded-lg border border-b-subtle bg-white"
              />
            </div>

            {zoomChart.misleading_warnings.length > 0 && (
              <div className="p-3 rounded-xl bg-surface-2 border border-b-subtle text-xs text-t-secondary space-y-1">
                <span className="font-bold text-t-primary">Data Presentation Audit:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-t-secondary">
                  {zoomChart.misleading_warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-b-subtle">
              <span className="text-xs font-mono text-t-secondary">
                Chart Type: {zoomChart.chart_type}
              </span>
              <a
                href={`data:image/png;base64,${zoomChart.image_base64}`}
                download={`${zoomChart.chart_id}.png`}
                className=" px-4 py-2 text-xs font-semibold text-t-primary inline-flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5 text-t-primary" />
                <span>Download High-Res PNG</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
