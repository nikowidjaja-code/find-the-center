/**
 * Given a google.maps.DirectionsResult, find the lat/lng on the route
 * where cumulative leg duration == totalDuration / 2 (time-equidistant midpoint).
 *
 * @param {google.maps.DirectionsResult} directionsResult
 * @returns {{ lat: number, lng: number }}
 */
export function findTimeMidpoint(directionsResult) {
  const leg = directionsResult.routes[0].legs[0];
  const totalSeconds = leg.duration.value; // seconds
  const targetSeconds = totalSeconds / 2;

  let elapsed = 0;
  for (const step of leg.steps) {
    const stepDuration = step.duration.value;
    if (elapsed + stepDuration >= targetSeconds) {
      // Interpolate within this step's polyline
      const fraction = (targetSeconds - elapsed) / stepDuration;
      const path = step.path; // array of LatLng objects

      if (path && path.length > 0) {
        const idx = Math.floor(fraction * (path.length - 1));
        const point = path[idx] ?? step.end_location;
        return {
          lat: typeof point.lat === 'function' ? point.lat() : point.lat,
          lng: typeof point.lng === 'function' ? point.lng() : point.lng,
        };
      }

      // Fallback if path is empty
      const endLoc = step.end_location;
      return {
        lat: typeof endLoc.lat === 'function' ? endLoc.lat() : endLoc.lat,
        lng: typeof endLoc.lng === 'function' ? endLoc.lng() : endLoc.lng,
      };
    }
    elapsed += stepDuration;
  }

  // Fallback: return end location of leg
  const endLoc = directionsResult.routes[0].legs[0].end_location;
  return {
    lat: typeof endLoc.lat === 'function' ? endLoc.lat() : endLoc.lat,
    lng: typeof endLoc.lng === 'function' ? endLoc.lng() : endLoc.lng,
  };
}
