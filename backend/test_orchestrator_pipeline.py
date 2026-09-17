"""Automated Test Suite for Hidden Orchestrator Agent (Agent 0) Architecture.

Validates:
1. Dataset profiling performance & accuracy.
2. Business problem classification and strict column grounding.
3. Analysis Brief synthesis conforming to JSON schema.
4. Agent 0 invisibility (no leakage to UI/chat step logs).
5. Downstream agents ingestion of the brief.
6. Validator pass and revision loop logic.
"""

import os
import sys
from datetime import datetime, timezone
import pytest

# Ensure backend root is on sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.agents.state import AgentState, AnalysisBrief, ChartRequirement, ValidationVerdict
from app.engine.orchestrator_engine import (
    profile_dataset_for_orchestrator,
    orchestrate_analysis,
    validate_pipeline_output,
)
from app.agents.orchestrator import orchestrator_agent, validator_agent
from app.agents.cleaner import data_cleaner_agent
from app.agents.transformer import data_transformer_agent
from app.agents.eda import eda_features_agent
from app.agents.sql_analyst import sql_analytics_agent
from app.agents.diagnostic import root_cause_agent
from app.agents.visualizer import data_visualizer_agent
from app.agents.powerbi import powerbi_architect_agent
from app.engine.duckdb_client import DuckDBClient


SAMPLE_FILE = os.path.abspath(os.path.join(backend_dir, "../data/raw/sample_business_sales.csv"))


def test_profiler_structure():
    """Verify profile_dataset_for_orchestrator generates correct lightweight metadata."""
    assert os.path.exists(SAMPLE_FILE), f"Sample file not found at {SAMPLE_FILE}"

    profile = profile_dataset_for_orchestrator(SAMPLE_FILE, sample_rows_count=10)
    assert "columns" in profile
    assert profile["total_rows"] > 0
    assert profile["column_count"] > 0
    assert len(profile["sample_rows"]) <= 10

    # Ensure column metadata exists
    col_names = [c["name"] for c in profile["columns"]]
    assert any("revenue" in c.lower() or "sales" in c.lower() for c in col_names)
    assert any("segment" in c.lower() or "region" in c.lower() for c in col_names)


def test_orchestrate_analysis_grounding():
    """Verify orchestrate_analysis correctly classifies problem and strictly grounds in real columns."""
    profile = profile_dataset_for_orchestrator(SAMPLE_FILE, sample_rows_count=15)
    avail_cols = [c["name"] for c in profile["columns"]]

    prompt = "Why are enterprise customer segments in Europe eroding gross revenue?"
    brief = orchestrate_analysis(business_prompt=prompt, dataset_profile=profile)

    assert isinstance(brief, AnalysisBrief)
    assert brief.problem_type in ("root_cause_diagnostic", "trend_analysis", "comparative", "predictive", "descriptive")
    # Must ground in a real column
    assert brief.target_metric in avail_cols
    # Key dimensions must exist
    for dim in brief.key_dimensions:
        assert dim in avail_cols
    # Columns in scope must exist
    for col in brief.columns_in_scope:
        assert col in avail_cols
    # Chart requirements must have valid types
    assert len(brief.chart_requirements) >= 1
    assert brief.success_criteria != ""
    assert brief.notes_for_downstream_agents != ""


def test_orchestrator_agent_hidden():
    """Verify Agent 0 runs invisibly without polluting user-facing step_history."""
    duck = DuckDBClient()
    try:
        metadata = duck.inspect_file(SAMPLE_FILE, "sample_sales")
    finally:
        duck.close()

    initial_state: AgentState = {
        "session_id": "test_sess_001",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "cleaning",
        "current_agent": "data_cleaner",
        "business_prompt": "Identify driver factors behind revenue differences across regions",
        "target_metric": "Gross Revenue",
        "dataset": metadata.model_dump(),
        "step_history": [],
        "retry_count": 0,
    }

    state = orchestrator_agent(initial_state)

    # Invisibility test: step_history MUST remain untouched by Agent 0
    assert len(state.get("step_history", [])) == 0, "Agent 0 must not emit step logs to user-visible step_history!"
    # Must populate analysis_brief
    assert state.get("analysis_brief") is not None
    assert state["analysis_brief"]["target_metric"] != ""
    # Status remains cleaning for the UI
    assert state.get("status") == "cleaning"
    assert state.get("current_agent") == "data_cleaner"


