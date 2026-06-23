import argparse
import json
import os

import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import f1_score, mean_absolute_error, mean_squared_error, r2_score
from tensorflow import keras


def parse_args():
    parser = argparse.ArgumentParser(
        description="Evaluate a trained appliance regression model with MAE, RMSE, F1, and R2."
    )
    parser.add_argument("--appliance", required=True, help="Appliance label, for example bulb")
    parser.add_argument("--on-threshold", type=float, default=8.0, help="Watts threshold used for ON/OFF F1")
    return parser.parse_args()


def main():
    args = parse_args()
    appliance = args.appliance.strip().lower()
    script_dir = os.path.dirname(__file__)

    model_path = os.path.join(script_dir, f"{appliance}_model_final.h5")
    x_test_path = os.path.join(script_dir, f"X_test_{appliance}.npy")
    y_test_path = os.path.join(script_dir, f"y_test_{appliance}.npy")
    params_path = os.path.join(script_dir, "normalisation_params.json")
    metrics_path = os.path.join(script_dir, f"metrics_{appliance}.json")
    chart_path = os.path.join(script_dir, f"output_15_{appliance}_evaluation.png")

    print("=" * 60)
    print(f"Evaluating appliance model: {appliance}")
    print("=" * 60)

    model = keras.models.load_model(model_path)
    X_test = np.load(x_test_path)
    y_test = np.load(y_test_path)
    params = json.load(open(params_path, "r", encoding="utf-8"))

    y_pred_norm = model.predict(X_test, batch_size=512, verbose=1).flatten()
    appliance_max = float(params[f"{appliance}_max"])
    y_test_w = y_test * appliance_max
    y_pred_w = np.clip(y_pred_norm * appliance_max, 0, None)

    mae = mean_absolute_error(y_test_w, y_pred_w)
    rmse = np.sqrt(mean_squared_error(y_test_w, y_pred_w))
    r2 = r2_score(y_test_w, y_pred_w)
    y_true_state = (y_test_w > args.on_threshold).astype(int)
    y_pred_state = (y_pred_w > args.on_threshold).astype(int)
    f1 = f1_score(y_true_state, y_pred_state)

    metrics = {
        "appliance": appliance,
        "MAE_watts": round(float(mae), 2),
        "RMSE_watts": round(float(rmse), 2),
        "F1_score": round(float(f1), 4),
        "R2_score": round(float(r2), 4),
        "appliance_max": round(appliance_max, 3),
        "on_threshold_watts": float(args.on_threshold),
    }

    with open(metrics_path, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)

    show_n = min(500, len(y_test_w))
    plt.figure(figsize=(14, 5))
    plt.plot(y_test_w[:show_n], label=f"Actual {appliance.title()} Power", color="orangered", linewidth=1.5)
    plt.plot(y_pred_w[:show_n], label=f"Predicted {appliance.title()} Power", color="steelblue", linewidth=1.2, alpha=0.8)
    plt.title(f"Actual vs Predicted {appliance.title()} Power | MAE={mae:.1f}W RMSE={rmse:.1f}W F1={f1:.3f} R2={r2:.3f}")
    plt.xlabel("Sample Index")
    plt.ylabel("Power (Watts)")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(chart_path, dpi=120)
    plt.close()

    print(json.dumps(metrics, indent=2))
    print(f"Saved metrics: {metrics_path}")
    print(f"Saved chart  : {chart_path}")


if __name__ == "__main__":
    main()
