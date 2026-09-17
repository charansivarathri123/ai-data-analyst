"""Agent State definitions for the Autonomous AI Data Analyst & BI Studio.

Defines the core LangGraph state machine data structures, supporting typed transitions
across 7 specialized agents: Data Cleaning, Data Transformation, EDA, SQL Analysis,
Root-Cause Diagnostics, Matplotlib & Seaborn Visualizations, and Power BI Architecture.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, TypedDict
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# 1. Pipeline Lifecycle & Event Tracking
# ---------------------------------------------------------------------------

AgentRole = Literal[
    "orchestrator",
    "data_cleaner",
    "data_transformer",
    "eda_features",
    "sql_analytics",
    "root_cause_engine",
    "data_visualizer",
    "powerbi_architect",
]

PipelineStatus = Literal[
    "idle",
    "ingesting",
    "cleaning",
    "transforming",
    "analyzing",
    "querying_sql",
    "diagnosing",
    "visualizing",
    "generating_bi",
    "completed",
    "failed",
]


class AgentStepLog(BaseModel):
    """Execution trace event emitted by an agent for SSE streaming & audit logs."""

    agent: AgentRole
    timestamp: str
    phase: str
    summary: str
    detail: Optional[str] = None
    level: Literal["info", "success", "warning", "error"] = "info"


# ---------------------------------------------------------------------------
# 2. Ingestion & Schema Representation
# ---------------------------------------------------------------------------

class ColumnSchema(BaseModel):
    name: str
    inferred_type: str
    sample_values: List[Any] = Field(default_factory=list)
    null_count: int = 0
    unique_count: int = 0


class DatasetMetadata(BaseModel):
    """Metadata describing the ingested raw tabular dataset."""

    dataset_id: str
    file_name: str
    file_path: str
    file_size_bytes: int
    row_count: int
    column_count: int
    columns: List[ColumnSchema] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# 3. Agent 1: Data Wrangling & Quality State (per data cleaning doc)
# ---------------------------------------------------------------------------

class ColumnProfilingSummary(BaseModel):
    column_name: str
    data_type: str
    role: Literal["numerical", "categorical", "date", "text", "boolean", "identifier"]
    non_null_count: int
    missing_count: int
    missing_pct: float
    unique_count: int
    duplicate_pct: float = 0.0
    min_val: Optional[Any] = None
    max_val: Optional[Any] = None
    mean_val: Optional[float] = None
    median_val: Optional[float] = None
    std_val: Optional[float] = None
    mode_val: Optional[Any] = None
    outlier_count: int = 0
    top_categories: List[Dict[str, Any]] = Field(default_factory=list)


class RecommendationItem(BaseModel):
    column: str
    issue: str
    severity: Literal["low", "medium", "high", "critical"]
    affected_rows: int
    recommended_action: str
    reason: str


class BeforeAfterComparison(BaseModel):
    before_rows: int
    after_rows: int
    before_cols: int
    after_cols: int
    before_nulls: int
    after_nulls: int
    before_duplicates: int
    after_duplicates: int
    before_outliers: int
    after_outliers: int
    null_improvement_pct: float = 0.0
    duplicate_improvement_pct: float = 0.0


class AuditRuleLog(BaseModel):
    column: str
    operation: str
    rationale: str
    affected_rows: int = 0


class CleaningQualityScorecard(BaseModel):
    overall_score: float = Field(ge=0.0, le=100.0, description="0 to 100 quality score")
    completeness: float = Field(ge=0.0, le=100.0)
    type_validity: float = Field(ge=0.0, le=100.0)
    duplicate_free: float = Field(ge=0.0, le=100.0)
    consistency: float = Field(default=95.0, ge=0.0, le=100.0)
    accuracy: float = Field(default=95.0, ge=0.0, le=100.0)
    total_nulls_imputed: int = 0
    total_rows_cleaned: int = 0
    score_breakdown: Optional[str] = None


class DataCleanerOutput(BaseModel):
    """Artifacts produced by Agent 1: Data Cleaning & Wrangling Agent."""

    cleaned_file_path: str
    scorecard: CleaningQualityScorecard
    profiling: List[ColumnProfilingSummary] = Field(default_factory=list)
    recommendations: List[RecommendationItem] = Field(default_factory=list)
    before_after: Optional[BeforeAfterComparison] = None
    audit_trail: List[AuditRuleLog] = Field(default_factory=list)
    transformation_code: Optional[str] = None


# ---------------------------------------------------------------------------
# 4. Agent 2: Data Transformation State (per data transformation doc) [NEW]
# ---------------------------------------------------------------------------

class TransformedFeatureMeta(BaseModel):
    feature_name: str
    formula: str
    data_type: str
    feature_type: Literal[
        "scaled", "binned", "encoded", "temporal", "calculated", "window", "text"
    ]
    missing_pct: float = 0.0
    unique_count: int = 0
    description: str


class TransformationStepLog(BaseModel):
    step_index: int
    operation: str
    column: str
    formula: str
    rows_affected: int
    sample_before: Optional[str] = None
    sample_after: Optional[str] = None


class DataTransformationOutput(BaseModel):
    """Artifacts produced by Agent 2: Data Transformation & Feature Engineering Agent."""

    transformed_file_path: str
    total_features: int
    features_created: int
    feature_catalog: List[TransformedFeatureMeta] = Field(default_factory=list)
    transformation_pipeline: List[str] = Field(default_factory=list)
    transformation_history: List[TransformationStepLog] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# 5. Agent 3: Exploratory Data Analysis State (per EDA doc)
# ---------------------------------------------------------------------------

class NumericSummary(BaseModel):
    column: str
    count: int
    mean: float
    std: float
    min: float
    p25: float
    median: float
    p75: float
    max: float
    skewness: float
    kurtosis: float = 0.0
    iqr: float
    distribution_shape: Literal[
        "normal_like", "right_skewed", "left_skewed", "heavy_tailed", "zero_inflated"
    ] = "normal_like"
    recommended_transform: Optional[str] = None


class CategoricalSummary(BaseModel):
    column: str
    unique_count: int
    cardinality_status: Literal["low", "medium", "high_cardinality"] = "low"
    dominant_category: Optional[str] = None
    dominant_pct: float = 0.0
    rare_category_count: int = 0
    top_categories: List[Dict[str, Any]] = Field(default_factory=list)


class CorrelationEntry(BaseModel):
    feature_x: str
    feature_y: str
    pearson_r: float
    spearman_rho: Optional[float] = None


class OutlierAnomaly(BaseModel):
    column: str
    anomaly_count: int
    outlier_pct: float = 0.0
    lower_bound: float
    upper_bound: float
    method: Literal["iqr", "zscore", "isolation_forest"] = "iqr"


class BusinessInsightItem(BaseModel):
    insight_type: Literal[
        "performance", "trend", "anomaly", "correlation", "concentration"
    ]
    title: str
    observation: str
    business_implication: str
    severity: Literal["info", "positive", "warning", "critical"] = "info"


class ExecutiveDataStory(BaseModel):
    dataset_overview: str
    key_patterns: List[str] = Field(default_factory=list)
    important_trends: List[str] = Field(default_factory=list)
    anomalies: List[str] = Field(default_factory=list)
    relationships: List[str] = Field(default_factory=list)
    business_insights: List[str] = Field(default_factory=list)
    recommended_next_analysis: List[str] = Field(default_factory=list)


class EDAFeatureOutput(BaseModel):
    """Artifacts produced by Agent 3: Exploratory Data Analysis Agent."""

    numeric_summaries: List[NumericSummary] = Field(default_factory=list)
    categorical_summaries: List[CategoricalSummary] = Field(default_factory=list)
    correlations: List[CorrelationEntry] = Field(default_factory=list)
    outliers: List[OutlierAnomaly] = Field(default_factory=list)
    derived_time_features: List[str] = Field(default_factory=list)
    distribution_notes: List[str] = Field(default_factory=list)
    insights: List[BusinessInsightItem] = Field(default_factory=list)
    data_story: Optional[ExecutiveDataStory] = None


# ---------------------------------------------------------------------------
# 6. Agent 4: SQL Analysis & Query State (per sql analytics doc) [NEW]
# ---------------------------------------------------------------------------

class SQLQueryResult(BaseModel):
    query_name: str
    sql_query: str
    explanation: str
    row_count: int
    execution_time_ms: float
    columns: List[str]
    column_types: List[str]
    rows: List[Dict[str, Any]] = Field(default_factory=list)
    chart_recommendation: Optional[str] = None


class SQLTableSchema(BaseModel):
    table_name: str
    row_count: int
    column_count: int
    columns: List[ColumnSchema] = Field(default_factory=list)
    sample_rows: List[Dict[str, Any]] = Field(default_factory=list)
    create_table_ddl: str


class SQLTemplate(BaseModel):
    template_id: str
    name: str
    business_question: str
    sql_query: str
    category: str


class SQLAnalyticsOutput(BaseModel):
    """Artifacts produced by Agent 4: SQL Analysis & Business Query Agent."""

    database_engine: str = "DuckDB In-Memory Analytical Engine"
    registered_tables: List[SQLTableSchema] = Field(default_factory=list)
    executed_queries: List[SQLQueryResult] = Field(default_factory=list)
    available_templates: List[SQLTemplate] = Field(default_factory=list)
    total_queries_run: int = 0


# ---------------------------------------------------------------------------
# 7. Agent 5: Root-Cause & Diagnostics State
# ---------------------------------------------------------------------------

class KeyDriver(BaseModel):
    feature: str
    importance_score: float
    impact_direction: Literal["positive", "negative", "neutral"]
    description: str


class CohortComparison(BaseModel):
    cohort_name: str
    sample_size: int
    metrics: Dict[str, float] = Field(default_factory=dict)
    key_differentiators: List[str] = Field(default_factory=list)


class NarrativeSummary(BaseModel):
    what_happened: str
    why_it_happened: str
    recommended_interventions: List[str] = Field(default_factory=list)


class RootCauseOutput(BaseModel):
    """Artifacts produced by Agent 5: Root-Cause & Diagnostics Agent."""

    target_metric: str
    drivers: List[KeyDriver] = Field(default_factory=list)
    cohorts: List[CohortComparison] = Field(default_factory=list)
    narrative: NarrativeSummary


# ---------------------------------------------------------------------------
# 8. Agent 6: Data Visualization State (Matplotlib & Seaborn) (per doc) [NEW]
# ---------------------------------------------------------------------------

class RenderedChart(BaseModel):
    chart_id: str
    title: str
    chart_type: Literal[
        "line", "bar", "grouped_bar", "hist", "box", "heatmap", "scatter", "donut"
    ]
    image_base64: str
    file_path: str
    description: str
    insights: List[str] = Field(default_factory=list)
    x_col: Optional[str] = None
    y_col: Optional[str] = None
    hue_col: Optional[str] = None
    misleading_warnings: List[str] = Field(default_factory=list)
    underlying_data: List[Dict[str, Any]] = Field(default_factory=list)


class ChartRecommendation(BaseModel):
    recommendation_id: str
    chart_type: str
    suggested_columns: List[str]
    business_question: str
    reason: str


class VisualKPICard(BaseModel):
    title: str
    metric_value: float
    formatted_value: str
    previous_value: Optional[float] = None
    change_pct: Optional[float] = None
    trend_direction: Literal["up", "down", "neutral"] = "neutral"
    description: str


class DataVisualizationOutput(BaseModel):
    """Artifacts produced by Agent 6: Data Visualization Agent (Matplotlib & Seaborn)."""

    rendered_charts: List[RenderedChart] = Field(default_factory=list)
    recommendations: List[ChartRecommendation] = Field(default_factory=list)
    kpi_cards: List[VisualKPICard] = Field(default_factory=list)
    export_directory: str
    total_charts: int = 0


# ---------------------------------------------------------------------------
# 9. Agent 7: Power BI Architect State
# ---------------------------------------------------------------------------

class StarSchemaDimension(BaseModel):
    table_name: str
    key_column: str
    attributes: List[str] = Field(default_factory=list)


class StarSchemaRelationship(BaseModel):
    from_table: str
    from_column: str
    to_table: str
    to_column: str
    cardinality: Literal["1:*", "*:1", "1:1"] = "*:1"


class StarSchemaLayout(BaseModel):
    fact_table_name: str
    dimensions: List[StarSchemaDimension] = Field(default_factory=list)
    relationships: List[StarSchemaRelationship] = Field(default_factory=list)


class DAXMeasure(BaseModel):
    name: str
    dax_expression: str
    description: str
    category: Literal["KPI", "Growth_MoM_YoY", "Ratio", "Cumulative", "Ranking"]
    display_folder: Optional[str] = None
    format_string: Optional[str] = None


class VisualSpecification(BaseModel):
    visual_type: Literal["card", "bar_chart", "line_chart", "donut", "scatter", "matrix"]
    title: str
    assigned_measures: List[str]
    assigned_dimensions: List[str]
    filters: List[str] = Field(default_factory=list)


class PowerBIArchitectOutput(BaseModel):
    """Artifacts produced by Agent 7: Power BI Architect Agent."""

    star_schema: StarSchemaLayout
    dax_catalog: List[DAXMeasure] = Field(default_factory=list)
    visual_layout: List[VisualSpecification] = Field(default_factory=list)
    tmdl_manifest_path: Optional[str] = None
    pbip_bundle_path: Optional[str] = None


# ---------------------------------------------------------------------------
# 10. Agent 0: Orchestrator & Validator State
# ---------------------------------------------------------------------------

class ChartRequirement(BaseModel):
    type: str = Field(description="Chart type (e.g., 'line', 'waterfall', 'bar', 'scatter', 'box')")
    x: Optional[str] = Field(default=None, description="X-axis column or dimension")
    y: Optional[str] = Field(default=None, description="Y-axis column or metric")
    split_by: Optional[str] = Field(default=None, description="Dimension to group or split series by")
    purpose: Optional[str] = Field(default=None, description="Analytical purpose of the chart")


class AnalysisBrief(BaseModel):
    """Structured analysis brief emitted by Agent 0 (Hidden Orchestrator)."""

    problem_type: Literal[
        "root_cause_diagnostic",
        "trend_analysis",
        "comparative",
        "predictive",
        "descriptive",
    ] = "descriptive"
    restated_goal: str = Field(description="Clarified business goal grounded in the dataset")
    target_metric: str = Field(description="Primary focal metric column name")
    key_dimensions: List[str] = Field(default_factory=list, description="Key grouping or slicing columns")
    required_analyses: List[str] = Field(
        default_factory=list,
        description="Analyses required (e.g., 'trend_over_time', 'cohort_comparison', 'driver_attribution')",
    )
    chart_requirements: List[ChartRequirement] = Field(
        default_factory=list, description="Explicit chart specifications for Visualizer"
    )
    columns_in_scope: List[str] = Field(
        default_factory=list, description="Columns that downstream agents must prioritize"
    )
    columns_out_of_scope: List[str] = Field(
        default_factory=list, description="Columns to ignore or deprioritize"
    )
    success_criteria: str = Field(
        description="Plain-language rubric used by the validator pass at the end"
    )
    notes_for_downstream_agents: str = Field(
        default="", description="Guiding constraints and directives for feature engineering and downstream agents"
    )


class ValidationVerdict(BaseModel):
    """Result of the end-of-pipeline validator inspection."""

    passed: bool
    revise_agent: Optional[str] = None
    revision_note: Optional[str] = None


# ---------------------------------------------------------------------------
# 11. LangGraph Master State Schema (TypedDict & Pydantic Master)
# ---------------------------------------------------------------------------

class AgentState(TypedDict, total=False):
    """LangGraph execution state machine schema.

    Enables state persistence, checkpointing, and cyclic retry transitions
    across the 7 sequential agents and hidden orchestrator.
    """

    session_id: str
    created_at: str
    status: PipelineStatus
    current_agent: AgentRole
    error: Optional[str]

    # User Input & Intent
    business_prompt: Optional[str]
    target_metric: Optional[str]

    # Ingestion State
    dataset: Optional[Dict[str, Any]]

    # Agent 0: Hidden Orchestrator State
    analysis_brief: Optional[Dict[str, Any]]
    validation_verdict: Optional[Dict[str, Any]]
    validation_attempts: int
    revision_notes: Optional[Dict[str, str]]

    # 7 Agent Outputs
    cleaning: Optional[Dict[str, Any]]
    transformation: Optional[Dict[str, Any]]
    eda: Optional[Dict[str, Any]]
    sql_analytics: Optional[Dict[str, Any]]
    root_cause: Optional[Dict[str, Any]]
    visualization: Optional[Dict[str, Any]]
    powerbi: Optional[Dict[str, Any]]

    # Real-time Telemetry & Reflection
    step_history: List[Dict[str, Any]]
    retry_count: int

