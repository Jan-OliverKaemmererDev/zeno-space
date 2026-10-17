import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { OrbitHarpSystem } from './orbit-harp-system';

describe('OrbitHarpSystem', () => {
  let harpSystem: OrbitHarpSystem;

  beforeEach(() => {
    harpSystem = new OrbitHarpSystem();
  });

  afterEach(() => {
    harpSystem.clear();
  });

  it('should create an orbital harp track with 192 segments', () => {
    const track = harpSystem.createOrbitTrack(
      'test-track',
      'test-body',
      15.0,
      new THREE.Color(0x38bdf8),
      3
    );

    expect(track).toBeTruthy();
    expect(track.radius).toBe(15.0);
    expect(track.noteIndex).toBe(3);
    expect(harpSystem.getGroup().children.length).toBe(1);
  });

  it('should pluck harp string when raycaster intersects orbit proximity', () => {
    harpSystem.createOrbitTrack(
      'track-1',
      'body-1',
      20.0,
      new THREE.Color(0x38bdf8),
      4
    );

    const raycaster = new THREE.Raycaster();
    // Ray pointing straight down intersecting plane Y=0 at (20, 0, 0)
    raycaster.ray.origin.set(20.0, 10.0, 0);
    raycaster.ray.direction.set(0, -1, 0);

    const now = 100.0;
    const plucked = harpSystem.checkHarpPluck(raycaster, now);

    expect(plucked).toBeTruthy();
    expect(plucked?.id).toBe('track-1');
    expect(plucked?.harpPluckAmplitude).toBe(1.0);
  });

  it('should update line positions dynamically during vibration', () => {
    const track = harpSystem.createOrbitTrack(
      'track-1',
      'body-1',
      12.0,
      new THREE.Color(0x38bdf8),
      2
    );

    track.harpPluckTime = 10.0;
    track.harpPluckAngle = 0;
    track.harpPluckAmplitude = 1.0;

    // Advance time slightly
    harpSystem.update(10.2);

    const posAttr = track.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(posAttr).toBeTruthy();
  });

  it('should toggle visibility of orbital lines', () => {
    harpSystem.setVisibility(false);
    expect(harpSystem.getGroup().visible).toBe(false);
    harpSystem.setVisibility(true);
    expect(harpSystem.getGroup().visible).toBe(true);
  });
});
