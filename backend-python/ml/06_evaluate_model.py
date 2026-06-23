# =============================================================================
# SCRIPT 06 — EVALUATE THE TRAINED MODEL
# =============================================================================
# PURPOSE:
#   Load the trained model and test it on unseen data (X_test / y_test).
#   Compute the 4 official metrics: MAE, RMSE, F1-Score, R².
#   Generate a chart showing predicted vs actual kettle power.
#
# METRICS EXPLAINED:
#   MAE  (Mean Absolute Error)   — average error in Watts. Target: < 50W
#   RMSE (Root Mean Square Error)— like MAE but penalises big errors more. Target: < 80W
#   F1   (Appliance ON/OFF)      — how well we detect if kettle is ON or OFF. Target: > 0.85
#   R²   (R-squared)             — how much variance the model explains. Target: > 0.80
#
# HOW TO RUN:
#   python 06_evaluate_model.py
# =============================================================================

import numpy as np
import json
import matplotlib.pyplot as plt
from tensorflow import keras
from sklearn.metrics import mean_absolute_error, mean_squared_error, f1_score, r2_score

# --------------------------------------------------------------------------
# STEP 1: Load model and test data
# --------------------------------------------------------------------------
print("=" * 60)
print("STEP 1: Loading model and test data...")
print("=" * 60)

model  = keras.models.load_model('kettle_model_final.h5')
X_test = np.load('X_test.npy')
y_test = np.load('y_test.npy')

print(f"  Model loaded: kettle_model_final.h5")
print(f"  Test samples: {len(X_test):,}")

# --------------------------------------------------------------------------
# STEP 2: Run predictions
# --------------------------------------------------------------------------
print("\nSTEP 2: Running predictions on test set...")

# model.predict returns normalised values (0-1 range)
# .flatten() converts from shape (N, 1) to shape (N,)
y_pred_norm = model.predict(X_test, batch_size=512, verbose=1).flatten()

print(f"  Predictions generated: {len(y_pred_norm):,}")

# --------------------------------------------------------------------------
# STEP 3: Convert predictions back to Watts
# --------------------------------------------------------------------------
# During preprocessing we divided by kettle_max to normalise.
# Now we multiply back to get real Watt values.
print("\nSTEP 3: Converting normalised values back to Watts...")

params     = json.load(open('normalisation_params.json'))
kettle_max = params['kettle_max']

y_test_w = y_test    * kettle_max   # Actual watts
y_pred_w = y_pred_norm * kettle_max  # Predicted watts

# Clip negative predictions (model might produce tiny negatives)
y_pred_w = np.clip(y_pred_w, 0, None)

print(f"  kettle_max used for conversion: {kettle_max:.1f} W")

# --------------------------------------------------------------------------
# STEP 4: Calculate metrics
# --------------------------------------------------------------------------
print("\nSTEP 4: Calculating performance metrics...")

mae  = mean_absolute_error(y_test_w, y_pred_w)
rmse = np.sqrt(mean_squared_error(y_test_w, y_pred_w))
r2   = r2_score(y_test_w, y_pred_w)

# F1-Score: treat any reading > 10W as "appliance is ON"
# This converts the regression problem into a classification problem
ON_THRESHOLD   = 10   # Watts
y_true_state   = (y_test_w > ON_THRESHOLD).astype(int)   # 1=ON, 0=OFF (actual)
y_pred_state   = (y_pred_w > ON_THRESHOLD).astype(int)   # 1=ON, 0=OFF (predicted)
f1             = f1_score(y_true_state, y_pred_state)

print("\n" + "=" * 60)
print("RESULTS:")
print("=" * 60)
print(f"  MAE   (target < 50W)  : {mae:.2f} W  {'PASS' if mae < 50 else 'needs improvement'}")
print(f"  RMSE  (target < 80W)  : {rmse:.2f} W  {'PASS' if rmse < 80 else 'needs improvement'}")
print(f"  F1    (target > 0.85) : {f1:.4f}   {'PASS' if f1 > 0.85 else 'needs improvement'}")
print(f"  R²    (target > 0.80) : {r2:.4f}   {'PASS' if r2 > 0.80 else 'needs improvement'}")
print("=" * 60)

# --------------------------------------------------------------------------
# STEP 5: Troubleshooting tips if results are bad
# --------------------------------------------------------------------------
if mae > 100:
    print("\nTROUBLESHOOTING — MAE is very high:")
    print("  1. Check that normalisation_params.json has the correct kettle_max")
    print("  2. Make sure you're loading the KETTLE model (not another appliance)")
    print("  3. Try training for more epochs (increase patience in EarlyStopping)")

if f1 < 0.5:
    print("\nTROUBLESHOOTING — F1 Score is very low:")
    print("  1. Try lowering the ON_THRESHOLD from 10W to 5W (line ~60 above)")
    print("  2. The model may be predicting near-zero for everything")
    print("     → Check: print(y_pred_w[:20]) — are all values close to 0?")

# --------------------------------------------------------------------------
# STEP 6: Plot actual vs predicted
# --------------------------------------------------------------------------
print("\nSTEP 5: Generating actual vs predicted chart...")

# Show 500 samples for readability
N = 500
plt.figure(figsize=(14, 5))
plt.plot(y_test_w[:N],  label='Actual Kettle Power',    color='orangered',   linewidth=1.5)
plt.plot(y_pred_w[:N],  label='Predicted Kettle Power', color='steelblue', linewidth=1.2, alpha=0.8)
plt.title(f'S2P-LSTM: Actual vs Predicted Kettle Power  |  MAE={mae:.1f}W  RMSE={rmse:.1f}W  F1={f1:.3f}')
plt.xlabel('Sample Index')
plt.ylabel('Power (Watts)')
plt.legend()
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig('output_06_evaluation.png', dpi=120)
print("  Saved output_06_evaluation.png")

# --------------------------------------------------------------------------
# STEP 7: Save metrics to a JSON file (for the project report)
# --------------------------------------------------------------------------
metrics = {
    'appliance' : 'kettle',
    'MAE_watts' : round(mae,  2),
    'RMSE_watts': round(rmse, 2),
    'F1_score'  : round(f1,   4),
    'R2_score'  : round(r2,   4)
}
with open('metrics_kettle.json', 'w') as f:
    json.dump(metrics, f, indent=2)
print("  Saved metrics_kettle.json")

print("\n" + "=" * 60)
print("SCRIPT 06 COMPLETE")
print("Next step: Run  python 07_bill_prediction.py")
print("=" * 60)