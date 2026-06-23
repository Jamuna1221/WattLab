import json
import math
import os
import urllib.parse
import urllib.request

import numpy as np
import pandas as pd
from tensorflow import keras
from tensorflow.keras import layers

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(path):
        if not path or not os.path.exists(path):
            return False

        with open(path, "r", encoding="utf-8") as fh:
            for raw_line in fh:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                os.environ.setdefault(key, value)
        return True


WINDOW_SIZE = 599
CENTRE = WINDOW_SIZE // 2
DEFAULT_RESAMPLE_SECONDS = 6
DEFAULT_FILL_LIMIT = 30


def load_supabase_env():
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    load_dotenv(env_path)

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend-python/.env")

    return {
        "url": url.rstrip("/"),
        "key": key,
    }


def supabase_rest_get(path, query, range_start=0, range_end=999):
    env = load_supabase_env()
    base_url = f"{env['url']}/rest/v1/{path}"
    query_string = urllib.parse.urlencode(query, doseq=True, safe="(),.*")
    url = f"{base_url}?{query_string}"
    request = urllib.request.Request(url)
    request.add_header("apikey", env["key"])
    request.add_header("Authorization", f"Bearer {env['key']}")
    request.add_header("Range-Unit", "items")
    request.add_header("Range", f"{range_start}-{range_end}")
    request.add_header("Accept", "application/json")
    request.add_header("Prefer", "count=exact")

    with urllib.request.urlopen(request) as response:
        body = response.read().decode("utf-8")
        content_range = response.headers.get("Content-Range", "")
        return json.loads(body or "[]"), content_range


def fetch_energy_readings(device_id, stream_type=None, appliance_label=None, start=None, end=None, batch_size=1000):
    rows = []
    offset = 0

    while True:
        query = {
            "select": "timestamp,power,stream_type,appliance_label",
            "device_id": f"eq.{device_id}",
            "order": "timestamp.asc",
        }
        if stream_type:
            query["stream_type"] = f"eq.{stream_type}"
        if appliance_label:
            query["appliance_label"] = f"eq.{appliance_label}"
        if start:
            query["timestamp"] = f"gte.{start}"
        if end:
            query["timestamp"] = [query.get("timestamp"), f"lte.{end}"] if query.get("timestamp") else f"lte.{end}"

        flat_query = {}
        for key, value in query.items():
            if isinstance(value, list):
                flat_query[key] = value
            else:
                flat_query[key] = value

        batch, _ = supabase_rest_get(
            "energy_readings",
            flat_query,
            range_start=offset,
            range_end=offset + batch_size - 1,
        )
        rows.extend(batch)

        if len(batch) < batch_size:
            break
        offset += batch_size

    return rows


def rows_to_power_dataframe(rows):
    df = pd.DataFrame(rows)
    if df.empty:
        return pd.DataFrame(columns=["power"])

    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    df.dropna(subset=["timestamp"], inplace=True)
    df["power"] = pd.to_numeric(df["power"], errors="coerce")
    df.dropna(subset=["power"], inplace=True)
    df.set_index("timestamp", inplace=True)
    return df[["power"]].sort_index()


