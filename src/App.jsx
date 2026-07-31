import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { APIProvider, useApiIsLoaded } from '@vis.gl/react-google-maps';
import LocationInput from './components/LocationInput.jsx';
import MapView from './components/MapView.jsx';
import PlacesList from './components/PlacesList.jsx';
import SelectedPlaceCard from './components/SelectedPlaceCard.jsx';
import { useDebounce } from './hooks/useDebounce.js';
import { useNearbyPlaces } from './hooks/useNearbyPlaces.js';
import { pickReadableName } from './hooks/useGeolocation.js';
import { calcFairness, calcScore } from './utils/fairness.js';
import {
  DEFAULT_SEARCH_RADIUS_M,
  MIN_SEARCH_RADIUS_M,
  MAX_SEARCH_RADIUS_M,
  RADIUS_DEBOUNCE_MS,
  MIN_POINTS,
  MAX_POINTS,
  POINT_STYLES,
} from './constants.js';

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const emptyPoint = () => ({ name: '', coord: null });

const PLACE_TYPES = [
  { label: 'All',        value: null,             emoji: '🗺️' },
  { label: 'Restaurant', value: 'restaurant',     emoji: '🍽️' },
  { label: 'Cafe',       value: 'cafe',           emoji: '☕' },
  { label: 'Bar',        value: 'bar',            emoji: '🍺' },
  { label: 'Mall',       value: 'shopping_mall',  emoji: '🛍️' },
  { label: 'Park',       value: 'park',           emoji: '🌳' },
  { label: 'Cinema',     value: 'movie_theater',  emoji: '🎬' },
  { label: 'Supermarket',value: 'supermarket',    emoji: '🛒' },
];

const RATING_FILTERS = [
  { label: 'Any',  value: 0   },
  { label: '3.5+', value: 3.5 },
  { label: '4.0+', value: 4.0 },
  { label: '4.5+', value: 4.5 },
];

const SORT_OPTIONS = [
  { label: 'Best',    value: 'balanced',   title: 'Balance of rating, popularity and fair travel times' },
  { label: 'Fairest', value: 'fairness',   title: 'Most equal travel times from every point' },
  { label: 'Rating',  value: 'rating',     title: 'Highest rated first' },
  { label: 'Popular', value: 'popularity', title: 'Most reviewed first' },
];

const TRAVEL_MODES = [
  {
    value: 'DRIVING',
    label: 'Drive',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v9a2 2 0 01-2 2h-1"/>
        <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
      </svg>
    ),
  },
  {
    value: 'TRANSIT',
    label: 'Transit',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="14" rx="2"/>
        <path d="M4 11h16M12 3v8"/><circle cx="8.5" cy="20.5" r="1.5"/><circle cx="15.5" cy="20.5" r="1.5"/>
        <path d="M8.5 17v2M15.5 17v2"/>
      </svg>
    ),
  },
  {
    value: 'WALKING',
    label: 'Walk',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="4" r="1"/><path d="M9 20l1-5 2 3 2-8 2 2h3"/><path d="M6.5 12.5L9 10l3 1 2-2"/>
      </svg>
    ),
  },
];

