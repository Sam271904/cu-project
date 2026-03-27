import { describe, it, expect } from 'vitest';
import { computeHnSignal, velocityScore, positionScore } from '../src/services/personalization/scoreCluster';

describe('hackernews-velocity', () => {
  describe('velocityScore', () => {
    it('returns 0.5 when velocity is 0 (neutral)', () => {
      expect(velocityScore(0)).toBeCloseTo(0.5);
    });

    it('returns > 0.5 for positive velocity (rising)', () => {
      expect(velocityScore(10)).toBeGreaterThan(0.7);
      expect(velocityScore(10)).toBeLessThan(0.8);
    });

    it('returns < 0.5 for negative velocity (falling)', () => {
      expect(velocityScore(-10)).toBeLessThan(0.3);
    });

    it('caps at ~1.0 for very high velocity', () => {
      expect(velocityScore(100)).toBeGreaterThan(0.99);
    });

    it('approaches 0.0 for very negative velocity', () => {
      expect(velocityScore(-100)).toBeLessThan(0.01);
    });
  });

  describe('positionScore', () => {
    it('returns 1.0 for position 1', () => {
      expect(positionScore(1)).toBeCloseTo(1.0);
    });

    it('returns 0.0 for position 100+', () => {
      expect(positionScore(100)).toBe(0);
      expect(positionScore(200)).toBe(0);
    });

    it('returns 0.5 for position ~50', () => {
      expect(positionScore(50)).toBeCloseTo(0.5, 1);
    });

    it('returns 0.75 for position 25', () => {
      expect(positionScore(25)).toBeCloseTo(0.75, 1);
    });
  });

  describe('computeHnSignal', () => {
    it('blends velocity and position: rising + top → high signal', () => {
      const sig = computeHnSignal(20, 3);
      expect(sig).toBeGreaterThan(0.7);
    });

    it('first observation (null velocity) still gets decent score if top position', () => {
      const sig = computeHnSignal(null, 5);
      expect(sig).toBeGreaterThan(0.5);
      expect(sig).toBeLessThan(0.7);
    });

    it('stable story (velocity=0) at position 50 → moderate signal', () => {
      const sig = computeHnSignal(0, 50);
      expect(sig).toBeCloseTo(0.5, 1);
    });

    it('returns null when velocity is null AND position > 100', () => {
      const sig = computeHnSignal(null, 150);
      expect(sig).toBeNull();
    });

    it('null velocity with position 100 → valid (on boundary)', () => {
      const sig = computeHnSignal(null, 100);
      expect(sig).not.toBeNull();
    });

    it('high velocity + low position → very high signal', () => {
      const sig = computeHnSignal(30, 2);
      expect(sig).toBeGreaterThan(0.85);
    });
  });
});
