import argparse
import json
import os

from state_model_pipeline import load_readings_file, train_state_model


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train a simple state classifier for bulb or future appliance channels."
    )
    parser.add_argument("--appliance", required=True, help="Appliance label, for example bulb")
    parser.add_argument("--readings-file", required=True, help="Path to .json, .csv, .txt, or .npy readings")
    parser.add_argument("--threshold", type=float, default=8.0, help="Power threshold in watts for ON labels")
    parser.add_argument("--window-size", type=int, default=30, help="Sliding window size")
    parser.add_argument("--epochs", type=int, default=20, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    return parser.parse_args()


def main():
    args = parse_args()
    script_dir = os.path.dirname(__file__)
    appliance = args.appliance.strip().lower()
    readings_path = os.path.abspath(args.readings_file)
    model_path = os.path.join(script_dir, f"{appliance}_state_model.h5")
    metrics_path = os.path.join(script_dir, f"metrics_{appliance}_state.json")

    print("=" * 60)
    print(f"Training state model for: {appliance}")
    print(f"Readings file: {readings_path}")
    print(f"Model output : {model_path}")
    print("=" * 60)

    readings = load_readings_file(readings_path)
    result = train_state_model(
        readings=readings,
        model_path=model_path,
        on_threshold_watts=args.threshold,
        window_size=args.window_size,
        epochs=args.epochs,
        batch_size=args.batch_size,
    )

    with open(metrics_path, "w", encoding="utf-8") as fh:
        json.dump(result["summary"], fh, indent=2)

    print("Training complete.")
    print(json.dumps(result["summary"], indent=2))
    print(f"Saved metrics: {metrics_path}")


if __name__ == "__main__":
    main()
