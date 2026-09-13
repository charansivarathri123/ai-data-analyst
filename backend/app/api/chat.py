"""Groq-powered Chat API router for Autonomous AI Data Analyst Studio.

Provides conversational AI data analyst capabilities:
- DuckDB SQL assistance
- Data cleaning & profiling recommendations
- Star Schema design & DAX formulas
- Root-cause diagnostics & Executive summaries
- Supports SSE streaming (text/event-stream) and standard JSON responses
"""

import json
import os
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

logger = logging.getLogger("chat")

router = APIRouter(prefix="/api/chat", tags=["Chat"])

SYSTEM_PROMPT = """You are an elite, modern AI assistant and Senior Data Analyst.
Respond cleanly, elegantly, and directly without unwanted filler, boilerplate greetings, or unsolicited sign-offs.

Follow these strict output guidelines based on the query:

1. **Simple / Factual / Trivia Questions** (e.g. "what is the national animal of India", "what is 2 + 2"):
   - Provide only a direct, concise 1-2 sentence answer.
   - Do NOT add unnecessary bullet lists, key facts, or unsolicited follow-up questions.

2. **Coding, Analytical & Implementation Questions** (e.g. "give python code for calculator", SQL queries, DAX formulas, machine learning scripts):
   - Provide the complete, clean code block first with markdown syntax highlighting (e.g. ```python, ```sql, ```dax).
   - Follow immediately with a concise **Key Features** section using short, punchy bullet points explaining essential functionality (e.g. error handling, input validation, logic).
   - If relevant for follow-up enhancements, provide a **Next steps for enhancing this [topic]:** section with 2 to 3 concise suggestions.
   - Keep explanations tightly focused, professional, and free of conversational fluff or unsolicited apologies.
"""

GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile"


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user', 'assistant', or 'system'")
    content: str = Field(..., description="Message text")


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = GROQ_DEFAULT_MODEL
    temperature: Optional[float] = 0.5
    stream: Optional[bool] = True
    session_id: Optional[str] = None
    dataset_id: Optional[str] = None


class ChatResponse(BaseModel):
    role: str = "assistant"
    content: str
    model: str
    finish_reason: Optional[str] = "stop"


def get_groq_client():
    """Attempt to initialize the Groq client from environment."""
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key or api_key == "your_groq_api_key_here":
        try:
            from dotenv import load_dotenv, find_dotenv
            load_dotenv(find_dotenv(usecwd=True), override=True)
            _root_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.env"))
            if os.path.exists(_root_env):
                load_dotenv(_root_env, override=True)
            _backend_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env"))
            if os.path.exists(_backend_env):
                load_dotenv(_backend_env, override=True)
            api_key = os.getenv("GROQ_API_KEY", "").strip()
        except Exception as err:
            logger.warning(f"Could not reload .env file: {err}")

    if not api_key or api_key == "your_groq_api_key_here":
        return None
    try:
        from groq import Groq
        return Groq(api_key=api_key)
    except Exception as e:
        logger.warning(f"Failed to initialize Groq client: {e}")
        return None


_cached_groq_model: Optional[str] = None

def get_working_groq_model(groq_client, preferred_model: Optional[str] = None) -> str:
    """Identifies the best supported chat model available on the current Groq account."""
    global _cached_groq_model
    if _cached_groq_model and not preferred_model:
        return _cached_groq_model

    env_model = os.getenv("GROQ_MODEL", "").strip()
    if env_model:
        _cached_groq_model = env_model
        return env_model

    # Common chat completion candidates in order of analytical performance
    candidates = [
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "qwen/qwen3.6-27b",
        "mixtral-8x7b-32768",
    ]

    try:
        available_ids = {m.id for m in groq_client.models.list().data}
        if preferred_model and preferred_model in available_ids:
            return preferred_model

        for candidate in candidates:
            if candidate in available_ids:
                _cached_groq_model = candidate
                logger.info(f"Using Groq model: {candidate}")
                return candidate

        # Fallback to any non-whisper, non-guard model
        for mid in available_ids:
            if not any(x in mid.lower() for x in ("whisper", "guard", "safeguard")):
                _cached_groq_model = mid
                return mid
    except Exception as err:
        logger.warning(f"Could not verify available Groq models: {err}")

    fallback = preferred_model or "qwen/qwen3.8-27b"
    _cached_groq_model = fallback
    return fallback


