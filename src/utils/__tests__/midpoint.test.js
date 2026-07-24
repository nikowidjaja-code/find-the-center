import { describe, it, expect } from 'vitest';
import { findTimeMidpoint } from '../midpoint.js';

// Helpers to build mock DirectionsResult shapes
const makePt = (lat, lng) => ({ lat, lng });
const makeFnPt = (lat, lng) => ({ lat: () => lat, lng: () => lng });

const makeResult = (steps) => ({
  routes: [{
    legs: [{
      duration: { value: steps.reduce((s, st) => s + st.duration.value, 0) },
      end_location: steps.at(-1).end_location,
      steps,
    }],
  }],
});

const makeStep = (durationSeconds, path) => ({
  duration: { value: durationSeconds },
  path,
  end_location: path.at(-1),
});

describe('findTimeMidpoint', () => {
  it('returns the midpoint of a single-step route', () => {
    // 3-point path over 100s, target = 50s
    // fraction = 0.5, idx = floor(0.5 * 2) = 1 → middle point
    const result = makeResult([
      makeStep(100, [makePt(0, 0), makePt(1, 1), makePt(2, 2)]),
    ]);
    expect(findTimeMidpoint(result)).toEqual({ lat: 1, lng: 1 });
  });

  it('returns the boundary point when midpoint falls exactly between two steps', () => {
    // Two equal 60s steps — midpoint hits the last point of step 1
    // fraction = (60-0)/60 = 1.0, idx = floor(1.0 * 1) = 1 → path[1]
    const result = makeResult([
      makeStep(60, [makePt(0, 0), makePt(1, 1)]),
      makeStep(60, [makePt(1, 1), makePt(2, 2)]),
    ]);
    expect(findTimeMidpoint(result)).toEqual({ lat: 1, lng: 1 });
  });

  it('interpolates within a step when the midpoint falls inside it', () => {
    // Steps: 30s, 60s, 30s → total 120s, target = 60s
    // After step 1: elapsed = 30. Step 2: 30 + 60 = 90 >= 60 → fraction = (60-30)/60 = 0.5
    // path has 3 points: idx = floor(0.5 * 2) = 1 → middle point
    const result = makeResult([
      makeStep(30, [makePt(0, 0), makePt(1, 1)]),
      makeStep(60, [makePt(1, 1), makePt(2, 2), makePt(3, 3)]),
      makeStep(30, [makePt(3, 3), makePt(4, 4)]),
    ]);
    expect(findTimeMidpoint(result)).toEqual({ lat: 2, lng: 2 });
  });

  it('falls back to step end_location when path is empty', () => {
    const result = makeResult([
      { duration: { value: 100 }, path: [], end_location: makePt(9, 9) },
    ]);
    expect(findTimeMidpoint(result)).toEqual({ lat: 9, lng: 9 });
  });

  it('handles Google Maps LatLng objects (lat/lng as functions)', () => {
    // Same as single-step test but using function-style LatLng
    const result = makeResult([
      makeStep(100, [makeFnPt(0, 0), makeFnPt(1, 1), makeFnPt(2, 2)]),
    ]);
    expect(findTimeMidpoint(result)).toEqual({ lat: 1, lng: 1 });
  });

  it('falls back to leg end_location when no step catches the target', () => {
    // Artificially craft a result where the loop never triggers
    // (not possible in real data, but tests the safety fallback)
    const endLoc = makePt(5, 5);
    const result = {
      routes: [{
        legs: [{
          duration: { value: 0 },
          end_location: endLoc,
          steps: [],
        }],
      }],
    };
    // With zero total duration, targetSeconds = 0 and no steps → hits fallback
    expect(findTimeMidpoint(result)).toEqual({ lat: 5, lng: 5 });
  });
});
