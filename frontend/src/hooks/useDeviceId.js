import { useEffect, useState } from 'react';

/**
 * Resolves the current user's assigned device ID.
 * Priority:
 *   1. Try to fetch the user's devices from the backend (uses stored JWT token)
 *   2. Fall back to localStorage 'wattlab_device_id'
 *   3. Fall back to VITE_DEFAULT_DEVICE_ID env var
 *   4. Fall back to 'SIM-DEVICE-001'
 */
export function useDeviceId() {
  const [deviceId, setDeviceId] = useState(
    () =>
      localStorage.getItem('wattlab_device_id') ||
      import.meta.env.VITE_DEFAULT_DEVICE_ID ||
      'SIM-DEVICE-001'
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    fetch('http://localhost:5000/api/devices', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.devices) && data.devices.length > 0) {
          const id = data.devices[0].device_id;
          setDeviceId(id);
          localStorage.setItem('wattlab_device_id', id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { deviceId, loading };
}
