import json
import os

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_class_weight
from tensorflow import keras
from tensorflow.keras import layers


DEFAULT_WINDOW_SIZE = 31
DEFAULT_RESAMPLE_SECONDS = 0
SUPPORTED_LABELS = ["idle", "bulb_only", "other_only", "bulb_plus_other"]


def load_classification_csv(path):
    print("=" * 60)
    print("STEP 1: Loading exported classification CSV...")
    print("=" * 60)
    print(f"  Input file: {path}")

    df = pd.read_csv(path)
    print(f"  Rows loaded : {len(df):,}")
    print(f"  Columns     : {list(df.columns)}")

    required = {"timestamp", "power", "appliance_label"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce", utc=True, format="mixed")
    df["power"] = pd.to_numeric(df["power"], errors="coerce")
    df["appliance_label"] = df["appliance_label"].astype(str).str.strip().str.lower()

    before_drop = len(df)
    df.dropna(subset=["timestamp", "power", "appliance_label"], inplace=True)
    dropped = before_drop - len(df)
    if dropped:
        print(f"  Dropped rows with invalid timestamp/power/label: {dropped:,}")

    df = df[df["appliance_label"].isin(SUPPORTED_LABELS)].copy()
    if df.empty:
        raise ValueError(f"No rows found for supported labels: {SUPPORTED_LABELS}")

    print("\n  Label counts before preprocessing:")
    print(df["appliance_label"].value_counts().sort_index().to_string())
    return df


def preprocess_classification_dataframe(df, resample_seconds=DEFAULT_RESAMPLE_SECONDS):
    print("\n" + "=" * 60)
    print("STEP 2: Cleaning and resampling labeled data...")
    print("=" * 60)

    df = df.sort_values("timestamp").copy()
    negative_count = int((df["power"] < 0).sum())
    if negative_count:
        print(f"  Negative power rows clipped to 0: {negative_count:,}")
    df["power"] = df["power"].clip(lower=0)

    if not resample_seconds or resample_seconds <= 0:
        processed = df.sort_values("timestamp").reset_index(drop=True)
        print("  Resampling skipped; keeping exported rows as individual samples.")
        print("\n  Per-label summary:")
        for label in SUPPORTED_LABELS:
            label_df = processed[processed["appliance_label"] == label]
            if label_df.empty:
                continue
            print(
                f"  - {label:<16} rows={len(label_df):,} "
                f"avg={label_df['power'].mean():.2f}W max={label_df['power'].max():.2f}W"
            )

        print("\n  Label counts after preprocessing:")
        print(processed["appliance_label"].value_counts().sort_index().to_string())
        return processed

    processed_parts = []
    label_summaries = []

    for label in SUPPORTED_LABELS:
        label_df = df[df["appliance_label"] == label].copy()
        if label_df.empty:
            continue

        label_df = label_df.set_index("timestamp")[["power"]].sort_index()
        raw_rows = len(label_df)
        label_df = label_df.resample(f"{resample_seconds}s").mean()
        missing_after_resample = int(label_df["power"].isna().sum())
        label_df["power"] = label_df["power"].ffill(limit=5)
        label_df.dropna(inplace=True)
        label_df["appliance_label"] = label
        processed_parts.append(label_df.reset_index())

        label_summaries.append({
            "label": label,
            "raw_rows": int(raw_rows),
            "rows_after_resample": int(len(label_df)),
            "missing_after_resample": int(missing_after_resample),
            "avg_power_watts": round(float(label_df["power"].mean()), 3),
            "max_power_watts": round(float(label_df["power"].max()), 3),
        })

    if not processed_parts:
        raise ValueError("No labeled rows remained after preprocessing")

    processed = pd.concat(processed_parts, ignore_index=True)
    processed = processed.sort_values("timestamp").reset_index(drop=True)

    print("  Per-label summary:")
    for item in label_summaries:
        print(
            f"  - {item['label']:<16} raw={item['raw_rows']:,} "
            f"resampled={item['rows_after_resample']:,} "
            f"avg={item['avg_power_watts']:.2f}W max={item['max_power_watts']:.2f}W"
        )

    print("\n  Label counts after preprocessing:")
    print(processed["appliance_label"].value_counts().sort_index().to_string())

    return processed


def save_classification_outputs(script_dir, processed_df, prefix="bulb"):
    print("\n" + "=" * 60)
    print("STEP 3: Saving processed classification dataset...")
    print("=" * 60)

    processed_path = os.path.join(script_dir, f"processed_{prefix}_classification_dataset.csv")
    label_map_path = os.path.join(script_dir, f"{prefix}_classification_label_map.json")
    summary_path = os.path.join(script_dir, f"{prefix}_classification_data_summary.json")

    label_to_id = {label: idx for idx, label in enumerate(SUPPORTED_LABELS)}
    processed_df = processed_df.copy()
    processed_df["label_id"] = processed_df["appliance_label"].map(label_to_id)
    processed_df.to_csv(processed_path, index=False)

    with open(label_map_path, "w", encoding="utf-8") as fh:
        json.dump(label_to_id, fh, indent=2)

    summary = {
        "rows": int(len(processed_df)),
        "labels": label_to_id,
        "counts": processed_df["appliance_label"].value_counts().sort_index().to_dict(),
        "min_power": round(float(processed_df["power"].min()), 4),
        "max_power": round(float(processed_df["power"].max()), 4),
        "avg_power": round(float(processed_df["power"].mean()), 4),
    }
    with open(summary_path, "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2)

    print(f"  Saved processed dataset : {processed_path}")
    print(f"  Saved label map         : {label_map_path}")
    print(f"  Saved summary           : {summary_path}")
    return processed_path, label_map_path, summary_path


def create_classification_windows(df, window_size=DEFAULT_WINDOW_SIZE):
    print("\n" + "=" * 60)
    print("STEP 4: Creating sliding windows for classification...")
    print("=" * 60)
    print(f"  Window size: {window_size}")

    if window_size % 2 == 0:
        raise ValueError("window_size must be odd")

    centre = window_size // 2
    powers = df["power"].to_numpy(dtype=np.float32)
    power_max = float(np.max(powers)) if len(powers) else 1.0
    power_max = max(power_max, 1.0)

    X = []
    y = []
    window_counts = {}
    for label_id, label_df in df.groupby("label_id", sort=True):
        label_powers = label_df["power"].to_numpy(dtype=np.float32) / power_max
        if len(label_powers) < window_size:
            window_counts[int(label_id)] = 0
            continue

        count = 0
        for i in range(centre, len(label_df) - centre):
            X.append(label_powers[i - centre:i + centre + 1])
            y.append(int(label_id))
            count += 1
        window_counts[int(label_id)] = count

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.int32)

    if len(X) == 0:
        raise ValueError("Not enough rows to create windows")

    X = X.reshape(X.shape[0], X.shape[1], 1)

    print(f"  Power max used for normalization: {power_max:.4f} W")
    print("  Windows created per class id:")
    for label_id, count in sorted(window_counts.items()):
        print(f"  - class {label_id}: {count:,}")
    print(f"  X shape: {X.shape}")
    print(f"  y shape: {y.shape}")
    return X, y, power_max


def split_classification_windows(X, y):
    print("\n" + "=" * 60)
    print("STEP 5: Splitting into train/validation/test...")
    print("=" * 60)

    X_train, X_tmp, y_train, y_tmp = train_test_split(
        X,
        y,
        test_size=0.30,
        random_state=42,
        stratify=y,
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_tmp,
        y_tmp,
        test_size=0.50,
        random_state=42,
        stratify=y_tmp,
    )

    split = {
        "X_train": X_train,
        "y_train": y_train,
        "X_val": X_val,
        "y_val": y_val,
        "X_test": X_test,
        "y_test": y_test,
    }

    print(f"  Total windows : {len(X):,}")
    print(f"  Train windows : {len(split['X_train']):,}")
    print(f"  Val windows   : {len(split['X_val']):,}")
    print(f"  Test windows  : {len(split['X_test']):,}")
    print("\n  Train label distribution:")
    for label_id, count in zip(*np.unique(y_train, return_counts=True)):
        print(f"  - class {int(label_id)}: {int(count):,}")
    print("\n  Validation label distribution:")
    for label_id, count in zip(*np.unique(y_val, return_counts=True)):
        print(f"  - class {int(label_id)}: {int(count):,}")
    print("\n  Test label distribution:")
    for label_id, count in zip(*np.unique(y_test, return_counts=True)):
        print(f"  - class {int(label_id)}: {int(count):,}")
    return split


def compute_class_weights(y_train, num_classes):
    classes = np.unique(y_train)
    weights = compute_class_weight(class_weight="balanced", classes=classes, y=y_train)
    return {int(cls): float(weight) for cls, weight in zip(classes, weights)}


def build_classification_model(window_size, num_classes):
    model = keras.Sequential([
        layers.Input(shape=(window_size, 1)),
        layers.Conv1D(32, kernel_size=5, activation="relu", padding="same"),
        layers.MaxPooling1D(pool_size=2),
        layers.LSTM(64, return_sequences=False),
        layers.Dropout(0.3),
        layers.Dense(64, activation="relu"),
        layers.Dense(num_classes, activation="softmax"),
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def evaluate_predictions(y_true, y_pred):
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_macro": float(precision_score(y_true, y_pred, average="macro", zero_division=0)),
        "recall_macro": float(recall_score(y_true, y_pred, average="macro", zero_division=0)),
        "f1_macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
    }
