"""Agent 7: Power BI Architect Agent.

Responsible for constructing Star Schema layouts, authoring syntactically valid
DAX formula catalogs, and emitting production-ready .pbip and TMDL project bundles.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.agents.state import AgentState, AgentStepLog
from app.api.datasets import _get_paths
from app.engine.powerbi_engine import PowerBIEngine

logger = logging.getLogger("powerbi")

POWERBI_SYSTEM_PROMPT = """You are a senior BI architect who designs star schemas and DAX the way Microsoft's own best-practice guides recommend — normalized fact/dimension tables, verified measures, no ad-hoc flat tables masquerading as a model.

Brief context: {brief}

Standards you always apply:
- Design the star schema around "target_metric" (fact table grain) and "key_dimensions" (dimension tables) from the brief — don't just dump the flat dataset into one table.
- Every DAX measure must be verified against a manual calculation on a sample before being finalized — state the check you ran.
- Use explicit measures (not implicit column aggregations) for anything the report will filter/slice, so totals stay correct across all dimension combinations.
- Name tables and measures in business language matching the brief ("Gross Margin %", "Revenue by Category"), not technical column names.
- Confirm the model answers "success_criteria" from the brief — if it requires drill-down by category and quarter, the model must support that slice without a workaround.

Never: ship a single flat table as the "model," or a measure you haven't sanity-checked against a manual total.

Output: star schema definition (tables + relationships), verified DAX measures with the check shown, and the downloadable .pbip package.
"""


def powerbi_architect_agent(
    state: AgentState,
    brief: Optional[Dict[str, Any]] = None,
    revision_note: Optional[str] = None,
) -> AgentState:
    """LangGraph node executing Power BI semantic modeling, DAX generation, and PBIP bundling."""
    step_history = list(state.get("step_history", []))
    effective_brief = brief or state.get("analysis_brief")

    brief_json = json.dumps(effective_brief, indent=2) if effective_brief else "None provided"
    agent_prompt = POWERBI_SYSTEM_PROMPT.format(brief=brief_json)
    if revision_note:
        agent_prompt += f"\n\n[REVISION DIRECTIVE]: {revision_note}"
        logger.info(f"[PowerBI] Executing revision pass: {revision_note}")

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
    target_metric = (effective_brief.get("target_metric") if effective_brief else None) or state.get("target_metric", "gross_revenue")

    # Extract top drivers if available
    top_drivers = []
    root_cause = state.get("root_cause")
    if root_cause and "drivers" in root_cause:
        top_drivers = [d["feature"] for d in root_cause["drivers"][:3]]

    # Step log: Start Power BI generation
    detail_txt = "Separating facts and dimensions, authoring Time Intelligence, and compiling TMDL files."
    if effective_brief:
        detail_txt += f" Grounding model grain in '{target_metric}' and dimensions {effective_brief.get('key_dimensions', [])[:2]}."
    if revision_note:
        detail_txt += f" Incorporating revision directive: {revision_note}"

    step_history.append(
        AgentStepLog(
            agent="powerbi_architect",
            timestamp=datetime.now(timezone.utc).isoformat(),
            phase="modeling",
            summary=f"Constructing Star Schema and DAX measure catalog for '{target_metric}'",
            detail=detail_txt,
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
            brief=effective_brief,
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
