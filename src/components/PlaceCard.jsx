/**
 * PlaceCard — displays a single nearby place result.
 *
 * Props:
 *   place — a place object from the Places API (New) response
 */
function TravelBadge({ label, color, element }) {
  if (!element || element.status !== 'OK') return null;
  return (
    <div className="flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
      <span className="text-xs text-slate-500 font-medium">{label}:</span>
      <span className="text-xs text-slate-700">{element.duration.text}</span>
      <span className="text-xs text-slate-400">· {element.distance.text}</span>
    </div>
  );
}

export default function PlaceCard({ place, isSelected, onSelect }) {
  const name = place.displayName?.text || 'Unknown place';
  const address = place.formattedAddress || '';
  const rating = place.rating;
  const ratingCount = place.userRatingCount;
  const types = place.types || [];
  const mapsUri = place.googleMapsUri || '';

  // Format type labels: replace underscores, title-case
  const formatType = (t) =>
    t
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  // Show at most 3 type tags, skip overly generic ones
  const skipTypes = new Set(['point_of_interest', 'establishment', 'premise']);
  const displayTypes = types
    .filter((t) => !skipTypes.has(t))
    .slice(0, 3);

  const renderStars = (r) => {
    const full = Math.floor(r);
    const half = r - full >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    return (
      <span className="inline-flex items-center gap-0.5 text-amber-400" role="img" aria-label={`${r.toFixed(1)} out of 5 stars`}>
        {Array(full).fill(0).map((_, i) => (
          <svg key={`f${i}`} className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.174c.969 0 1.371 1.24.588 1.81l-3.378 2.454a1 1 0 00-.364 1.118l1.286 3.967c.3.921-.755 1.688-1.54 1.118L10 15.347l-3.953 2.874c-.784.57-1.838-.197-1.539-1.118l1.286-3.967a1 1 0 00-.364-1.118L2.052 9.394c-.783-.57-.38-1.81.588-1.81h4.174a1 1 0 00.95-.69L9.05 2.927z" />
          </svg>
        ))}
        {half && (
          <svg key="h" className="w-3.5 h-3.5" viewBox="0 0 20 20">
            <defs>
              <linearGradient id="half">
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#d1d5db" />
              </linearGradient>
            </defs>
            <path fill="url(#half)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.174c.969 0 1.371 1.24.588 1.81l-3.378 2.454a1 1 0 00-.364 1.118l1.286 3.967c.3.921-.755 1.688-1.54 1.118L10 15.347l-3.953 2.874c-.784.57-1.838-.197-1.539-1.118l1.286-3.967a1 1 0 00-.364-1.118L2.052 9.394c-.783-.57-.38-1.81.588-1.81h4.174a1 1 0 00.95-.69L9.05 2.927z" />
          </svg>
        )}
        {Array(empty).fill(0).map((_, i) => (
          <svg key={`e${i}`} className="w-3.5 h-3.5 text-slate-300 fill-current" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.174c.969 0 1.371 1.24.588 1.81l-3.378 2.454a1 1 0 00-.364 1.118l1.286 3.967c.3.921-.755 1.688-1.54 1.118L10 15.347l-3.953 2.874c-.784.57-1.838-.197-1.539-1.118l1.286-3.967a1 1 0 00-.364-1.118L2.052 9.394c-.783-.57-.38-1.81.588-1.81h4.174a1 1 0 00.95-.69L9.05 2.927z" />
          </svg>
        ))}
      </span>
    );
  };

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl p-3 shadow-sm transition flex flex-col gap-1.5 cursor-pointer
        ${isSelected
          ? 'bg-indigo-50 border-2 border-indigo-400 shadow-indigo-100'
          : 'bg-white border border-slate-100 hover:shadow-md hover:border-indigo-100'
        }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800 leading-snug">{name}</h3>
        {mapsUri && (
          <a
            href={mapsUri}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap"
          >
            Open in Maps ↗
          </a>
        )}
      </div>

      {address && (
        <p className="text-xs text-slate-500 leading-snug">{address}</p>
      )}

      {typeof rating === 'number' && (
        <div className="flex items-center gap-1.5">
          {renderStars(rating)}
          <span className="text-xs text-slate-600 font-medium">{rating.toFixed(1)}</span>
          {typeof ratingCount === 'number' && (
            <span className="text-xs text-slate-400">({ratingCount.toLocaleString()})</span>
          )}
        </div>
      )}

      {displayTypes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {displayTypes.map((t) => (
            <span
              key={t}
              className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full"
            >
              {formatType(t)}
            </span>
          ))}
        </div>
      )}

      {(place.fromA || place.fromB) && (
        <div className="flex flex-col gap-0.5 pt-1.5 mt-0.5 border-t border-slate-100">
          <TravelBadge label="From A" color="bg-indigo-500" element={place.fromA} />
          <TravelBadge label="From B" color="bg-rose-500"   element={place.fromB} />
        </div>
      )}
    </div>
  );
}
