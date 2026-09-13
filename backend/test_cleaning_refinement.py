import polars as pl
from dateutil import parser as date_parser
from rapidfuzz import process, fuzz

import os

raw_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "raw", "ds_1788935487_messy_sales_data.csv"))
df = pl.read_csv(raw_path, infer_schema_length=0)
print(f"Raw rows: {df.height}")

# 1. Exact Deduplication
df = df.unique()

# 2. Trim whitespace and normalize placeholder strings across all columns
clean_cols = []
for c in df.columns:
    clean_cols.append(
        pl.when(
            pl.col(c)
            .str.strip_chars()
            .str.to_lowercase()
            .is_in(["unknown", "na", "n/a", "null", "none", "-", "", "nan", "undefined"])
        )
        .then(None)
        .otherwise(pl.col(c).str.strip_chars())
        .alias(c)
    )
df = df.with_columns(clean_cols)

# 3. Business key deduplication (Order_ID)
order_id_col = next((c for c in df.columns if "order" in c.lower() and "id" in c.lower()), None)
if order_id_col:
    df = df.unique(subset=[order_id_col], keep="first")

# 4. Standardize Region
canon_regions = ["North", "South", "East", "West", "Central"]
region_alias = {
    "s.": "South", "suth": "South", "s": "South", "south": "South",
    "n.": "North", "nort": "North", "n": "North", "north": "North",
    "e.": "East", "est": "East", "e": "East", "east": "East",
    "w.": "West", "wst": "West", "w": "West", "west": "West",
    "c.": "Central", "centeral": "Central", "cntral": "Central", "c": "Central", "central": "Central",
}
def fix_region(val):
    if not val or not str(val).strip():
        return "East"
    v = str(val).strip().lower()
    if v in region_alias:
        return region_alias[v]
    match, score, _ = process.extractOne(v.title(), canon_regions, scorer=fuzz.ratio)
    return match if score >= 65 else "East"

# 5. Standardize Category
canon_categories = ["Electronics", "Clothing", "Furniture", "Toys", "Beauty", "Groceries"]
cat_alias = {
    "electroncs": "Electronics", "electronic": "Electronics", "electronics": "Electronics",
    "clothng": "Clothing", "cloths": "Clothing", "clothing": "Clothing",
    "furnture": "Furniture", "furniture": "Furniture",
    "toy": "Toys", "toys": "Toys",
    "grocry": "Groceries", "grocery": "Groceries", "groceries": "Groceries",
    "beuty": "Beauty", "beauty": "Beauty",
}
def fix_category(val):
    if not val or not str(val).strip():
        return "Electronics"
    v = str(val).strip().lower()
    if v in cat_alias:
        return cat_alias[v]
    match, score, _ = process.extractOne(v.title(), canon_categories, scorer=fuzz.ratio)
    return match if score >= 65 else "Electronics"

# 6. Standardize Payment Method
canon_pm = ["Credit Card", "Debit Card", "Net Banking", "UPI", "Cash"]
pm_alias = {
    "credit card": "Credit Card", "debit card": "Debit Card",
    "net banking": "Net Banking", "netbanking": "Net Banking",
    "upi": "UPI", "cash": "Cash",
}
def fix_pm(val):
    if not val or not str(val).strip():
        return "Credit Card"
    v = str(val).strip().lower()
    if v in pm_alias:
        return pm_alias[v]
    match, score, _ = process.extractOne(v.title(), canon_pm, scorer=fuzz.ratio)
    return match if score >= 65 else "Credit Card"

# 7. Standardize Date
def fix_date(val):
    if not val or not str(val).strip():
        return "2025-06-15"
    try:
        dt = date_parser.parse(str(val).strip(), dayfirst=True)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return "2025-06-15"

# Apply mapping functions
df = df.with_columns([
    pl.col("Region").map_elements(fix_region, return_dtype=pl.String).alias("Region"),
    pl.col("Category").map_elements(fix_category, return_dtype=pl.String).alias("Category"),
    pl.col("Payment_Method").map_elements(fix_pm, return_dtype=pl.String).alias("Payment_Method"),
    pl.col("Order_Date").map_elements(fix_date, return_dtype=pl.String).alias("Order_Date"),
])