def _get_dataset_context(dataset_id: Optional[str]) -> str:
    """Extracts tabular schema summary for grounding LLM and fallback replies."""
    if not dataset_id:
        return ""
    try:
        from app.api.datasets import _get_paths
        from app.engine.duckdb_client import DuckDBClient
        import glob

        paths = _get_paths()
        if dataset_id == "sample_business_sales":
            raw_file = os.path.join(paths["raw"], "sample_business_sales.csv")
        else:
            matches = glob.glob(os.path.join(paths["raw"], f"*{dataset_id}*"))
            if not matches:
                return ""
            raw_file = matches[0]

        if not os.path.exists(raw_file):
            return ""

        duck = DuckDBClient()
        try:
            meta = duck.inspect_file(raw_file, dataset_id)
        finally:
            duck.close()

        cols_desc = ", ".join([f"{c.name} ({c.inferred_type})" for c in meta.columns])
        return (
            f"\n\nCURRENT UPLOADED DATASET CONTEXT:\n"
            f"- Dataset ID: {dataset_id}\n"
            f"- Total Rows: {meta.row_count:,}\n"
            f"- Total Columns: {meta.column_count}\n"
            f"- Inferred Columns & Types: {cols_desc}\n"
            f"Always ground your calculations, SQL queries, DAX formulas, and root-cause findings strictly in these columns."
        )
    except Exception as e:
        logger.warning(f"Could not load dataset context for {dataset_id}: {e}")
        return ""


def fallback_chat_reply(messages: List[ChatMessage], dataset_context: str = "") -> str:
    """Generate intelligent mock responses when GROQ_API_KEY is not configured."""
    last_user_msg = ""
    for msg in reversed(messages):
        if msg.role == "user":
            last_user_msg = msg.content.lower()
            break

    ds_note = ""
    if dataset_context:
        ds_note = f"\n\n*(Grounded in your uploaded dataset: {dataset_context.strip()})*\n"

    has_api_key = bool(os.getenv("GROQ_API_KEY", "").strip() and os.getenv("GROQ_API_KEY") != "your_groq_api_key_here")
    api_key_hint = "" if has_api_key else "\n\n*(Tip: To enable live Groq LLM reasoning, set your `GROQ_API_KEY` in `.env`)*"

    if "dax" in last_user_msg or "power bi" in last_user_msg or "tmdl" in last_user_msg:
        return f"""### Power BI & DAX Architectural Guidance
{ds_note}
Here is a verified pattern for your analytical metric:

```dax
// Time-Intelligence YoY Growth Metric
Sales YoY Growth % = 
VAR CurrentSales = [Total Sales]
VAR PriorYearSales = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('DimDate'[Date]))
RETURN
    DIVIDE(CurrentSales - PriorYearSales, PriorYearSales, BLANK())
```

**Key Modeling Best Practices:**
1. **Star Schema Enforcement**: Keep numerical facts in `FactTable` and sliceable attributes in `DimTables` (1-to-many single-direction filtering).
2. **TMDL Export**: In the **Studio Workspace**, Agent 4 automatically serializes this model directly into `.pbip` and `.tmdl` files ready for Power BI Desktop.{api_key_hint}"""

    elif "sql" in last_user_msg or "duckdb" in last_user_msg or "query" in last_user_msg or "compare" in last_user_msg:
        return f"""### DuckDB Vectorized Analytics Query
{ds_note}
Here is an optimized analytical query pattern tailored to your data:

```sql
-- Dynamic Segment & Metric Aggregation via DuckDB
WITH cohort_stats AS (
    SELECT 
        COALESCE(CAST(region AS VARCHAR), 'All') AS cohort,
        COUNT(*) AS total_records,
        ROUND(AVG(gross_revenue), 2) AS avg_metric,
        ROUND(SUM(gross_revenue), 2) AS total_metric
    FROM raw_dataset
    GROUP BY cohort
)
SELECT 
    cohort,
    total_records,
    total_metric,
    avg_metric,
    ROUND(total_metric * 100.0 / SUM(total_metric) OVER (), 1) || '%' AS share_of_total,
    RANK() OVER (ORDER BY total_metric DESC) AS cohort_rank
FROM cohort_stats
ORDER BY total_metric DESC;
```

You can execute this query directly against your dataset in the **Studio Workspace** SQL runner!{api_key_hint}"""

    elif "clean" in last_user_msg or "null" in last_user_msg or "outlier" in last_user_msg or "audit" in last_user_msg:
        return f"""### Data Wrangling & Quality Inspection
{ds_note}
Our Autonomous Data Cleaner agent implements an auditable 6-stage pipeline:
1. **Zero-Loss Schema Inference**: Distinguishes true timestamps, integers, and categorical dimensions.
2. **IQR & Z-Score Outlier Flagging**: Clamps anomalous numerical bounds without dropping valid signals.
3. **Null Imputation**: Context-aware median for skewed features, mode for low-cardinality classes.
4. **Audit Scorecard**: Generates an audit trail of every modification made to your dataset.

Upload or inspect your dataset in the **Studio Workspace** to trigger this agent pipeline!"""

    else:
        return f"""### AI Data Analyst Intelligence Hub
{ds_note}
Welcome! I have analyzed your query and am ready to assist with your end-to-end data workflow:

- **Data Wrangling**: Cleaning messy schemas, handling nulls, and scoring quality.
- **DuckDB SQL**: Writing performant queries and transformations on your data.
- **Diagnostic Analytics**: Isolating key drivers, anomaly detection, and regression ranking.
- **Power BI Architecture**: Authoring verified DAX and generating `.pbip` / TMDL bundles.{api_key_hint}"""


