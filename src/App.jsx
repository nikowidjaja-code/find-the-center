import { useState, useMemo, useCallback } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import LocationInput from './components/LocationInput.jsx';
import MapView from './components/MapView.jsx';
import PlacesList from './components/PlacesList.jsx';
import { useDirections } from './hooks/useDirections.js';
import { useDebounce } from './hooks/useDebounce.js';
import { useNearbyPlaces } from './hooks/useNearbyPlaces.js';

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
  { label: 'All',         value: null,              emoji: '🗺️' },
  { label: 'Restaurant',  value: 'restaurant',       emoji: '🍽️' },
  { label: 'Cafe',        value: 'cafe',             emoji: '☕' },
  { label: 'Bar',         value: 'bar',              emoji: '🍺' },
  { label: 'Mall',        value: 'shopping_mall',    emoji: '🛍️' },
  { label: 'Hotel',       value: 'hotel',            emoji: '🏨' },
  { label: 'Park',        value: 'park',             emoji: '🌳' },
  { label: 'Museum',      value: 'museum',           emoji: '🏛️' },
  { label: 'Cinema',      value: 'movie_theater',    emoji: '🎬' },
  { label: 'Gym',         value: 'gym',              emoji: '💪' },
  { label: 'Spa',         value: 'spa',              emoji: '💆' },
  { label: 'Supermarket', value: 'supermarket',      emoji: '🛒' },
  { label: 'Attraction',  value: 'tourist_attraction', emoji: '📍' },
];


