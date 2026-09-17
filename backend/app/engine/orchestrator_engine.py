"""Hidden Orchestrator & Validator Engine (Agent 0).

Provides automated dataset profiling, business problem classification, column grounding,
structured Analysis Brief synthesis, and end-of-pipeline validation according to the
Hidden Orchestrator Architecture Specification.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import polars as pl
from pydantic import ValidationError

from app.agents.state import AnalysisBrief, ChartRequirement, ValidationVerdict
from app.api.chat import get_groq_client, get_working_groq_model

logger = logging.getLogger("orchestrator")

ORCHESTRATOR_SYSTEM_PROMPT = """You are a hidden planning agent. You never respond to the user directly and your output is never shown to them.

Given:
- A business problem statement (free text)
- A dataset profile (columns, dtypes, sample rows, null %, cardinality)

Output ONLY valid JSON matching this schema:
{
  "problem_type": "root_cause_diagnostic" | "trend_analysis" | "comparative" | "predictive" | "descriptive",
  "dataset_domain": "demographics" | "ecommerce" | "finance" | "healthcare" | "saas" | "iot" | "general_numeric",
  "metric_unit": "people" | "currency" | "count" | "ratio" | "seconds" | "score",
  "unit_symbol": "" | "$" | "₹" | "€",
  "banned_terms": ["inappropriate_term_1", "inappropriate_term_2"],
  "banned_symbols": ["₹", "$"],
  "time_horizon": "20_years_forward" | null,
  "target_year": 2042 | null,
  "feature_engineering_policy": "minimalist_prerequisite_only",
  "restated_goal": "Clear restatement of the goal grounded in the dataset",
  "target_metric": "exact_column_name_from_dataset",
  "key_dimensions": ["col1", "col2"],
  "required_analyses": ["historical_velocity", "forward_extrapolation", "regional_distribution"],
  "chart_requirements": [
    { "type": "line|bar|waterfall|scatter|box|donut", "x": "col_name", "y": "metric_col", "split_by": "dimension_col", "purpose": "description" }
  ],
  "columns_in_scope": ["col1", "col2", "col3"],
  "columns_out_of_scope": ["unrelated_col1", "unrelated_col2"],
  "success_criteria": "Concrete criteria for what constitutes a complete and high quality answer",
  "notes_for_downstream_agents": "Specific directives and constraints for feature engineering and downstream agents"
}

Domain & Metrology Rules:
- Accurately classify "dataset_domain". For population / country / census datasets, domain is "demographics", metric_unit is "people", and unit_symbol is "".
- Negative Knowledge: If domain is NOT ecommerce/retail, populate "banned_terms" with ["revenue", "sales", "order", "product", "aov", "cart", "customer", "profit", "price", "transactions"] and "banned_symbols" with ["₹", "$", "€", "£"].
- For predictive / forward extrapolation asks (e.g. "predict population after 20 years"):
  - Set "problem_type": "predictive"
  - Set "time_horizon": "20_years_forward"
  - Calculate "target_year": (latest historical year in dataset + 20), e.g. 2022 + 20 = 2042.
- Ground every field in columns that actually exist in the dataset. Never invent a column name. Never select index/rank columns like 'Rank' as target_metric when actual metric columns (e.g. '2022 Population') exist.
- Feature Engineering Policy: ALWAYS specify "minimalist_prerequisite_only". Instruct downstream agents to engineer ONLY the mathematical prerequisite features needed to solve the goal (e.g. CAGR growth velocity and 2042 projected population), and OMIT all generic/kitchen-sink transforms.
- Output pure JSON only. Do not wrap in markdown quotes or preamble.
"""

VALIDATOR_SYSTEM_PROMPT = """You are the same hidden orchestrator, now reviewing the finished output.

Given the original brief and the final output package (charts, diagnostics, Power BI summary), answer:
1. Does the output satisfy "success_criteria" from the brief? (yes/no)
2. If no, which specific agent's output is the gap, and what should it fix?

