# =============================================================================
# SCRIPT 04 — CREATE SLIDING WINDOWS (Model Input/Output Pairs)
# =============================================================================
# PURPOSE:
#   Transform the time-series into X (input) and y (output) arrays
#   that the LSTM model can be trained on.
#
# THE SLIDING WINDOW CONCEPT:
#   Instead of giving the model one reading at a time, we give it a WINDOW
#   of 599 consecutive aggregate readings. The model predicts kettle power
#   at the CENTRE of that window.
#
#   Example (simplified with window=5):
#     Readings: [100, 200, 1500, 300, 150, 200, 100, ...]
#     Window 1: [100, 200, 1500, 300, 150]  → predict: kettle at index 2
#     Window 2: [200, 1500, 300, 150, 200]  → predict: kettle at index 3
#     ... and so on, sliding one step at a time
#
#   The centre point is used because the LSTM can "see" what happened
#   BEFORE and AFTER the target moment — helping it distinguish a kettle
#   spike from other appliances.
#
# OUTPUT FILES:
#   X_train.npy, y_train.npy   ← 70% of data for training
#   X_val.npy,   y_val.npy     ← 15% for validation (check overfitting)
#   X_test.npy,  y_test.npy    ← 15% for final evaluation
#
#
# NOTE ON MEMORY:
#   This creates LARGE arrays. If your PC has less than 8GB RAM,
#   run with LIMIT_DATA = True (see below) to use 1 month of data only.
# =============================================================================

import pandas as pd
import numpy as np

# --------------------------------------------------------------------------
# CONFIGURATION — Change these if needed
# --------------------------------------------------------------------------
WINDOW_SIZE = 599    # Must be odd. 599 × 6 seconds = ~60 minutes of context
CENTRE      = WINDOW_SIZE // 2   # = 299  (the middle index of the window)

# Set to True if your PC has < 8GB RAM or you want a fast test run
LIMIT_DATA  = True
LIMIT_ROWS  = 300000   # ~3 weeks of data if limiting

# --------------------------------------------------------------------------
# STEP 1: Load feature-engineered data
# --------------------------------------------------------------------------
print("=" * 60)
print("STEP 1: Loading features_kettle.csv...")
print("=" * 60)

df = pd.read_csv('features_kettle.csv', index_col='datetime', parse_dates=True)
print(f"  Loaded {len(df):,} rows")

if LIMIT_DATA:
    df = df.iloc[:LIMIT_ROWS]
    print(f"  Data limited to {len(df):,} rows (LIMIT_DATA=True)")

# --------------------------------------------------------------------------
# STEP 2: Extract only the columns needed for the model
# --------------------------------------------------------------------------
# The LSTM input is ONLY the normalised aggregate power — one value per timestep.
# (You can experiment with adding more features later, but start simple.)
agg_values    = df['agg_norm'].values     # Input:  aggregate power
kettle_values = df['kettle_norm'].values  # Target: kettle power

print(f"\nSTEP 2: Data shapes before windowing:")
print(f"  agg_values shape    : {agg_values.shape}   (total readings)")
print(f"  kettle_values shape : {kettle_values.shape}")

# --------------------------------------------------------------------------
# STEP 3: Create sliding windows
# --------------------------------------------------------------------------
# This loop creates one (X, y) pair for each valid centre point.
# "Valid" means the window fits within the data (not at the very start/end).
print(f"\nSTEP 3: Creating sliding windows (window size = {WINDOW_SIZE})...")
print(f"  This may take a few minutes for large datasets...")

X = []   # Will hold all input windows
y = []   # Will hold all corresponding targets

# Start from CENTRE so the first window [0 : WINDOW_SIZE] fits in the data
# End at len(df)-CENTRE so the last window also fits
for i in range(CENTRE, len(df) - CENTRE):
    # Extract 599 aggregate readings centred at position i
    window = agg_values[i - CENTRE : i + CENTRE + 1]   # shape: (599,)
    target = kettle_values[i]                           # single float

    X.append(window)
    y.append(target)

# Convert Python lists to NumPy arrays — required for TensorFlow
X = np.array(X, dtype=np.float32)   # shape: (N, 599)
y = np.array(y, dtype=np.float32)   # shape: (N,)

print(f"  Windows created: {len(X):,}")
print(f"  X shape: {X.shape}   (samples, window_size)")
print(f"  y shape: {y.shape}   (samples,)")

# --------------------------------------------------------------------------
# STEP 4: Reshape X for LSTM — needs 3D input
# --------------------------------------------------------------------------
# TensorFlow LSTM expects input shape: (samples, timesteps, features)
# We only have 1 feature (aggregate power), so last dimension = 1
X = X.reshape(X.shape[0], X.shape[1], 1)
print(f"\nSTEP 4: Reshaped X for LSTM: {X.shape}  (samples, timesteps, features)")

# --------------------------------------------------------------------------
# STEP 5: Train / Validation / Test split  (70 / 15 / 15)
# --------------------------------------------------------------------------
# IMPORTANT: Do NOT shuffle the data — it's a time series!
# Shuffling would let the model "see the future" during training (data leakage).
print("\nSTEP 5: Splitting into Train / Validation / Test sets...")

n         = len(X)
train_end = int(n * 0.70)
val_end   = int(n * 0.85)

X_train = X[:train_end]
y_train = y[:train_end]

X_val   = X[train_end:val_end]
y_val   = y[train_end:val_end]

X_test  = X[val_end:]
y_test  = y[val_end:]

print(f"  Training set   : {len(X_train):,} samples  (70%)")
print(f"  Validation set : {len(X_val):,} samples  (15%)")
print(f"  Test set       : {len(X_test):,} samples  (15%)")

# --------------------------------------------------------------------------
# STEP 6: Save arrays to .npy files
# --------------------------------------------------------------------------
# .npy is a fast binary format for NumPy arrays.
# These files will be uploaded to Google Colab for training.
print("\nSTEP 6: Saving .npy files...")

np.save('X_train.npy', X_train)
np.save('y_train.npy', y_train)
np.save('X_val.npy',   X_val)
np.save('y_val.npy',   y_val)
np.save('X_test.npy',  X_test)
np.save('y_test.npy',  y_test)

# Print file sizes so you know how big the uploads are
import os
for fname in ['X_train.npy', 'y_train.npy', 'X_val.npy', 'y_val.npy', 'X_test.npy', 'y_test.npy']:
    size_mb = os.path.getsize(fname) / (1024 * 1024)
    print(f"  {fname:<20} {size_mb:.1f} MB")

print("\n" + "=" * 60)
print("SCRIPT 04 COMPLETE")
print("\nNEXT STEP — TRAINING:")
print("  Option A (RECOMMENDED): Upload .npy files to Google Colab")
print("    → colab.research.google.com")
print("    → Upload: X_train.npy, y_train.npy, X_val.npy, y_val.npy")
print("    → Run: 05_train_model.py  (20-40 mins on free GPU)")
print()
print("  Option B (slow): Run locally on CPU")
print("    → python 05_train_model.py")
print("    → Estimated time: 4-10 hours")
print("=" * 60)