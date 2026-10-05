import { describe, it, expect } from 'vitest';
import { BigFixed } from '../utils/big-fixed';
import {
  computeReferenceOrbit,
  computeRobustReferenceOrbit,
  createOrUpdateOrbitTexture,
} from './mandelbrot-reference-orbit';

describe('mandelbrot-reference-orbit', () => {
  it('should compute Z_0 = 0 and Z_1 = C for origin (0, 0)', () => {
    const orbit = computeReferenceOrbit(BigFixed.zero(), BigFixed.zero(), 10);
    expect(orbit.escaped).toBe(false);
    expect(orbit.escapeIteration).toBe(10);

    // Z_0 = (0, 0)
    expect(orbit.data[0]).toBe(0);
    expect(orbit.data[1]).toBe(0);

    // Z_1 = (0, 0)
    expect(orbit.data[4]).toBe(0);
    expect(orbit.data[5]).toBe(0);
  });

  it('should correctly detect escape for point outside set (2.0, 2.0)', () => {
    const orbit = computeReferenceOrbit(
      BigFixed.fromNumber(2.0),
      BigFixed.fromNumber(2.0),
      50
    );
    expect(orbit.escaped).toBe(true);
    expect(orbit.escapeIteration).toBeLessThan(5);
  });

  it('should not escape for known center inside main cardioid (-0.5, 0)', () => {
    const orbit = computeReferenceOrbit(
      BigFixed.fromNumber(-0.5),
      BigFixed.zero(),
      100
    );
    expect(orbit.escaped).toBe(false);
    expect(orbit.escapeIteration).toBe(100);
  });

  it('should create and update a Three.js DataTexture', () => {
    const orbit = computeReferenceOrbit(
      BigFixed.fromNumber(-0.743643887),
      BigFixed.fromNumber(0.131825904),
      128
    );
    const texture = createOrUpdateOrbitTexture(null, orbit.data, 128);
    expect(texture).toBeDefined();
    expect(texture.image.width).toBe(2048);
    expect(texture.image.height).toBe(1);

    // Update existing texture
    const updated = createOrUpdateOrbitTexture(texture, orbit.data, 128);
    expect(updated).toBe(texture);

    texture.dispose();
  });

  it('should compute long unescaped orbit for iconic deep spiral coordinate', () => {
    const re = BigFixed.fromString('-0.743643887037158704752191506114774');
    const im = BigFixed.fromString('0.131825904205311970493132056385139');
    const orbit = computeReferenceOrbit(re, im, 500);
    expect(orbit.escaped).toBe(false);
    expect(orbit.escapeIteration).toBe(500);
  });

  it('should find optimal unescaped candidate using computeRobustReferenceOrbit', () => {
    // Center point is outside main cardioid, but near it
    const centerRe = BigFixed.fromNumber(-0.76);
    const centerIm = BigFixed.fromNumber(0.01);
    const scale = 0.1;

    const robust = computeRobustReferenceOrbit(centerRe, centerIm, scale, 100);
    expect(robust.escapeIteration).toBeGreaterThan(10);
  });
});
