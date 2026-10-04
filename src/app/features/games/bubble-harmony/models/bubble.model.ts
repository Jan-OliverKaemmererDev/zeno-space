/** Rainbow palette for micro-sparks on bubble hover, covering all 7 spectrum colors plus luminous white. */
export const RAINBOW_SPARK_COLORS = [
  '#ff4444', // Red
  '#ff9436', // Orange
  '#ffea3b', // Yellow
  '#4ade80', // Green
  '#38bdf8', // Cyan
  '#6366f1', // Blue / Indigo
  '#c084fc', // Violet / Purple
  '#ffffff', // Luminous White Spark
];

/**
 * Represents a floating soap bubble on the 2D harmony canvas.
 */
export interface Bubble {
  /** Current X coordinate on the canvas. */
  x: number;
  /** Current Y coordinate on the canvas. */
  y: number;
  /** Radius of the bubble in pixels. */
  radius: number;
  /** Horizontal velocity component. */
  vx: number;
  /** Vertical velocity component. */
  vy: number;
  /** CSS color string for gradient shading. */
  color: string;
  /** Primary HSL hue angle (0 to 360). */
  hue: number;
  /** Speed factor of surface oscillation wobble. */
  wobbleSpeed: number;
  /** Current phase angle of surface wobble. */
  wobblePhase: number;
  /** Opacity alpha factor. */
  alpha: number;
}

/**
 * Visual particle ejected when a bubble pops or emits rainbow sparks.
 */
export interface Particle {
  /** Current X coordinate on the canvas. */
  x: number;
  /** Current Y coordinate on the canvas. */
  y: number;
  /** Horizontal velocity component. */
  vx: number;
  /** Vertical velocity component. */
  vy: number;
  /** Particle radius in pixels. */
  radius: number;
  /** Current opacity alpha factor. */
  alpha: number;
  /** CSS color string for rendering. */
  color: string;
  /** Whether this particle is a shining micro-spark from the prism tool. */
  isRainbowSpark?: boolean;
  /** Remaining frames of lifetime. */
  life?: number;
  /** Maximum frames of lifetime for progress calculation. */
  maxLife?: number;
}
