"""Multi-Agent Pipeline Orchestration API routes.

Coordinates 7 specialized autonomous AI agents in a sequential, auditable workflow:
1. Data Cleaner (Agent 1)
2. Data Transformer & Feature Engineer (Agent 2)
3. Exploratory Data Analyst (Agent 3)
4. SQL Analyst & DuckDB Studio (Agent 4)
5. Root-Cause Diagnostics (Agent 5)
6. Data Visualizer - Matplotlib & Seaborn (Agent 6)
7. Power BI Architect (Agent 7)
"""

from __future__ import annotations

import os
import glob
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.agents.cleaner import data_cleaner_agent
from app.agents.transformer import data_transformer_agent
from app.agents.eda import eda_features_agent
from app.agents.sql_analyst import sql_analytics_agent
from app.agents.diagnostic import root_cause_agent
from app.agents.visualizer import data_visualizer_agent
from app.agents.powerbi import powerbi_architect_agent
from app.agents.state import AgentState, PipelineStatus
from app.api.datasets import _get_paths
from app.engine.duckdb_client import DuckDBClient

router = APIRouter(prefix="/api/pipeline", tags=["Pipeline"])

# In-memory execution session registry
_sessions: Dict[str, AgentState] = {}


class RunPipelineRequest(BaseModel):
    dataset_id: str
    business_prompt: str = Field(
        default="",
        description="Optional business hypothesis or problem statement for the agents to investigate.",
    )
    target_metric: str = Field(
        default="",
        description="Optional focal KPI (e.g., 'gross_revenue', 'total_sales', 'churn_rate').",
    )


@router.post("/run", tags=["Pipeline"])
async def run_pipeline(payload: RunPipelineRequest) -> Dict[str, Any]:
    """Triggers the sequential 7-agent execution pipeline."""
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

    # Step 1: Agent 1 - Data Cleaner
    state = data_cleaner_agent(state)
    if state.get("status") == "failed":
        _sessions[session_id] = state
        return state

    # Step 2: Agent 2 - Data Transformer & Features [NEW]
    state = data_transformer_agent(state)
    if state.get("status") == "failed":
        _sessions[session_id] = state
        return state

    # Step 3: Agent 3 - EDA & Statistical Analysis
    state = eda_features_agent(state)
    if state.get("status") == "failed":
        _sessions[session_id] = state
        return state

    # Step 4: Agent 4 - SQL Analysis & Query Studio [NEW]
    state = sql_analytics_agent(state)
    if state.get("status") == "failed":
        _sessions[session_id] = state
        return state

    # Step 5: Agent 5 - Root-Cause Diagnostics
    state = root_cause_agent(state)
    if state.get("status") == "failed":
        _sessions[session_id] = state
        return state

    # Step 6: Agent 6 - Data Visualizer (Matplotlib & Seaborn) [NEW]
    state = data_visualizer_agent(state)
    if state.get("status") == "failed":
        _sessions[session_id] = state
        return state

    # Step 7: Agent 7 - Power BI Architect
    state = powerbi_architect_agent(state)
    if state.get("status") == "failed":
        _sessions[session_id] = state
        return state

    state["status"] = "completed"
    _sessions[session_id] = state

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
