"""Agent 1: Data Wrangling & Quality Agent.

Responsible for inspecting schema anomalies, imputing missing data,
sanitizing types, eliminating duplicates, profiling distributions, and producing an auditable quality scorecard.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.agents.state import AgentState, AgentStepLog
from app.engine.cleaner_engine import DataCleanerEngine

logger = logging.getLogger("cleaner")

DATA_WRANGLING_SYSTEM_PROMPT = """You are a senior data engineer with 10+ years cleaning production datasets for analytics teams. You are meticulous, skeptical of "looks fine" data, and you never silently drop or alter data without logging what you did and why.

Brief context: {brief}

Standards you always apply:
- Cast every column to its correct type explicitly; never leave numerics as strings or dates as text.
- For missing values: never impute blindly. Check missingness pattern (random vs. structural) before choosing mean/median/mode/forward-fill/drop, and state which you chose and why.
- Deduplicate on a defensible key, not just exact row match — check for near-duplicates (same entity, different timestamp/casing).
- Flag outright data quality issues (negative revenue, future dates, impossible values) rather than silently correcting them — surface them for the user.
- Produce a data quality score/report: % missing per column, # duplicates removed, # type coercions, # flagged anomalies.

Prioritize columns listed in "columns_in_scope" from the brief — clean those to a higher bar than out-of-scope columns.

Never: fabricate values to fill gaps, drop >5% of rows without flagging it loudly, or treat every problem the same way (one imputation strategy for the whole dataset).

Output: cleaned dataset + a structured quality report downstream agents and the user can both read.
"""


def data_cleaner_agent(
    state: AgentState,
    brief: Optional[Dict[str, Any]] = None,
    revision_note: Optional[str] = None,
) -> AgentState:
    """LangGraph node executing data cleaning, profiling, and quality validation."""
    step_history = list(state.get("step_history", []))
    effective_brief = brief or state.get("analysis_brief")

    # Format brief into prompt for reference / logging
    brief_json = json.dumps(effective_brief, indent=2) if effective_brief else "None provided"
    agent_prompt = DATA_WRANGLING_SYSTEM_PROMPT.format(brief=brief_json)
    if revision_note:
        agent_prompt += f"\n\n[REVISION DIRECTIVE]: {revision_note}"
        logger.info(f"[DataCleaner] Executing revision pass: {revision_note}")

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
    cols_in_scope = effective_brief.get("columns_in_scope", []) if effective_brief else []

    # Step log: Start cleaning
    detail_txt = "Validating headers, null distributions, and initial data types using DuckDB and Polars."
    if cols_in_scope:
        detail_txt += f" Prioritizing in-scope columns: {', '.join(cols_in_scope[:4])}."
    if revision_note:
        detail_txt += f" Addressing validator feedback: {revision_note}"

    step_history.append(
        AgentStepLog(
            agent="data_cleaner",
            timestamp=datetime.now(timezone.utc).isoformat(),
            phase="inspection",
            summary=f"Inspecting raw dataset: {os.path.basename(raw_path)}",
            detail=detail_txt,
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

        cleaner = DataCleanerEngine(
            raw_file_path=raw_path,
            output_dir=cleaned_dir,
            columns_in_scope=cols_in_scope,
        )
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
