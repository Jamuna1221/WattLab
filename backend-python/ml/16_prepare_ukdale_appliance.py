import argparse
import json
import os

from ukdale_pipeline import preprocess_ukdale_appliance, save_ukdale_outputs


def parse_args():
    parser = argparse.ArgumentParser(
        description="Prepare any supported UK-DALE appliance dataset for training."
    )
    parser.add_argument("--appliance", required=True, help="Appliance to prepare, for example microwave")
    parser.add_argument("--data-folder", default="house_1", help="UK-DALE house folder")
    parser.add_argument("--resample-seconds", type=int, default=6, help="Resample interval in seconds")
    parser.add_argument("--fill-limit", type=int, default=30, help="Forward-fill limit in resampled buckets")
    return parser.parse_args()


def main():
    args = parse_args()
    appliance = args.appliance.strip().lower()
    script_dir = os.path.dirname(__file__)

    print("=" * 60)
    print(f"Preparing UK-DALE appliance: {appliance}")
    print("=" * 60)

    processed_df, summary = preprocess_ukdale_appliance(
        appliance=appliance,
        data_folder=args.data_folder,
        resample_seconds=args.resample_seconds,
        fill_limit=args.fill_limit,
    )
    result = save_ukdale_outputs(script_dir, appliance, processed_df, summary)

    print(json.dumps(result["summary"], indent=2))
    print(f"Saved processed data : {result['processed_path']}")
    print(f"Saved features data  : {result['features_path']}")
    print(f"Saved summary        : {result['summary_path']}")
    print(f"Saved chart          : {result['chart_path']}")


if __name__ == "__main__":
    main()
