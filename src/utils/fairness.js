/**
 * Computes how balanced the travel times from A and B are to a place.
 * Returns 100 when travel times are equal, 0 when one is infinitely longer.
 *
 * @param {object|null} fromA - Distance Matrix element for origin A
 * @param {object|null} fromB - Distance Matrix element for origin B
 * @returns {number|null} Fairness percentage (0–100), or null if data missing
 */
export function calcFairness(fromA, fromB) {
  const dA = fromA?.duration?.value;
  const dB = fromB?.duration?.value;
  if (!dA || !dB) return null;
  return Math.round((Math.min(dA, dB) / Math.max(dA, dB)) * 100);
}

// Combined score: 50% rating quality + 50% location fairness
// Used for the default "Best" sort
export function calcScore(place) {
  const rating   = (typeof place.rating === 'number' ? place.rating : 3.5) / 5;
  const fairness = (calcFairness(place.fromA, place.fromB) ?? 50) / 100;
  return rating * 0.5 + fairness * 0.5;
}
