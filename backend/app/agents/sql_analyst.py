"""Agent 4: SQL Analysis & Business Query Agent.

Responsible for registering datasets in DuckDB, providing schema exploration DDL,
enforcing read-only security, executing parameterized business KPI queries, explaining SQL in plain English,
and compiling analytical query results for downstream diagnostics and visualization.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from app.agents.state import AgentState, AgentStepLog
from app.engine.sql_engine import SQLAnalyticsEngine


def sql_analytics_agent(state: AgentState) -> AgentState:
    """LangGraph node executing DuckDB analytical SQL querying and business KPI computation."""
    step_history = list(state.get("step_history", []))

    # Retrieve input dataset (transformed dataset preferred, fallback to cleaned)
    transform_info = state.get("transformation")
    cleaning_info = state.get("cleaning")

    if transform_info and "transformed_file_path" in transform_info:
        input_path = transform_info["transformed_file_path"]
    elif cleaning_info and "cleaned_file_path" in cleaning_info:
        input_path = cleaning_info["cleaned_file_path"]
    else:
        error_msg = "No transformed or cleaned dataset path found in AgentState."
        step_history.append(
            AgentStepLog(
                agent="sql_analytics",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="initialization",
                summary="Failed to initialize SQL analytics agent",
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

    # Step log: Start SQL Execution
    step_history.append(
        AgentStepLog(
            agent="sql_analytics",
            timestamp=datetime.now(timezone.utc).isoformat(),
            phase="schema_inspection",
            summary=f"Registering dataset in DuckDB in-memory analytical catalog: {os.path.basename(input_path)}",
            detail="Creating zero-copy views, generating CREATE TABLE DDL, and validating read-only safety guardrails.",
            level="info",
        ).model_dump()
    )

    engine: SQLAnalyticsEngine | None = None
    try:
        engine = SQLAnalyticsEngine(dataset_path=input_path)
        output = engine.run_default_analytical_suite()

        summary_txt = (
            f"SQL Analysis completed. Registered table 'analytics_data' with {output.registered_tables[0].column_count} columns. "
            f"Executed {output.total_queries_run} analytical KPI queries across {len(output.available_templates)} pre-configured templates."
        )

        step_history.append(
            AgentStepLog(
                agent="sql_analytics",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="completion",
                summary=summary_txt,
                detail=f"Average query execution time: {sum(q.execution_time_ms for q in output.executed_queries) / max(len(output.executed_queries), 1):.2f}ms with DuckDB.",
                level="success",
            ).model_dump()
        )

        # Transition to next agent: Agent 5 (root_cause_engine)
        return {
            **state,
            "status": "diagnosing",
            "current_agent": "root_cause_engine",
            "sql_analytics": output.model_dump(),
            "step_history": step_history,
        }

    except Exception as e:
        error_msg = f"SQLAnalyticsAgent execution failed: {str(e)}"
        step_history.append(
            AgentStepLog(
                agent="sql_analytics",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="execution",
                summary="SQL execution error",
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
    finally:
        if engine:
            engine.close()
