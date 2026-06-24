import os
import glob
from datetime import datetime

# Must run before `import tensorflow` / keras: cuts Abseil + oneDNN INFO on stderr
# (Windows CPU wheels). Override in the shell if you want oneDNN optimizations.
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")

# =============================================================================
# SCRIPT 08 — FLASK PREDICTION API SERVICE
# =============================================================================
# PURPOSE:
#   This is the bridge between your ML models and the Node.js backend.
#   It runs as a separate server on port 5001.
#   Node.js sends it readings → it returns predictions.
#
# THIS FILE GOES IN: backend-python/app.py
#   (Replace or merge with the existing app.py in your project)
#
# HOW TO RUN:
#   cd backend-python
#   venv\Scripts\activate
#   python app.py
#
# ENDPOINTS:
#   POST /predict/appliance   → given 599 aggregate readings, returns appliance watts
#   POST /predict/bill        → given 30-day kWh history, returns next-day forecast
#   GET  /health              → check if server is running
#
# INSTALL (if not already in requirements.txt):
#   pip install flask tensorflow
# =============================================================================

from flask import Flask, request, jsonify
import numpy as np
import json
from tensorflow import keras

from ml.state_model_pipeline import (
    build_state_prediction_payload,
    load_state_model,
    train_state_model,
)
from candidate_tray_engine import CandidateTrayEngine

app = Flask(__name__)

# --------------------------------------------------------------------------
# LOAD MODELS AT STARTUP (once, not on every request)
# --------------------------------------------------------------------------
# Change this path to match your project structure
ML_FOLDER = os.path.join(os.path.dirname(__file__), 'ml')

print("Loading ML models...")

# Load normalisation parameters
norm_params = json.load(open(os.path.join(ML_FOLDER, 'normalisation_params.json')))
bill_config = json.load(open(os.path.join(ML_FOLDER, 'bill_config.json')))

# Load appliance models — add more as you train them
# Load bill prediction model
bill_model_path = os.path.join(ML_FOLDER, 'bill_prediction_model.h5')
if os.path.exists(bill_model_path):
    bill_model = keras.models.load_model(bill_model_path, compile=False)
    print("  Loaded: bill_prediction_model.h5")
else:
    bill_model = None
    print("  Skipped: bill_prediction_model.h5 not found")

state_models = {}
activity_models = {}
activity_label_maps = {}
activity_window_meta = {}
tray_engine = CandidateTrayEngine(step_threshold_watts=100.0, noise_floor_watts=30.0)


def get_state_model_path(appliance):
    return os.path.join(ML_FOLDER, f'{appliance}_state_model.h5')


def load_state_model_for(appliance):
    model_path = get_state_model_path(appliance)
    state_models[appliance] = load_state_model(model_path)
    if state_models[appliance] is not None:
        print(f"  Loaded: {appliance}_state_model.h5")
    else:
        print(f"  Skipped: {appliance}_state_model.h5 not found (using feature rules)")
    return state_models[appliance]


load_state_model_for('bulb')


def load_activity_model_for(prefix):
    model_path = os.path.join(ML_FOLDER, f'{prefix}_classification_model_final.keras')
    label_map_path = os.path.join(ML_FOLDER, f'{prefix}_classification_label_map.json')
    meta_path = os.path.join(ML_FOLDER, f'{prefix}_classification_windows_meta.json')

    if not os.path.exists(model_path):
        activity_models[prefix] = None
        print(f"  Skipped: {prefix}_classification_model_final.keras not found")
        return None

    activity_models[prefix] = keras.models.load_model(model_path, compile=False)
    print(f"  Loaded: {prefix}_classification_model_final.keras")

    if os.path.exists(label_map_path):
        label_to_id = json.load(open(label_map_path))
        activity_label_maps[prefix] = {int(value): key for key, value in label_to_id.items()}
    else:
        activity_label_maps[prefix] = {
            0: 'idle',
            1: 'bulb_only',
            2: 'other_only',
            3: 'bulb_plus_other',
        }

    if os.path.exists(meta_path):
        activity_window_meta[prefix] = json.load(open(meta_path))
    else:
        activity_window_meta[prefix] = {'window_size': 31, 'power_max': 3.5}

    return activity_models[prefix]


