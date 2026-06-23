# =============================================================================
# SCRIPT 03 — FEATURE ENGINEERING
# =============================================================================
# PURPOSE:
#   Add extra columns (features) to help the model learn usage patterns.
#   For example: "is this reading at 7am on a weekday?" helps the model know
#   that a kettle spike at 7am = morning tea, not a fault.
#
# NEW FEATURES ADDED:
#   hour          — hour of day (0-23)
#   day_of_week   — day number (0=Monday, 6=Sunday)
#   is_weekend    — 1 if Saturday/Sunday, else 0
#   rolling_mean  — average power over the past 1 hour (smooths noise)
#   rolling_std   — how much power varied over the past 1 hour
#   is_peak       — 1 if current power is above the 80th percentile
#
# OUTPUT: features_kettle.csv


import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# --------------------------------------------------------------------------
# STEP 1: Load the preprocessed data from Script 02
# --------------------------------------------------------------------------
print("=" * 60)
print("STEP 1: Loading processed_kettle.csv...")
print("=" * 60)

df = pd.read_csv('processed_kettle.csv', index_col='datetime', parse_dates=True)
print(f"  Loaded {len(df):,} rows")
print(f"  Columns: {list(df.columns)}")

# --------------------------------------------------------------------------
# STEP 2: Add time-based features
# --------------------------------------------------------------------------
# df.index is the datetime. We can extract hour, day etc. from it.
print("\nSTEP 2: Adding time-based features...")

df['hour']        = df.index.hour           # 0 to 23
df['day_of_week'] = df.index.dayofweek      # 0=Monday, 6=Sunday
df['is_weekend']  = (df['day_of_week'] >= 5).astype(int)  # 1 if Sat/Sun, else 0

print("  Added: hour, day_of_week, is_weekend")

# --------------------------------------------------------------------------
# STEP 3: Rolling statistics (captures recent power trend)
# --------------------------------------------------------------------------
# "Rolling" means: for each row, look at the last N rows and compute a stat.
# window=600 means 600 rows × 6 seconds = 3600 seconds = 1 hour of history.
print("\nSTEP 3: Adding rolling statistics (1-hour window)...")

df['rolling_mean_1h'] = df['agg_norm'].rolling(window=600).mean()
df['rolling_std_1h']  = df['agg_norm'].rolling(window=600).std()

# Note: the first 600 rows will be NaN because there's not enough history yet.
# We'll drop those rows at the end.
print("  Added: rolling_mean_1h, rolling_std_1h")

# --------------------------------------------------------------------------
# STEP 4: Peak indicator
# --------------------------------------------------------------------------
# "Is the current power above the 80th percentile of all readings?"
# quantile(0.8) returns the value that 80% of readings are below.
print("\nSTEP 4: Adding peak indicator...")

threshold    = df['agg_norm'].quantile(0.8)
df['is_peak'] = (df['agg_norm'] > threshold).astype(int)

print(f"  Peak threshold: {threshold:.4f} (normalised) = {threshold * df['agg_power'].max():.0f} W approx")
print(f"  Added: is_peak")

# --------------------------------------------------------------------------
# STEP 5: Drop rows with NaN (from rolling window startup)
# --------------------------------------------------------------------------
print("\nSTEP 5: Dropping NaN rows from rolling window startup...")

rows_before = len(df)
df.dropna(inplace=True)
rows_after  = len(df)

print(f"  Rows before: {rows_before:,}")
print(f"  Rows dropped: {rows_before - rows_after:,}  (first ~1 hour of data)")
print(f"  Rows after : {rows_after:,}")

# --------------------------------------------------------------------------
# STEP 6: Save enriched dataset
# --------------------------------------------------------------------------
print("\nSTEP 6: Saving features_kettle.csv...")

df.to_csv('features_kettle.csv')
print(f"  Saved features_kettle.csv  ({len(df):,} rows, {len(df.columns)} columns)")
print(f"  Columns: {list(df.columns)}")

# --------------------------------------------------------------------------
# STEP 7: Quick feature visualisation
# --------------------------------------------------------------------------
print("\nSTEP 7: Saving feature visualisation...")

# Show 3 days of data with features overlaid
sample = df.iloc[:43200]  # 43200 rows = 3 days

fig, axes = plt.subplots(3, 1, figsize=(14, 9), sharex=True)

axes[0].plot(sample['agg_norm'], color='steelblue', linewidth=0.5, label='Aggregate')
axes[0].plot(sample['rolling_mean_1h'], color='red', linewidth=1.5, label='1h Rolling Mean')
axes[0].set_title('Aggregate Power vs 1-Hour Rolling Mean')
axes[0].set_ylabel('Normalised Power')
axes[0].legend()
axes[0].grid(True, alpha=0.3)

axes[1].plot(sample['kettle_norm'], color='orangered', linewidth=0.6)
axes[1].set_title('Kettle Power (Target — what we want to predict)')
axes[1].set_ylabel('Normalised Power')
axes[1].grid(True, alpha=0.3)

axes[2].plot(sample['is_peak'].astype(float), color='purple', linewidth=0.5)
axes[2].set_title('Peak Indicator (1 = above 80th percentile power)')
axes[2].set_ylabel('0 or 1')
axes[2].grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig('output_03_features.png', dpi=120)
print("  Saved output_03_features.png")

print("\n" + "=" * 60)
print("SCRIPT 03 COMPLETE")
print("Next step: Run  python 04_create_windows.py")
print("=" * 60)