import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CosmicPhysicsEngine } from './cosmic-physics-engine';
import { CelestialTextureFactory } from './celestial-texture-factory';
import { OrbitHarpSystem } from './orbit-harp-system';

describe('CosmicPhysicsEngine', () => {
  let physicsEngine: CosmicPhysicsEngine;
  let textureFactory: CelestialTextureFactory;
  let harpSystem: OrbitHarpSystem;

  beforeEach(() => {
    textureFactory = new CelestialTextureFactory();
    harpSystem = new OrbitHarpSystem();
    physicsEngine = new CosmicPhysicsEngine(textureFactory, harpSystem);
  });

  afterEach(() => {
    physicsEngine.dispose();
    harpSystem.clear();
    textureFactory.dispose();
  });

  it('should initialize the central Sun with solar mass', () => {
    const sun = physicsEngine.initSun();
    expect(sun).toBeTruthy();
    expect(sun.type).toBe('sun');
    expect(sun.mass).toBe(physicsEngine.sunMass);
    expect(physicsEngine.getBodies().length).toBe(1);
  });

  it('should spawn planets on non-intersecting orbits', () => {
    physicsEngine.initSun();
    const p1 = physicsEngine.spawnPlanet('terrestrial');
    const p2 = physicsEngine.spawnPlanet('gas-giant');

    const r1 = Math.hypot(p1.position.x, p1.position.z);
    const r2 = Math.hypot(p2.position.x, p2.position.z);

    expect(Math.abs(r1 - r2)).toBeGreaterThanOrEqual(4.0);
    expect(physicsEngine.getPlanetCount()).toBe(2);
  });

  it('should spawn a black hole with high gravitational mass', () => {
    physicsEngine.initSun();
    const bh = physicsEngine.spawnBlackHole();
    expect(bh.type).toBe('black-hole');
    expect(bh.mass).toBeGreaterThan(1000);
    expect(physicsEngine.getBlackHoleCount()).toBe(1);
  });

  it('should advance N-body simulation and update positions', () => {
    physicsEngine.initSun();
    const p = physicsEngine.spawnPlanet('terrestrial');
    const initialPos = p.position.clone();

    // Step physics
    physicsEngine.update(0.1);

    expect(p.position.equals(initialPos)).toBe(false);
  });

  it('should reset system back to 3 starter planets', () => {
    physicsEngine.initSun();
    physicsEngine.spawnPlanet();
    physicsEngine.spawnPlanet();
    physicsEngine.spawnBlackHole();

    physicsEngine.resetSystem();
    expect(physicsEngine.getPlanetCount()).toBe(3);
    expect(physicsEngine.getBlackHoleCount()).toBe(0);
  });

  it('should maintain stable circular orbits for planets without mutual gravitation when no black hole exists', () => {
    physicsEngine.initSun();
    const p1 = physicsEngine.spawnPlanet('terrestrial');
    const p2 = physicsEngine.spawnPlanet('gas-giant');

    const initialRadius1 = p1.orbitRadius!;
    const initialRadius2 = p2.orbitRadius!;

    // Step physics for multiple cycles
    for (let i = 0; i < 20; i++) {
      physicsEngine.update(0.1);
    }

    const currentRadius1 = Math.hypot(p1.position.x, p1.position.z);
    const currentRadius2 = Math.hypot(p2.position.x, p2.position.z);

    // Radii remain perfectly constant because planets do not disturb each other's orbits
    expect(currentRadius1).toBeCloseTo(initialRadius1, 2);
    expect(currentRadius2).toBeCloseTo(initialRadius2, 2);
    expect(physicsEngine.getCollisionCount()).toBe(0);
  });

  it('should exert gravitational influence on planets when a black hole is created', () => {
    physicsEngine.initSun();
    const p1 = physicsEngine.spawnPlanet('terrestrial');
    const bh = physicsEngine.spawnBlackHole();

    // Place black hole close to planet to exert strong gravitational tug
    bh.position.set(p1.position.x + 3.0, 0, p1.position.z);

    const initialRadius = Math.hypot(p1.position.x, p1.position.z);

    for (let i = 0; i < 10; i++) {
      physicsEngine.update(0.05);
    }

    const currentRadius = Math.hypot(p1.position.x, p1.position.z);
    // Black hole's gravity must have exerted influence, perturbing the circular orbit
    expect(currentRadius).not.toBeCloseTo(initialRadius, 3);
  });

  it('should keep the central Sun firmly anchored at (0, 0, 0) even with a massive black hole', () => {
    const sun = physicsEngine.initSun();
    const bh = physicsEngine.spawnBlackHole();
    bh.position.set(10, 0, 0);

    for (let i = 0; i < 15; i++) {
      physicsEngine.update(0.05);
    }

    expect(sun.position.x).toBe(0);
    expect(sun.position.y).toBe(0);
    expect(sun.position.z).toBe(0);
  });
});
