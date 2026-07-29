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

// Per-point marker colors (fill / border), indexed 0..MAX_POINTS-1.
// Labels A–E keep the original A/B convention.
export const POINT_STYLES = [
  { label: 'A', color: '#6366f1', border: '#4338ca', dot: 'bg-indigo-500' },
  { label: 'B', color: '#f43f5e', border: '#be123c', dot: 'bg-rose-500'   },
  { label: 'C', color: '#10b981', border: '#047857', dot: 'bg-emerald-500'},
  { label: 'D', color: '#f59e0b', border: '#b45309', dot: 'bg-amber-500'  },
  { label: 'E', color: '#8b5cf6', border: '#6d28d9', dot: 'bg-violet-500' },
];
