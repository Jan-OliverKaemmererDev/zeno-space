import * as THREE from 'three';

/**
 * Metadata and animation state for a single 3D seed tile in the Golden Ratio Phyllotaxis.
 */
export interface PhiSeedTile {
  /** Index in the decimal sequence after 1.618 (0 = first digit after 618, which is 0). */
  index: number;
  /** Decimal digit value (0-9). */
  digit: number;
  /** Instance slot index within the digit's InstancedMesh. */
  instanceId: number;
  /** Precalculated rest X position. */
  baseX: number;
  /** Precalculated rest Y position. */
  baseY: number;
  /** Precalculated rest Z position. */
  baseZ: number;
  /** Polar angle theta along the golden angle phyllotaxis. */
  theta: number;
  /** Radial distance from the origin. */
  radius: number;
  /** Target visual scale factor. */
  targetScale: number;
  /** Lifecycle state: spawning in, active, fading out, or dead. */
  state: 'spawning' | 'active' | 'fading' | 'dead';
  /** Scale animation progress for spawn-in (0 to 1). */
  scaleProgress: number;
  /** Fade progress for center dissolve (1 to 0). */
  fadeProgress: number;
  /** Current vertical elevation offset above base position for wave animation. */
  elevation: number;
  /** Vertical velocity for spring physics simulation. */
  elevationVelocity: number;
  /** Current 2D evasion offset for bubble-letter hover effect. */
  evadeOffset: THREE.Vector2;
  /** Current scale multiplier for bubble evasion bounce. */
  evadeScale: number;
  /** Whether this seed is completely at rest and skipping frame calculations. */
  isSleeping: boolean;
}

/**
 * Calculated 3D target coordinates, scale, and placement for a seed tile.
 */
export interface SeedTarget {
  x: number;
  y: number;
  z: number;
  r: number;
  th: number;
  scale: number;
}

/**
 * Fibonacci rectangle & golden spiral definition for background frame visualization.
 */
export interface FibonacciSquare {
  index: number;
  val: number;
  x: number;
  y: number;
  size: number;
}
