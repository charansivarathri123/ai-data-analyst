"""Agent 6: Data Visualization Agent (Matplotlib & Seaborn).

Responsible for automatically generating publication-grade statistical charts using Matplotlib and Seaborn,
encoding base64 previews, saving 300 DPI PNGs, performing anti-misleading audits, and compiling chart recommendations.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from app.agents.state import AgentState, AgentStepLog
from app.engine.visualization_engine import DataVisualizationEngine


def data_visualizer_agent(state: AgentState) -> AgentState:
    """LangGraph node executing Matplotlib & Seaborn data visualizations and chart compilation."""
    step_history = list(state.get("step_history", []))

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

    # Step log: Start Visualization
    step_history.append(
        AgentStepLog(
            agent="data_visualizer",
            timestamp=datetime.now(timezone.utc).isoformat(),
            phase="rendering",
            summary=f"Rendering Matplotlib & Seaborn statistical visualizations on: {os.path.basename(input_path)}",
            detail="Generating multi-series line trends, horizontal rankings, grouped bars, KDE distributions, outlier boxplots, and heatmaps.",
            level="info",
        ).model_dump()
    )

    try:
        base_dir = os.path.dirname(os.path.abspath(input_path))
        export_dir = os.path.join(os.path.dirname(base_dir), "exports", "visualizations")
        os.makedirs(export_dir, exist_ok=True)

        engine = DataVisualizationEngine(dataset_path=input_path, export_dir=export_dir)
        output = engine.visualize_all()

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
                detail=f"Rendered {len(output.rendered_charts)} high-resolution charts with anti-misleading audit validations.",
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