Valid agent names for revise_agent: "data_cleaner", "data_transformer", "eda_features", "sql_analytics", "root_cause_engine", "data_visualizer", "powerbi_architect".

Output JSON:
{ "passed": boolean, "revise_agent": string | null, "revision_note": string | null }
"""


def profile_dataset_for_orchestrator(file_path: str, sample_rows_count: int = 15) -> Dict[str, Any]:
    """Extracts a cheap, lightweight automated profile of the dataset for Agent 0.

    Gathers column names, dtypes, null percentages, cardinality, date ranges, and a 10-20 row sample.
    Does NOT load the entire dataset into LLM context.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset file not found for profiling: {file_path}")

    # Read schema and sample efficiently
    is_parquet = file_path.lower().endswith(".parquet")
    if is_parquet:
        df_sample = pl.read_parquet(file_path, n_rows=sample_rows_count)
        # Scan for metadata without reading full memory
        df_scan = pl.scan_parquet(file_path)
    else:
        df_sample = pl.read_csv(file_path, n_rows=sample_rows_count, try_parse_dates=True)
        df_scan = pl.scan_csv(file_path, try_parse_dates=True)

    columns = df_sample.columns
    total_rows = df_scan.select(pl.len()).collect().item()

    profile_cols = []
    date_ranges = {}

    # Sample rows formatted as JSON serializable list of dicts
    sample_records = df_sample.to_dicts()

    for col in columns:
        dtype_str = str(df_sample[col].dtype)
        # Fast aggregations using scan
        col_exprs = [
            pl.col(col).null_count().alias("nulls"),
            pl.col(col).n_unique().alias("unique_cnt"),
        ]
        if "Date" in dtype_str or "Datetime" in dtype_str:
            col_exprs.extend([
                pl.col(col).min().alias("min_val"),
                pl.col(col).max().alias("max_val"),
            ])

        try:
            col_stats = df_scan.select(col_exprs).collect().row(0, named=True)
            null_cnt = col_stats.get("nulls", 0)
            unique_cnt = col_stats.get("unique_cnt", 0)
            null_pct = round((null_cnt / max(total_rows, 1)) * 100, 2)

            if "min_val" in col_stats and col_stats["min_val"] is not None:
                date_ranges[col] = {
                    "start": str(col_stats["min_val"]),
                    "end": str(col_stats["max_val"]),
                }
        except Exception:
            null_cnt = df_sample[col].is_null().sum()
            unique_cnt = df_sample[col].n_unique()
            null_pct = round((null_cnt / max(sample_rows_count, 1)) * 100, 2)

        profile_cols.append({
            "name": col,
            "dtype": dtype_str,
            "cardinality": unique_cnt,
            "null_pct": null_pct,
            "is_numeric": any(t in dtype_str.lower() for t in ["int", "float", "decimal"]),
            "is_temporal": any(t in dtype_str.lower() for t in ["date", "time"]),
            "is_categorical": any(t in dtype_str.lower() for t in ["str", "utf8", "cat"]),
        })

    return {
        "file_name": os.path.basename(file_path),
        "total_rows": total_rows,
        "column_count": len(columns),
        "columns": profile_cols,
        "date_ranges": date_ranges,
        "sample_rows": sample_records,
    }


def _ground_column_name(candidate: str, available_cols: List[str]) -> Optional[str]:
    """Finds exact or closest matching column name from available columns."""
    if not candidate:
        return None
    cand_clean = candidate.strip().lower().replace(" ", "_")
    # 1. Exact match
    for col in available_cols:
        if col.lower() == cand_clean:
            return col
    # 2. Substring match
    for col in available_cols:
        col_clean = col.lower().replace(" ", "_")
        if cand_clean in col_clean or col_clean in cand_clean:
            return col
    return None


