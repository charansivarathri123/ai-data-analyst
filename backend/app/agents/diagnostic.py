"""Agent 3: Root-Cause & Diagnostics Engine Agent.

Responsible for feature importance driver isolation, cohort comparison analysis,
and executive insight narrative generation.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from app.agents.state import AgentState, AgentStepLog
from app.engine.diagnostic_engine import DiagnosticEngine


def root_cause_agent(state: AgentState) -> AgentState:
    """LangGraph node executing root-cause driver attribution and narrative generation."""
    step_history = list(state.get("step_history", []))

    # Retrieve cleaned dataset path from state
    cleaning_info = state.get("cleaning")
    if not cleaning_info or "cleaned_file_path" not in cleaning_info:
        error_msg = "No cleaned_file_path found in AgentState. Agent 1 must run first."
        step_history.append(
            AgentStepLog(
                agent="root_cause_engine",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="initialization",
                summary="Failed to initialize root-cause agent",
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
    target_metric = state.get("target_metric")
    business_prompt = state.get("business_prompt")

    # Step log: Start Diagnosis
    step_history.append(
        AgentStepLog(
            agent="root_cause_engine",
            timestamp=datetime.now(timezone.utc).isoformat(),
            phase="attribution",
            summary="Isolating statistical drivers and fitting feature importance tree",
            detail=f"Investigating target metric: '{target_metric or 'auto-resolved'}' with prompt context.",
            level="info",
        ).model_dump()
    )

    try:
        engine = DiagnosticEngine(clean_file_path=clean_path)
        output = engine.diagnose(target_metric=target_metric, business_prompt=business_prompt)

        primary_driver = output.drivers[0].feature if output.drivers else "general distribution"
        summary_txt = (
            f"Diagnostics completed for '{output.target_metric}'. "
            f"Identified '{primary_driver}' as dominant driver across {len(output.cohorts)} cohorts."
        )

        step_history.append(
            AgentStepLog(
                agent="root_cause_engine",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="completion",
                summary=summary_txt,
                detail="Synthesized executive narrative with 3 actionable recommendations.",
                level="success",
            ).model_dump()
        )

        return {
            **state,
            "status": "visualizing",
            "current_agent": "data_visualizer",
            "target_metric": output.target_metric,
            "root_cause": output.model_dump(),
            "step_history": step_history,
        }

    except Exception as e:
        error_msg = f"RootCauseAgent error: {str(e)}"
        step_history.append(
            AgentStepLog(
                agent="root_cause_engine",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="execution",
                summary="Root-cause diagnosis failed",
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
