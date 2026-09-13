export type AgentRole =
  | "orchestrator"
  | "data_cleaner"
  | "data_transformer"
  | "eda_features"
  | "sql_analytics"
  | "root_cause_engine"
  | "data_visualizer"
  | "powerbi_architect";

export type PipelineStatus =
  | "idle"
  | "ingesting"
  | "cleaning"
  | "transforming"
  | "analyzing"
  | "querying_sql"
  | "diagnosing"
  | "visualizing"
  | "generating_bi"
  | "completed"
  | "failed";

export interface AgentStepLog {
  agent: AgentRole;
  timestamp: string;
  phase: string;
  summary: string;
  detail?: string;
  level: "info" | "success" | "warning" | "error";
}

export interface ColumnSchema {
  name: string;
  inferred_type: string;
  sample_values: unknown[];
  null_count: number;
  unique_count: number;
}

export interface DatasetMetadata {
  dataset_id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  row_count: number;
  column_count: number;
  columns: ColumnSchema[];
}

// ---------------------------------------------------------------------------
// 1. Agent 1: Data Wrangling & Quality Models
// ---------------------------------------------------------------------------

export interface ColumnProfilingSummary {
  column_name: string;
  data_type: string;
  role: "numerical" | "categorical" | "date" | "text" | "boolean" | "identifier";
  non_null_count: number;
  missing_count: number;
  missing_pct: number;
  unique_count: number;
  duplicate_pct: number;
  min_val?: unknown;
  max_val?: unknown;
  mean_val?: number;
  median_val?: number;
  std_val?: number;
  mode_val?: unknown;
  outlier_count: number;
  top_categories: Record<string, unknown>[];
}

export interface RecommendationItem {
  column: string;
  issue: string;
  severity: "low" | "medium" | "high" | "critical";
  affected_rows: number;
  recommended_action: string;
  reason: string;
}

export interface BeforeAfterComparison {
  before_rows: number;
  after_rows: number;
  before_cols: number;
  after_cols: number;
  before_nulls: number;
  after_nulls: number;
  before_duplicates: number;
  after_duplicates: number;
  before_outliers: number;
  after_outliers: number;
  null_improvement_pct: number;
  duplicate_improvement_pct: number;
}

export interface CleaningQualityScorecard {
  overall_score: number;
  completeness: number;
  type_validity: number;
  duplicate_free: number;
  consistency?: number;
  accuracy?: number;
  total_nulls_imputed: number;
  total_rows_cleaned: number;
  score_breakdown?: string;
}

export interface AuditRuleLog {
  column: string;
  operation: string;
  rationale: string;
  affected_rows: number;
}

export interface DataCleanerOutput {
  cleaned_file_path: string;
  scorecard: CleaningQualityScorecard;
  profiling?: ColumnProfilingSummary[];
  recommendations?: RecommendationItem[];
  before_after?: BeforeAfterComparison;
  audit_trail: AuditRuleLog[];
  transformation_code?: string;
}

// ---------------------------------------------------------------------------
// 2. Agent 2: Data Transformation & Feature Engineering Models
// ---------------------------------------------------------------------------

export interface TransformedFeatureMeta {
  feature_name: string;
  formula: string;
  data_type: string;
  feature_type: "scaled" | "binned" | "encoded" | "temporal" | "calculated" | "window" | "text";
  missing_pct: number;
  unique_count: number;
  description: string;
}

export interface TransformationStepLog {
  step_index: number;
  operation: string;
  column: string;
  formula: string;
  rows_affected: number;
  sample_before?: string;
  sample_after?: string;
}

export interface DataTransformationOutput {
  transformed_file_path: string;
  total_features: number;
  features_created: number;
  feature_catalog: TransformedFeatureMeta[];
  transformation_pipeline: string[];
  transformation_history: TransformationStepLog[];
}

// ---------------------------------------------------------------------------
// 3. Agent 3: Exploratory Data Analysis Models
// ---------------------------------------------------------------------------

export interface NumericSummary {
  column: string;
  count: number;
  mean: number;
  std: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  skewness: number;
  kurtosis?: number;
  iqr: number;
  distribution_shape?: "normal_like" | "right_skewed" | "left_skewed" | "heavy_tailed" | "zero_inflated";
  recommended_transform?: string;
}

export interface CategoricalSummary {
  column: string;
  unique_count: number;
  cardinality_status: "low" | "medium" | "high_cardinality";
  dominant_category?: string;
  dominant_pct: number;
  rare_category_count: number;
  top_categories: Record<string, unknown>[];
}

export interface CorrelationEntry {
  feature_x: string;
  feature_y: string;
  pearson_r: number;
  spearman_rho?: number;
}

export interface OutlierAnomaly {
  column: string;
  anomaly_count: number;
  outlier_pct?: number;
  lower_bound: number;
  upper_bound: number;
  method: "iqr" | "zscore" | "isolation_forest";
}

export interface BusinessInsightItem {
  insight_type: "performance" | "trend" | "anomaly" | "correlation" | "concentration";
  title: string;
  observation: string;
  business_implication: string;
  severity: "info" | "positive" | "warning" | "critical";
}

export interface ExecutiveDataStory {
  dataset_overview: string;
  key_patterns: string[];
  important_trends: string[];
  anomalies: string[];
  relationships: string[];
  business_insights: string[];
  recommended_next_analysis: string[];
}

