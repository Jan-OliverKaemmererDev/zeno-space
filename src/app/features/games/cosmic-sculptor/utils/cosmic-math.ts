import * as THREE from 'three';
import { PlanetSubtype } from '../models/cosmic-sculptor.types';

/**
 * Universal gravitational constant scaled for calm, meditative real-time celestial motion.
 * Tuned so planets orbit at a serene, graceful pace (~20 to 60 seconds per revolution).
 */
export const G_CONST = 0.40;

/**
 * Gravitational softening parameter preventing infinite force singularities on near-zero distances.
 */
export const GRAVITATIONAL_SOFTENING = 1.4;

/**
 * Computes circular orbital speed according to Keplerian two-body mechanics: v = sqrt(G * M / r).
 *
 * @param centralMass Mass of the central attracting body (e.g. the Sun).
 * @param radius Distance from the central mass center.
 * @returns Tangential velocity scalar.
 */
export function computeCircularOrbitVelocity(centralMass: number, radius: number): number {
  if (radius <= 0) return 0;
  return Math.sqrt((G_CONST * centralMass) / radius);
}

/**
 * Finds a safe, non-intersecting orbital radius for newly spawned celestial bodies.
 * Ensures the new orbit does not intersect or dangerously overlap with existing orbits initially.
 *
 * @param existingRadii Array of existing orbital radii in the system.
 * @param minRadius Minimum allowed distance from the central star.
 * @param deltaRadius Minimum safety separation between adjacent orbital rings.
 * @returns An unoccupied orbital radius.
 */
export function findNextSafeOrbitRadius(
  existingRadii: number[],
  minRadius = 12.0,
  deltaRadius = 5.8
): number {
  if (existingRadii.length === 0) {
    return minRadius + (Math.random() * 2.0);
  }

  const sorted = [...existingRadii].sort((a, b) => a - b);

  // Check for available gaps between existing orbits
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (next - current >= deltaRadius * 2.0) {
      return current + deltaRadius + (Math.random() - 0.5) * 1.0;
    }
  }

  // Otherwise, place on a new outer orbital shell
  const largest = sorted[sorted.length - 1];
  return largest + deltaRadius + (Math.random() * 1.5);
}

/**
 * Computes the shortest angular distance between two radian angles in [0, 2π].
 *
 * @param a First angle in radians.
 * @param b Second angle in radians.
 * @returns Shortest difference in radians [0, π].
 */
export function angularDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % (Math.PI * 2);
  return diff > Math.PI ? Math.PI * 2 - diff : diff;
}

/**
 * Calculates dynamic out-of-plane displacement for a vibrating orbital harp string.
 * Simulates a localized pluck impulse decaying into traveling standing wave modes.
 *
 * @param theta Radial angle on the orbit ring (0 to 2π).
 * @param pluckAngle Angle where the cursor plucked the string.
 * @param elapsedTime Seconds elapsed since the pluck occurred.
 * @param frequency Base vibrational frequency in Hz.
 * @param damping Exponential decay coefficient.
 * @returns Normal displacement value in 3D units.
 */
export function evaluateHarpDisplacement(
  theta: number,
  pluckAngle: number,
  elapsedTime: number,
  frequency: number,
  damping = 3.6
): number {
  if (elapsedTime < 0 || elapsedTime > 2.8) return 0;

  const angDist = angularDistance(theta, pluckAngle);
  const waveSpeed = 8.0;
  const pulseCenter = (elapsedTime * waveSpeed) % (Math.PI * 2);
  const localizedFalloff = Math.exp(-(angDist * angDist) / 0.55);
  const travelingWave = Math.exp(-Math.pow(angDist - pulseCenter, 2) / 0.85) * 0.45;

  const decay = Math.exp(-damping * elapsedTime);
  const fundamental = Math.sin(elapsedTime * frequency * Math.PI * 2);
  const harmonic = Math.sin(elapsedTime * frequency * 2.0 * Math.PI * 2) * 0.35;

  return (localizedFalloff + travelingWave) * (fundamental + harmonic) * decay;
}

/**
 * Generates an evocative, poetic name for celestial bodies in Zeno Space.
 *
 * @param subtype Planetary classification.
 * @param index Ordinal sequence number.
 * @returns Formatted astronomical name.
 */
export function generateRealisticPlanetName(subtype: PlanetSubtype, index: number): string {
  const suffixes = ['Lumina', 'Harmonia', 'Serenitas', 'Aura', 'Celeste', 'Zenith', 'Mirabilis', 'Aether'];
  const prefixes: Record<PlanetSubtype, string[]> = {
    terrestrial: ['Ozeania', 'Verdantia', 'Smaragd-Sphäre', 'Aquamarina', 'Gaia-Nova'],
    'gas-giant': ['Bernstein-Riese', 'Aura-Jupiter', 'Zeno-Kronos', 'Golden-Vesper'],
    'ice-giant': ['Kristall-Azur', 'Gletscher-Zenith', 'Saphira', 'Borealis'],
    desert: ['Sonnengold', 'Kupfermond', 'Sahara-Stella', 'Terra-Rosa'],
    volcanic: ['Magma-Lotus', 'Rubinfeuer', 'Ignis-Rose', 'Purpurstern'],
  };

  const list = prefixes[subtype];
  const baseName = list[index % list.length];
  const suffix = suffixes[index % suffixes.length];
  return `${baseName} ${suffix}`;
}
