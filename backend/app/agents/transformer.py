"""Agent 2: Data Transformation & Feature Engineering Agent.

Responsible for numerical scaling, mathematical transforms, binning, categorical encodings,
temporal calendar derivation, calculated business metrics, and window feature generation.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.agents.state import AgentState, AgentStepLog
from app.engine.transformer_engine import DataTransformationEngine

logger = logging.getLogger("transformer")

FEATURE_ENGINEERING_SYSTEM_PROMPT = """You are a senior ML/analytics engineer who has built feature pipelines for real BI and modeling systems. You engineer only features that serve the stated business question — you do not generate features for their own sake.

Brief context: {brief}

Standards you always apply:
- Every feature you create must trace back to "target_metric", "key_dimensions", or "required_analyses" in the brief. If you can't explain in one sentence how a feature helps answer the business question, don't create it.
- Use calendar extraction (quarter, week-of-year, is_weekend) only when the brief's problem_type involves time (trend_analysis, seasonality, cohort work).
- Choose scaling/encoding based on what the downstream analysis actually needs (e.g. don't one-hot encode a high-cardinality column that's headed into a correlation matrix).
- Watch for leakage: never build a feature that uses information that wouldn't be available at the point of the decision being analyzed.
- Document every feature: name, formula/logic, and which brief requirement it serves.

Never: engineer generic "kitchen sink" features unrelated to "columns_in_scope", or silently transform the target metric itself.

Output: engineered feature set + a feature dictionary mapping each new column to the business question it supports.
"""


def data_transformer_agent(
    state: AgentState,
    brief: Optional[Dict[str, Any]] = None,
    revision_note: Optional[str] = None,
) -> AgentState:
    """LangGraph node executing feature engineering and data transformations."""
    step_history = list(state.get("step_history", []))
    effective_brief = brief or state.get("analysis_brief")

    brief_json = json.dumps(effective_brief, indent=2) if effective_brief else "None provided"
    agent_prompt = FEATURE_ENGINEERING_SYSTEM_PROMPT.format(brief=brief_json)
    if revision_note:
        agent_prompt += f"\n\n[REVISION DIRECTIVE]: {revision_note}"
        logger.info(f"[FeatureEngineer] Executing revision pass: {revision_note}")

    # Retrieve cleaned dataset path from state
    cleaning_info = state.get("cleaning")
    if not cleaning_info or "cleaned_file_path" not in cleaning_info:
        error_msg = "No cleaned_file_path found in AgentState. Agent 1 (data_cleaner) must run first."
        step_history.append(
            AgentStepLog(
                agent="data_transformer",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="initialization",
                summary="Failed to initialize transformer agent",
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

    clean_path = cleaning_info["cleaned_file_path"]
    target_metric = effective_brief.get("target_metric") if effective_brief else None

    # Step log: Start Transformation
    detail_txt = "Generating numerical scaling, semantic binning, categorical encodings, and business KPIs."
    if target_metric:
        detail_txt += f" Anchoring features to target metric '{target_metric}' and brief constraints."
    if revision_note:
        detail_txt += f" Addressing validator note: {revision_note}"

    step_history.append(
        AgentStepLog(
            agent="data_transformer",
            timestamp=datetime.now(timezone.utc).isoformat(),
            phase="feature_engineering",
            summary=f"Executing feature engineering suite on: {os.path.basename(clean_path)}",
            detail=detail_txt,
            level="info",
        ).model_dump()
    )

    try:
        base_dir = os.path.dirname(os.path.abspath(clean_path))
        transformed_dir = os.path.join(os.path.dirname(base_dir), "transformed")
        os.makedirs(transformed_dir, exist_ok=True)

        engine = DataTransformationEngine(
            clean_file_path=clean_path,
            output_dir=transformed_dir,
            brief=effective_brief,
        )
        transformed_df, output = engine.transform()

        summary_txt = (
            f"Transformation completed. Created {output.features_created} engineered features. "
            f"Expanded dataset from {cleaning_info.get('scorecard', {}).get('total_rows_cleaned', 0)} rows to {output.total_features} total feature dimensions."
        )

        step_history.append(
            AgentStepLog(
                agent="data_transformer",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="completion",
                summary=summary_txt,
                detail=f"Engineered {len(output.feature_catalog)} cataloged features aligned with brief objectives.",
                level="success",
            ).model_dump()
        )

        # Transition to next agent: Agent 3 (eda_features)
        return {
            **state,
            "status": "analyzing",
            "current_agent": "eda_features",
            "transformation": output.model_dump(),
            "step_history": step_history,
        }

    except Exception as e:
        error_msg = f"DataTransformationAgent error: {str(e)}"
        step_history.append(
            AgentStepLog(
                agent="data_transformer",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="execution",
                summary="Transformation failed",
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
