import * as THREE from 'three';
import { OrbitTrack } from '../models/cosmic-sculptor.types';
import { evaluateHarpDisplacement } from '../utils/cosmic-math';

/**
 * Manages the thin celestial orbit tracks and implements the interactive harp string hover effect.
 * When the mouse hovers over an orbit line, it resonates like a musical harp string
 * with damped standing wave vibrations, without perturbing the physical trajectory of the planet.
 */
export class OrbitHarpSystem {
  private readonly tracks: Map<string, OrbitTrack> = new Map();
  private readonly orbitGroup = new THREE.Group();
  private lastPluckedTrackId: string | null = null;
  private lastPluckTime = 0;

  constructor() {
    this.orbitGroup.name = 'OrbitHarpSystemGroup';
  }

  /**
   * Returns the Three.js group containing all orbital line meshes.
   */
  getGroup(): THREE.Group {
    return this.orbitGroup;
  }

  /**
   * Creates and registers a new resonant orbital harp track for a celestial body.
   *
   * @param id Unique identifier for the track.
   * @param bodyId Associated celestial body ID.
   * @param radius Orbital semi-major radius.
   * @param baseColor Color tint of the orbital line.
   * @param noteIndex Pentatonic scale note index (0-9).
   * @returns Newly created OrbitTrack.
   */
  createOrbitTrack(
    id: string,
    bodyId: string,
    radius: number,
    baseColor: THREE.Color,
    noteIndex: number
  ): OrbitTrack {
    const segments = 192;
    const basePositions = new Float32Array((segments + 1) * 3);
    const currentPositions = new Float32Array((segments + 1) * 3);

    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;

      basePositions[i * 3] = x;
      basePositions[i * 3 + 1] = 0;
      basePositions[i * 3 + 2] = z;

      currentPositions[i * 3] = x;
      currentPositions[i * 3 + 1] = 0;
      currentPositions[i * 3 + 2] = z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));

    // Refined luminous line material with subtle glow
    const material = new THREE.LineBasicMaterial({
      color: baseColor.clone().lerp(new THREE.Color(0xffffff), 0.35),
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      linewidth: 1,
    });

    const line = new THREE.LineLoop(geometry, material);
    line.frustumCulled = false;
    this.orbitGroup.add(line);

    // Natural musical frequency: tighter inner orbits oscillate faster (higher pitch)
    const frequency = Math.max(2.5, Math.min(9.0, 48.0 / radius));

    const track: OrbitTrack = {
      id,
      bodyId,
      line,
      geometry,
      basePositions,
      currentPositions,
      radius,
      normal: new THREE.Vector3(0, 1, 0),
      color: baseColor,
      harpPluckTime: -999,
      harpPluckAngle: 0,
      harpPluckAmplitude: 0,
      frequency,
      noteIndex,
      isHovered: false,
    };

    this.tracks.set(id, track);
    return track;
  }

  /**
   * Updates base Keplerian positions if an orbit expands or shifts due to N-body gravitation.
   *
   * @param trackId Orbit track identifier.
   * @param currentRadius Current instantaneous orbital radius.
   */
  updateOrbitRadius(trackId: string, currentRadius: number): void {
    const track = this.tracks.get(trackId);
    if (!track) return;

    track.radius = currentRadius;
    const segments = (track.basePositions.length / 3) - 1;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      track.basePositions[i * 3] = Math.cos(theta) * currentRadius;
      track.basePositions[i * 3 + 2] = Math.sin(theta) * currentRadius;
    }
  }

  /**
   * Raycasts against all orbit planes to detect mouse cursor crossings and trigger harp plucks.
   *
   * @param raycaster Configured Three.js raycaster.
   * @param now Current timestamp in seconds.
   * @returns Plucked OrbitTrack instance if a string was newly strummed, or null.
   */
  checkHarpPluck(raycaster: THREE.Raycaster, now: number): OrbitTrack | null {
    // Intersect with orbital reference plane (Y = 0)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(plane, hitPoint);

    if (!hit) return null;

    const hitDist = Math.hypot(hitPoint.x, hitPoint.z);
    const hitAngle = Math.atan2(hitPoint.z, hitPoint.x);

    let closestTrack: OrbitTrack | null = null;
    let minDelta = 0.95; // Pluck proximity tolerance in 3D units

    for (const track of this.tracks.values()) {
      const delta = Math.abs(hitDist - track.radius);
      if (delta < minDelta) {
        minDelta = delta;
        closestTrack = track;
      }
    }

    if (closestTrack) {
      closestTrack.isHovered = true;
      const timeSinceLastPluck = now - this.lastPluckTime;

      // Allow plucking if different track or after brief cooldown
      if (
        (this.lastPluckedTrackId !== closestTrack.id || timeSinceLastPluck > 0.22)
      ) {
        closestTrack.harpPluckTime = now;
        closestTrack.harpPluckAngle = hitAngle;
        closestTrack.harpPluckAmplitude = 1.0;
        this.lastPluckedTrackId = closestTrack.id;
        this.lastPluckTime = now;
        return closestTrack;
      }
    } else {
      if (this.lastPluckedTrackId) {
        const prev = this.tracks.get(this.lastPluckedTrackId);
        if (prev) prev.isHovered = false;
        this.lastPluckedTrackId = null;
      }
    }

    return null;
  }

  /**
   * Evaluates dynamic harp string standing waves and updates line vertex buffers.
   *
   * @param now Current timestamp in seconds.
   */
  update(now: number): void {
    for (const track of this.tracks.values()) {
      const elapsed = now - track.harpPluckTime;
      const isVibrating = elapsed >= 0 && elapsed < 2.6;
      const mat = track.line.material as THREE.LineBasicMaterial;

      if (isVibrating) {
        const segments = (track.currentPositions.length / 3) - 1;
        const posAttr = track.geometry.getAttribute('position') as THREE.BufferAttribute;

        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const displacement = evaluateHarpDisplacement(
            theta,
            track.harpPluckAngle,
            elapsed,
            track.frequency,
            3.2
          );

          // Vertical oscillation perpendicular to orbital plane
          const amp = displacement * 1.6;
          track.currentPositions[i * 3] = track.basePositions[i * 3];
          track.currentPositions[i * 3 + 1] = amp;
          track.currentPositions[i * 3 + 2] = track.basePositions[i * 3 + 2];
        }

        posAttr.needsUpdate = true;
        // Brighten line while ringing
        mat.opacity = 0.85 * Math.exp(-elapsed * 1.8) + 0.32;
      } else if (mat.opacity !== 0.35) {
        // Reset to rest state
        const segments = (track.currentPositions.length / 3) - 1;
        const posAttr = track.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i <= segments; i++) {
          track.currentPositions[i * 3] = track.basePositions[i * 3];
          track.currentPositions[i * 3 + 1] = 0;
          track.currentPositions[i * 3 + 2] = track.basePositions[i * 3 + 2];
        }
        posAttr.needsUpdate = true;
        mat.opacity = 0.35;
      }
    }
  }

  /**
   * Toggles the visual rendering of all orbital harp lines.
   *
   * @param visible Whether orbit tracks should be visible.
   */
  setVisibility(visible: boolean): void {
    this.orbitGroup.visible = visible;
  }

  /**
   * Removes a specific orbit track from the simulation and disposes its WebGL memory.
   *
   * @param id Orbit track identifier.
   */
  removeTrack(id: string): void {
    const track = this.tracks.get(id);
    if (!track) return;

    this.orbitGroup.remove(track.line);
    track.geometry.dispose();
    (track.line.material as THREE.Material).dispose();
    this.tracks.delete(id);
  }

  /**
   * Removes all tracks and cleans up resources.
   */
  clear(): void {
    for (const track of this.tracks.values()) {
      this.orbitGroup.remove(track.line);
      track.geometry.dispose();
      (track.line.material as THREE.Material).dispose();
    }
    this.tracks.clear();
    this.lastPluckedTrackId = null;
  }
}
