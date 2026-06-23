import argparse
import json
import os

import matplotlib.pyplot as plt

from state_model_pipeline import (
    load_readings_file,
    load_state_series_file,
    preprocess_state_series_dataframe,
    sanitize_readings,
)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Clean and inspect appliance state data before training a state classifier."
    )
    parser.add_argument("--appliance", required=True, help="Appliance label, for example bulb")
    parser.add_argument("--input-file", required=True, help="Path to .dat, .csv, .json, .txt, or .npy readings")
    parser.add_argument("--threshold", type=float, default=8.0, help="ON threshold in watts")
    parser.add_argument("--resample-seconds", type=int, default=6, help="Resample interval for timestamped data")
    parser.add_argument("--fill-limit", type=int, default=30, help="Forward-fill limit after resampling")
    return parser.parse_args()


def main():
    args = parse_args()
    script_dir = os.path.dirname(__file__)
    appliance = args.appliance.strip().lower()
    input_path = os.path.abspath(args.input_file)
    processed_csv = os.path.join(script_dir, f"processed_{appliance}_state.csv")
    summary_json = os.path.join(script_dir, f"state_{appliance}_data_summary.json")
    output_plot = os.path.join(script_dir, f"output_10_{appliance}_state_cleaning.png")

    ext = os.path.splitext(input_path)[1].lower()

    print("=" * 60)
    print(f"Preparing state dataset for: {appliance}")
    print(f"Input file: {input_path}")
    print("=" * 60)

    if ext in {".dat", ".csv"}:
        df = load_state_series_file(input_path)
        clean_df, summary = preprocess_state_series_dataframe(
            df,
            resample_seconds=args.resample_seconds,
            fill_limit=args.fill_limit,
        )
        clean_df["state"] = (clean_df["power"] >= args.threshold).astype(int)
        clean_df.to_csv(processed_csv, index_label="datetime")

        plot_df = clean_df.iloc[: min(len(clean_df), 3000)]
        fig, axes = plt.subplots(2, 1, figsize=(14, 7), sharex=True)
        axes[0].plot(plot_df.index, plot_df["power"], color="steelblue", linewidth=0.8)
        axes[0].axhline(args.threshold, color="red", linestyle="--", linewidth=1.0, label=f"ON threshold = {args.threshold:.1f}W")
        axes[0].set_title(f"{appliance} power after cleaning")
        axes[0].set_ylabel("Power (W)")
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)

        axes[1].plot(plot_df.index, plot_df["state"], color="darkorange", linewidth=0.8)
        axes[1].set_title(f"{appliance} ON/OFF labels after thresholding")
        axes[1].set_ylabel("State")
        axes[1].grid(True, alpha=0.3)

        plt.tight_layout()
        plt.savefig(output_plot, dpi=120)
        plt.close(fig)

        summary.update({
            "appliance": appliance,
            "input_file": input_path,
            "processed_file": processed_csv,
            "threshold_watts": float(args.threshold),
            "on_ratio": round(float(clean_df["state"].mean()), 4),
            "max_power_watts": round(float(clean_df["power"].max()), 3),
            "avg_power_watts": round(float(clean_df["power"].mean()), 3),
            "mode": "timestamped",
        })
    else:
        readings = sanitize_readings(load_readings_file(input_path))
        states = (readings >= args.threshold).astype(int)

        import pandas as pd

        clean_df = pd.DataFrame({
            "sample_index": range(len(readings)),
            "power": readings,
            "state": states,
        })
        clean_df.to_csv(processed_csv, index=False)

        plot_df = clean_df.iloc[: min(len(clean_df), 3000)]
        fig, axes = plt.subplots(2, 1, figsize=(14, 7), sharex=True)
        axes[0].plot(plot_df["sample_index"], plot_df["power"], color="steelblue", linewidth=0.8)
        axes[0].axhline(args.threshold, color="red", linestyle="--", linewidth=1.0, label=f"ON threshold = {args.threshold:.1f}W")
        axes[0].set_title(f"{appliance} power after clipping negatives")
        axes[0].set_ylabel("Power (W)")
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)

        axes[1].plot(plot_df["sample_index"], plot_df["state"], color="darkorange", linewidth=0.8)
        axes[1].set_title(f"{appliance} ON/OFF labels after thresholding")
        axes[1].set_ylabel("State")
        axes[1].grid(True, alpha=0.3)

        plt.tight_layout()
        plt.savefig(output_plot, dpi=120)
        plt.close(fig)

        summary = {
            "appliance": appliance,
            "input_file": input_path,
            "processed_file": processed_csv,
            "threshold_watts": float(args.threshold),
            "rows_before": int(len(readings)),
            "rows_after": int(len(readings)),
            "negative_values_clipped": 0,
            "on_ratio": round(float(states.mean()) if len(states) else 0.0, 4),
            "max_power_watts": round(float(readings.max()) if len(readings) else 0.0, 3),
            "avg_power_watts": round(float(readings.mean()) if len(readings) else 0.0, 3),
            "mode": "flat-readings",
        }

    with open(summary_json, "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2)

    print("Cleaning complete.")
    print(json.dumps(summary, indent=2))
    print(f"Saved cleaned dataset: {processed_csv}")
    print(f"Saved summary       : {summary_json}")
    print(f"Saved chart         : {output_plot}")


if __name__ == "__main__":
    main()
