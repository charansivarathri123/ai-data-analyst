"""Dataset management, upload, profiling, and export API routes."""

from __future__ import annotations

import os
import glob
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.agents.cleaner import data_cleaner_agent
from app.agents.state import AgentState, DatasetMetadata, DataCleanerOutput
from app.engine.duckdb_client import DuckDBClient

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])


def _get_paths() -> Dict[str, str]:
    """Resolves data paths relative to workspace root."""
    curr = os.path.abspath(os.getcwd())
    base_data = None
    while curr:
        candidate = os.path.join(curr, "data")
        if os.path.exists(candidate) and (
            os.path.exists(os.path.join(candidate, "raw", "sample_business_sales.csv"))
            or os.path.exists(os.path.join(curr, "README.md"))
        ):
            base_data = candidate
            break
        parent = os.path.dirname(curr)
        if parent == curr:
            break
        curr = parent

    if not base_data:
        base_data = os.path.abspath("./data")

    raw_dir = os.path.join(base_data, "raw")
    clean_dir = os.path.join(base_data, "cleaned")
    trans_dir = os.path.join(base_data, "transformed")
    exports_dir = os.path.join(base_data, "exports")

    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(clean_dir, exist_ok=True)
    os.makedirs(trans_dir, exist_ok=True)
    os.makedirs(exports_dir, exist_ok=True)

    return {
        "base": base_data,
        "raw": raw_dir,
        "cleaned": clean_dir,
        "transformed": trans_dir,
        "exports": exports_dir,
    }


def generate_dataset_questions(metadata: DatasetMetadata) -> List[Dict[str, str]]:
    """Analyzes the uploaded tabular schema and derives customized analytical questions."""
    cols = [c.name for c in metadata.columns]
    cols_lower = {c.name.lower(): c for c in metadata.columns}
    
    questions = []
    
    # 1. Look for target / churn / risk / status columns
    target_candidates = [name for name, c in cols_lower.items() if any(k in name for k in ("churn", "status", "risk", "attrition", "default", "flag", "converted", "success"))]
    
    # 2. Look for revenue / sales / profit / numerical metrics
    metric_candidates = [name for name, c in cols_lower.items() if any(k in name for k in ("revenue", "sales", "profit", "amount", "price", "margin", "cost", "total", "spend", "discount", "score", "value", "quantity"))]
    if not metric_candidates:
        metric_candidates = [c.name for c in metadata.columns if c.inferred_type in ("INTEGER", "FLOAT", "DOUBLE", "DECIMAL", "BIGINT")]
        
    # 3. Look for category / dimension / cohort columns
    dim_candidates = [name for name, c in cols_lower.items() if any(k in name for k in ("region", "country", "category", "segment", "cohort", "department", "tier", "plan", "gender", "type", "channel", "industry", "state"))]
    if not dim_candidates:
        dim_candidates = [c.name for c in metadata.columns if c.inferred_type in ("VARCHAR", "TEXT", "STRING") and c.unique_count < 50]
        
    # 4. Look for temporal / date columns
    date_candidates = [name for name, c in cols_lower.items() if any(k in name for k in ("date", "time", "year", "month", "day", "created", "timestamp", "period", "quarter")) or "DATE" in c.inferred_type or "TIME" in c.inferred_type]

    # Rule A: Cohort / Metric comparison
    if metric_candidates and dim_candidates:
        m = metric_candidates[0]
        d = dim_candidates[0]
        questions.append({
            "title": f"Compare {m.replace('_', ' ').title()} by {d.replace('_', ' ').title()}",
            "desc": f"Rank cohorts and calculate variance",
            "prompt": f"Analyze {m} grouped by {d} from the uploaded dataset. Which segments represent the highest share, and where is the greatest variance?",
        })

    # Rule B: Driver / Target attribution
    if target_candidates:
        t = target_candidates[0]
        questions.append({
            "title": f"Root-Cause Drivers of {t.replace('_', ' ').title()}",
            "desc": f"Isolate risk factors and correlation weights",
            "prompt": f"What are the top statistical drivers and risk factors influencing {t} in this dataset?",
        })

    # Rule C: Time-series trend
    if date_candidates and metric_candidates:
        dt = date_candidates[0]
        m = metric_candidates[0]
        questions.append({
            "title": f"Analyze {m.replace('_', ' ').title()} Trends Over Time",
            "desc": f"Temporal aggregations and seasonality",
            "prompt": f"Inspect the temporal trend of {m} across {dt}. Identify seasonal cycles, peak periods, or sudden drops.",
        })

    # Rule D: Data quality and missing values inspection
    null_cols = [c.name for c in metadata.columns if c.null_count > 0]
    if null_cols:
        questions.append({
            "title": f"Audit Quality & Null Values in {null_cols[0]}",
            "desc": f"Schema validation and zero-loss imputation strategy",
            "prompt": f"Audit the data quality of this dataset. Specifically inspect null values in {', '.join(null_cols[:3])} and suggest the best cleaning treatment.",
        })

    # Rule E: Star Schema & DAX formulation
    if metric_candidates:
        m = metric_candidates[0]
        questions.append({
            "title": f"Author Verified DAX Measures for {m.replace('_', ' ').title()}",
            "desc": f"Time-intelligence and ratio calculations",
            "prompt": f"Design a Star Schema for this dataset and write verified DAX measures to calculate Total {m.replace('_', ' ').title()}, Prior Period, and YoY Growth %.",
        })

    # Fallback if few questions
    if len(questions) < 4 and cols:
        questions.append({
            "title": "Exploratory Data Profile & Key Outliers",
            "desc": "Summary statistics and distribution shapes",
            "prompt": f"Provide an exploratory statistical profile of this dataset ({metadata.row_count} rows, {metadata.column_count} columns) and detect any anomalies or outliers.",
        })

    return questions[:4]


