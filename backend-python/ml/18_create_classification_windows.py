import argparse
import json
import os

import numpy as np
import pandas as pd

from classification_pipeline import (
    DEFAULT_WINDOW_SIZE,
    create_classification_windows,
    split_classification_windows,
)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Create train/val/test arrays for the 4-class bulb activity classifier."
    )
    parser.add_argument(
        "--input-file",
        default=None,
        help="Processed classification CSV from script 17",
    )
    parser.add_argument("--prefix", default="bulb", help="Input/output prefix, for example bulb")
    parser.add_argument("--window-size", type=int, default=DEFAULT_WINDOW_SIZE, help="Odd window size")
    parser.add_argument("--limit-rows", type=int, help="Optional row limit before creating windows")
    return parser.parse_args()


def main():
    args = parse_args()
    script_dir = os.path.dirname(__file__)
    prefix = args.prefix.strip().lower()
    input_file = args.input_file or f"processed_{prefix}_classification_dataset.csv"
    input_path = os.path.abspath(os.path.join(script_dir, input_file))
    label_map_path = os.path.join(script_dir, f"{prefix}_classification_label_map.json")

    print("=" * 60)
    print("STEP 1: Loading processed classification dataset...")
    print("=" * 60)
    print(f"  Input file: {input_path}")

    df = pd.read_csv(input_path, parse_dates=["timestamp"])
    print(f"  Rows loaded: {len(df):,}")
    print(f"  Columns    : {list(df.columns)}")

    if args.limit_rows and len(df) > args.limit_rows:
        df = df.iloc[:args.limit_rows].copy()
        print(f"  Data limited to {len(df):,} rows (limit_rows={args.limit_rows:,})")

    X, y, power_max = create_classification_windows(df, window_size=args.window_size)
    split = split_classification_windows(X, y)

    print("\n  Label distribution in full window dataset:")
    full_counts = pd.Series(y).value_counts().sort_index()
    print(full_counts.to_string())

    for name, arr in split.items():
        output_path = os.path.join(script_dir, f"{name}_{prefix}_classification.npy")
        np.save(output_path, arr)
        print(f"  Saved {os.path.basename(output_path):<24} -> {arr.shape}")

    meta = {
        "window_size": int(args.window_size),
        "power_max": float(power_max),
        "rows_used": int(len(df)),
    }
    with open(os.path.join(script_dir, f"{prefix}_classification_windows_meta.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)

    if os.path.exists(label_map_path):
        with open(label_map_path, "r", encoding="utf-8") as fh:
            label_map = json.load(fh)
        print("\n  Label map:")
        print(json.dumps(label_map, indent=2))

    print("\n" + "=" * 60)
    print("SCRIPT 18 COMPLETE")
    print(f"Next step: Run python 19_train_classification_model.py --prefix {prefix}")
    print("=" * 60)


if __name__ == "__main__":
    main()
