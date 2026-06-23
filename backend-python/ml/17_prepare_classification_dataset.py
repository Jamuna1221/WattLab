import argparse
import os

from classification_pipeline import (
    load_classification_csv,
    preprocess_classification_dataframe,
    save_classification_outputs,
)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Prepare the exported labeled appliance CSV for 4-class training."
    )
    parser.add_argument(
        "--input-file",
        default="Supabase Snippet Energy Appliance Readings Filter.csv",
        help="Exported Supabase CSV with timestamp, power, appliance_label",
    )
    parser.add_argument("--prefix", default="bulb", help="Output prefix, for example bulb")
    parser.add_argument(
        "--resample-seconds",
        type=int,
        default=0,
        help="Use 0 to keep exported rows; set a positive value to resample by seconds",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    script_dir = os.path.dirname(__file__)
    input_path = os.path.abspath(os.path.join(script_dir, args.input_file))

    df = load_classification_csv(input_path)
    processed_df = preprocess_classification_dataframe(df, resample_seconds=args.resample_seconds)
    save_classification_outputs(script_dir, processed_df, prefix=args.prefix.strip().lower())

    print("\n" + "=" * 60)
    print("SCRIPT 17 COMPLETE")
    print(f"Next step: Run python 18_create_classification_windows.py --prefix {args.prefix.strip().lower()}")
    print("=" * 60)


if __name__ == "__main__":
    main()
