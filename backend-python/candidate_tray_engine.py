from datetime import datetime
from uuid import uuid4


APPLIANCE_SIGNATURES = {
    "kettle": {
        "min_watts": 1500,
        "max_watts": 3100,
        "min_duration_seconds": 30,
        "max_duration_seconds": 300,
        "periodic": False,
    },
    "microwave": {
        "min_watts": 600,
        "max_watts": 1800,
        "min_duration_seconds": 20,
        "max_duration_seconds": 600,
        "periodic": False,
    },
    "fridge": {
        "min_watts": 80,
        "max_watts": 400,
        "min_duration_seconds": 300,
        "max_duration_seconds": 2400,
        "periodic": True,
        "cycle_period_seconds": 900,
    },
    "washing_machine": {
        "min_watts": 300,
        "max_watts": 2500,
        "min_duration_seconds": 900,
        "max_duration_seconds": 5400,
        "periodic": False,
    },
    "dishwasher": {
        "min_watts": 200,
        "max_watts": 2000,
        "min_duration_seconds": 1800,
        "max_duration_seconds": 7200,
        "periodic": False,
    },
}


class CandidateTrayEngine:
    def __init__(self, step_threshold_watts=100.0, noise_floor_watts=30.0):
        self.step_threshold_watts = float(step_threshold_watts)
        self.noise_floor_watts = float(noise_floor_watts)
        self.previous_power = None
        self.baseline_power = 0.0
        self.current_power = 0.0
        self.active_events = []
        self.confirmed_this_reading = []
        self.total_confirmed_kwh = {}

    def process_reading(self, timestamp, agg_power_watts):
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))

        agg_power_watts = float(agg_power_watts)
        self.current_power = agg_power_watts
        self.confirmed_this_reading = []

        if self.previous_power is None:
            self.previous_power = agg_power_watts
            self.baseline_power = agg_power_watts if agg_power_watts <= self.noise_floor_watts else 0.0
            return self.get_state()

        delta = agg_power_watts - self.previous_power
        if abs(delta) >= self.step_threshold_watts:
            self._open_event(timestamp, delta)

        for event in self.active_events:
            if event["status"] != "pending":
                continue

            event["elapsed_seconds"] = max(
                0.0,
                (timestamp - event["started_at"]).total_seconds(),
            )
            self._eliminate_candidates(event, agg_power_watts)
            self._confirm_or_eliminate_event(event)

        if not any(event["status"] == "pending" for event in self.active_events):
            self.baseline_power = self._smooth_baseline(agg_power_watts)

        self.previous_power = agg_power_watts
        return self.get_state()

    def get_state(self):
        return {
            "current_power_watts": float(self.current_power),
            "baseline_watts": float(self.baseline_power),
            "active_events": [
                {
                    "event_id": event["event_id"],
                    "delta_watts": float(event["delta_watts"]),
                    "elapsed_seconds": float(event["elapsed_seconds"]),
                    "candidates": list(event["candidates"]),
                    "status": event["status"],
                    "confirmed_appliance": event["confirmed_appliance"],
                }
                for event in self.active_events
            ],
            "confirmed_this_reading": list(self.confirmed_this_reading),
            "total_confirmed_kwh": dict(self.total_confirmed_kwh),
        }

    def _open_event(self, timestamp, delta_watts):
        magnitude = abs(float(delta_watts))
        candidates = [
            name
            for name, signature in APPLIANCE_SIGNATURES.items()
            if signature["min_watts"] <= magnitude <= signature["max_watts"]
        ] or ["other"]

        self.active_events.append({
            "event_id": str(uuid4()),
            "started_at": timestamp,
            "delta_watts": float(delta_watts),
            "candidates": candidates,
            "elapsed_seconds": 0.0,
            "status": "pending",
            "confirmed_appliance": None,
            "energy_recorded": False,
        })

    def _eliminate_candidates(self, event, agg_power_watts):
        remaining = []
        has_dropped = self._event_power_has_dropped(event, agg_power_watts)

        for candidate in event["candidates"]:
            if candidate == "other":
                remaining.append(candidate)
                continue

            signature = APPLIANCE_SIGNATURES[candidate]
            elapsed = event["elapsed_seconds"]
            if elapsed > signature["max_duration_seconds"]:
                continue
            if elapsed < signature["min_duration_seconds"] and has_dropped:
                continue
            remaining.append(candidate)

        event["candidates"] = remaining

    def _confirm_or_eliminate_event(self, event):
        if not event["candidates"]:
            event["status"] = "eliminated"
            event["confirmed_appliance"] = "other"
            self._record_confirmation(event, "other")
            return

        if len(event["candidates"]) != 1:
            return

        candidate = event["candidates"][0]
        min_duration = 0.0
        if candidate != "other":
            min_duration = APPLIANCE_SIGNATURES[candidate]["min_duration_seconds"]

        if event["elapsed_seconds"] >= min_duration:
            event["status"] = "confirmed"
            event["confirmed_appliance"] = candidate
            self._record_confirmation(event, candidate)

    def _record_confirmation(self, event, appliance):
        if event["energy_recorded"]:
            return

        watts = abs(float(event["delta_watts"]))
        hours = max(float(event["elapsed_seconds"]), 0.0) / 3600.0
        kwh = watts * hours / 1000.0
        self.total_confirmed_kwh[appliance] = round(
            self.total_confirmed_kwh.get(appliance, 0.0) + kwh,
            6,
        )
        self.confirmed_this_reading.append(appliance)
        event["energy_recorded"] = True

    def _event_power_has_dropped(self, event, agg_power_watts):
        if event["delta_watts"] >= 0:
            expected_floor = self.baseline_power + abs(event["delta_watts"])
            return agg_power_watts < expected_floor - self.noise_floor_watts

        expected_ceiling = max(self.baseline_power - abs(event["delta_watts"]), 0.0)
        return agg_power_watts > expected_ceiling + self.noise_floor_watts

    def _smooth_baseline(self, agg_power_watts):
        if agg_power_watts <= self.noise_floor_watts:
            return agg_power_watts
        return (self.baseline_power * 0.9) + (agg_power_watts * 0.1)