def _fallback_orchestrate_analysis(
    business_prompt: str,
    dataset_profile: Dict[str, Any],
    target_metric_hint: Optional[str] = None,
) -> AnalysisBrief:
    """Deterministic, rule-grounded fallback brief generator with domain metrology & common sense."""
    cols_meta = dataset_profile.get("columns", [])
    all_col_names = [c["name"] for c in cols_meta]
    numeric_cols = [c["name"] for c in cols_meta if c.get("is_numeric")]
    cat_cols = [c["name"] for c in cols_meta if c.get("is_categorical") and "id" not in c["name"].lower()]
    date_cols = [c["name"] for c in cols_meta if c.get("is_temporal") or "date" in c["name"].lower()]

    prompt_lower = (business_prompt or "").lower()
    col_str_lower = " ".join([c.lower() for c in all_col_names])

    # 1. Semantic Domain Metrology & Negative Knowledge
    if any(k in col_str_lower or k in prompt_lower for k in ["population", "census", "demographic", "fertility", "birth", "country/territory", "capital"]):
        dataset_domain = "demographics"
        metric_unit = "people"
        unit_symbol = ""
        banned_terms = ["revenue", "sales", "order", "product", "aov", "cart", "customer", "profit", "price", "transactions", "payment"]
        banned_symbols = ["₹", "$", "€", "£"]
    elif any(k in col_str_lower for k in ["patient", "diagnosis", "health", "symptom", "hospital", "clinic", "disease"]):
        dataset_domain = "healthcare"
        metric_unit = "count"
        unit_symbol = ""
        banned_terms = ["revenue", "sales", "order", "cart", "aov", "profit"]
        banned_symbols = ["₹", "$", "€", "£"]
    elif any(k in col_str_lower for k in ["stock", "ticker", "asset", "liability", "portfolio", "dividend", "equity"]):
        dataset_domain = "finance"
        metric_unit = "currency"
        unit_symbol = "$"
        banned_terms = ["patient", "cart", "shipment"]
        banned_symbols = []
    elif any(k in col_str_lower for k in ["order", "revenue", "sales", "cart", "customer", "ecommerce", "sku", "basket"]):
        dataset_domain = "ecommerce"
        metric_unit = "currency"
        unit_symbol = "$"
        banned_terms = []
        banned_symbols = []
    else:
        dataset_domain = "general_numeric"
        metric_unit = "count"
        unit_symbol = ""
        banned_terms = []
        banned_symbols = []

    # 2. Classify Ask & Predictive Horizon
    time_horizon = None
    target_year = None
    horizon_match = re.search(r'(\d+)\s*(?:years?|yrs?|yr)', prompt_lower)
    if horizon_match and any(w in prompt_lower for w in ["predict", "forecast", "after", "future", "ahead", "projection"]):
        years_ahead = int(horizon_match.group(1))
        time_horizon = f"{years_ahead}_years_forward"
        # Find latest 4-digit calendar year in column names (e.g., '2022 Population', '1970 Population')
        year_matches = []
        for c in all_col_names:
            ym = re.findall(r'\b(19\d\d|20\d\d)\b', c)
            for y in ym:
                year_matches.append(int(y))
        if year_matches:
            latest_year = max(year_matches)
            target_year = latest_year + years_ahead
        else:
            target_year = 2024 + years_ahead

    if any(w in prompt_lower for w in ["predict", "future", "forecast", "risk", "probability", "projection", "after"]):
        problem_type = "predictive"
    elif any(w in prompt_lower for w in ["why", "driver", "root cause", "erod", "drop", "decline", "fall", "attribution"]):
        problem_type = "root_cause_diagnostic"
    elif any(w in prompt_lower for w in ["trend", "quarter", "month", "season", "over time", "historical"]):
        problem_type = "trend_analysis"
    elif any(w in prompt_lower for w in ["compare", "versus", "vs", "segment", "difference", "cohort"]):
        problem_type = "comparative"
    else:
        problem_type = "descriptive"

    # 3. Ground Target Metric (Never pick Rank/Index or ID columns)
    substantive_numeric_cols = [
        c for c in numeric_cols
        if not any(ign in c.lower() for ign in ["rank", "id", "index", "code", "row_num", "number"])
    ]

    target_metric = None
    if target_metric_hint:
        target_metric = _ground_column_name(target_metric_hint, substantive_numeric_cols or all_col_names)

    if not target_metric and dataset_domain == "demographics":
        # Identify population columns and prefer the latest year
        pop_cols = [c for c in all_col_names if "population" in c.lower() and "percentage" not in c.lower()]
        if pop_cols:
            target_metric = sorted(pop_cols, reverse=True)[0]

    if not target_metric:
        priority_metric_kws = ["population", "margin", "profit", "revenue", "sales", "cost", "price", "amount", "churn", "volume"]
        for kw in priority_metric_kws:
            if kw in prompt_lower:
                for col in substantive_numeric_cols:
                    if kw in col.lower():
                        target_metric = col
                        break
            if target_metric:
                break

    if not target_metric and substantive_numeric_cols:
        target_metric = substantive_numeric_cols[0]
    elif not target_metric and numeric_cols:
        target_metric = numeric_cols[0]
    elif not target_metric and all_col_names:
        target_metric = all_col_names[0]

    # 4. Ground Key Dimensions
    key_dimensions: List[str] = []
    if dataset_domain == "demographics":
        for kw in ["country", "territory", "continent", "capital", "region"]:
            for col in cat_cols + all_col_names:
                if kw in col.lower() and col not in key_dimensions and col != target_metric:
                    key_dimensions.append(col)
                    if len(key_dimensions) >= 2:
                        break
            if len(key_dimensions) >= 2:
                break
    else:
        dim_kws = ["category", "product", "region", "segment", "country", "store", "channel", "type", "quarter", "month"]
        for kw in dim_kws:
            for col in cat_cols + date_cols:
                if kw in col.lower() and col not in key_dimensions:
                    key_dimensions.append(col)
                    if len(key_dimensions) >= 3:
                        break
            if len(key_dimensions) >= 3:
                break

    if not key_dimensions:
        key_dimensions = [c for c in cat_cols if c != target_metric][:2] if cat_cols else [c for c in all_col_names if c != target_metric][:2]

    # 5. In-Scope / Out-of-Scope Columns
    primary_date = date_cols[0] if date_cols else None
    in_scope = list(dict.fromkeys([target_metric] + key_dimensions + ([primary_date] if primary_date else [])))
    for c in substantive_numeric_cols:
        if c not in in_scope and len(in_scope) < 7:
            in_scope.append(c)

    out_of_scope = [
        c for c in all_col_names
        if c not in in_scope and any(ign in c.lower() for ign in ["id", "hash", "timestamp", "comment", "note", "guid", "row_num"])
    ]

    # 6. Required Analyses & Chart Requirements
    chart_reqs = []
    dim_1 = key_dimensions[0] if key_dimensions else None
    dim_2 = key_dimensions[1] if len(key_dimensions) > 1 else None

    if problem_type == "predictive" and dataset_domain == "demographics":
        required_analyses = ["historical_growth_velocity", "forward_extrapolation_forecast", "regional_distribution"]
        chart_reqs.append(
            ChartRequirement(
                type="line",
                x="Year",
                y=target_metric,
                purpose=f"Historical trajectory (1970–2022) and forward forecast to {target_year or 'future horizon'}",
            )
        )
        if dim_1:
            chart_reqs.append(
                ChartRequirement(
                    type="bar",
                    x=dim_1,
                    y=f"{target_year}_projected_population" if target_year else target_metric,
                    purpose=f"Top 10 countries by projected {target_year or 'future'} population",
                )
            )
        if dim_2:
            chart_reqs.append(
                ChartRequirement(
                    type="donut",
                    x=dim_2,
                    y=f"{target_year}_projected_population" if target_year else target_metric,
                    purpose=f"Projected {target_year or 'future'} population share by region/continent",
                )
            )
    else:
        required_analyses = ["driver_attribution", "cohort_comparison"]
        if primary_date or problem_type == "trend_analysis":
            required_analyses.insert(0, "trend_over_time")

        time_col = primary_date or (dim_2 if dim_2 else None)
        if time_col and target_metric:
            chart_reqs.append(
                ChartRequirement(
                    type="line",
                    x=time_col,
                    y=target_metric,
                    split_by=dim_1,
                    purpose=f"{target_metric} trend over time split by {dim_1}",
                )
            )
        if dim_1 and target_metric:
            chart_reqs.append(
                ChartRequirement(
                    type="bar",
                    x=dim_1,
                    y=target_metric,
                    purpose=f"{target_metric} distribution across {dim_1}",
                )
            )
        if problem_type == "root_cause_diagnostic":
            chart_reqs.append(
                ChartRequirement(
                    type="waterfall",
                    purpose=f"{target_metric} driver decomposition breakdown",
                )
            )

    horizon_phrase = f" and extrapolate forward {time_horizon.replace('_', ' ')} (target year {target_year})" if time_horizon else ""
    restated = (
        f"Investigate {problem_type.replace('_', ' ')} for focal metric '{target_metric}' "
        f"across primary dimensions ({', '.join(key_dimensions)}){horizon_phrase} to answer: '{business_prompt or 'Overall operational and demographic analysis'}'"
    )

    success_crit = (
        f"Answer must ground analysis in '{target_metric}', quantify demographic velocity across "
        f"({', '.join(key_dimensions)}), deliver forward projection deliverables without retail/currency terms, and satisfy the requested forecast horizon."
    )

    notes = (
        f"Minimalist Transformation Policy: Create ONLY mathematical prerequisites directly required by the goal "
        f"(historical CAGR growth velocity, {target_year or 'future'}_projected_population, and projected net growth). "
        f"Do NOT generate generic scaling, binning, or dummy variables. Ban all retail terms ({', '.join(banned_terms[:5])}) and currency symbols ({', '.join(banned_symbols)})."
    )

    return AnalysisBrief(
        problem_type=problem_type,  # type: ignore
        dataset_domain=dataset_domain,  # type: ignore
        metric_unit=metric_unit,
        unit_symbol=unit_symbol,
        banned_terms=banned_terms,
        banned_symbols=banned_symbols,
        time_horizon=time_horizon,
        target_year=target_year,
        feature_engineering_policy="minimalist_prerequisite_only",
        restated_goal=restated,
        target_metric=target_metric,
        key_dimensions=key_dimensions,
        required_analyses=required_analyses,
        chart_requirements=chart_reqs,
        columns_in_scope=in_scope,
        columns_out_of_scope=out_of_scope,
        success_criteria=success_crit,
        notes_for_downstream_agents=notes,
    )


