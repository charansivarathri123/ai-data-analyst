"""Comprehensive end-to-end validation test for the 7-Agent Autonomous Pipeline."""

import os
import sys
from datetime import datetime, timezone
import pytest

from app.agents.cleaner import data_cleaner_agent
from app.agents.transformer import data_transformer_agent
from app.agents.eda import eda_features_agent
from app.agents.sql_analyst import sql_analytics_agent
from app.agents.diagnostic import root_cause_agent
from app.agents.visualizer import data_visualizer_agent
from app.agents.powerbi import powerbi_architect_agent
from app.agents.state import AgentState
from app.engine.duckdb_client import DuckDBClient


def test_full_7_agent_pipeline():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    sample_csv = os.path.join(base_dir, "data", "raw", "sample_business_sales.csv")
    assert os.path.exists(sample_csv), f"Sample dataset not found at {sample_csv}"

    print(f"\n[PIPELINE TEST] Ingesting dataset: {os.path.basename(sample_csv)}")
    duck = DuckDBClient()
    try:
        metadata = duck.inspect_file(sample_csv, "sample_business_sales")
    finally:
        duck.close()

    # Initial state
    state: AgentState = {
        "session_id": f"test_sess_{int(datetime.now(timezone.utc).timestamp())}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "cleaning",
        "current_agent": "data_cleaner",
        "business_prompt": "Analyze Q3 gross revenue performance across sales channels.",
        "target_metric": "total_sales",
        "dataset": metadata.model_dump(),
        "step_history": [],
        "retry_count": 0,
    }

    # =========================================================================
    # STEP 1: Agent 1 - Data Cleaning
    # =========================================================================
    state = data_cleaner_agent(state)
    assert state.get("status") == "transforming", f"Unexpected status: {state.get('status')}"
    assert state.get("current_agent") == "data_transformer"
    cleaning = state.get("cleaning")
    assert cleaning is not None
    assert cleaning["scorecard"]["overall_score"] >= 80.0
    assert len(cleaning["profiling"]) > 0
    assert len(cleaning["recommendations"]) > 0
    assert cleaning["before_after"] is not None
    print(f"[PASS] Agent 1 (Data Cleaner): Scorecard {cleaning['scorecard']['overall_score']}/100 | {len(cleaning['profiling'])} columns profiled")

    # =========================================================================
    # STEP 2: Agent 2 - Data Transformation [NEW]
    # =========================================================================
    state = data_transformer_agent(state)
    assert state.get("status") == "analyzing"
    assert state.get("current_agent") == "eda_features"
    transform = state.get("transformation")
    assert transform is not None
    assert transform["features_created"] > 0
    assert os.path.exists(transform["transformed_file_path"])
    print(f"[PASS] Agent 2 (Data Transformer): {transform['features_created']} features engineered | File: {os.path.basename(transform['transformed_file_path'])}")

    # =========================================================================
    # STEP 3: Agent 3 - Exploratory Data Analysis (EDA)
    # =========================================================================
    state = eda_features_agent(state)
    assert state.get("status") == "querying_sql"
    assert state.get("current_agent") == "sql_analytics"
    eda = state.get("eda")
    assert eda is not None
    assert len(eda["numeric_summaries"]) > 0
    assert len(eda["categorical_summaries"]) > 0
    assert len(eda["correlations"]) > 0
    assert len(eda["insights"]) > 0
    assert eda["data_story"] is not None
    print(f"[PASS] Agent 3 (EDA): {len(eda['numeric_summaries'])} numeric summaries | {len(eda['correlations'])} correlations | {len(eda['insights'])} insights")

    # =========================================================================
    # STEP 4: Agent 4 - SQL Analysis & Query Studio [NEW]
    # =========================================================================
    state = sql_analytics_agent(state)
    assert state.get("status") == "diagnosing"
    assert state.get("current_agent") == "root_cause_engine"
    sql_out = state.get("sql_analytics")
    assert sql_out is not None
    assert len(sql_out["registered_tables"]) > 0
    assert len(sql_out["executed_queries"]) > 0
    assert len(sql_out["available_templates"]) >= 5
    print(f"[PASS] Agent 4 (SQL Analytics): {len(sql_out['executed_queries'])} queries executed | {len(sql_out['available_templates'])} KPI templates ready")

    # =========================================================================
    # STEP 5: Agent 5 - Root-Cause Diagnostics
    # =========================================================================
    state = root_cause_agent(state)
    assert state.get("status") == "visualizing"
    assert state.get("current_agent") == "data_visualizer"
    rc = state.get("root_cause")
    assert rc is not None
    assert len(rc["drivers"]) > 0
    print(f"[PASS] Agent 5 (Diagnostics): Primary driver '{rc['drivers'][0]['feature']}' ({rc['drivers'][0]['importance_score']}%)")

    # =========================================================================
    # STEP 6: Agent 6 - Data Visualizer (Matplotlib & Seaborn) [NEW]
    # =========================================================================
    state = data_visualizer_agent(state)
    assert state.get("status") == "generating_bi"
    assert state.get("current_agent") == "powerbi_architect"
    vis = state.get("visualization")
    assert vis is not None
    assert vis["total_charts"] >= 5
    assert len(vis["kpi_cards"]) >= 3
    # Check that base64 images exist and disk PNGs exist
    for ch in vis["rendered_charts"]:
        assert len(ch["image_base64"]) > 500, f"Empty base64 for {ch['chart_id']}"
        assert os.path.exists(ch["file_path"]), f"Disk file missing: {ch['file_path']}"
    print(f"[PASS] Agent 6 (Matplotlib & Seaborn Visualizer): {vis['total_charts']} publication charts rendered & saved to disk | {len(vis['kpi_cards'])} KPI cards")

    # =========================================================================
    # STEP 7: Agent 7 - Power BI Architect
    # =========================================================================
    state = powerbi_architect_agent(state)
    assert state.get("status") == "completed"
    assert state.get("current_agent") == "powerbi_architect"
    pbi = state.get("powerbi")
    assert pbi is not None
    assert len(pbi["dax_catalog"]) > 0
    assert len(pbi["star_schema"]["dimensions"]) > 0
    assert pbi["pbip_bundle_path"] is not None and os.path.exists(pbi["pbip_bundle_path"])
    print(f"[PASS] Agent 7 (Power BI Architect): {len(pbi['dax_catalog'])} DAX measures | Star Schema: {len(pbi['star_schema']['dimensions'])} dims | .PBIP bundle ready")

    print("\n======================================================================")
    print("[SUCCESS] FULL 7-AGENT SEQUENTIAL PIPELINE VERIFIED SUCCESSFULLY!")
    print("======================================================================\n")


if __name__ == "__main__":
    test_full_7_agent_pipeline()
