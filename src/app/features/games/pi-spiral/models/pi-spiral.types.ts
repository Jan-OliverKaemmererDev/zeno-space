import * as THREE from 'three';

/**
 * Metadata and animation state for a single 3D mosaic tile in the Pi spiral.
 */
export interface MosaicTile {
  /** The Three.js mesh representing the physical mosaic stone. */
  mesh: THREE.Mesh;
  /** The cloned MeshBasicMaterial managing opacity for this specific tile. */
  material: THREE.MeshBasicMaterial;
  /** Index in the decimal sequence after 14 (0 = first digit after 14, which is 1). */
  index: number;
  /** Decimal digit value (0-9). */
  digit: number;
  /** Polar angle theta along the Archimedean spiral. */
  theta: number;
  /** Radial distance from the spiral origin. */
  radius: number;
  /** Base rest position in 3D world space. */
  basePosition: THREE.Vector3;
  /** Target position for smooth gliding down the tunnel. */
  targetPosition: THREE.Vector3;
  /** Target visual scale factor (1.0 in outer rings, tapering in deep tunnel). */
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
 * Precomputed 3D coordinate point along the Archimedean funnel.
 */
export interface FunnelPoint {
  x: number;
  y: number;
  z: number;
  r: number;
  th: number;
}

/**
 * Calculated 3D target coordinates, scale, and placement zone for a tile.
 */
export interface TileTarget {
  x: number;
  y: number;
  z: number;
  r: number;
  th: number;
  scale: number;
  inHose: boolean;
}