load_activity_model_for('bulb')
for _appliance in ['fridge', 'kettle', 'microwave', 'washing_machine', 'dishwasher']:
    load_activity_model_for(_appliance)

for summary_file in glob.glob(os.path.join(ML_FOLDER, '*_classification_train_summary.json')):
    with open(summary_file, encoding='utf-8') as f:
        summary = json.load(f)
    prefix = summary.get('appliance')
    if prefix:
        activity_window_meta[prefix] = {
            'window_size': summary.get('window_size', 31),
            'power_max': summary.get('power_max', 3.5),
        }

for lm_file in glob.glob(os.path.join(ML_FOLDER, '*_classification_label_map.json')):
    prefix = os.path.basename(lm_file).replace('_classification_label_map.json', '')
    with open(lm_file, encoding='utf-8') as f:
        label_to_id = json.load(f)
    activity_label_maps[prefix] = {int(v): k for k, v in label_to_id.items()}

print("All available models loaded.\n")

# --------------------------------------------------------------------------
# ENDPOINT 1: Health check
# --------------------------------------------------------------------------
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status'         : 'running',
        'regression_models': 'deprecated',
        'bill_model'     : bill_model is not None,
        'bulb_state_model': state_models.get('bulb') is not None,
        'state_models_loaded': sorted([name for name, model in state_models.items() if model is not None]),
        'activity_models_loaded': sorted([name for name, model in activity_models.items() if model is not None]),
    })

