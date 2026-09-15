import {
  AgentState,
  DatasetMetadata,
  CleaningQualityScorecard,
  AuditRuleLog,
  SQLQueryResult,
  SQLTableSchema,
  SQLTemplate,
  RenderedChart,
} from "./types";

import { API_BASE } from "./config";

export interface HealthCheckResult {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  environment: string;
  agents_ready: string[];
}

export interface RecommendedQuestion {
  title: string;
  desc: string;
  prompt: string;
}

export interface UploadDatasetResult {
  dataset_id: string;
  metadata: DatasetMetadata;
  preview_rows: Record<string, unknown>[];
  message: string;
  recommended_questions?: RecommendedQuestion[];
}

export interface CleanDatasetResult {
  dataset_id: string;
  cleaned: {
    cleaned_file_path: string;
    scorecard: CleaningQualityScorecard;
    audit_trail: AuditRuleLog[];
    transformation_code?: string;
  };
  preview_rows: Record<string, unknown>[];
  message: string;
}

export interface DatasetPreviewResult {
  dataset_id: string;
  raw_preview: Record<string, unknown>[];
  clean_preview: Record<string, unknown>[];
  transformed_preview?: Record<string, unknown>[];
  has_cleaned: boolean;
  has_transformed?: boolean;
}

export interface RunPipelineResult {
  session_id: string;
  dataset_id: string;
  status: string;
  message: string;
}

export interface ExecuteSQLParams {
  dataset_id: string;
  sql_query: string;
  query_name?: string;
}

export interface CustomChartParams {
  dataset_id: string;
  chart_type: string;
  x_col: string;
  y_col?: string;
  hue_col?: string;
  title?: string;
}

export const api = {
  /**
   * Health check query to backend service.
   */
  async getHealth(): Promise<HealthCheckResult> {
    const res = await fetch(`${API_BASE}/api/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Health check failed: ${res.statusText}`);
    }
    return res.json();
  },

  /**
   * Upload a raw dataset (CSV, XLSX, Parquet) for multi-agent ingestion.
   */
  async uploadDataset(file: File): Promise<UploadDatasetResult> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/api/datasets/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Failed to upload dataset");
    }

    return res.json();
  },

  /**
   * Load the built-in sample business dataset for instant demonstration.
   */
  async loadSampleDataset(): Promise<UploadDatasetResult> {
    const res = await fetch(`${API_BASE}/api/datasets/sample`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Failed to load sample dataset");
    }

    return res.json();
  },

  /**
   * Fetch dataset metadata and dynamic recommended questions by dataset ID.
   */
  async getDatasetMetadata(datasetId: string): Promise<UploadDatasetResult> {
    const res = await fetch(`${API_BASE}/api/datasets/${datasetId}/metadata`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Failed to fetch dataset metadata");
    }

    return res.json();
  },

  /**
   * Execute Agent 1: Data Wrangling & Quality on a dataset.
   */
  async cleanDataset(datasetId: string): Promise<CleanDatasetResult> {
    const res = await fetch(`${API_BASE}/api/datasets/${datasetId}/clean`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Failed to clean dataset");
    }

    return res.json();
  },

  /**
   * Fetch raw, cleaned, and transformed dataset rows for preview comparison.
   */
  async getDatasetPreview(datasetId: string): Promise<DatasetPreviewResult> {
    const res = await fetch(`${API_BASE}/api/datasets/${datasetId}/preview`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch preview: ${res.statusText}`);
    }

    return res.json();
  },

  /**
   * Get direct URL to download cleaned dataset.
   */
  getDownloadUrl(datasetId: string): string {
    return `${API_BASE}/api/datasets/${datasetId}/download`;
  },

  /**
   * Get direct URL to download transformed dataset.
   */
  getTransformedDownloadUrl(datasetId: string): string {
    return `${API_BASE}/api/datasets/${datasetId}/download-transformed`;
  },

  /**
   * Get direct URL to download Power BI (.pbip + TMDL) project bundle zip.
   */
  getPbipDownloadUrl(sessionId: string): string {
    return `${API_BASE}/api/export/${sessionId}/pbip`;
  },

  /**
   * Get direct URL to download Matplotlib/Seaborn visualization bundle zip.
   */
  getVisualizationBundleUrl(sessionId: string): string {
    return `${API_BASE}/api/visualize/download-bundle/${sessionId}`;
  },

  /**
   * Get direct URL to inspect DAX catalog.
   */
  getDaxExportUrl(sessionId: string): string {
    return `${API_BASE}/api/export/${sessionId}/dax`;
  },

  /**
   * Fetch DAX catalog and Star Schema specification for a session.
   */
  async getDaxCatalog(sessionId: string) {
    const res = await fetch(`${API_BASE}/api/export/${sessionId}/dax`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch DAX catalog: ${res.statusText}`);
    }
    return res.json();
  },

  /**
   * Execute an interactive DuckDB analytical SQL query.
   */
  async executeSQL(params: ExecuteSQLParams): Promise<SQLQueryResult> {
    const res = await fetch(`${API_BASE}/api/sql/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Failed to execute SQL query");
    }
    return res.json();
  },

  /**
   * Fetch pre-configured business SQL query templates.
   */
  async getSQLTemplates(): Promise<SQLTemplate[]> {
    const res = await fetch(`${API_BASE}/api/sql/templates`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch SQL templates: ${res.statusText}`);
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data.templates)) {
      return data.templates;
    }
    return [];
  },

  /**
   * Fetch SQL table schema and sample rows.
   */
  async getSQLSchema(datasetId: string): Promise<SQLTableSchema> {
    const res = await fetch(`${API_BASE}/api/sql/schema/${datasetId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Failed to fetch SQL schema");
    }
    return res.json();
  },

  /**
   * Generate an on-demand custom Matplotlib / Seaborn visualization.
   */
  async generateCustomChart(params: CustomChartParams): Promise<RenderedChart> {
    const res = await fetch(`${API_BASE}/api/visualize/custom`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Failed to render custom visualization");
    }
    return res.json();
  },

  /**
   * Start the multi-agent pipeline with user business prompt and optional target metric.
   */
  async startPipeline(
    datasetId: string,
    businessPrompt = "",
    targetMetric = ""
  ): Promise<AgentState> {
    const res = await fetch(`${API_BASE}/api/pipeline/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataset_id: datasetId,
        business_prompt: businessPrompt,
        target_metric: targetMetric,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Failed to trigger pipeline");
    }

    return res.json();
  },

  /**
   * Poll execution status of the pipeline session.
   */
  async getPipelineStatus(sessionId: string): Promise<Partial<AgentState>> {
    const res = await fetch(`${API_BASE}/api/pipeline/status/${sessionId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch status: ${res.statusText}`);
    }

    return res.json();
  },
};
