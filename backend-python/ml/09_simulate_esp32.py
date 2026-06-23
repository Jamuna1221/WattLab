# =============================================================================
# SCRIPT 09 — ESP32 SIMULATION SCRIPT
# =============================================================================
# PURPOSE:
#   During Phase 1 (no hardware), this script reads UK-DALE data and sends
#   it to your Node.js backend exactly like a real ESP32 sensor would.
#   This lets you test the FULL pipeline without any hardware.
#
# WHAT IT SIMULATES:
#   ESP32 measures: voltage, current, activePower → sends JSON to backend
#   This script:    reads UK-DALE CSV → builds same JSON → POSTs to backend
#
# BEFORE RUNNING:
#   1. Your Node.js backend must be running on port 5000
#      (cd backend-node && npm start)
#   2. You need a valid JWT token for a device — get it by:
#      - Registering a device via admin API
#      - Then set DEVICE_TOKEN below
#
# HOW TO RUN:
#   python 09_simulate_esp32.py
#
# Press Ctrl+C to stop the simulation.
# =============================================================================

import pandas as pd
import requests
import time
import json
import os

# --------------------------------------------------------------------------
# CONFIGURATION — Update these values
# --------------------------------------------------------------------------
BACKEND_URL   = 'http://localhost:5000/api/readings'
DEVICE_ID     = 'SIM-DEVICE-001'
DEVICE_TOKEN  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkZXZpY2VJZCI6IlNJTS1ERVZJQ0UtMDAxIiwidXNlcklkIjoiMzY1MTFkNDAtMzAyZi00ODc1LWFiYTktNThjM2JjYTUwYTZhIiwiaWF0IjoxNzc1ODQ3NzQxLCJleHAiOjE3Nzg0Mzk3NDF9.JePSNcB-7eeGOHlVfuV6YuN1xk-SN-I9654MrmMf7Ts'   # ← Get from your Node.js auth endpoint

# How fast to send readings
# 0.1 = 10 readings per second (fast, for testing)
# 6.0 = real-time (1 reading every 6 seconds, matching UK-DALE sample rate)
SEND_INTERVAL_SECONDS = 0.1

# How many readings to send (None = send all available data)
MAX_READINGS = None   # Set to e.g. 1000 for a quick test

# Simulated voltage (UK homes use 230V)
SIMULATED_VOLTAGE = 230.0

# --------------------------------------------------------------------------
# STEP 1: Load the processed data
# --------------------------------------------------------------------------
print("=" * 60)
print("ESP32 SIMULATION SCRIPT")
print("=" * 60)

if not os.path.exists('processed_kettle.csv'):
    print("ERROR: processed_kettle.csv not found!")
    print("  Run 02_preprocess.py first.")
    exit()

print("Loading processed_kettle.csv...")
df = pd.read_csv('processed_kettle.csv', index_col='datetime', parse_dates=True)

if MAX_READINGS:
    df = df.iloc[:MAX_READINGS]
    print(f"  Limited to {MAX_READINGS} readings (MAX_READINGS set)")

print(f"  Will send {len(df):,} readings to {BACKEND_URL}")
print(f"  Interval: {SEND_INTERVAL_SECONDS}s between readings")
print(f"\nStarting simulation... Press Ctrl+C to stop.\n")

# --------------------------------------------------------------------------
# STEP 2: Send readings to Node.js backend
# --------------------------------------------------------------------------
success_count = 0
error_count   = 0
start_time    = time.time()

for i, (timestamp, row) in enumerate(df.iterrows()):

    # Build the JSON payload — same format as real ESP32 would send
    payload = {
        'timestamp'    : str(timestamp),
        'voltage'      : SIMULATED_VOLTAGE,
        'current'      : round(row['agg_power'] / SIMULATED_VOLTAGE, 4),   # I = P / V
        'activePower'  : round(row['agg_power'], 2),
        'apparentPower': round(row['agg_power'] * 1.05, 2),                # approx 5% reactive
        'powerFactor'  : 0.95,
        'deviceId'     : DEVICE_ID
    }

    try:
        response = requests.post(
            BACKEND_URL,
            json=payload,
            headers={'Authorization': f'Bearer {DEVICE_TOKEN}'},
            timeout=3
        )

        if response.status_code == 200 or response.status_code == 201:
            success_count += 1
        else:
            error_count += 1
            if error_count <= 5:  # Only print first 5 errors to avoid spam
                print(f"  HTTP {response.status_code}: {response.text[:100]}")

    except requests.exceptions.ConnectionError:
        if i == 0:
            print("ERROR: Cannot connect to Node.js backend!")
            print(f"  Make sure it's running at: {BACKEND_URL}")
            print("  Run: cd backend-node && npm start")
            exit()
        error_count += 1

    except Exception as e:
        error_count += 1
        if error_count <= 5:
            print(f"  Error: {e}")

    # Print progress every 100 readings
    if (i + 1) % 100 == 0:
        elapsed   = time.time() - start_time
        rate      = (i + 1) / elapsed
        print(f"  Sent {i+1:,} readings | "
              f"Success: {success_count} | Errors: {error_count} | "
              f"Rate: {rate:.1f}/s | Last power: {row['agg_power']:.1f}W")

    # Wait before sending next reading
    time.sleep(SEND_INTERVAL_SECONDS)

# --------------------------------------------------------------------------
# STEP 3: Summary
# --------------------------------------------------------------------------
elapsed = time.time() - start_time
print("\n" + "=" * 60)
print("SIMULATION COMPLETE")
print(f"  Total sent   : {i+1:,}")
print(f"  Successful   : {success_count:,}")
print(f"  Errors       : {error_count}")
print(f"  Time elapsed : {elapsed:.1f} seconds")
print("=" * 60)