# --------------------------------------------------------------------------
# ENDPOINT 2: Appliance power prediction
# --------------------------------------------------------------------------
# Node.js sends:
#   { "appliance": "kettle", "window": [val1, val2, ..., val599] }
# Returns:
#   { "appliance": "kettle", "predicted_watts": 1245.6 }
@app.route('/predict/appliance', methods=['POST'])
def predict_appliance():
    return jsonify({
        'error': 'Regression models deprecated, use /predict/activity/<appliance>'
    }), 410

    try:
        data      = request.get_json()
        appliance = data.get('appliance', 'kettle')
        window    = data.get('window', [])

        # Input validation
        if len(window) != 599:
            return jsonify({'error': f'window must have exactly 599 values, got {len(window)}'}), 400

        if appliance not in models:
            available = list(models.keys())
            return jsonify({'error': f'Model for {appliance} not loaded. Available: {available}'}), 400

        # Normalise input using the same agg_max used during training
        window_arr  = np.array(window, dtype=np.float32) / norm_params['agg_max']
        window_arr  = window_arr.reshape(1, 599, 1)  # Shape: (1, 599, 1)

        # Run prediction
        pred_norm   = models[appliance].predict(window_arr, verbose=0)[0][0]

        # Convert back to Watts using the appliance's max value
        # For now we use kettle_max for all — update when you train other models
        appliance_max_key = f'{appliance}_max'
        if appliance_max_key not in norm_params:
            return jsonify({'error': f'No normalisation params for {appliance}. Train the model first.'}), 503
        appliance_max = norm_params[appliance_max_key]
        pred_watts  = float(pred_norm * appliance_max)
        pred_watts  = max(0.0, pred_watts)  # Clip to non-negative

        return jsonify({
            'appliance'      : appliance,
            'predicted_watts': round(pred_watts, 2)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --------------------------------------------------------------------------
# ENDPOINT 3: Bill / next-day kWh prediction
# --------------------------------------------------------------------------
# Node.js sends:
#   { "daily_kwh": [1.2, 1.5, 0.9, ..., 1.3]  }  ← 30 values
# Returns:
#   { "next_day_kwh": 1.4, "estimated_cost_inr": 9.1 }
@app.route('/predict/bill', methods=['POST'])
def predict_bill():
    try:
        if bill_model is None:
            return jsonify({'error': 'Bill prediction model not loaded'}), 503

        data      = request.get_json()
        daily_kwh = data.get('daily_kwh', [])

        if len(daily_kwh) != 30:
            return jsonify({'error': f'daily_kwh must have exactly 30 values, got {len(daily_kwh)}'}), 400

        window     = np.array(daily_kwh, dtype=np.float32).reshape(1, 30, 1)
        pred_kwh   = float(bill_model.predict(window, verbose=0)[0][0])
        pred_kwh   = max(0.0, pred_kwh)
        cost_inr   = pred_kwh * bill_config['tariff_inr_per_kwh']

        return jsonify({
            'next_day_kwh'      : round(pred_kwh, 3),
            'estimated_cost_inr': round(cost_inr, 2)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def predict_state_for_appliance(appliance):
    try:
        data = request.get_json() or {}
        readings = data.get('readings', [])
        env_key = f'{appliance.upper()}_ON_THRESHOLD_WATTS'
        on_threshold_watts = float(
            data.get(
                'on_threshold_watts',
                os.environ.get(env_key, os.environ.get('BULB_ON_THRESHOLD_WATTS', '8.0'))
            )
        )

        model = state_models.get(appliance)
        payload = build_state_prediction_payload(
            readings=readings,
            model=model,
            on_threshold_watts=on_threshold_watts,
            model_used=model is not None,
        )
        payload['appliance'] = appliance
        payload['state_label'] = payload['state']
        if appliance == 'bulb':
            payload['bulb_state'] = payload['state']
        return jsonify(payload)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def train_state_for_appliance(appliance):
    try:
        data = request.get_json() or {}
        readings = data.get('readings', [])
        env_key = f'{appliance.upper()}_ON_THRESHOLD_WATTS'
        on_threshold_watts = float(
            data.get(
                'on_threshold_watts',
                os.environ.get(env_key, os.environ.get('BULB_ON_THRESHOLD_WATTS', '8.0'))
            )
        )

        result = train_state_model(
            readings=readings,
            model_path=get_state_model_path(appliance),
            on_threshold_watts=on_threshold_watts,
        )
        state_models[appliance] = result['model']

        payload = dict(result['summary'])
        payload['appliance'] = appliance
        return jsonify(payload)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/predict/bulb/state', methods=['POST'])
def predict_bulb_state():
    return predict_state_for_appliance('bulb')


@app.route('/train/bulb/state', methods=['POST'])
def train_bulb_state():
    return train_state_for_appliance('bulb')


@app.route('/predict/state/<appliance>', methods=['POST'])
def predict_generic_state(appliance):
    return predict_state_for_appliance(appliance.lower())


@app.route('/train/state/<appliance>', methods=['POST'])
def train_generic_state(appliance):
    return train_state_for_appliance(appliance.lower())


def predict_activity_for(prefix):
    try:
        model = activity_models.get(prefix)
        if model is None:
            return jsonify({'error': f'{prefix} activity classifier not loaded'}), 503

        data = request.get_json() or {}
        readings = data.get('readings', [])
        meta = activity_window_meta.get(prefix, {'window_size': 31, 'power_max': 3.5})
        window_size = int(meta.get('window_size', 31))
        power_max = float(meta.get('power_max', 3.5))

        if len(readings) < window_size:
            return jsonify({'error': f'readings must have at least {window_size} values, got {len(readings)}'}), 400

        arr = np.array(readings[-window_size:], dtype=np.float32)
        arr = np.clip(arr, 0.0, None)
        avg_power_watts = float(np.mean(arr))
        max_power_watts = float(np.max(arr))
        window = (arr / max(power_max, 1.0)).reshape(1, window_size, 1)
        probabilities = model.predict(window, verbose=0)[0]
        predicted_id = int(np.argmax(probabilities))
        label_map = activity_label_maps.get(prefix, {})
        model_activity_label = label_map.get(predicted_id, str(predicted_id))
        activity_label = model_activity_label
        correction_applied = None

        # Demo calibration guard:
        # Current ESP calibration reports the bulb-only load around 1 W, while the
        # first training set learned older bulb-only samples around 0.3 W. This
        # prevents low-power bulb-only windows from being shown as bulb+other.
        if prefix == 'bulb' and os.environ.get('BULB_ACTIVITY_DEMO_RULES', '1') == '1':
            idle_max_watts = float(os.environ.get('BULB_ACTIVITY_IDLE_MAX_WATTS', '0.45'))
            bulb_only_avg_min_watts = float(os.environ.get('BULB_ACTIVITY_BULB_ONLY_AVG_MIN_WATTS', '0.80'))
            bulb_only_avg_max_watts = float(os.environ.get('BULB_ACTIVITY_BULB_ONLY_AVG_MAX_WATTS', '1.30'))
            bulb_only_max_watts = float(os.environ.get('BULB_ACTIVITY_BULB_ONLY_MAX_WATTS', '1.35'))
            bulb_only_spread_max_watts = float(os.environ.get('BULB_ACTIVITY_BULB_ONLY_SPREAD_MAX_WATTS', '0.20'))
            spread_watts = max_power_watts - avg_power_watts

            if max_power_watts <= idle_max_watts:
                activity_label = 'idle'
                correction_applied = 'idle_power_threshold'
            elif (
                bulb_only_avg_min_watts <= avg_power_watts <= bulb_only_avg_max_watts
                and max_power_watts <= bulb_only_max_watts
                and spread_watts <= bulb_only_spread_max_watts
            ):
                activity_label = 'bulb_only'
                correction_applied = 'bulb_only_power_range'

        class_probabilities = {
            label_map.get(index, str(index)): round(float(probability), 4)
            for index, probability in enumerate(probabilities)
        }

        return jsonify({
            'activity_label': activity_label,
            'model_activity_label': model_activity_label,
            'correction_applied': correction_applied,
            'confidence': round(float(probabilities[predicted_id]), 4),
            'class_probabilities': class_probabilities,
            'avg_power_watts': round(avg_power_watts, 3),
            'max_power_watts': round(max_power_watts, 3),
            'samples': int(len(arr)),
            'window_size': window_size,
            'model_used': True,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/predict/bulb/activity', methods=['POST'])
def predict_bulb_activity():
    return predict_activity_for('bulb')


@app.route('/predict/activity/<prefix>', methods=['POST'])
def predict_generic_activity(prefix):
    return predict_activity_for(prefix.lower())


@app.route('/predict/tray', methods=['POST'])
def predict_tray():
    """
    Node.js sends one reading at a time:
      { "timestamp": "2026-06-23T10:00:00Z", "power_watts": 452.3 }
    Returns current candidate tray state.
    """
    try:
        data = request.get_json() or {}
        timestamp_str = data.get('timestamp')
        if not timestamp_str:
            return jsonify({'error': 'timestamp is required'}), 400

        power_watts = float(data.get('power_watts', 0))
        timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        state = tray_engine.process_reading(timestamp, power_watts)
        return jsonify(state)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/tray/state', methods=['GET'])
def tray_state():
    """Returns current tray state without processing a new reading."""
    return jsonify(tray_engine.get_state())


@app.route('/tray/reset', methods=['POST'])
def tray_reset():
    """Resets the tray engine (for testing)."""
    global tray_engine
    tray_engine = CandidateTrayEngine()
    return jsonify({'status': 'reset'})

# --------------------------------------------------------------------------
# RUN THE SERVER
# --------------------------------------------------------------------------
if __name__ == '__main__':
    print("Starting Flask prediction server on http://localhost:5001")
    print("Test it: GET http://localhost:5001/health")
    app.run(host='0.0.0.0', port=5001, debug=False)
