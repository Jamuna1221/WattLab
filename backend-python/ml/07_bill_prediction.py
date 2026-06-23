# =============================================================================
# SCRIPT 07 — BILL PREDICTION MODEL
# =============================================================================
# PURPOSE:
#   Train a model that forecasts the next day's energy consumption (kWh)
#   given the last 30 days of daily usage. This powers the "Future Bill"
#   section of the dashboard.
#
# APPROACH:
#   1. Aggregate all power readings into daily kWh totals
#   2. Use sliding windows of 30 days → predict day 31
#   3. Train a small LSTM on these sequences
#   4. Save the model for use in the Flask API
#
# OUTPUT: bill_prediction_model.h5
#
# HOW TO RUN:
#   python 07_bill_prediction.py
# =============================================================================

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import json
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.metrics import mean_absolute_error

# --------------------------------------------------------------------------
# STEP 1: Load processed data and aggregate to daily kWh
# --------------------------------------------------------------------------
print("=" * 60)
print("STEP 1: Aggregating to daily kWh...")
print("=" * 60)

df = pd.read_csv('processed_kettle.csv', index_col='datetime', parse_dates=True)

# .resample('D') groups all readings by calendar day
# .sum() adds them up — total Watts per day
# Convert to kWh: multiply by 6 seconds (reading interval) ÷ 3600 (seconds per hour)
# Power (W) × time (h) = Energy (Wh) → ÷ 1000 = kWh
daily_kwh = df['agg_power'].resample('D').sum() * (6 / 3600) / 1000

print(f"  Total days in dataset    : {len(daily_kwh)}")
print(f"  Average daily kWh        : {daily_kwh.mean():.2f} kWh")
print(f"  Max daily kWh            : {daily_kwh.max():.2f} kWh")
print(f"  Min daily kWh            : {daily_kwh.min():.2f} kWh")

# --------------------------------------------------------------------------
# STEP 2: Create sliding windows (30-day input → 1-day prediction)
# --------------------------------------------------------------------------
print("\nSTEP 2: Creating 30-day windows...")

WINDOW = 30   # Look at last 30 days to predict the next 1 day

X_bill = []
y_bill = []

daily_values = daily_kwh.values  # Convert to NumPy array

for i in range(WINDOW, len(daily_values)):
    X_bill.append(daily_values[i - WINDOW : i])  # Last 30 days
    y_bill.append(daily_values[i])                # Next day's kWh

X_bill = np.array(X_bill, dtype=np.float32).reshape(-1, WINDOW, 1)
y_bill = np.array(y_bill, dtype=np.float32)

print(f"  Samples created : {len(X_bill)}")
print(f"  X_bill shape    : {X_bill.shape}")

# --------------------------------------------------------------------------
# STEP 3: Train/test split
# --------------------------------------------------------------------------
split   = int(len(X_bill) * 0.8)
X_train = X_bill[:split]
y_train = y_bill[:split]
X_test  = X_bill[split:]
y_test  = y_bill[split:]

print(f"\nSTEP 3: Split — Train: {len(X_train)}, Test: {len(X_test)}")

# --------------------------------------------------------------------------
# STEP 4: Build and train the bill prediction LSTM
# --------------------------------------------------------------------------
# Simpler model than the S2P-LSTM — daily data is less complex
print("\nSTEP 4: Building and training bill prediction model...")

bill_model = keras.Sequential([
    layers.LSTM(64, input_shape=(WINDOW, 1)),
    layers.Dense(32, activation='relu'),
    layers.Dense(1)   # Output: predicted kWh for next day
])

bill_model.compile(optimizer='adam', loss='mse', metrics=['mae'])
bill_model.summary()

history = bill_model.fit(
    X_train, y_train,
    epochs=50,
    batch_size=16,
    validation_split=0.1,
    verbose=1,
    callbacks=[
        keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True)
    ]
)

# --------------------------------------------------------------------------
# STEP 5: Evaluate and save
# --------------------------------------------------------------------------
print("\nSTEP 5: Evaluating bill prediction model...")

y_pred = bill_model.predict(X_test).flatten()
mae    = mean_absolute_error(y_test, y_pred)

print(f"  MAE on test set: {mae:.3f} kWh/day")

bill_model.save('bill_prediction_model.h5')
print("  Saved: bill_prediction_model.h5")

# --------------------------------------------------------------------------
# STEP 6: Plot predicted vs actual daily kWh
# --------------------------------------------------------------------------
plt.figure(figsize=(14, 4))
plt.plot(y_test,  label='Actual Daily kWh',    color='steelblue',  linewidth=1.5)
plt.plot(y_pred,  label='Predicted Daily kWh', color='orangered', linewidth=1.2, alpha=0.8)
plt.title(f'Bill Prediction — Actual vs Predicted Daily kWh  |  MAE={mae:.3f} kWh')
plt.xlabel('Day')
plt.ylabel('Energy (kWh)')
plt.legend()
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig('output_07_bill_prediction.png', dpi=120)
print("  Saved output_07_bill_prediction.png")

# Save the tariff config for the API to use
tariff_config = {
    'tariff_inr_per_kwh': 6.5,    # Approximate Indian electricity rate
    'window_days': WINDOW
}
with open('bill_config.json', 'w') as f:
    json.dump(tariff_config, f, indent=2)
print("  Saved bill_config.json")

print("\n" + "=" * 60)
print("SCRIPT 07 COMPLETE")
print("Next step: Check app.py (Flask API) then run  python 09_simulate_esp32.py")
print("=" * 60)