# =============================================================================
# SCRIPT 02 — PREPROCESS THE DATA
# =============================================================================
# PURPOSE:
#   Raw UK-DALE data is messy — timestamps are irregular, values go negative,
#   some readings are missing. This script cleans all of that and produces
#   a single clean CSV file ready for the model.
#   1. Loads aggregate + kettle files
#   2. Converts Unix timestamps to proper datetimes
#   3. Resamples to a REGULAR 6-second interval (fills gaps evenly)
#   4. Merges aggregate and kettle into ONE table, aligned by time
#   5. Fills short missing gaps (forward fill)
#   6. Clips negative values to 0 (sensor noise)
#   7. Normalises power values to range [0, 1]  ← required for neural networks
#   8. Saves the clean data to CSV + saves normalisation params to JSON
#
# OUTPUT FILES:
#   processed_kettle.csv         ← clean merged data, ready for model
#   normalisation_params.json    ← max values, needed to convert back to Watts


import pandas as pd
import numpy as np
import json
import os
import matplotlib.pyplot as plt

DATA_FOLDER = "house_1"

# --------------------------------------------------------------------------
# HELPER FUNCTION: Load a UK-DALE .dat file cleanly
# --------------------------------------------------------------------------
# A "function" is reusable code. Instead of copy-pasting the same 5 lines
# for every appliance, we define it once and call it multiple times.
def load_dat_file(filename):
    """
    Load a UK-DALE .dat file and return a clean DataFrame with datetime index.
    filename: just the filename, e.g. 'channel_1.dat'
    """
    filepath = os.path.join(DATA_FOLDER, filename)

    if not os.path.exists(filepath):
        print(f"ERROR: {filepath} not found!")
        exit()

    # Load the two-column file: timestamp + power
    df = pd.read_csv(filepath, sep=' ', names=['timestamp', 'power'])

    # Convert Unix timestamp to datetime
    df['datetime'] = pd.to_datetime(df['timestamp'], unit='s')
    df.set_index('datetime', inplace=True)
    df.drop('timestamp', axis=1, inplace=True)

    return df

# --------------------------------------------------------------------------
# STEP 1: Load aggregate and kettle data
# --------------------------------------------------------------------------
print("=" * 60)
print("STEP 1: Loading raw data files...")
print("=" * 60)

agg    = load_dat_file("channel_1.dat")    # Total house power
kettle = load_dat_file("channel_10.dat")   # Kettle only

print(f"  Aggregate : {len(agg):,} readings")
print(f"  Kettle    : {len(kettle):,} readings")

# --------------------------------------------------------------------------
# STEP 2: Resample to regular 6-second intervals
# --------------------------------------------------------------------------
# Problem: UK-DALE readings are NOT evenly spaced. Some seconds have 2 readings,
# some have none. Neural networks need evenly-spaced data.
# Solution: "Resample" — divide time into 6-second buckets, average each bucket.
#
# '6S' means 6 seconds.
# .mean() means: if there are 2 readings in that 6s bucket, average them.
print("\nSTEP 2: Resampling to regular 6-second intervals...")

agg    = agg.resample('6s').mean()
kettle = kettle.resample('6s').mean()

print(f"  Aggregate after resample : {len(agg):,} rows")
print(f"  Kettle after resample    : {len(kettle):,} rows")

# --------------------------------------------------------------------------
# STEP 3: Merge on shared timestamps (inner join)
# --------------------------------------------------------------------------
# We only want timestamps where BOTH aggregate AND kettle have data.
# how='inner' means: keep only rows that exist in BOTH tables.
print("\nSTEP 3: Merging aggregate + kettle on shared timestamps...")

# Rename columns before merging so we know which is which
agg.columns    = ['agg_power']
kettle.columns = ['kettle_power']

df = pd.merge(agg, kettle, left_index=True, right_index=True, how='inner')
print(f"  Merged dataset: {len(df):,} rows")

# --------------------------------------------------------------------------
# STEP 4: Handle missing values
# --------------------------------------------------------------------------
# After resampling, some 6-second buckets may have NaN (no reading was recorded).
# Forward fill: copy the last known value forward for up to 30 steps (3 minutes).
# Then drop any remaining NaN rows.
print("\nSTEP 4: Filling missing values...")

missing_before = df.isna().sum().sum()
df.fillna(method='ffill', limit=30, inplace=True)
df.dropna(inplace=True)
missing_after = df.isna().sum().sum()

print(f"  Missing values before: {missing_before}")
print(f"  Missing values after : {missing_after}")
print(f"  Rows remaining       : {len(df):,}")

# --------------------------------------------------------------------------
# STEP 5: Clip negative values
# --------------------------------------------------------------------------
# Sensors sometimes produce small negative readings due to noise.
# Power can never be negative in reality, so clip anything below 0 to 0.
print("\nSTEP 5: Clipping negative values to 0...")

negative_count = (df < 0).sum().sum()
df = df.clip(lower=0)
print(f"  Negative values clipped: {negative_count}")

# --------------------------------------------------------------------------
# STEP 6: Normalise to [0, 1] range
# --------------------------------------------------------------------------
# Neural networks work best when all input values are in a small range like 0-1.
# We divide each column by its maximum value.
# IMPORTANT: We save the max values so we can convert predictions BACK to Watts later.
print("\nSTEP 6: Normalising to [0, 1] range...")

agg_max    = float(df['agg_power'].max())
kettle_max = float(df['kettle_power'].max())

print(f"  agg_max    = {agg_max:.1f} W  (highest total power recorded)")
print(f"  kettle_max = {kettle_max:.1f} W  (highest kettle power recorded)")

df['agg_norm']    = df['agg_power']    / agg_max
df['kettle_norm'] = df['kettle_power'] / kettle_max

# Save normalisation parameters — CRITICAL for later use in evaluation + API
norm_params = {
    'agg_max'    : agg_max,
    'kettle_max' : kettle_max
}
with open('normalisation_params.json', 'w') as f:
    json.dump(norm_params, f, indent=2)

print("  Saved normalisation_params.json")

# --------------------------------------------------------------------------
# STEP 7: Save cleaned data to CSV
# --------------------------------------------------------------------------
print("\nSTEP 7: Saving cleaned data...")

df.to_csv('processed_kettle.csv')
print(f"  Saved processed_kettle.csv  ({len(df):,} rows)")

# --------------------------------------------------------------------------
# STEP 8: Quick sanity check plot
# --------------------------------------------------------------------------
print("\nSTEP 8: Generating sanity check plot...")

# Show 2 days of normalised data
sample = df[['agg_norm', 'kettle_norm']].iloc[:28800]  # 28800 rows = 2 days at 6s intervals

fig, axes = plt.subplots(2, 1, figsize=(14, 6), sharex=True)
axes[0].plot(sample['agg_norm'], color='steelblue', linewidth=0.6)
axes[0].set_title('Normalised Aggregate Power (0-1 scale)')
axes[0].set_ylabel('Normalised Power')
axes[0].grid(True, alpha=0.3)

axes[1].plot(sample['kettle_norm'], color='orangered', linewidth=0.6)
axes[1].set_title('Normalised Kettle Power (0-1 scale)')
axes[1].set_ylabel('Normalised Power')
axes[1].grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig('output_02_normalised_data.png', dpi=120)
print("  Saved output_02_normalised_data.png")

print("\n" + "=" * 60)
print("SCRIPT 02 COMPLETE")
print("Output files created:")
print("  processed_kettle.csv")
print("  normalisation_params.json")
print("Next step: Run  python 03_feature_engineering.py")
print("=" * 60)