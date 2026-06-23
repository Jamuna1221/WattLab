import argparse
import json
import os

import matplotlib.pyplot as plt

from disaggregation_pipeline import (
    add_common_features,
    fetch_energy_readings,
    preprocess_supabase_pair,
    rows_to_power_dataframe,
    save_normalisation_params,
)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Fetch aggregate and appliance readings from Supabase, clean them, and create processed_<appliance>.csv."
    )
    parser.add_argument("--device-id", help="Device ID to use for both aggregate and appliance data")
    parser.add_argument("--aggregate-device-id", help="Optional device ID for aggregate readings")
    parser.add_argument("--appliance-device-id", help="Optional device ID for appliance readings")
    parser.add_argument("--appliance", required=True, help="Appliance label in energy_readings, for example bulb")
    parser.add_argument("--start", help="Optional ISO timestamp lower bound")
    parser.add_argument("--end", help="Optional ISO timestamp upper bound")
    parser.add_argument("--resample-seconds", type=int, default=6, help="Resample interval in seconds")
    parser.add_argument("--fill-limit", type=int, default=30, help="Forward-fill limit in resampled buckets")
    return parser.parse_args()


def main():
    args = parse_args()
    appliance = args.appliance.strip().lower()
    script_dir = os.path.dirname(__file__)
    aggregate_device_id = args.aggregate_device_id or args.device_id
    appliance_device_id = args.appliance_device_id or args.device_id

    if not aggregate_device_id or not appliance_device_id:
        raise ValueError("Provide --device-id, or provide both --aggregate-device-id and --appliance-device-id")

    print("=" * 60)
    print(f"Fetching Supabase data for appliance: {appliance}")
    print(f"Aggregate device ID: {aggregate_device_id}")
    print(f"Appliance device ID: {appliance_device_id}")
    print("=" * 60)

    aggregate_rows = fetch_energy_readings(
        device_id=aggregate_device_id,
        stream_type="aggregate",
        start=args.start,
        end=args.end,
    )
    appliance_rows = fetch_energy_readings(
        device_id=appliance_device_id,
        stream_type="appliance",
        appliance_label=appliance,
        start=args.start,
        end=args.end,
    )

    aggregate_df = rows_to_power_dataframe(aggregate_rows)
    appliance_df = rows_to_power_dataframe(appliance_rows)
    processed_df, summary = preprocess_supabase_pair(
        aggregate_df,
        appliance_df,
        appliance=appliance,
        resample_seconds=args.resample_seconds,
        fill_limit=args.fill_limit,
    )
    features_df = add_common_features(processed_df)

    processed_path = os.path.join(script_dir, f"processed_{appliance}.csv")
    features_path = os.path.join(script_dir, f"features_{appliance}.csv")
    summary_path = os.path.join(script_dir, f"supabase_{appliance}_data_summary.json")
    chart_path = os.path.join(script_dir, f"output_12_{appliance}_supabase_cleaning.png")

    processed_df.to_csv(processed_path, index_label="datetime")
    features_df.to_csv(features_path, index_label="datetime")

    global_norm_path, appliance_norm_path = save_normalisation_params(
        script_dir,
        appliance,
        agg_max=summary["agg_max"],
        appliance_max=summary[f"{appliance}_max"],
    )

    summary.update({
        "aggregate_device_id": aggregate_device_id,
        "appliance_device_id": appliance_device_id,
        "start": args.start,
        "end": args.end,
        "processed_file": processed_path,
        "features_file": features_path,
        "normalisation_file": appliance_norm_path,
        "global_normalisation_file": global_norm_path,
        "feature_rows_after_dropna": int(len(features_df)),
    })

    with open(summary_path, "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2)

    sample = processed_df.iloc[: min(len(processed_df), 3000)]
    fig, axes = plt.subplots(2, 1, figsize=(14, 7), sharex=True)
    axes[0].plot(sample.index, sample["agg_power"], color="steelblue", linewidth=0.8)
    axes[0].set_title("Aggregate Power After Supabase Cleaning")
    axes[0].set_ylabel("Watts")
    axes[0].grid(True, alpha=0.3)

    axes[1].plot(sample.index, sample[f"{appliance}_power"], color="orangered", linewidth=0.8)
    axes[1].set_title(f"{appliance} Power After Supabase Cleaning")
    axes[1].set_ylabel("Watts")
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(chart_path, dpi=120)
    plt.close(fig)

    print(json.dumps(summary, indent=2))
    print(f"Saved processed data : {processed_path}")
    print(f"Saved features data  : {features_path}")
    print(f"Saved summary        : {summary_path}")
    print(f"Saved chart          : {chart_path}")


if __name__ == "__main__":
    main()