export default function App() {
  // --- Location state ---
  const [pointA, setPointA] = useState(null);
  const [pointB, setPointB] = useState(null);
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');

  // Which input is "active" (determines what a map click sets)
  const [activeInput, setActiveInput] = useState('A');

  // --- Directions + midpoint ---
  const { directionsResult, midpoint, loading: dirLoading, error: dirError } = useDirections(
    pointA,
    pointB
  );

  // --- Nearby places ---
  const [selectedType, setSelectedType] = useState(null);
  const [radius, setRadius] = useState(500);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const debouncedRadius = useDebounce(radius, 400);

  const { places: allPlaces, loading: placesLoading, error: placesError } = useNearbyPlaces(
    midpoint, pointA, pointB, selectedType
  );

  // Filter client-side by radius — no extra API call needed when slider moves
  const nearbyPlaces = useMemo(() => {
    if (!midpoint) return [];
    return allPlaces.filter((p) =>
      haversineDistance(midpoint.lat, midpoint.lng, p.location.latitude, p.location.longitude) <= debouncedRadius
    );
  }, [allPlaces, midpoint, debouncedRadius]);

  // --- Reverse geocode a clicked lat/lng to get a display name ---
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

  // --- Map click handler ---
  const handleMapClick = useCallback(
    async ({ lat, lng }) => {
      const name = await reverseGeocode(lat, lng);
      if (activeInput === 'A') {
        setPointA({ lat, lng });
        setNameA(name);
        setActiveInput('B');
      } else if (activeInput === 'B') {
        setPointB({ lat, lng });
        setNameB(name);
        setActiveInput(null);
      }
    },
    [activeInput, reverseGeocode]
  );

  // --- LocationInput place callbacks ---
  const handlePlaceA = useCallback(({ lat, lng }, name) => {
    setPointA({ lat, lng });
    setNameA(name);
    if (!pointB) setActiveInput('B');
    else setActiveInput(null);
  }, [pointB]);

  const handlePlaceB = useCallback(({ lat, lng }, name) => {
    setPointB({ lat, lng });
    setNameB(name);
    setActiveInput(null);
  }, []);

  // --- Reset ---
  const handleReset = () => {
    setPointA(null);
    setPointB(null);
    setNameA('');
    setNameB('');
    setActiveInput('A');
    setNearbyPlaces([]);
    setPlacesError(null);
    setSelectedType(null);
    setRadius(500);
    setSelectedPlace(null);
  };

  // --- Derived state ---
  const hasMidpoint = !!midpoint;
  const totalTime = directionsResult?.routes?.[0]?.legs?.[0]?.duration?.text;
  const totalDist = directionsResult?.routes?.[0]?.legs?.[0]?.distance?.text;

  return (
    <APIProvider apiKey={API_KEY} libraries={['places']}>
      <div className="flex flex-col md:flex-row h-screen bg-slate-50 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="w-full md:w-96 flex-shrink-0 flex flex-col bg-white shadow-lg z-10 overflow-y-auto">

          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-slate-800 tracking-tight">
                  Find the Center
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Time-equidistant meeting point finder
                </p>
              </div>
              {(pointA || pointB) && (
                <button
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-rose-500 transition font-medium"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Inputs */}
          <div className="px-5 py-4 flex flex-col gap-4 border-b border-slate-100">
            <LocationInput
              label="Point A"
              value={nameA}
              onPlace={handlePlaceA}
              isActive={activeInput === 'A'}
              onFocus={() => setActiveInput('A')}
            />
            <LocationInput
              label="Point B"
              value={nameB}
              onPlace={handlePlaceB}
              isActive={activeInput === 'B'}
              onFocus={() => setActiveInput('B')}
            />

            {/* Map click hint */}
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

          {/* Directions summary */}
          {dirLoading && (
            <div className="px-5 py-4 flex items-center gap-2 border-b border-slate-100">
              <svg className="animate-spin w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              <p className="text-sm text-slate-500">Finding the best route...</p>
            </div>
          )}

          {dirError && (
            <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600">
              {dirError}
            </div>
          )}

          {hasMidpoint && !dirLoading && (
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-green-500 text-lg">★</span>
                  <span className="text-sm font-semibold text-green-800">Midpoint found!</span>
                </div>
                <p className="text-xs text-green-700">
                  {midpoint.lat.toFixed(5)}, {midpoint.lng.toFixed(5)}
                </p>
                {(totalTime || totalDist) && (
                  <p className="text-xs text-slate-500">
                    Total route: {totalDist} · {totalTime}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Radius slider */}
          {hasMidpoint && (
            <div className="px-5 py-3 border-b border-slate-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Search radius</span>
                <span className="text-xs font-bold text-indigo-600">{radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`}</span>
              </div>
              <input
                type="range"
                min={100}
                max={2000}
                step={100}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full h-1.5 rounded-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-300 mt-1">
                <span>100 m</span>
                <span>2 km</span>
              </div>
            </div>
          )}

          {/* Type filter chips */}
          {hasMidpoint && (
            <div className="px-5 py-3 border-b border-slate-100">
              <div className="flex flex-wrap gap-1.5">
                {PLACE_TYPES.map((type) => {
                  const active = selectedType === type.value;
                  return (
                    <button
                      key={type.label}
                      onClick={() => setSelectedType(type.value)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition
                        ${active
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      <span>{type.emoji}</span>
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nearby places */}
          <div className="px-5 py-4 flex-1">
            {hasMidpoint && (
              <h2 className="text-sm font-semibold text-slate-700 mb-1">
                Nearby Places
                <span className="ml-1 text-xs font-normal text-slate-400">(within {radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`})</span>
              </h2>
            )}
            <PlacesList
              places={nearbyPlaces}
              loading={placesLoading}
              error={placesError}
              selectedPlaceId={selectedPlace?.id}
              onSelectPlace={setSelectedPlace}
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
                  <p className="text-xs text-slate-400 mt-1">
                    Search for a location, use GPS, or click the map
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── Map ── */}
        <main className="flex-1 min-h-64 md:min-h-0 relative">
          <div className="absolute inset-0">
            <MapView
              pointA={pointA}
              pointB={pointB}
              midpoint={midpoint}
              radius={radius}
              directionsResult={directionsResult}
              activeInput={activeInput}
              onMapClick={handleMapClick}
              selectedPlace={selectedPlace}
            />
          </div>
        </main>
      </div>
    </APIProvider>
  );
}
