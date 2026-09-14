"""Main application entry point for the Autonomous AI Data Analyst & BI Studio Backend."""

import os
from datetime import datetime, timezone
from typing import Any, Dict, List
from contextlib import asynccontextmanager

from dotenv import load_dotenv, find_dotenv

# Search and load .env from current directory, parent directory, and workspace root
load_dotenv(find_dotenv(usecwd=True))
_root_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env"))
if os.path.exists(_root_env):
    load_dotenv(_root_env, override=True)
_backend_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.env"))
if os.path.exists(_backend_env):
    load_dotenv(_backend_env, override=True)

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.api.datasets import router as datasets_router
from app.api.pipeline import router as pipeline_router
from app.api.export import router as export_router
from app.api.sql_routes import router as sql_router
from app.api.visualization_routes import router as visualization_router
from app.api.auth import router as auth_router
from app.api.chat import router as chat_router


from app.db.database import init_db, get_db_status

# ---------------------------------------------------------------------------
# Lifespan Context Manager
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events for startup and graceful shutdown."""
    # Ensure local data directories exist
    os.makedirs("./data/raw", exist_ok=True)
    os.makedirs("./data/cleaned", exist_ok=True)
    os.makedirs("./data/transformed", exist_ok=True)
    os.makedirs("./data/exports", exist_ok=True)
    os.makedirs("./data/exports/visualizations", exist_ok=True)

    # Initialize persistent database schema
    try:
        init_db()
        print("[Startup] Persistent database initialized successfully.")
    except Exception as exc:
        print(f"[Startup Warning] Database initialization failed: {exc}")

    print("[Startup] Autonomous AI Data Analyst & BI Studio Backend initialized (7-Agent Pipeline).")
    yield
    print("[Shutdown] Backend server shutting down.")


# ---------------------------------------------------------------------------
# FastAPI Application Factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Autonomous AI Data Analyst & BI Studio API",
    description="Backend orchestration engine coordinating 7 specialized AI agents for data cleaning, transformation, EDA, SQL analysis, root-cause diagnostics, Matplotlib/Seaborn visualization, and Power BI report package generation.",
    version="2.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS Configuration
# ---------------------------------------------------------------------------

# Allow all web origins (Vercel deployments, custom domains, local development)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health & Status Schemas
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str = Field(default="healthy")
    service: str = Field(default="Autonomous AI Data Analyst & BI Studio")
    version: str = Field(default="2.0.0")
    timestamp: str
    environment: str
    database: Dict[str, Any] = Field(default_factory=dict)
    agents_ready: List[str]


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def get_health() -> HealthResponse:
    """Perform a service health check and inspect agent subsystem readiness."""
    db_status = get_db_status()
    overall_status = "healthy" if db_status.get("status") == "connected" else "degraded"

    return HealthResponse(
        status=overall_status,
        service="Autonomous AI Data Analyst & BI Studio",
        version="2.0.0",
        timestamp=datetime.now(timezone.utc).isoformat(),
        environment=os.getenv("ENVIRONMENT", "development"),
        database=db_status,
        agents_ready=[
            "data_cleaner",
            "data_transformer",
            "eda_features",
            "sql_analytics",
            "root_cause_engine",
            "data_visualizer",
            "powerbi_architect",
        ],
    )


# Mount Subsystem Routers
app.include_router(datasets_router)
app.include_router(pipeline_router)
app.include_router(sql_router)
app.include_router(visualization_router)
app.include_router(export_router)
app.include_router(auth_router)
app.include_router(chat_router)


# ---------------------------------------------------------------------------
# Root Welcome Route
# ---------------------------------------------------------------------------

@app.get("/", tags=["Root"])
async def root():
    return {
        "app": "Autonomous AI Data Analyst & BI Studio API",
        "docs_url": "/docs",
        "health_check": "/api/health",
        "version": "2.0.0",
        "pipeline_agents": 7,
    }
