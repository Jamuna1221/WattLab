import csv
import json
import os

import numpy as np
import pandas as pd
from tensorflow import keras
from tensorflow.keras import layers


DEFAULT_WINDOW_SIZE = 30
DEFAULT_MIN_TRAINING_SAMPLES = 200
DEFAULT_MIN_WINDOWS = 100
DEFAULT_EPOCHS = 20
DEFAULT_BATCH_SIZE = 32
DEFAULT_VALIDATION_SPLIT = 0.2


def sanitize_readings(readings):
    arr = np.array(readings, dtype=np.float32).reshape(-1)
    if arr.size == 0:
        return arr
    return np.clip(arr, 0.0, None)


def load_state_series_file(path):
    ext = os.path.splitext(path)[1].lower()

    if ext == ".dat":
        df = pd.read_csv(path, sep=r"\s+", names=["timestamp", "power"])
        df["datetime"] = pd.to_datetime(df["timestamp"], unit="s")
        df.set_index("datetime", inplace=True)
        df.drop(columns=["timestamp"], inplace=True)
        return df[["power"]]

    if ext == ".csv":
        preview = pd.read_csv(path, nrows=5)
        lowered = {str(col).strip().lower(): col for col in preview.columns}
        if "timestamp" in lowered and "power" in lowered:
            df = pd.read_csv(path)
            df.rename(columns={lowered["timestamp"]: "timestamp", lowered["power"]: "power"}, inplace=True)
            df["datetime"] = pd.to_datetime(df["timestamp"])
            df.set_index("datetime", inplace=True)
            return df[["power"]]

        if "datetime" in lowered and "power" in lowered:
            df = pd.read_csv(path)
            df.rename(columns={lowered["datetime"]: "datetime", lowered["power"]: "power"}, inplace=True)
            df["datetime"] = pd.to_datetime(df["datetime"])
            df.set_index("datetime", inplace=True)
            return df[["power"]]

        try:
            df = pd.read_csv(path, header=None, names=["timestamp", "power"])
            df["datetime"] = pd.to_datetime(df["timestamp"], unit="s")
            df.set_index("datetime", inplace=True)
            df.drop(columns=["timestamp"], inplace=True)
            return df[["power"]]
        except Exception as exc:
            raise ValueError(f"could not parse timestamped CSV file: {path}") from exc

    raise ValueError(f"unsupported timestamped file type: {ext}")


def preprocess_state_series_dataframe(df, resample_seconds=6, fill_limit=30):
    clean = df.copy()
    if "power" not in clean.columns:
        raise ValueError("expected dataframe with a 'power' column")

    clean.sort_index(inplace=True)
    rows_before = int(len(clean))
    negative_before = int((clean["power"] < 0).sum())

    clean = clean.resample(f"{resample_seconds}s").mean()
    missing_before = int(clean["power"].isna().sum())
    clean["power"] = clean["power"].ffill(limit=fill_limit)
    clean.dropna(inplace=True)
    missing_after = int(clean["power"].isna().sum())
    clean["power"] = clean["power"].clip(lower=0)

    summary = {
        "rows_before": rows_before,
        "rows_after": int(len(clean)),
        "negative_values_clipped": negative_before,
        "missing_values_before_fill": missing_before,
        "missing_values_after_fill": missing_after,
        "resample_seconds": int(resample_seconds),
        "fill_limit": int(fill_limit),
    }
    return clean, summary


def extract_state_features(readings, on_threshold_watts):
    arr = sanitize_readings(readings)
    if arr.size < 10:
        raise ValueError(f"readings must have at least 10 values, got {arr.size}")

    return np.array([[
        float(np.mean(arr)),
        float(np.max(arr)),
        float(np.std(arr)),
        float(np.mean(arr >= on_threshold_watts)),
    ]], dtype=np.float32)


