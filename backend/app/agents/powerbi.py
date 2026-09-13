"""Agent 4: Power BI Architect Agent.

Responsible for constructing Star Schema layouts, authoring syntactically valid
DAX formula catalogs, and emitting production-ready .pbip and TMDL project bundles.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from app.agents.state import AgentState, AgentStepLog
from app.api.datasets import _get_paths
from app.engine.powerbi_engine import PowerBIEngine


def powerbi_architect_agent(state: AgentState) -> AgentState:
    """LangGraph node executing Power BI semantic modeling, DAX generation, and PBIP bundling."""
    step_history = list(state.get("step_history", []))

    # Retrieve cleaned dataset path
    cleaning_info = state.get("cleaning")
    if not cleaning_info or "cleaned_file_path" not in cleaning_info:
        error_msg = "No cleaned_file_path found in AgentState. Data Cleaner must run before Power BI stage."
        step_history.append(
            AgentStepLog(
                agent="powerbi_architect",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="initialization",
                summary="Failed to initialize Power BI agent",
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
    dataset_info = state.get("dataset", {})
    dataset_id = dataset_info.get("dataset_id", "dataset_default")
    target_metric = state.get("target_metric", "gross_revenue")

    # Extract top drivers if available
    top_drivers = []
    root_cause = state.get("root_cause")
    if root_cause and "drivers" in root_cause:
        top_drivers = [d["feature"] for d in root_cause["drivers"][:3]]

    # Step log: Start Power BI generation
    step_history.append(
        AgentStepLog(
            agent="powerbi_architect",
            timestamp=datetime.now(timezone.utc).isoformat(),
            phase="modeling",
            summary=f"Constructing Star Schema and DAX measure catalog for '{target_metric}'",
            detail="Separating facts and dimensions, authoring Time Intelligence, and compiling TMDL files.",
            level="info",
        ).model_dump()
    )

    try:
        paths = _get_paths()
        engine = PowerBIEngine(clean_file_path=clean_path, export_dir=paths["exports"])
        deliverables = engine.build_deliverables(
            dataset_id=dataset_id,
            target_metric=target_metric,
            top_drivers=top_drivers,
        )

        summary_txt = (
            f"Power BI artifacts generated: Star Schema with {len(deliverables.star_schema.dimensions)} dimensions, "
            f"{len(deliverables.dax_catalog)} verified DAX measures, and downloadable .pbip bundle."
        )

        step_history.append(
            AgentStepLog(
                agent="powerbi_architect",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="completion",
                summary=summary_txt,
                detail=f"Packaged Power BI project bundle at: {os.path.basename(deliverables.pbip_bundle_path or '')}",
                level="success",
            ).model_dump()
        )

        return {
            **state,
            "status": "completed",
            "current_agent": "powerbi_architect",
            "powerbi": deliverables.model_dump(),
            "step_history": step_history,
        }

    except Exception as e:
        error_msg = f"PowerBIArchitectAgent error: {str(e)}"
        step_history.append(
            AgentStepLog(
                agent="powerbi_architect",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="execution",
                summary="Power BI generation failed",
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
