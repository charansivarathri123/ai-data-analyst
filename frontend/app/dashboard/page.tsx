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
  const [sqlQuery, setSqlQuery] = useState<string>("SELECT * FROM raw_dataset LIMIT 10;");
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
      .then((res: any) => {
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
      // Real-time animation transitions across the 7 stages
      const t1 = setTimeout(() => {
        setPipelineStatus("transforming");
        setActiveAgent("data_transformer");
      }, 600);

      const t2 = setTimeout(() => {
        setPipelineStatus("analyzing");
        setActiveAgent("eda_features");
      }, 1200);

      const t3 = setTimeout(() => {
        setPipelineStatus("querying_sql");
        setActiveAgent("sql_analytics");
      }, 1800);

      const t4 = setTimeout(() => {
        setPipelineStatus("diagnosing");
        setActiveAgent("root_cause_engine");
      }, 2400);

      const t5 = setTimeout(() => {
        setPipelineStatus("visualizing");
        setActiveAgent("data_visualizer");
      }, 3000);

      const t6 = setTimeout(() => {
        setPipelineStatus("generating_bi");
        setActiveAgent("powerbi_architect");
      }, 3600);

      const state: AgentState = await api.startPipeline(
        currentDatasetId,
        businessPrompt,
        targetMetric
      );

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);

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

  return (
    <div className="min-h-screen bg-[#0a0a0b] pb-24 text-[#f5f5f4]">
      {/* Top Header */}
      <header className="border-b border-[#2c2c2e] bg-[#0e0e10]/95 backdrop-blur-md sticky top-0 z-40">
        <div className="w-full px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="btn-recessed px-3 py-1.5 text-xs font-semibold gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Link>
            <div className="h-4 w-px bg-[#2c2c2e]" />
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="Logo"
                className="h-7 w-7 shrink-0 rounded-lg object-contain"
              />
              <h1 className="text-sm font-semibold text-[#f5f5f4]">
                <span className="font-mono text-[#f5f5f4] font-bold">Workspace</span>
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-6 lg:px-8 pt-8 space-y-8">
        {/* Ingestion & Business Query Console */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* File Ingestion Dropzone */}
          <div className="lg:col-span-1 bg-[#19191b] rounded-2xl p-6 border border-[#2c2c2e] shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-[#f5f5f4] flex items-center gap-2">
                  <Database className="h-4 w-4 text-[#d4d4d3]" />
                  Dataset Ingestion
                </h2>
                <button
                  onClick={handleLoadDemo}
                  disabled={isLoading}
                  className="px-3 py-1.5 rounded-lg border border-[#2c2c2e] bg-[#0e0e10] hover:bg-[#2c2c2e] hover:border-[#5c5c5e] text-[#f5f5f4] hover:text-white text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#9a9a9a]" />
                  <span>Load Demo Data</span>
                </button>
              </div>
              <p className="text-xs text-[#9a9a9a] mb-4">
                Upload CSV, XLSX, or Parquet up to 100 MB. Ingested data is profiled in-memory via DuckDB &amp; Polars.
              </p>

              <label className="border-2 border-dashed border-[#2c2c2e] hover:border-[#5c5c5e] transition-all rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer bg-[#0e0e10] text-center">
                <Upload className="h-6 w-6 text-[#9a9a9a] mb-2" />
                <span className="text-xs font-semibold text-[#f5f5f4]">
                  {datasetMeta ? datasetMeta.file_name : "Choose dataset or drag & drop"}
                </span>
                <span className="text-[11px] text-[#9a9a9a] mt-1">
                  {datasetMeta
                    ? `${datasetMeta.row_count.toLocaleString()} rows • ${datasetMeta.column_count} columns`
                    : "CSV / Excel (.xlsx) / Parquet supported"}
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.parquet"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {datasetMeta && (
              <div className="mt-4 p-3 rounded-xl bg-[#0e0e10] border border-[#2c2c2e] text-xs">
                <div className="flex items-center justify-between mb-1.5 font-medium">
                  <span className="font-mono text-[#f5f5f4] truncate font-bold">{datasetMeta.file_name}</span>
                  <span className="text-[#f5f5f4] font-mono text-[11px] font-semibold">✓ Profiled</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#9a9a9a] font-mono">
                  <div>Rows: <strong className="text-[#f5f5f4]">{datasetMeta.row_count.toLocaleString()}</strong></div>
                  <div>Cols: <strong className="text-[#f5f5f4]">{datasetMeta.column_count}</strong></div>
                </div>
              </div>
            )}
          </div>

          {/* Business Hypothesis & Execution Input */}
          <div className="lg:col-span-2 bg-[#19191b] rounded-2xl p-6 border border-[#2c2c2e] shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#f5f5f4] flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#d4d4d3]" />
                  Business Hypothesis &amp; Focus Area
                </h2>
                <span className="text-xs text-[#9a9a9a] font-mono">Strategic Context</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9a9a9a] mb-1.5">
                  What business problem would you like to solve?
                </label>
                <textarea
                  value={businessPrompt}
                  onChange={(e) => setBusinessPrompt(e.target.value)}
                  rows={2}
                  className="w-full text-xs sm:text-sm rounded-xl border border-[#2c2c2e] bg-[#0e0e10] p-3 focus:outline-none focus:border-[#5c5c5e] transition-all text-[#f5f5f4] resize-none placeholder-[#5c5c5e]"
                  placeholder="Ask your business problem or question to analyze (e.g., What factors are causing sales to decline?)..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#9a9a9a] mb-1">
                    Focal Target Metric (for Diagnostics &amp; DAX)
                  </label>
                  <input
                    type="text"
                    value={targetMetric}
                    onChange={(e) => setTargetMetric(e.target.value)}
                    placeholder="e.g. gross_revenue, profit_margin"
                    className="w-full text-xs rounded-xl border border-[#2c2c2e] bg-[#0e0e10] p-2.5 focus:outline-none focus:border-[#5c5c5e] text-[#f5f5f4] font-mono placeholder-[#5c5c5e]"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <button
                    onClick={handleRunFullPipeline}
                    disabled={isLoading || !currentDatasetId}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#f5a623] hover:bg-[#ffcb6b] text-[#0a0a0b] font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-[#f5a623]/20 hover:shadow-lg hover:shadow-[#f5a623]/30 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#f5a623] disabled:shadow-none"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin text-[#0a0a0b]" />
                        <span>RUNNING...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 fill-[#0a0a0b] text-[#0a0a0b]" />
                        <span>RUN</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="mt-3 p-3 rounded-xl bg-[#0e0e10] border border-[#5c5c5e] text-xs text-[#f5f5f4] flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-[#9a9a9a]" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        </section>

        {/* 7-Agent Real-time Status Tracker */}
        <section className="bg-[#19191b] rounded-2xl p-6 border border-[#2c2c2e] shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-[#f5f5f4] flex items-center gap-2">
                <span>Autonomous Agent Pipeline Progression</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0e0e10] border border-[#2c2c2e] text-[#9a9a9a] font-semibold">
                  7 Specialized Agents
                </span>
              </h3>
              <p className="text-xs text-[#9a9a9a] mt-0.5">
                Data Cleaning → Feature Engineering → EDA → SQL Analytics → Diagnostics → Matplotlib/Seaborn Charts → Power BI
              </p>
            </div>
            <span className="text-xs font-mono font-medium text-[#9a9a9a]">
              Status: <span className="text-[#f5f5f4] font-bold uppercase">{pipelineStatus}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {agents.map((agent, index) => {
              const isCurrent = activeAgent === agent.id && pipelineStatus !== "completed" && pipelineStatus !== "idle";
              const isDone =
                (agent.id === "data_cleaner" && scorecard !== null) ||
                (agent.id === "data_transformer" && transformationOutput !== null) ||
                (agent.id === "eda_features" && edaOutput !== null) ||
                (agent.id === "sql_analytics" && sqlOutput !== null) ||
                (agent.id === "root_cause_engine" && rootCauseOutput !== null) ||
                (agent.id === "data_visualizer" && visualizationOutput !== null) ||
                (agent.id === "powerbi_architect" && powerbiOutput !== null);
              const Icon = agent.icon;

              return (
                <div
                  key={agent.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isCurrent
                      ? "stage-tile-3d-active"
                      : "stage-tile-3d"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-[#9a9a9a] font-bold">0{index + 1}</span>
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-white shrink-0" />
                    ) : isCurrent ? (
                      <RefreshCw className="h-4 w-4 text-[#f5a623] animate-spin shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 text-[#5c5c5e] shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3.5 w-3.5 text-[#f5f5f4] shrink-0" />
                    <h4 className="text-[11px] font-bold text-[#f5f5f4] truncate">{agent.name}</h4>
                  </div>
                  <p className="text-[10px] text-[#9a9a9a] line-clamp-2 leading-tight">{agent.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Results & Deliverable Hub */}
        <section className="bg-[#19191b] rounded-2xl border border-[#2c2c2e] shadow-xl overflow-hidden">
          {/* Tabs Navigation */}
          <div className="border-b border-[#2c2c2e] px-6 py-3.5 flex items-center justify-between flex-wrap gap-3">
            <div className="pill-recessed p-1.5 rounded-xl flex items-center gap-1 text-xs font-medium overflow-x-auto max-w-full">
              <button
                onClick={() => setActiveTab("scorecard")}
                className={`py-2 px-3 whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === "scorecard"
                    ? "tab-pill-active"
                    : "text-[#9a9a9a] hover:text-[#f5f5f4] bg-transparent border-none"
                }`}
              >
                1. Quality &amp; Profiling {scorecard ? `(${scorecard.overall_score}/100)` : ""}
              </button>
              <button
                onClick={() => setActiveTab("preview")}
                className={`py-2 px-3 whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === "preview"
                    ? "tab-pill-active"
                    : "text-[#9a9a9a] hover:text-[#f5f5f4] bg-transparent border-none"
                }`}
              >
                Dataset Preview ({previewMode})
              </button>
              <button
                onClick={() => setActiveTab("transformation")}
                className={`py-2 px-3 whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === "transformation"
                    ? "tab-pill-active"
                    : "text-[#9a9a9a] hover:text-[#f5f5f4] bg-transparent border-none"
                }`}
              >
                2. Data Transformation {transformationOutput ? `(+${transformationOutput.features_created})` : ""}
              </button>
              <button
                onClick={() => setActiveTab("eda")}
                className={`py-2 px-3 whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === "eda"
                    ? "tab-pill-active"
                    : "text-[#9a9a9a] hover:text-[#f5f5f4] bg-transparent border-none"
                }`}
              >
                3. EDA &amp; Insights {edaOutput ? `(${edaOutput.numeric_summaries.length} feats)` : ""}
              </button>
              <button
                onClick={() => setActiveTab("sql")}
                className={`py-2 px-3 whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === "sql"
                    ? "tab-pill-active"
                    : "text-[#9a9a9a] hover:text-[#f5f5f4] bg-transparent border-none"
                }`}
              >
                4. SQL Studio (DuckDB) {sqlOutput ? `(${sqlOutput.executed_queries.length} queries)` : ""}
              </button>
              <button
                onClick={() => setActiveTab("rootcause")}
                className={`py-2 px-3 whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === "rootcause"
                    ? "tab-pill-active"
                    : "text-[#9a9a9a] hover:text-[#f5f5f4] bg-transparent border-none"
                }`}
              >
                5. Diagnostics {rootCauseOutput ? `(${rootCauseOutput.drivers.length} drivers)` : ""}
              </button>
              <button
                onClick={() => setActiveTab("visualizations")}
                className={`py-2 px-3 whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === "visualizations"
                    ? "tab-pill-active"
                    : "text-[#9a9a9a] hover:text-[#f5f5f4] bg-transparent border-none"
                }`}
              >
                6. Visualizations {visualizationOutput ? `(${visualizationOutput.rendered_charts.length} charts)` : ""}
              </button>
              <button
                onClick={() => setActiveTab("powerbi")}
                className={`py-2 px-3 whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === "powerbi"
                    ? "tab-pill-active"
                    : "text-[#9a9a9a] hover:text-[#f5f5f4] bg-transparent border-none"
                }`}
              >
                7. Power BI Studio {powerbiOutput ? `(${powerbiOutput.dax_catalog.length} DAX)` : ""}
              </button>
            </div>

            {/* Global Actions Toolbar */}
            <div className="my-1 flex items-center gap-2 flex-wrap">
              {currentDatasetId && scorecard && (
                <a
                  href={api.getDownloadUrl(currentDatasetId)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-3d-dark px-3 py-1.5 text-xs font-semibold gap-1.5 inline-flex items-center"
                >
                  <Download className="h-3.5 w-3.5 text-[#f5f5f4]" />
                  <span>Cleaned CSV</span>
                </a>
              )}
              {currentDatasetId && transformationOutput && (
                <a
                  href={api.getTransformedDownloadUrl(currentDatasetId)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-3d-dark px-3 py-1.5 text-xs font-semibold gap-1.5 inline-flex items-center"
                >
                  <Download className="h-3.5 w-3.5 text-[#f5f5f4]" />
                  <span>Transformed CSV</span>
                </a>
              )}
              {currentSessionId && visualizationOutput && (
                <a
                  href={api.getVisualizationBundleUrl(currentSessionId)}
                  className="btn-3d-dark px-3 py-1.5 text-xs font-semibold gap-1.5 inline-flex items-center"
                >
                  <Download className="h-3.5 w-3.5 text-[#f5f5f4]" />
                  <span>Charts ZIP</span>
                </a>
              )}
              {currentSessionId && powerbiOutput && (
                <a
                  href={api.getPbipDownloadUrl(currentSessionId)}
                  className="btn-3d-dark px-3 py-1.5 text-xs font-semibold gap-1.5 inline-flex items-center"
                >
                  <Download className="h-3.5 w-3.5 text-[#f5f5f4]" />
                  <span>.PBIP Bundle</span>
                </a>
              )}
            </div>
          </div>

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
                      <div className="p-4 rounded-xl bg-[#0e0e10] border border-[#2c2c2e]">
                        <span className="text-xs text-[#9a9a9a]">Overall Quality Score</span>
                        <p className="text-2xl font-mono font-bold text-[#f5f5f4] mt-1">
                          {scorecard.overall_score} <span className="text-xs text-[#9a9a9a]">/ 100</span>
                        </p>
                        <span className="text-[11px] text-[#d4d4d3] font-medium">
                          ✓ Ready for Analysis &amp; Modeling
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-[#0e0e10] border border-[#2c2c2e]">
                        <span className="text-xs text-[#9a9a9a]">Completeness</span>
                        <p className="text-2xl font-mono font-bold text-[#f5f5f4] mt-1">
                          {scorecard.completeness}%
                        </p>
                        <span className="text-[11px] text-[#9a9a9a] font-mono">
                          {scorecard.total_nulls_imputed} nulls imputed
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-[#0e0e10] border border-[#2c2c2e]">
                        <span className="text-xs text-[#9a9a9a]">Type Validity</span>
                        <p className="text-2xl font-mono font-bold text-[#f5f5f4] mt-1">
                          {scorecard.type_validity}%
                        </p>
                        <span className="text-[11px] text-[#9a9a9a] font-mono">
                          Strict Polars schema casting
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-[#0e0e10] border border-[#2c2c2e]">
                        <span className="text-xs text-[#9a9a9a]">Duplicate-Free</span>
                        <p className="text-2xl font-mono font-bold text-[#f5f5f4] mt-1">
                          {scorecard.duplicate_free}%
                        </p>
                        <span className="text-[11px] text-[#9a9a9a] font-mono">
                          Exact &amp; key deduplication
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-[#0e0e10] border border-[#2c2c2e]">
                        <span className="text-xs text-[#9a9a9a]">Cleaned Rows</span>
                        <p className="text-2xl font-mono font-bold text-[#f5f5f4] mt-1">
                          {scorecard.total_rows_cleaned.toLocaleString()}
                        </p>
                        <span className="text-[11px] text-[#9a9a9a] font-mono">
                          Consistency: {scorecard.consistency ?? 95}%
                        </span>
                      </div>
                    </div>

                    {/* Before vs After Comparison Card */}
                    {beforeAfter && (
                      <div className="p-5 rounded-2xl bg-[#0e0e10] border border-[#2c2c2e]">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-semibold text-[#f5f5f4] flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-[#d4d4d3]" />
                            Before vs. After Cleaning Audit Comparison
                          </h4>
                          <span className="text-[11px] font-mono font-bold text-[#f5f5f4]">
                            +{beforeAfter.null_improvement_pct}% Null Reduction
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
                          <div className="bg-[#19191b] p-3 rounded-xl border border-[#2c2c2e]">
                            <span className="text-[10px] text-[#9a9a9a] uppercase">Total Rows</span>
                            <div className="font-bold text-[#f5f5f4] text-sm mt-0.5">
                              {beforeAfter.before_rows} → {beforeAfter.after_rows}
                            </div>
                          </div>
                          <div className="bg-[#19191b] p-3 rounded-xl border border-[#2c2c2e]">
                            <span className="text-[10px] text-[#9a9a9a] uppercase">Missing / Nulls</span>
                            <div className="font-bold text-[#f5f5f4] text-sm mt-0.5">
                              <span>{beforeAfter.before_nulls}</span> → <span className="text-[#f5f5f4]">{beforeAfter.after_nulls}</span>
                            </div>
                          </div>
                          <div className="bg-[#19191b] p-3 rounded-xl border border-[#2c2c2e]">
                            <span className="text-[10px] text-[#9a9a9a] uppercase">Duplicates</span>
                            <div className="font-bold text-[#f5f5f4] text-sm mt-0.5">
                              <span>{beforeAfter.before_duplicates}</span> → <span className="text-[#f5f5f4]">{beforeAfter.after_duplicates}</span>
                            </div>
                          </div>
                          <div className="bg-[#19191b] p-3 rounded-xl border border-[#2c2c2e]">
                            <span className="text-[10px] text-[#9a9a9a] uppercase">Outliers Handled</span>
                            <div className="font-bold text-[#f5f5f4] text-sm mt-0.5">
                              {beforeAfter.before_outliers} flags
                            </div>
                          </div>
                          <div className="bg-[#19191b] p-3 rounded-xl border border-[#2c2c2e]">
                            <span className="text-[10px] text-[#9a9a9a] uppercase">Deduplication</span>
                            <div className="font-bold text-[#f5f5f4] text-sm mt-0.5">
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
                          <h4 className="text-xs font-semibold text-[#f5f5f4] flex items-center gap-2">
                            <FileCheck className="h-4 w-4 text-[#d4d4d3]" />
                            Column Profiling &amp; Role Classification
                          </h4>
                          <span className="text-[11px] font-mono text-[#9a9a9a]">
                            {profiling.length} Columns Profiled
                          </span>
                        </div>
                        <div className="rounded-xl border border-[#2c2c2e] overflow-x-auto text-xs bg-[#0e0e10]">
                          <table className="w-full text-left">
                            <thead className="bg-[#19191b] border-b border-[#2c2c2e] text-[#9a9a9a] font-medium font-mono text-[11px]">
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
                            <tbody className="divide-y divide-[#2c2c2e] font-mono text-[#d4d4d3]">
                              {profiling.map((col) => (
                                <tr key={col.column_name} className="hover:bg-[#19191b]/50 transition-colors">
                                  <td className="p-3 font-semibold text-[#f5f5f4]">{col.column_name}</td>
                                  <td className="p-3">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#19191b] border border-[#2c2c2e] text-[#f5f5f4]">
                                      {col.role}
                                    </span>
                                  </td>
                                  <td className="p-3 text-[#9a9a9a]">{col.data_type}</td>
                                  <td className="p-3">
                                    <span className={col.missing_pct > 0 ? "text-[#f5f5f4] font-bold" : "text-[#9a9a9a]"}>
                                      {col.missing_pct}% ({col.missing_count})
                                    </span>
                                  </td>
                                  <td className="p-3 text-[#9a9a9a]">{col.unique_count}</td>
                                  <td className="p-3">
                                    <span className={col.outlier_count > 0 ? "text-[#f5f5f4] font-bold" : "text-[#9a9a9a]"}>
                                      {col.outlier_count}
                                    </span>
                                  </td>
                                  <td className="p-3 text-[#9a9a9a] truncate max-w-xs">
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
                        <h4 className="text-xs font-semibold text-[#f5f5f4] mb-3 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-[#d4d4d3]" />
                          Proactive Data Quality Recommendations
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {recommendations.map((rec, i) => (
                            <div
                              key={i}
                              className="p-3.5 rounded-xl bg-[#0e0e10] border border-[#2c2c2e] space-y-1.5 shadow-subtle"
                            >
                              <div className="flex items-center justify-between font-mono">
                                <span className="font-bold text-[#f5f5f4]">{rec.column}</span>
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#19191b] border border-[#2c2c2e] text-[#9a9a9a]">
                                  {rec.severity}
                                </span>
                              </div>
                              <p className="text-xs text-[#f5f5f4] font-medium">{rec.issue}</p>
                              <div className="text-[11px] text-[#9a9a9a] bg-[#19191b] p-2 rounded-lg font-mono border border-[#2c2c2e]">
                                <strong className="text-[#f5f5f4]">Action:</strong> {rec.recommended_action}
                              </div>
                              <p className="text-[10px] text-[#9a9a9a]">{rec.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Audit Trail */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-[#f5f5f4]">
                          Polars Automated Transformation Audit Trail
                        </h4>
                        <span className="text-[11px] font-mono text-[#9a9a9a]">
                          {auditTrail.length} Rules Executed
                        </span>
                      </div>
                      <div className="rounded-xl border border-[#2c2c2e] overflow-x-auto text-xs bg-[#0e0e10]">
                        <table className="w-full text-left">
                          <thead className="bg-[#19191b] border-b border-[#2c2c2e] text-[#9a9a9a] font-medium">
                            <tr>
                              <th className="p-3">Column</th>
                              <th className="p-3">Operation</th>
                              <th className="p-3">Rationale</th>
                              <th className="p-3">Rows Impacted</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2c2c2e] text-[#d4d4d3]">
                            {auditTrail.map((log, i) => (
                              <tr key={i} className="hover:bg-[#19191b]/50 transition-colors">
                                <td className="p-3 font-mono font-medium text-[#f5f5f4]">{log.column}</td>
                                <td className="p-3 font-semibold text-[#f5f5f4]">{log.operation}</td>
                                <td className="p-3 text-[#9a9a9a]">{log.rationale}</td>
                                <td className="p-3 font-mono text-[#f5f5f4]">{log.affected_rows}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 space-y-3">
                    <ShieldCheck className="h-10 w-10 text-[#5c5c5e] mx-auto" />
                    <h4 className="text-sm font-semibold text-[#f5f5f4]">
                      No Cleaning Run Yet
                    </h4>
                    <p className="text-xs text-[#9a9a9a] max-w-md mx-auto">
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
                  <div className="pill-recessed p-1 rounded-lg inline-flex text-xs font-medium">
                    <button
                      onClick={() => setPreviewMode("raw")}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        previewMode === "raw" ? "bg-[#19191b] text-[#f5f5f4] border border-[#5c5c5e] shadow-sm font-bold" : "text-[#9a9a9a] hover:text-[#f5f5f4]"
                      }`}
                    >
                      Raw Input ({rawPreview.length})
                    </button>
                    <button
                      onClick={() => setPreviewMode("cleaned")}
                      disabled={cleanPreview.length === 0}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        previewMode === "cleaned"
                          ? "bg-[#19191b] text-[#f5f5f4] border border-[#5c5c5e] shadow-sm font-bold"
                          : cleanPreview.length === 0
                          ? "opacity-30 cursor-not-allowed"
                          : "text-[#9a9a9a] hover:text-[#f5f5f4]"
                      }`}
                    >
                      Cleaned ({cleanPreview.length})
                    </button>
                    <button
                      onClick={() => setPreviewMode("transformed")}
                      disabled={transformedPreview.length === 0}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        previewMode === "transformed"
                          ? "bg-[#19191b] text-[#f5f5f4] border border-[#5c5c5e] shadow-sm font-bold"
                          : transformedPreview.length === 0
                          ? "opacity-30 cursor-not-allowed"
                          : "text-[#9a9a9a] hover:text-[#f5f5f4]"
                      }`}
                    >
                      Transformed ({transformedPreview.length})
                    </button>
                    <button
                      onClick={() => setPreviewMode("sql")}
                      disabled={!sqlResult}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        previewMode === "sql"
                          ? "bg-[#19191b] text-[#f5f5f4] border border-[#5c5c5e] shadow-sm font-bold"
                          : !sqlResult
                          ? "opacity-30 cursor-not-allowed"
                          : "text-[#9a9a9a] hover:text-[#f5f5f4]"
                      }`}
                    >
                      SQL Result ({sqlResult ? sqlResult.row_count : 0})
                    </button>
                  </div>
                </div>

                {displayRows.length > 0 ? (
                  <div className="rounded-xl border border-[#2c2c2e] overflow-x-auto text-xs max-h-[500px] bg-[#0e0e10]">
                    <table className="w-full text-left">
                      <thead className="bg-[#19191b] border-b border-[#2c2c2e] text-[#9a9a9a] font-medium sticky top-0">
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
                          <tr key={idx} className="hover:bg-[#19191b]/50 transition-colors font-mono text-[#d4d4d3]">
                            {tableColumns.map((col) => (
                              <td key={col} className="p-3 truncate max-w-xs whitespace-nowrap">
                                {row[col] === null || row[col] === undefined ? (
                                  <span className="text-[#5c5c5e] italic">null</span>
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
                  <div className="text-center py-16 space-y-3 bg-[#0e0e10] rounded-xl border border-[#2c2c2e]">
                    <Table className="h-10 w-10 text-[#5c5c5e] mx-auto" />
                    <h4 className="text-sm font-semibold text-[#f5f5f4]">
                      No Data Loaded For Preview
                    </h4>
                    <p className="text-xs text-[#9a9a9a] max-w-md mx-auto">
                      Click &quot;Load Demo Data&quot; or upload a custom CSV/Excel/Parquet file to view the in-memory tabular data.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: Data Transformation & Feature Engineering (Agent 2)                 */}
            {/* ========================================================================= */}
            {activeTab === "transformation" && (
              <div className="space-y-6">
                {transformationOutput ? (
                  <>
                    {/* Transformation Overview Counters */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-[#0e0e10] border border-[#2c2c2e]">
                        <span className="text-xs text-[#9a9a9a]">Total Features</span>
                        <p className="text-2xl font-mono font-bold text-[#f5f5f4] mt-1">
                          {transformationOutput.total_features}
                        </p>
                        <span className="text-[11px] text-[#9a9a9a] font-mono">
                          Ready for modeling &amp; analytics
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-[#0e0e10] border border-[#2c2c2e]">
                        <span className="text-xs text-[#9a9a9a]">Engineered Features Created</span>
                        <p className="text-2xl font-mono font-bold text-[#f5f5f4] mt-1">
                          +{transformationOutput.features_created}
                        </p>
                        <span className="text-[11px] text-[#9a9a9a] font-mono">
                          Scaling, binning, temporal &amp; encodings
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-[#0e0e10] border border-[#2c2c2e]">
                        <span className="text-xs text-[#9a9a9a]">Pipeline Operations Executed</span>
                        <p className="text-2xl font-mono font-bold text-[#f5f5f4] mt-1">
                          {transformationOutput.transformation_history.length}
                        </p>
                        <span className="text-[11px] text-[#9a9a9a] font-mono">
                          Deterministic Polars pipeline
                        </span>
                      </div>
                    </div>

                    {/* Transformed Feature Catalog */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-[#f5f5f4] flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-[#d4d4d3]" />
                          Engineered Features Catalog
                        </h4>
                        <span className="text-[11px] font-mono text-[#9a9a9a]">
                          {transformationOutput.feature_catalog.length} Engineered Features
                        </span>
                      </div>
                      <div className="rounded-xl border border-[#2c2c2e] overflow-x-auto text-xs bg-[#0e0e10]">
                        <table className="w-full text-left">
                          <thead className="bg-[#19191b] border-b border-[#2c2c2e] text-[#9a9a9a] font-medium font-mono text-[11px]">
                            <tr>
                              <th className="p-3">Feature Name</th>
                              <th className="p-3">Type</th>
                              <th className="p-3">Data Type</th>
                              <th className="p-3">Formula / Logic</th>
                              <th className="p-3">Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2c2c2e] font-mono text-[#d4d4d3]">
                            {transformationOutput.feature_catalog.map((feat) => (
                              <tr key={feat.feature_name} className="hover:bg-[#19191b]/50 transition-colors">
                                <td className="p-3 font-semibold text-[#f5f5f4]">{feat.feature_name}</td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-[#19191b] border border-[#2c2c2e] text-[#f5f5f4]">
                                    {feat.feature_type}
                                  </span>
                                </td>
                                <td className="p-3 text-[#9a9a9a]">{feat.data_type}</td>
                                <td className="p-3 font-mono text-[#f5f5f4] truncate max-w-xs">
                                  {feat.formula}
                                </td>
                                <td className="p-3 text-[#9a9a9a] font-sans text-xs">
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
                      <h4 className="text-xs font-semibold text-[#f5f5f4] mb-3">
                        Transformation Execution Trace
                      </h4>
                      <div className="space-y-2">
                        {transformationOutput.transformation_history.map((step) => (
                          <div
                            key={step.step_index}
                            className="p-3 rounded-xl bg-[#0e0e10] border border-[#2c2c2e] flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2 font-mono"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#d4d4d3]">0{step.step_index}.</span>
                              <span className="font-semibold text-[#f5f5f4]">{step.operation}</span>
                              <span className="text-[#9a9a9a]">on</span>
                              <span className="font-bold text-[#f5f5f4]">{step.column}</span>
                            </div>
                            <div className="text-[#9a9a9a] text-[11px] truncate">
                              <code>{step.formula}</code>
                            </div>
                            <div className="text-[11px] text-[#9a9a9a]">
                              {step.rows_affected.toLocaleString()} rows affected
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 space-y-3 bg-[#0e0e10] rounded-xl border border-[#2c2c2e]">
                    <Sparkles className="h-10 w-10 text-[#5c5c5e] mx-auto" />
                    <h4 className="text-sm font-semibold text-[#f5f5f4]">
                      No Transformations Executed Yet
                    </h4>
                    <p className="text-xs text-[#9a9a9a] max-w-md mx-auto">
                      Click &quot;Run End-to-End Pipeline&quot; to execute Agent 2 and generate scaled features, semantic bins, temporal extractions, and calculated KPI metrics.
                    </p>
                  </div>
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
                      <div className="p-5 rounded-2xl bg-[#0e0e10] border border-[#2c2c2e] space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-[#f5f5f4] flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-[#d4d4d3]" />
                            Executive Data Story &amp; Synthesis
                          </h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#19191b] border border-[#2c2c2e] text-[#9a9a9a] font-semibold">
                            Agent 3 Automated Synthesis
                          </span>
                        </div>
                        <p className="text-xs text-[#d4d4d3] leading-relaxed">
                          {edaOutput.data_story.dataset_overview}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                          <div className="p-3 bg-[#19191b] rounded-xl border border-[#2c2c2e]">
                            <span className="font-bold text-[11px] text-[#f5f5f4] block mb-1">Key Patterns &amp; Trends:</span>
                            <ul className="space-y-1 text-[#9a9a9a] text-[11px]">
                              {edaOutput.data_story.key_patterns.map((p, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="text-[#f5f5f4]">•</span>
                                  <span>{p}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="p-3 bg-[#19191b] rounded-xl border border-[#2c2c2e]">
                            <span className="font-bold text-[11px] text-[#f5f5f4] block mb-1">Recommended Next Analyses:</span>
                            <ul className="space-y-1 text-[#9a9a9a] text-[11px]">
                              {edaOutput.data_story.recommended_next_analysis.map((r, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="text-[#f5f5f4]">→</span>
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
                        <h4 className="text-xs font-semibold text-[#f5f5f4] mb-3 flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-[#d4d4d3]" />
                          Automated Business Insights &amp; Findings
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                          {edaOutput.insights.map((ins, i) => (
                            <div
                              key={i}
                              className="p-3.5 rounded-xl bg-[#0e0e10] border border-[#2c2c2e] space-y-1.5 shadow-subtle flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1 font-mono text-[10px]">
                                  <span className="uppercase text-[#9a9a9a] font-semibold">{ins.insight_type}</span>
                                  <span className="px-1.5 py-0.5 rounded font-bold uppercase bg-[#19191b] border border-[#2c2c2e] text-[#9a9a9a]">
                                    {ins.severity}
                                  </span>
                                </div>
                                <h5 className="font-bold text-xs text-[#f5f5f4]">{ins.title}</h5>
                                <p className="text-[11px] text-[#d4d4d3] mt-1">{ins.observation}</p>
                              </div>
                              <div className="pt-2 border-t border-[#2c2c2e] text-[10px] text-[#9a9a9a] font-mono">
                                <strong className="text-[#f5f5f4]">Implication:</strong> {ins.business_implication}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Numeric Distribution Parameters */}
                    <div>
                      <h4 className="text-xs font-semibold text-[#f5f5f4] mb-3">
                        Numeric Distribution Parameters &amp; Shape Classification
                      </h4>
                      <div className="rounded-xl border border-[#2c2c2e] overflow-x-auto text-xs bg-[#0e0e10]">
                        <table className="w-full text-left">
                          <thead className="bg-[#19191b] border-b border-[#2c2c2e] text-[#9a9a9a] font-medium font-mono text-[11px]">
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
                          <tbody className="divide-y divide-[#2c2c2e] font-mono text-[#d4d4d3]">
                            {edaOutput.numeric_summaries.map((num) => (
                              <tr key={num.column} className="hover:bg-[#19191b]/50 transition-colors">
                                <td className="p-3 font-semibold text-[#f5f5f4]">{num.column}</td>
                                <td className="p-3 text-[#9a9a9a]">{num.count}</td>
                                <td className="p-3">{num.mean.toLocaleString()}</td>
                                <td className="p-3 text-[#9a9a9a]">{num.std.toLocaleString()}</td>
                                <td className="p-3 font-bold text-[#f5f5f4]">{num.median.toLocaleString()}</td>
                                <td className="p-3 text-[#9a9a9a]">{num.iqr.toLocaleString()}</td>
                                <td className="p-3">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#19191b] border border-[#2c2c2e] text-[#f5f5f4]">
                                    {num.skewness}
                                  </span>
                                </td>
                                <td className="p-3 text-[#9a9a9a]">{num.kurtosis ?? 0}</td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-[#19191b] border border-[#2c2c2e] text-[#9a9a9a] font-semibold">
                                    {num.distribution_shape ?? "normal_like"}
                                  </span>
                                </td>
                                <td className="p-3 text-[#f5f5f4] font-bold text-[11px]">
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
                        <h4 className="text-xs font-semibold text-[#f5f5f4] mb-3">
                          Categorical Cardinality &amp; Frequency Analysis
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                          {edaOutput.categorical_summaries.map((cat) => (
                            <div key={cat.column} className="p-3.5 rounded-xl bg-[#0e0e10] border border-[#2c2c2e] space-y-1.5 font-mono">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#f5f5f4]">{cat.column}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] bg-[#19191b] border border-[#2c2c2e] text-[#9a9a9a]">
                                  {cat.cardinality_status}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#9a9a9a]">
                                Unique Values: <strong className="text-[#f5f5f4]">{cat.unique_count}</strong>
                              </div>
                              {cat.dominant_category && (
                                <div className="text-[11px] text-[#9a9a9a]">
                                  Dominant: <strong className="text-[#f5f5f4]">{cat.dominant_category}</strong> ({cat.dominant_pct}%)
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cross-Feature Correlation Matrix */}
                    <div>
                      <h4 className="text-xs font-semibold text-[#f5f5f4] mb-3">
                        Cross-Feature Correlation Matrix (Top Pairs)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                        {edaOutput.correlations.slice(0, 9).map((corr, idx) => {
                          const isPos = corr.pearson_r > 0;
                          return (
                            <div
                              key={idx}
                              className="p-3 rounded-xl bg-[#0e0e10] border border-[#2c2c2e] flex items-center justify-between"
                            >
                              <div className="font-mono truncate pr-2 text-[11px]">
                                <span className="font-medium text-[#f5f5f4]">{corr.feature_x}</span>
                                <span className="text-[#9a9a9a] mx-1">↔</span>
                                <span className="font-medium text-[#f5f5f4]">{corr.feature_y}</span>
                              </div>
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[#19191b] border border-[#2c2c2e] text-[#f5f5f4]">
                                {isPos ? `+${corr.pearson_r}` : corr.pearson_r}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Outlier Anomalies */}
                    {edaOutput.outliers.length > 0 && (
                      <div className="p-4 rounded-xl bg-[#0e0e10] border border-[#2c2c2e]">
                        <div className="flex items-center gap-2 text-[#f5f5f4] font-semibold text-xs mb-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-[#9a9a9a]" />
                          <span>Outlier Anomalies Detected (Tukey IQR &amp; Z-Score Methods)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {edaOutput.outliers.map((o) => (
                            <div key={o.column} className="bg-[#19191b] border border-[#2c2c2e] p-2.5 rounded-lg font-mono">
                              <span className="font-bold text-[#f5f5f4]">{o.column}:</span>{" "}
                              <span className="text-[#d4d4d3] font-semibold">{o.anomaly_count} outliers</span> ({o.outlier_pct ?? 0}%) beyond bounds [
                              {o.lower_bound} to {o.upper_bound}]
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-16 space-y-3 bg-[#0e0e10] rounded-xl border border-[#2c2c2e]">
                    <BarChart2 className="h-10 w-10 text-[#5c5c5e] mx-auto" />
                    <h4 className="text-sm font-semibold text-[#f5f5f4]">
                      No EDA Performed Yet
                    </h4>
                    <p className="text-xs text-[#9a9a9a] max-w-md mx-auto">
                      Click &quot;Run End-to-End Pipeline&quot; to execute Agent 3 and inspect statistical distributions, correlation structures, outlier boundaries, and business insights.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: SQL Studio & Analytical Queries (Agent 4)                          */}
            {/* ========================================================================= */}
            {activeTab === "sql" && (
              <div className="space-y-6">
                {/* Engine Banner */}
                <div className="p-4 rounded-xl bg-[#0e0e10] border border-[#2c2c2e] text-[#f5f5f4] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-[#f5f5f4]" />
                    <div>
                      <h4 className="text-xs font-bold font-mono text-[#f5f5f4]">DuckDB In-Memory Analytical Engine</h4>
                      <p className="text-[11px] text-[#9a9a9a]">
                        Columnar OLAP query execution with zero-copy table registration and SQL dialect harmonization.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-[#19191b] border border-[#2c2c2e] text-[#9a9a9a] text-[11px] font-mono">
                    Read-Only Analytical Sandbox
                  </span>
                </div>

                {/* Templates Selector */}
                {(sqlTemplates?.length ?? 0) > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-[#f5f5f4] mb-1.5">
                      Pre-Configured Business Query Templates:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {sqlTemplates?.map((t) => (
                        <button
                          key={t.template_id}
                          onClick={() => handleSelectTemplate(t.template_id)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-mono transition-all cursor-pointer ${
                            selectedTemplateId === t.template_id
                              ? "btn-3d-dark border-[#5c5c5e] text-[#f5f5f4] font-bold"
                              : "btn-recessed text-[#9a9a9a] hover:text-[#f5f5f4]"
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
                    <label className="text-xs font-semibold text-[#f5f5f4] flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-[#d4d4d3]" />
                      SQL Query Console:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopySql(sqlQuery)}
                        className="btn-recessed px-2.5 py-1 text-[11px] font-mono text-[#9a9a9a] hover:text-[#f5f5f4] flex items-center gap-1 cursor-pointer"
                      >
                        {copiedSql ? <Check className="h-3 w-3 text-[#f5f5f4]" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedSql ? "Copied" : "Copy SQL"}</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    rows={4}
                    className="w-full font-mono text-xs rounded-xl border border-[#2c2c2e] p-3 bg-[#0e0e10] text-[#f5f5f4] focus:outline-none focus:border-[#5c5c5e] resize-none"
                    placeholder="SELECT * FROM raw_dataset LIMIT 10;"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <input
                      type="text"
                      value={sqlQueryName}
                      onChange={(e) => setSqlQueryName(e.target.value)}
                      placeholder="Query name (optional)"
                      className="text-xs border border-[#2c2c2e] bg-[#0e0e10] rounded-lg px-3 py-1.5 w-64 text-[#f5f5f4] font-mono placeholder-[#5c5c5e]"
                    />
                    <button
                      onClick={handleRunSQL}
                      disabled={sqlRunning || !currentDatasetId}
                      className="btn-3d-dark px-4 py-2 text-xs font-semibold text-[#f5f5f4] inline-flex items-center gap-2"
                    >
                      {sqlRunning ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Executing in DuckDB...</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-[#f5f5f4]" />
                          <span>Run Query</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {sqlError && (
                  <div className="p-3 rounded-xl bg-[#0e0e10] border border-[#5c5c5e] text-xs text-[#f5f5f4] flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-[#9a9a9a]" />
                    <span>{sqlError}</span>
                  </div>
                )}

                {/* Query Result Section */}
                {sqlResult && (
                  <div className="space-y-4 pt-2 border-t border-[#2c2c2e]">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#0e0e10] border border-[#2c2c2e]">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-xs font-mono text-[#f5f5f4]">{sqlResult.query_name}</span>
                        <span className="text-[11px] font-mono text-[#9a9a9a]">
                          Rows: <strong className="text-[#f5f5f4]">{sqlResult.row_count}</strong> • Time: <strong className="text-[#f5f5f4]">{sqlResult.execution_time_ms} ms</strong>
                        </span>
                      </div>
                      {sqlResult.chart_recommendation && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#19191b] border border-[#2c2c2e] text-[#9a9a9a] text-[11px] font-mono font-semibold">
                          Recommended Viz: {sqlResult.chart_recommendation}
                        </span>
                      )}
                    </div>

                    {sqlResult.explanation && (
                      <div className="p-3 rounded-xl bg-[#0e0e10] border border-[#2c2c2e] text-xs text-[#d4d4d3]">
                        <strong className="text-[#f5f5f4]">Business Logic:</strong> {sqlResult.explanation}
                      </div>
                    )}

                    {/* Result Table Preview */}
                    <div className="rounded-xl border border-[#2c2c2e] overflow-x-auto text-xs max-h-80 bg-[#0e0e10]">
                      <table className="w-full text-left">
                        <thead className="bg-[#19191b] border-b border-[#2c2c2e] text-[#9a9a9a] font-medium sticky top-0 font-mono">
                          <tr>
                            {sqlResult.columns.map((c, i) => (
                              <th key={c} className="p-3 whitespace-nowrap">
                                <div>{c}</div>
                                <div className="text-[9px] text-[#9a9a9a]/80 font-normal">
                                  {sqlResult.column_types[i] ?? ""}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2c2c2e] font-mono text-[#d4d4d3]">
                          {sqlResult.rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#19191b]/50 transition-colors">
                              {sqlResult.columns.map((c) => (
                                <td key={c} className="p-3 whitespace-nowrap">
                                  {row[c] === null ? (
                                    <span className="text-[#5c5c5e] italic">null</span>
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
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 5: Root-Cause Diagnostics (Agent 5)                                   */}
            {/* ========================================================================= */}
            {activeTab === "rootcause" && (
              <div className="space-y-6">
                {rootCauseOutput ? (
                  <>
                    {/* Executive Narrative */}
                    <div className="p-6 rounded-2xl bg-[#0e0e10] border border-[#2c2c2e] space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-[#f5f5f4] flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-[#d4d4d3]" />
                          Executive Diagnostic Narrative
                        </h4>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#19191b] border border-[#2c2c2e] text-[#9a9a9a] text-[11px] font-mono font-semibold">
                          Target: {rootCauseOutput.target_metric}
                        </span>
                      </div>

                      <div className="space-y-3 text-xs leading-relaxed text-[#d4d4d3]">
                        <p>
                          <strong className="text-[#f5f5f4]">Macro Overview:</strong> {rootCauseOutput.narrative.what_happened}
                        </p>
                        <p>
                          <strong className="text-[#f5f5f4]">Statistical Attribution:</strong> {rootCauseOutput.narrative.why_it_happened}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[#2c2c2e]">
                        <h5 className="text-xs font-semibold text-[#f5f5f4] flex items-center gap-1.5 mb-2">
                          <Lightbulb className="h-3.5 w-3.5 text-[#d4d4d3]" />
                          Strategic Recommendations
                        </h5>
                        <ul className="space-y-1.5 text-xs text-[#9a9a9a]">
                          {rootCauseOutput.narrative.recommended_interventions.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-[#f5f5f4] font-bold font-mono">0{i + 1}.</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Key Drivers Ranking */}
                    <div>
                      <h4 className="text-xs font-semibold text-[#f5f5f4] mb-3">
                        Key Statistical Drivers (Feature Importance)
                      </h4>
                      <div className="space-y-3">
                        {rootCauseOutput.drivers.map((driver) => (
                          <div
                            key={driver.feature}
                            className="p-4 rounded-xl bg-[#0e0e10] border border-[#2c2c2e] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#f5f5f4]">{driver.feature}</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#19191b] border border-[#2c2c2e] text-[#9a9a9a]">
                                  {driver.impact_direction === "positive" ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3" />
                                  )}
                                  {driver.impact_direction} correlation
                                </span>
                              </div>
                              <p className="text-[#9a9a9a] text-[11px]">{driver.description}</p>
                            </div>

                            <div className="sm:w-44 shrink-0 flex items-center gap-3">
                              <div className="flex-1 bg-[#19191b] border border-[#2c2c2e] h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-[#d4d4d3] h-full rounded-full"
                                  style={{ width: `${driver.importance_score}%` }}
                                />
                              </div>
                              <span className="font-mono font-bold text-[#f5f5f4] text-xs w-12 text-right">
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
                        <h4 className="text-xs font-semibold text-[#f5f5f4] mb-3">
                          Cohort Performance Divergence
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                          {rootCauseOutput.cohorts.map((cohort, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 rounded-xl bg-[#0e0e10] border border-[#2c2c2e] space-y-1.5"
                            >
                              <div className="flex items-center justify-between font-mono">
                                <span className="font-bold text-[#f5f5f4] truncate">{cohort.cohort_name}</span>
                                <span className="text-[11px] text-[#9a9a9a]">n = {cohort.sample_size}</span>
                              </div>
                              <div className="text-xs font-mono text-[#d4d4d3]">
                                Avg: <span className="font-bold text-[#f5f5f4]">{cohort.metrics.avg?.toLocaleString()}</span> • Total: {cohort.metrics.total?.toLocaleString()}
                              </div>
                              <p className="text-[11px] text-[#9a9a9a]">
                                {cohort.key_differentiators[0]}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-16 space-y-3 bg-[#0e0e10] rounded-xl border border-[#2c2c2e]">
                    <BrainCircuit className="h-10 w-10 text-[#5c5c5e] mx-auto" />
                    <h4 className="text-sm font-semibold text-[#f5f5f4]">
                      No Root-Cause Analysis Performed Yet
                    </h4>
                    <p className="text-xs text-[#9a9a9a] max-w-md mx-auto">
                      Click &quot;Run End-to-End Pipeline&quot; to execute Agent 5, isolate key performance drivers, and generate the executive narrative.
                    </p>
                  </div>
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
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#0e0e10] border border-[#2c2c2e]">
                      <div>
                        <h4 className="text-xs font-bold text-[#f5f5f4] flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-[#d4d4d3]" />
                          Matplotlib &amp; Seaborn Publication-Grade Visualizations
                        </h4>
                        <p className="text-[11px] text-[#9a9a9a] mt-0.5">
                          High-resolution 300 DPI figures with anti-misleading data audit checks &amp; base64 instant rendering.
                        </p>
                      </div>
                      {currentSessionId && (
                        <a
                          href={api.getVisualizationBundleUrl(currentSessionId)}
                          className="btn-3d-dark px-3 py-1.5 text-xs font-semibold gap-1.5 inline-flex items-center"
                        >
                          <Download className="h-3.5 w-3.5 text-[#f5f5f4]" />
                          <span>Download All Charts (.ZIP)</span>
                        </a>
                      )}
                    </div>

                    {/* KPI Metric Cards */}
                    {visualizationOutput.kpi_cards.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {visualizationOutput.kpi_cards.map((kpi, i) => (
                          <div key={i} className="p-4 rounded-xl bg-[#0e0e10] border border-[#2c2c2e] shadow-subtle space-y-1">
                            <span className="text-xs text-[#9a9a9a]">{kpi.title}</span>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-2xl font-mono font-bold text-[#f5f5f4]">{kpi.formatted_value}</p>
                              {kpi.change_pct !== null && kpi.change_pct !== undefined && (
                                <span className="inline-flex items-center gap-0.5 text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#19191b] border border-[#2c2c2e] text-[#d4d4d3]">
                                  {kpi.trend_direction === "up" ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : kpi.trend_direction === "down" ? (
                                    <TrendingDown className="h-3 w-3" />
                                  ) : null}
                                  {kpi.change_pct > 0 ? `+${kpi.change_pct}%` : `${kpi.change_pct}%`}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-[#9a9a9a] font-mono">{kpi.description}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Chart Gallery Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {visualizationOutput.rendered_charts.map((chart) => (
                        <div
                          key={chart.chart_id}
                          className="bg-[#0e0e10] rounded-2xl border border-[#2c2c2e] shadow-subtle overflow-hidden flex flex-col justify-between"
                        >
                          <div>
                            {/* Chart Card Header */}
                            <div className="p-4 border-b border-[#2c2c2e] flex items-center justify-between">
                              <div>
                                <h5 className="font-bold text-xs text-[#f5f5f4]">{chart.title}</h5>
                                <p className="text-[10px] text-[#9a9a9a] font-mono">{chart.description}</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded uppercase text-[10px] font-mono font-semibold bg-[#19191b] border border-[#2c2c2e] text-[#9a9a9a]">
                                  {chart.chart_type}
                                </span>
                                <button
                                  onClick={() => setZoomChart(chart)}
                                  className="btn-recessed p-1.5 text-[#9a9a9a] hover:text-[#f5f5f4] transition-colors cursor-pointer"
                                  title="Zoom Chart"
                                >
                                  <Maximize2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Chart Image (Rendered with Matplotlib / Seaborn) */}
                            <div className="p-4 bg-[#0a0a0b] flex items-center justify-center">
                              {chart.image_base64 ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={`data:image/png;base64,${chart.image_base64}`}
                                  alt={chart.title}
                                  className="w-full h-auto rounded-lg shadow-sm border border-[#2c2c2e] max-h-80 object-contain bg-white cursor-pointer"
                                  onClick={() => setZoomChart(chart)}
                                />
                              ) : (
                                <div className="py-12 text-xs text-[#9a9a9a]">Image preview not available</div>
                              )}
                            </div>

                            {/* Anti-Misleading Data Audit Warnings */}
                            {chart.misleading_warnings.length > 0 && (
                              <div className="mx-4 mt-3 p-2.5 rounded-lg bg-[#19191b] border border-[#2c2c2e] text-[11px] text-[#d4d4d3] space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-[#f5f5f4]">
                                  <AlertTriangle className="h-3.5 w-3.5 text-[#d4d4d3]" />
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
                              <div className="p-4 pt-3 space-y-1 text-xs text-[#9a9a9a]">
                                <span className="text-[11px] font-bold text-[#f5f5f4] block">Key Insights:</span>
                                <ul className="space-y-1 text-[11px]">
                                  {chart.insights.map((ins, ii) => (
                                    <li key={ii} className="flex items-start gap-1.5">
                                      <span className="text-[#f5f5f4]">•</span>
                                      <span>{ins}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Footer Action */}
                          <div className="px-4 py-2.5 border-t border-[#2c2c2e] bg-[#0e0e10] flex items-center justify-between text-[11px]">
                            <span className="font-mono text-[#9a9a9a]">
                              300 DPI Seaborn/Matplotlib
                            </span>
                            <a
                              href={`data:image/png;base64,${chart.image_base64}`}
                              download={`${chart.chart_id}.png`}
                              className="btn-recessed px-2.5 py-1 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="h-3 w-3" />
                              <span>Save PNG</span>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Interactive Custom Chart Generator Studio */}
                    <div className="p-6 rounded-2xl bg-[#0e0e10] border border-[#2c2c2e] shadow-subtle space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-[#f5f5f4] flex items-center gap-2">
                          <Sliders className="h-4 w-4 text-[#d4d4d3]" />
                          On-Demand Custom Chart Studio
                        </h4>
                        <span className="text-[11px] font-mono text-[#9a9a9a]">
                          Generate dynamic Matplotlib &amp; Seaborn visualizations
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                        <div>
                          <label className="block text-[#9a9a9a] mb-1 font-medium">Chart Type</label>
                          <select
                            value={customChartType}
                            onChange={(e) => setCustomChartType(e.target.value)}
                            className="w-full border border-[#2c2c2e] rounded-lg p-2 font-mono text-[#f5f5f4] bg-[#19191b]"
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
                          <label className="block text-[#9a9a9a] mb-1 font-medium">X Axis Feature</label>
                          <select
                            value={customXCol}
                            onChange={(e) => setCustomXCol(e.target.value)}
                            className="w-full border border-[#2c2c2e] rounded-lg p-2 font-mono text-[#f5f5f4] bg-[#19191b]"
                          >
                            {datasetMeta?.columns.map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.name} ({c.inferred_type})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[#9a9a9a] mb-1 font-medium">Y Axis Feature (Optional)</label>
                          <select
                            value={customYCol}
                            onChange={(e) => setCustomYCol(e.target.value)}
                            className="w-full border border-[#2c2c2e] rounded-lg p-2 font-mono text-[#f5f5f4] bg-[#19191b]"
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
                          <label className="block text-[#9a9a9a] mb-1 font-medium">Hue / Segment (Optional)</label>
                          <select
                            value={customHueCol}
                            onChange={(e) => setCustomHueCol(e.target.value)}
                            className="w-full border border-[#2c2c2e] rounded-lg p-2 font-mono text-[#f5f5f4] bg-[#19191b]"
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
                            className="btn-3d-dark w-full py-2 text-xs font-semibold text-[#f5f5f4] inline-flex items-center justify-center gap-1.5"
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
                        <div className="p-3 rounded-xl bg-[#0e0e10] border border-[#5c5c5e] text-xs text-[#f5f5f4] flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 text-[#9a9a9a]" />
                          <span>{customVizError}</span>
                        </div>
                      )}

                      {/* Custom Rendered Chart Result */}
                      {customChart && (
                        <div className="p-4 rounded-xl bg-[#19191b] border border-[#2c2c2e] space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="font-bold text-xs text-[#f5f5f4]">{customChart.title}</h5>
                            <a
                              href={`data:image/png;base64,${customChart.image_base64}`}
                              download="custom_chart.png"
                              className="btn-recessed px-2.5 py-1 text-xs font-mono text-[#9a9a9a] hover:text-[#f5f5f4] inline-flex items-center gap-1"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>Download PNG</span>
                            </a>
                          </div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`data:image/png;base64,${customChart.image_base64}`}
                            alt={customChart.title}
                            className="w-full max-h-96 object-contain rounded-lg border border-[#2c2c2e] bg-white"
                          />
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 space-y-3 bg-[#0e0e10] rounded-xl border border-[#2c2c2e]">
                    <TrendingUp className="h-10 w-10 text-[#5c5c5e] mx-auto" />
                    <h4 className="text-sm font-semibold text-[#f5f5f4]">
                      No Visualizations Rendered Yet
                    </h4>
                    <p className="text-xs text-[#9a9a9a] max-w-md mx-auto">
                      Click &quot;Run End-to-End Pipeline&quot; to execute Agent 6 and generate high-resolution Matplotlib and Seaborn charts, KPI cards, and anti-misleading audit flags.
                    </p>
                  </div>
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
                    <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-[#0e0e10] border border-[#2c2c2e] text-[#f5f5f4]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-[#f5f5f4]">
                            Production-Ready Power BI Project (.PBIP + TMDL)
                          </h4>
                        </div>
                        <p className="text-xs text-[#9a9a9a] max-w-xl">
                          Complete Tabular Model Definition Language (TMDL) semantic model with star schema relationships, verified DAX measure catalog, and visual blueprints ready for Power BI Desktop.
                        </p>
                      </div>
                      {currentSessionId && (
                        <a
                          href={api.getPbipDownloadUrl(currentSessionId)}
                          className="btn-3d-dark px-5 py-2.5 text-xs font-semibold text-[#f5f5f4] gap-2 inline-flex items-center"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download .PBIP Project (.ZIP)</span>
                        </a>
                      )}
                    </div>

                    {/* Star Schema Architecture Viewer */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-[#f5f5f4] flex items-center gap-2">
                          <LayoutGrid className="h-4 w-4 text-[#d4d4d3]" />
                          Star Schema Architecture
                        </h4>
                        <span className="text-[11px] font-mono text-[#9a9a9a]">
                          Fact: {powerbiOutput.star_schema.fact_table_name} • {powerbiOutput.star_schema.dimensions.length} Dimensions
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Central Fact Card */}
                        <div className="p-4 rounded-xl border-2 border-[#5c5c5e] bg-[#19191b] text-[#f5f5f4] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[#d4d4d3] font-bold">
                              FACT TABLE
                            </span>
                            <span className="text-[10px] font-mono text-[#9a9a9a]">Grain: Transaction</span>
                          </div>
                          <h5 className="font-bold text-sm text-[#f5f5f4] font-mono">
                            {powerbiOutput.star_schema.fact_table_name}
                          </h5>
                          <div className="text-[11px] text-[#9a9a9a] space-y-0.5 pt-1">
                            <div>• Additive Facts: Metrics &amp; Values</div>
                            <div>• Foreign Keys: Dates, Segments, Regions</div>
                          </div>
                        </div>

                        {/* Dimension Cards */}
                        {powerbiOutput.star_schema.dimensions.map((dim) => (
                          <div
                            key={dim.table_name}
                            className="p-4 rounded-xl border border-[#2c2c2e] bg-[#0e0e10] space-y-2"
                          >
                            <div className="flex items-center justify-between text-[10px] font-mono text-[#9a9a9a]">
                              <span>DIMENSION</span>
                              <span className="text-[#d4d4d3] font-semibold">*:1 Relationship</span>
                            </div>
                            <h5 className="font-bold text-sm text-[#f5f5f4] font-mono">{dim.table_name}</h5>
                            <div className="text-[11px] text-[#9a9a9a] space-y-0.5 pt-1 font-mono">
                              <div>Key: {dim.key_column}</div>
                              <div className="text-[10px] text-[#9a9a9a]">
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
                        <h4 className="text-xs font-semibold text-[#f5f5f4] flex items-center gap-2">
                          <FileCode className="h-4 w-4 text-[#d4d4d3]" />
                          Syntactically Verified DAX Measure Catalog
                        </h4>
                        <span className="text-[11px] font-mono text-[#d4d4d3] font-medium">
                          100% Valid Syntax
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {powerbiOutput.dax_catalog.map((m, idx) => (
                          <div
                            key={m.name}
                            className="p-4 rounded-xl bg-[#0e0e10] border border-[#2c2c2e] flex flex-col justify-between space-y-2.5"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-xs text-[#f5f5f4] font-mono">{m.name}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#19191b] border border-[#2c2c2e] text-[#9a9a9a]">
                                  {m.category}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#9a9a9a]">{m.description}</p>
                            </div>

                            <div className="relative rounded-lg bg-[#19191b] border border-[#2c2c2e] p-3 text-[#f5f5f4] font-mono text-xs overflow-x-auto">
                              <pre className="text-[#f5f5f4] whitespace-pre-wrap">{m.dax_expression}</pre>
                              <button
                                onClick={() => handleCopyDax(m.dax_expression, idx)}
                                className="btn-recessed absolute top-2 right-2 p-1.5 rounded-md text-[#9a9a9a] hover:text-[#f5f5f4] transition-colors cursor-pointer"
                                title="Copy DAX"
                              >
                                {copiedIndex === idx ? (
                                  <Check className="h-3.5 w-3.5 text-[#f5f5f4]" />
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
                        <h4 className="text-xs font-semibold text-[#f5f5f4] mb-3">
                          Report Layout Visual Blueprint
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                          {powerbiOutput.visual_layout.map((v, i) => (
                            <div key={i} className="p-3.5 rounded-xl bg-[#0e0e10] border border-[#2c2c2e] space-y-1">
                              <div className="flex items-center justify-between text-[11px] font-mono">
                                <span className="font-bold text-[#f5f5f4]">{v.title}</span>
                                <span className="text-[#d4d4d3] font-semibold uppercase">{v.visual_type}</span>
                              </div>
                              <div className="text-[11px] text-[#9a9a9a]">
                                Measures: <span className="font-mono text-[#f5f5f4]">{v.assigned_measures.join(", ")}</span>
                              </div>
                              {v.assigned_dimensions.length > 0 && (
                                <div className="text-[11px] text-[#9a9a9a]">
                                  Axes: <span className="font-mono text-[#f5f5f4]">{v.assigned_dimensions.join(", ")}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-16 space-y-3 bg-[#0e0e10] rounded-xl border border-[#2c2c2e]">
                    <Layers className="h-10 w-10 text-[#5c5c5e] mx-auto" />
                    <h4 className="text-sm font-semibold text-[#f5f5f4]">
                      No Power BI Deliverables Generated Yet
                    </h4>
                    <p className="text-xs text-[#9a9a9a] max-w-md mx-auto">
                      Click &quot;Run End-to-End Pipeline&quot; to execute Agent 7, generate the Star Schema, compile verified DAX formulas, and export the downloadable .pbip bundle.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Chart Zoom Modal */}
      {zoomChart && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#19191b] border border-[#2c2c2e] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-floating text-[#f5f5f4]">
            <div className="flex items-center justify-between border-b border-[#2c2c2e] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#f5f5f4]">{zoomChart.title}</h3>
                <p className="text-xs text-[#9a9a9a] font-mono">{zoomChart.description}</p>
              </div>
              <button
                onClick={() => setZoomChart(null)}
                className="btn-recessed p-1.5 rounded-lg text-[#9a9a9a] hover:text-[#f5f5f4] transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-center bg-[#0e0e10] rounded-xl p-4 border border-[#2c2c2e]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${zoomChart.image_base64}`}
                alt={zoomChart.title}
                className="w-full h-auto max-h-[60vh] object-contain rounded-lg border border-[#2c2c2e] bg-white"
              />
            </div>

            {zoomChart.misleading_warnings.length > 0 && (
              <div className="p-3 rounded-xl bg-[#0e0e10] border border-[#2c2c2e] text-xs text-[#d4d4d3] space-y-1">
                <span className="font-bold text-[#f5f5f4]">Data Presentation Audit:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-[#9a9a9a]">
                  {zoomChart.misleading_warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[#2c2c2e]">
              <span className="text-xs font-mono text-[#9a9a9a]">
                Chart Type: {zoomChart.chart_type}
              </span>
              <a
                href={`data:image/png;base64,${zoomChart.image_base64}`}
                download={`${zoomChart.chart_id}.png`}
                className="btn-3d-dark px-4 py-2 text-xs font-semibold text-[#f5f5f4] inline-flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5 text-[#f5f5f4]" />
                <span>Download High-Res PNG</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
