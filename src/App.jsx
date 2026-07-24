import { useState, useMemo, useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import LocationInput from './components/LocationInput.jsx';
import MapView from './components/MapView.jsx';
import PlacesList from './components/PlacesList.jsx';
import { useDirections } from './hooks/useDirections.js';
import { useDebounce } from './hooks/useDebounce.js';
import { useNearbyPlaces } from './hooks/useNearbyPlaces.js';
import { calcFairness } from './utils/fairness.js';
import {
  DEFAULT_SEARCH_RADIUS_M,
  MIN_SEARCH_RADIUS_M,
  MAX_SEARCH_RADIUS_M,
  RADIUS_DEBOUNCE_MS,
} from './constants.js';

const GEOCODE_TIMEOUT_MS = 5000;

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

const PLACE_TYPES = [
  { label: 'All',         value: null,                emoji: '🗺️' },
  { label: 'Restaurant',  value: 'restaurant',        emoji: '🍽️' },
  { label: 'Cafe',        value: 'cafe',              emoji: '☕' },
  { label: 'Bar',         value: 'bar',               emoji: '🍺' },
  { label: 'Mall',        value: 'shopping_mall',     emoji: '🛍️' },
  { label: 'Hotel',       value: 'hotel',             emoji: '🏨' },
  { label: 'Park',        value: 'park',              emoji: '🌳' },
  { label: 'Museum',      value: 'museum',            emoji: '🏛️' },
  { label: 'Cinema',      value: 'movie_theater',     emoji: '🎬' },
  { label: 'Gym',         value: 'gym',               emoji: '💪' },
  { label: 'Spa',         value: 'spa',               emoji: '💆' },
  { label: 'Supermarket', value: 'supermarket',       emoji: '🛒' },
  { label: 'Attraction',  value: 'tourist_attraction', emoji: '📍' },
];

const RATING_FILTERS = [
  { label: 'Any',  value: 0   },
  { label: '3.5+', value: 3.5 },
  { label: '4.0+', value: 4.0 },
  { label: '4.5+', value: 4.5 },
];

const SORT_OPTIONS = [
  { label: 'Popular', value: 'popularity' },
  { label: 'Fairest', value: 'fairness'   },
  { label: 'Rating',  value: 'rating'     },
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
  // --- Location state ---
  const [pointA, setPointA] = useState(null);
  const [pointB, setPointB] = useState(null);
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [activeInput, setActiveInput] = useState('A');

  // --- Directions + midpoint ---
  const { directionsResult, midpoint, loading: dirLoading, error: dirError } = useDirections(pointA, pointB);

  // --- Nearby places ---
  const [selectedType, setSelectedType] = useState(null);
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState('popularity');
  const [radius, setRadius] = useState(DEFAULT_SEARCH_RADIUS_M);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const debouncedRadius = useDebounce(radius, RADIUS_DEBOUNCE_MS);

  // --- Mobile UI state ---
  const [topOpen, setTopOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(false);

  // --- Share state ---
  const [copied, setCopied] = useState(false);

  // Auto-open bottom sheet when midpoint is found
  useEffect(() => {
    if (midpoint) setBottomOpen(true);
  }, [midpoint?.lat, midpoint?.lng]);

  // Clear selected place whenever midpoint changes
  useEffect(() => {
    setSelectedPlace(null);
  }, [midpoint?.lat, midpoint?.lng]);

  // Read URL params on first load (shared links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const alat = params.get('alat'), alng = params.get('alng'), an = params.get('an');
    const blat = params.get('blat'), blng = params.get('blng'), bn = params.get('bn');
    if (alat && alng) {
      setPointA({ lat: parseFloat(alat), lng: parseFloat(alng) });
      setNameA(an || `${alat}, ${alng}`);
      setActiveInput('B');
    }
    if (blat && blng) {
      setPointB({ lat: parseFloat(blat), lng: parseFloat(blng) });
      setNameB(bn || `${blat}, ${blng}`);
      setActiveInput(null);
    }
  }, []);

  const { places: allPlaces, loading: placesLoading, error: placesError } = useNearbyPlaces(
    midpoint, pointA, pointB, selectedType
  );

  const nearbyPlaces = useMemo(() => {
    if (!midpoint) return [];
    let results = allPlaces.filter((p) => {
      const withinRadius = haversineDistance(
        midpoint.lat, midpoint.lng, p.location.latitude, p.location.longitude
      ) <= debouncedRadius;
      const meetsRating = minRating === 0 || (typeof p.rating === 'number' && p.rating >= minRating);
      return withinRadius && meetsRating;
    });
    if (sortBy === 'fairness') {
      results = [...results].sort((a, b) => (calcFairness(b.fromA, b.fromB) ?? -1) - (calcFairness(a.fromA, a.fromB) ?? -1));
    } else if (sortBy === 'rating') {
      results = [...results].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return results;
  }, [allPlaces, midpoint, debouncedRadius, minRating, sortBy]);

  // --- Reverse geocode ---
  const reverseGeocode = useCallback(async (lat, lng) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEY}`,
        { signal: controller.signal }
      );
      const data = await res.json();
      return data.results?.[0]?.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  const handleMapClick = useCallback(async ({ lat, lng }) => {
    const name = await reverseGeocode(lat, lng);
    if (activeInput === 'A') { setPointA({ lat, lng }); setNameA(name); setActiveInput('B'); }
    else if (activeInput === 'B') { setPointB({ lat, lng }); setNameB(name); setActiveInput(null); }
  }, [activeInput, reverseGeocode]);

  const handlePlaceA = useCallback(({ lat, lng }, name) => {
    setPointA({ lat, lng }); setNameA(name);
    if (!pointB) setActiveInput('B'); else setActiveInput(null);
  }, [pointB]);

  const handlePlaceB = useCallback(({ lat, lng }, name) => {
    setPointB({ lat, lng }); setNameB(name); setActiveInput(null);
  }, []);

  const handleShare = useCallback(() => {
    const params = new URLSearchParams({
      alat: pointA.lat.toFixed(6), alng: pointA.lng.toFixed(6), an: nameA,
      blat: pointB.lat.toFixed(6), blng: pointB.lng.toFixed(6), bn: nameB,
    });
    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?${params}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }, [pointA, nameA, pointB, nameB]);

  const handleReset = () => {
    setPointA(null); setPointB(null); setNameA(''); setNameB('');
    setActiveInput('A'); setSelectedType(null); setMinRating(0);
    setSortBy('popularity'); setRadius(DEFAULT_SEARCH_RADIUS_M);
    setSelectedPlace(null); setBottomOpen(false); setTopOpen(true);
    window.history.replaceState(null, '', window.location.pathname);
  };

  // Preserve scroll position when selecting a place so the list doesn't jump to top
  const handleSelectPlace = useCallback((place) => {
    const container = document.querySelector('[data-scroll-preserve]');
    const saved = container?.scrollTop ?? 0;
    flushSync(() => setSelectedPlace(place));
    if (container) container.scrollTop = saved;
  }, []);

  const hasMidpoint = !!midpoint;
  const totalTime = directionsResult?.routes?.[0]?.legs?.[0]?.duration?.text;
  const totalDist = directionsResult?.routes?.[0]?.legs?.[0]?.distance?.text;

  // ─── Shared filter/places JSX (used in both mobile bottom sheet and desktop sidebar) ───

  const filterSection = hasMidpoint && (
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
        <div className="flex justify-between text-xs text-slate-300 mt-1"><span>100 m</span><span>2 km</span></div>
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
                ${minRating === f.value ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sort</span>
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5">
            {SORT_OPTIONS.map((s) => (
              <button key={s.value} onClick={() => setSortBy(s.value)}
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
      {hasMidpoint && (
        <h2 className="text-sm font-semibold text-slate-700 mb-1">
          Nearby Places
          <span className="ml-1 text-xs font-normal text-slate-400">
            (within {radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`})
          </span>
        </h2>
      )}
      <PlacesList
        places={nearbyPlaces} loading={placesLoading} error={placesError}
        selectedPlaceId={selectedPlace?.id} onSelectPlace={handleSelectPlace}
      />
      {!pointA && !pointB && (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">Set two points to get started</p>
            <p className="text-xs text-slate-400 mt-1">Search for a location, use GPS, or click the map</p>
          </div>
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
            pointA={pointA} pointB={pointB} midpoint={midpoint} radius={radius}
            directionsResult={directionsResult} activeInput={activeInput}
            onMapClick={handleMapClick} selectedPlace={selectedPlace}
          />
        </div>

        {/* ════════════════════════════════════════
            MOBILE UI  (hidden on sm+)
        ════════════════════════════════════════ */}
        <div className="sm:hidden absolute inset-0 pointer-events-none">

          {/* ── Top panel ── */}
          <div className="absolute top-0 left-0 right-0 z-20 pointer-events-auto">

            {/* Header bar — always visible */}
            <div className="bg-white/95 backdrop-blur-sm shadow-sm px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => setTopOpen((v) => !v)}
                className="flex items-center gap-2 text-left"
              >
                <span className="text-sm font-bold text-slate-800">Find the Center</span>
                <ChevronIcon open={topOpen} />
              </button>
              <div className="flex items-center gap-3">
                {pointA && pointB && (
                  <button onClick={handleShare} className="text-xs text-indigo-500 font-medium">
                    {copied ? 'Copied!' : 'Share ↗'}
                  </button>
                )}
                {(pointA || pointB) && (
                  <button onClick={handleReset} className="text-xs text-slate-400 hover:text-rose-500 font-medium">
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Collapsible inputs */}
            {topOpen && (
              <div className="bg-slate-50/97 backdrop-blur-sm px-4 pt-1 pb-4 flex flex-col gap-3 border-t border-slate-200 shadow-[0_6px_12px_rgba(0,0,0,0.1)]">
                <LocationInput
                  label="Point A" value={nameA} onPlace={handlePlaceA}
                  isActive={activeInput === 'A'} onFocus={() => setActiveInput('A')}
                />
                <LocationInput
                  label="Point B" value={nameB} onPlace={handlePlaceB}
                  isActive={activeInput === 'B'} onFocus={() => setActiveInput('B')}
                />
                {activeInput && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
                    <svg className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 15l6 6m-6-6a6 6 0 10-12 0 6 6 0 0012 0z" />
                    </svg>
                    <p className="text-xs text-indigo-600">
                      Tap the map to set <strong>Point {activeInput}</strong>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Loading + error banners */}
            {dirLoading && (
              <div className="bg-white/90 backdrop-blur-sm mx-3 mt-2 px-3 py-2 rounded-xl shadow flex items-center gap-2">
                <svg className="animate-spin w-3.5 h-3.5 text-indigo-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                <p className="text-xs text-slate-500">Finding route…</p>
              </div>
            )}
            {dirError && (
              <div className="bg-rose-50/95 backdrop-blur-sm mx-3 mt-2 px-3 py-2 rounded-xl border border-rose-100 text-xs text-rose-600 shadow">
                {dirError}
              </div>
            )}
          </div>

          {/* ── Bottom sheet ── */}
          <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-auto">

            {/* Sheet content — scrollable */}
            {bottomOpen && (
              <div data-scroll-preserve className="bg-white overflow-y-auto overflow-x-hidden max-h-[65vh] shadow-lg">
                {filterSection}
                {placesSection}
                {/* Compact midpoint info — bottom, low-priority */}
                {hasMidpoint && !dirLoading && (
                  <div className="px-5 py-2.5 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
                    <span className="text-green-400">★</span>
                    <span>{midpoint.lat.toFixed(4)}, {midpoint.lng.toFixed(4)}</span>
                    {(totalTime || totalDist) && (
                      <span className="ml-auto">{totalDist} · {totalTime}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Handle bar — always visible, toggles sheet */}
            <button
              onClick={() => setBottomOpen((v) => !v)}
              className="w-full bg-white border-t border-slate-100 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] px-5 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                {hasMidpoint ? (
                  <>
                    <span className="text-green-500 text-base">★</span>
                    <span className="text-sm font-semibold text-slate-700">
                      {nearbyPlaces.length > 0
                        ? `${nearbyPlaces.length} place${nearbyPlaces.length !== 1 ? 's' : ''} nearby`
                        : 'Midpoint found'}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-slate-400">Set two points to get started</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="text-xs">{bottomOpen ? 'Close' : 'Show'}</span>
                <ChevronIcon open={bottomOpen} />
              </div>
            </button>
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
                <p className="text-xs text-slate-400 mt-0.5">Time-equidistant meeting point finder</p>
              </div>
              <div className="flex items-center gap-2">
                {pointA && pointB && (
                  <button onClick={handleShare} className="text-xs text-indigo-500 hover:text-indigo-700 transition font-medium">
                    {copied ? 'Copied!' : 'Share ↗'}
                  </button>
                )}
                {(pointA || pointB) && (
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
            <LocationInput label="Point A" value={nameA} onPlace={handlePlaceA} isActive={activeInput === 'A'} onFocus={() => setActiveInput('A')} />
            <LocationInput label="Point B" value={nameB} onPlace={handlePlaceB} isActive={activeInput === 'B'} onFocus={() => setActiveInput('B')} />
            {activeInput && (
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
                <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 15l6 6m-6-6a6 6 0 10-12 0 6 6 0 0012 0z" />
                </svg>
                <p className="text-xs text-indigo-600">
                  Click on the map to set <strong>Point {activeInput}</strong>, or search above
                </p>
              </div>
            )}
          </div>

          {/* Loading / error */}
          {dirLoading && (
            <div className="px-5 py-4 flex items-center gap-2 border-b border-slate-100 flex-shrink-0">
              <svg className="animate-spin w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              <p className="text-sm text-slate-500">Finding the best route…</p>
            </div>
          )}
          {dirError && (
            <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 flex-shrink-0">
              {dirError}
            </div>
          )}

          {/* Filters */}
          {filterSection}

          {/* Places */}
          <div className="flex-1">{placesSection}</div>

          {/* Compact midpoint info — bottom, low-priority */}
          {hasMidpoint && !dirLoading && (
            <div className="px-5 py-2.5 border-t border-slate-100 flex-shrink-0 flex items-center gap-2 text-xs text-slate-400">
              <span className="text-green-400">★</span>
              <span>{midpoint.lat.toFixed(4)}, {midpoint.lng.toFixed(4)}</span>
              {(totalTime || totalDist) && (
                <span className="ml-auto">{totalDist} · {totalTime}</span>
              )}
            </div>
          )}

        </aside>

      </div>
    </APIProvider>
  );
}
