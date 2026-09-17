"""Agent 3: Exploratory Data Analysis & Statistical Insight Agent.

Responsible for computing statistical aggregates, cross-feature correlations,
categorical cardinality profiles, outlier detection, automated business insights, and executive Data Story synthesis.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.agents.state import AgentState, AgentStepLog
from app.engine.eda_engine import EDAEngine

logger = logging.getLogger("eda")

EDA_SYSTEM_PROMPT = """You are a senior data analyst known for EDA that finds the story in the data, not just a wall of charts. You are rigorous about statistical validity and you always connect findings back to the business question.

Brief context: {brief}

Standards you always apply:
- Lead with "target_metric" and "key_dimensions" from the brief — profile those first, not whatever column is most convenient.
- For every distribution/correlation you report, note sample size and whether the pattern is likely real or noise (e.g. flag correlations from <30 data points).
- Actively look for what would satisfy "required_analyses" in the brief (e.g. if it lists "cohort_comparison", produce that comparison explicitly, don't just show an overall histogram).
- State 3-5 concrete findings in plain business language, each tied to a specific number, not "there seems to be some variation."
- Call out anomalies/outliers that could distort the diagnostics or visualization agents downstream.

Never: report a distribution/correlation with no connection to the brief, or bury the one insight that matters under ten generic ones.

Output: a short prioritized findings list (business language) + the supporting stats/charts, explicitly labeled against which "required_analyses" item they satisfy.
"""


def eda_features_agent(
    state: AgentState,
    brief: Optional[Dict[str, Any]] = None,
    revision_note: Optional[str] = None,
) -> AgentState:
    """LangGraph node executing exploratory statistical analysis and insight derivation."""
    step_history = list(state.get("step_history", []))
    effective_brief = brief or state.get("analysis_brief")

    brief_json = json.dumps(effective_brief, indent=2) if effective_brief else "None provided"
    agent_prompt = EDA_SYSTEM_PROMPT.format(brief=brief_json)
    if revision_note:
        agent_prompt += f"\n\n[REVISION DIRECTIVE]: {revision_note}"
        logger.info(f"[EDA] Executing revision pass: {revision_note}")

    # Retrieve dataset path from state (prioritize transformed dataset, fallback to cleaned)
    transform_info = state.get("transformation")
    cleaning_info = state.get("cleaning")

    if transform_info and "transformed_file_path" in transform_info:
        input_path = transform_info["transformed_file_path"]
    elif cleaning_info and "cleaned_file_path" in cleaning_info:
        input_path = cleaning_info["cleaned_file_path"]
    else:
        error_msg = "No transformed_file_path or cleaned_file_path found in AgentState. Upstream agents must run first."
        step_history.append(
            AgentStepLog(
                agent="eda_features",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="initialization",
                summary="Failed to initialize EDA agent",
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

    target_metric = effective_brief.get("target_metric") if effective_brief else None
    key_dims = effective_brief.get("key_dimensions", []) if effective_brief else []

    # Step log: Start EDA
    detail_txt = "Evaluating skewness, kurtosis, IQR/Z-score bounds, and Pearson/Spearman correlations."
    if target_metric:
        detail_txt += f" Grounding distributions around '{target_metric}' across {', '.join(key_dims[:3])}."
    if revision_note:
        detail_txt += f" Incorporating validator revision: {revision_note}"

    step_history.append(
        AgentStepLog(
            agent="eda_features",
            timestamp=datetime.now(timezone.utc).isoformat(),
            phase="distributions",
            summary=f"Computing statistical distributions and correlations on: {os.path.basename(input_path)}",
            detail=detail_txt,
            level="info",
        ).model_dump()
    )

    try:
        engine = EDAEngine(clean_file_path=input_path, brief=effective_brief)
        enriched_df, output = engine.analyze()

        summary_txt = (
            f"EDA completed. Analyzed {len(output.numeric_summaries)} numeric distributions, "
            f"{len(output.categorical_summaries)} categorical dimensions, and computed {len(output.correlations)} correlations. "
            f"Detected {len(output.insights)} automated business insights."
        )

        step_history.append(
            AgentStepLog(
                agent="eda_features",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="completion",
                summary=summary_txt,
                detail=f"Synthesized comprehensive executive Data Story tied to brief requirements with {len(output.outliers)} outlier features.",
                level="success",
            ).model_dump()
        )

        # Transition to next agent: Agent 4 (sql_analytics)
        return {
            **state,
            "status": "querying_sql",
            "current_agent": "sql_analytics",
            "eda": output.model_dump(),
            "step_history": step_history,
        }

    except Exception as e:
        error_msg = f"EDAFeaturesAgent error: {str(e)}"
        step_history.append(
            AgentStepLog(
                agent="eda_features",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="execution",
                summary="EDA calculation failed",
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
