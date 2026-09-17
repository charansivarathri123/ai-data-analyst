"""Agent 5: Root-Cause & Diagnostics Engine Agent.

Responsible for feature importance driver isolation, cohort comparison analysis,
and executive insight narrative generation.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.agents.state import AgentState, AgentStepLog
from app.engine.diagnostic_engine import DiagnosticEngine

logger = logging.getLogger("diagnostic")

ROOT_CAUSE_SYSTEM_PROMPT = """You are a senior analyst specializing in driver analysis and causal reasoning under uncertainty. You are allergic to correlation-as-causation claims and you always quantify impact, not just direction.

Brief context: {brief}

Standards you always apply:
- Structure every diagnostic around "target_metric" — decompose its movement across "key_dimensions" from the brief (e.g. how much of the margin change is category mix vs. per-category rate change).
- Quantify each driver's contribution (e.g. "category X explains 4.2 points of the 7-point margin decline") — never just rank drivers qualitatively.
- Explicitly separate correlation from causal claims; where you can't establish causality, say so and describe what additional data/test would be needed.
- Check for confounders and Simpson's-paradox-style traps before attributing a cause (e.g. mix-shift effects hiding inside an aggregate trend).
- Directly answer "success_criteria" from the brief — if it requires naming specific segments and quantifying impact, your output must do exactly that, not a generic trend summary.

Never: present a ranked list of "top drivers" without a number attached to each, or claim causation from a single cross-sectional cut.

Output: a driver attribution table (driver, quantified impact, confidence) + a plain-language root-cause narrative that satisfies "success_criteria".
"""


def root_cause_agent(
    state: AgentState,
    brief: Optional[Dict[str, Any]] = None,
    revision_note: Optional[str] = None,
) -> AgentState:
    """LangGraph node executing root-cause driver attribution and narrative generation."""
    step_history = list(state.get("step_history", []))
    effective_brief = brief or state.get("analysis_brief")

    brief_json = json.dumps(effective_brief, indent=2) if effective_brief else "None provided"
    agent_prompt = ROOT_CAUSE_SYSTEM_PROMPT.format(brief=brief_json)
    if revision_note:
        agent_prompt += f"\n\n[REVISION DIRECTIVE]: {revision_note}"
        logger.info(f"[RootCause] Executing revision pass: {revision_note}")

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
    target_metric = (effective_brief.get("target_metric") if effective_brief else None) or state.get("target_metric")
    business_prompt = state.get("business_prompt")

    # Step log: Start Diagnosis
    detail_txt = f"Investigating target metric: '{target_metric or 'auto-resolved'}' with prompt context."
    if effective_brief and effective_brief.get("success_criteria"):
        detail_txt += f" Aligning drivers to success criteria: {effective_brief.get('success_criteria')[:60]}..."
    if revision_note:
        detail_txt += f" Addressing validator note: {revision_note}"

    step_history.append(
        AgentStepLog(
            agent="root_cause_engine",
            timestamp=datetime.now(timezone.utc).isoformat(),
            phase="attribution",
            summary="Isolating statistical drivers and fitting feature importance tree",
            detail=detail_txt,
            level="info",
        ).model_dump()
    )

    try:
        engine = DiagnosticEngine(clean_file_path=clean_path)
        output = engine.diagnose(
            target_metric=target_metric,
            business_prompt=business_prompt,
            brief=effective_brief,
        )

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
                detail="Synthesized executive narrative with quantified driver impacts and actionable recommendations.",
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
