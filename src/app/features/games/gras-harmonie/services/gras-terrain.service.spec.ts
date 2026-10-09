import { GrasTerrainService } from './gras-terrain.service';

describe('GrasTerrainService', () => {
  let service: GrasTerrainService;

  beforeEach(() => {
    service = new GrasTerrainService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should calculate terrain elevation within expected bounds', () => {
    const hCenter = service.getTerrainHeight(0, 0);
    expect(typeof hCenter).toBe('number');
    expect(Number.isFinite(hCenter)).toBe(true);

    const hFore = service.getTerrainHeight(10, 15);
    const hDistant = service.getTerrainHeight(-20, -50);
    expect(Number.isFinite(hFore)).toBe(true);
    expect(Number.isFinite(hDistant)).toBe(true);
  });
});
