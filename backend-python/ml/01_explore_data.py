# =============================================================================
# SCRIPT 01 — EXPLORE THE UK-DALE DATASET
# =============================================================================

import pandas as pd
import matplotlib.pyplot as plt
import os

# --------------------------------------------------------------------------
# STEP 1: Define where your data files are
# --------------------------------------------------------------------------
DATA_FOLDER = os.path.join("house_1")

if not os.path.exists(DATA_FOLDER):
    print("ERROR: house_1 folder not found!")
    
    exit()

# --------------------------------------------------------------------------
# STEP 2: Load the aggregate (total house power) file
# --------------------------------------------------------------------------
# pd.read_csv loads a file into a DataFrame — like a table in Python
# sep=' '  means columns are separated by a space
# names=[] gives column names (the file has no header row)
print("=" * 60)
print("LOADING AGGREGATE (TOTAL HOUSE) POWER...")
print("=" * 60)

agg_path = os.path.join(DATA_FOLDER, "channel_1.dat")
agg = pd.read_csv(agg_path, sep=' ', names=['timestamp', 'power'])

# Convert Unix timestamp (seconds since 1970) to a readable datetime
agg['datetime'] = pd.to_datetime(agg['timestamp'], unit='s')
agg.set_index('datetime', inplace=True)
agg.drop('timestamp', axis=1, inplace=True)

# --------------------------------------------------------------------------
# STEP 3: Print statistics
# --------------------------------------------------------------------------
print(f"\nAGGREGATE DATA SUMMARY:")
print(f"   Total readings     : {len(agg):,}")
print(f"   Date range         : {agg.index.min()} to {agg.index.max()}")
print(f"   Min power (W)      : {agg['power'].min():.1f}")
print(f"   Max power (W)      : {agg['power'].max():.1f}")
print(f"   Average power (W)  : {agg['power'].mean():.1f}")
print(f"   Missing values     : {agg['power'].isna().sum()}")
print(f"\n   First 5 rows:")
print(agg.head())

# --------------------------------------------------------------------------
# STEP 4: Load and check each appliance file
# --------------------------------------------------------------------------
appliances = {
    'Kettle'          : 'channel_10.dat',
    'Washing Machine' : 'channel_5.dat',
    'Fridge'          : 'channel_12.dat',
    'Dishwasher'      : 'channel_6.dat',
    'Microwave'       : 'channel_13.dat',
}

print("\n" + "=" * 60)
print("CHECKING APPLIANCE FILES...")
print("=" * 60)

for appliance_name, filename in appliances.items():
    filepath = os.path.join(DATA_FOLDER, filename)
    if not os.path.exists(filepath):
        print(f"\n  {appliance_name}: '{filename}' NOT FOUND - skip for now")
        continue

    app_df = pd.read_csv(filepath, sep=' ', names=['timestamp', 'power'])
    app_df['datetime'] = pd.to_datetime(app_df['timestamp'], unit='s')
    app_df.set_index('datetime', inplace=True)
    app_df.drop('timestamp', axis=1, inplace=True)

    print(f"\n  {appliance_name} ({filename})")
    print(f"   Readings   : {len(app_df):,}")
    print(f"   Max power  : {app_df['power'].max():.1f} W")
    print(f"   Avg power  : {app_df['power'].mean():.1f} W")
    print(f"   Date range : {app_df.index.min()} to {app_df.index.max()}")

# --------------------------------------------------------------------------
# STEP 5: Plot one week of aggregate power
# --------------------------------------------------------------------------
print("\n" + "=" * 60)
print("PLOTTING 1 WEEK OF AGGREGATE POWER...")
print("=" * 60)

start_date = agg.index.min()
end_date   = start_date + pd.Timedelta(days=7)
week_data  = agg['power'][start_date:end_date]

plt.figure(figsize=(14, 4))
plt.plot(week_data, color='steelblue', linewidth=0.8)
plt.title('UK-DALE House 1 — Aggregate Power (1 Week)', fontsize=14)
plt.xlabel('Date/Time')
plt.ylabel('Power (Watts)')
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig('output_01_aggregate_week.png', dpi=120)
print("Chart saved -> ml/output_01_aggregate_week.png")

# --------------------------------------------------------------------------
# STEP 6: Compare aggregate vs kettle (side by side)
# --------------------------------------------------------------------------
kettle_path = os.path.join(DATA_FOLDER, "channel_10.dat")
if os.path.exists(kettle_path):
    kettle = pd.read_csv(kettle_path, sep=' ', names=['timestamp', 'power'])
    kettle['datetime'] = pd.to_datetime(kettle['timestamp'], unit='s')
    kettle.set_index('datetime', inplace=True)
    kettle.drop('timestamp', axis=1, inplace=True)

    kettle_week = kettle['power'][start_date:end_date]

    fig, axes = plt.subplots(2, 1, figsize=(14, 6), sharex=True)
    axes[0].plot(week_data, color='steelblue', linewidth=0.8)
    axes[0].set_title('Aggregate (Total House) Power — This is the INPUT to our model')
    axes[0].set_ylabel('Watts')
    axes[0].grid(True, alpha=0.3)

    axes[1].plot(kettle_week, color='orangered', linewidth=0.8)
    axes[1].set_title('Kettle Power — This is what the model must PREDICT from aggregate')
    axes[1].set_ylabel('Watts')
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig('output_01_agg_vs_kettle.png', dpi=120)
    print("Comparison chart saved -> ml/output_01_agg_vs_kettle.png")

print("\n" + "=" * 60)
print("SCRIPT 01 COMPLETE")
print("Next step: Run  python 02_preprocess.py")
print("=" * 60)