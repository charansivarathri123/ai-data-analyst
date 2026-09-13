# Autonomous AI Data Analyst & BI Studio

An autonomous, multi-agent analytics platform that automates the end-to-end workflow of a senior data analyst. Users ingest raw tabular datasets (CSV, Excel, Parquet) with an optional business prompt, and a coordinated squad of AI agents cleans the data, runs exploratory data analysis (EDA), identifies root-cause drivers, and exports a production-ready Power BI reporting package (`.pbip` / TMDL) alongside executive insights.

---

## Architecture Overview

```text
[User Ingestion: Dataset + Business Prompt]
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Agent 1: Data Wrangling      │ ──► Schema casting, null imputation, audit scorecard
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Agent 2: EDA & Features      │ ──► Statistical aggregates, correlations, anomalies
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Agent 3: Root-Cause Engine   │ ──► Key driver rankings, cohort diffs, executive narrative
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Agent 4: Power BI Architect  │ ──► Star Schema, DAX formulas, TMDL & PBIP bundle
   └──────────────────────────────┘
```

---

## Monorepo Layout

```
├── frontend/             # Next.js 15 (App Router), React 19, Tailwind CSS, Lucide icons
│   ├── app/              # Routes: Landing Page ('/') & Studio Dashboard ('/dashboard')
│   ├── components/       # UI components & visual cards
│   └── lib/              # Typed API client, SSE streaming hooks, data contracts
│
├── backend/              # Python 3.12+ with FastAPI, DuckDB, Polars, and LangGraph
│   ├── app/
│   │   ├── agents/       # Multi-agent state machine (AgentState, Cleaner, EDA, Diagnostic, PowerBI)
│   │   ├── api/          # FastAPI routers (/health, /datasets, /pipeline, /export)
│   │   ├── engine/       # DuckDB analytical query layer and code sandboxing
│   │   └── main.py       # FastAPI application entry point
│   └── requirements.txt  # Python backend dependencies
│
├── templates/            # Base TMDL & PBIP templates for Power BI Desktop generation
│   ├── pbip/             # Base Power BI Project (.pbip) schema definitions
│   └── tmdl/             # Tabular Model Definition Language base templates
│
├── .env.example          # Environment variables template
└── README.md
```

---

## Getting Started

### Prerequisites
- **Node.js**: `v20+` or `v24+`
- **Python**: `3.11+` / `3.12+` / `3.13+`

### 1. Backend Setup

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```
Verify the API: [http://localhost:8000/api/health](http://localhost:8000/api/health)

### 2. Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```
Open the application: [http://localhost:3000](http://localhost:3000)

---

## Design System
- **Theme**: "Executive Technical" with dual-spectrum ambient aura (warm lime-gold `#D3D05B` and digital violet `#816EBD`).
- **Surfaces**: Canvas `#FAFAFC`, dark capsule accents `#050405`, glassmorphic cards (`backdrop-blur`).
- **Typography**: Authority grotesque sans paired with editorial italic serif accents.
