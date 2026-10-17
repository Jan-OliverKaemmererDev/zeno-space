import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
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

  it('should initialize the central Sun with solar mass, radiant corona and soft pulse wavefronts', () => {
    const sun = physicsEngine.initSun();
    expect(sun).toBeTruthy();
    expect(sun.type).toBe('sun');
    expect(sun.mass).toBe(physicsEngine.sunMass);
    expect(sun.coronaSprite).toBeTruthy();
    expect(sun.solarPulseSprites?.length).toBe(3);
    expect(physicsEngine.getBodies().length).toBe(1);
  });

  it('should spawn planets on non-intersecting orbits far enough from the Sun with dense particle rings for gas giants', () => {
    physicsEngine.initSun();
    const p1 = physicsEngine.spawnPlanet('terrestrial');
    const p2 = physicsEngine.spawnPlanet('gas-giant');

    const r1 = Math.hypot(p1.position.x, p1.position.z);
    const r2 = Math.hypot(p2.position.x, p2.position.z);

    // Minimum orbit radius is >= 24.0 (dignified distance from the glowing Sun)
    expect(r1).toBeGreaterThanOrEqual(24.0);
    expect(Math.abs(r1 - r2)).toBeGreaterThanOrEqual(5.0);
    expect(physicsEngine.getPlanetCount()).toBe(2);

    // Gas giant rings must be composed of small particles (THREE.Points with 10,000 dense points)
    expect(p2.ringsMesh).toBeInstanceOf(THREE.Points);
    const ringPoints = p2.ringsMesh as THREE.Points;
    const posAttr = ringPoints.geometry.getAttribute('position');
    expect(posAttr.count).toBe(10000);
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

  it('should keep black hole firmly stationary at its placed position and not create an orbit track', () => {
    physicsEngine.initSun();
    const placedPos = new THREE.Vector3(35, 0, 20);
    const bh = physicsEngine.spawnBlackHole(placedPos);

    expect(bh.velocity.x).toBe(0);
    expect(bh.velocity.y).toBe(0);
    expect(bh.velocity.z).toBe(0);
    expect(bh.orbitTrackId).toBe('');

    for (let i = 0; i < 20; i++) {
      physicsEngine.update(0.1);
    }

    expect(bh.position.x).toBe(35);
    expect(bh.position.y).toBe(0);
    expect(bh.position.z).toBe(20);
  });

  it('should attract multiple black holes toward each other and merge them on collision into a larger, more massive black hole', () => {
    physicsEngine.initSun();
    const bh1 = physicsEngine.spawnBlackHole(new THREE.Vector3(20, 0, 0));
    const bh2 = physicsEngine.spawnBlackHole(new THREE.Vector3(26, 0, 0));

    expect(physicsEngine.getBlackHoleCount()).toBe(2);

    const initialDistance = bh1.position.distanceTo(bh2.position);

    // Step physics to verify mutual gravitational attraction
    physicsEngine.update(0.1);
    const midDistance = bh1.position.distanceTo(bh2.position);
    expect(midDistance).toBeLessThan(initialDistance);
    expect(bh1.velocity.x).toBeGreaterThan(0);
    expect(bh2.velocity.x).toBeLessThan(0);

    // Step physics until they collide and merge
    for (let i = 0; i < 60; i++) {
      physicsEngine.update(0.1);
    }

    expect(physicsEngine.getBlackHoleCount()).toBe(1);
    const remaining = physicsEngine.getBodies().find((b) => b.type === 'black-hole')!;
    expect(remaining).toBeDefined();
    expect(remaining.mass).toBe(2400);
    expect(remaining.radius).toBeGreaterThan(1.8);
    expect(remaining.mesh.scale.x).toBeGreaterThan(1.0);
  });
});
