/**
 * Formats a zoom factor into a user-friendly mathematical string.
 *
 * @param zoom - The zoom multiplier.
 * @returns Human-readable formatted string (e.g. "1,0×", "250×", "1,50 × 10⁴×").
 */
export function formatZoomFactor(zoom: number): string {
  if (zoom < 10) {
    return `${zoom.toFixed(1).replace('.', ',')}×`;
  }
  if (zoom < 1000) {
    return `${Math.round(zoom)}×`;
  }
  if (zoom < 10000) {
    return `${(zoom / 1000).toFixed(2).replace('.', ',')}k×`;
  }
  const exp = Math.floor(Math.log10(zoom));
  const mantissa = zoom / Math.pow(10, exp);
  return `${mantissa.toFixed(2).replace('.', ',')} · 10${toSuperscript(exp)}×`;
}

/**
 * Converts a positive integer into Unicode superscript digits.
 */
function toSuperscript(num: number): string {
  const superscripts: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };
  return num
    .toString()
    .split('')
    .map((ch) => superscripts[ch] || ch)
    .join('');
}

/**
 * Formats a real or imaginary coordinate with adaptive precision.
 */
export function formatCoordinate(val: number, zoom: number): string {
  const precision = Math.min(14, Math.max(4, Math.floor(Math.log10(Math.max(1, zoom))) + 4));
  return val.toFixed(precision).replace('.', ',');
}

/**
 * Linear interpolation between two numbers.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamps a number to a closed interval.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/**
 * Calculates adaptive maximum iterations based on current zoom level.
 * Ensures fine-grained fractal boundaries at deep zoom while keeping overview fast.
 */
export function getRecommendedIterations(zoom: number): number {
  const logZoom = Math.log10(Math.max(1, zoom));
  return Math.min(500, Math.round(90 + logZoom * 40));
}
