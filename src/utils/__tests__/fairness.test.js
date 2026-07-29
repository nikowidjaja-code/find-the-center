import { describe, it, expect } from 'vitest';
import { calcFairness, calcScore } from '../fairness.js';

const el = (sec) => ({ status: 'OK', duration: { value: sec } });

describe('calcFairness', () => {
  it('returns 100 when all travel times are equal', () => {
    expect(calcFairness([el(600), el(600), el(600)])).toBe(100);
  });

  it('is the min/max ratio across all points (>2 points)', () => {
    // min 300, max 600 → 50%
    expect(calcFairness([el(300), el(600), el(450)])).toBe(50);
  });

  it('ignores null / non-OK elements', () => {
    expect(calcFairness([el(400), null, el(800)])).toBe(50);
  });

  it('returns null with fewer than 2 valid times', () => {
    expect(calcFairness([el(400), null])).toBeNull();
    expect(calcFairness([])).toBeNull();
    expect(calcFairness(undefined)).toBeNull();
  });
});

describe('calcScore', () => {
  it('rewards both rating and fairness (0..1)', () => {
    const perfect = calcScore({ rating: 5, from: [el(600), el(600)] });
    const worse   = calcScore({ rating: 5, from: [el(300), el(900)] });
    expect(perfect).toBeGreaterThan(worse);
    expect(perfect).toBeCloseTo(1, 5);
  });

  it('falls back to neutral defaults when data missing', () => {
    // rating 3.5/5 = 0.7, fairness default 0.5 → 0.5*0.7 + 0.5*0.5 = 0.6
    expect(calcScore({})).toBeCloseTo(0.6, 5);
  });
});
