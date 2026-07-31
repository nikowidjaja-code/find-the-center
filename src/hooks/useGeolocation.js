import { useState, useCallback } from 'react';

const GEOLOCATION_ERRORS = {
  1: 'Permission denied. Allow location access in your browser settings.',
  2: 'Location unavailable. Check your internet connection.',
  3: 'Location request timed out. Try again.',
};

// Extract a short, human-readable name from Geocoder results
export function pickReadableName(results) {
  if (!results?.length) return null;

  // Prefer a result with a street route
  const target =
    results.find(r => r.types.some(t => ['street_address', 'route', 'establishment', 'point_of_interest'].includes(t))) ||
    results[0];

  const comps = target.address_components;
  const get = (...types) => comps.find(c => types.some(t => c.types.includes(t)))?.long_name;

  const street = get('route');
  const area   = get('neighborhood', 'sublocality_level_1', 'sublocality');
  const city   = get('locality', 'administrative_area_level_2');

  if (street && city) return `${street}, ${city}`;
  if (area && city)   return `${area}, ${city}`;
  return results[0].formatted_address;
}

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const requestLocation = useCallback((onSuccess) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }
    setLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

        if (!window.google?.maps?.Geocoder) {
          setLoading(false);
          onSuccess({ lat, lng }, fallback);
          return;
        }

        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          setLoading(false);
          const name = status === 'OK' ? (pickReadableName(results) ?? fallback) : fallback;
          onSuccess({ lat, lng }, name);
        });
      },
      (err) => {
        setLoading(false);
        setError(GEOLOCATION_ERRORS[err.code] || `Could not get location: ${err.message}`);
      }
    );
  }, []);

  return { requestLocation, loading, error };
}