# 8. Numeric Casting & Imputation
# Quantity: abs and cast
qty_series = df["Quantity"].str.replace_all(r"[^0-9.-]", "").cast(pl.Float64, strict=False).abs()
qty_val = float(qty_series.drop_nulls().median() if qty_series.drop_nulls().len() > 0 else 1.0)
df = df.with_columns(qty_series.fill_null(qty_val).alias("Quantity"))

# Unit_Price: abs and cast
price_series = df["Unit_Price"].str.replace_all(r"[^0-9.-]", "").cast(pl.Float64, strict=False).abs()
price_val = float(price_series.drop_nulls().median() if price_series.drop_nulls().len() > 0 else 100.0)
df = df.with_columns(price_series.fill_null(price_val).alias("Unit_Price"))

# Discount_Percent: scale unification to [0, 1]
disc_series = df["Discount_Percent"].str.replace_all(r"[^0-9.-]", "").cast(pl.Float64, strict=False).abs()
disc_norm = pl.when(disc_series > 1.0).then(disc_series / 100.0).otherwise(disc_series)
disc_norm = pl.when(disc_norm > 1.0).then(1.0).when(disc_norm < 0.0).then(0.0).otherwise(disc_norm)
disc_val = float(df.select(disc_norm).to_series().drop_nulls().median() or 0.1)
df = df.with_columns(disc_norm.fill_null(disc_val).alias("Discount_Percent"))

# Customer_Satisfaction: clamp [1, 5] and replace 11.0 / invalid with median
sat_series = df["Customer_Satisfaction"].str.replace_all(r"[^0-9.-]", "").cast(pl.Float64, strict=False)
valid_sats = sat_series.filter((sat_series >= 1.0) & (sat_series <= 5.0))
sat_val = float(valid_sats.median() if valid_sats.len() > 0 else 4.0)
sat_clean = pl.when((sat_series < 1.0) | (sat_series > 5.0)).then(sat_val).otherwise(sat_series)
df = df.with_columns(sat_clean.fill_null(sat_val).alias("Customer_Satisfaction"))

# 9. Sales_Amount: Recompute to fix corrupted outliers
recomputed_sales = (df["Quantity"] * df["Unit_Price"] * (1.0 - df["Discount_Percent"])).round(2)
df = df.with_columns(recomputed_sales.alias("Sales_Amount"))

# Impute any remaining nulls in other string columns (Customer_Name, Sales_Rep, Product, Order_Status)
for c in df.columns:
    if df[c].dtype == pl.String and df[c].null_count() > 0:
        mode_val = df[c].drop_nulls().mode().first() or "Unknown"
        df = df.with_columns(df[c].fill_null(mode_val).alias(c))

print("\n--- RESULTS OF FULL ADVANCED CLEANING ---")
print("Distinct Regions:", sorted(df["Region"].unique().to_list()))
print("Distinct Categories:", sorted(df["Category"].unique().to_list()))
print("Distinct Payment Methods:", sorted(df["Payment_Method"].unique().to_list()))
print(f"Quantity range: [{df['Quantity'].min()} to {df['Quantity'].max()}], Negative count: {(df['Quantity'] < 0).sum()}")
print(f"Unit_Price range: [{df['Unit_Price'].min()} to {df['Unit_Price'].max()}], Negative count: {(df['Unit_Price'] < 0).sum()}")
print(f"Discount range: [{df['Discount_Percent'].min()} to {df['Discount_Percent'].max()}], >1.0 count: {(df['Discount_Percent'] > 1.0).sum()}")
print(f"Customer_Satisfaction distinct: {sorted(df['Customer_Satisfaction'].unique().to_list())}")
print(f"Sales_Amount max: {df['Sales_Amount'].max()}, rows > 100k: {(df['Sales_Amount'] > 100000).sum()}")
order_100055 = df.filter(pl.col("Order_ID") == "100055")
if order_100055.height > 0:
    print(f"Order 100055 Sales_Amount: {order_100055['Sales_Amount'][0]} (expected ≈ 2,071.33)")
print(f"Remaining null counts across all columns: {sum(df[c].null_count() for c in df.columns)}")
print(f"Final clean row count: {df.height}")
