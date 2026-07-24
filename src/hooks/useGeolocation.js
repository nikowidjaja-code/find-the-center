import { useState, useCallback } from 'react';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const FETCH_TIMEOUT_MS = 5000;

const GEOLOCATION_ERRORS = {
  1: 'Permission denied. Allow location access in your browser settings.',
  2: 'Location unavailable. Check your internet connection.',
  3: 'Location request timed out. Try again.',
};

/**
 * Provides GPS-based location lookup with reverse geocoding.
 *
 * @returns {{ requestLocation: (onSuccess: (latLng, name) => void) => void, loading: boolean, error: string }}
 */
export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestLocation = useCallback((onSuccess) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }
    setLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEY}`,
            { signal: controller.signal }
          );
          const data = await res.json();
          const name = data.results?.[0]?.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          onSuccess({ lat, lng }, name);
        } catch {
          onSuccess({ lat, lng }, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        } finally {
          clearTimeout(timeout);
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        setError(GEOLOCATION_ERRORS[err.code] || `Could not get location: ${err.message}`);
      }
    );
  }, []);

  return { requestLocation, loading, error };
}
