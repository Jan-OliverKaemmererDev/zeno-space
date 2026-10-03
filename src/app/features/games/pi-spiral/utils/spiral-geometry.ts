import { FunnelPoint, TileTarget } from '../models/pi-spiral.types';

/** Throat radius where the foreground funnel narrows into the wormhole hose. */
export const THROAT_RADIUS = 3.20;

/** Maximum outer mouth radius where the 5 outer rings stay comfortably framed. */
export const MOUTH_RADIUS = 8.20;

/** Linear spacing along the spiral arc and along the snaking hose spine. */
export const TILE_ARC_SPACING = 1.02;

/**
 * Evaluates the 3D center spine of the wormhole at depth z and time t.
 * Anchors solidly to the foreground funnel throat at z = -2.60,
 * then gently sways left/right (X) and up/down (Y) in an expressive cosmic dance.
 * Identical in formula to the GLSL vertex shader so numbers ride inside the tube in sync.
 */
export function getWormholeSpine(z: number, time: number): { x: number; y: number } {
  if (z >= 0.0) {
    return { x: 0.0, y: 0.0 };
  }
  if (z >= -2.60) {
    const t = -z / 2.60;
    return { x: 3.20 * t, y: 0.0 };
  }
  const d = -2.60 - z;
  const ramp = 1.0 - Math.exp(-0.045 * d);

  // Faster, dynamic motion with stronger 3D curves
  const slowTime = time * 0.60;
  const swayX =
    10.5 * Math.sin(0.024 * d - slowTime * 0.80) +
    4.2 * Math.sin(0.048 * d + slowTime * 0.50 + 0.9);
  const swayY =
    7.2 * Math.cos(0.020 * d - slowTime * 0.65) +
    3.0 * Math.sin(0.038 * d - slowTime * 0.45 + 1.3);

  // Smooth transition from throat point (3.20, 0.0)
  const throatDecay = Math.exp(-0.06 * d);
  const x = 3.20 * throatDecay + (1.0 - throatDecay) * (ramp * swayX);
  const y = 0.0 * throatDecay + (1.0 - throatDecay) * (ramp * swayY);

  return { x, y };
}

/**
 * Precomputes 3D coordinates for the 5 outer rings of the foreground funnel (Trichter).
 */
export function precomputeFunnelPoints(
  mouthRadius = MOUTH_RADIUS,
  throatRadius = THROAT_RADIUS,
  tileArcSpacing = TILE_ARC_SPACING
): FunnelPoint[] {
  const points: FunnelPoint[] = [];
  const targetTotalTh = 5.0 * 2 * Math.PI; // 5 full turns
  const dr_step = (mouthRadius - throatRadius) / targetTotalTh;

  let currTh = 0;
  let currR = throatRadius;

  while (currTh < targetTotalTh) {
    const t = currTh / targetTotalTh;
    const z = -2.60 * Math.pow(1 - t, 1.35);
    points.push({
      x: currR * Math.cos(currTh),
      y: currR * Math.sin(currTh),
      z,
      r: currR,
      th: currTh,
    });
    const dth = tileArcSpacing / currR;
    currTh += dth;
    currR = throatRadius + dr_step * currTh;
  }

  return points;
}

/**
 * Computes target 3D coordinates (x, y, z), polar angle, radius, and scale for a tile.
 * Maps tiles strictly to either the foreground funnel (outer 5 rings) or the snaking wormhole:
 * - When totalCount <= funnelLength: tiles naturally spiral outward from throat to rim.
 * - When totalCount > funnelLength: the newest funnelLength tiles remain in the foreground funnel,
 *   while older tiles are sucked backward and sway synchronously with the wormhole.
 * - Separation between all adjacent tiles is strictly >= 0.30, preventing any overlap at 1000+ digits.
 */
export function calculateTileTarget(
  tileIndex: number,
  totalCount: number,
  funnelPoints: FunnelPoint[],
  time = 0
): TileTarget {
  const funnelLen = funnelPoints.length;
  if (funnelLen === 0) {
    return { x: 0, y: 0, z: 0, r: 0, th: 0, scale: 1.0, inHose: false };
  }

  const fromNewest = Math.max(0, totalCount - 1 - tileIndex);

  if (totalCount <= funnelLen) {
    const idx = Math.min(tileIndex, funnelLen - 1);
    const pt = funnelPoints[idx];
    return { x: pt.x, y: pt.y, z: pt.z, r: pt.r, th: pt.th, scale: 1.0, inHose: false };
  } else {
    if (fromNewest < funnelLen) {
      const funnelIdx = funnelLen - 1 - fromNewest;
      const pt = funnelPoints[funnelIdx];
      return { x: pt.x, y: pt.y, z: pt.z, r: pt.r, th: pt.th, scale: 1.0, inHose: false };
    } else {
      // Tile is in the snaking wormhole hose: sways dynamically with the wormhole!
      const hoseIdx = fromNewest - funnelLen;
      const targetZ = -2.60 - (hoseIdx + 1) * 0.98;
      const spine = getWormholeSpine(targetZ, time);
      return {
        x: spine.x,
        y: spine.y,
        z: targetZ,
        r: Math.hypot(spine.x, spine.y),
        th: Math.atan2(spine.y, spine.x),
        scale: 1.0,
        inHose: true,
      };
    }
  }
}

/**
 * Smooth, gentle ease function with soft overshoot for organic tile pop-in.
 */
export function easeOutBack(x: number): number {
  const c1 = 0.82;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
