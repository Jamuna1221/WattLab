import json
import os

import matplotlib.pyplot as plt
import pandas as pd

from disaggregation_pipeline import add_common_features, save_normalisation_params


DATA_FOLDER = "house_1"
DEFAULT_RESAMPLE_SECONDS = 6
DEFAULT_FILL_LIMIT = 30

APPLIANCE_CHANNELS = {
    "kettle": "channel_10.dat",
    "washing_machine": "channel_5.dat",
    "fridge": "channel_12.dat",
    "dishwasher": "channel_6.dat",
    "microwave": "channel_13.dat",
}


def load_ukdale_dat_file(filename, data_folder=DATA_FOLDER):
    filepath = os.path.join(data_folder, filename)
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"{filepath} not found")

    df = pd.read_csv(filepath, sep=r"\s+", names=["timestamp", "power"])
    df["datetime"] = pd.to_datetime(df["timestamp"], unit="s")
    df.set_index("datetime", inplace=True)
    df.drop(columns=["timestamp"], inplace=True)
    return df[["power"]]


def preprocess_ukdale_appliance(appliance, data_folder=DATA_FOLDER, resample_seconds=DEFAULT_RESAMPLE_SECONDS, fill_limit=DEFAULT_FILL_LIMIT):
    appliance = appliance.strip().lower()
    if appliance not in APPLIANCE_CHANNELS:
        available = ", ".join(sorted(APPLIANCE_CHANNELS))
        raise ValueError(f"Unsupported appliance '{appliance}'. Available: {available}")

    agg = load_ukdale_dat_file("channel_1.dat", data_folder=data_folder)
    app = load_ukdale_dat_file(APPLIANCE_CHANNELS[appliance], data_folder=data_folder)

    agg_raw_rows = int(len(agg))
    app_raw_rows = int(len(app))
    agg_negative = int((agg["power"] < 0).sum())
    app_negative = int((app["power"] < 0).sum())

    agg = agg.resample(f"{resample_seconds}s").mean().rename(columns={"power": "agg_power"})
    app = app.resample(f"{resample_seconds}s").mean().rename(columns={"power": f"{appliance}_power"})

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


def save_ukdale_outputs(script_dir, appliance, processed_df, summary):
    processed_path = os.path.join(script_dir, f"processed_{appliance}.csv")
    features_path = os.path.join(script_dir, f"features_{appliance}.csv")
    summary_path = os.path.join(script_dir, f"ukdale_{appliance}_data_summary.json")
    chart_path = os.path.join(script_dir, f"output_16_{appliance}_ukdale_cleaning.png")

    features_df = add_common_features(processed_df)
    processed_df.to_csv(processed_path, index_label="datetime")
    features_df.to_csv(features_path, index_label="datetime")

    global_norm_path, appliance_norm_path = save_normalisation_params(
        script_dir,
        appliance,
        agg_max=summary["agg_max"],
        appliance_max=summary[f"{appliance}_max"],
    )

    summary.update({
        "processed_file": processed_path,
        "features_file": features_path,
        "normalisation_file": appliance_norm_path,
        "global_normalisation_file": global_norm_path,
        "feature_rows_after_dropna": int(len(features_df)),
        "data_source": "UK-DALE",
    })

    with open(summary_path, "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2)

    sample = processed_df.iloc[: min(len(processed_df), 3000)]
    fig, axes = plt.subplots(2, 1, figsize=(14, 7), sharex=True)
    axes[0].plot(sample.index, sample["agg_power"], color="steelblue", linewidth=0.8)
    axes[0].set_title("Aggregate Power After UK-DALE Cleaning")
    axes[0].set_ylabel("Watts")
    axes[0].grid(True, alpha=0.3)

    axes[1].plot(sample.index, sample[f"{appliance}_power"], color="orangered", linewidth=0.8)
    axes[1].set_title(f"{appliance} Power After UK-DALE Cleaning")
    axes[1].set_ylabel("Watts")
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(chart_path, dpi=120)
    plt.close(fig)

    return {
        "processed_path": processed_path,
        "features_path": features_path,
        "summary_path": summary_path,
        "chart_path": chart_path,
        "summary": summary,
    }
