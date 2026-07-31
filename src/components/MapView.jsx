import { useEffect, useRef } from 'react';
import { Map, useMap } from '@vis.gl/react-google-maps';
import { POINT_STYLES } from '../constants.js';

// Renders a custom teardrop SVG pin using the legacy Marker API (no Map ID
// required). White halo ring + drop shadow make it read clearly as a placed
// marker and stand apart from Google's built-in red pins / blue location dot.
function PinMarker({ position, color, label, scale = 1, zIndex = 0, draggable = false, onDragEnd, onClick, title }) {
  const map = useMap();
  const markerRef = useRef(null);
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

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
        draggable,
        icon: {
          url,
          scaledSize: new window.google.maps.Size(w, h),
          // Anchor at the tip so the pin points exactly at the coordinate
          anchor: new window.google.maps.Point(w / 2, Math.round(h * 0.9)),
        },
      });
      if (draggable) {
        markerRef.current.addListener('dragend', (e) =>
          onDragEndRef.current?.({ lat: e.latLng.lat(), lng: e.latLng.lng() })
        );
      }
      if (onClickRef.current) {
        markerRef.current.addListener('click', () => onClickRef.current?.());
      }
      if (title) markerRef.current.setTitle(title);
    }

    return () => {
      markerRef.current?.setMap(null);
      markerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, position?.lat, position?.lng, color, label, scale, zIndex, draggable]);

  return null;
}

// Refit the viewport to show every pin whenever the set of points/center
// changes. Padded so the overlaid panels (desktop sidebar, mobile header)
// don't cover the pins. Keyed on coordinates so user panning is untouched.
function FitBounds({ points, center }) {
  const map = useMap();
  const coords = [...points, center].filter(Boolean);
  const key = coords.map((c) => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`).join('|');

  useEffect(() => {
    if (!map || coords.length === 0) return;
    if (coords.length === 1) {
      map.panTo(coords[0]);
      map.setZoom(14);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    coords.forEach((c) => bounds.extend(c));
    const desktop = window.matchMedia('(min-width: 640px)').matches;
    const short = window.matchMedia('(max-height: 500px)').matches;
    map.fitBounds(
      bounds,
      desktop
        // sidebar is 288px wide on short viewports, 320–384px otherwise
        ? { top: 40, bottom: 40, left: short ? 330 : 440, right: 60 }
        : { top: 200, bottom: 80, left: 40, right: 40 } // below the mobile input panel
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

// The computed center is a reference point, not a destination — a small dot
// with a white ring, not a teardrop pin like the inputs and places.
function CenterDot({ position }) {
  const map = useMap();
  const markerRef = useRef(null);

  useEffect(() => {
    if (!map || !position) return;
    markerRef.current = new window.google.maps.Marker({
      map,
      position,
      zIndex: 20,
      clickable: false,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: '#16a34a',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2.5,
      },
    });
    return () => {
      markerRef.current?.setMap(null);
      markerRef.current = null;
    };
  }, [map, position?.lat, position?.lng]);

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
  onMapClick, onPointDrag, onPointClick,
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
      mapTypeControl={false}
      fullscreenControl={false}
      style={{ width: '100%', height: '100%' }}
      onClick={onMapClick ? (ev) => { const ll = ev.detail?.latLng; if (ll) onMapClick(ll); } : undefined}
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
            draggable={!!onPointDrag}
            onDragEnd={(ll) => onPointDrag(i, ll)}
            onClick={onPointClick ? () => onPointClick(i) : undefined}
            title={`Point ${POINT_STYLES[i].label} — tap to remove, drag to move`}
          />
        ) : null
      )}

      {center && <CenterDot position={center} />}

      {selectedPlace?.location && (
        <PinMarker
          position={{ lat: selectedPlace.location.latitude, lng: selectedPlace.location.longitude }}
          color="#ea580c" label="•" scale={1.3} zIndex={30}
        />
      )}

      <CenterCircle center={center} radius={radius} />
      <FitBounds points={filled} center={center} />
      <MapController selectedPlace={selectedPlace} />
    </Map>
  );
}
