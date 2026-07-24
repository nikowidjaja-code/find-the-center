import { useEffect, useRef } from 'react';
import { Map, useMap } from '@vis.gl/react-google-maps';

// Renders a custom SVG pin using the legacy Marker API (no Map ID required)
function PinMarker({ position, color, border, label, scale = 1, zIndex = 0 }) {
  const map = useMap();
  const markerRef = useRef(null);

  useEffect(() => {
    if (!map || !position) return;

    const size = Math.round(36 * scale);
    const half = size / 2;
    const r = half - 3;
    const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${half}" cy="${half}" r="${r}" fill="${color}" stroke="${border}" stroke-width="2.5"/>
      <text x="${half}" y="${half + 5}" text-anchor="middle" fill="white" font-weight="bold"
        font-size="${Math.round(14 * scale)}" font-family="system-ui,sans-serif">${label}</text>
    </svg>`;
    const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

    if (markerRef.current) {
      markerRef.current.setPosition(position);
    } else {
      markerRef.current = new window.google.maps.Marker({
        map,
        position,
        zIndex,
        icon: {
          url,
          scaledSize: new window.google.maps.Size(size, size),
          anchor: new window.google.maps.Point(half, half),
        },
      });
    }

    return () => {
      markerRef.current?.setMap(null);
      markerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, position?.lat, position?.lng, color, border, label, scale, zIndex]);

  return null;
}

function MapController({ selectedPlace }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !selectedPlace?.location) return;
    const pos = { lat: selectedPlace.location.latitude, lng: selectedPlace.location.longitude };
    // Pan first, then zoom in after a short delay — creates a "fly to" feel
    map.panTo(pos);
    const t = setTimeout(() => map.setZoom(15), 250);
    return () => clearTimeout(t);
  }, [map, selectedPlace]);
  return null;
}

function RouteLayer({ directionsResult, midpoint, radius = 500 }) {
  const map = useMap();
  const rendererRef = useRef(null);
  const circleRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    if (!directionsResult) {
      rendererRef.current?.setMap(null);
      rendererRef.current = null;
      return;
    }
    if (!rendererRef.current) {
      rendererRef.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#6366f1', strokeWeight: 5, strokeOpacity: 0.8 },
      });
    }
    rendererRef.current.setMap(map);
    rendererRef.current.setDirections(directionsResult);
  }, [map, directionsResult]);

  useEffect(() => {
    if (!map) return;
    if (!midpoint) {
      circleRef.current?.setMap(null);
      circleRef.current = null;
      return;
    }
    if (circleRef.current) {
      circleRef.current.setCenter(midpoint);
      circleRef.current.setRadius(radius);
    } else {
      circleRef.current = new window.google.maps.Circle({
        center: midpoint, radius,
        strokeColor: '#22c55e', strokeOpacity: 0.7, strokeWeight: 2,
        fillColor: '#22c55e', fillOpacity: 0.08, map,
      });
    }
  }, [map, midpoint?.lat, midpoint?.lng, radius]);

  useEffect(() => () => {
    rendererRef.current?.setMap(null);
    circleRef.current?.setMap(null);
  }, []);

  return null;
}

export default function MapView({
  pointA, pointB, midpoint, radius = 500,
  directionsResult, selectedPlace = null,
}) {
  const defaultCenter = { lat: -7.25, lng: 110 };

  const mapCenter =
    midpoint ||
    (pointA && pointB
      ? { lat: (pointA.lat + pointB.lat) / 2, lng: (pointA.lng + pointB.lng) / 2 }
      : pointA || pointB || defaultCenter);

  const defaultZoom = (!pointA && !pointB && !midpoint) ? 8 : 12;

  return (
    <Map
      defaultCenter={mapCenter}
      defaultZoom={defaultZoom}
      gestureHandling="greedy"
      disableDefaultUI={false}
      streetViewControl={false}
      style={{ width: '100%', height: '100%' }}
    >
      {pointA && <PinMarker position={pointA} color="#6366f1" border="#4338ca" label="A" scale={1.1} zIndex={10} />}
      {pointB && <PinMarker position={pointB} color="#f43f5e" border="#be123c" label="B" scale={1.1} zIndex={10} />}
      {selectedPlace?.location && (
        <PinMarker
          position={{ lat: selectedPlace.location.latitude, lng: selectedPlace.location.longitude }}
          color="#f97316" border="#ea580c" label="•" scale={1.2} zIndex={30}
        />
      )}

      <RouteLayer directionsResult={directionsResult} midpoint={midpoint} radius={radius} />
      <MapController selectedPlace={selectedPlace} />
    </Map>
  );
}
