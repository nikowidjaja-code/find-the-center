import { useState, useEffect } from 'react';
import { MAX_NEARBY_PLACES, MAX_SEARCH_RADIUS_M } from '../constants.js';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const FETCH_TIMEOUT_MS = 5000;
const MAX_FETCH_RADIUS = MAX_SEARCH_RADIUS_M;

const PLACES_FIELD_MASK = [
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.types',
  'places.location',
  'places.googleMapsUri',
  'places.id',
  'places.currentOpeningHours.openNow',
].join(',');

/**
 * Fetches nearby places around a center point and enriches them with Distance
 * Matrix data (travel time from every input point). Always fetches at the max
 * radius (MAX_SEARCH_RADIUS_M) so the caller can filter client-side without
 * new API calls on every radius slider change.
 *
 * @param {{ lat: number, lng: number } | null} center
 * @param {Array<{ lat: number, lng: number }>} points - all input points (>=2)
 * @param {string | null} selectedType
 * @returns {{ places: object[], loading: boolean, error: string | null }}
 */
export function useNearbyPlaces(center, points, selectedType, travelMode = 'DRIVING') {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Stable key so the effect only refires when point coordinates actually change
  const pointsKey = (points ?? []).map((p) => `${p.lat},${p.lng}`).join('|');

  useEffect(() => {
    if (!center || !points || points.length < 2) {
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
                  center: { latitude: center.lat, longitude: center.lng },
                  radius: MAX_FETCH_RADIUS,
                },
              },
              rankPreference: 'POPULARITY',
              maxResultCount: MAX_NEARBY_PLACES,
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
              origins: points.map(
                (p) => new window.google.maps.LatLng(p.lat, p.lng)
              ),
              destinations: rawPlaces.map(
                (p) => new window.google.maps.LatLng(p.location.latitude, p.location.longitude)
              ),
              travelMode: window.google.maps.TravelMode[travelMode],
              // Traffic-aware drive times (duration_in_traffic on each element)
              ...(travelMode === 'DRIVING' && {
                drivingOptions: { departureTime: new Date() },
              }),
            },
            (result, status) => {
              if (cancelled) { reject(new Error('cancelled')); return; }
              if (status === window.google.maps.DistanceMatrixStatus.OK) resolve(result);
              else reject(new Error(`Distance Matrix error: ${status}`));
            }
          );
        });

        if (cancelled) return;

        // from[i] = travel from points[i] to this place (null if not OK).
        // Prefer traffic-aware duration when the matrix returns one.
        const enriched = rawPlaces.map((p, destIdx) => ({
          ...p,
          from: points.map((_, ptIdx) => {
            const el = matrixData.rows?.[ptIdx]?.elements?.[destIdx];
            if (el?.status !== 'OK') return null;
            return el.duration_in_traffic ? { ...el, duration: el.duration_in_traffic } : el;
          }),
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng, selectedType, travelMode, pointsKey]);

  return { places, loading, error };
}
