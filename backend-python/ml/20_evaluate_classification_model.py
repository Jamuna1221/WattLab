import json
import os
import argparse

import matplotlib.pyplot as plt
import numpy as np
from tensorflow import keras

from classification_pipeline import evaluate_predictions


def parse_args():
    parser = argparse.ArgumentParser(
        description="Evaluate a trained prefixed classification model."
    )
    parser.add_argument("--prefix", default="bulb", help="Input/output prefix, for example bulb")
    return parser.parse_args()


def main():
    args = parse_args()
    script_dir = os.path.dirname(__file__)
    prefix = args.prefix.strip().lower()

    print("=" * 60)
    print("STEP 1: Loading test set + trained model...")
    print("=" * 60)

    X_test = np.load(os.path.join(script_dir, f"X_test_{prefix}_classification.npy"))
    y_test = np.load(os.path.join(script_dir, f"y_test_{prefix}_classification.npy"))
    model = keras.models.load_model(os.path.join(script_dir, f"{prefix}_classification_model_final.keras"))

    print(f"  X_test shape: {X_test.shape}")
    print(f"  y_test shape: {y_test.shape}")

    with open(os.path.join(script_dir, f"{prefix}_classification_label_map.json"), "r", encoding="utf-8") as fh:
        label_map = json.load(fh)
    id_to_label = {v: k for k, v in label_map.items()}

    print("\n  Label map:")
    print(json.dumps(label_map, indent=2))

    print("\n" + "=" * 60)
    print("STEP 2: Running predictions on the test set...")
    print("=" * 60)
    probs = model.predict(X_test, batch_size=256, verbose=1)
    y_pred = np.argmax(probs, axis=1)

    print("\n" + "=" * 60)
    print("STEP 3: Calculating evaluation metrics...")
    print("=" * 60)
    metrics = evaluate_predictions(y_test, y_pred)
    metrics_readable = {
        "accuracy": round(metrics["accuracy"], 4),
        "precision_macro": round(metrics["precision_macro"], 4),
        "recall_macro": round(metrics["recall_macro"], 4),
        "f1_macro": round(metrics["f1_macro"], 4),
        "confusion_matrix": metrics["confusion_matrix"],
        "labels": [id_to_label[idx] for idx in sorted(id_to_label)],
    }
    print(json.dumps(metrics_readable, indent=2))

    metrics_path = os.path.join(script_dir, f"metrics_{prefix}_classification.json")
    with open(metrics_path, "w", encoding="utf-8") as fh:
        json.dump(metrics_readable, fh, indent=2)
    print(f"\n  Saved metrics: {metrics_path}")

    print("\n" + "=" * 60)
    print("STEP 4: Saving confusion matrix diagram...")
    print("=" * 60)

    cm = np.array(metrics["confusion_matrix"])
    labels = [id_to_label[idx] for idx in sorted(id_to_label)]
    cm_chart_path = os.path.join(script_dir, f"output_20_{prefix}_classification_confusion_matrix.png")

    fig, ax = plt.subplots(figsize=(8, 6))
    image = ax.imshow(cm, cmap="Blues")
    fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)
    ax.set_xticks(np.arange(len(labels)))
    ax.set_yticks(np.arange(len(labels)))
    ax.set_xticklabels(labels, rotation=35, ha="right")
    ax.set_yticklabels(labels)
    ax.set_xlabel("Predicted label")
    ax.set_ylabel("Actual label")
    ax.set_title(f"{prefix.title()} Classification Confusion Matrix")

    threshold = cm.max() / 2 if cm.size else 0
    for row in range(cm.shape[0]):
        for col in range(cm.shape[1]):
            color = "white" if cm[row, col] > threshold else "black"
            ax.text(col, row, str(cm[row, col]), ha="center", va="center", color=color)

    plt.tight_layout()
    plt.savefig(cm_chart_path, dpi=140)
    plt.close(fig)
    print(f"  Saved confusion matrix: {cm_chart_path}")

    print("\n" + "=" * 60)
    print("STEP 5: Saving prediction chart...")
    print("=" * 60)
    chart_path = os.path.join(script_dir, f"output_20_{prefix}_classification_predictions.png")

    show_n = min(200, len(y_test))
    plt.figure(figsize=(14, 5))
    plt.plot(y_test[:show_n], label="Actual Class", linewidth=1.5, color="darkorange")
    plt.plot(y_pred[:show_n], label="Predicted Class", linewidth=1.2, color="steelblue", alpha=0.8)
    plt.yticks(sorted(id_to_label), [id_to_label[idx] for idx in sorted(id_to_label)])
    plt.xlabel("Sample Index")
    plt.ylabel("Class")
    plt.title(
        "4-Class Activity Classifier | "
        f"Acc={metrics['accuracy']:.3f} "
        f"F1={metrics['f1_macro']:.3f}"
    )
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(chart_path, dpi=120)
    plt.close()
    print(f"  Saved prediction chart: {chart_path}")

    print("\n" + "=" * 60)
    print("SCRIPT 20 COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