def test_full_pipeline_brief_propagation():
    """Verify all 7 downstream agents consume the brief and produce grounded deliverables."""
    duck = DuckDBClient()
    try:
        metadata = duck.inspect_file(SAMPLE_FILE, "sample_sales")
    finally:
        duck.close()

    state: AgentState = {
        "session_id": "test_sess_pipeline",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "cleaning",
        "current_agent": "data_cleaner",
        "business_prompt": "Which product categories and customer segments are eroding margin and gross revenue?",
        "target_metric": "Gross Revenue",
        "dataset": metadata.model_dump(),
        "step_history": [],
        "retry_count": 0,
    }

    # Step 0: Orchestrator
    state = orchestrator_agent(state)
    brief = state.get("analysis_brief", {})
    assert brief != {}

    # Step 1: Data Cleaner
    state = data_cleaner_agent(state, brief=brief)
    assert state.get("status") == "transforming"
    assert state.get("cleaning") is not None

    # Step 2: Transformer
    state = data_transformer_agent(state, brief=brief)
    assert state.get("status") == "analyzing"
    assert state.get("transformation") is not None

    # Step 3: EDA
    state = eda_features_agent(state, brief=brief)
    assert state.get("status") == "querying_sql"
    assert state.get("eda") is not None

    # Step 4: SQL Analyst
    state = sql_analytics_agent(state, brief=brief)
    assert state.get("status") == "diagnosing"
    assert state.get("sql_analytics") is not None

    # Step 5: Root-Cause Diagnostics
    state = root_cause_agent(state, brief=brief)
    assert state.get("status") == "visualizing"
    assert state.get("root_cause") is not None
    assert len(state["root_cause"]["drivers"]) > 0

    # Step 6: Visualizer
    state = data_visualizer_agent(state, brief=brief)
    assert state.get("status") == "generating_bi"
    assert state.get("visualization") is not None
    assert state["visualization"]["total_charts"] > 0

    # Step 7: Power BI Architect
    state = powerbi_architect_agent(state, brief=brief)
    assert state.get("powerbi") is not None
    assert len(state["powerbi"]["dax_catalog"]) > 0

    # Step 8: Validator & Revision Loop
    state, verdict = validator_agent(state)
    assert isinstance(verdict, ValidationVerdict)
    assert state.get("validation_attempts", 0) >= 1

    if not verdict.passed:
        assert verdict.revise_agent in [
            "data_cleaner",
            "data_transformer",
            "eda_features",
            "sql_analytics",
            "root_cause_engine",
            "data_visualizer",
            "powerbi_architect",
        ]
        assert verdict.revision_note is not None and len(verdict.revision_note) > 0
        # Execute revision on the identified agent with revision directive
        if verdict.revise_agent == "root_cause_engine":
            state = root_cause_agent(state, brief=brief, revision_note=verdict.revision_note)
            assert state.get("root_cause") is not None
        elif verdict.revise_agent == "data_visualizer":
            state = data_visualizer_agent(state, brief=brief, revision_note=verdict.revision_note)
            assert state.get("visualization") is not None


