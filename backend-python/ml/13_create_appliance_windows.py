import argparse
import os

import numpy as np
import pandas as pd

from disaggregation_pipeline import create_windows_from_dataframe, split_windows


def parse_args():
    parser = argparse.ArgumentParser(
        description="Create train/val/test sliding windows for a chosen appliance regression model."
    )
    parser.add_argument("--appliance", required=True, help="Appliance label, for example bulb")
    parser.add_argument("--input-file", help="Processed or features CSV. Defaults to features_<appliance>.csv")
    parser.add_argument("--limit-rows", type=int, default=300000, help="Limit rows before windowing to control RAM usage")
    return parser.parse_args()


def main():
    args = parse_args()
    appliance = args.appliance.strip().lower()
    script_dir = os.path.dirname(__file__)
    input_path = os.path.abspath(args.input_file) if args.input_file else os.path.join(script_dir, f"features_{appliance}.csv")

    print("=" * 60)
    print(f"Creating windows for appliance: {appliance}")
    print(f"Input file: {input_path}")
    print("=" * 60)

    df = pd.read_csv(input_path, index_col="datetime", parse_dates=True)
    if args.limit_rows and len(df) > args.limit_rows:
        df = df.iloc[:args.limit_rows]
        print(f"Data limited to {len(df):,} rows (limit_rows={args.limit_rows:,})")

    X, y = create_windows_from_dataframe(df, appliance=appliance)
    split = split_windows(X, y)

    for name, arr in split.items():
        path = os.path.join(script_dir, f"{name}_{appliance}.npy")
        np.save(path, arr)
        print(f"Saved {name}_{appliance}.npy -> {arr.shape}")


if __name__ == "__main__":
    main()
