import { useEffect, useRef, useState } from 'react';
import { useApiIsLoaded } from '@vis.gl/react-google-maps';
import { useGeolocation } from '../hooks/useGeolocation.js';

export default function LocationInput({ label, value, onPlace, dotColor = 'bg-indigo-500', onRemove }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [inputValue, setInputValue] = useState(value || '');
  const { requestLocation, loading: locLoading, error: locError } = useGeolocation();
  const apiLoaded = useApiIsLoaded();

  // Keep local state in sync with external value prop
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Set up autocomplete once the Maps JS API is ready — no polling needed
  useEffect(() => {
    if (!apiLoaded || autocompleteRef.current) return;

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
  }, [apiLoaded, onPlace]);

  const handleUseLocation = () => {
    requestLocation((latLng, name) => {
      setInputValue(name);
      onPlace(latLng, name);
    });
  };

  // Enter with no highlighted suggestion: the Autocomplete widget silently does
  // nothing, so geocode the typed text and take the top match instead.
  const handleKeyDown = (e) => {
    if (e.key !== 'Enter' || !window.google?.maps?.Geocoder) return;
    const highlighted = [...document.querySelectorAll('.pac-container')].some(
      (c) => c.offsetParent !== null && c.querySelector('.pac-item-selected')
    );
    if (highlighted) return; // let the widget commit the selection
    const text = inputRef.current?.value.trim();
    if (!text) return;
    e.preventDefault();
    new window.google.maps.Geocoder().geocode({ address: text }, (results, status) => {
      if (status !== 'OK' || !results?.[0]?.geometry?.location) return;
      const loc = results[0].geometry.location;
      const name = results[0].formatted_address;
      setInputValue(name);
      onPlace({ lat: loc.lat(), lng: loc.lng() }, name);
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor} flex-shrink-0`} />
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {label}
        </label>
        {onRemove && (
          <button
            onClick={onRemove}
            aria-label={`Remove ${label}`}
            className="ml-auto text-slate-300 hover:text-rose-500 transition p-1.5 -my-1.5 -mr-1"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setInputValue(value || '')}
          placeholder={`Search for ${label}...`}
          className="flex-1 px-3 py-2 text-sm rounded-lg border bg-white text-slate-800 placeholder-slate-400 outline-none transition border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        <button
          onClick={handleUseLocation}
          disabled={locLoading}
          title="Use my current location"
          aria-label="Use my current location"
          className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {locLoading ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
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
