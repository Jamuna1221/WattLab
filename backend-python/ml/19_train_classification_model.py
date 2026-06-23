import argparse
import json
import os

import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf
from tensorflow import keras

from classification_pipeline import build_classification_model, compute_class_weights


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train the 4-class bulb activity classifier with detailed stage output."
    )
    parser.add_argument("--epochs", type=int, default=30, help="Maximum training epochs")
    parser.add_argument("--batch-size", type=int, default=128, help="Training batch size")
    parser.add_argument("--prefix", default="bulb", help="Input/output prefix, for example bulb")
    return parser.parse_args()


def main():
    args = parse_args()
    script_dir = os.path.dirname(__file__)
    prefix = args.prefix.strip().lower()

    print("=" * 60)
    print("STEP 1: Environment check")
    print("=" * 60)
    print(f"  TensorFlow version : {tf.__version__}")
    print(f"  GPU available      : {len(tf.config.list_physical_devices('GPU')) > 0}")

    print("\n" + "=" * 60)
    print("STEP 2: Loading train/val arrays...")
    print("=" * 60)

    X_train = np.load(os.path.join(script_dir, f"X_train_{prefix}_classification.npy"))
    y_train = np.load(os.path.join(script_dir, f"y_train_{prefix}_classification.npy"))
    X_val = np.load(os.path.join(script_dir, f"X_val_{prefix}_classification.npy"))
    y_val = np.load(os.path.join(script_dir, f"y_val_{prefix}_classification.npy"))

    print(f"  X_train shape: {X_train.shape}")
    print(f"  y_train shape: {y_train.shape}")
    print(f"  X_val shape  : {X_val.shape}")
    print(f"  y_val shape  : {y_val.shape}")

    with open(os.path.join(script_dir, f"{prefix}_classification_label_map.json"), "r", encoding="utf-8") as fh:
        label_map = json.load(fh)
    id_to_label = {v: k for k, v in label_map.items()}
    num_classes = len(label_map)

    print("\n  Label map:")
    print(json.dumps(label_map, indent=2))

    print("\n  Training label distribution:")
    train_counts = {id_to_label[int(idx)]: int(count) for idx, count in zip(*np.unique(y_train, return_counts=True))}
    print(json.dumps(train_counts, indent=2))

    class_weights = compute_class_weights(y_train, num_classes=num_classes)
    class_weights_readable = {id_to_label[int(k)]: round(v, 4) for k, v in class_weights.items()}
    print("\n  Computed class weights:")
    print(json.dumps(class_weights_readable, indent=2))

    print("\n" + "=" * 60)
    print("STEP 3: Building model...")
    print("=" * 60)
    model = build_classification_model(window_size=X_train.shape[1], num_classes=num_classes)
    model.summary()

    print("\n" + "=" * 60)
    print("STEP 4: Training model...")
    print("=" * 60)

    best_model_path = os.path.join(script_dir, f"best_{prefix}_classification_model.keras")
    final_model_path = os.path.join(script_dir, f"{prefix}_classification_model_final.keras")
    history_plot_path = os.path.join(script_dir, f"output_19_{prefix}_classification_training_history.png")

    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=5,
            restore_best_weights=True,
            verbose=1,
        ),
        keras.callbacks.ModelCheckpoint(
            best_model_path,
            monitor="val_loss",
            save_best_only=True,
            verbose=1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=3,
            verbose=1,
        ),
    ]

    history = model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch_size,
        class_weight=class_weights,
        verbose=1,
        callbacks=callbacks,
    )

    print("\n" + "=" * 60)
    print("STEP 5: Saving model + history plot...")
    print("=" * 60)

    model.save(final_model_path)
    print(f"  Saved final model: {final_model_path}")
    print(f"  Saved best model : {best_model_path}")

    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    axes[0].plot(history.history["loss"], label="Train Loss")
    axes[0].plot(history.history["val_loss"], label="Val Loss")
    axes[0].set_title("Loss")
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    axes[1].plot(history.history["accuracy"], label="Train Accuracy")
    axes[1].plot(history.history["val_accuracy"], label="Val Accuracy")
    axes[1].set_title("Accuracy")
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(history_plot_path, dpi=120)
    plt.close(fig)
    print(f"  Saved training chart: {history_plot_path}")

    last_metrics = {
        "train_accuracy_last_epoch": round(float(history.history["accuracy"][-1]), 4),
        "val_accuracy_last_epoch": round(float(history.history["val_accuracy"][-1]), 4),
        "train_loss_last_epoch": round(float(history.history["loss"][-1]), 4),
        "val_loss_last_epoch": round(float(history.history["val_loss"][-1]), 4),
    }
    with open(os.path.join(script_dir, f"{prefix}_classification_train_summary.json"), "w", encoding="utf-8") as fh:
        json.dump(last_metrics, fh, indent=2)
    print("\n  Final training summary:")
    print(json.dumps(last_metrics, indent=2))

    print("\n" + "=" * 60)
    print("SCRIPT 19 COMPLETE")
    print(f"Next step: Run python 20_evaluate_classification_model.py --prefix {prefix}")
    print("=" * 60)


if __name__ == "__main__":
    main()