def build_state_training_dataset(
    readings,
    on_threshold_watts,
    window_size=DEFAULT_WINDOW_SIZE,
    min_training_samples=DEFAULT_MIN_TRAINING_SAMPLES,
    min_windows=DEFAULT_MIN_WINDOWS,
):
    arr = sanitize_readings(readings)
    if arr.size < min_training_samples:
        raise ValueError(f"readings must have at least {min_training_samples} values, got {arr.size}")

    X = []
    y = []
    for i in range(window_size, len(arr)):
        window = arr[i - window_size:i]
        X.append([
            float(np.mean(window)),
            float(np.max(window)),
            float(np.std(window)),
            float(np.mean(window >= on_threshold_watts)),
        ])
        y.append(1.0 if arr[i] >= on_threshold_watts else 0.0)

    if len(X) < min_windows:
        raise ValueError(f"not enough windows to train, got {len(X)}")

    return (
        np.array(X, dtype=np.float32),
        np.array(y, dtype=np.float32),
        arr,
    )


def build_state_model():
    model = keras.Sequential([
        layers.Input(shape=(4,)),
        layers.Dense(16, activation="relu"),
        layers.Dense(8, activation="relu"),
        layers.Dense(1, activation="sigmoid"),
    ])
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    return model


def train_state_model(
    readings,
    model_path,
    on_threshold_watts,
    window_size=DEFAULT_WINDOW_SIZE,
    epochs=DEFAULT_EPOCHS,
    batch_size=DEFAULT_BATCH_SIZE,
    validation_split=DEFAULT_VALIDATION_SPLIT,
):
    X, y, arr = build_state_training_dataset(
        readings,
        on_threshold_watts=on_threshold_watts,
        window_size=window_size,
    )
    model = build_state_model()
    history = model.fit(
        X,
        y,
        epochs=epochs,
        batch_size=batch_size,
        validation_split=validation_split,
        verbose=0,
    )

    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    model.save(model_path)
    reloaded = keras.models.load_model(model_path, compile=False)

    train_acc = float(history.history["accuracy"][-1])
    val_acc = float(history.history.get("val_accuracy", [train_acc])[-1])

    return {
        "model": reloaded,
        "summary": {
            "status": "trained",
            "samples": int(len(arr)),
            "windows": int(len(X)),
            "on_threshold_watts": float(on_threshold_watts),
            "train_accuracy": round(train_acc, 4),
            "val_accuracy": round(val_acc, 4),
            "model_path": model_path,
        },
    }


def load_state_model(model_path):
    if not os.path.exists(model_path):
        return None
    return keras.models.load_model(model_path, compile=False)


def predict_state_probability(readings, model, on_threshold_watts):
    arr = sanitize_readings(readings)
    if arr.size < 10:
        raise ValueError(f"readings must have at least 10 values, got {arr.size}")

    if model is None:
        avg_power = float(np.mean(arr))
        return min(1.0, max(0.0, avg_power / max(on_threshold_watts * 2.0, 1.0)))

    feature_vec = extract_state_features(arr, on_threshold_watts)
    return float(model.predict(feature_vec, verbose=0)[0][0])


def build_state_prediction_payload(readings, model, on_threshold_watts, model_used):
    arr = sanitize_readings(readings)
    on_probability = predict_state_probability(arr, model, on_threshold_watts)
    state = "on" if on_probability >= 0.5 else "off"
    confidence = float(max(on_probability, 1.0 - on_probability))

    return {
        "state": state,
        "on_probability": round(on_probability, 4),
        "confidence": round(confidence, 4),
        "avg_power_watts": round(float(np.mean(arr)), 3),
        "samples": int(len(arr)),
        "model_used": model_used,
    }


def load_readings_file(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".json":
        with open(path, "r", encoding="utf-8") as fh:
            payload = json.load(fh)
        if isinstance(payload, dict):
            values = payload.get("readings", [])
        else:
            values = payload
        return sanitize_readings(values).tolist()

    if ext == ".npy":
        return sanitize_readings(np.load(path)).tolist()

    if ext == ".csv":
        try:
            df = pd.read_csv(path)
            lowered = {str(col).strip().lower(): col for col in df.columns}
            if "power" in lowered:
                return sanitize_readings(df[lowered["power"]].values).tolist()
        except Exception:
            pass

    if ext in {".csv", ".txt"}:
        values = []
        with open(path, "r", encoding="utf-8", newline="") as fh:
            reader = csv.reader(fh)
            for row in reader:
                if not row:
                    continue
                try:
                    values.append(float(row[0]))
                except ValueError:
                    continue
        return sanitize_readings(values).tolist()

    raise ValueError(f"unsupported readings file type: {ext}")
