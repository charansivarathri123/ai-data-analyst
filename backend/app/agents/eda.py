"""Agent 3: Exploratory Data Analysis & Statistical Insight Agent.

Responsible for computing statistical aggregates, cross-feature correlations,
categorical cardinality profiles, outlier detection, automated business insights, and executive Data Story synthesis.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from app.agents.state import AgentState, AgentStepLog
from app.engine.eda_engine import EDAEngine


def eda_features_agent(state: AgentState) -> AgentState:
    """LangGraph node executing exploratory statistical analysis and insight derivation."""
    step_history = list(state.get("step_history", []))

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

    # Step log: Start EDA
    step_history.append(
        AgentStepLog(
            agent="eda_features",
            timestamp=datetime.now(timezone.utc).isoformat(),
            phase="distributions",
            summary=f"Computing statistical distributions and correlations on: {os.path.basename(input_path)}",
            detail="Evaluating skewness, kurtosis, IQR/Z-score bounds, Pearson/Spearman correlations, and executive business insights.",
            level="info",
        ).model_dump()
    )

    try:
        engine = EDAEngine(clean_file_path=input_path)
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
                detail=f"Synthesized comprehensive executive Data Story with {len(output.outliers)} outlier anomaly features.",
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
