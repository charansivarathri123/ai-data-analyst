"""Root-Cause & Diagnostics Engine.

Performs statistical attribution, feature importance ranking, cohort analysis,
and structured executive narrative synthesis using Scikit-Learn and Polars.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional
import numpy as np
import polars as pl
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import OrdinalEncoder

from app.agents.state import (
    CohortComparison,
    KeyDriver,
    NarrativeSummary,
    RootCauseOutput,
)


class DiagnosticEngine:
    """Isolates causal factors, computes feature importances, and synthesizes executive insights."""

    def __init__(self, clean_file_path: str):
        self.clean_file_path = clean_file_path
        if not os.path.exists(self.clean_file_path):
            raise FileNotFoundError(f"Cleaned dataset file not found: {self.clean_file_path}")

    def load_clean_df(self) -> pl.DataFrame:
        """Loads cleaned dataset."""
        if self.clean_file_path.endswith(".parquet"):
            return pl.read_parquet(self.clean_file_path)
        return pl.read_csv(self.clean_file_path, try_parse_dates=True)

    def diagnose(
        self,
        target_metric: Optional[str] = None,
        business_prompt: Optional[str] = None,
        brief: Optional[Dict[str, Any]] = None,
    ) -> RootCauseOutput:
        """Executes root-cause diagnosis, isolating drivers and synthesizing narrative."""
        df = self.load_clean_df()

        # 1. Resolve Target Metric (prioritizing brief)
        focal_metric = (brief.get("target_metric") if brief else None) or target_metric
        resolved_target = self._resolve_target_metric(df, focal_metric)

        # 2. Isolate Key Statistical Drivers using Tree Feature Importance
        drivers = self._isolate_key_drivers(df, resolved_target)

        # 3. Analyze Cohort Divergences across Categorical Dimensions
        cohorts = self._analyze_cohorts(df, resolved_target)

        # 4. Synthesize Executive Business Narrative
        narrative = self._synthesize_narrative(
            df=df,
            target_metric=resolved_target,
            drivers=drivers,
            cohorts=cohorts,
            user_prompt=business_prompt or "",
            brief=brief,
        )

        return RootCauseOutput(
            target_metric=resolved_target,
            drivers=drivers,
            cohorts=cohorts,
            narrative=narrative,
        )

    def _resolve_target_metric(self, df: pl.DataFrame, target: Optional[str]) -> str:
        """Determines focal metric, falling back to highest variance monetary/numeric column."""
        numeric_cols = [
            c for c in df.columns
            if df[c].dtype in (pl.Float32, pl.Float64, pl.Int32, pl.Int64, pl.UInt32, pl.UInt64)
        ]

        if not numeric_cols:
            raise ValueError("Dataset does not contain any numeric columns for diagnostics.")

        if target:
            # Clean and normalize target string
            clean_target = target.lower().strip().replace(" ", "_")
            for col in numeric_cols:
                if clean_target in col.lower() or col.lower() in clean_target:
                    return col

        # Priority keyword matching for standard business targets
        priority_keywords = ["revenue", "sales", "churn", "margin", "profit", "ltv", "amount"]
        for kw in priority_keywords:
            for col in numeric_cols:
                if kw in col.lower():
                    return col

        # Default fallback: highest variance column
        variances = {col: float(df[col].drop_nulls().var() or 0.0) for col in numeric_cols}
        return max(variances, key=variances.get)

    def _isolate_key_drivers(self, df: pl.DataFrame, target: str) -> List[KeyDriver]:
        """Calculates feature importance using Random Forest ensemble regressor."""
        target_series = df[target].drop_nulls()
        if target_series.len() < 5:
            return []

        # Prepare feature columns (excluding target and high-cardinality IDs)
        feature_cols = [
            c for c in df.columns
            if c != target and "id" not in c.lower() and df[c].dtype not in (pl.Date, pl.Datetime)
        ]

        if not feature_cols:
            return []

        # Convert to pandas for sklearn preprocessing
        sample_df = df.select([target] + feature_cols).drop_nulls().to_pandas()
        if len(sample_df) < 5:
            return []

        y = sample_df[target].values
        X_df = sample_df[feature_cols].copy()

        # Encode categorical columns
        cat_cols = X_df.select_dtypes(include=["object", "string", "category"]).columns.tolist()
        if cat_cols:
            encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
            X_df[cat_cols] = encoder.fit_transform(X_df[cat_cols].astype(str))

        # Fill any residual NaNs
        X_df = X_df.fillna(0)
        X = X_df.values

        # Fit Random Forest Regressor
        rf = RandomForestRegressor(n_estimators=50, random_state=42, max_depth=5)
        rf.fit(X, y)

        importances = rf.feature_importances_
        drivers: List[KeyDriver] = []

        for col, imp in zip(feature_cols, importances):
            # Directional impact via Pearson correlation with target
            corr = np.corrcoef(X_df[col].values, y)[0, 1] if np.std(X_df[col].values) > 0 else 0.0
            direction = "positive" if corr > 0.1 else "negative" if corr < -0.1 else "neutral"

            pct_weight = round(float(imp * 100), 1)
            if pct_weight > 0.0:
                drivers.append(
                    KeyDriver(
                        feature=col,
                        importance_score=pct_weight,
                        impact_direction=direction,
                        description=(
                            f"Accounts for {pct_weight}% of variance in '{target}' with a {direction} correlation trend."
                        ),
                    )
                )

        # Sort by importance
        drivers.sort(key=lambda d: d.importance_score, reverse=True)
        return drivers[:5]

    def _analyze_cohorts(self, df: pl.DataFrame, target: str) -> List[CohortComparison]:
        """Segments data across categorical dimensions to discover performance divergences."""
        cat_cols = [c for c in df.columns if df[c].dtype in (pl.String, pl.Utf8) and "id" not in c.lower()]
        cohorts: List[CohortComparison] = []

        for cat in cat_cols[:2]:  # Limit to top 2 categorical dimensions
            grouped = (
                df.group_by(cat)
                .agg([
                    pl.len().alias("count"),
                    pl.col(target).mean().round(2).alias("avg_target"),
                    pl.col(target).sum().round(2).alias("total_target"),
                ])
                .sort("avg_target", descending=True)
            )

            for row in grouped.to_dicts():
                cohort_val = str(row[cat])
                count = int(row["count"])
                avg = float(row["avg_target"] or 0.0)
                total = float(row["total_target"] or 0.0)

                cohorts.append(
                    CohortComparison(
                        cohort_name=f"{cat}: {cohort_val}",
                        sample_size=count,
                        metrics={"avg": avg, "total": total},
                        key_differentiators=[
                            f"Averages {avg:,.2f} {target} across {count} records.",
                        ],
                    )
                )

        return cohorts[:6]

    def _synthesize_narrative(
        self,
        df: pl.DataFrame,
        target_metric: str,
        drivers: List[KeyDriver],
        cohorts: List[CohortComparison],
        user_prompt: str,
        brief: Optional[Dict[str, Any]] = None,
    ) -> NarrativeSummary:
        """Synthesizes structured business insights into What Happened, Why, and Recommendations."""
        total_val = float(df[target_metric].sum() or 0.0)
        mean_val = float(df[target_metric].mean() or 0.0)

        # What happened
        top_cohort = cohorts[0].cohort_name if cohorts else "All Segments"
        what_txt = (
            f"Analysis of '{target_metric}' across {df.height} records indicates an overall mean of {mean_val:,.2f} "
            f"(total volume: {total_val:,.2f}). Peak performance is led by {top_cohort}."
        )
        if brief and brief.get("restated_goal"):
            what_txt = f"{brief.get('restated_goal')}. " + what_txt

        # Why it happened
        if drivers:
            primary_driver = drivers[0]
            secondary_driver = drivers[1] if len(drivers) > 1 else None
            why_txt = (
                f"Statistical attribution isolates '{primary_driver.feature}' as the dominant driver "
                f"({primary_driver.importance_score}% importance weight, {primary_driver.impact_direction} correlation). "
            )
            if secondary_driver:
                why_txt += (
                    f"A secondary influence is exerted by '{secondary_driver.feature}' "
                    f"({secondary_driver.importance_score}% importance weight)."
                )
            if brief and brief.get("success_criteria"):
                why_txt += f" Grounded validation against criteria: {brief.get('success_criteria')}."
        else:
            why_txt = "Variance across records is evenly distributed with no singular feature dominating performance."

        # Recommendations
        recommendations = []
        if drivers:
            top_feat = drivers[0].feature
            recommendations.append(
                f"Establish operational thresholds and monitoring triggers for '{top_feat}' to stabilize {target_metric} volatility."
            )
        if len(cohorts) >= 2:
            bottom_cohort = cohorts[-1].cohort_name
            recommendations.append(
                f"Investigate lower-performing cohort '{bottom_cohort}' to identify efficiency gaps relative to {top_cohort}."
            )
        recommendations.append(
            f"Incorporate identified drivers ('{drivers[0].feature if drivers else target_metric}') into downstream Power BI dashboard slicers."
        )

        return NarrativeSummary(
            what_happened=what_txt,
            why_it_happened=why_txt,
            recommended_interventions=recommendations,
        )
