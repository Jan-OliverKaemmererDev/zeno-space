import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CelestialTextureFactory } from './celestial-texture-factory';

describe('CelestialTextureFactory', () => {
  let factory: CelestialTextureFactory;

  beforeEach(() => {
    factory = new CelestialTextureFactory();
  });

  afterEach(() => {
    factory.dispose();
  });

  it('should create particle glow texture', () => {
    const tex = factory.getParticleGlowTexture();
    expect(tex).toBeTruthy();
  });

  it('should generate photorealistic planet textures for various subtypes', () => {
    const texTerrestrial = factory.getPlanetTexture('terrestrial');
    expect(texTerrestrial).toBeTruthy();

    const texGas = factory.getPlanetTexture('gas-giant', 0);
    expect(texGas).toBeTruthy();

    const texIce = factory.getPlanetTexture('ice-giant');
    expect(texIce).toBeTruthy();

    const texDesert = factory.getPlanetTexture('desert');
    expect(texDesert).toBeTruthy();

    const texVolcanic = factory.getPlanetTexture('volcanic');
    expect(texVolcanic).toBeTruthy();
  });

  it('should generate sun, clouds, rings and accretion disk textures', () => {
    const sunTex = factory.createSunTexture();
    expect(sunTex).toBeTruthy();

    const cloudTex = factory.createTerrestrialCloudsTexture();
    expect(cloudTex).toBeTruthy();

    const ringTex = factory.createSaturnRingTexture();
    expect(ringTex).toBeTruthy();

    const diskTex = factory.createAccretionDiskTexture();
    expect(diskTex).toBeTruthy();
  });
});
