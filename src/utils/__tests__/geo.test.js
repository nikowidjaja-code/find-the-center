import { describe, it, expect } from 'vitest';
import { geometricMedian, haversineDistance } from '../geo.js';

const sumDist = (pt, coords) =>
  coords.reduce((s, c) => s + haversineDistance(pt.lat, pt.lng, c.lat, c.lng), 0);

describe('geometricMedian', () => {
  it('returns the midpoint for 2 points', () => {
    const m = geometricMedian([{ lat: 0, lng: 0 }, { lat: 2, lng: 2 }]);
    expect(m.lat).toBeCloseTo(1);
    expect(m.lng).toBeCloseTo(1);
  });

  it('is not dragged by a cluster the way the centroid is', () => {
    // Two points together, one far away — median sits at/near the cluster side
    // less than the centroid does NOT: median minimizes total distance.
    const coords = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.01 },
      { lat: 1, lng: 0 },
    ];
    const median = geometricMedian(coords);
    const centroid = {
      lat: coords.reduce((s, c) => s + c.lat, 0) / 3,
      lng: coords.reduce((s, c) => s + c.lng, 0) / 3,
    };
    expect(sumDist(median, coords)).toBeLessThanOrEqual(sumDist(centroid, coords));
  });

  it('returns an input point when it is the median (odd collinear points)', () => {
    const m = geometricMedian([
      { lat: 0, lng: 0 },
      { lat: 1, lng: 0 },
      { lat: 5, lng: 0 },
    ]);
    expect(m.lat).toBeCloseTo(1, 3);
    expect(m.lng).toBeCloseTo(0, 3);
  });

  it('handles all points identical', () => {
    const m = geometricMedian([
      { lat: 3, lng: 4 },
      { lat: 3, lng: 4 },
      { lat: 3, lng: 4 },
    ]);
    expect(m.lat).toBeCloseTo(3);
    expect(m.lng).toBeCloseTo(4);
  });
});
