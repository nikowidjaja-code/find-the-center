import { useEffect, useRef } from 'react';
import { Map, useMap } from '@vis.gl/react-google-maps';
import { POINT_STYLES } from '../constants.js';

// Renders a custom teardrop SVG pin using the legacy Marker API (no Map ID
// required). White halo ring + drop shadow make it read clearly as a placed
// marker and stand apart from Google's built-in red pins / blue location dot.
function PinMarker({ position, color, label, scale = 1, zIndex = 0 }) {
  const map = useMap();
  const markerRef = useRef(null);

  useEffect(() => {
    if (!map || !position) return;

    const w = Math.round(32 * scale);
    const h = Math.round(42 * scale);
    // viewBox 24x32: head centered at (12,12), tip at ~(12,29)
    const svg = `<svg width="${w}" height="${h}" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="30" rx="4.5" ry="1.5" fill="rgba(0,0,0,0.30)"/>
      <path d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12c0 7.7 10.5 17 10.5 17S22.5 19.7 22.5 12C22.5 6.2 17.8 1.5 12 1.5z"
        fill="${color}" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/>
      <circle cx="12" cy="12" r="6.6" fill="rgba(255,255,255,0.22)"/>
      <text x="12" y="15.4" text-anchor="middle" fill="#ffffff" font-weight="700"
        font-size="9.5" font-family="system-ui,sans-serif">${label}</text>
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
          scaledSize: new window.google.maps.Size(w, h),
          // Anchor at the tip so the pin points exactly at the coordinate
          anchor: new window.google.maps.Point(w / 2, Math.round(h * 0.9)),
        },
      });
    }

    return () => {
      markerRef.current?.setMap(null);
      markerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, position?.lat, position?.lng, color, label, scale, zIndex]);

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
            label={POINT_STYLES[i].label}
            scale={1.15}
            zIndex={10}
          />
        ) : null
      )}

      {center && (
        <PinMarker position={center} color="#16a34a" label="★" scale={1.35} zIndex={20} />
      )}

      {selectedPlace?.location && (
        <PinMarker
          position={{ lat: selectedPlace.location.latitude, lng: selectedPlace.location.longitude }}
          color="#ea580c" label="•" scale={1.3} zIndex={30}
        />
      )}

      <CenterCircle center={center} radius={radius} />
      <MapController selectedPlace={selectedPlace} />
    </Map>
  );
}
