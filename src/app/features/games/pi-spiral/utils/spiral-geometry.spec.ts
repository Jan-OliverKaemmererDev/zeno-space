import {
  getWormholeSpine,
  precomputeFunnelPoints,
  calculateTileTarget,
  easeOutBack,
  THROAT_RADIUS,
  MOUTH_RADIUS,
} from './spiral-geometry';

describe('SpiralGeometry Utils', () => {
  describe('getWormholeSpine', () => {
    it('should return {0, 0} when z >= 0', () => {
      expect(getWormholeSpine(0, 1.0)).toEqual({ x: 0, y: 0 });
      expect(getWormholeSpine(5.0, 1.0)).toEqual({ x: 0, y: 0 });
    });

    it('should return linear transition between z=0 and z=-2.60', () => {
      const atThroat = getWormholeSpine(-2.60, 0);
      expect(atThroat.x).toBeCloseTo(3.20, 2);
      expect(atThroat.y).toBeCloseTo(0.0, 2);

      const mid = getWormholeSpine(-1.30, 0);
      expect(mid.x).toBeCloseTo(1.60, 2);
      expect(mid.y).toBeCloseTo(0.0, 2);
    });

    it('should compute smooth undulating sway coordinates deep in the wormhole (z < -2.60)', () => {
      const pt1 = getWormholeSpine(-15.0, 0.5);
      const pt2 = getWormholeSpine(-50.0, 1.0);

      expect(typeof pt1.x).toBe('number');
      expect(typeof pt1.y).toBe('number');
      expect(typeof pt2.x).toBe('number');
      expect(typeof pt2.y).toBe('number');
      expect(Number.isFinite(pt1.x)).toBe(true);
      expect(Number.isFinite(pt1.y)).toBe(true);
    });
  });

  describe('precomputeFunnelPoints', () => {
    it('should generate points beginning at throat radius and ending at mouth radius', () => {
      const points = precomputeFunnelPoints();
      expect(points.length).toBeGreaterThan(50);

      const first = points[0];
      const last = points[points.length - 1];

      expect(first.r).toBeCloseTo(THROAT_RADIUS, 1);
      expect(last.r).toBeCloseTo(MOUTH_RADIUS, 0.5);
      expect(first.z).toBeCloseTo(-2.60, 1);
      expect(last.z).toBeCloseTo(0.0, 1);
    });
  });

  describe('calculateTileTarget', () => {
    const funnelPoints = precomputeFunnelPoints();

    it('should place tile in foreground funnel if totalCount <= funnelPoints.length', () => {
      const target = calculateTileTarget(0, 5, funnelPoints, 0);
      expect(target.inHose).toBe(false);
      expect(target.scale).toBe(1.0);
      expect(target.x).toBeCloseTo(funnelPoints[0].x, 2);
      expect(target.y).toBeCloseTo(funnelPoints[0].y, 2);
    });

    it('should place older tiles into the wormhole hose when totalCount > funnelLength', () => {
      const funnelLen = funnelPoints.length;
      const totalCount = funnelLen + 20;

      // Tile 0 is the oldest tile (far down in the hose)
      const targetHose = calculateTileTarget(0, totalCount, funnelPoints, 0);
      expect(targetHose.inHose).toBe(true);
      expect(targetHose.z).toBeLessThan(-2.60);

      // Newest tile (index totalCount - 1) remains in foreground funnel
      const targetFunnel = calculateTileTarget(totalCount - 1, totalCount, funnelPoints, 0);
      expect(targetFunnel.inHose).toBe(false);
    });
  });

  describe('easeOutBack', () => {
    it('should return 0 at x=0 and 1 at x=1', () => {
      expect(easeOutBack(0)).toBeCloseTo(0, 4);
      expect(easeOutBack(1)).toBeCloseTo(1, 4);
    });

    it('should slightly overshoot 1 in between for bounce effect', () => {
      const val = easeOutBack(0.85);
      expect(val).toBeGreaterThan(0.85);
    });
  });
});