def preprocess_supabase_pair(aggregate_df, appliance_df, appliance, resample_seconds=DEFAULT_RESAMPLE_SECONDS, fill_limit=DEFAULT_FILL_LIMIT):
    if aggregate_df.empty:
        raise ValueError("No aggregate readings found for the selected device/time range")
    if appliance_df.empty:
        raise ValueError(f"No {appliance} readings found for the selected device/time range")

    agg_raw_rows = int(len(aggregate_df))
    app_raw_rows = int(len(appliance_df))
    agg_negative = int((aggregate_df["power"] < 0).sum())
    app_negative = int((appliance_df["power"] < 0).sum())

    agg = aggregate_df.resample(f"{resample_seconds}s").mean().rename(columns={"power": "agg_power"})
    app = appliance_df.resample(f"{resample_seconds}s").mean().rename(columns={"power": f"{appliance}_power"})

    agg_missing_before = int(agg["agg_power"].isna().sum())
    app_missing_before = int(app[f"{appliance}_power"].isna().sum())

    agg["agg_power"] = agg["agg_power"].ffill(limit=fill_limit)
    app[f"{appliance}_power"] = app[f"{appliance}_power"].ffill(limit=fill_limit)

    df = pd.merge(agg, app, left_index=True, right_index=True, how="inner")
    df.dropna(inplace=True)
    df = df.clip(lower=0)

    agg_max = float(df["agg_power"].max())
    appliance_max = float(df[f"{appliance}_power"].max())
    df["agg_norm"] = df["agg_power"] / max(agg_max, 1.0)
    df[f"{appliance}_norm"] = df[f"{appliance}_power"] / max(appliance_max, 1.0)

    summary = {
        "appliance": appliance,
        "aggregate_rows_raw": agg_raw_rows,
        "appliance_rows_raw": app_raw_rows,
        "rows_after_merge": int(len(df)),
        "aggregate_negative_values_clipped": agg_negative,
        "appliance_negative_values_clipped": app_negative,
        "aggregate_missing_before_fill": agg_missing_before,
        "appliance_missing_before_fill": app_missing_before,
        "resample_seconds": int(resample_seconds),
        "fill_limit": int(fill_limit),
        "agg_max": round(agg_max, 3),
        f"{appliance}_max": round(appliance_max, 3),
    }
    return df, summary


def add_common_features(df):
    enriched = df.copy()
    enriched["hour"] = enriched.index.hour
    enriched["day_of_week"] = enriched.index.dayofweek
    enriched["is_weekend"] = (enriched["day_of_week"] >= 5).astype(int)
    enriched["rolling_mean_1h"] = enriched["agg_norm"].rolling(window=600).mean()
    enriched["rolling_std_1h"] = enriched["agg_norm"].rolling(window=600).std()
    threshold = enriched["agg_norm"].quantile(0.8)
    enriched["is_peak"] = (enriched["agg_norm"] > threshold).astype(int)
    enriched.dropna(inplace=True)
    return enriched


def save_normalisation_params(ml_dir, appliance, agg_max, appliance_max):
    global_path = os.path.join(ml_dir, "normalisation_params.json")
    params = {}
    if os.path.exists(global_path):
        with open(global_path, "r", encoding="utf-8") as fh:
            params = json.load(fh)

    params["agg_max"] = max(float(params.get("agg_max", 0.0)), float(agg_max))
    params[f"{appliance}_max"] = float(appliance_max)

    with open(global_path, "w", encoding="utf-8") as fh:
        json.dump(params, fh, indent=2)

    appliance_path = os.path.join(ml_dir, f"normalisation_params_{appliance}.json")
    with open(appliance_path, "w", encoding="utf-8") as fh:
        json.dump({"agg_max": float(agg_max), f"{appliance}_max": float(appliance_max)}, fh, indent=2)

    return global_path, appliance_path


def create_windows_from_dataframe(df, appliance, window_size=WINDOW_SIZE):
    centre = window_size // 2
    agg_values = df["agg_norm"].values
    target_values = df[f"{appliance}_norm"].values

    X = []
    y = []
    for i in range(centre, len(df) - centre):
        X.append(agg_values[i - centre:i + centre + 1])
        y.append(target_values[i])

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.float32)
    if len(X) == 0:
        raise ValueError("Not enough rows to create sliding windows")

    X = X.reshape(X.shape[0], X.shape[1], 1)
    return X, y


def split_windows(X, y):
    n = len(X)
    train_end = int(n * 0.70)
    val_end = int(n * 0.85)
    return {
        "X_train": X[:train_end],
        "y_train": y[:train_end],
        "X_val": X[train_end:val_end],
        "y_val": y[train_end:val_end],
        "X_test": X[val_end:],
        "y_test": y[val_end:],
    }


def build_s2p_lstm(window_size=WINDOW_SIZE):
    model = keras.Sequential([
        layers.LSTM(256, return_sequences=True, input_shape=(window_size, 1)),
        layers.Dropout(0.2),
        layers.LSTM(128, return_sequences=False),
        layers.Dropout(0.2),
        layers.Dense(64, activation="relu"),
        layers.Dense(1, activation="linear"),
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss="mean_squared_error",
        metrics=["mae"],
    )
    return model
