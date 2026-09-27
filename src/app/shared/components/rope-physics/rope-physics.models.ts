/**
 * A single particle along a Verlet rope.
 */
export interface RopePoint {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  /** If true, the point is pinned to its anchor and unaffected by forces. */
  pinned: boolean;
}

/**
 * Configuration for one rope that connects a fixed anchor point (ceiling / wall)
 * to a hanging object (lantern / star).
 */
export interface RopeConfig {
  /** Unique identifier – must match the `data-swing-id` on the DOM element. */
  id: string;
  /** Anchor X in the 1376-wide design coordinate space. */
  anchorX: number;
  /** Anchor Y in the 768-high design coordinate space. */
  anchorY: number;
  /** Total rope length in design-space pixels. */
  length: number;
  /** Width of the hanging body in design-space pixels. */
  bodyWidth: number;
  /** Height of the hanging body in design-space pixels. */
  bodyHeight: number;
  /** Number of segments (more = bendier). */
  segments: number;
  /** Rope line width in design-space pixels. */
  thickness: number;
  /** Rope stroke color. */
  color: string;
  /** Optional glow color for a soft halo around the rope. */
  glowColor?: string;
  /** Mouse influence radius in design-space pixels. */
  influenceRadius: number;
  /** How strongly the rope reacts to the mouse (0-1 range). */
  reactivity: number;
  /** Gravity strength multiplier. */
  gravityScale: number;
  /** Damping multiplier per frame (0.98-0.995 range). */
  damping: number;
}

/** Runtime state for one rope, combining config and live particle data. */
export interface Rope extends RopeConfig {
  points: RopePoint[];
  bodyAngle: number;
  bodyAngleVel: number;
}

/** Mapping between rope ID, cached DOM element, anchor position, and rest length. */
export interface DomSyncItem {
  id: string;
  element: HTMLElement | null;
  anchorX: number;
  anchorY: number;
  restLength: number;
}

/** Live pointer state tracked in design coordinate space. */
export interface PointerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  prevX: number;
  prevY: number;
  timestamp: number;
  inside: boolean;
}
