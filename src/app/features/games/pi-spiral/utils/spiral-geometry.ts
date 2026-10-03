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

/**
 * Calculates the distance-based opacity for a decimal digit tile.
 * Tiles deeper in the wormhole fade out smoothly into the cosmic dark,
 * only becoming visible when the user scrolls towards them along the tunnel.
 *
 * @param tileZ - The z-coordinate of the tile in world space.
 * @param cameraZ - The current z-coordinate of the camera.
 * @returns An opacity multiplier between 0.0 (fully faded out) and 1.0 (fully visible).
 */
export function calculateTileOpacity(tileZ: number, cameraZ: number): number {
  // Situation 1: Foreground funnel tiles (tileZ >= -2.60)
  if (tileZ >= -2.60) {
    if (cameraZ >= -2.60) {
      // Camera is in overview or funnel entrance: all funnel tiles are 100% visible
      return 1.0;
    }
    // Camera is deep inside the wormhole hose: funnel entrance gently fades out behind camera
    const distBehind = -2.60 - cameraZ;
    if (distBehind <= 8.0) return 1.0;
    if (distBehind >= 28.0) return 0.0;
    const t = (distBehind - 8.0) / 20.0;
    return 1.0 - t * t * (3.0 - 2.0 * t);
  }

  // Situation 2: Wormhole hose tiles (tileZ < -2.60)
  if (cameraZ < -2.60) {
    // Both camera and tile are inside the snaking wormhole hose
    const deltaZ = cameraZ - tileZ; // positive = tile is ahead down the wormhole

    // Behind camera: fade out smoothly so tiles don't clip the lens or clutter rear view
    if (deltaZ < 0) {
      if (deltaZ >= -8.0) return 1.0;
      if (deltaZ <= -24.0) return 0.0;
      const t = (-deltaZ - 8.0) / 16.0;
      return 1.0 - t * t * (3.0 - 2.0 * t);
    }

    // Ahead of camera: active zone is 100% visible, then fades out smoothly into cosmic dark
    if (deltaZ <= 60.0) {
      return 1.0;
    }
    if (deltaZ >= 150.0) {
      return 0.0;
    }
    const t = (deltaZ - 60.0) / 90.0; // 0 to 1
    return 1.0 - t * t * (3.0 - 2.0 * t);
  }

  // Camera is outside the wormhole hose (cameraZ >= -2.60, overview / approach)
  // Distance of tile down into the throat
  const depthInHose = -2.60 - tileZ; // positive value

  // Interpolate visible throat depth smoothly between overview (cameraZ >= 18.0) and throat entry (cameraZ = -2.60)
  const clampedCamZ = Math.min(18.0, cameraZ);
  const progress = (18.0 - clampedCamZ) / (18.0 - (-2.60)); // 0.0 at overview, 1.0 at throat
  const fullVisDepth = 24.0 + (60.0 - 24.0) * progress;
  const fadeEndDepth = 75.0 + (150.0 - 75.0) * progress;

  if (depthInHose <= fullVisDepth) {
    return 1.0;
  }
  if (depthInHose >= fadeEndDepth) {
    return 0.0;
  }
  const t = (depthInHose - fullVisDepth) / (fadeEndDepth - fullVisDepth);
  return 1.0 - t * t * (3.0 - 2.0 * t);
}
