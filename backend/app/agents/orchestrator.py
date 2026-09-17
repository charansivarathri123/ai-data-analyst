"""Agent 0: Hidden Orchestrator Agent.

Runs invisibly before the 7-agent pipeline. Ingests business problem statement and dataset profile,
grounds problem in actual columns, and synthesizes a structured Analysis Brief JSON that every
downstream agent must follow. Also provides the end-of-pipeline validator pass.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional, Tuple

from app.agents.state import AgentState, AnalysisBrief, ValidationVerdict
from app.engine.orchestrator_engine import (
    orchestrate_analysis,
    profile_dataset_for_orchestrator,
    validate_pipeline_output,
)

logger = logging.getLogger("orchestrator")


def orchestrator_agent(state: AgentState) -> AgentState:
    """Hidden Agent 0 node: generates Analysis Brief before Step 1 (Data Cleaner).

    Crucial design requirement: Agent 0 outputs state only. It never emits user-facing
    chat messages or step logs into step_history.
    """
    dataset_info = state.get("dataset")
    if not dataset_info or "file_path" not in dataset_info:
        logger.error("[Orchestrator] Ingestion error: No dataset file_path present in state.")
        return state

    raw_path = dataset_info["file_path"]
    business_prompt = state.get("business_prompt", "") or ""
    target_metric_hint = state.get("target_metric")

    try:
        logger.info(f"[Orchestrator] Profiling dataset: {os.path.basename(raw_path)}")
        profile = profile_dataset_for_orchestrator(raw_path, sample_rows_count=20)

        logger.info(f"[Orchestrator] Synthesizing Analysis Brief for prompt: '{business_prompt[:80]}...'")
        brief = orchestrate_analysis(
            business_prompt=business_prompt,
            dataset_profile=profile,
            target_metric_hint=target_metric_hint,
        )

        logger.info(
            f"[Orchestrator] Brief generated successfully:\n"
            f"  - Problem Type: {brief.problem_type}\n"
            f"  - Target Metric: {brief.target_metric}\n"
            f"  - Key Dimensions: {brief.key_dimensions}\n"
            f"  - Columns In Scope: {brief.columns_in_scope}\n"
            f"  - Success Criteria: {brief.success_criteria}"
        )

        brief_dict = brief.model_dump()

        # Update state with brief and grounded target_metric
        # Keep status as 'cleaning' and current_agent as 'data_cleaner' so the visible UI starts directly at Step 1
        return {
            **state,
            "target_metric": brief.target_metric,
            "analysis_brief": brief_dict,
            "validation_attempts": 0,
            "status": "cleaning",
            "current_agent": "data_cleaner",
        }

    except Exception as exc:
        logger.error(f"[Orchestrator] Failed during analysis orchestration: {exc}", exc_info=True)
        # Never break pipeline if orchestrator fails; continue gracefully with fallback
        return state


def validator_agent(state: AgentState) -> Tuple[AgentState, ValidationVerdict]:
    """Hidden end-of-pipeline validation pass reviewing outputs against brief success criteria."""
    brief_data = state.get("analysis_brief")
    if not brief_data:
        logger.warning("[Validator] No analysis_brief in state; skipping validation check.")
        verdict = ValidationVerdict(passed=True)
        return state, verdict

    brief = AnalysisBrief(**brief_data)
    verdict = validate_pipeline_output(brief=brief, pipeline_outputs=state)

    logger.info(
        f"[Validator] Output Validation Verdict: passed={verdict.passed}, "
        f"revise_agent={verdict.revise_agent}, note={verdict.revision_note}"
    )

    current_attempts = state.get("validation_attempts", 0) + 1
    updated_state: AgentState = {
        **state,
        "validation_verdict": verdict.model_dump(),
        "validation_attempts": current_attempts,
    }

    return updated_state, verdict
