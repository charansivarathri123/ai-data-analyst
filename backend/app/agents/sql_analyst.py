"""Agent 4: SQL Analysis & Business Query Agent.

Responsible for registering datasets in DuckDB, providing schema exploration DDL,
enforcing read-only security, executing parameterized business KPI queries, explaining SQL in plain English,
and compiling analytical query results for downstream diagnostics and visualization.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.agents.state import AgentState, AgentStepLog
from app.engine.sql_engine import SQLAnalyticsEngine

logger = logging.getLogger("sql_analyst")

SQL_ANALYST_SYSTEM_PROMPT = """You are a senior analytics engineer who writes SQL the way a staff engineer would review it: correct joins, sane aggregation grain, and query names that describe business intent, not implementation.

Brief context: {brief}

Standards you always apply:
- Every query's SELECT/GROUP BY must map to "target_metric" and "key_dimensions" from the brief — don't write exploratory throwaway queries as final output.
- State the grain of each result explicitly (e.g. "one row per product_category per quarter") — grain mistakes are the most common silent bug in analytics SQL.
- Use CTEs with descriptive names over deeply nested subqueries; a stranger should be able to read the query top to bottom.
- Sanity-check aggregates against a known total (e.g. do category sums add up to the overall total?) before presenting results.
- When computing ratios (margin %, churn rate), guard against divide-by-zero and state the denominator definition explicitly.

Never: return a query result without stating its grain, or let a JOIN silently fan out rows and inflate a metric.

Output: named, commented queries + their result sets, each tagged with which brief requirement they answer.
"""


def sql_analytics_agent(
    state: AgentState,
    brief: Optional[Dict[str, Any]] = None,
    revision_note: Optional[str] = None,
) -> AgentState:
    """LangGraph node executing DuckDB analytical SQL querying and business KPI computation."""
    step_history = list(state.get("step_history", []))
    effective_brief = brief or state.get("analysis_brief")

    brief_json = json.dumps(effective_brief, indent=2) if effective_brief else "None provided"
    agent_prompt = SQL_ANALYST_SYSTEM_PROMPT.format(brief=brief_json)
    if revision_note:
        agent_prompt += f"\n\n[REVISION DIRECTIVE]: {revision_note}"
        logger.info(f"[SQLAnalyst] Executing revision pass: {revision_note}")

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

    target_metric = effective_brief.get("target_metric") if effective_brief else None
    key_dims = effective_brief.get("key_dimensions", []) if effective_brief else []

    # Step log: Start SQL Execution
    detail_txt = "Creating zero-copy views, generating CREATE TABLE DDL, and validating read-only guardrails."
    if target_metric and key_dims:
        detail_txt += f" Synthesizing explicit-grain queries for '{target_metric}' across {', '.join(key_dims[:2])}."
    if revision_note:
        detail_txt += f" Applying revision note: {revision_note}"

    step_history.append(
        AgentStepLog(
            agent="sql_analytics",
            timestamp=datetime.now(timezone.utc).isoformat(),
            phase="schema_inspection",
            summary=f"Registering dataset in DuckDB in-memory analytical catalog: {os.path.basename(input_path)}",
            detail=detail_txt,
            level="info",
        ).model_dump()
    )

    engine: SQLAnalyticsEngine | None = None
    try:
        engine = SQLAnalyticsEngine(dataset_path=input_path, brief=effective_brief)
        output = engine.run_default_analytical_suite()

        summary_txt = (
            f"SQL Analysis completed. Registered table 'analytics_data' with {output.registered_tables[0].column_count} columns. "
            f"Executed {output.total_queries_run} analytical KPI queries across {len(output.available_templates)} templates."
        )

        step_history.append(
            AgentStepLog(
                agent="sql_analytics",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="completion",
                summary=summary_txt,
                detail=f"Average query execution time: {sum(q.execution_time_ms for q in output.executed_queries) / max(len(output.executed_queries), 1):.2f}ms with DuckDB. Tagged query grains explicitly.",
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
