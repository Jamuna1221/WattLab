# =============================================================================
# SCRIPT 05 — BUILD AND TRAIN THE S2P-LSTM MODEL
# =============================================================================
# PURPOSE:
#   Define the neural network, train it on our windows, save the best model.
#
# *** RUN THIS ON GOOGLE COLAB (FREE GPU) — NOT LOCALLY ***
#
# HOW TO USE GOOGLE COLAB:
#   1. Go to: colab.research.google.com
#   2. Click Runtime > Change runtime type > GPU > Save
#   3. In the left panel (Files icon), upload:
#        X_train.npy   y_train.npy   X_val.npy   y_val.npy
#   4. Create a new cell, paste this entire script, run it
#   5. When done, download: kettle_model_final.h5
#   6. Put the downloaded .h5 file back into: backend-python/ml/
#
# MODEL ARCHITECTURE (Sequence-to-Point LSTM):
#   Input (599, 1) → LSTM(256) → Dropout → LSTM(128) → Dropout
#                 → Dense(64) → Dense(1) → Output: single Watt prediction
#
# WHAT EACH LAYER DOES:
#   LSTM(256)    — reads the 599-step sequence, remembers important patterns
#   LSTM(128)    — refines the memory from the first LSTM
#   Dropout(0.2) — randomly turns off 20% of neurons to prevent memorisation
#   Dense(64)    — combines LSTM output into 64 signals
#   Dense(1)     — squashes to a single output: predicted kettle power
# =============================================================================

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import matplotlib.pyplot as plt
import json

print("TensorFlow version:", tf.__version__)
print("GPU available:", len(tf.config.list_physical_devices('GPU')) > 0)

# --------------------------------------------------------------------------
# STEP 1: Load training data
# --------------------------------------------------------------------------
print("\nSTEP 1: Loading training data...")

X_train = np.load('X_train.npy')
y_train = np.load('y_train.npy')
X_val   = np.load('X_val.npy')
y_val   = np.load('y_val.npy')

print(f"  X_train : {X_train.shape}   y_train : {y_train.shape}")
print(f"  X_val   : {X_val.shape}     y_val   : {y_val.shape}")

# --------------------------------------------------------------------------
# STEP 2: Build the S2P-LSTM model
# --------------------------------------------------------------------------
print("\nSTEP 2: Building S2P-LSTM model...")

# keras.Sequential = a stack of layers processed in order
model = keras.Sequential([

    # --- First LSTM layer ---
    # units=256: 256 memory cells (more = more powerful but slower)
    # return_sequences=True: pass the full sequence to the next LSTM layer
    # input_shape=(599, 1): 599 timesteps, 1 feature per timestep
    layers.LSTM(256, return_sequences=True, input_shape=(599, 1)),

    # Dropout: randomly disable 20% of neurons to prevent overfitting
    layers.Dropout(0.2),

    # --- Second LSTM layer ---
    # return_sequences=False: only return the final output (not full sequence)
    # because Dense layers need a flat vector, not a sequence
    layers.LSTM(128, return_sequences=False),

    layers.Dropout(0.2),

    # --- Dense (fully connected) layers ---
    # Takes LSTM output (128 values) and mixes them into 64 signals
    layers.Dense(64, activation='relu'),

    # Final output: one number = predicted normalised kettle power
    # activation='linear' means no squashing — raw value output (good for regression)
    layers.Dense(1, activation='linear')
])

# Print a summary of the model (how many parameters it has)
model.summary()

# --------------------------------------------------------------------------
# STEP 3: Compile the model
# --------------------------------------------------------------------------
# optimizer: how the model updates itself to reduce errors
#   Adam is the standard choice — reliable and fast
# loss: how we measure error during training
#   mean_squared_error penalises large errors more heavily
# metrics: what to print during training (mae = mean absolute error in Watts)
model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=0.001),
    loss='mean_squared_error',
    metrics=['mae']
)

# --------------------------------------------------------------------------
# STEP 4: Set up training callbacks
# --------------------------------------------------------------------------
# Callbacks = automatic actions that happen during training
callbacks = [

    # EarlyStopping: if validation loss doesn't improve for 5 epochs, stop.
    # This prevents wasting time and overfitting.
    # restore_best_weights=True: go back to the best checkpoint after stopping.
    keras.callbacks.EarlyStopping(
        monitor='val_loss',
        patience=5,
        restore_best_weights=True,
        verbose=1
    ),

    # ModelCheckpoint: save the model whenever validation loss improves.
    # This ensures we always have the best version saved.
    keras.callbacks.ModelCheckpoint(
        'best_kettle_model.h5',
        monitor='val_loss',
        save_best_only=True,
        verbose=1
    ),

    # ReduceLROnPlateau: if training stalls, reduce learning rate by half.
    # This helps the model make finer adjustments near the end of training.
    keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=3,
        verbose=1
    )
]

# --------------------------------------------------------------------------
# STEP 5: Train the model
# --------------------------------------------------------------------------
# epochs=50: maximum 50 passes through the training data
#   (EarlyStopping will likely stop before 50)
# batch_size=512: look at 512 windows at a time before updating weights
#   (larger batch = faster but needs more GPU memory)
print("\nSTEP 5: Training the model...")
print("  This takes 20-40 minutes on Colab GPU, 4-10 hours on CPU.")
print("  Watch the val_mae column — it should decrease each epoch.")

history = model.fit(
    X_train, y_train,
    validation_data=(X_val, y_val),
    epochs=50,
    batch_size=512,
    callbacks=callbacks,
    verbose=1
)

# --------------------------------------------------------------------------
# STEP 6: Save the final model
# --------------------------------------------------------------------------
model.save('kettle_model_final.h5')
print("\nSaved: kettle_model_final.h5")
print("DOWNLOAD THIS FILE and put it in:  backend-python/ml/")

# --------------------------------------------------------------------------
# STEP 7: Plot training history
# --------------------------------------------------------------------------
print("\nSTEP 7: Saving training history chart...")

fig, axes = plt.subplots(1, 2, figsize=(12, 4))

# Loss curve
axes[0].plot(history.history['loss'],     label='Training Loss')
axes[0].plot(history.history['val_loss'], label='Validation Loss')
axes[0].set_title('Loss over Epochs')
axes[0].set_xlabel('Epoch')
axes[0].set_ylabel('MSE Loss')
axes[0].legend()
axes[0].grid(True, alpha=0.3)

# MAE curve
axes[1].plot(history.history['mae'],     label='Training MAE')
axes[1].plot(history.history['val_mae'], label='Validation MAE')
axes[1].set_title('MAE (Mean Absolute Error) over Epochs')
axes[1].set_xlabel('Epoch')
axes[1].set_ylabel('MAE (normalised)')
axes[1].legend()
axes[1].grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig('output_05_training_history.png', dpi=120)
print("  Saved output_05_training_history.png")

print("\n" + "=" * 60)
print("SCRIPT 05 COMPLETE")
print("Next: Download kettle_model_final.h5 and run  python 06_evaluate_model.py")
print("=" * 60)