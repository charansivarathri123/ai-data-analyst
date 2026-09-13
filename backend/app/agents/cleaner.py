"""Agent 1: Data Wrangling & Quality Agent.

Responsible for inspecting schema anomalies, imputing missing data,
sanitizing types, eliminating duplicates, profiling distributions, and producing an auditable quality scorecard.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict

from app.agents.state import AgentState, AgentStepLog
from app.engine.cleaner_engine import DataCleanerEngine


def data_cleaner_agent(state: AgentState) -> AgentState:
    """LangGraph node executing data cleaning, profiling, and quality validation."""
    step_history = list(state.get("step_history", []))

    # Retrieve dataset path from state
    dataset_info = state.get("dataset")
    if not dataset_info or "file_path" not in dataset_info:
        error_msg = "No dataset file_path present in AgentState."
        step_history.append(
            AgentStepLog(
                agent="data_cleaner",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="initialization",
                summary="Failed to initialize cleaner",
                detail=error_msg,
                level="error",
            ).model_dump()
        )
        return {
            **state,
            "status": "failed",
            "error": error_msg,
            "step_history": step_history,
        }

    raw_path = dataset_info["file_path"]

    # Step log: Start cleaning
    step_history.append(
        AgentStepLog(
            agent="data_cleaner",
            timestamp=datetime.now(timezone.utc).isoformat(),
            phase="inspection",
            summary=f"Inspecting raw dataset: {os.path.basename(raw_path)}",
            detail="Validating headers, null distributions, and initial data types using DuckDB and Polars.",
            level="info",
        ).model_dump()
    )

    try:
        # Determine output directory
        base_dir = os.path.dirname(os.path.abspath(raw_path))
        if os.path.basename(base_dir) == "raw":
            cleaned_dir = os.path.join(os.path.dirname(base_dir), "cleaned")
        else:
            cleaned_dir = os.path.join(base_dir, "cleaned")

        cleaner = DataCleanerEngine(raw_file_path=raw_path, output_dir=cleaned_dir)
        clean_df, output = cleaner.clean()

        # Step log: Completed cleaning
        summary_txt = (
            f"Cleaning completed. Quality Score: {output.scorecard.overall_score}/100. "
            f"Imputed {output.scorecard.total_nulls_imputed} nulls, cleaned {output.scorecard.total_rows_cleaned} rows, "
            f"profiled {len(output.profiling)} columns."
        )
        step_history.append(
            AgentStepLog(
                agent="data_cleaner",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="completion",
                summary=summary_txt,
                detail=f"Applied {len(output.audit_trail)} audit remediation rules. Generated {len(output.recommendations)} smart recommendations.",
                level="success",
            ).model_dump()
        )

        # Transition to next agent: Agent 2 (data_transformer)
        return {
            **state,
            "status": "transforming",
            "current_agent": "data_transformer",
            "cleaning": output.model_dump(),
            "step_history": step_history,
        }

    except Exception as e:
        error_msg = f"DataCleanerAgent encountered an error: {str(e)}"
        step_history.append(
            AgentStepLog(
                agent="data_cleaner",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="execution",
                summary="Cleaning pipeline failed",
                detail=error_msg,
                level="error",
            ).model_dump()
        )
        return {
            **state,
            "status": "failed",
            "error": error_msg,
            "step_history": step_history,
        }
