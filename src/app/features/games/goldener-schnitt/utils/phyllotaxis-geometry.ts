import { SeedTarget } from '../models/goldener-schnitt.types';

/**
 * The Golden Angle in radians:
 * ψ = π × (3 - √5) ≈ 2.399963229728653322 rad ≈ 137.507764°
 * This angle guarantees optimal mathematical packing without gaps or overlaps.
 */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Base clearance radius around the center "1,618" hero display. */
export const INNER_CLEARANCE_RADIUS = 2.75;

/** Radial expansion factor for Vogel's phyllotaxis formula (r = c * √n). */
export const PHYLLOTAXIS_SPREAD = 0.68;

/**
 * Calculates 3D target coordinates, polar angle, radius, and scale for a seed tile
 * according to Vogel's model of sunflower phyllotaxis.
 *
 * @param seedIndex - 0-based index of the seed.
 * @param totalSeeds - Total count of seeds placed so far.
 * @param time - Optional animation timestamp for ambient micro-wave sway.
 * @param rotationAngle - Global rotation angle around center following the golden ratio.
 * @returns Calculated SeedTarget with 3D position and orientation.
 */
export function calculateSeedTarget(
  seedIndex: number,
  totalSeeds: number,
  time = 0,
  rotationAngle = 0
): SeedTarget {
  const theta = seedIndex * GOLDEN_ANGLE + rotationAngle;
  const radius = INNER_CLEARANCE_RADIUS + PHYLLOTAXIS_SPREAD * Math.sqrt(seedIndex + 1);

  // Subtle natural botanical dish/dome bowl curve in Z
  const distFromCenter = radius - INNER_CLEARANCE_RADIUS;
  const zCurvature = -0.038 * Math.pow(Math.max(0, distFromCenter), 1.25);

  // Organic micro-breathing wave based on distance from center
  const wave = time > 0 ? Math.sin(time * 1.8 - radius * 0.4) * 0.08 : 0;

  const x = radius * Math.cos(theta);
  const y = radius * Math.sin(theta);
  const z = zCurvature + wave;

  // Scale: seeds near center are crisp and slightly smaller; outer seeds expand to full size
  const scale = Math.min(1.0, 0.82 + 0.18 * Math.min(1, seedIndex / 30));

  return {
    x,
    y,
    z,
    r: radius,
    th: theta,
    scale,
  };
}

/**
 * Smooth, gentle ease function with soft overshoot for organic seed pop-in.
 */
export function easeOutBack(x: number): number {
  const c1 = 0.82;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/**
 * Generates the first N numbers of the Fibonacci sequence.
 * F_0 = 1, F_1 = 1, F_2 = 2, F_3 = 3, F_4 = 5, F_5 = 8, F_6 = 13...
 */
export function getFibonacciSequence(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [1];
  const seq = [1, 1];
  for (let i = 2; i < count; i++) {
    seq.push(seq[i - 1] + seq[i - 2]);
  }
  return seq;
}

/**
 * Calculates the Fibonacci approximation ratio (F_{n+1} / F_n) for a given step.
 * Demonstrates the mathematical convergence towards Phi (≈ 1.6180339887...).
 */
export function getFibonacciRatio(step: number): {
  fn: number;
  fnPlus1: number;
  ratio: number;
  differenceToPhi: number;
} {
  const PHI = (1 + Math.sqrt(5)) / 2;
  const clampedStep = Math.max(1, Math.min(30, step));
  const fibs = getFibonacciSequence(clampedStep + 2);
  const fn = fibs[clampedStep - 1];
  const fnPlus1 = fibs[clampedStep];
  const ratio = fnPlus1 / fn;
  const differenceToPhi = Math.abs(ratio - PHI);

  return {
    fn,
    fnPlus1,
    ratio,
    differenceToPhi,
  };
}
