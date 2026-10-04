import {
  GOLDEN_ANGLE,
  INNER_CLEARANCE_RADIUS,
  calculateSeedTarget,
  easeOutBack,
  getFibonacciSequence,
  getFibonacciRatio,
} from './phyllotaxis-geometry';

describe('phyllotaxis-geometry', () => {
  it('should define the golden angle accurately (~137.5 degrees / ~2.40 rad)', () => {
    expect(GOLDEN_ANGLE).toBeCloseTo(2.39996, 4);
    const degrees = (GOLDEN_ANGLE * 180) / Math.PI;
    expect(degrees).toBeCloseTo(137.5077, 2);
  });

  it('should compute valid 3D seed target coordinates outside center clearance', () => {
    const target0 = calculateSeedTarget(0, 1);
    expect(target0.r).toBeGreaterThan(INNER_CLEARANCE_RADIUS);
    expect(target0.scale).toBeGreaterThan(0.7);
    expect(Number.isFinite(target0.x)).toBe(true);
    expect(Number.isFinite(target0.y)).toBe(true);
    expect(Number.isFinite(target0.z)).toBe(true);
  });

  it('should increase radius monotonically as seed index increases', () => {
    const target0 = calculateSeedTarget(0, 100);
    const target10 = calculateSeedTarget(10, 100);
    const target50 = calculateSeedTarget(50, 100);

    expect(target10.r).toBeGreaterThan(target0.r);
    expect(target50.r).toBeGreaterThan(target10.r);
  });

  it('should apply easeOutBack correctly with smooth start and end', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 2);
    expect(easeOutBack(1)).toBeCloseTo(1, 2);
    // At intermediate value, overshoot exceeds 1
    expect(easeOutBack(0.8)).toBeGreaterThan(1.0);
  });

  it('should generate Fibonacci sequence accurately', () => {
    expect(getFibonacciSequence(0)).toEqual([]);
    expect(getFibonacciSequence(1)).toEqual([1]);
    expect(getFibonacciSequence(7)).toEqual([1, 1, 2, 3, 5, 8, 13]);
  });

  it('should converge towards the golden ratio with increasing Fibonacci steps', () => {
    const step3 = getFibonacciRatio(3); // 3 / 2 = 1.5
    const step6 = getFibonacciRatio(6); // 13 / 8 = 1.625
    const step12 = getFibonacciRatio(12);

    expect(step3.ratio).toBe(1.5);
    expect(step6.differenceToPhi).toBeLessThan(step3.differenceToPhi);
    expect(step12.differenceToPhi).toBeLessThan(step6.differenceToPhi);
    expect(step12.ratio).toBeCloseTo(1.6180339, 4);
  });

  it('should rotate coordinates along a circular orbit when rotationAngle is applied', () => {
    const unrotated = calculateSeedTarget(10, 100, 0, 0);
    const rotated = calculateSeedTarget(10, 100, 0, Math.PI / 2);

    expect(rotated.r).toBeCloseTo(unrotated.r, 5);
    // Radius in XY plane is preserved exactly (circular motion)
    const distUnrotated = Math.hypot(unrotated.x, unrotated.y);
    const distRotated = Math.hypot(rotated.x, rotated.y);
    expect(distRotated).toBeCloseTo(distUnrotated, 5);
    // Angle increases by rotationAngle
    expect(rotated.th).toBeCloseTo(unrotated.th + Math.PI / 2, 5);
  });
});
