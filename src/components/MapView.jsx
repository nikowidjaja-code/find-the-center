import { useEffect, useRef } from 'react';
import {
  Map,
  AdvancedMarker,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';

function MapController({ selectedPlace }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !selectedPlace?.location) return;
    map.panTo({ lat: selectedPlace.location.latitude, lng: selectedPlace.location.longitude });
    map.setZoom(17);
  }, [map, selectedPlace]);
  return null;
}

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

/**
 * RouteLayer — renders the directions polyline + 500m circle.
 * Must be a child of <Map> so it can access the map instance.
 */
function RouteLayer({ directionsResult, midpoint, radius = 500 }) {
  const map = useMap();
  const rendererRef = useRef(null);
  const circleRef = useRef(null);

  // Draw or update the directions route
  useEffect(() => {
    if (!map) return;

    if (!directionsResult) {
      if (rendererRef.current) {
        rendererRef.current.setMap(null);
        rendererRef.current = null;
      }
      return;
    }

    if (!rendererRef.current) {
      rendererRef.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#6366f1',
          strokeWeight: 5,
          strokeOpacity: 0.8,
        },
      });
    }

    rendererRef.current.setMap(map);
    rendererRef.current.setDirections(directionsResult);
  }, [map, directionsResult]);

  // Draw or update the circle around midpoint — update in-place to avoid flicker
  useEffect(() => {
    if (!map) return;

    if (!midpoint) {
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      return;
    }

    if (circleRef.current) {
      circleRef.current.setCenter(midpoint);
      circleRef.current.setRadius(radius);
    } else {
      circleRef.current = new window.google.maps.Circle({
        center: midpoint,
        radius,
        strokeColor: '#22c55e',
        strokeOpacity: 0.7,
        strokeWeight: 2,
        fillColor: '#22c55e',
        fillOpacity: 0.08,
        map,
      });
    }
  }, [map, midpoint?.lat, midpoint?.lng, radius]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      rendererRef.current?.setMap(null);
      circleRef.current?.setMap(null);
    };
  }, []);

  return null;
}

/**
 * MapView — Google Map with markers for A, B, midpoint and the route.
 *
 * Props:
 *   pointA            — { lat, lng } or null
 *   pointB            — { lat, lng } or null
 *   midpoint          — { lat, lng } or null
 *   directionsResult  — DirectionsResult or null
 *   activeInput       — "A" | "B" | null  (which point a map click will set)
 *   onMapClick(latLng: {lat, lng}) — called when user clicks the map
 */
export default function MapView({
  pointA,
  pointB,
  midpoint,
  radius = 500,
  directionsResult,
  activeInput,
  onMapClick,
  selectedPlace = null,
}) {
  const defaultCenter = { lat: 1.3521, lng: 103.8198 }; // Singapore

  const handleMapClick = (e) => {
    if (!activeInput) return;
    const latLng = e.detail?.latLng;
    if (latLng) {
      onMapClick({ lat: latLng.lat, lng: latLng.lng });
    }
  };

  // Compute a reasonable center: prefer midpoint, else average A&B, else A, else default
  const mapCenter =
    midpoint ||
    (pointA && pointB
      ? { lat: (pointA.lat + pointB.lat) / 2, lng: (pointA.lng + pointB.lng) / 2 }
      : pointA || pointB || defaultCenter);

  return (
    <Map
      mapId={MAP_ID}
      defaultCenter={mapCenter}
      defaultZoom={12}
      gestureHandling="greedy"
      disableDefaultUI={false}
      onClick={handleMapClick}
      style={{ width: '100%', height: '100%' }}
      className={activeInput ? 'cursor-crosshair' : ''}
    >
      {/* Point A marker — indigo/blue */}
      {pointA && (
        <AdvancedMarker position={pointA} title="Point A">
          <Pin
            background="#6366f1"
            borderColor="#4338ca"
            glyphColor="#ffffff"
            glyph="A"
            scale={1.2}
          />
        </AdvancedMarker>
      )}

      {/* Point B marker — rose/red */}
      {pointB && (
        <AdvancedMarker position={pointB} title="Point B">
          <Pin
            background="#f43f5e"
            borderColor="#be123c"
            glyphColor="#ffffff"
            glyph="B"
            scale={1.2}
          />
        </AdvancedMarker>
      )}

      {/* Midpoint marker — green star */}
      {midpoint && (
        <AdvancedMarker position={midpoint} title="Time midpoint">
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#22c55e',
              border: '3px solid #16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              fontSize: 18,
              color: 'white',
            }}
          >
            ★
          </div>
        </AdvancedMarker>
      )}

      {/* Selected place marker — orange pin */}
      {selectedPlace?.location && (
        <AdvancedMarker
          position={{ lat: selectedPlace.location.latitude, lng: selectedPlace.location.longitude }}
          title={selectedPlace.displayName?.text}
        >
          <Pin background="#f97316" borderColor="#ea580c" glyphColor="#ffffff" scale={1.3} />
        </AdvancedMarker>
      )}

      <RouteLayer directionsResult={directionsResult} midpoint={midpoint} radius={radius} />
      <MapController selectedPlace={selectedPlace} />
    </Map>
  );
}
