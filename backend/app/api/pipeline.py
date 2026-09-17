"""Multi-Agent Pipeline Orchestration API routes.

Coordinates the hidden Agent 0 (Orchestrator) and 7 specialized autonomous AI agents
in a sequential, auditable, and brief-aligned workflow:
0. Hidden Orchestrator (Agent 0) — Generates Analysis Brief
1. Data Cleaner (Agent 1)
2. Data Transformer & Feature Engineer (Agent 2)
3. Exploratory Data Analyst (Agent 3)
4. SQL Analyst & DuckDB Studio (Agent 4)
5. Root-Cause Diagnostics (Agent 5)
6. Data Visualizer - Matplotlib & Seaborn (Agent 6)
7. Power BI Architect (Agent 7)
Followed by Agent 0 (Validator) pass with targeted revision loop.
"""

from __future__ import annotations

import glob
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.agents.cleaner import data_cleaner_agent
from app.agents.diagnostic import root_cause_agent
from app.agents.eda import eda_features_agent
from app.agents.orchestrator import orchestrator_agent, validator_agent
from app.agents.powerbi import powerbi_architect_agent
from app.agents.sql_analyst import sql_analytics_agent
from app.agents.state import AgentState, PipelineStatus
from app.agents.transformer import data_transformer_agent
from app.agents.visualizer import data_visualizer_agent
from app.api.datasets import _get_paths
from app.engine.duckdb_client import DuckDBClient

logger = logging.getLogger("pipeline")

router = APIRouter(prefix="/api/pipeline", tags=["Pipeline"])

# In-memory execution session registry
_sessions: Dict[str, AgentState] = {}


def _execute_agent_by_name(
    agent_name: str,
    state: AgentState,
    brief: Dict[str, Any],
    revision_note: Optional[str] = None,
) -> AgentState:
    """Dispatches execution to a specific agent with brief and optional revision directive."""
    if agent_name == "data_cleaner":
        return data_cleaner_agent(state, brief=brief, revision_note=revision_note)
    elif agent_name == "data_transformer":
        return data_transformer_agent(state, brief=brief, revision_note=revision_note)
    elif agent_name == "eda_features":
        return eda_features_agent(state, brief=brief, revision_note=revision_note)
    elif agent_name == "sql_analytics":
        return sql_analytics_agent(state, brief=brief, revision_note=revision_note)
    elif agent_name == "root_cause_engine":
        return root_cause_agent(state, brief=brief, revision_note=revision_note)
    elif agent_name == "data_visualizer":
        return data_visualizer_agent(state, brief=brief, revision_note=revision_note)
    elif agent_name == "powerbi_architect":
        return powerbi_architect_agent(state, brief=brief, revision_note=revision_note)
    logger.warning(f"[Pipeline] Unknown agent requested for revision: {agent_name}")
    return state


