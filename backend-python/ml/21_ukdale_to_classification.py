import argparse
import json
import os

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras

from classification_pipeline import (
    build_classification_model,
    compute_class_weights,
    create_classification_windows,
    evaluate_predictions,
    preprocess_classification_dataframe,
    save_classification_outputs,
    split_classification_windows,
)
from ukdale_pipeline import preprocess_ukdale_appliance


ON_THRESHOLDS = {
    "kettle": 200.0,
    "microwave": 100.0,
    "fridge": 50.0,
    "washing_machine": 20.0,
    "dishwasher": 10.0,
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train a UK-DALE appliance activity classifier end to end."
    )
    parser.add_argument("--appliance", required=True, help="Appliance name, for example fridge")
    parser.add_argument("--data-folder", default="house_1", help="UK-DALE house folder")
    parser.add_argument("--epochs", type=int, default=50, help="Maximum training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Training batch size")
    return parser.parse_args()


def build_supported_labels(appliance):
    return [
        "idle",
        f"{appliance}_only",
        "other_only",
        f"{appliance}_plus_other",
    ]


def add_appliance_labels(df, appliance):
    threshold = ON_THRESHOLDS[appliance]
    appliance_power_col = f"{appliance}_power"

    agg_power = df["agg_power"]
    appliance_power = df[appliance_power_col]
    appliance_on = appliance_power >= threshold

    labels = np.full(len(df), "idle", dtype=object)
    labels[(appliance_power < threshold) & (agg_power >= 200)] = "other_only"
    labels[appliance_on & (agg_power >= 30)] = f"{appliance}_only"
    labels[appliance_on & (agg_power >= 200)] = f"{appliance}_plus_other"
    labels[agg_power < 30] = "idle"

    labeled_df = df.copy()
    labeled_df["appliance_label"] = labels
    return labeled_df


def to_classification_dataframe(df, appliance, supported_labels):
    classification_df = pd.DataFrame({
        "timestamp": df.index,
        "power": df["agg_power"].to_numpy(),
        "appliance_label": df["appliance_label"].to_numpy(),
    })
    classification_df["appliance_label"] = (
        classification_df["appliance_label"].astype(str).str.strip().str.lower()
    )
    classification_df = classification_df[
        classification_df["appliance_label"].isin(supported_labels)
    ].copy()
    if classification_df.empty:
        raise ValueError(f"No rows found for {appliance} labels: {supported_labels}")
    return classification_df


def save_split_arrays(script_dir, appliance, split):
    for name, arr in split.items():
        output_path = os.path.join(script_dir, f"{name}_{appliance}_classification.npy")
        np.save(output_path, arr)
        print(f"  Saved {os.path.basename(output_path):<32} -> {arr.shape}")


