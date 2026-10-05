import { describe, it, expect } from 'vitest';
import { BigFixed } from './big-fixed';

describe('BigFixed', () => {
  it('should initialize zero and one correctly', () => {
    const zero = BigFixed.zero();
    const one = BigFixed.one();

    expect(zero.toNumber()).toBe(0);
    expect(one.toNumber()).toBe(1);
    expect(zero.toString()).toBe('0');
    expect(one.toString()).toBe('1');
  });

  it('should convert from and to standard numbers accurately', () => {
    const numbers = [0.5, -0.75, 1.25, -2.125, 0.123456789];
    for (const num of numbers) {
      const fixed = BigFixed.fromNumber(num);
      expect(fixed.toNumber()).toBeCloseTo(num, 10);
    }
  });

  it('should accurately parse high-precision coordinate strings without losing digits', () => {
    const coordStr = '-0.743643887037158704752191543';
    const fixed = BigFixed.fromString(coordStr);
    const resultStr = fixed.toString(27);

    expect(resultStr.startsWith('-0.743643887037158704752')).toBe(true);
  });

  it('should perform addition and subtraction correctly', () => {
    const a = BigFixed.fromNumber(1.5);
    const b = BigFixed.fromNumber(-0.75);

    const sum = a.add(b);
    expect(sum.toNumber()).toBeCloseTo(0.75, 10);

    const diff = a.sub(b);
    expect(diff.toNumber()).toBeCloseTo(2.25, 10);
  });

  it('should perform multiplication and squaring correctly', () => {
    const a = BigFixed.fromNumber(1.5);
    const b = BigFixed.fromNumber(-2.0);

    const product = a.mul(b);
    expect(product.toNumber()).toBeCloseTo(-3.0, 10);

    const sq = a.square();
    expect(sq.toNumber()).toBeCloseTo(2.25, 10);
  });

  it('should handle small perturbations at extreme zoom depth (10^20)', () => {
    const center = BigFixed.fromString('-0.743643887037158704752191543');
    // Delta at zoom 10^20 is approx 10^-20
    const delta = BigFixed.fromString('0.00000000000000000001');

    const perturbed = center.add(delta);
    expect(perturbed.raw).not.toEqual(center.raw);

    const recoveredDelta = perturbed.sub(center);
    expect(recoveredDelta.toString(20)).toBe('0.00000000000000000001');
  });

  it('should parse scientific notation and tiny floats accurately', () => {
    const fromSci = BigFixed.fromString('1.5e-20');
    expect(fromSci.toString(21)).toBe('0.000000000000000000015');

    const fromSmallNum = BigFixed.fromNumber(1.5e-18);
    expect(fromSmallNum.raw).toBeGreaterThan(0n);
  });

  it('should convert tiny BigFixed numbers to JavaScript float without truncating to 0', () => {
    const tiny = BigFixed.fromString('0.00000000000000000123'); // 1.23e-18
    const num = tiny.toNumber();
    expect(num).toBeGreaterThan(0);
    expect(num).toBeCloseTo(1.23e-18, 20);

    const negativeTiny = BigFixed.fromString('-0.00000000000000000005'); // -5e-20
    const negNum = negativeTiny.toNumber();
    expect(negNum).toBeLessThan(0);
  });
});
