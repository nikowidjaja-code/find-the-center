export const DEFAULT_SEARCH_RADIUS_M = 1500;
export const MIN_SEARCH_RADIUS_M = 100;
export const MAX_SEARCH_RADIUS_M = 2000;
export const RADIUS_DEBOUNCE_MS = 400;
export const MAX_NEARBY_PLACES = 20;

// Multi-point support: 2 required, up to MAX_POINTS total.
// ponytail: 5 pts × 20 places = 100 Distance Matrix elements = the JS service
// per-request ceiling. Bump MAX_POINTS or MAX_NEARBY_PLACES only together with
// request chunking in useNearbyPlaces.
export const MIN_POINTS = 2;
export const MAX_POINTS = 5;

// Per-point marker colors, indexed 0..MAX_POINTS-1. Labels A–E.
// Vivid, high-contrast hues chosen to stand apart from Google's built-in
// red pins and blue location dot. `dot` is the matching Tailwind class used
// in the list/cards. Map pins add a white halo ring + shadow (see MapView).
export const POINT_STYLES = [
  { label: 'A', color: '#4f46e5', dot: 'bg-indigo-600' },
  { label: 'B', color: '#db2777', dot: 'bg-pink-600'   },
  { label: 'C', color: '#0d9488', dot: 'bg-teal-600'   },
  { label: 'D', color: '#d97706', dot: 'bg-amber-600'  },
  { label: 'E', color: '#7c3aed', dot: 'bg-violet-600' },
];
