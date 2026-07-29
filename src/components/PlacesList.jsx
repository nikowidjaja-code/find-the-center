import { useRef, useLayoutEffect, useCallback } from 'react';
import PlaceCard from './PlaceCard.jsx';

export default function PlacesList({ places, loading, error, selectedPlaceId, onSelectPlace }) {
  const listRef = useRef(null);
  const savedScrollRef = useRef(0);

  // Save scroll at click time, then restore after React commits the DOM
  const handleSelect = useCallback((place) => {
    const container = listRef.current?.closest('[data-scroll-preserve]');
    if (container) savedScrollRef.current = container.scrollTop;
    onSelectPlace(place);
  }, [onSelectPlace]);

  useLayoutEffect(() => {
    const container = listRef.current?.closest('[data-scroll-preserve]');
    if (container) container.scrollTop = savedScrollRef.current;
  }, [selectedPlaceId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2 mt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-xl bg-slate-100 h-20" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600">
        {error}
      </div>
    );
  }

  if (!places || places.length === 0) {
    return null;
  }

  return (
    <div ref={listRef} className="flex flex-col gap-2 mt-2">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
        {places.length} place{places.length !== 1 ? 's' : ''} near the center
      </p>
      {places.map((place) => (
        <PlaceCard
          key={place.id}
          place={place}
          isSelected={place.id === selectedPlaceId}
          onSelect={() => handleSelect(place)}
        />
      ))}
    </div>
  );
}
