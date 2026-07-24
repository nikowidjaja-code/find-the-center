import { useState, useEffect, useRef } from 'react';
import { findTimeMidpoint } from '../utils/midpoint.js';

const DIRECTIONS_ERRORS = {
  NOT_FOUND: 'One or both locations could not be found.',
  ZERO_RESULTS: 'No driving route found between these locations.',
  INVALID_REQUEST: 'Invalid request. Try different locations.',
  OVER_QUERY_LIMIT: 'Too many requests. Please wait and try again.',
  REQUEST_DENIED: 'Directions request was denied.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
};

/**
 * Fetches driving directions between pointA and pointB using the
 * Google Maps DirectionsService, then computes the time-equidistant midpoint.
 *
 * @param {{ lat: number, lng: number } | null} pointA
 * @param {{ lat: number, lng: number } | null} pointB
 * @returns {{ directionsResult: object|null, midpoint: {lat,lng}|null, loading: boolean, error: string|null }}
 */
export function useDirections(pointA, pointB) {
  const [directionsResult, setDirectionsResult] = useState(null);
  const [midpoint, setMidpoint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const serviceRef = useRef(null);

  useEffect(() => {
    if (!pointA || !pointB) {
      setDirectionsResult(null);
      setMidpoint(null);
      setError(null);
      return;
    }

    // Debounce: wait 350 ms after the last change before firing the API call.
    // Prevents multiple requests when both points update in quick succession.
    const timer = setTimeout(() => {
      if (!window.google?.maps?.DirectionsService) {
        setError('Google Maps is not loaded yet.');
        return;
      }

      if (!serviceRef.current) {
        serviceRef.current = new window.google.maps.DirectionsService();
      }

      setLoading(true);
      setError(null);

      const request = {
        origin: new window.google.maps.LatLng(pointA.lat, pointA.lng),
        destination: new window.google.maps.LatLng(pointB.lat, pointB.lng),
        travelMode: window.google.maps.TravelMode.DRIVING,
      };

      serviceRef.current.route(request, (result, status) => {
        setLoading(false);
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirectionsResult(result);
          try {
            setMidpoint(findTimeMidpoint(result));
          } catch (e) {
            setError('Could not compute midpoint: ' + e.message);
          }
        } else {
          setDirectionsResult(null);
          setMidpoint(null);
          setError(DIRECTIONS_ERRORS[status] ?? `Could not get directions: ${status}`);
        }
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [
    pointA?.lat,
    pointA?.lng,
    pointB?.lat,
    pointB?.lng,
  ]);

  return { directionsResult, midpoint, loading, error };
}
