// Geometry helpers on lat/lng coordinates.

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Geometric median (Weiszfeld's algorithm): the point minimizing the sum of
 * distances to all coords. Fairer meeting center than the centroid, which a
 * cluster of nearby points drags toward itself.
 *
 * Uses an equirectangular approximation (lng scaled by cos of mean lat) —
 * plenty accurate at city scale. For 2 points the median is the whole
 * segment, so the midpoint (centroid) is returned directly.
 *
 * @param {Array<{lat: number, lng: number}>} coords - at least 1 coordinate
 * @returns {{lat: number, lng: number}}
 */
export function geometricMedian(coords) {
  const centroid = {
    lat: coords.reduce((s, c) => s + c.lat, 0) / coords.length,
    lng: coords.reduce((s, c) => s + c.lng, 0) / coords.length,
  };
  if (coords.length <= 2) return centroid;

  const lngScale = Math.cos((centroid.lat * Math.PI) / 180);
  let { lat, lng } = centroid;

  for (let iter = 0; iter < 100; iter++) {
    let numLat = 0, numLng = 0, den = 0;
    for (const c of coords) {
      const d = Math.hypot(c.lat - lat, (c.lng - lng) * lngScale);
      if (d < 1e-9) return { lat: c.lat, lng: c.lng }; // landed on an input point
      numLat += c.lat / d;
      numLng += c.lng / d;
      den += 1 / d;
    }
    const nextLat = numLat / den;
    const nextLng = numLng / den;
    const moved = Math.hypot(nextLat - lat, (nextLng - lng) * lngScale);
    lat = nextLat;
    lng = nextLng;
    if (moved < 1e-8) break; // ~1mm — converged
  }
  return { lat, lng };
}