def main():
    args = parse_args()
    script_dir = os.path.dirname(__file__)
    appliance = args.appliance.strip().lower()
    if appliance not in ON_THRESHOLDS:
        available = ", ".join(sorted(ON_THRESHOLDS))
        raise ValueError(f"Unsupported appliance '{appliance}'. Available: {available}")

    supported_labels = build_supported_labels(appliance)
    window_size = 61 if appliance == "washing_machine" else 31

    print("=" * 60)
    print(f"UK-DALE to classification model: {appliance}")
    print("=" * 60)
    print(f"  TensorFlow version : {tf.__version__}")
    print(f"  GPU available      : {len(tf.config.list_physical_devices('GPU')) > 0}")
    print(f"  Supported labels   : {supported_labels}")
    print(f"  Window size        : {window_size}")

    print("\n" + "=" * 60)
    print("STEP 1: Loading UK-DALE data...")
    print("=" * 60)
    ukdale_df, ukdale_summary = preprocess_ukdale_appliance(
        appliance=appliance,
        data_folder=args.data_folder,
    )
    print(f"  Rows after merge: {len(ukdale_df):,}")
    print(json.dumps(ukdale_summary, indent=2))

    print("\n" + "=" * 60)
    print("STEP 2: Creating classification labels...")
    print("=" * 60)
    labeled_df = add_appliance_labels(ukdale_df, appliance)
    classification_df = to_classification_dataframe(labeled_df, appliance, supported_labels)
    print("\n  Label counts:")
    print(classification_df["appliance_label"].value_counts().sort_index().to_string())
    # Cap each label to avoid huge datasets and class imbalance
    MAX_ROWS_PER_LABEL = 50_000
    print(f"\n  Capping each label to {MAX_ROWS_PER_LABEL:,} rows...")
    classification_df = (
        classification_df.groupby("appliance_label", group_keys=False)
        .apply(lambda x: x.sample(n=min(len(x), MAX_ROWS_PER_LABEL), random_state=42))
        .reset_index(drop=True)
    )
    print(f"  Dataset size after capping: {len(classification_df):,} rows")
    print(classification_df["appliance_label"].value_counts().to_string())
    processed_df = preprocess_classification_dataframe(
        classification_df,
        supported_labels=supported_labels,
    )
    save_classification_outputs(
        script_dir,
        processed_df,
        prefix=appliance,
        supported_labels=supported_labels,
    )
    # Add label_id column before windowing
    label_to_id = {label: idx for idx, label in enumerate(supported_labels)}
    processed_df["label_id"] = processed_df["appliance_label"].map(label_to_id)
    X, y, power_max = create_classification_windows(
        processed_df,
        window_size=window_size,
        supported_labels=supported_labels,
    )
    split = split_classification_windows(X, y)
    save_split_arrays(script_dir, appliance, split)

    class_weights = compute_class_weights(split["y_train"], num_classes=len(supported_labels))
    print("\n  Class weights:")
    print(json.dumps(class_weights, indent=2))

    print("\n" + "=" * 60)
    print("STEP 6: Training model...")
    print("=" * 60)
    model = build_classification_model(window_size=window_size, num_classes=len(supported_labels))
    model.summary()

    best_model_path = os.path.join(script_dir, f"best_{appliance}_classification_model.keras")
    final_model_path = os.path.join(script_dir, f"{appliance}_classification_model_final.keras")
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
    ]

    history = model.fit(
        split["X_train"],
        split["y_train"],
        validation_data=(split["X_val"], split["y_val"]),
        epochs=args.epochs,
        batch_size=args.batch_size,
        class_weight=class_weights,
        callbacks=callbacks,
        verbose=1,
    )
    model.save(final_model_path)

    train_summary = {
        "appliance": appliance,
        "epochs_trained": int(len(history.history["loss"])),
        "final_train_accuracy": float(history.history["accuracy"][-1]),
        "final_val_accuracy": float(history.history["val_accuracy"][-1]),
        "window_size": int(window_size),
        "num_classes": int(len(supported_labels)),
        "supported_labels": supported_labels,
        "power_max": float(power_max),
    }
    train_summary_path = os.path.join(script_dir, f"{appliance}_classification_train_summary.json")
    with open(train_summary_path, "w", encoding="utf-8") as fh:
        json.dump(train_summary, fh, indent=2)

    windows_meta = {
        "window_size": int(window_size),
        "power_max": float(power_max),
        "rows_used": int(len(processed_df)),
    }
    with open(os.path.join(script_dir, f"{appliance}_classification_windows_meta.json"), "w", encoding="utf-8") as fh:
        json.dump(windows_meta, fh, indent=2)

    print(f"  Saved final model     : {final_model_path}")
    print(f"  Saved best model      : {best_model_path}")
    print(f"  Saved train summary   : {train_summary_path}")

    print("\n" + "=" * 60)
    print("STEP 7: Evaluating model...")
    print("=" * 60)
    y_pred = np.argmax(model.predict(split["X_test"], batch_size=256, verbose=1), axis=1)
    metrics = evaluate_predictions(split["y_test"], y_pred)

    label_map_path = os.path.join(script_dir, f"{appliance}_classification_label_map.json")
    with open(label_map_path, "r", encoding="utf-8") as fh:
        label_to_id = json.load(fh)
    id_to_label = {str(label_id): label for label, label_id in label_to_id.items()}

    metrics.update({
        "appliance": appliance,
        "supported_labels": supported_labels,
        "label_map": id_to_label,
        "test_samples": int(len(split["y_test"])),
    })
    metrics_path = os.path.join(script_dir, f"metrics_{appliance}_classification.json")
    with open(metrics_path, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)

    print("\n  Evaluation summary:")
    print(json.dumps({
        "accuracy": round(metrics["accuracy"], 4),
        "precision_macro": round(metrics["precision_macro"], 4),
        "recall_macro": round(metrics["recall_macro"], 4),
        "f1_macro": round(metrics["f1_macro"], 4),
        "test_samples": metrics["test_samples"],
    }, indent=2))
    print(f"\n  Saved metrics: {metrics_path}")
    print("\n" + "=" * 60)
    print(f"COMPLETE: {appliance} classifier")
    print("=" * 60)


if __name__ == "__main__":
    main()
