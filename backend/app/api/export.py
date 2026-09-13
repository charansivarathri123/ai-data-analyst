"""Export and download API routes for Power BI deliverables and DAX catalogs."""

from __future__ import annotations

import os
import glob
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse, PlainTextResponse

from app.api.datasets import _get_paths
from app.api.pipeline import _sessions

router = APIRouter(prefix="/api/export", tags=["Export"])


@router.get("/{session_id}/pbip")
async def download_pbip_bundle(session_id: str):
    """Downloads the zipped Microsoft Power BI Project (.pbip + TMDL) bundle."""
    paths = _get_paths()
    session = _sessions.get(session_id)

    zip_file = None
    if session and session.get("powerbi"):
        pbip_bundle_path = session["powerbi"].get("pbip_bundle_path")
        if pbip_bundle_path and os.path.exists(pbip_bundle_path):
            zip_file = pbip_bundle_path

    # Fallback to file search in exports
    if not zip_file or not os.path.exists(zip_file):
        matches = glob.glob(os.path.join(paths["exports"], "*.zip"))
        if matches:
            zip_file = matches[0]

    if not zip_file or not os.path.exists(zip_file):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Power BI project bundle for session {session_id} not found. Please run the full pipeline first.",
        )

    return FileResponse(
        path=zip_file,
        media_type="application/zip",
        filename=os.path.basename(zip_file),
    )


@router.get("/{session_id}/dax")
async def get_dax_catalog(session_id: str) -> Dict[str, Any]:
    """Returns the syntactically verified DAX measure catalog for a pipeline session."""
    session = _sessions.get(session_id)
    if not session or not session.get("powerbi"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"DAX catalog for session {session_id} not found.",
        )

    return {
        "session_id": session_id,
        "dax_catalog": session["powerbi"].get("dax_catalog", []),
        "star_schema": session["powerbi"].get("star_schema", {}),
    }
