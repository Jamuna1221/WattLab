# =============================================================================
# MULTI-APPLIANCE SCENARIO SIMULATOR & ACCURACY VERIFIER
# =============================================================================
# PURPOSE:
#   Simulates a realistic multi-load household scenario (Baseline -> Fridge -> Kettle -> Kettle OFF -> Fridge OFF)
#   Sends readings to Node.js backend (saving to Supabase energy_readings),
#   triggers the Candidate Tray Engine, and verifies mathematical accuracy!
# =============================================================================

import requests
import time
from datetime import datetime, timedelta, timezone
import json

BACKEND_URL = 'http://localhost:5000/api/readings'
FLASK_URL   = 'http://localhost:5001'
DEVICE_ID   = 'SIM-DEVICE-001'
TARIFF_INR  = 8.50  # Tariff rate per kWh

# Scenario Definition (Timesteps in seconds)
# We ensure the Fridge runs for >300 seconds to pass the Flask ML confirmation threshold
SCENARIO = [
    (10, 40.0,   "Phase 1: Baseline standby load (40W)"),
    (250, 190.0, "Phase 2: Fridge turns ON (+150W -> Total 190W)"),
    (40, 2190.0, "Phase 3: Kettle turns ON while Fridge running (+2000W -> Total 2190W)"),
    (30, 190.0,  "Phase 4: Kettle turns OFF (-2000W -> Total 190W)"),
    (20, 40.0,   "Phase 5: Fridge turns OFF (-150W -> Total 40W)"),
]

# Calculate Theoretical Values
fridge_duration_hours = (250 + 40 + 30) / 3600.0  # 320 seconds
fridge_expected_kwh = (150.0 * fridge_duration_hours) / 1000.0

kettle_duration_hours = 40 / 3600.0  # 40 seconds
kettle_expected_kwh = (2000.0 * kettle_duration_hours) / 1000.0

total_expected_kwh = fridge_expected_kwh + kettle_expected_kwh
total_expected_cost_inr = total_expected_kwh * TARIFF_INR

print("=" * 70)
print(" WATTLAB MULTI-APPLIANCE SCENARIO SIMULATOR & ACCURACY VERIFIER")
print("=" * 70)
print(f" Target Device   : {DEVICE_ID}")
print(f" Electricity Rate: INR {TARIFF_INR}/kWh")
print(f"\n THEORETICAL EXPECTED MATH:")
print(f"  - Fridge Expected Energy  : {fridge_expected_kwh:.6f} kWh  (150W for 320s)")
print(f"  - Kettle Expected Energy  : {kettle_expected_kwh:.6f} kWh  (2000W for 40s)")
print(f"  - Total Expected Energy   : {total_expected_kwh:.6f} kWh")
print(f"  - Total Expected Cost     : INR {total_expected_cost_inr:.4f}")
print("=" * 70)

# Reset candidate tray engine on startup for clean test
try:
    requests.post(f"{FLASK_URL}/tray/reset", timeout=2)
    print(" Reset Candidate Tray Engine state successfully")
except Exception as e:
    print(f" Could not reset tray engine: {e}")

print("\n STARTING REAL-TIME SIMULATION (Sending readings every 0.1s)...\n")

start_time = datetime.now(timezone.utc)
current_time = start_time
sent_count = 0

for phase_idx, (duration_secs, power_w, desc) in enumerate(SCENARIO, 1):
    print(f"\n--- {desc} ---")
    for step in range(duration_secs):
        current_time += timedelta(seconds=1)
        payload = {
            'deviceId': DEVICE_ID,
            'voltage': 230.0,
            'current': round(power_w / 230.0, 4),
            'activePower': power_w,
            'apparentPower': round(power_w * 1.05, 2),
            'powerFactor': 0.95,
            'timestamp': current_time.isoformat(),
            'streamType': 'aggregate'
        }

        try:
            res = requests.post(BACKEND_URL, json=payload, timeout=3)
            if res.status_code in (200, 201):
                sent_count += 1
            else:
                print(f" Error: Received {res.status_code} from backend")
        except Exception as err:
            print(f" Error sending reading: {err}")

        # Print quick progress indicator
        if (step + 1) % 10 == 0 or step == duration_secs - 1:
            print(f"  [Progress] {step+1}/{duration_secs}s | Current Power: {power_w}W")

        time.sleep(0.1)  # Fast-forward simulation speed

print("\n" + "=" * 70)
print(" SIMULATION COMPLETE - FETCHING REAL-TIME MODEL RESULTS...")
print("=" * 70)

# 1. Fetch Candidate Tray State
tray_data = {}
try:
    res = requests.get(f"{FLASK_URL}/tray/state", timeout=3)
    if res.status_code == 200:
        tray_data = res.json()
except Exception as e:
    print(f" Error fetching tray state: {e}")

confirmed_kwh = tray_data.get('total_confirmed_kwh', {})
active_events = tray_data.get('active_events', [])

print("\n CANDIDATE TRAY DETECTED APPLIANCES & ENERGY:")
if confirmed_kwh:
    for appliance, kwh in confirmed_kwh.items():
        cost = kwh * TARIFF_INR
        print(f"  - {appliance.capitalize():<15}: {kwh:.6f} kWh  |  Est Cost: INR {cost:.4f}")
else:
    print("  (No appliances fully confirmed yet or events pending)")

print("\n ACTIVE EVENT SNAPSHOT:")
for ev in active_events:
    status = ev.get('status')
    candidates = ", ".join(ev.get('candidates', []))
    delta = ev.get('delta_watts')
    print(f"  - Event Delta: {delta:+}W | Candidates: [{candidates}] | Status: {status}")

# 2. Comparison Summary
print("\n" + "=" * 70)
print(" MATHEMATICAL ACCURACY COMPARISON TABLE")
print("=" * 70)
print(f" {'Metric':<25} | {'Theoretical Math':<18} | {'Engine Detected':<18}")
print("-" * 70)

tray_fridge_kwh = confirmed_kwh.get('fridge', 0.0)
tray_kettle_kwh = confirmed_kwh.get('kettle', 0.0)

print(f" {'Fridge kWh':<25} | {fridge_expected_kwh:<18.6f} | {tray_fridge_kwh:<18.6f}")
print(f" {'Kettle kWh':<25} | {kettle_expected_kwh:<18.6f} | {tray_kettle_kwh:<18.6f}")
print(f" {'Total Session Cost (INR)':<25} | {total_expected_cost_inr:<18.4f} | {(tray_fridge_kwh + tray_kettle_kwh) * TARIFF_INR:<18.4f}")
print("=" * 70)
print("\n You can now check your Live Dashboard UI at http://localhost:5173/dashboard/live")
print(" The Candidate Tray and Session Summary table will display these exact numbers!\n")
