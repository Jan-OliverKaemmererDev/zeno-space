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
    expect(track.noteIndex).toBe(0);
    expect(track.noteFrequency).toBe(329.63);
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

  it('should toggle visibility of orbital lines and prevent plucking when hidden', () => {
    harpSystem.createOrbitTrack('track-1', 'body-1', 20.0, new THREE.Color(0x38bdf8), 1);
    const raycaster = new THREE.Raycaster();
    raycaster.ray.origin.set(20.0, 10.0, 0);
    raycaster.ray.direction.set(0, -1, 0);

    // Visible: plucking succeeds
    harpSystem.setVisibility(true);
    expect(harpSystem.getGroup().visible).toBe(true);
    expect(harpSystem.checkHarpPluck(raycaster, 10.0)).toBeTruthy();

    // Hidden (turned off by user): plucking returns null, no sound triggered
    harpSystem.setVisibility(false);
    expect(harpSystem.getGroup().visible).toBe(false);
    expect(harpSystem.checkHarpPluck(raycaster, 15.0)).toBeNull();
  });

  it('should reset active vibrations when strings are switched off', () => {
    const track = harpSystem.createOrbitTrack('track-1', 'body-1', 12.0, new THREE.Color(0x38bdf8), 2);
    track.harpPluckTime = 10.0;
    harpSystem.update(10.2);

    harpSystem.setVisibility(false);
    expect(track.harpPluckTime).toBe(-999);
    expect(track.currentPositions[1]).toBe(0);
  });

  it('should detect and pluck all orbits crossed in ascending order when moving outwards from the sun', () => {
    harpSystem.createOrbitTrack('track-3', 'b3', 35.0, new THREE.Color(0x38bdf8), 0);
    harpSystem.createOrbitTrack('track-1', 'b1', 15.0, new THREE.Color(0x38bdf8), 0);
    harpSystem.createOrbitTrack('track-2', 'b2', 25.0, new THREE.Color(0x38bdf8), 0);

    const raycaster = new THREE.Raycaster();

    // First frame: cursor near center (radius 5)
    raycaster.ray.origin.set(5.0, 10.0, 0);
    raycaster.ray.direction.set(0, -1, 0);
    harpSystem.checkHarpPlucks(raycaster, 10.0);

    // Second frame: cursor swept outward across all 3 tracks to radius 40
    raycaster.ray.origin.set(40.0, 10.0, 0);
    const plucked = harpSystem.checkHarpPlucks(raycaster, 10.05);

    expect(plucked.length).toBe(3);
    expect(plucked[0].radius).toBe(15.0);
    expect(plucked[0].noteIndex).toBe(0); // lowest note closest to sun
    expect(plucked[0].noteFrequency).toBe(329.63); // E4
    expect(plucked[1].radius).toBe(25.0);
    expect(plucked[1].noteIndex).toBe(1);
    expect(plucked[1].noteFrequency).toBe(440.00); // A4
    expect(plucked[2].radius).toBe(35.0);
    expect(plucked[2].noteIndex).toBe(2); // highest note outermost
    expect(plucked[2].noteFrequency).toBe(493.88); // B4
  });
});