function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function App() {
  // --- Location state: array of { name, coord }, 2..MAX_POINTS slots ---
  const [points, setPoints] = useState([emptyPoint(), emptyPoint()]);

  // --- Travel mode ---
  const [travelMode, setTravelMode] = useState('DRIVING');

  // --- Nearby places ---
  const [selectedType, setSelectedType] = useState(null);
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState('balanced');
  const [radius, setRadius] = useState(DEFAULT_SEARCH_RADIUS_M);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const debouncedRadius = useDebounce(radius, RADIUS_DEBOUNCE_MS);

  // --- Mobile UI state ---
  const [topOpen, setTopOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(false);

  // --- Share state ---
  const [copied, setCopied] = useState(false);

  // --- Center address (reverse geocode) ---
  const [centerAddress, setCenterAddress] = useState(null);
  const apiLoaded = useApiIsLoaded();
  const geocoderRef = useRef(null);

  // Filled coordinates, and the geometric center (centroid) of all points
  const filledCoords = useMemo(
    () => points.map((p) => p.coord).filter(Boolean),
    [points]
  );
  const center = useMemo(() => {
    if (filledCoords.length < MIN_POINTS) return null;
    return {
      lat: filledCoords.reduce((s, c) => s + c.lat, 0) / filledCoords.length,
      lng: filledCoords.reduce((s, c) => s + c.lng, 0) / filledCoords.length,
    };
  }, [filledCoords]);

  const hasCenter = !!center;

  useEffect(() => {
    if (!center || !apiLoaded) { setCenterAddress(null); return; }
    if (!geocoderRef.current) geocoderRef.current = new window.google.maps.Geocoder();
    geocoderRef.current.geocode({ location: { lat: center.lat, lng: center.lng } }, (results, status) => {
      if (status !== 'OK' || !results?.length) return;
      const r = results.find(r => r.types.some(t => ['neighborhood','sublocality','locality','administrative_area_level_2'].includes(t))) || results[0];
      const comps = r.address_components;
      const get = (...types) => comps.find(c => types.some(t => c.types.includes(t)))?.long_name;
      const area = get('neighborhood', 'sublocality_level_1', 'sublocality');
      const city = get('locality', 'administrative_area_level_2');
      setCenterAddress(area && city ? `${area}, ${city}` : city || r.formatted_address);
    });
  }, [center?.lat, center?.lng, apiLoaded]);

  // Auto-open bottom sheet when a center is found
  useEffect(() => {
    if (center) setBottomOpen(true);
  }, [center?.lat, center?.lng]);

  // Clear selected place whenever the center changes
  useEffect(() => {
    setSelectedPlace(null);
  }, [center?.lat, center?.lng]);

  // When a place is selected: collapse inputs + close places list so the map + card are visible
  useEffect(() => {
    if (selectedPlace) { setBottomOpen(false); setTopOpen(false); }
  }, [selectedPlace]);

  // Read URL params on first load (shared links): p0=lat,lng & n0=name, …
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loaded = [];
    for (let i = 0; i < MAX_POINTS; i++) {
      const p = params.get(`p${i}`);
      if (!p) continue;
      const [lat, lng] = p.split(',').map(parseFloat);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        loaded[i] = { coord: { lat, lng }, name: params.get(`n${i}`) || `${lat}, ${lng}` };
      }
    }
    if (loaded.length) {
      const next = [];
      for (let i = 0; i < Math.max(MIN_POINTS, loaded.length); i++) next.push(loaded[i] || emptyPoint());
      setPoints(next.slice(0, MAX_POINTS));
    }
  }, []);

  // Keep the URL in sync with the points, so the address bar / Share button
  // is always a link that reproduces the current setup.
  useEffect(() => {
    const params = new URLSearchParams();
    points.forEach((p, i) => {
      if (!p.coord) return;
      params.set(`p${i}`, `${p.coord.lat.toFixed(5)},${p.coord.lng.toFixed(5)}`);
      if (p.name) params.set(`n${i}`, p.name);
    });
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [points]);

  const { places: allPlaces, loading: placesLoading, error: placesError } = useNearbyPlaces(
    center, filledCoords, selectedType, travelMode
  );

  const nearbyPlaces = useMemo(() => {
    if (!center) return [];
    let results = allPlaces.filter((p) => {
      const withinRadius = haversineDistance(
        center.lat, center.lng, p.location.latitude, p.location.longitude
      ) <= debouncedRadius;
      const meetsRating = minRating === 0 || (typeof p.rating === 'number' && p.rating >= minRating);
      return withinRadius && meetsRating;
    });
    if (sortBy === 'balanced') {
      results = [...results].sort((a, b) => calcScore(b) - calcScore(a));
    } else if (sortBy === 'fairness') {
      results = [...results].sort((a, b) => (calcFairness(b.from) ?? -1) - (calcFairness(a.from) ?? -1));
    } else if (sortBy === 'rating') {
      results = [...results].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return results;
  }, [allPlaces, center, debouncedRadius, minRating, sortBy]);

  const handlePlace = useCallback((index) => ({ lat, lng }, name) => {
    setPoints((prev) => prev.map((p, i) => (i === index ? { coord: { lat, lng }, name } : p)));
  }, []);

  // Set a point from a raw map coordinate (map click / pin drag), then
  // reverse-geocode a readable name for it asynchronously.
  const setPointAt = useCallback((index, latLng) => {
    const fallback = `${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)}`;
    setPoints((prev) => {
      const next = index >= prev.length ? [...prev, emptyPoint()] : [...prev];
      next[index] = { coord: latLng, name: fallback };
      return next;
    });
    if (!window.google?.maps?.Geocoder) return;
    if (!geocoderRef.current) geocoderRef.current = new window.google.maps.Geocoder();
    geocoderRef.current.geocode({ location: latLng }, (results, status) => {
      if (status !== 'OK') return;
      const name = pickReadableName(results);
      if (!name) return;
      setPoints((prev) => prev.map((p, i) =>
        i === index && p.coord?.lat === latLng.lat && p.coord?.lng === latLng.lng
          ? { ...p, name }
          : p
      ));
    });
  }, []);

  // Map click fills the first empty slot, or adds a new point if all are filled
  const handleMapClick = useCallback((latLng) => {
    let idx = points.findIndex((p) => !p.coord);
    if (idx === -1) {
      if (points.length >= MAX_POINTS) return;
      idx = points.length;
    }
    setPointAt(idx, latLng);
  }, [points, setPointAt]);

  const handleAddPoint = useCallback(() => {
    setPoints((prev) => (prev.length >= MAX_POINTS ? prev : [...prev, emptyPoint()]));
  }, []);

  const handleRemovePoint = useCallback((index) => {
    setPoints((prev) => (prev.length <= MIN_POINTS ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  // Copies the app URL, which encodes all points — recipients see the same setup
  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }, []);

  const handleReset = () => {
    setPoints([emptyPoint(), emptyPoint()]);
    setTravelMode('DRIVING'); setSelectedType(null); setMinRating(0);
    setSortBy('balanced'); setRadius(DEFAULT_SEARCH_RADIUS_M);
    setSelectedPlace(null); setBottomOpen(false); setTopOpen(true);
  };

  const anyFilled = filledCoords.length > 0;

  // Location inputs block — shared between mobile + desktop
  const inputsBlock = (
    <>
      {points.map((p, i) => (
        <LocationInput
          key={i}
          label={`Point ${POINT_STYLES[i].label}`}
          value={p.name}
          onPlace={handlePlace(i)}
          dotColor={POINT_STYLES[i].dot}
          onRemove={points.length > MIN_POINTS ? () => handleRemovePoint(i) : undefined}
        />
      ))}
      {points.length < MAX_POINTS && (
        <button
          onClick={handleAddPoint}
          className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl border border-dashed border-slate-300 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add point
        </button>
      )}
      <div className="flex rounded-xl overflow-hidden border border-slate-200">
        {TRAVEL_MODES.map((m) => (
          <button key={m.value} onClick={() => setTravelMode(m.value)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition
              ${travelMode === m.value ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
            {m.icon}{m.label}
          </button>
        ))}
      </div>
    </>
  );

  // ─── Shared filter/places JSX (used in both mobile bottom sheet and desktop sidebar) ───

  const filterSection = hasCenter && (
    <>
      {/* Radius */}
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="radius-slider" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Search radius</label>
          <span className="text-xs font-bold text-indigo-600">{radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`}</span>
        </div>
        <input
          id="radius-slider" type="range"
          min={MIN_SEARCH_RADIUS_M} max={MAX_SEARCH_RADIUS_M} step={100} value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          aria-label="Search radius in meters"
          className="w-full h-1.5 rounded-full accent-indigo-600 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-slate-300 mt-1">
          <span>{MIN_SEARCH_RADIUS_M} m</span><span>{MAX_SEARCH_RADIUS_M / 1000} km</span>
        </div>
      </div>

      {/* Type chips */}
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="flex flex-wrap gap-1.5">
          {PLACE_TYPES.map((type) => {
            const active = selectedType === type.value;
            return (
              <button key={type.label} onClick={() => setSelectedType(type.value)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition
                  ${active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                <span>{type.emoji}</span>{type.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rating + Sort — stacked to avoid overflow on narrow screens */}
      <div className="px-5 py-3 border-b border-slate-100 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Rating</span>
          {RATING_FILTERS.map((f) => (
            <button key={f.label} onClick={() => setMinRating(f.value)}
              className={`px-2 py-0.5 rounded-full text-xs font-medium transition
                ${minRating === f.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sort</span>
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5">
            {SORT_OPTIONS.map((s) => (
              <button key={s.value} onClick={() => setSortBy(s.value)} title={s.title}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition
                  ${sortBy === s.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  const placesSection = (
    <div className="px-5 py-4">
      {hasCenter && (
        <h2 className="text-sm font-semibold text-slate-700 mb-1">
          Nearby Places
          <span className="ml-1 text-xs font-normal text-slate-400">
            (within {radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`})
          </span>
        </h2>
      )}
      <PlacesList
        places={nearbyPlaces} loading={placesLoading} error={placesError}
        selectedPlaceId={selectedPlace?.id} onSelectPlace={setSelectedPlace}
      />
      {/* Empty states */}
      {!anyFilled && (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Find a fair meeting spot</p>
            <p className="text-xs text-slate-400 mt-1">Enter two or more locations — or tap them on the map — to find places equally close to everyone</p>
          </div>
        </div>
      )}
      {anyFilled && !hasCenter && (
        <p className="text-xs text-slate-400 text-center py-6">Add at least one more location to find the center</p>
      )}
      {hasCenter && !placesLoading && nearbyPlaces.length === 0 && !placesError && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-xs text-slate-400">No places found nearby</p>
          {radius < MAX_SEARCH_RADIUS_M && (
            <button
              onClick={() => setRadius(Math.min(radius * 2, MAX_SEARCH_RADIUS_M))}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
            >
              Widen search radius
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <APIProvider apiKey={API_KEY} libraries={['places']}>
      <div className="relative h-dvh overflow-hidden bg-slate-100">

        {/* ── Single map instance — always full screen ── */}
        <div className="absolute inset-0">
          <MapView
            points={points.map((p) => p.coord)} center={center} radius={radius}
            selectedPlace={selectedPlace}
            onMapClick={handleMapClick} onPointDrag={setPointAt}
          />
        </div>

        {/* ════════════════════════════════════════
            MOBILE UI  (hidden on sm+)
        ════════════════════════════════════════ */}
        <div className="sm:hidden absolute inset-0 pointer-events-none flex flex-col">

          {/* ── Top panel — floating card, map visible around it ── */}
          <div className="flex-shrink-0 pointer-events-auto relative z-30 p-3">
            <div className="rounded-2xl bg-white shadow-lg overflow-hidden">

            {/* Header bar — always visible */}
            <div className="px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => setTopOpen((v) => !v)}
                className="flex items-center gap-2 text-left"
              >
                <span className="text-sm font-bold text-slate-800">Find the Center</span>
                <ChevronIcon open={topOpen} />
              </button>
              <div className="flex items-center gap-3">
                {hasCenter && (
                  <button onClick={handleShare} title="Copy a link to this setup" className="text-xs text-indigo-500 font-medium">
                    {copied ? 'Copied!' : 'Share'}
                  </button>
                )}
                {anyFilled && (
                  <button onClick={handleReset} className="text-xs text-slate-400 hover:text-rose-500 font-medium">
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Collapsible inputs */}
            {topOpen && (
              <div className="bg-slate-50 border-t border-slate-200 px-4 pt-2 pb-4 flex flex-col gap-3">
                {inputsBlock}
              </div>
            )}
            </div>
          </div>

          {/* Transparent flex-1 gap — shows the map below */}
          <div className="flex-1" />

          {/* ── Bottom sheet: selected place card + places panel, rounded top ── */}
          <div className="flex-shrink-0 pointer-events-auto relative z-20 rounded-t-2xl overflow-hidden shadow-[0_-6px_20px_rgba(0,0,0,0.12)]">

            {selectedPlace && (
              <SelectedPlaceCard place={selectedPlace} onDismiss={() => setSelectedPlace(null)} />
            )}

            {/* Handle bar — grab pill + summary, toggles the list */}
            <button
              onClick={() => setBottomOpen((v) => !v)}
              aria-expanded={bottomOpen}
              className={`w-full bg-white px-5 pt-2 pb-3 flex flex-col items-center gap-1.5 ${selectedPlace ? 'border-t border-slate-100' : ''}`}
            >
              <div className="w-9 h-1 rounded-full bg-slate-300" />
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {hasCenter ? (
                    <>
                      <span className="text-green-500 text-base flex-shrink-0">★</span>
                      <span className="text-sm font-semibold text-slate-700 truncate">
                        {nearbyPlaces.length > 0
                          ? `${nearbyPlaces.length} place${nearbyPlaces.length !== 1 ? 's' : ''} nearby`
                          : 'Center found'}
                      </span>
                      {centerAddress && (
                        <span className="text-xs text-slate-400 truncate hidden xs:inline">{centerAddress}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-slate-400">Enter two locations above</span>
                  )}
                </div>
                <span className="text-slate-400 flex-shrink-0"><ChevronIcon open={bottomOpen} /></span>
              </div>
            </button>

            {/* Sheet content — animated open/close */}
            <div style={{ maxHeight: bottomOpen ? '55vh' : 0, transition: 'max-height 0.3s ease-in-out', overflow: 'hidden' }}>
              <div data-scroll-preserve className="bg-white overflow-y-auto overflow-x-hidden max-h-[55vh] shadow-lg">
                {filterSection}
                {placesSection}
                {hasCenter && (
                  <div className="px-5 py-2.5 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
                    <span className="text-green-400">★</span>
                    <span>{centerAddress || `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`}</span>
                    <span className="ml-auto">{filledCoords.length} points</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>{/* end mobile UI */}

        {/* ════════════════════════════════════════
            DESKTOP UI  (hidden on mobile)
        ════════════════════════════════════════ */}
        <aside data-scroll-preserve className="hidden sm:flex flex-col absolute top-0 left-0 bottom-0 z-10 w-80 md:w-96 bg-white shadow-xl overflow-y-auto overflow-x-hidden">

          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-slate-800 tracking-tight">Find the Center</h1>
                <p className="text-xs text-slate-400 mt-0.5">Find a fair meeting spot between multiple locations</p>
              </div>
              <div className="flex items-center gap-2">
                {hasCenter && (
                  <button onClick={handleShare} title="Copy a link to this setup" className="text-xs text-indigo-500 hover:text-indigo-700 transition font-medium">
                    {copied ? 'Copied!' : 'Share link'}
                  </button>
                )}
                {anyFilled && (
                  <button onClick={handleReset} aria-label="Reset all points and filters"
                    className="text-xs text-slate-400 hover:text-rose-500 transition font-medium">
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Inputs */}
          <div className="px-5 py-4 flex flex-col gap-4 bg-slate-50 flex-shrink-0 relative z-10 shadow-[0_4px_10px_rgba(0,0,0,0.08)]">
            {inputsBlock}
          </div>

          {/* Selected place detail card */}
          {selectedPlace && (
            <div className="flex-shrink-0 border-b border-slate-100">
              <SelectedPlaceCard place={selectedPlace} onDismiss={() => setSelectedPlace(null)} />
            </div>
          )}

          {/* Filters */}
          {filterSection}

          {/* Places */}
          <div className="flex-1">{placesSection}</div>

          {/* Compact center info — bottom, low-priority */}
          {hasCenter && (
            <div className="px-5 py-2.5 border-t border-slate-100 flex-shrink-0 flex items-center gap-2 text-xs text-slate-400">
              <span className="text-green-400">★</span>
              <span className="truncate">{centerAddress || `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`}</span>
              <span className="ml-auto flex-shrink-0">{filledCoords.length} points</span>
            </div>
          )}

        </aside>

      </div>
    </APIProvider>
  );
}
