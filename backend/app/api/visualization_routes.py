"""Data Visualization API routes for Matplotlib & Seaborn chart rendering and exports."""

from __future__ import annotations

import io
import os
import zipfile
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

from app.api.datasets import _get_paths
from app.api.pipeline import _sessions
from app.api.sql_routes import _resolve_dataset_file
from app.engine.visualization_engine import DataVisualizationEngine
from app.agents.state import RenderedChart

router = APIRouter(prefix="/api/visualize", tags=["Data Visualization"])


class CustomChartRequest(BaseModel):
    dataset_id: str
    chart_type: str = Field(description="bar, line, hist, box, scatter")
    x_col: str
    y_col: Optional[str] = None
    hue_col: Optional[str] = None
    aggregation: Optional[str] = "sum"
    title: Optional[str] = None
    palette: Optional[str] = "viridis"


@router.post("/custom", response_model=RenderedChart)
async def generate_custom_chart(payload: CustomChartRequest) -> RenderedChart:
    """Dynamically generates a custom Matplotlib/Seaborn visualization on demand."""
    file_path = _resolve_dataset_file(payload.dataset_id)
    paths = _get_paths()
    export_dir = os.path.join(paths["exports"], "visualizations")
    engine = DataVisualizationEngine(dataset_path=file_path, export_dir=export_dir)

    try:
        chart = engine.build_custom_chart(
            chart_type=payload.chart_type,
            x_col=payload.x_col,
            y_col=payload.y_col,
            hue_col=payload.hue_col,
            aggregation=payload.aggregation or "sum",
            title=payload.title,
            palette=payload.palette or "viridis",
        )
        return chart
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/download-bundle/{session_id}")
async def download_charts_bundle(session_id: str):
    """Downloads all generated high-resolution 300 DPI Matplotlib & Seaborn charts as a ZIP bundle."""
    paths = _get_paths()
    export_dir = os.path.join(paths["exports"], "visualizations")

    if not os.path.exists(export_dir):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No charts have been rendered yet.",
        )

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(export_dir):
            for file in files:
                if file.endswith(".png"):
                    full_p = os.path.join(root, file)
                    zf.write(full_p, arcname=file)

    zip_buffer.seek(0)
    return Response(
        content=zip_buffer.read(),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=charts_{session_id}.zip"},
    )