def orchestrate_analysis(
    business_prompt: str,
    dataset_profile: Dict[str, Any],
    target_metric_hint: Optional[str] = None,
) -> AnalysisBrief:
    """Executes Agent 0: Hidden Orchestrator to generate the Analysis Brief.

    Uses Groq LLM if available, strictly validating outputs against existing columns,
    and falls back safely to deterministic grounding.
    """
    available_cols = [c["name"] for c in dataset_profile.get("columns", [])]
    fallback_brief = _fallback_orchestrate_analysis(
        business_prompt=business_prompt,
        dataset_profile=dataset_profile,
        target_metric_hint=target_metric_hint,
    )

    groq_client = get_groq_client()
    if not groq_client:
        logger.info("[Orchestrator] Groq client not configured; utilizing deterministic schema-grounded brief.")
        return fallback_brief

    active_model = get_working_groq_model(groq_client)
    user_payload = {
        "business_problem": business_prompt or "Provide comprehensive financial and operational diagnostic analysis",
        "target_metric_hint": target_metric_hint or "",
        "dataset_profile": {
            "file_name": dataset_profile.get("file_name"),
            "total_rows": dataset_profile.get("total_rows"),
            "columns": [
                {
                    "name": c["name"],
                    "dtype": c["dtype"],
                    "cardinality": c["cardinality"],
                    "null_pct": c["null_pct"],
                }
                for c in dataset_profile.get("columns", [])
            ],
            "date_ranges": dataset_profile.get("date_ranges", {}),
            "sample_rows_preview": dataset_profile.get("sample_rows", [])[:5],
        },
    }

    try:
        completion = groq_client.chat.completions.create(
            model=active_model,
            messages=[
                {"role": "system", "content": ORCHESTRATOR_SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(user_payload, default=str)},
            ],
            temperature=0.1,  # Low temperature for strict schema compliance
            response_format={"type": "json_object"},
        )
        raw_content = completion.choices[0].message.content or ""
        data = json.loads(raw_content)

        # Ground returned columns in reality: Never invent a column name
        grounded_target = _ground_column_name(data.get("target_metric", ""), available_cols) or fallback_brief.target_metric
        grounded_dims = [
            g for dim in data.get("key_dimensions", [])
            if (g := _ground_column_name(dim, available_cols))
        ] or fallback_brief.key_dimensions

        grounded_in_scope = [
            g for c in data.get("columns_in_scope", [])
            if (g := _ground_column_name(c, available_cols))
        ] or fallback_brief.columns_in_scope

        grounded_out_scope = [
            g for c in data.get("columns_out_of_scope", [])
            if (g := _ground_column_name(c, available_cols))
        ]

        chart_reqs = []
        for cr in data.get("chart_requirements", []):
            if isinstance(cr, dict):
                gx = _ground_column_name(cr.get("x", ""), available_cols)
                gy = _ground_column_name(cr.get("y", ""), available_cols)
                gsplit = _ground_column_name(cr.get("split_by", ""), available_cols)
                chart_reqs.append(
                    ChartRequirement(
                        type=cr.get("type", "bar"),
                        x=gx,
                        y=gy,
                        split_by=gsplit,
                        purpose=cr.get("purpose", ""),
                    )
                )

        brief = AnalysisBrief(
            problem_type=data.get("problem_type", fallback_brief.problem_type),
            dataset_domain=data.get("dataset_domain", fallback_brief.dataset_domain),
            metric_unit=data.get("metric_unit", fallback_brief.metric_unit),
            unit_symbol=data.get("unit_symbol", fallback_brief.unit_symbol),
            banned_terms=data.get("banned_terms", fallback_brief.banned_terms),
            banned_symbols=data.get("banned_symbols", fallback_brief.banned_symbols),
            time_horizon=data.get("time_horizon", fallback_brief.time_horizon),
            target_year=data.get("target_year", fallback_brief.target_year),
            feature_engineering_policy=data.get("feature_engineering_policy", fallback_brief.feature_engineering_policy),
            restated_goal=data.get("restated_goal", fallback_brief.restated_goal),
            target_metric=grounded_target,
            key_dimensions=grounded_dims,
            required_analyses=data.get("required_analyses", fallback_brief.required_analyses),
            chart_requirements=chart_reqs or fallback_brief.chart_requirements,
            columns_in_scope=grounded_in_scope,
            columns_out_of_scope=grounded_out_scope,
            success_criteria=data.get("success_criteria", fallback_brief.success_criteria),
            notes_for_downstream_agents=data.get("notes_for_downstream_agents", fallback_brief.notes_for_downstream_agents),
        )
        logger.info(f"[Orchestrator] Successfully generated brief for '{brief.target_metric}' via {active_model} (Domain: {brief.dataset_domain}, Unit: {brief.metric_unit})")
        return brief

    except Exception as exc:
        logger.warning(f"[Orchestrator] LLM brief orchestration failed ({exc}); using fallback brief.")
        return fallback_brief


