import * as THREE from 'three';
import { PiTextureFactory } from './pi-texture-factory';

describe('PiTextureFactory', () => {
  let factory: PiTextureFactory;
  let group: THREE.Group;

  beforeEach(() => {
    factory = new PiTextureFactory();
    group = new THREE.Group();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load Orbitron font safely with fallback', async () => {
    await expect(factory.loadOrbitronFont()).resolves.not.toThrow();
  });

  it('should generate center number texture with 3,14 glyph', () => {
    const texture = factory.createCenterNumberTexture();
    expect(texture).toBeInstanceOf(THREE.CanvasTexture);
    texture.dispose();
  });

  it('should create center hero meshes and add them to group', () => {
    const hero = factory.createCenterHero(group);
    expect(hero.centerTileMesh).toBeInstanceOf(THREE.Mesh);
    expect(hero.centerPiSymbolMesh).toBeInstanceOf(THREE.Mesh);
    expect(group.children).toContain(hero.centerTileMesh);
    expect(group.children).toContain(hero.centerPiSymbolMesh);
  });

  it('should initialize 10 digit materials', () => {
    const materials = factory.initDigitMaterials();
    expect(materials.length).toBe(10);
    for (const mat of materials) {
      expect(mat).toBeInstanceOf(THREE.MeshBasicMaterial);
      mat.dispose();
    }
  });
});