class DatasetUploadResponse(BaseModel):
    dataset_id: str
    metadata: DatasetMetadata
    preview_rows: List[Dict[str, Any]]
    message: str
    recommended_questions: List[Dict[str, str]] = Field(default_factory=list)


class CleanDatasetResponse(BaseModel):
    dataset_id: str
    cleaned: DataCleanerOutput
    preview_rows: List[Dict[str, Any]]
    message: str


@router.post("/upload", response_model=DatasetUploadResponse)
async def upload_dataset(file: UploadFile = File(...)) -> DatasetUploadResponse:
    """Ingests a raw tabular dataset (CSV, XLSX, XLS, Parquet) and extracts schema via DuckDB."""
    allowed_exts = (".csv", ".parquet", ".xlsx", ".xls")
    filename = file.filename or "dataset.csv"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format '{ext}'. Supported formats: {allowed_exts}",
        )

    paths = _get_paths()
    dataset_id = f"ds_{int(datetime.now(timezone.utc).timestamp())}"
    raw_saved_path = os.path.join(paths["raw"], f"{dataset_id}_{filename}")

    content = await file.read()
    with open(raw_saved_path, "wb") as f:
        f.write(content)

    # If Excel format, convert to CSV for DuckDB streaming inspection
    inspect_path = raw_saved_path
    if ext in (".xlsx", ".xls"):
        import pandas as pd
        pdf = pd.read_excel(raw_saved_path)
        csv_version = os.path.splitext(raw_saved_path)[0] + ".csv"
        pdf.to_csv(csv_version, index=False)
        inspect_path = csv_version

    duck = DuckDBClient()
    try:
        metadata = duck.inspect_file(inspect_path, dataset_id)
        preview = duck.get_preview(inspect_path, limit=15)
    finally:
        duck.close()

    questions = generate_dataset_questions(metadata)

    return DatasetUploadResponse(
        dataset_id=dataset_id,
        metadata=metadata,
        preview_rows=preview,
        message="Dataset successfully ingested, converted, and profiled.",
        recommended_questions=questions,
    )


@router.get("/sample", response_model=DatasetUploadResponse)
async def get_sample_dataset() -> DatasetUploadResponse:
    """Loads the realistic built-in business dataset for one-click testing and demonstration."""
    paths = _get_paths()
    sample_path = os.path.join(paths["raw"], "sample_business_sales.csv")

    if not os.path.exists(sample_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sample dataset not found.",
        )

    duck = DuckDBClient()
    try:
        metadata = duck.inspect_file(sample_path, "sample_business_sales")
        preview = duck.get_preview(sample_path, limit=15)
    finally:
        duck.close()

    questions = generate_dataset_questions(metadata)

    return DatasetUploadResponse(
        dataset_id="sample_business_sales",
        metadata=metadata,
        preview_rows=preview,
        message="Sample business sales dataset loaded.",
        recommended_questions=questions,
    )


@router.get("/{dataset_id}/metadata", response_model=DatasetUploadResponse)
async def get_dataset_metadata(dataset_id: str) -> DatasetUploadResponse:
    """Returns metadata and dynamic recommended questions for an uploaded dataset."""
    paths = _get_paths()
    if dataset_id == "sample_business_sales":
        raw_file = os.path.join(paths["raw"], "sample_business_sales.csv")
    else:
        matches = glob.glob(os.path.join(paths["raw"], f"*{dataset_id}*"))
        if not matches:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dataset {dataset_id} not found.",
            )
        raw_file = matches[0]

    if not os.path.exists(raw_file):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset file for {dataset_id} not found.",
        )

    duck = DuckDBClient()
    try:
        metadata = duck.inspect_file(raw_file, dataset_id)
        preview = duck.get_preview(raw_file, limit=15)
    finally:
        duck.close()

    questions = generate_dataset_questions(metadata)

    return DatasetUploadResponse(
        dataset_id=dataset_id,
        metadata=metadata,
        preview_rows=preview,
        message="Dataset metadata and recommended questions retrieved.",
        recommended_questions=questions,
    )


