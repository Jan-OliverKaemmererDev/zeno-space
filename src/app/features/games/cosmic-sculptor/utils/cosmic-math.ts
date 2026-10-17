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
  minRadius = 24.0,
  deltaRadius = 6.8
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
 * Simulates a tender, localized pluck impulse directly under the mouse cursor that propagates
 * outward as a gentle wave in both directions along the orbit, fading out smoothly over ~3 seconds.
 *
 * @param theta Radial angle on the orbit ring (0 to 2π).
 * @param pluckAngle Angle where the cursor plucked the string.
 * @param elapsedTime Seconds elapsed since the pluck occurred.
 * @param frequency Base vibrational frequency in Hz.
 * @param damping Exponential decay coefficient.
 * @returns Normal displacement value in 3D units (delicate, subtle amplitude).
 */
export function evaluateHarpDisplacement(
  theta: number,
  pluckAngle: number,
  elapsedTime: number,
  frequency = 4.0,
  damping = 1.35
): number {
  const maxDuration = 3.0;
  if (elapsedTime < 0 || elapsedTime >= maxDuration) return 0;

  // Shortest angular distance from cursor pluck position along the circular orbit [0, π]
  const angDist = angularDistance(theta, pluckAngle);

  // Gentle angular wave propagation speed: travels outward in both directions along the ring
  const waveSpeed = 2.8;
  const pulseCenter = waveSpeed * elapsedTime;

  // 1. Traveling wave pulse envelope: starts tightly focused at cursor, disperses gracefully
  const sigma = 0.22 + 0.16 * elapsedTime;
  const travelingEnvelope = Math.exp(-Math.pow(angDist - pulseCenter, 2) / (2 * sigma * sigma));

  // 2. High-frequency wave carrier propagating along the orbit
  const waveCarrier = Math.cos(9.0 * (angDist - pulseCenter));

  // 3. Delicate local standing resonance at the pluck site that decays quickly
  const localEnvelope = Math.exp(-Math.pow(angDist, 2) / 0.08) * Math.exp(-elapsedTime * 3.6);
  const localCarrier = Math.cos(elapsedTime * frequency * Math.PI * 2);

  // Superposition of traveling pulse and local pluck resonance
  const waveMotion = travelingEnvelope * waveCarrier + localEnvelope * localCarrier * 0.4;

  // Smooth, gentle decay and gradual polynomial fade-out to 0
  const decay = Math.exp(-damping * elapsedTime);
  const fadeOut = Math.max(0, 1.0 - (elapsedTime / maxDuration));

  // Soft, delicate amplitude scale (~0.28 units max displacement)
  const amplitudeScale = 0.28;

  return waveMotion * decay * fadeOut * amplitudeScale;
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
