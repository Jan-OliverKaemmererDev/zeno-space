import * as THREE from 'three';

/**
 * Metadata and animation state for a single 3D seed tile in the Golden Ratio Phyllotaxis.
 */
export interface PhiSeedTile {
  /** The Three.js mesh representing the seed stone. */
  mesh: THREE.Mesh;
  /** The cloned MeshBasicMaterial managing opacity and color for this tile. */
  material: THREE.MeshBasicMaterial;
  /** Index in the decimal sequence after 1.618 (0 = first digit after 618, which is 0). */
  index: number;
  /** Decimal digit value (0-9). */
  digit: number;
  /** Polar angle theta along the golden angle phyllotaxis. */
  theta: number;
  /** Radial distance from the origin. */
  radius: number;
  /** Base rest position in 3D world space. */
  basePosition: THREE.Vector3;
  /** Target position for smooth gliding. */
  targetPosition: THREE.Vector3;
  /** Target visual scale factor. */
  targetScale: number;
  /** Current vertical elevation offset above base position for wave animation. */
  elevation: number;
  /** Vertical velocity for spring physics simulation. */
  elevationVelocity: number;
  /** Scale animation progress (0 to 1). */
  scaleProgress: number;
  /** Current 2D evasion offset for bubble-letter hover effect. */
  evadeOffset: THREE.Vector2;
  /** Current scale multiplier for bubble evasion bounce. */
  evadeScale: number;
  /** Current tilt rotation in radians for bubble evasion. */
  evadeRotation: number;
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
