import * as THREE from 'three';
import { BigFixed } from '../utils/big-fixed';

export const MAX_ORBIT_ITERS = 2048;

export interface ReferenceOrbitResult {
  /** Float array containing [X_0, Y_0, 0, 1, X_1, Y_1, 0, 1, ...] */
  data: Float32Array;
  /** Number of valid iterations computed */
  length: number;
  /** True if the reference center point escaped within maxIterations */
  escaped: boolean;
  /** Iteration index at which escape occurred (or maxIterations if it did not escape) */
  escapeIteration: number;
  /** The reference center used for this orbit */
  centerRe: BigFixed;
  centerIm: BigFixed;
}

const FOUR_FIXED = 4n << 128n;
// Allow orbit to continue past 4.0 up to 10^8 so all neighboring pixels in the viewport escape cleanly
const ESCAPE_LIMIT_FIXED = 100000000n << 128n;

/**
 * Computes an arbitrary-precision reference orbit using BigFixed fixed-point arithmetic on CPU.
 * The resulting orbit values Z_0, Z_1, ..., Z_n are stored as float pairs (X, Y)
 * ready for GPU texture upload.
 */
export function computeReferenceOrbit(
  centerRe: BigFixed,
  centerIm: BigFixed,
  maxIterations: number = MAX_ORBIT_ITERS
): ReferenceOrbitResult {
  const clampedMax = Math.min(Math.max(10, maxIterations), MAX_ORBIT_ITERS);
  // Fixed size RGBA Float32 array: 4 floats per iteration (X, Y, 0, 1)
  const data = new Float32Array(MAX_ORBIT_ITERS * 4);

  let x = BigFixed.zero();
  let y = BigFixed.zero();

  let escaped = false;
  let escapeIter = clampedMax;

  for (let i = 0; i < clampedMax; i++) {
    const xNum = x.toNumber();
    const yNum = y.toNumber();
    const idx = i * 4;
    data[idx] = xNum;
    data[idx + 1] = yNum;
    data[idx + 2] = 0;
    data[idx + 3] = 1;

    const x2Raw = (x.raw * x.raw) >> 128n;
    const y2Raw = (y.raw * y.raw) >> 128n;
    const mag2Raw = x2Raw + y2Raw;

    if (!escaped && mag2Raw > FOUR_FIXED) {
      escaped = true;
      escapeIter = i;
    }

    // Only stop when magnitude exceeds safe float threshold (|Z|^2 > 10^8)
    if (mag2Raw > ESCAPE_LIMIT_FIXED) {
      for (let j = i + 1; j < MAX_ORBIT_ITERS; j++) {
        const jIdx = j * 4;
        data[jIdx] = xNum;
        data[jIdx + 1] = yNum;
        data[jIdx + 2] = 0;
        data[jIdx + 3] = 1;
      }
      break;
    }

    // Z_{n+1} = Z_n^2 + C
    const twoXyRaw = (x.raw * y.raw) >> 127n;
    const nextXRaw = x2Raw - y2Raw + centerRe.raw;
    const nextYRaw = twoXyRaw + centerIm.raw;

    x = new BigFixed(nextXRaw);
    y = new BigFixed(nextYRaw);
  }

  // Ensure any unused slots up to MAX_ORBIT_ITERS have non-NaN values
  if (clampedMax < MAX_ORBIT_ITERS) {
    const lastX = data[(clampedMax - 1) * 4] || 0;
    const lastY = data[(clampedMax - 1) * 4 + 1] || 0;
    for (let j = clampedMax; j < MAX_ORBIT_ITERS; j++) {
      const jIdx = j * 4;
      data[jIdx] = lastX;
      data[jIdx + 1] = lastY;
      data[jIdx + 2] = 0;
      data[jIdx + 3] = 1;
    }
  }

  return {
    data,
    length: clampedMax,
    escaped,
    escapeIteration: escapeIter,
    centerRe,
    centerIm,
  };
}

/**
 * Creates or updates a Three.js DataTexture of fixed size MAX_ORBIT_ITERS.
 * Never disposes the underlying GPU texture during animation, completely eliminating texture thrashing and flickering.
 */
export function createOrUpdateOrbitTexture(
  existingTexture: THREE.DataTexture | null,
  orbitData: Float32Array,
  _maxIterations?: number
): THREE.DataTexture {
  if (existingTexture) {
    (existingTexture.image.data as Float32Array).set(orbitData);
    existingTexture.needsUpdate = true;
    return existingTexture;
  }

  const data = new Float32Array(MAX_ORBIT_ITERS * 4);
  data.set(orbitData);

  const texture = new THREE.DataTexture(
    data,
    MAX_ORBIT_ITERS,
    1,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Probes the viewport center and a 5x5 grid across the viewport to find a reference point
 * with the maximum possible escape iteration count (or an unescaped interior point).
 * Never downgrades an existing high-iteration reference orbit that is still nearby.
 */
export function computeRobustReferenceOrbit(
  centerRe: BigFixed,
  centerIm: BigFixed,
  scale: number,
  existingOrMax?: ReferenceOrbitResult | number | null
): ReferenceOrbitResult {
  const existingOrbit =
    typeof existingOrMax === 'object' && existingOrMax !== null ? existingOrMax : null;
  const maxIters =
    typeof existingOrMax === 'number' ? existingOrMax : MAX_ORBIT_ITERS;

  // 1. Check center first
  const centerOrbit = computeReferenceOrbit(centerRe, centerIm, maxIters);
  if (!centerOrbit.escaped || centerOrbit.escapeIteration >= maxIters) {
    return centerOrbit;
  }

  let bestOrbit = centerOrbit;

  // 2. 5x5 grid search across the viewport [-0.75, 0.75] * scale
  for (let dy = -0.75; dy <= 0.75; dy += 0.375) {
    for (let dx = -0.75; dx <= 0.75; dx += 0.375) {
      if (dx === 0 && dy === 0) continue;

      const candRe = centerRe.add(BigFixed.fromNumber(dx * scale * 0.5));
      const candIm = centerIm.add(BigFixed.fromNumber(dy * scale * 0.5));
      const candOrbit = computeReferenceOrbit(candRe, candIm, maxIters);

      if (!candOrbit.escaped || candOrbit.escapeIteration >= maxIters) {
        return candOrbit;
      }

      if (candOrbit.escapeIteration > bestOrbit.escapeIteration) {
        bestOrbit = candOrbit;
      }
    }
  }

  // 3. Never downgrade: If existing orbit is still nearby and has higher iterations, keep it!
  if (existingOrbit && existingOrbit.escapeIteration > bestOrbit.escapeIteration) {
    const diffX = centerRe.sub(existingOrbit.centerRe).toNumber();
    const diffY = centerIm.sub(existingOrbit.centerIm).toNumber();
    const dist = Math.hypot(diffX, diffY);
    if (dist < scale * 3.0) {
      return existingOrbit;
    }
  }

  return bestOrbit;
}
