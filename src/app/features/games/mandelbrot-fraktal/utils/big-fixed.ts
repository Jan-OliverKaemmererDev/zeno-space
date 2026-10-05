/**
 * High-performance 128-bit fixed-point arithmetic using native JavaScript BigInt.
 *
 * 128 fraction bits provide ~38.5 decimal digits of precision.
 * This guarantees sub-pixel accuracy at zoom levels up to 10^32 (100 quadrillion × 100 quadrillion),
 * while keeping addition, subtraction, and multiplication down to single BigInt instructions.
 */

export const BIG_FIXED_FRAC_BITS = 128n;
export const BIG_FIXED_ONE = 1n << BIG_FIXED_FRAC_BITS;
export const BIG_FIXED_HALF = 1n << (BIG_FIXED_FRAC_BITS - 1n);

export class BigFixed {
  readonly raw: bigint;

  constructor(raw: bigint) {
    this.raw = raw;
  }

  static fromBigInt(raw: bigint): BigFixed {
    return new BigFixed(raw);
  }

  static zero(): BigFixed {
    return new BigFixed(0n);
  }

  static one(): BigFixed {
    return new BigFixed(BIG_FIXED_ONE);
  }

  /**
   * Converts a standard JavaScript number to BigFixed, preserving precision even for small floats (e.g. 1e-25).
   */
  static fromNumber(val: number): BigFixed {
    if (!Number.isFinite(val)) {
      throw new Error(`Cannot convert non-finite number ${val} to BigFixed`);
    }
    if (val === 0) return BigFixed.zero();
    return BigFixed.fromString(val.toString());
  }

  /**
   * Parses an exact decimal or scientific string (e.g. "-0.74364...", "1.5e-20") into BigFixed.
   */
  static fromString(str: string): BigFixed {
    const trimmed = str.trim();
    if (!trimmed) return BigFixed.zero();

    let isNegative = false;
    let s = trimmed;
    if (s.startsWith('-')) {
      isNegative = true;
      s = s.slice(1);
    } else if (s.startsWith('+')) {
      s = s.slice(1);
    }

    // Handle scientific notation (e.g. "1.5e-20" or "2E+5")
    const eIndex = s.search(/[eE]/);
    if (eIndex !== -1) {
      const mantissaStr = s.slice(0, eIndex);
      const expVal = parseInt(s.slice(eIndex + 1), 10);
      const mantissaFixed = BigFixed.fromString(mantissaStr);

      if (expVal === 0) {
        return isNegative ? mantissaFixed.negate() : mantissaFixed;
      } else if (expVal > 0) {
        const factor = 10n ** BigInt(expVal);
        const result = new BigFixed(mantissaFixed.raw * factor);
        return isNegative ? result.negate() : result;
      } else {
        const divisor = 10n ** BigInt(-expVal);
        const result = new BigFixed(mantissaFixed.raw / divisor);
        return isNegative ? result.negate() : result;
      }
    }

    const dotIndex = s.indexOf('.');
    let intStr = s;
    let fracStr = '';

    if (dotIndex !== -1) {
      intStr = s.slice(0, dotIndex);
      fracStr = s.slice(dotIndex + 1);
    }

    const intPart = intStr ? BigInt(intStr) : 0n;
    let raw = intPart << BIG_FIXED_FRAC_BITS;

    if (fracStr) {
      const fracNum = BigInt(fracStr);
      const fracDenom = 10n ** BigInt(fracStr.length);
      const fracScaled = (fracNum << BIG_FIXED_FRAC_BITS) / fracDenom;
      raw += fracScaled;
    }

    return new BigFixed(isNegative ? -raw : raw);
  }

  add(other: BigFixed): BigFixed {
    return new BigFixed(this.raw + other.raw);
  }

  sub(other: BigFixed): BigFixed {
    return new BigFixed(this.raw - other.raw);
  }

  /**
   * Fast fixed-point multiplication: (a * b) >> 128
   */
  mul(other: BigFixed): BigFixed {
    return new BigFixed((this.raw * other.raw) >> BIG_FIXED_FRAC_BITS);
  }

  /**
   * Multiply by a standard float (e.g. scale * deltaX)
   */
  mulNumber(factor: number): BigFixed {
    const factorFixed = BigFixed.fromNumber(factor);
    return this.mul(factorFixed);
  }

  /**
   * Fast square: (a * a) >> 128
   */
  square(): BigFixed {
    return new BigFixed((this.raw * this.raw) >> BIG_FIXED_FRAC_BITS);
  }

  negate(): BigFixed {
    return new BigFixed(-this.raw);
  }

  abs(): BigFixed {
    return new BigFixed(this.raw < 0n ? -this.raw : this.raw);
  }

  /**
   * Converts back to standard JS number (useful for HUD/rendering offsets),
   * dynamically normalizing tiny fractions so values down to 10^-38 are never truncated to 0.
   */
  toNumber(): number {
    if (this.raw === 0n) return 0;
    const isNeg = this.raw < 0n;
    const absRaw = isNeg ? -this.raw : this.raw;

    const intPart = absRaw >> BIG_FIXED_FRAC_BITS;
    if (intPart > 0n) {
      const fracMask = BIG_FIXED_ONE - 1n;
      const fracBits = absRaw & fracMask;
      const fracTop53 = Number(fracBits >> (BIG_FIXED_FRAC_BITS - 53n));
      const num = Number(intPart) + fracTop53 / 9007199254740992;
      return isNeg ? -num : num;
    }

    // Dynamic bit-length normalization for small fractions to avoid zero-truncation
    const bitLen = absRaw.toString(2).length;
    let top53: number;
    let expShift: number;

    if (bitLen > 53) {
      top53 = Number(absRaw >> BigInt(bitLen - 53));
      expShift = bitLen - 53 - 128;
    } else {
      top53 = Number(absRaw);
      expShift = -128;
    }

    const num = top53 * Math.pow(2, expShift);
    return isNeg ? -num : num;
  }

  /**
   * Formats the fixed-point number into a decimal string with specified precision.
   */
  toString(digits = 18): string {
    const isNeg = this.raw < 0n;
    const absRaw = isNeg ? -this.raw : this.raw;

    const intPart = absRaw >> BIG_FIXED_FRAC_BITS;
    const fracMask = BIG_FIXED_ONE - 1n;
    const fracBits = absRaw & fracMask;

    if (digits <= 0) {
      return (isNeg ? '-' : '') + intPart.toString();
    }

    const tenPow = 10n ** BigInt(digits);
    const fracDecimal =
      ((fracBits * tenPow) + (BIG_FIXED_HALF)) >> BIG_FIXED_FRAC_BITS;
    let fracStr = fracDecimal.toString().padStart(digits, '0');

    // Handle overflow into intPart due to rounding
    let adjustedInt = intPart;
    if (fracStr.length > digits) {
      adjustedInt += 1n;
      fracStr = fracStr.slice(1);
    }

    fracStr = fracStr.replace(/0+$/, '');
    if (!fracStr) {
      return (isNeg ? '-' : '') + adjustedInt.toString();
    }

    return (isNeg ? '-' : '') + adjustedInt.toString() + '.' + fracStr;
  }
}
