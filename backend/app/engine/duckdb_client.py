"""DuckDB Analytical Query Client.

Provides high-performance, in-memory zero-copy SQL querying against CSV, Parquet,
and tabular datasets without loading entire large files into Python heap memory.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional
import duckdb
import polars as pl

from app.agents.state import ColumnSchema, DatasetMetadata


class DuckDBClient:
    """Manages ephemeral and persistent DuckDB query sessions for raw/cleaned datasets."""

    def __init__(self, db_path: str = ":memory:"):
        self.db_path = db_path
        self._con: Optional[duckdb.DuckDBPyConnection] = None

    @property
    def connection(self) -> duckdb.DuckDBPyConnection:
        if self._con is None:
            self._con = duckdb.connect(database=self.db_path, read_only=False)
        return self._con

    def close(self) -> None:
        if self._con is not None:
            self._con.close()
            self._con = None

    def inspect_file(self, file_path: str, dataset_id: str) -> DatasetMetadata:
        """Inspects file schema, row count, and column nulls using DuckDB streaming inspection."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Dataset file not found: {file_path}")

        file_size = os.path.getsize(file_path)
        file_name = os.path.basename(file_path)
        con = self.connection

        # Read relation without pulling data into RAM
        if file_path.endswith(".parquet"):
            rel = con.read_parquet(file_path)
        elif file_path.endswith((".csv", ".tsv", ".txt")):
            rel = con.read_csv(file_path, auto_detect=True, header=True)
        else:
            raise ValueError(f"Unsupported file format for DuckDB inspection: {file_path}")

        row_count = rel.shape[0]
        col_names = rel.columns
        col_types = rel.dtypes

        # Retrieve quick sample (top 5 rows) to infer values
        sample_df = rel.limit(5).pl()

        columns: List[ColumnSchema] = []
        for name, dtype in zip(col_names, col_types):
            sample_vals = (
                sample_df[name].to_list() if name in sample_df.columns else []
            )
            # Count nulls efficiently via SQL
            safe_name = name.replace('"', '""')
            quoted_col = f'"{safe_name}"'
            null_count_query = f"SELECT count(*) - count({quoted_col}) FROM rel"
            null_count = con.execute(null_count_query).fetchone()[0]

            # Unique count approximation
            unique_query = f"SELECT approx_count_distinct({quoted_col}) FROM rel"
            unique_count = con.execute(unique_query).fetchone()[0]

            columns.append(
                ColumnSchema(
                    name=name,
                    inferred_type=str(dtype),
                    sample_values=sample_vals,
                    null_count=int(null_count),
                    unique_count=int(unique_count),
                )
            )

        return DatasetMetadata(
            dataset_id=dataset_id,
            file_name=file_name,
            file_path=file_path,
            file_size_bytes=file_size,
            row_count=row_count,
            column_count=len(columns),
            columns=columns,
        )

    def query_to_polars(self, sql_query: str, params: Optional[dict] = None) -> pl.DataFrame:
        """Executes a SQL query against registered tables/views and returns a Polars DataFrame."""
        con = self.connection
        if params:
            return con.execute(sql_query, params).pl()
        return con.execute(sql_query).pl()

    def get_preview(self, file_path: str, limit: int = 15) -> List[Dict[str, Any]]:
        """Returns the first N rows of a dataset as a list of dictionaries for frontend preview."""
        con = self.connection
        if file_path.endswith(".parquet"):
            rel = con.read_parquet(file_path)
        else:
            rel = con.read_csv(file_path, auto_detect=True)

        preview_pl = rel.limit(limit).pl()
        # Convert nulls and special types for clean JSON serialization
        return [
            {
                k: (None if v is None or str(v) == "null" else (v.isoformat() if hasattr(v, "isoformat") else v))
                for k, v in row.items()
            }
            for row in preview_pl.to_dicts()
        ]
