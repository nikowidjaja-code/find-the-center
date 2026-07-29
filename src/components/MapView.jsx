import { useEffect, useRef } from 'react';
import { Map, useMap } from '@vis.gl/react-google-maps';
import { POINT_STYLES } from '../constants.js';

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

// Green search circle drawn around the computed center point
function CenterCircle({ center, radius = 500 }) {
  const map = useMap();
  const circleRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    if (!center) {
      circleRef.current?.setMap(null);
      circleRef.current = null;
      return;
    }
    if (circleRef.current) {
      circleRef.current.setCenter(center);
      circleRef.current.setRadius(radius);
    } else {
      circleRef.current = new window.google.maps.Circle({
        center, radius,
        strokeColor: '#22c55e', strokeOpacity: 0.7, strokeWeight: 2,
        fillColor: '#22c55e', fillOpacity: 0.08, map,
      });
    }
  }, [map, center?.lat, center?.lng, radius]);

  useEffect(() => () => circleRef.current?.setMap(null), []);
  return null;
}

export default function MapView({
  points = [], center, radius = 500, selectedPlace = null,
}) {
  const defaultCenter = { lat: 2, lng: 110 };
  const filled = points.filter(Boolean);

  const mapCenter =
    center ||
    (filled.length
      ? {
          lat: filled.reduce((s, p) => s + p.lat, 0) / filled.length,
          lng: filled.reduce((s, p) => s + p.lng, 0) / filled.length,
        }
      : defaultCenter);

  const defaultZoom = (filled.length === 0 && !center) ? 4 : 12;

  return (
    <Map
      defaultCenter={mapCenter}
      defaultZoom={defaultZoom}
      gestureHandling="greedy"
      disableDefaultUI={false}
      streetViewControl={false}
      style={{ width: '100%', height: '100%' }}
    >
      {points.map((p, i) =>
        p ? (
          <PinMarker
            key={i}
            position={p}
            color={POINT_STYLES[i].color}
            border={POINT_STYLES[i].border}
            label={POINT_STYLES[i].label}
            scale={1.1}
            zIndex={10}
          />
        ) : null
      )}

      {center && (
        <PinMarker position={center} color="#22c55e" border="#15803d" label="★" scale={1.15} zIndex={20} />
      )}

      {selectedPlace?.location && (
        <PinMarker
          position={{ lat: selectedPlace.location.latitude, lng: selectedPlace.location.longitude }}
          color="#f97316" border="#ea580c" label="•" scale={1.2} zIndex={30}
        />
      )}

      <CenterCircle center={center} radius={radius} />
      <MapController selectedPlace={selectedPlace} />
    </Map>
  );
}
