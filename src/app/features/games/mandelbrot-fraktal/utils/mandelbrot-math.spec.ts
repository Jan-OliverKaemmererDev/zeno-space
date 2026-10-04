import { describe, it, expect } from 'vitest';
import {
  formatZoomFactor,
  formatCoordinate,
  lerp,
  clamp,
  getRecommendedIterations,
} from './mandelbrot-math';

describe('mandelbrot-math utils', () => {
  it('formats zoom factors properly across scales', () => {
    expect(formatZoomFactor(1.0)).toBe('1,0×');
    expect(formatZoomFactor(4.5)).toBe('4,5×');
    expect(formatZoomFactor(250)).toBe('250×');
    expect(formatZoomFactor(2500)).toBe('2,50k×');
    expect(formatZoomFactor(10000)).toContain('· 10');
  });

  it('formats coordinates with commas', () => {
    const formatted = formatCoordinate(-0.743643, 100);
    expect(formatted).toContain(',');
    expect(formatted).toContain('-0,7436');
  });

  it('lerps correctly between values', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(10, 20, 0.1)).toBe(11);
  });

  it('clamps correctly within interval', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('computes recommended iterations scaling with log zoom', () => {
    const baseIter = getRecommendedIterations(1);
    const deepIter = getRecommendedIterations(10000);
    expect(baseIter).toBe(90);
    expect(deepIter).toBeGreaterThan(baseIter);
    expect(deepIter).toBeLessThanOrEqual(500);
  });
});