def validate_pipeline_output(
    brief: AnalysisBrief,
    pipeline_outputs: Dict[str, Any],
) -> ValidationVerdict:
    """Evaluates final pipeline output against the brief's success criteria.

    Optionally suggests which agent needs revision.
    """
    groq_client = get_groq_client()
    summary_package = {
        "brief_success_criteria": brief.success_criteria,
        "target_metric": brief.target_metric,
        "key_dimensions": brief.key_dimensions,
        "required_analyses": brief.required_analyses,
        "pipeline_summary": {
            "data_cleaning": {
                "quality_score": pipeline_outputs.get("cleaning", {}).get("scorecard", {}).get("overall_score"),
                "imputed_nulls": pipeline_outputs.get("cleaning", {}).get("scorecard", {}).get("total_nulls_imputed"),
            },
            "feature_engineering": {
                "total_features": pipeline_outputs.get("transformation", {}).get("total_features"),
                "features_created": pipeline_outputs.get("transformation", {}).get("features_created"),
                "engineered_feature_names": [
                    (f.get("feature_name") if isinstance(f, dict) else getattr(f, "feature_name", ""))
                    for f in pipeline_outputs.get("transformation", {}).get("feature_catalog", [])
                ],
            },
            "eda": {
                "insights_count": len(pipeline_outputs.get("eda", {}).get("insights", [])),
                "outliers_count": len(pipeline_outputs.get("eda", {}).get("outliers", [])),
            },
            "sql_analytics": {
                "queries_executed": pipeline_outputs.get("sql_analytics", {}).get("total_queries_run"),
            },
            "root_cause_diagnostics": {
                "target_metric": pipeline_outputs.get("root_cause", {}).get("target_metric"),
                "drivers": [d.get("feature") for d in pipeline_outputs.get("root_cause", {}).get("drivers", [])[:3]],
                "cohort_count": len(pipeline_outputs.get("root_cause", {}).get("cohorts", [])),
            },
            "visualizations": {
                "rendered_charts_count": pipeline_outputs.get("visualization", {}).get("total_charts"),
                "chart_titles": [
                    (c.get("title") if isinstance(c, dict) else getattr(c, "title", ""))
                    for c in pipeline_outputs.get("visualization", {}).get("rendered_charts", [])
                ],
                "kpi_cards": [
                    f"{(k.get('title') if isinstance(k, dict) else getattr(k, 'title', ''))}: {(k.get('formatted_value') if isinstance(k, dict) else getattr(k, 'formatted_value', ''))}"
                    for k in pipeline_outputs.get("visualization", {}).get("kpi_cards", [])
                ],
            },
            "powerbi": {
                "star_schema_dimensions": len(pipeline_outputs.get("powerbi", {}).get("star_schema", {}).get("dimensions", [])),
                "dax_measures": [
                    (m.get("name") if isinstance(m, dict) else getattr(m, "name", ""))
                    for m in pipeline_outputs.get("powerbi", {}).get("dax_catalog", [])
                ],
            },
        },
    }

    if groq_client:
        active_model = get_working_groq_model(groq_client)
        try:
            completion = groq_client.chat.completions.create(
                model=active_model,
                messages=[
                    {"role": "system", "content": VALIDATOR_SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(summary_package, default=str)},
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
            )
            raw = completion.choices[0].message.content or "{}"
            parsed = json.loads(raw)
            return ValidationVerdict(
                passed=bool(parsed.get("passed", True)),
                revise_agent=parsed.get("revise_agent"),
                revision_note=parsed.get("revision_note"),
            )
        except Exception as err:
            logger.warning(f"[Validator] LLM validation call failed: {err}")

    # Programmatic zero-tolerance validation guardrails
    viz = pipeline_outputs.get("visualization", {})
    rc = pipeline_outputs.get("root_cause", {})
    pbi = pipeline_outputs.get("powerbi", {})
    sql = pipeline_outputs.get("sql_analytics", {})

    rendered_charts = viz.get("rendered_charts", []) if isinstance(viz, dict) else []
    kpi_cards = viz.get("kpi_cards", []) if isinstance(viz, dict) else []

    # 1. Banned Symbols & Terms Check (Negative Knowledge)
    if brief.banned_symbols or brief.banned_terms:
        for card in kpi_cards:
            text = f"{getattr(card, 'title', '')} {getattr(card, 'formatted_value', '')} {getattr(card, 'description', '')}"
            for sym in brief.banned_symbols:
                if sym in text:
                    return ValidationVerdict(
                        passed=False,
                        revise_agent="data_visualizer",
                        revision_note=f"Sanity Check Failed: Inappropriate symbol '{sym}' detected in KPI Card '{getattr(card, 'title', '')}' for {brief.dataset_domain} domain.",
                    )
            for term in brief.banned_terms:
                if re.search(rf"\b{re.escape(term)}\b", text, re.IGNORECASE):
                    return ValidationVerdict(
                        passed=False,
                        revise_agent="data_visualizer",
                        revision_note=f"Sanity Check Failed: Banned domain vocabulary '{term}' detected in KPI Card '{getattr(card, 'title', '')}' for {brief.dataset_domain} domain.",
                    )

        for chart in rendered_charts:
            chart_text = f"{getattr(chart, 'title', '')} {getattr(chart, 'description', '')}"
            for sym in brief.banned_symbols:
                if sym in chart_text:
                    return ValidationVerdict(
                        passed=False,
                        revise_agent="data_visualizer",
                        revision_note=f"Sanity Check Failed: Inappropriate symbol '{sym}' detected in Chart '{getattr(chart, 'title', '')}' for {brief.dataset_domain} domain.",
                    )
            for term in brief.banned_terms:
                if re.search(rf"\b{re.escape(term)}\b", chart_text, re.IGNORECASE):
                    return ValidationVerdict(
                        passed=False,
                        revise_agent="data_visualizer",
                        revision_note=f"Sanity Check Failed: Banned domain vocabulary '{term}' detected in Chart '{getattr(chart, 'title', '')}' for {brief.dataset_domain} domain.",
                    )

    # 2. Predictive Forward Extrapolation Check
    if brief.problem_type == "predictive":
        target_year_str = str(brief.target_year) if brief.target_year else ""
        has_forecast_visual = any(
            "forecast" in getattr(c, "title", "").lower()
            or "project" in getattr(c, "title", "").lower()
            or (target_year_str and target_year_str in getattr(c, "title", ""))
            for c in rendered_charts
        )
        has_forecast_kpi = any(
            "project" in getattr(k, "title", "").lower()
            or "forecast" in getattr(k, "title", "").lower()
            or (target_year_str and target_year_str in getattr(k, "title", ""))
            for k in kpi_cards
        )
        if not (has_forecast_visual or has_forecast_kpi):
            return ValidationVerdict(
                passed=False,
                revise_agent="data_visualizer",
                revision_note=f"Predictive analysis must deliver forward projection deliverables targeting horizon {brief.target_year or brief.time_horizon}.",
            )

    if not rc or not rc.get("drivers"):
        return ValidationVerdict(
            passed=False,
            revise_agent="root_cause_engine",
            revision_note=f"Root-cause diagnostics must isolate key statistical drivers for '{brief.target_metric}'.",
        )

    if not viz or (isinstance(viz, dict) and viz.get("total_charts", 0) == 0):
        return ValidationVerdict(
            passed=False,
            revise_agent="data_visualizer",
            revision_note=f"Visualization suite must render required charts matching brief: {len(brief.chart_requirements)} requested.",
        )

    if not pbi or not pbi.get("dax_catalog"):
        return ValidationVerdict(
            passed=False,
            revise_agent="powerbi_architect",
            revision_note="Power BI agent must compile verified DAX measures anchored to target metric.",
        )

    return ValidationVerdict(passed=True, revise_agent=None, revision_note=None)
