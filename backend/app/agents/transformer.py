"""Agent 2: Data Transformation & Feature Engineering Agent.

Responsible for numerical scaling, mathematical transforms, binning, categorical encodings,
temporal calendar derivation, calculated business metrics, and window feature generation.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from app.agents.state import AgentState, AgentStepLog
from app.engine.transformer_engine import DataTransformationEngine


def data_transformer_agent(state: AgentState) -> AgentState:
    """LangGraph node executing feature engineering and data transformations."""
    step_history = list(state.get("step_history", []))

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

    # Step log: Start Transformation
    step_history.append(
        AgentStepLog(
            agent="data_transformer",
            timestamp=datetime.now(timezone.utc).isoformat(),
            phase="feature_engineering",
            summary=f"Executing feature engineering suite on: {os.path.basename(clean_path)}",
            detail="Generating numerical scaling, semantic binning, categorical encodings, calculated business KPIs, and window transforms.",
            level="info",
        ).model_dump()
    )

    try:
        base_dir = os.path.dirname(os.path.abspath(clean_path))
        transformed_dir = os.path.join(os.path.dirname(base_dir), "transformed")
        os.makedirs(transformed_dir, exist_ok=True)

        engine = DataTransformationEngine(clean_file_path=clean_path, output_dir=transformed_dir)
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
                detail=f"Engineered {len(output.feature_catalog)} cataloged features across scaling, encodings, and financial metrics.",
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
