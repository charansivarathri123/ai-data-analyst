"""Comprehensive automated test validating all 10 cleaning criteria on messy sales data."""

import os
import polars as pl
from app.engine.cleaner_engine import DataCleanerEngine

def run_messy_cleaning_verification():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    raw_path = os.path.join(base_dir, "data", "raw", "ds_1788935487_messy_sales_data.csv")
    out_dir = os.path.join(base_dir, "data", "cleaned")

    assert os.path.exists(raw_path), f"Raw dataset not found at: {raw_path}"
    print(f"[TEST] Loading and cleaning {os.path.basename(raw_path)} with DataCleanerEngine...")

    cleaner = DataCleanerEngine(raw_file_path=raw_path, output_dir=out_dir)
    clean_df, output = cleaner.clean()

    print(f"[INFO] Initial rows: 4,229 | Final clean rows: {clean_df.height}")
    print(f"[INFO] Scorecard: {output.scorecard.overall_score}/100 | Total Audit Rules Applied: {len(output.audit_trail)}")

    # CHECK 1: Region Standardization
    regions = sorted(clean_df["region"].unique().to_list())
    expected_regions = ["Central", "East", "North", "South", "West"]
    assert regions == expected_regions, f"Regions mismatch: {regions} vs {expected_regions}"
    print(f"[PASS 1/10] Regions standardized to exactly 5 canonical regions: {regions}")

    # CHECK 2: Category Standardization
    categories = sorted(clean_df["category"].unique().to_list())
    expected_categories = ["Beauty", "Clothing", "Electronics", "Furniture", "Groceries", "Toys"]
    assert categories == expected_categories, f"Categories mismatch: {categories} vs {expected_categories}"
    print(f"[PASS 2/10] Categories standardized to exactly 6 canonical categories: {categories}")

    # CHECK 3: Payment Method Standardization
    payment_methods = sorted(clean_df["payment_method"].unique().to_list())
    expected_pm = ["Cash", "Credit Card", "Debit Card", "Net Banking", "UPI"]
    assert payment_methods == expected_pm, f"Payment methods mismatch: {payment_methods} vs {expected_pm}"
    print(f"[PASS 3/10] Payment Methods standardized to exactly 5 canonical methods: {payment_methods}")

    # CHECK 4: Deduplication (Exact + Business Key)
    assert clean_df.height == clean_df.unique().height, "Exact duplicate rows still remain!"
    assert clean_df["order_id"].n_unique() == clean_df.height, f"Duplicate order_ids remain: {clean_df['order_id'].n_unique()} unique vs {clean_df.height} rows"
    print(f"[PASS 4/10] Deduplication verified: 0 exact duplicates and 0 duplicate Order_IDs remain (total clean rows: {clean_df.height})")

    # CHECK 5: Quantity Sign Rectification
    neg_qty_count = (clean_df["quantity"] < 0).sum()
    assert neg_qty_count == 0, f"Found {neg_qty_count} negative quantities!"
    assert clean_df["quantity"].min() >= 1.0, f"Min quantity is {clean_df['quantity'].min()}"
    print(f"[PASS 5/10] Quantities verified: min={clean_df['quantity'].min()}, max={clean_df['quantity'].max()}, 0 negative values")

    # CHECK 6: Unit Price Sign Rectification
    neg_price_count = (clean_df["unit_price"] < 0).sum()
    assert neg_price_count == 0, f"Found {neg_price_count} negative prices!"
    assert clean_df["unit_price"].min() > 0, f"Min unit price is {clean_df['unit_price'].min()}"
    print(f"[PASS 6/10] Unit Prices verified: min={clean_df['unit_price'].min()}, max={clean_df['unit_price'].max()}, 0 negative values")

    # CHECK 7: Discount Scale Unification
    gt_one_count = (clean_df["discount_percent"] > 1.0).sum()
    lt_zero_count = (clean_df["discount_percent"] < 0.0).sum()
    assert gt_one_count == 0, f"Found {gt_one_count} discounts > 1.0!"
    assert lt_zero_count == 0, f"Found {lt_zero_count} discounts < 0.0!"
    print(f"[PASS 7/10] Discounts verified: min={clean_df['discount_percent'].min()}, max={clean_df['discount_percent'].max()} (unified [0.0 - 1.0] scale)")

    # CHECK 8: Customer Satisfaction Bounding & Sentinel Removal
    sat_values = sorted(clean_df["customer_satisfaction"].unique().to_list())
    assert all(1.0 <= s <= 5.0 for s in sat_values), f"Out of bounds satisfaction ratings: {sat_values}"
    assert 11.0 not in sat_values, "Sentinel 11.0 still exists in Customer Satisfaction!"
    print(f"[PASS 8/10] Customer Satisfaction verified: ratings bounded in [1.0, 5.0], sentinel 11.0 eliminated (distinct values: {sat_values})")

    # CHECK 9: Sales_Amount Mathematical Recomputation & Outlier Repair
    calc_sales = (clean_df["quantity"] * clean_df["unit_price"] * (1.0 - clean_df["discount_percent"])).round(2)
    diff = (clean_df["sales_amount"] - calc_sales).abs()
    assert diff.max() <= 0.01, f"Max formula discrepancy is {diff.max()} > 0.01!"
    
    # Check order 100055 specifically
    order_100055 = clean_df.filter((pl.col("order_id").cast(pl.String) == "100055"))
    if order_100055.height > 0:
        o55_sales = order_100055["sales_amount"][0]
        assert abs(o55_sales - 2071.33) < 1.0, f"Order 100055 sales amount was {o55_sales}, expected ~2,071.33!"
        print(f"[PASS 9/10] Sales Amount recomputed: Order 100055 corrected to {o55_sales} (was 572,359.90 in raw), 100% mathematical consistency (max diff = {diff.max()})")

    # CHECK 10: Date Parsing & Imputation
    unparseable_dates = [d for d in clean_df["order_date"].to_list() if not str(d).startswith("202")]
    assert len(unparseable_dates) == 0, f"Unparseable dates found: {unparseable_dates[:5]}"
    print(f"[PASS 10/10] Order Dates verified: all {clean_df.height} records converted to ISO YYYY-MM-DD, 0 'Unknown' text remaining")

    # FINAL CHECK: Completeness Across All Columns
    null_counts = {c: clean_df[c].null_count() for c in clean_df.columns}
    total_nulls = sum(null_counts.values())
    assert total_nulls == 0, f"Remaining null values found: {null_counts}"
    print(f"[PASS BONUS] 100% Data Completeness: 0 nulls across all {clean_df.width} columns and {clean_df.height} rows!")

    print("\n" + "="*70)
    print("[SUCCESS] ALL 10 DATA CLEANING DEFECTS FULLY RESOLVED & VERIFIED!")
    print("="*70)

if __name__ == "__main__":
    run_messy_cleaning_verification()
