/**
 * Computes how balanced travel times are across ALL points to a place.
 * Returns 100 when every travel time is equal, approaching 0 as the
 * fastest/slowest spread widens. Works for 2 or more points.
 *
 * @param {Array<object|null>} elements - Distance Matrix elements, one per point
 * @returns {number|null} Fairness percentage (0–100), or null if <2 valid times
 */
export function calcFairness(elements) {
  const durations = (elements ?? [])
    .map((e) => e?.duration?.value)
    .filter((v) => typeof v === 'number' && v > 0);
  if (durations.length < 2) return null;
  return Math.round((Math.min(...durations) / Math.max(...durations)) * 100);
}

// Combined score: 50% rating quality + 50% location fairness
// Used for the default "Best" sort
export function calcScore(place) {
  const rating   = (typeof place.rating === 'number' ? place.rating : 3.5) / 5;
  const fairness = (calcFairness(place.from) ?? 50) / 100;
  return rating * 0.5 + fairness * 0.5;
}