def test_demographic_predictive_extrapolation_and_minimalist_policy():
    """Verify common sense, domain metrology, minimalist transforms, and 20-year prediction on population dataset."""
    pop_file = os.path.abspath(os.path.join(backend_dir, "../data/raw/ds_1789483637_world_population.csv"))
    assert os.path.exists(pop_file), f"Population dataset not found at {pop_file}"

    profile = profile_dataset_for_orchestrator(pop_file, sample_rows_count=15)
    prompt = "predict population after 20 years"
    brief = orchestrate_analysis(business_prompt=prompt, dataset_profile=profile)

    # 1. Common Sense & Domain Metrology Assertions
    assert brief.dataset_domain == "demographics"
    assert brief.metric_unit == "people"
    assert brief.unit_symbol == ""
    assert "₹" in brief.banned_symbols and "$" in brief.banned_symbols
    assert any(term in brief.banned_terms for term in ["revenue", "sales", "order", "product", "aov"])
    assert brief.problem_type == "predictive"
    assert brief.time_horizon == "20_years_forward"
    assert brief.target_year == 2042
    assert brief.target_metric == "2022 Population"
    assert brief.feature_engineering_policy == "minimalist_prerequisite_only"

    # 2. Minimalist Transformation Policy Test
    from app.engine.transformer_engine import DataTransformationEngine
    transformer = DataTransformationEngine(clean_file_path=pop_file, brief=brief.model_dump())
    df_trans, trans_out = transformer.transform()

    # Must only add prerequisite projection features, not generic transforms
    assert trans_out.features_created == 4
    feature_names = [f.feature_name for f in trans_out.feature_catalog]
    assert "historical_cagr_pct" in feature_names
    assert "2042_projected_population" in feature_names
    assert "projected_20y_net_growth" in feature_names
    assert "projected_20y_growth_pct" in feature_names

    # 3. Domain Adaptive Visualizations Test
    from app.engine.visualization_engine import DataVisualizationEngine
    viz_engine = DataVisualizationEngine(dataset_path=trans_out.transformed_file_path, brief=brief.model_dump())
    viz_out = viz_engine.visualize_all(brief=brief.model_dump())

    # Zero currency symbols or retail words in KPI cards
    for card in viz_out.kpi_cards:
        for sym in ["₹", "$", "€"]:
            assert sym not in card.formatted_value, f"Banned symbol {sym} in {card.formatted_value}"
        assert "AOV" not in card.title
        assert "fulfilled sales" not in card.description

    # Forecast Trajectory Chart must exist
    chart_titles = [c.title for c in viz_out.rendered_charts]
    assert any("20-Year Extrapolation" in t or "2042" in t for t in chart_titles)
    assert any("Top 10 Most Populous" in t for t in chart_titles)

    # 4. SQL Engine Clean Schema Test
    from app.engine.sql_engine import SQLAnalyticsEngine
    sql_engine = SQLAnalyticsEngine(dataset_path=trans_out.transformed_file_path, brief=brief.model_dump())
    sql_out = sql_engine.run_default_analytical_suite()
    assert sql_out.total_queries_run >= 3
    # No retail query titles
    for q in sql_out.executed_queries:
        assert "Products by Revenue" not in q.query_name
        assert "Payment Method" not in q.query_name


def test_problem_statement_mandatory_requirement():
    """Verify that the pipeline strictly rejects execution if no proper problem statement is provided."""
    import pytest
    from pydantic import ValidationError
    from app.api.pipeline import RunPipelineRequest

    # 1. Empty or whitespace prompt must fail pydantic validation
    with pytest.raises(ValidationError):
        RunPipelineRequest(dataset_id="test_ds", business_prompt="")

    with pytest.raises(ValidationError):
        RunPipelineRequest(dataset_id="test_ds", business_prompt="   ")

    # 2. Too brief / non-substantive prompt must fail pydantic validation
    with pytest.raises(ValidationError):
        RunPipelineRequest(dataset_id="test_ds", business_prompt="hi test")

    # 3. Proper substantive statement passes
    valid_req = RunPipelineRequest(dataset_id="test_ds", business_prompt="Predict population after 20 years")
    assert valid_req.business_prompt == "Predict population after 20 years"

    # 4. Orchestrator agent node directly fails if given empty or brief prompt in state
    duck = DuckDBClient()
    try:
        metadata = duck.inspect_file(SAMPLE_FILE, "sample_sales")
    finally:
        duck.close()

    invalid_state: AgentState = {
        "session_id": "test_sess_invalid",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "cleaning",
        "current_agent": "data_cleaner",
        "business_prompt": "",
        "target_metric": "",
        "dataset": metadata.model_dump(),
        "step_history": [],
        "retry_count": 0,
    }

    result_state = orchestrator_agent(invalid_state)
    assert result_state.get("status") == "failed"
    assert "proper problem statement is required" in result_state.get("error", "").lower()

