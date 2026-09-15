"use client";

import { useState, DragEvent } from "react";
import { motion } from "motion/react";
import { Upload, Sparkles, Database } from "lucide-react";
import { DatasetMetadata } from "@/lib/types";

interface DropzoneProps {
  datasetMeta: DatasetMetadata | null;
  isLoading: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLoadDemo: () => void;
}

export function Dropzone({ datasetMeta, isLoading, onFileChange, onLoadDemo }: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Synthesize event
      const input = document.getElementById("dataset-file-input") as HTMLInputElement | null;
      if (input) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(e.dataTransfer.files[0]);
        input.files = dataTransfer.files;
        const changeEvent = new Event("change", { bubbles: true });
        input.dispatchEvent(changeEvent);
      }
    }
  };

  return (
    <div className="bg-surface-1 rounded-2xl p-6 border border-b-subtle shadow-xl flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-t-primary flex items-center gap-2">
            <Database className="h-4 w-4 text-accent-warm" />
            <span>Dataset Ingestion</span>
          </h2>
          <button
            type="button"
            onClick={onLoadDemo}
            disabled={isLoading}
            className="px-2.5 py-1.5 rounded-lg border border-b-subtle bg-surface-2 hover:bg-surface-3 hover:border-b-hover text-t-secondary hover:text-t-primary text-caption font-medium transition-colors flex items-center gap-1.5 disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent-warm" />
            <span>Load Demo</span>
          </button>
        </div>
        <p className="text-caption text-t-secondary mb-4">
          CSV, XLSX, or Parquet up to 100 MB. In-memory DuckDB &amp; Polars processing.
        </p>

        <motion.label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          animate={{
            scale: isDragOver ? 1.025 : 1,
            y: isDragOver ? -4 : 0,
          }}
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          className={`relative rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer text-center group border-2 border-dashed transition-all ${
            isDragOver
              ? "gradient-border-fast bg-surface-2 shadow-elevated border-accent-warm"
              : "gradient-border-slow bg-canvas border-b-subtle hover:border-b-hover"
          }`}
        >
          <motion.div
            animate={isDragOver ? { y: [-6, 0, -4, 0], scale: [1, 1.15, 1] } : { y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 450, damping: 14 }}
            className="mb-2"
          >
            <Upload className={`h-6 w-6 transition-colors ${isDragOver ? "text-accent-warm" : "text-t-secondary group-hover:text-t-primary"}`} />
          </motion.div>
          <span className="text-caption font-semibold text-t-primary">
            {datasetMeta ? datasetMeta.file_name : "Choose dataset or drag & drop"}
          </span>
          <span className="text-micro text-t-secondary mt-1 font-mono">
            {datasetMeta
              ? `${datasetMeta.row_count.toLocaleString()} rows • ${datasetMeta.column_count} columns`
              : "CSV / Excel (.xlsx) / Parquet supported"}
          </span>
          <input
            id="dataset-file-input"
            type="file"
            accept=".csv,.xlsx,.xls,.parquet"
            className="hidden"
            onChange={onFileChange}
            disabled={isLoading}
          />
        </motion.label>
      </div>

      {datasetMeta && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3.5 rounded-xl bg-surface-2 border border-b-subtle text-caption"
        >
          <div className="flex items-center justify-between mb-1.5 font-medium">
            <span className="font-mono text-t-primary truncate font-bold text-caption">{datasetMeta.file_name}</span>
            <span className="text-accent-cool font-mono text-micro font-semibold flex items-center gap-1">
              ✓ Ingested
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-micro text-t-secondary font-mono">
            <div>Rows: <strong className="text-t-primary font-bold">{datasetMeta.row_count.toLocaleString()}</strong></div>
            <div>Cols: <strong className="text-t-primary font-bold">{datasetMeta.column_count}</strong></div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default Dropzone;
