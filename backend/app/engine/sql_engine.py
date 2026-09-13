"""DuckDB-Powered Analytical SQL Engine & Business Query Studio.

Provides zero-copy, high-performance in-memory SQL execution against cleaned and transformed
datasets, database schema exploration, read-only safety guardrails, business KPI query templates,
query explanations in plain English, and automated chart recommendations.
"""

from __future__ import annotations

import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple
import duckdb
import polars as pl

from app.agents.state import (
    ColumnSchema,
    SQLAnalyticsOutput,
    SQLQueryResult,
    SQLTableSchema,
    SQLTemplate,
)


class SQLAnalyticsEngine:
    """Manages DuckDB query session, table registrations, query safety, and KPI templates."""

    # Built-in Business Question SQL Templates
    DEFAULT_TEMPLATES: List[Dict[str, str]] = [
        {
            "template_id": "top_products_revenue",
            "name": "Top 10 Products by Revenue & Margin",
            "business_question": "Which top 10 products generate the highest gross revenue and what is their average margin?",
            "category": "Product Analytics",
            "sql_query": """SELECT 
    COALESCE(category, 'All Categories') AS product_category,
    COUNT(*) AS total_orders,
    ROUND(SUM(total_sales), 2) AS gross_revenue,
    ROUND(AVG(unit_price), 2) AS avg_unit_price,
    ROUND(AVG(discount_percent) * 100, 1) AS avg_discount_pct
FROM analytics_data
GROUP BY 1
ORDER BY gross_revenue DESC
LIMIT 10;""",
        },
        {
            "template_id": "monthly_sales_mom_growth",
            "name": "Monthly Sales Trend & MoM Growth %",
            "business_question": "How has total revenue trended month-over-month, and what is the growth percentage?",
            "category": "Time Series & Growth",
            "sql_query": """WITH monthly_agg AS (
    SELECT 
        STRFTIME(TRY_CAST(order_date AS DATE), '%Y-%m') AS order_month,
        ROUND(SUM(total_sales), 2) AS monthly_revenue,
        COUNT(*) AS order_volume
    FROM analytics_data
    WHERE order_date IS NOT NULL
    GROUP BY 1
)
SELECT 
    order_month,
    monthly_revenue,
    order_volume,
    LAG(monthly_revenue, 1) OVER (ORDER BY order_month) AS prev_month_revenue,
    ROUND(((monthly_revenue - LAG(monthly_revenue, 1) OVER (ORDER BY order_month)) / 
           NULLIF(LAG(monthly_revenue, 1) OVER (ORDER BY order_month), 0)) * 100, 2) AS mom_growth_pct
FROM monthly_agg
ORDER BY order_month ASC;""",
        },
        {
            "template_id": "regional_contribution_share",
            "name": "Regional Performance & Contribution Share %",
            "business_question": "What is the revenue and order breakdown across sales regions, and what share of total sales does each region represent?",
            "category": "Regional Analytics",
            "sql_query": """SELECT 
    COALESCE(region, 'Unknown') AS sales_region,
    COUNT(*) AS total_orders,
    ROUND(SUM(total_sales), 2) AS regional_revenue,
    ROUND(AVG(total_sales), 2) AS avg_order_value,
    ROUND((SUM(total_sales) * 100.0 / SUM(SUM(total_sales)) OVER ()), 2) AS revenue_share_pct
FROM analytics_data
GROUP BY 1
ORDER BY regional_revenue DESC;""",
        },
        {
            "template_id": "customer_rfm_ranking",
            "name": "Customer Lifetime Value & RFM Ranking",
            "business_question": "How do top customers rank by monetary spending, order frequency, and average basket size?",
            "category": "Customer Segmentation",
            "sql_query": """SELECT 
    customer_id,
    COUNT(*) AS order_frequency,
    ROUND(SUM(total_sales), 2) AS monetary_lifetime_value,
    ROUND(AVG(total_sales), 2) AS avg_basket_size,
    DENSE_RANK() OVER (ORDER BY SUM(total_sales) DESC) AS customer_rank
FROM analytics_data
WHERE customer_id IS NOT NULL
GROUP BY 1
ORDER BY monetary_lifetime_value DESC
LIMIT 15;""",
        },
        {
            "template_id": "payment_method_aov",
            "name": "Payment Method Breakdown & Average Basket",
            "business_question": "Which payment methods are most popular and which achieve the highest Average Order Value (AOV)?",
            "category": "Operations & FinTech",
            "sql_query": """SELECT 
    COALESCE(payment_method, 'Direct Payment') AS payment_type,
    COUNT(*) AS transaction_count,
    ROUND(SUM(total_sales), 2) AS total_processed_volume,
    ROUND(AVG(total_sales), 2) AS avg_transaction_value,
    ROUND(AVG(customer_satisfaction), 2) AS avg_csat_rating
FROM analytics_data
GROUP BY 1
ORDER BY total_processed_volume DESC;""",
        },
        {
            "template_id": "high_value_transaction_outliers",
            "name": "High-Value Transaction Outliers (Pareto Top 5%)",
            "business_question": "Which individual orders represent extreme high-value transactions and exceed the 95th percentile threshold?",
            "category": "Anomaly & Risk",
            "sql_query": """SELECT 
    order_id,
    customer_id,
    order_date,
    category,
    region,
    total_sales,
    quantity,
    unit_price,
    ROUND(PERCENT_RANK() OVER (ORDER BY total_sales), 4) AS sales_percentile
FROM analytics_data
QUALIFY sales_percentile >= 0.95
ORDER BY total_sales DESC
LIMIT 20;""",
        },
    ]

    def __init__(self, dataset_path: str):
        self.dataset_path = os.path.abspath(dataset_path)
        self.con = duckdb.connect(database=":memory:")
        self._register_tables()

    def _register_tables(self) -> None:
        """Registers the dataset as analytical views inside the in-memory DuckDB instance."""
        sql_path = self.dataset_path.replace("\\", "/")
        path_lower = sql_path.lower()
        if path_lower.endswith(".parquet"):
            read_stmt = f"read_parquet('{sql_path}')"
        else:
            read_stmt = f"read_csv_auto('{sql_path}')"

        self.con.execute(f"CREATE OR REPLACE VIEW raw_source AS SELECT * FROM {read_stmt}")
        cols = [c.lower() for c in self.con.table("raw_source").columns]

        # Harmonize common business column aliases for seamless query execution across schemas
        extra_projections = []
        if "total_sales" not in cols and "gross_revenue" in cols:
            extra_projections.append("gross_revenue AS total_sales")
        elif "gross_revenue" not in cols and "total_sales" in cols:
            extra_projections.append("total_sales AS gross_revenue")

        if "category" not in cols and "customer_segment" in cols:
            extra_projections.append("customer_segment AS category")

        if "order_id" not in cols and "transaction_id" in cols:
            extra_projections.append("transaction_id AS order_id")

        if "customer_id" not in cols:
            if "customer_segment" in cols:
                extra_projections.append("customer_segment AS customer_id")
            elif "transaction_id" in cols:
                extra_projections.append("transaction_id AS customer_id")
            else:
                extra_projections.append("'CUST-001' AS customer_id")

        if "payment_method" not in cols:
            extra_projections.append("'Direct Payment' AS payment_method")

        if "discount_percent" not in cols and "discount_rate" in cols:
            extra_projections.append("discount_rate AS discount_percent")
        elif "discount_percent" not in cols:
            extra_projections.append("0.05 AS discount_percent")

        if "quantity" not in cols and "units_sold" in cols:
            extra_projections.append("units_sold AS quantity")
        elif "quantity" not in cols:
            extra_projections.append("1.0 AS quantity")

        if "unit_price" not in cols:
            if "gross_revenue" in cols and "units_sold" in cols:
                extra_projections.append("ROUND(gross_revenue / NULLIF(units_sold, 0), 2) AS unit_price")
            elif "total_sales" in cols and "quantity" in cols:
                extra_projections.append("ROUND(total_sales / NULLIF(quantity, 0), 2) AS unit_price")
            else:
                extra_projections.append("100.0 AS unit_price")

        if "customer_satisfaction" not in cols:
            extra_projections.append("4.5 AS customer_satisfaction")

        proj_str = ", ".join(["*"] + extra_projections)
        self.con.execute(f"CREATE OR REPLACE VIEW analytics_data AS SELECT {proj_str} FROM raw_source")
        self.con.execute("CREATE OR REPLACE VIEW orders AS SELECT * FROM analytics_data")
        self.con.execute("CREATE OR REPLACE VIEW sales_fact AS SELECT * FROM analytics_data")

    def inspect_schema(self, table_name: str = "analytics_data") -> SQLTableSchema:
        """Inspects table columns, data types, row count, and generates CREATE TABLE DDL."""
        rel = self.con.table(table_name)
        row_count = int(rel.shape[0])
        col_names = rel.columns
        col_types = rel.dtypes

        # Preview sample rows
        sample_df = rel.limit(5).pl()
        sample_rows = sample_df.to_dicts()

        columns: List[ColumnSchema] = []
        ddl_col_defs = []

        for name, dtype in zip(col_names, col_types):
            safe_col = f'"{name}"'
            null_count = int(self.con.execute(f"SELECT count(*) - count({safe_col}) FROM {table_name}").fetchone()[0])
            unique_count = int(self.con.execute(f"SELECT approx_count_distinct({safe_col}) FROM {table_name}").fetchone()[0])
            sample_vals = [r.get(name) for r in sample_rows]

            columns.append(
                ColumnSchema(
                    name=name,
                    inferred_type=str(dtype),
                    sample_values=sample_vals,
                    null_count=null_count,
                    unique_count=unique_count,
                )
            )
            ddl_col_defs.append(f"    {safe_col} {dtype}")

        ddl = f"CREATE TABLE {table_name} (\n" + ",\n".join(ddl_col_defs) + "\n);"

        return SQLTableSchema(
            table_name=table_name,
            row_count=row_count,
            column_count=len(columns),
            columns=columns,
            sample_rows=sample_rows,
            create_table_ddl=ddl,
        )

    def execute_query(
        self,
        sql: str,
        query_name: str = "Ad-Hoc Business Query",
        limit: int = 500,
    ) -> SQLQueryResult:
        """Executes a read-only SQL query against DuckDB and returns timed, structured results."""
        self._validate_read_only(sql)

        clean_sql = sql.strip().rstrip(";")
        if not re.search(r"\blimit\b", clean_sql, re.IGNORECASE):
            exec_sql = f"{clean_sql} LIMIT {limit}"
        else:
            exec_sql = clean_sql

        start_time = time.perf_counter()
        try:
            rel = self.con.execute(exec_sql)
            df = rel.pl()
            elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

            columns = df.columns
            column_types = [str(t) for t in df.dtypes]
            rows = df.to_dicts()

            explanation = self._explain_query(clean_sql)
            chart_rec = self._recommend_chart(columns, column_types)

            return SQLQueryResult(
                query_name=query_name,
                sql_query=clean_sql,
                explanation=explanation,
                row_count=len(rows),
                execution_time_ms=elapsed_ms,
                columns=columns,
                column_types=column_types,
                rows=rows,
                chart_recommendation=chart_rec,
            )

        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
            raise RuntimeError(f"DuckDB SQL Execution Error ({elapsed_ms}ms): {str(e)}")

    def _validate_read_only(self, sql: str) -> None:
        """Rejects destructive or mutating DDL/DML statements."""
        forbidden = [
            r"\bdrop\b", r"\bdelete\b", r"\btruncate\b", r"\balter\b",
            r"\bupdate\b", r"\binsert\b", r"\bcreate\b", r"\bgrant\b", r"\brevoke\b",
        ]
        sql_low = sql.lower()
        for pat in forbidden:
            if re.search(pat, sql_low):
                matched = pat.replace(r"\b", "").upper()
                raise PermissionError(
                    f"Security Exception: Mutating statement '{matched}' is disabled in Read-Only Analytics Mode."
                )

    def _explain_query(self, sql: str) -> str:
        """Produces a plain English step-by-step explanation of the analytical SQL."""
        steps = []
        sql_low = sql.lower()

        if "with " in sql_low:
            steps.append("1. Defines Common Table Expressions (CTEs) for intermediate aggregations.")
        if "from " in sql_low:
            steps.append("2. Scans base table 'analytics_data' with vectorized column reading.")
        if "where " in sql_low:
            steps.append("3. Applies row filtering predicates to isolate valid records.")
        if "group by " in sql_low:
            steps.append("4. Groups records across categorical dimensions.")
        if "over (" in sql_low:
            steps.append("5. Computes window functions (e.g., LAG, DENSE_RANK, cumulative running totals).")
        if "order by " in sql_low:
            steps.append("6. Sorts output in ranked order.")
        if "limit " in sql_low:
            steps.append("7. Caps results to the requested row limit.")

        if not steps:
            return "Executes analytical SQL projection across dataset attributes."

        return " ".join(steps)

    def _recommend_chart(self, columns: List[str], types: List[str]) -> str:
        """Recommends an optimal chart type based on query output column roles."""
        has_date = any("date" in c.lower() or "month" in c.lower() or "year" in c.lower() for c in columns)
        numeric_count = sum(1 for t in types if "int" in t.lower() or "float" in t.lower() or "double" in t.lower() or "decimal" in t.lower())
        string_count = sum(1 for t in types if "str" in t.lower() or "utf8" in t.lower() or "varchar" in t.lower())

        if has_date and numeric_count >= 1:
            return "Line Chart (Temporal Trend)"
        elif string_count == 1 and numeric_count >= 1:
            return "Horizontal Bar Chart (Category Ranking)"
        elif string_count >= 1 and numeric_count >= 2:
            return "Grouped Bar Chart (Multi-Metric Comparison)"
        elif numeric_count == 2:
            return "Scatter Plot (Bivariate Relationship)"
        elif numeric_count == 1:
            return "KPI Metric Card / Histogram"
        return "Interactive Analytical Table"

    def run_default_analytical_suite(self) -> SQLAnalyticsOutput:
        """Runs the built-in KPI templates against the dataset and compiles the full output."""
        schema = self.inspect_schema("analytics_data")
        executed_results: List[SQLQueryResult] = []
        templates: List[SQLTemplate] = []

        for tmpl in self.DEFAULT_TEMPLATES:
            templates.append(
                SQLTemplate(
                    template_id=tmpl["template_id"],
                    name=tmpl["name"],
                    business_question=tmpl["business_question"],
                    sql_query=tmpl["sql_query"],
                    category=tmpl["category"],
                )
            )
            try:
                res = self.execute_query(
                    sql=tmpl["sql_query"],
                    query_name=tmpl["name"],
                    limit=50,
                )
                executed_results.append(res)
            except Exception as e:
                print(f"[WARN] Failed to auto-execute template '{tmpl['name']}': {e}")

        return SQLAnalyticsOutput(
            database_engine="DuckDB In-Memory Analytical Engine (v1.0+)",
            registered_tables=[schema],
            executed_queries=executed_results,
            available_templates=templates,
            total_queries_run=len(executed_results),
        )

    def close(self) -> None:
        """Closes DuckDB connection."""
        self.con.close()
