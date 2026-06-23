import argparse
import os

import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf
from tensorflow import keras

from disaggregation_pipeline import build_s2p_lstm


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train an S2P-LSTM regression model for any appliance dataset created from Supabase."
    )
    parser.add_argument("--appliance", required=True, help="Appliance label, for example bulb")
    parser.add_argument("--epochs", type=int, default=50, help="Maximum training epochs")
    parser.add_argument("--batch-size", type=int, default=512, help="Training batch size")
    return parser.parse_args()


def main():
    args = parse_args()
    appliance = args.appliance.strip().lower()
    script_dir = os.path.dirname(__file__)

    print("TensorFlow version:", tf.__version__)
    print("GPU available:", len(tf.config.list_physical_devices("GPU")) > 0)

    print("=" * 60)
    print(f"Training appliance model: {appliance}")
    print("=" * 60)

    X_train = np.load(os.path.join(script_dir, f"X_train_{appliance}.npy"))
    y_train = np.load(os.path.join(script_dir, f"y_train_{appliance}.npy"))
    X_val = np.load(os.path.join(script_dir, f"X_val_{appliance}.npy"))
    y_val = np.load(os.path.join(script_dir, f"y_val_{appliance}.npy"))

    print(f"X_train: {X_train.shape} y_train: {y_train.shape}")
    print(f"X_val  : {X_val.shape} y_val  : {y_val.shape}")

    model = build_s2p_lstm(window_size=X_train.shape[1])
    best_model_path = os.path.join(script_dir, f"best_{appliance}_model.h5")
    final_model_path = os.path.join(script_dir, f"{appliance}_model_final.h5")
    history_plot_path = os.path.join(script_dir, f"output_14_{appliance}_training_history.png")

    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=5,
            restore_best_weights=True,
            verbose=1,
        ),
        keras.callbacks.ModelCheckpoint(
            best_model_path,
            monitor="val_loss",
            save_best_only=True,
            verbose=1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=3,
            verbose=1,
        ),
    ]

    history = model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch_size,
        callbacks=callbacks,
        verbose=1,
    )

    model.save(final_model_path)
    print(f"Saved final model: {final_model_path}")

    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    axes[0].plot(history.history["loss"], label="Training Loss")
    axes[0].plot(history.history["val_loss"], label="Validation Loss")
    axes[0].set_title("Loss over Epochs")
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    axes[1].plot(history.history["mae"], label="Training MAE")
    axes[1].plot(history.history["val_mae"], label="Validation MAE")
    axes[1].set_title("MAE over Epochs")
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(history_plot_path, dpi=120)
    plt.close(fig)
    print(f"Saved chart: {history_plot_path}")


if __name__ == "__main__":
    main()