@router.post("")
async def chat_endpoint(req: ChatRequest):
    """Handle conversational chat requests with Groq LLM streaming or fallback."""
    groq_client = get_groq_client()
    dataset_context = _get_dataset_context(req.dataset_id)
    effective_system_prompt = SYSTEM_PROMPT + dataset_context if dataset_context else SYSTEM_PROMPT

    requested_custom = req.model if req.model and req.model != GROQ_DEFAULT_MODEL else None
    active_model = get_working_groq_model(groq_client, requested_custom) if groq_client else "local-analyst-copilot"

    # If streaming is requested
    if req.stream:
        async def event_generator() -> AsyncGenerator[str, None]:
            if groq_client:
                try:
                    formatted_messages = [{"role": "system", "content": effective_system_prompt}]
                    for m in req.messages:
                        formatted_messages.append({"role": m.role, "content": m.content})

                    completion = groq_client.chat.completions.create(
                        model=active_model,
                        messages=formatted_messages,
                        temperature=req.temperature or 0.5,
                        max_tokens=1500,
                        stream=True,
                    )

                    for chunk in completion:
                        delta = chunk.choices[0].delta
                        content = delta.content if hasattr(delta, "content") else None
                        if content:
                            payload = json.dumps({"content": content})
                            yield f"data: {payload}\n\n"

                    yield "data: [DONE]\n\n"
                    return
                except Exception as err:
                    logger.error(f"Groq API streaming error: {err}")
                    err_msg = f"\n\n*(Groq Notice: {str(err)}. Falling back to local analyst mode.)*\n\n"
                    yield f"data: {json.dumps({'content': err_msg})}\n\n"

            # Fallback mock streaming (stream chunks with slight cadence)
            reply = fallback_chat_reply(req.messages, dataset_context=dataset_context)
            words = reply.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                payload = json.dumps({"content": chunk})
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # Non-streaming response
    if groq_client:
        try:
            formatted_messages = [{"role": "system", "content": effective_system_prompt}]
            for m in req.messages:
                formatted_messages.append({"role": m.role, "content": m.content})

            completion = groq_client.chat.completions.create(
                model=active_model,
                messages=formatted_messages,
                temperature=req.temperature or 0.5,
                max_tokens=800,
                stream=False,
            )
            content = completion.choices[0].message.content or ""
            return ChatResponse(
                role="assistant",
                content=content,
                model=active_model,
                finish_reason=completion.choices[0].finish_reason,
            )
        except Exception as e:
            logger.error(f"Groq API error: {e}")

    # Fallback non-streaming
    reply = fallback_chat_reply(req.messages, dataset_context=dataset_context)
    return ChatResponse(
        role="assistant",
        content=reply,
        model="local-analyst-copilot",
        finish_reason="stop",
    )
