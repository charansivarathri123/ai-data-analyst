"""Step 2 Automated Verification Suite."""

import os
from fastapi.testclient import TestClient
from app.main import app

def test_step2_full_flow():
    client = TestClient(app)

    # 1. Health check
    h = client.get("/api/health").json()
    assert h["status"] == "healthy"
    assert "data_cleaner" in h["agents_ready"]
    print("[PASS] Health check verified")

    # 2. Load Sample Dataset
    sample_resp = client.get("/api/datasets/sample")
    assert sample_resp.status_code == 200
    sample_data = sample_resp.json()
    ds_id = sample_data["dataset_id"]
    row_count = sample_data["metadata"]["row_count"]
    col_count = sample_data["metadata"]["column_count"]
    assert row_count == 20
    assert col_count == 8
    print(f"[PASS] Sample dataset loaded: {ds_id} ({row_count} rows, {col_count} columns)")

    # 3. Execute Agent 1 Data Cleaner
    clean_resp = client.post(f"/api/datasets/{ds_id}/clean")
    assert clean_resp.status_code == 200
    clean_data = clean_resp.json()
    sc = clean_data["cleaned"]["scorecard"]
    assert sc["overall_score"] >= 90.0
    assert sc["total_nulls_imputed"] > 0
    assert sc["total_rows_cleaned"] == 18
    assert len(clean_data["cleaned"]["audit_trail"]) >= 5
    print(f"[PASS] Agent 1 Data Cleaner passed: Score={sc['overall_score']}/100, Imputed={sc['total_nulls_imputed']}, Cleaned={sc['total_rows_cleaned']}")

    # 4. Preview Raw vs Cleaned
    prev_resp = client.get(f"/api/datasets/{ds_id}/preview")
    assert prev_resp.status_code == 200
    prev_data = prev_resp.json()
    assert prev_data["has_cleaned"] is True
    assert len(prev_data["raw_preview"]) > 0
    assert len(prev_data["clean_preview"]) > 0
    print(f"[PASS] Dataset preview verified: {len(prev_data['raw_preview'])} raw rows, {len(prev_data['clean_preview'])} cleaned rows")

    # 5. Download Cleaned CSV
    dl_resp = client.get(f"/api/datasets/{ds_id}/download")
    assert dl_resp.status_code == 200
    assert len(dl_resp.content) > 0
    print(f"[PASS] Download endpoint verified: {len(dl_resp.content)} bytes")

    print("\n[SUCCESS] ALL STEP 2 AUTOMATED TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_step2_full_flow()
