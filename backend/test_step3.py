"""Step 3 Automated Verification Suite.

Tests EDA Engine, Diagnostic Engine, Agent 2, Agent 3, and Pipeline orchestration.
"""

from fastapi.testclient import TestClient
from app.main import app
from app.engine.eda_engine import EDAEngine
from app.engine.diagnostic_engine import DiagnosticEngine
from app.api.datasets import _get_paths
import os

def test_step3_full_flow():
    client = TestClient(app)

    # 1. Verify Cleaned File Exists
    paths = _get_paths()
    clean_file = os.path.join(paths["cleaned"], "sample_business_sales_cleaned.csv")
    if not os.path.exists(clean_file):
        # Trigger clean first
        client.post("/api/datasets/sample_business_sales/clean")

    # 2. Test EDA Engine Directly
    eda = EDAEngine(clean_file)
    _, eda_out = eda.analyze()
    assert len(eda_out.numeric_summaries) >= 3
    assert len(eda_out.correlations) >= 2
    assert len(eda_out.derived_time_features) >= 4  # year, quarter, month, dow
    print(f"[PASS] EDA Engine: {len(eda_out.numeric_summaries)} numeric features, {len(eda_out.correlations)} correlations, {len(eda_out.derived_time_features)} calendar features")

    # 3. Test Diagnostic Engine Directly
    diag = DiagnosticEngine(clean_file)
    diag_out = diag.diagnose(target_metric="gross_revenue", business_prompt="Analyze revenue drivers")
    assert diag_out.target_metric == "gross_revenue"
    assert len(diag_out.drivers) > 0
    assert len(diag_out.cohorts) > 0
    assert len(diag_out.narrative.recommended_interventions) >= 2
    print(f"[PASS] Diagnostic Engine: Target={diag_out.target_metric}, Top Driver={diag_out.drivers[0].feature} ({diag_out.drivers[0].importance_score}%), Cohorts={len(diag_out.cohorts)}")

    # 4. Test Sequential Multi-Agent Pipeline API (Agent 1 -> Agent 2 -> Agent 3)
    payload = {
        "dataset_id": "sample_business_sales",
        "business_prompt": "Why did gross revenue change across customer segments?",
        "target_metric": "gross_revenue",
    }
    resp = client.post("/api/pipeline/run", json=payload)
    assert resp.status_code == 200
    state = resp.json()

    assert state["status"] == "completed"
    assert "cleaning" in state and state["cleaning"] is not None
    assert "eda" in state and state["eda"] is not None
    assert "root_cause" in state and state["root_cause"] is not None
    assert len(state["step_history"]) >= 6  # 2 logs per agent
    session_id = state["session_id"]
    print(f"[PASS] Sequential Pipeline: session_id={session_id}, total steps logged={len(state['step_history'])}")

    # 5. Test Pipeline Session Status Query
    status_resp = client.get(f"/api/pipeline/status/{session_id}")
    assert status_resp.status_code == 200
    saved_state = status_resp.json()
    assert saved_state["session_id"] == session_id
    assert saved_state["target_metric"] == "gross_revenue"
    print(f"[PASS] Pipeline Status retrieved successfully for {session_id}")

    print("\n[SUCCESS] ALL STEP 3 AUTOMATED TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_step3_full_flow()
