import { useEffect, useRef, useState } from 'react';
import { useGeolocation } from '../hooks/useGeolocation.js';

/**
 * LocationInput — text input with Google Places Autocomplete and
 * a "use my location" GPS button.
 *
 * Props:
 *   label      — "Point A" or "Point B"
 *   value      — current display string
 *   onPlace(latLng: {lat, lng}, name: string) — called when a location is chosen
 *   isActive   — whether this input is the active click target on the map
 *   onFocus    — called when this input is focused (to set activeInput)
 */
export default function LocationInput({ label, value, onPlace, isActive, onFocus }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [inputValue, setInputValue] = useState(value || '');
  const { requestLocation, loading: locLoading, error: locError } = useGeolocation();

  // Keep local state in sync with external value prop
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Set up autocomplete once the Google Maps library is available
  useEffect(() => {
    const tryInit = () => {
      if (!window.google?.maps?.places?.Autocomplete) return false;
      if (autocompleteRef.current) return true; // already initialised

      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ['geometry', 'name', 'formatted_address'],
      });

      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place.geometry?.location) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const name = place.name || place.formatted_address || '';
        setInputValue(name);
        onPlace({ lat, lng }, name);
      });

      autocompleteRef.current = ac;
      return true;
    };

    if (!tryInit()) {
      const interval = setInterval(() => {
        if (tryInit()) clearInterval(interval);
      }, 300);
      return () => clearInterval(interval);
    }
  }, [onPlace]);

  const handleUseLocation = () => {
    requestLocation((latLng, name) => {
      setInputValue(name);
      onPlace(latLng, name);
    });
  };

  const colorAccent = label === 'Point A' ? 'indigo' : 'rose';
  const dotColor = label === 'Point A' ? 'bg-indigo-500' : 'bg-rose-500';

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor} flex-shrink-0`} />
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {label}
        </label>
        {isActive && (
          <span className="ml-auto text-xs text-indigo-500 font-medium">
            Click map to set
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={onFocus}
          placeholder={`Search for ${label}...`}
          className={`flex-1 px-3 py-2 text-sm rounded-lg border bg-white text-slate-800 placeholder-slate-400 outline-none transition
            ${isActive
              ? 'border-indigo-400 ring-2 ring-indigo-100'
              : 'border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
            }`}
        />
        <button
          onClick={handleUseLocation}
          disabled={locLoading}
          title="Use my current location"
          className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition text-slate-500 hover:text-indigo-600 disabled:opacity-50"
        >
          {locLoading ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          )}
        </button>
      </div>

      {locError && (
        <p className="text-xs text-rose-500">{locError}</p>
      )}
    </div>
  );
}
