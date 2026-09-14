"""Database configuration and session management for Autonomous AI Data Analyst Studio.

Supports dual-mode database access:
1. SQLite (default, zero-config local storage at ./data/app.db)
2. PostgreSQL (cloud deployments via DATABASE_URL for Supabase, Neon, Render, Railway, AWS, etc.)
"""

import os
import logging
from typing import Generator
from dotenv import load_dotenv, find_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Load environment variables
load_dotenv(find_dotenv(usecwd=True))
_root_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.env"))
if os.path.exists(_root_env):
    load_dotenv(_root_env, override=True)
_backend_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env"))
if os.path.exists(_backend_env):
    load_dotenv(_backend_env, override=True)

logger = logging.getLogger("db")

Base = declarative_base()


def _resolve_database_url() -> str:
    """Resolve and normalize DATABASE_URL from environment or fallback to SQLite."""
    raw_url = os.getenv("DATABASE_URL", "").strip()

    if not raw_url:
        # Fallback to local SQLite database in project data directory
        # Find absolute path of project root
        curr = os.path.abspath(os.getcwd())
        data_dir = None
        while curr:
            candidate = os.path.join(curr, "data")
            if os.path.exists(candidate) or os.path.exists(os.path.join(curr, "README.md")):
                data_dir = candidate
                break
            parent = os.path.dirname(curr)
            if parent == curr:
                break
            curr = parent

        if not data_dir:
            data_dir = os.path.abspath("./data")

        os.makedirs(data_dir, exist_ok=True)
        db_path = os.path.join(data_dir, "app.db").replace("\\", "/")
        return f"sqlite:///{db_path}"

    # Normalize Heroku / Supabase / Render legacy postgres:// schema to postgresql://
    if raw_url.startswith("postgres://"):
        raw_url = raw_url.replace("postgres://", "postgresql://", 1)

    return raw_url


DATABASE_URL = _resolve_database_url()
is_sqlite = DATABASE_URL.startswith("sqlite")

engine_kwargs = {}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Initialize database schema, creating all tables if they do not exist."""
    import app.db.models  # Ensure models are imported and registered with Base
    Base.metadata.create_all(bind=engine)
    logger.info(f"Database initialized successfully with dialect: {engine.dialect.name}")


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for obtaining a thread-safe database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_status() -> dict:
    """Check database health and return connection status."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "status": "connected",
            "dialect": engine.dialect.name,
            "is_sqlite": is_sqlite,
        }
    except Exception as exc:
        logger.error(f"Database health check failed: {exc}")
        return {
            "status": "unhealthy",
            "error": str(exc),
            "dialect": engine.dialect.name,
            "is_sqlite": is_sqlite,
        }