@router.post("/{dataset_id}/clean", response_model=CleanDatasetResponse)
async def clean_dataset(dataset_id: str) -> CleanDatasetResponse:
    """Invokes Agent 1 (Data Wrangling & Quality) to clean the dataset."""
    paths = _get_paths()

    # Find raw file
    if dataset_id == "sample_business_sales":
        raw_file = os.path.join(paths["raw"], "sample_business_sales.csv")
    else:
        matches = glob.glob(os.path.join(paths["raw"], f"{dataset_id}_*"))
        if not matches:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dataset {dataset_id} not found.",
            )
        raw_file = matches[0]

    duck = DuckDBClient()
    try:
        metadata = duck.inspect_file(raw_file, dataset_id)
    finally:
        duck.close()

    # Form state and run Agent 1
    state: AgentState = {
        "session_id": f"sess_{dataset_id}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "cleaning",
        "current_agent": "data_cleaner",
        "dataset": metadata.model_dump(),
        "step_history": [],
        "retry_count": 0,
    }

    new_state = data_cleaner_agent(state)

    if new_state.get("status") == "failed" or not new_state.get("cleaning"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=new_state.get("error", "Data cleaning failed"),
        )

    cleaning_output = DataCleanerOutput(**new_state["cleaning"])

    # Retrieve preview of cleaned file
    duck = DuckDBClient()
    try:
        clean_preview = duck.get_preview(cleaning_output.cleaned_file_path, limit=15)
    finally:
        duck.close()

    return CleanDatasetResponse(
        dataset_id=dataset_id,
        cleaned=cleaning_output,
        preview_rows=clean_preview,
        message="Data cleaning completed successfully by Agent 1.",
    )


@router.get("/{dataset_id}/preview")
async def get_dataset_preview(dataset_id: str) -> Dict[str, Any]:
    """Returns top rows of raw, cleaned, and transformed datasets for comparison."""
    paths = _get_paths()

    # 1. Raw file
    if dataset_id == "sample_business_sales":
        raw_file = os.path.join(paths["raw"], "sample_business_sales.csv")
        clean_file = os.path.join(paths["cleaned"], "sample_business_sales_cleaned.csv")
        trans_file = os.path.join(paths["transformed"], "sample_business_sales_transformed.csv")
    else:
        raw_matches = glob.glob(os.path.join(paths["raw"], f"*{dataset_id}*"))
        if not raw_matches:
            raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")
        raw_file = raw_matches[0]
        base_name = os.path.splitext(os.path.basename(raw_file))[0]
        clean_file = os.path.join(paths["cleaned"], f"{base_name}_cleaned.csv")
        trans_file = os.path.join(paths["transformed"], f"{base_name}_transformed.csv")

    duck = DuckDBClient()
    try:
        raw_preview = duck.get_preview(raw_file, limit=15) if os.path.exists(raw_file) else []
        clean_preview = duck.get_preview(clean_file, limit=15) if os.path.exists(clean_file) else []
        trans_preview = duck.get_preview(trans_file, limit=15) if os.path.exists(trans_file) else []
    finally:
        duck.close()

    return {
        "dataset_id": dataset_id,
        "raw_preview": raw_preview,
        "clean_preview": clean_preview,
        "transformed_preview": trans_preview,
        "has_cleaned": os.path.exists(clean_file),
        "has_transformed": os.path.exists(trans_file),
    }


@router.get("/{dataset_id}/download")
async def download_cleaned_dataset(dataset_id: str):
    """Direct file download of the cleaned CSV dataset."""
    paths = _get_paths()

    if dataset_id == "sample_business_sales":
        clean_file = os.path.join(paths["cleaned"], "sample_business_sales_cleaned.csv")
    else:
        clean_matches = glob.glob(os.path.join(paths["cleaned"], f"*{dataset_id}*.csv"))
        if not clean_matches:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cleaned dataset not available. Please run data cleaner agent first.",
            )
        clean_file = clean_matches[0]

    if not os.path.exists(clean_file):
        raise HTTPException(status_code=404, detail="Cleaned file not found.")

    return FileResponse(
        path=clean_file,
        media_type="text/csv",
        filename=os.path.basename(clean_file),
    )


@router.get("/{dataset_id}/download/transformed")
async def download_transformed_dataset(dataset_id: str):
    """Direct file download of the feature-engineered / transformed CSV dataset."""
    paths = _get_paths()

    if dataset_id == "sample_business_sales":
        trans_file = os.path.join(paths["transformed"], "sample_business_sales_transformed.csv")
    else:
        trans_matches = glob.glob(os.path.join(paths["transformed"], f"*{dataset_id}*.csv"))
        if not trans_matches:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transformed dataset not available. Please run pipeline first.",
            )
        trans_file = trans_matches[0]

    if not os.path.exists(trans_file):
        raise HTTPException(status_code=404, detail="Transformed file not found.")

    return FileResponse(
        path=trans_file,
        media_type="text/csv",
        filename=os.path.basename(trans_file),
    )
