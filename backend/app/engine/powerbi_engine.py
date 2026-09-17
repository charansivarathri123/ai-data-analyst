"""Power BI Architect Engine.

Constructs Star Schema models, authors syntactically verified DAX formulas,
and programmatically builds exportable Microsoft Power BI Desktop project bundles (.pbip + TMDL).
"""

from __future__ import annotations

import json
import os
import shutil
import zipfile
from typing import Any, Dict, List, Optional
import polars as pl

from app.agents.state import (
    DAXMeasure,
    PowerBIArchitectOutput,
    StarSchemaDimension,
    StarSchemaLayout,
    StarSchemaRelationship,
    VisualSpecification,
)


class PowerBIEngine:
    """Automates semantic data modeling, DAX calculation authoring, and PBIP bundle generation."""

    def __init__(self, clean_file_path: str, export_dir: str = "./data/exports"):
        self.clean_file_path = clean_file_path
        self.export_dir = export_dir
        os.makedirs(self.export_dir, exist_ok=True)

    def load_df(self) -> pl.DataFrame:
        if self.clean_file_path.endswith(".parquet"):
            return pl.read_parquet(self.clean_file_path)
        return pl.read_csv(self.clean_file_path, try_parse_dates=True)

    def build_deliverables(
        self,
        dataset_id: str,
        target_metric: Optional[str] = None,
        top_drivers: Optional[List[str]] = None,
        brief: Optional[Dict[str, Any]] = None,
    ) -> PowerBIArchitectOutput:
        """Constructs Star Schema, authors DAX measures, and builds the downloadable PBIP bundle."""
        df = self.load_df()

        effective_target = (brief.get("target_metric") if brief else None) or target_metric
        if not effective_target or effective_target not in df.columns:
            pop_cols = [c for c in df.columns if "pop" in c.lower() and "pct" not in c.lower() and "growth" not in c.lower()]
            if pop_cols:
                effective_target = sorted(pop_cols, reverse=True)[0]
            else:
                num_cols = [c for c in df.columns if df[c].dtype in (pl.Float32, pl.Float64, pl.Int32, pl.Int64) and "id" not in c.lower() and "rank" not in c.lower()]
                effective_target = num_cols[0] if num_cols else df.columns[0]

        key_dims = (brief.get("key_dimensions") if brief else None) or []

        # 1. Separate Fact and Dimensions for Star Schema
        star_schema = self._build_star_schema(df)

        # 2. Author Syntactically Verified DAX Measures
        dax_catalog = self._author_dax_measures(df, effective_target, brief)

        # 3. Formulate Visual Specifications
        visual_specs = self._formulate_visual_specs(star_schema, dax_catalog, top_drivers or [])

        # 4. Programmatically Build the PBIP & TMDL Bundle on Disk
        pbip_zip_path = self._generate_pbip_project_bundle(
            dataset_id=dataset_id,
            star_schema=star_schema,
            dax_catalog=dax_catalog,
            visual_specs=visual_specs,
        )

        return PowerBIArchitectOutput(
            star_schema=star_schema,
            dax_catalog=dax_catalog,
            visual_layout=visual_specs,
            tmdl_manifest_path=os.path.join(self.export_dir, dataset_id, f"{dataset_id}.Dataset", "model.tmdl"),
            pbip_bundle_path=os.path.abspath(pbip_zip_path),
        )

    def _build_star_schema(self, df: pl.DataFrame) -> StarSchemaLayout:
        """Separates tabular features into Fact table and Normalized Dimensions with relationships."""
        dimensions: List[StarSchemaDimension] = []
        relationships: List[StarSchemaRelationship] = []

        # Detect date column for Calendar Dimension
        date_cols = [c for c in df.columns if df[c].dtype in (pl.Date, pl.Datetime) or "date" in c.lower()]
        if date_cols:
            primary_date = date_cols[0]
            dimensions.append(
                StarSchemaDimension(
                    table_name="DimDate",
                    key_column="Date",
                    attributes=["Date", "Year", "Quarter", "Month", "MonthName", "DayOfWeek"],
                )
            )
            relationships.append(
                StarSchemaRelationship(
                    from_table="FactData",
                    from_column=primary_date,
                    to_table="DimDate",
                    to_column="Date",
                    cardinality="*:1",
                )
            )

        # Detect Categorical Columns for Dimensions
        cat_cols = [
            c for c in df.columns
            if df[c].dtype in (pl.String, pl.Utf8) and "id" not in c.lower()
        ]

        for cat in cat_cols:
            clean_col = cat.replace("/", "_").replace(" ", "_")
            dim_table_name = "Dim" + "".join(part.capitalize() for part in clean_col.split("_"))
            dimensions.append(
                StarSchemaDimension(
                    table_name=dim_table_name,
                    key_column=cat,
                    attributes=[cat],
                )
            )
            relationships.append(
                StarSchemaRelationship(
                    from_table="FactData",
                    from_column=cat,
                    to_table=dim_table_name,
                    to_column=cat,
                    cardinality="*:1",
                )
            )

        return StarSchemaLayout(
            fact_table_name="FactData",
            dimensions=dimensions,
            relationships=relationships,
        )

    def _author_dax_measures(self, df: pl.DataFrame, target: str, brief: Optional[Dict[str, Any]] = None) -> List[DAXMeasure]:
        """Synthesizes syntactically verified DAX calculations mapped to fact columns."""
        effective_brief = brief or {}
        domain = effective_brief.get("dataset_domain", "")
        is_demographic = domain == "demographics" or any("population" in c.lower() for c in df.columns)
        measures: List[DAXMeasure] = []

        if is_demographic:
            target_title = target.replace("_", " ").title()
            measures.append(
                DAXMeasure(
                    name=f"Total {target_title}",
                    dax_expression=f"SUM(FactData[{target}])",
                    description=f"Calculates total aggregated {target_title}.",
                    category="KPI",
                    display_folder="Core Demographics",
                    format_string="#,##0",
                )
            )
            proj_col = next((c for c in df.columns if "projected" in c.lower() and "growth" not in c.lower()), None)
            if proj_col:
                proj_title = proj_col.replace("_", " ").title()
                measures.append(
                    DAXMeasure(
                        name=f"Total {proj_title}",
                        dax_expression=f"SUM(FactData[{proj_col}])",
                        description=f"Extrapolated forward projection {proj_title}.",
                        category="KPI",
                        display_folder="Projections",
                        format_string="#,##0",
                    )
                )

            measures.append(
                DAXMeasure(
                    name="Total Jurisdictions",
                    dax_expression="COUNTROWS(FactData)",
                    description="Total number of nations, states, and geographic territories.",
                    category="KPI",
                    display_folder="Core Demographics",
                    format_string="#,##0",
                )
            )

            rate_col = next((c for c in df.columns if "growth" in c.lower() or "cagr" in c.lower()), None)
            if rate_col:
                measures.append(
                    DAXMeasure(
                        name="Average Growth Velocity",
                        dax_expression=f"AVERAGE(FactData[{rate_col}])",
                        description="Mean annual growth velocity across jurisdictions.",
                        category="KPI",
                        display_folder="Growth & Dynamics",
                        format_string="0.00%",
                    )
                )

            return measures

        # For E-commerce / General
        unit_sym = effective_brief.get("unit_symbol") or ("$" if domain == "ecommerce" else "")
        fmt = f"{unit_sym}#,##0.00" if unit_sym else "#,##0.00"
        target_title = "".join(part.capitalize() for part in target.split("_"))
        measures.append(
            DAXMeasure(
                name=f"Total {target_title}",
                dax_expression=f"SUM(FactData[{target}])",
                description=f"Calculates total aggregated {target_title}.",
                category="KPI",
                display_folder="Core Metrics",
                format_string=fmt,
            )
        )

        # Transaction Count Measure
        measures.append(
            DAXMeasure(
                name="Total Transactions",
                dax_expression="COUNTROWS(FactData)",
                description="Total number of transaction records processed.",
                category="KPI",
                display_folder="Core Metrics",
                format_string="#,##0",
            )
        )

        # Additional Numeric Columns (e.g. units_sold)
        num_cols = [
            c for c in df.columns
            if c != target and df[c].dtype in (pl.Float32, pl.Float64, pl.Int32, pl.Int64, pl.UInt32, pl.UInt64)
            and "year" not in c and "month" not in c and "quarter" not in c and "id" not in c.lower()
        ]

        for num in num_cols:
            num_title = "".join(part.capitalize() for part in num.split("_"))
            measures.append(
                DAXMeasure(
                    name=f"Total {num_title}",
                    dax_expression=f"SUM(FactData[{num}])",
                    description=f"Sum of {num_title}.",
                    category="KPI",
                    display_folder="Core Metrics",
                    format_string="#,##0",
                )
            )

        # Time Intelligence: Prior Year / Growth
        has_date = any("date" in c.lower() for c in df.columns)
        if has_date:
            measures.append(
                DAXMeasure(
                    name=f"{target_title} LY",
                    dax_expression=f"CALCULATE([Total {target_title}], SAMEPERIODLASTYEAR('DimDate'[Date]))",
                    description=f"Total {target_title} for the corresponding prior year period.",
                    category="Growth_MoM_YoY",
                    display_folder="Time Intelligence",
                    format_string=fmt,
                )
            )

            measures.append(
                DAXMeasure(
                    name=f"YoY {target_title} Growth %",
                    dax_expression=f"DIVIDE([Total {target_title}] - [{target_title} LY], [{target_title} LY])",
                    description="Year-over-Year growth percentage.",
                    category="Growth_MoM_YoY",
                    display_folder="Time Intelligence",
                    format_string="0.0%",
                )
            )

        # Performance Ratios
        measures.append(
            DAXMeasure(
                name="Average Transaction Value",
                dax_expression=f"DIVIDE([Total {target_title}], [Total Transactions])",
                description=f"Average {target_title} generated per transaction record.",
                category="Ratio",
                display_folder="Performance Ratios",
                format_string="$#,##0.00",
            )
        )

        return measures

    def _formulate_visual_specs(
        self,
        schema: StarSchemaLayout,
        measures: List[DAXMeasure],
        top_drivers: List[str],
    ) -> List[VisualSpecification]:
        """Maps generated measures and dimensions into standard dashboard layout specifications."""
        kpi_names = [m.name for m in measures if m.category == "KPI"]
        yoy_names = [m.name for m in measures if m.category == "Growth_MoM_YoY"]

        specs: List[VisualSpecification] = []

        # 1. Executive KPI Summary Cards
        if kpi_names:
            specs.append(
                VisualSpecification(
                    visual_type="card",
                    title="Executive KPI Headline",
                    assigned_measures=[kpi_names[0]],
                    assigned_dimensions=[],
                    filters=[],
                )
            )

        # 2. Time-series Monthly Trend
        has_dim_date = any(d.table_name == "DimDate" for d in schema.dimensions)
        if has_dim_date and kpi_names:
            specs.append(
                VisualSpecification(
                    visual_type="line_chart",
                    title="Monthly Performance Trend",
                    assigned_measures=[kpi_names[0]] + yoy_names[:1],
                    assigned_dimensions=["DimDate[Month]"],
                    filters=[],
                )
            )

        # 3. Categorical Segment Bar Chart
        cat_dims = [d for d in schema.dimensions if d.table_name != "DimDate"]
        if cat_dims and kpi_names:
            dim_col = f"{cat_dims[0].table_name}[{cat_dims[0].key_column}]"
            specs.append(
                VisualSpecification(
                    visual_type="bar_chart",
                    title=f"Performance by {cat_dims[0].key_column.replace('_', ' ').title()}",
                    assigned_measures=[kpi_names[0]],
                    assigned_dimensions=[dim_col],
                    filters=[],
                )
            )

        # 4. Second Dimension Donut / Breakdown Chart
        if len(cat_dims) > 1 and len(kpi_names) > 1:
            dim_col2 = f"{cat_dims[1].table_name}[{cat_dims[1].key_column}]"
            specs.append(
                VisualSpecification(
                    visual_type="donut",
                    title=f"Distribution by {cat_dims[1].key_column.replace('_', ' ').title()}",
                    assigned_measures=[kpi_names[1]],
                    assigned_dimensions=[dim_col2],
                    filters=[],
                )
            )

        # 5. Cross-tabulated Matrix Overview
        if cat_dims and kpi_names:
            specs.append(
                VisualSpecification(
                    visual_type="matrix",
                    title="Segment Performance Matrix",
                    assigned_measures=[kpi_names[0]] + yoy_names[:1],
                    assigned_dimensions=[f"{d.table_name}[{d.key_column}]" for d in cat_dims[:2]],
                    filters=[],
                )
            )

        return specs

    def _generate_pbip_project_bundle(
        self,
        dataset_id: str,
        star_schema: StarSchemaLayout,
        dax_catalog: List[DAXMeasure],
        visual_specs: List[VisualSpecification],
    ) -> str:
        """Assembles native Power BI Project folder structure (.pbip + TMDL) and zips it."""
        project_name = f"{dataset_id}_PowerBI_Project"
        project_root = os.path.join(self.export_dir, project_name)

        if os.path.exists(project_root):
            shutil.rmtree(project_root)

        # Create PBIP directory hierarchy
        report_dir = os.path.join(project_root, f"{project_name}.Report")
        dataset_dir = os.path.join(project_root, f"{project_name}.Dataset")
        tables_dir = os.path.join(dataset_dir, "tables")

        os.makedirs(report_dir, exist_ok=True)
        os.makedirs(tables_dir, exist_ok=True)

        # 1. Root .pbip manifest
        pbip_manifest = {
            "version": "1.0",
            "artifacts": [
                {"report": {"path": f"{project_name}.Report"}},
                {"dataset": {"path": f"{project_name}.Dataset"}},
            ],
            "settings": {"enableAutoRecovery": True},
        }
        with open(os.path.join(project_root, f"{project_name}.pbip"), "w", encoding="utf-8") as f:
            json.dump(pbip_manifest, f, indent=2)

        # 2. Report definition (.pbir + report.json)
        pbir_content = {
            "version": "1.0",
            "datasetReference": {
                "byPath": {"path": f"../{project_name}.Dataset"},
                "byConnection": None,
            },
        }
        with open(os.path.join(report_dir, "definition.pbir"), "w", encoding="utf-8") as f:
            json.dump(pbir_content, f, indent=2)

        # Copy report.json template if exists or write custom visual layout
        report_layout = {
            "config": "{\"version\":\"5.53\",\"themeCollection\":{\"baseTheme\":{\"name\":\"ExecutiveTechnical\",\"version\":\"1.0\",\"type\":2}}}",
            "layoutOptimization": 0,
            "sections": [
                {
                    "name": "ExecutiveOverview",
                    "displayName": "Executive Overview & Insights",
                    "ordinal": 0,
                    "visualContainers": [
                        {
                            "x": 20,
                            "y": 20,
                            "width": 380,
                            "height": 180,
                            "config": json.dumps({
                                "title": spec.title,
                                "type": spec.visual_type,
                                "measures": spec.assigned_measures,
                                "dimensions": spec.assigned_dimensions,
                            }),
                        }
                        for spec in visual_specs
                    ],
                }
            ],
        }
        with open(os.path.join(report_dir, "report.json"), "w", encoding="utf-8") as f:
            json.dump(report_layout, f, indent=2)

        # 3. Dataset definition (definition.pbidataset)
        pbidataset_content = {
            "version": "1.0",
            "settings": {"compatibilityLevel": 1567},
        }
        with open(os.path.join(dataset_dir, "definition.pbidataset"), "w", encoding="utf-8") as f:
            json.dump(pbidataset_content, f, indent=2)

        # 4. Master TMDL Model file (model.tmdl)
        model_tmdl_lines = [
            "model Model",
            "\tcompatibilityLevel: 1567",
            "\tculture: en-US",
            "\tdefaultPowerBIDataSourceVersion: powerBI_V3",
            "",
            "annotation PBIDesktopVersion = 2.138.1004.0 (24.11)",
            "annotation PBI_QueryOrder = [\"FactData\"]",
            "",
            "ref table FactData",
        ]
        for dim in star_schema.dimensions:
            model_tmdl_lines.append(f"ref table {dim.table_name}")

        with open(os.path.join(dataset_dir, "model.tmdl"), "w", encoding="utf-8") as f:
            f.write("\n".join(model_tmdl_lines) + "\n")

        # 5. Fact Table TMDL (tables/FactData.tmdl) with DAX measures
        fact_tmdl_lines = [
            "table FactData",
            "\tlineageTag: fact-data-001",
            "",
        ]

        # Inject DAX Measures into Fact Table
        for m in dax_catalog:
            fact_tmdl_lines.extend([
                f"\tmeasure '{m.name}' = {m.dax_expression}",
                f"\t\tformatString: {m.format_string or '#,##0.00'}",
                f"\t\tdisplayFolder: {m.display_folder or 'Measures'}",
                f"\t\tdescription: \"{m.description}\"",
                f"\t\tlineageTag: measure-{m.name.lower().replace(' ', '-')}",
                "",
            ])

        with open(os.path.join(tables_dir, "FactData.tmdl"), "w", encoding="utf-8") as f:
            f.write("\n".join(fact_tmdl_lines))

        # 6. Dimension Tables TMDL
        for dim in star_schema.dimensions:
            dim_lines = [
                f"table {dim.table_name}",
                f"\tlineageTag: {dim.table_name.lower()}-001",
                "",
            ]
            for attr in dim.attributes:
                dim_lines.extend([
                    f"\tcolumn {attr}",
                    "\t\tdataType: string",
                    "\t\tsummarizeBy: none",
                    "",
                ])
            with open(os.path.join(tables_dir, f"{dim.table_name}.tmdl"), "w", encoding="utf-8") as f:
                f.write("\n".join(dim_lines))

        # 7. Zip the entire PBIP project bundle
        zip_output_path = os.path.join(self.export_dir, f"{project_name}.zip")
        with zipfile.ZipFile(zip_output_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(project_root):
                for file in files:
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, project_root)
                    zipf.write(full_path, arcname=rel_path)

        return zip_output_path
