"""SQL Analysis API routes for DuckDB analytical query execution."""

from __future__ import annotations

import os
import glob
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.api.datasets import _get_paths
from app.engine.sql_engine import SQLAnalyticsEngine
from app.agents.state import SQLQueryResult, SQLTableSchema, SQLTemplate

router = APIRouter(prefix="/api/sql", tags=["SQL Analytics"])


class ExecuteQueryRequest(BaseModel):
    dataset_id: str
    sql_query: str
    query_name: Optional[str] = "Custom Query"
    limit: Optional[int] = 200


def _resolve_dataset_file(dataset_id: str) -> str:
    """Finds the transformed or cleaned file path for a dataset_id."""
    paths = _get_paths()
    base_data = paths["base"]

    # 1. Look in transformed
    trans_matches = glob.glob(os.path.join(base_data, "transformed", f"*{dataset_id}*"))
    if trans_matches:
        return trans_matches[0]

    # 2. Look in cleaned
    clean_matches = glob.glob(os.path.join(paths["cleaned"], f"*{dataset_id}*"))
    if clean_matches:
        return clean_matches[0]

    # 3. Look in raw
    raw_matches = glob.glob(os.path.join(paths["raw"], f"*{dataset_id}*"))
    if raw_matches:
        return raw_matches[0]

    # 4. Fallback sample
    sample_file = os.path.join(paths["raw"], "sample_business_sales.csv")
    if os.path.exists(sample_file):
        return sample_file

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Dataset '{dataset_id}' could not be located on disk.",
    )


@router.post("/execute", response_model=SQLQueryResult)
async def execute_sql_query(payload: ExecuteQueryRequest) -> SQLQueryResult:
    """Executes a parameterized, read-only analytical SQL query against DuckDB."""
    file_path = _resolve_dataset_file(payload.dataset_id)
    engine = SQLAnalyticsEngine(dataset_path=file_path)

    try:
        res = engine.execute_query(
            sql=payload.sql_query,
            query_name=payload.query_name or "Ad-Hoc Query",
            limit=payload.limit or 200,
        )
        return res
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    finally:
        engine.close()


@router.get("/templates", response_model=List[SQLTemplate])
async def get_sql_templates() -> List[SQLTemplate]:
    """Returns pre-configured business KPI query templates."""
    templates = []
    for tmpl in SQLAnalyticsEngine.DEFAULT_TEMPLATES:
        templates.append(
            SQLTemplate(
                template_id=tmpl["template_id"],
                name=tmpl["name"],
                business_question=tmpl["business_question"],
                sql_query=tmpl["sql_query"],
                category=tmpl["category"],
            )
        )
    return templates


@router.get("/schema/{dataset_id}", response_model=SQLTableSchema)
async def get_table_schema(dataset_id: str) -> SQLTableSchema:
    """Returns the DuckDB schema and CREATE TABLE DDL for a dataset."""
    file_path = _resolve_dataset_file(dataset_id)
    engine = SQLAnalyticsEngine(dataset_path=file_path)
    try:
        return engine.inspect_schema("analytics_data")
    finally:
        engine.close()
