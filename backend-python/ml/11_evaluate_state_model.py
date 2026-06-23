import argparse
import json
import os

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score

from state_model_pipeline import build_state_model, build_state_training_dataset, load_readings_file, sanitize_readings


def parse_args():
    parser = argparse.ArgumentParser(
        description="Evaluate an appliance state classifier with classification metrics."
    )
    parser.add_argument("--appliance", required=True, help="Appliance label, for example bulb")
    parser.add_argument("--input-file", required=True, help="Path to processed_*_state.csv or raw readings file")
    parser.add_argument("--threshold", type=float, default=8.0, help="ON threshold in watts")
    parser.add_argument("--window-size", type=int, default=30, help="Sliding feature window size")
    parser.add_argument("--epochs", type=int, default=20, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    return parser.parse_args()


def load_power_series(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".csv":
        df = pd.read_csv(path)
        if "power" in df.columns:
            return sanitize_readings(df["power"].values)
    return sanitize_readings(load_readings_file(path))


def main():
    args = parse_args()
    script_dir = os.path.dirname(__file__)
    appliance = args.appliance.strip().lower()
    input_path = os.path.abspath(args.input_file)
    metrics_path = os.path.join(script_dir, f"metrics_{appliance}_state.json")
    chart_path = os.path.join(script_dir, f"output_11_{appliance}_state_evaluation.png")

    print("=" * 60)
    print(f"Evaluating state model for: {appliance}")
    print(f"Input file: {input_path}")
    print("=" * 60)

    readings = load_power_series(input_path)
    X, y, arr = build_state_training_dataset(
        readings,
        on_threshold_watts=args.threshold,
        window_size=args.window_size,
    )

    n = len(X)
    train_end = int(n * 0.70)
    val_end = int(n * 0.85)

    X_train, y_train = X[:train_end], y[:train_end]
    X_val, y_val = X[train_end:val_end], y[train_end:val_end]
    X_test, y_test = X[val_end:], y[val_end:]

    print(f"Windows created : {n:,}")
    print(f"Train/Val/Test  : {len(X_train):,} / {len(X_val):,} / {len(X_test):,}")

    model = build_state_model()
    history = model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch_size,
        verbose=0,
    )

    y_prob = model.predict(X_test, verbose=0).flatten()
    y_pred = (y_prob >= 0.5).astype(int)

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    cm = confusion_matrix(y_test, y_pred)

    metrics = {
        "appliance": appliance,
        "samples": int(len(arr)),
        "windows": int(n),
        "threshold_watts": float(args.threshold),
        "train_accuracy_last_epoch": round(float(history.history["accuracy"][-1]), 4),
        "val_accuracy_last_epoch": round(float(history.history["val_accuracy"][-1]), 4),
        "test_accuracy": round(float(accuracy), 4),
        "test_precision": round(float(precision), 4),
        "test_recall": round(float(recall), 4),
        "test_f1_score": round(float(f1), 4),
        "confusion_matrix": cm.tolist(),
    }

    with open(metrics_path, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)

    fig, axes = plt.subplots(2, 1, figsize=(14, 8))

    epochs_axis = range(1, len(history.history["accuracy"]) + 1)
    axes[0].plot(epochs_axis, history.history["accuracy"], label="Train Accuracy", color="steelblue")
    axes[0].plot(epochs_axis, history.history["val_accuracy"], label="Val Accuracy", color="darkorange")
    axes[0].set_title(f"{appliance} state model training history")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("Accuracy")
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    show_n = min(300, len(y_test))
    axes[1].plot(y_test[:show_n], label="Actual State", color="darkorange", linewidth=1.5)
    axes[1].plot(y_pred[:show_n], label="Predicted State", color="steelblue", linewidth=1.2, alpha=0.8)
    axes[1].set_title(
        f"{appliance} state predictions | Acc={accuracy:.3f} Precision={precision:.3f} Recall={recall:.3f} F1={f1:.3f}"
    )
    axes[1].set_xlabel("Sample Index")
    axes[1].set_ylabel("State")
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(chart_path, dpi=120)
    plt.close(fig)

    print(json.dumps(metrics, indent=2))
    print(f"Saved metrics: {metrics_path}")
    print(f"Saved chart  : {chart_path}")


if __name__ == "__main__":
    main()