def _execute_pipeline_steps(session_id: str, initial_state: AgentState):
    """Executes Step 0 (Orchestrator), the 7 agents, and the end-of-pipeline validation loop."""
    state = initial_state
    try:
        # Step 0: Hidden Agent 0 - Orchestrator (Invisibly generates Analysis Brief)
        logger.info(f"[Pipeline] Starting Step 0: Orchestrator for session {session_id}")
        state = orchestrator_agent(state)
        _sessions[session_id] = state
        if state.get("status") == "failed":
            logger.error(f"[Pipeline] Orchestrator Step 0 failed: {state.get('error')}")
            return
        brief = state.get("analysis_brief", {})

        # Step 1: Agent 1 - Data Cleaner
        state = data_cleaner_agent(state, brief=brief)
        _sessions[session_id] = state
        if state.get("status") == "failed":
            return

        # Step 2: Agent 2 - Data Transformer & Features
        state = data_transformer_agent(state, brief=brief)
        _sessions[session_id] = state
        if state.get("status") == "failed":
            return

        # Step 3: Agent 3 - EDA & Statistical Analysis
        state = eda_features_agent(state, brief=brief)
        _sessions[session_id] = state
        if state.get("status") == "failed":
            return

        # Step 4: Agent 4 - SQL Analysis & Query Studio
        state = sql_analytics_agent(state, brief=brief)
        _sessions[session_id] = state
        if state.get("status") == "failed":
            return

        # Step 5: Agent 5 - Root-Cause Diagnostics
        state = root_cause_agent(state, brief=brief)
        _sessions[session_id] = state
        if state.get("status") == "failed":
            return

        # Step 6: Agent 6 - Data Visualizer (Matplotlib & Seaborn)
        state = data_visualizer_agent(state, brief=brief)
        _sessions[session_id] = state
        if state.get("status") == "failed":
            return

        # Step 7: Agent 7 - Power BI Architect
        state = powerbi_architect_agent(state, brief=brief)
        _sessions[session_id] = state
        if state.get("status") == "failed":
            return

        # Step 8: Hidden Validator Pass (Review against brief success criteria)
        max_retries = 2
        for attempt in range(max_retries):
            state, verdict = validator_agent(state)
            _sessions[session_id] = state
            if verdict.passed:
                logger.info(f"[Pipeline] Session {session_id} passed validation on attempt {attempt + 1}")
                break

            if not verdict.revise_agent:
                logger.info(f"[Pipeline] Validation reported no specific agent to revise; concluding.")
                break

            logger.info(
                f"[Pipeline] Validator flagged revision on '{verdict.revise_agent}' "
                f"(Attempt {attempt + 1}/{max_retries}): {verdict.revision_note}"
            )
            state = _execute_agent_by_name(
                verdict.revise_agent,
                state,
                brief=brief,
                revision_note=verdict.revision_note,
            )
            _sessions[session_id] = state
            if state.get("status") == "failed":
                return

        if state.get("status") != "failed":
            state["status"] = "completed"
        _sessions[session_id] = state

    except Exception as exc:
        logger.error(f"[Pipeline] Execution crashed in session {session_id}: {exc}", exc_info=True)
        state["status"] = "failed"
        state["error"] = str(exc)
        _sessions[session_id] = state


class RunPipelineRequest(BaseModel):
    dataset_id: str
    business_prompt: str = Field(
        ...,
        description="Mandatory business problem statement or analytical question to solve.",
    )
    target_metric: str = Field(
        default="",
        description="Optional focal KPI (e.g., 'gross_revenue', 'total_sales', 'churn_rate').",
    )

    @field_validator("business_prompt")
    @classmethod
    def validate_problem_statement(cls, v: str) -> str:
        clean = (v or "").strip()
        if not clean:
            raise ValueError("A problem statement is required before running the pipeline.")
        words = [w for w in clean.split() if w]
        if len(clean) < 10 or len(words) < 3:
            raise ValueError(
                "Please provide a proper problem statement (at least 10 characters and 3 words, e.g. 'Predict population after 20 years')."
            )
        return clean


@router.post("/run", tags=["Pipeline"])
async def run_pipeline(payload: RunPipelineRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """Triggers the sequential agent execution pipeline in background to prevent HTTP timeouts."""
    clean_prompt = (payload.business_prompt or "").strip()
    words = [w for w in clean_prompt.split() if w]
    if not clean_prompt or len(clean_prompt) < 10 or len(words) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A proper problem statement is required before running the pipeline (minimum 10 characters and 3 words).",
        )
    paths = _get_paths()
    dataset_id = payload.dataset_id

    # Resolve raw file
    if dataset_id == "sample_business_sales":
        raw_file = os.path.join(paths["raw"], "sample_business_sales.csv")
    else:
        matches = glob.glob(os.path.join(paths["raw"], f"{dataset_id}_*"))
        if not matches:
            matches = glob.glob(os.path.join(paths["raw"], f"*{dataset_id}*"))
        if not matches:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dataset '{dataset_id}' not found.",
            )
        raw_file = matches[0]

    duck = DuckDBClient()
    try:
        metadata = duck.inspect_file(raw_file, dataset_id)
    finally:
        duck.close()

    session_id = f"sess_{int(datetime.now(timezone.utc).timestamp())}"

    # Initial state
    state: AgentState = {
        "session_id": session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "cleaning",
        "current_agent": "data_cleaner",
        "business_prompt": payload.business_prompt,
        "target_metric": payload.target_metric,
        "dataset": metadata.model_dump(),
        "step_history": [],
        "retry_count": 0,
    }
    _sessions[session_id] = state

    # Dispatch to background task for instantaneous HTTP response
    background_tasks.add_task(_execute_pipeline_steps, session_id, state)

    return state


@router.get("/status/{session_id}", tags=["Pipeline"])
async def get_pipeline_session(session_id: str) -> Dict[str, Any]:
    """Fetches stored state for a pipeline session."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found.",
        )
    return session
