import PlaceCard from './PlaceCard.jsx';

/**
 * PlacesList — renders a scrollable list of PlaceCard items.
 *
 * Props:
 *   places  — array of place objects from the Places API
 *   loading — boolean
 *   error   — string or null
 */
export default function PlacesList({ places, loading, error, selectedPlaceId, onSelectPlace }) {
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
    <div className="flex flex-col gap-2 mt-2">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
        {places.length} place{places.length !== 1 ? 's' : ''} near the midpoint
      </p>
      {places.map((place, idx) => (
        <PlaceCard
          key={place.id || idx}
          place={place}
          isSelected={place.id === selectedPlaceId}
          onSelect={() => onSelectPlace(place)}
        />
      ))}
    </div>
  );
}
