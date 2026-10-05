/**
 * Complex plane coordinate (Real and Imaginary parts).
 */
export interface ComplexNumber {
  re: number | string;
  im: number | string;
}

/**
 * Predefined landmark location in the Mandelbrot set for exploration.
 */
export interface MandelbrotWaypoint {
  id: string;
  name: string;
  subtitle: string;
  center: ComplexNumber;
  zoom: number;
  maxIterations: number;
  description: string;
}

/**
 * State parameters for the interactive Mandelbrot WebGL camera and shader.
 */
export interface MandelbrotViewState {
  centerX: number;
  centerY: number;
  zoom: number;
  maxIterations: number;
  tiltX: number;
  tiltY: number;
  paletteShift: number;
}

/**
 * Formatted statistics exposed to the HUD header and speech bubble.
 */
export interface MandelbrotStats {
  zoomFormatted: string;
  iterations: number;
  coordFormatted: string;
  currentWaypointName: string;
}
