"""Step 4 Automated Verification Suite.

Tests Power BI Engine, Agent 4, full 4-agent sequential pipeline, and export endpoints.
"""

from fastapi.testclient import TestClient
from app.main import app
from app.engine.powerbi_engine import PowerBIEngine
from app.api.datasets import _get_paths
import os
import zipfile

def test_step4_full_flow():
    client = TestClient(app)
    paths = _get_paths()

    # 1. Direct Engine Test
    clean_file = os.path.join(paths["cleaned"], "sample_business_sales_cleaned.csv")
    if not os.path.exists(clean_file):
        client.post("/api/datasets/sample_business_sales/clean")

    pbi_engine = PowerBIEngine(clean_file_path=clean_file, export_dir=paths["exports"])
    deliverables = pbi_engine.build_deliverables(
        dataset_id="test_sales_pbi",
        target_metric="gross_revenue",
        top_drivers=["units_sold", "customer_segment"],
    )

    assert len(deliverables.star_schema.dimensions) >= 2
    assert len(deliverables.dax_catalog) >= 4
    assert len(deliverables.visual_layout) >= 3
    assert deliverables.pbip_bundle_path is not None
    assert os.path.exists(deliverables.pbip_bundle_path)
    assert zipfile.is_zipfile(deliverables.pbip_bundle_path)
    print(f"[PASS] PowerBIEngine: Star Schema dims={len(deliverables.star_schema.dimensions)}, DAX measures={len(deliverables.dax_catalog)}, Visual specs={len(deliverables.visual_layout)}, ZIP={os.path.basename(deliverables.pbip_bundle_path)}")

    # 2. Full 4-Agent Pipeline Execution (Agent 1 -> Agent 2 -> Agent 3 -> Agent 4)
    payload = {
        "dataset_id": "sample_business_sales",
        "business_prompt": "Produce executive reporting package and diagnose revenue variance.",
        "target_metric": "gross_revenue",
    }
    resp = client.post("/api/pipeline/run", json=payload)
    assert resp.status_code == 200
    state = resp.json()

    assert state["status"] == "completed"
    assert "cleaning" in state and state["cleaning"] is not None
    assert "eda" in state and state["eda"] is not None
    assert "root_cause" in state and state["root_cause"] is not None
    assert "powerbi" in state and state["powerbi"] is not None
    assert len(state["step_history"]) >= 8  # 2 logs per agent * 4 agents
    session_id = state["session_id"]
    print(f"[PASS] Full 4-Agent Pipeline Run: session_id={session_id}, total steps={len(state['step_history'])}")

    # 3. Test Export Endpoint: PBIP Bundle Download
    dl_resp = client.get(f"/api/export/{session_id}/pbip")
    assert dl_resp.status_code == 200
    assert len(dl_resp.content) > 1000  # Non-trivial zip file
    print(f"[PASS] Export PBIP: Downloaded valid zip archive of size {len(dl_resp.content)} bytes")

    # 4. Test Export Endpoint: DAX Catalog
    dax_resp = client.get(f"/api/export/{session_id}/dax")
    assert dax_resp.status_code == 200
    dax_data = dax_resp.json()
    assert len(dax_data["dax_catalog"]) >= 4
    print(f"[PASS] Export DAX: Retrieved {len(dax_data['dax_catalog'])} DAX formulas successfully")

    print("\n[SUCCESS] ALL STEP 4 AUTOMATED TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_step4_full_flow()