export interface EDAFeatureOutput {
  numeric_summaries: NumericSummary[];
  categorical_summaries?: CategoricalSummary[];
  correlations: CorrelationEntry[];
  outliers: OutlierAnomaly[];
  derived_time_features: string[];
  distribution_notes: string[];
  insights?: BusinessInsightItem[];
  data_story?: ExecutiveDataStory;
}

// ---------------------------------------------------------------------------
// 4. Agent 4: SQL Analysis & Query Models
// ---------------------------------------------------------------------------

export interface SQLQueryResult {
  query_name: string;
  sql_query: string;
  explanation: string;
  row_count: number;
  execution_time_ms: number;
  columns: string[];
  column_types: string[];
  rows: Record<string, unknown>[];
  chart_recommendation?: string;
}

export interface SQLTableSchema {
  table_name: string;
  row_count: number;
  column_count: number;
  columns: ColumnSchema[];
  sample_rows: Record<string, unknown>[];
  create_table_ddl: string;
}

export interface SQLTemplate {
  template_id: string;
  name: string;
  business_question: string;
  sql_query: string;
  category: string;
}

export interface SQLAnalyticsOutput {
  database_engine: string;
  registered_tables: SQLTableSchema[];
  executed_queries: SQLQueryResult[];
  available_templates: SQLTemplate[];
  total_queries_run: number;
}

// ---------------------------------------------------------------------------
// 5. Agent 5: Root-Cause & Diagnostics Models
// ---------------------------------------------------------------------------

export interface KeyDriver {
  feature: string;
  importance_score: number;
  impact_direction: "positive" | "negative" | "neutral";
  description: string;
}

export interface CohortComparison {
  cohort_name: string;
  sample_size: number;
  metrics: Record<string, number>;
  key_differentiators: string[];
}

export interface NarrativeSummary {
  what_happened: string;
  why_it_happened: string;
  recommended_interventions: string[];
}

export interface RootCauseOutput {
  target_metric: string;
  drivers: KeyDriver[];
  cohorts: CohortComparison[];
  narrative: NarrativeSummary;
}

// ---------------------------------------------------------------------------
// 6. Agent 6: Data Visualization Models (Matplotlib & Seaborn)
// ---------------------------------------------------------------------------

export interface RenderedChart {
  chart_id: string;
  title: string;
  chart_type: "line" | "bar" | "grouped_bar" | "hist" | "box" | "heatmap" | "scatter" | "donut";
  image_base64: string;
  file_path: string;
  description: string;
  insights: string[];
  x_col?: string;
  y_col?: string;
  hue_col?: string;
  misleading_warnings: string[];
  underlying_data: Record<string, unknown>[];
}

export interface ChartRecommendation {
  recommendation_id: string;
  chart_type: string;
  suggested_columns: string[];
  business_question: string;
  reason: string;
}

export interface VisualKPICard {
  title: string;
  metric_value: number;
  formatted_value: string;
  previous_value?: number;
  change_pct?: number;
  trend_direction: "up" | "down" | "neutral";
  description: string;
}

export interface DataVisualizationOutput {
  rendered_charts: RenderedChart[];
  recommendations: ChartRecommendation[];
  kpi_cards: VisualKPICard[];
  export_directory: string;
  total_charts: number;
}

// ---------------------------------------------------------------------------
// 7. Agent 7: Power BI Architect Models
// ---------------------------------------------------------------------------

export interface DAXMeasure {
  name: string;
  dax_expression: string;
  description: string;
  category: "KPI" | "Growth_MoM_YoY" | "Ratio" | "Cumulative" | "Ranking";
  display_folder?: string;
  format_string?: string;
}

export interface VisualSpecification {
  visual_type: "card" | "bar_chart" | "line_chart" | "donut" | "scatter" | "matrix";
  title: string;
  assigned_measures: string[];
  assigned_dimensions: string[];
  filters: string[];
}

export interface StarSchemaDimension {
  table_name: string;
  key_column: string;
  attributes: string[];
}

export interface StarSchemaRelationship {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  cardinality: "1:*" | "*:1" | "1:1";
}

export interface StarSchemaLayout {
  fact_table_name: string;
  dimensions: StarSchemaDimension[];
  relationships: StarSchemaRelationship[];
}

export interface PowerBIArchitectOutput {
  star_schema: StarSchemaLayout;
  dax_catalog: DAXMeasure[];
  visual_layout: VisualSpecification[];
  tmdl_manifest_path?: string;
  pbip_bundle_path?: string;
}

// ---------------------------------------------------------------------------
// LangGraph Master Agent State
// ---------------------------------------------------------------------------

export interface AgentState {
  session_id: string;
  created_at: string;
  status: PipelineStatus;
  current_agent?: AgentRole;
  error?: string;
  business_prompt?: string;
  target_metric?: string;
  dataset?: DatasetMetadata;
  cleaning?: DataCleanerOutput;
  transformation?: DataTransformationOutput;
  eda?: EDAFeatureOutput;
  sql_analytics?: SQLAnalyticsOutput;
  root_cause?: RootCauseOutput;
  visualization?: DataVisualizationOutput;
  powerbi?: PowerBIArchitectOutput;
  step_history: AgentStepLog[];
  retry_count: number;
}
