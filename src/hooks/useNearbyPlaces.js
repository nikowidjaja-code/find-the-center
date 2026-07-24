import { useState, useEffect } from 'react';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const FETCH_TIMEOUT_MS = 5000;
const MAX_FETCH_RADIUS = 2000;

const PLACES_FIELD_MASK = [
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.types',
  'places.location',
  'places.googleMapsUri',
  'places.id',
].join(',');

/**
 * Fetches nearby places around a midpoint and enriches them with Distance Matrix data.
 * Always fetches at the maximum radius (2000m) so the caller can filter client-side
 * without triggering new API calls on every radius slider change.
 *
 * @param {{ lat: number, lng: number } | null} midpoint
 * @param {{ lat: number, lng: number } | null} pointA
 * @param {{ lat: number, lng: number } | null} pointB
 * @param {string | null} selectedType
 * @returns {{ places: object[], loading: boolean, error: string | null }}
 */
export function useNearbyPlaces(midpoint, pointA, pointB, selectedType) {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!midpoint || !pointA || !pointB) {
      setPlaces([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const fetchPlaces = async () => {
      setLoading(true);
      setError(null);

      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(
          'https://places.googleapis.com/v1/places:searchNearby',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': API_KEY,
              'X-Goog-FieldMask': PLACES_FIELD_MASK,
            },
            body: JSON.stringify({
              locationRestriction: {
                circle: {
                  center: { latitude: midpoint.lat, longitude: midpoint.lng },
                  radius: MAX_FETCH_RADIUS,
                },
              },
              rankPreference: 'POPULARITY',
              maxResultCount: 20,
              ...(selectedType && { includedTypes: [selectedType] }),
            }),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Places API error ${response.status}: ${text}`);
        }

        const data = await response.json();
        const rawPlaces = Array.isArray(data.places) ? data.places : [];

        if (cancelled) return;

        if (rawPlaces.length === 0) {
          setPlaces([]);
          setLoading(false);
          return;
        }

        // Distance Matrix via Maps JS SDK (avoids CORS on the REST endpoint)
        const matrixData = await new Promise((resolve, reject) => {
          const svc = new window.google.maps.DistanceMatrixService();
          svc.getDistanceMatrix(
            {
              origins: [
                new window.google.maps.LatLng(pointA.lat, pointA.lng),
                new window.google.maps.LatLng(pointB.lat, pointB.lng),
              ],
              destinations: rawPlaces.map(
                (p) => new window.google.maps.LatLng(p.location.latitude, p.location.longitude)
              ),
              travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
              if (cancelled) { reject(new Error('cancelled')); return; }
              if (status === window.google.maps.DistanceMatrixStatus.OK) resolve(result);
              else reject(new Error(`Distance Matrix error: ${status}`));
            }
          );
        });

        if (cancelled) return;

        const enriched = rawPlaces.map((p, i) => ({
          ...p,
          fromA: matrixData.rows?.[0]?.elements?.[i]?.status === 'OK'
            ? matrixData.rows[0].elements[i]
            : null,
          fromB: matrixData.rows?.[1]?.elements?.[i]?.status === 'OK'
            ? matrixData.rows[1].elements[i]
            : null,
        }));

        setPlaces(enriched);
        setLoading(false);
      } catch (err) {
        if (err.name === 'AbortError' || err.message === 'cancelled') return;
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      } finally {
        clearTimeout(timeout);
      }
    };

    fetchPlaces();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [midpoint?.lat, midpoint?.lng, selectedType, pointA?.lat, pointA?.lng, pointB?.lat, pointB?.lng]);

  return { places, loading, error };
}
