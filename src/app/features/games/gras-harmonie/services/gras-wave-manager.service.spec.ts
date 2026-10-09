import { GrasWaveManagerService } from './gras-wave-manager.service';

describe('GrasWaveManagerService', () => {
  let service: GrasWaveManagerService;

  beforeEach(() => {
    service = new GrasWaveManagerService();
  });

  it('should be created with 24 directional waves and 3 gust waves', () => {
    expect(service).toBeTruthy();
    expect(service.dirWaves.length).toBe(24);
    expect(service.shockwaves.length).toBe(5);
    expect(service.gustWaves.length).toBe(3);
  });

  it('should spawn a directional wave with correct properties', () => {
    const wave = service.spawnDirectionalWave(2, 4, 1, 0, 0.5);
    expect(wave.originX).toBe(2);
    expect(wave.originZ).toBe(4);
    expect(wave.dirX).toBe(1);
    expect(wave.dirZ).toBe(0);
    expect(wave.time).toBe(0);
    expect(wave.strength).toBeGreaterThan(0.2);
  });

  it('should trigger a click shockwave', () => {
    const sw = service.triggerClickWave(5, -3);
    expect(sw.x).toBe(5);
    expect(sw.z).toBe(-3);
    expect(sw.strength).toBe(1.0);
    expect(sw.time).toBe(0);
  });

  it('should trigger wind gust and update uniforms in update loop', () => {
    const gust = service.triggerWindGust();
    expect(gust.strength).toBe(1.35);
    expect(gust.time).toBe(0);

    const { maxActiveGustStrength } = service.update(0.016);
    expect(maxActiveGustStrength).toBe(1.35);
    expect(service.gustWaveUniformsA[0].x).toBeGreaterThan(0);
  });
});
