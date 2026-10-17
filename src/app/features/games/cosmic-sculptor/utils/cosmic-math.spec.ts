import { describe, it, expect } from 'vitest';
import {
  computeCircularOrbitVelocity,
  findNextSafeOrbitRadius,
  angularDistance,
  evaluateHarpDisplacement,
  generateRealisticPlanetName,
} from './cosmic-math';

describe('CosmicMath Utils', () => {
  it('should compute Keplerian circular orbit velocity v = sqrt(G*M/r)', () => {
    const v = computeCircularOrbitVelocity(1200, 12);
    expect(v).toBeGreaterThan(0);
    // As radius increases, circular velocity decreases
    const vOuter = computeCircularOrbitVelocity(1200, 24);
    expect(vOuter).toBeLessThan(v);
  });

  it('should find a safe, non-intersecting orbit radius beyond existing orbits', () => {
    const existing = [12.0, 18.0, 24.0];
    const safeRadius = findNextSafeOrbitRadius(existing, 12.0, 5.0);
    expect(safeRadius).toBeGreaterThan(24.0);
  });

  it('should find gap between existing orbits if large enough', () => {
    const existing = [12.0, 30.0];
    const safeRadius = findNextSafeOrbitRadius(existing, 12.0, 5.0);
    expect(safeRadius).toBeGreaterThan(12.0);
    expect(safeRadius).toBeLessThan(30.0);
  });

  it('should calculate correct shortest angular distance', () => {
    expect(angularDistance(0, Math.PI)).toBeCloseTo(Math.PI);
    expect(angularDistance(0.1, 0.2)).toBeCloseTo(0.1);
    expect(angularDistance(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(0.2);
  });

  it('should evaluate harp displacement with localized pluck, wave propagation, and gentle fade out', () => {
    // Immediately after pluck (t = 0.02s), displacement is strongly localized near pluck angle
    const dPluckSite = evaluateHarpDisplacement(0, 0, 0.02, 4.0);
    const dFarAway = evaluateHarpDisplacement(Math.PI, 0, 0.02, 4.0);
    expect(Math.abs(dPluckSite)).toBeGreaterThan(0.1);
    expect(Math.abs(dFarAway)).toBeLessThan(0.01);

    // Later (t = 2.0s), wave has propagated and decayed gently
    const dLate = evaluateHarpDisplacement(0, 0, 2.0, 4.0);
    expect(Math.abs(dLate)).toBeLessThan(Math.abs(dPluckSite));

    // After fade-out window (t >= 3.0s), displacement is completely 0
    const dFinished = evaluateHarpDisplacement(0, 0, 3.1, 4.0);
    expect(dFinished).toBe(0);
  });

  it('should generate formatted planet names for all subtypes', () => {
    const nameTerrestrial = generateRealisticPlanetName('terrestrial', 0);
    expect(nameTerrestrial).toContain('Lumina');
    const nameGas = generateRealisticPlanetName('gas-giant', 1);
    expect(nameGas).toContain('Harmonia');
  });
});
