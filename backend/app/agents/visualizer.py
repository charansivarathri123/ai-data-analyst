"""Agent 6: Data Visualization Agent (Matplotlib & Seaborn).

Responsible for automatically generating publication-grade statistical charts using Matplotlib and Seaborn,
encoding base64 previews, saving 300 DPI PNGs, performing anti-misleading audits, and compiling chart recommendations.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.agents.state import AgentState, AgentStepLog
from app.engine.visualization_engine import DataVisualizationEngine

logger = logging.getLogger("visualizer")

DATA_VISUALIZATIONS_SYSTEM_PROMPT = """You are a senior data visualization designer who has published charts for exec audiences — every chart earns its place, follows Tufte-level data-ink discipline, and is chosen because it's the right chart for the message, not a default.

Brief context: {brief}

Standards you always apply:
- Build exactly the charts listed in "chart_requirements" from the brief first — do not substitute a different chart type "because it's easier" (e.g. a requested waterfall must be a waterfall, not a bar chart standing in for one).
- Every chart title states the finding, not the mechanism (e.g. "Electronics margin fell 6pts in Q3" not "Margin by category over time").
- Choose chart type by data shape and intent: trend → line, part-to-whole → stacked bar/waterfall, distribution → histogram/box, comparison → grouped bar — never default to bar for everything.
- Run a quick bias/misleading-axis audit: no truncated y-axes that exaggerate small differences, no 3D effects, consistent color mapping across all charts in the set.
- Annotate the specific data point(s) that answer the business question directly on the chart (callout/label), don't make the viewer hunt for it.

Never: produce a chart that isn't in "chart_requirements" without explaining why it's an addition, or ship a chart whose axis/scale choices distort the story.

Output: the required charts (image + underlying data), each captioned with the finding in one sentence, plus a short note on any additional chart you added and why.
"""


def data_visualizer_agent(
    state: AgentState,
    brief: Optional[Dict[str, Any]] = None,
    revision_note: Optional[str] = None,
) -> AgentState:
    """LangGraph node executing Matplotlib & Seaborn data visualizations and chart compilation."""
    step_history = list(state.get("step_history", []))
    effective_brief = brief or state.get("analysis_brief")

    brief_json = json.dumps(effective_brief, indent=2) if effective_brief else "None provided"
    agent_prompt = DATA_VISUALIZATIONS_SYSTEM_PROMPT.format(brief=brief_json)
    if revision_note:
        agent_prompt += f"\n\n[REVISION DIRECTIVE]: {revision_note}"
        logger.info(f"[Visualizer] Executing revision pass: {revision_note}")

    # Retrieve dataset path (transformed preferred, fallback to cleaned)
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
                agent="data_visualizer",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="initialization",
                summary="Failed to initialize visualizer agent",
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

    chart_reqs = effective_brief.get("chart_requirements", []) if effective_brief else []

    # Step log: Start Visualization
    detail_txt = "Generating multi-series line trends, horizontal rankings, grouped bars, KDE distributions, and boxplots."
    if chart_reqs:
        detail_txt += f" Prioritizing {len(chart_reqs)} explicit chart requirements from brief."
    if revision_note:
        detail_txt += f" Applying revision feedback: {revision_note}"

    step_history.append(
        AgentStepLog(
            agent="data_visualizer",
            timestamp=datetime.now(timezone.utc).isoformat(),
            phase="rendering",
            summary=f"Rendering Matplotlib & Seaborn statistical visualizations on: {os.path.basename(input_path)}",
            detail=detail_txt,
            level="info",
        ).model_dump()
    )

    try:
        base_dir = os.path.dirname(os.path.abspath(input_path))
        export_dir = os.path.join(os.path.dirname(base_dir), "exports", "visualizations")
        os.makedirs(export_dir, exist_ok=True)

        engine = DataVisualizationEngine(
            dataset_path=input_path,
            export_dir=export_dir,
            brief=effective_brief,
        )
        output = engine.visualize_all(brief=effective_brief)

        summary_txt = (
            f"Visualizations completed. Generated {output.total_charts} publication-grade Matplotlib & Seaborn charts "
            f"and compiled {len(output.kpi_cards)} executive KPI metric cards. Saved 300 DPI exports to disk."
        )

        step_history.append(
            AgentStepLog(
                agent="data_visualizer",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="completion",
                summary=summary_txt,
                detail=f"Rendered {len(output.rendered_charts)} high-resolution charts adhering to data-ink discipline.",
                level="success",
            ).model_dump()
        )

        # Transition to next agent: Agent 7 (powerbi_architect)
        return {
            **state,
            "status": "generating_bi",
            "current_agent": "powerbi_architect",
            "visualization": output.model_dump(),
            "step_history": step_history,
        }

    except Exception as e:
        error_msg = f"DataVisualizerAgent execution error: {str(e)}"
        step_history.append(
            AgentStepLog(
                agent="data_visualizer",
                timestamp=datetime.now(timezone.utc).isoformat(),
                phase="execution",
                summary="Visualization failed",
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
