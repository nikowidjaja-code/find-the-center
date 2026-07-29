import { calcFairness } from '../utils/fairness.js';
import { POINT_STYLES } from '../constants.js';

export default function SelectedPlaceCard({ place, onDismiss }) {
  const name = place.displayName?.text || 'Unknown place';
  const address = place.formattedAddress || '';
  const rating = place.rating;
  const ratingCount = place.userRatingCount;
  const mapsUri = place.googleMapsUri || '';

  const from = place.from ?? [];
  const legs = from.map((e, i) => ({
    label: POINT_STYLES[i].label,
    dot: POINT_STYLES[i].dot,
    time: e?.status === 'OK' ? e.duration.text : null,
    dist: e?.status === 'OK' ? e.distance.text : null,
  })).filter((l) => l.time);

  const fairness = calcFairness(from);
  const fairnessColor =
    fairness === null ? '' :
    fairness >= 80 ? 'text-green-600' :
    fairness >= 60 ? 'text-amber-500' : 'text-rose-500';

  const stars = typeof rating === 'number'
    ? Math.round(rating * 2) / 2
    : null;

  return (
    <div className="px-4 pt-3 pb-4 bg-white border-t border-slate-100 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
      {/* Name + dismiss */}
      <div className="flex items-start gap-2 mb-1">
        <h3 className="flex-1 text-sm font-bold text-slate-800 leading-snug">{name}</h3>
        <button
          onClick={onDismiss}
          aria-label="Deselect place"
          className="flex-shrink-0 p-1 -mr-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {address && (
        <p className="text-xs text-slate-500 mb-2 leading-snug">{address}</p>
      )}

      {/* Rating */}
      {typeof rating === 'number' && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-amber-400 text-sm leading-none">
            {'★'.repeat(Math.round(stars))}{'☆'.repeat(5 - Math.round(stars))}
          </span>
          <span className="text-xs font-semibold text-slate-700">{rating.toFixed(1)}</span>
          {typeof ratingCount === 'number' && (
            <span className="text-xs text-slate-400">({ratingCount.toLocaleString()} reviews)</span>
          )}
        </div>
      )}

      {/* Travel times */}
      {legs.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
          {legs.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5 text-xs">
              <span className={`w-2 h-2 rounded-full ${l.dot} flex-shrink-0`} />
              <span className="text-slate-500">From {l.label}:</span>
              <span className="font-semibold text-slate-700">{l.time}</span>
              {l.dist && <span className="text-slate-400">· {l.dist}</span>}
            </div>
          ))}
          {fairness !== null && (
            <div className={`flex items-center gap-1 text-xs font-medium ${fairnessColor}`}>
              <span>⚖</span>
              <span>{fairness}% balanced</span>
            </div>
          )}
        </div>
      )}

      {mapsUri && (
        <a
          href={mapsUri}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition px-3 py-2 rounded-xl"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          Open in Google Maps
        </a>
      )}
    </div>
  );
}
