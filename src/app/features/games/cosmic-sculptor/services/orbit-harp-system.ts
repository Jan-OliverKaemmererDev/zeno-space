import * as THREE from 'three';
import { OrbitTrack } from '../models/cosmic-sculptor.types';
import { evaluateHarpDisplacement } from '../utils/cosmic-math';

/**
 * Iconic melody notes and frequencies (Hz) for the Interstellar Theme
 * (Hans Zimmer – Cornfield Chase / First Step / S.T.A.Y.).
 *
 * Moving outward from the Sun traverses these notes in sequential order,
 * producing the instantly recognizable, hauntingly beautiful celestial melody.
 */
export const INTERSTELLAR_THEME_FREQUENCIES: readonly number[] = [
  // --- Phrase 1: The Iconic Ostinato (Cornfield Chase / Main Theme) ---
  329.63, // 0: E4
  440.00, // 1: A4
  493.88, // 2: B4
  523.25, // 3: C5
  493.88, // 4: B4
  440.00, // 5: A4
  329.63, // 6: E4

  // --- Phrase 2: Harmonic Rising Expansion ---
  329.63, // 7: E4
  440.00, // 8: A4
  493.88, // 9: B4
  523.25, // 10: C5
  587.33, // 11: D5
  523.25, // 12: C5
  493.88, // 13: B4

  // --- Phrase 3: Soaring Celestial Arc ---
  659.25, // 14: E5
  587.33, // 15: D5
  523.25, // 16: C5
  493.88, // 17: B4
  523.25, // 18: C5
  493.88, // 19: B4
  440.00, // 20: A4

  // --- Phrase 4: S.T.A.Y. / Day One Resolution ---
  440.00, // 21: A4
  523.25, // 22: C5
  659.25, // 23: E5
  698.46, // 24: F5
  659.25, // 25: E5
  523.25, // 26: C5
  440.00, // 27: A4

  // --- Phrase 5: Transcendent Upper Octave (for vast planetary systems) ---
  659.25, // 28: E5
  880.00, // 29: A5
  987.77, // 30: B5
  1046.50, // 31: C6
  987.77, // 32: B5
  880.00, // 33: A5
  659.25, // 34: E5

  // --- Phrase 6: Upper Octave Rising Climax ---
  659.25, // 35: E5
  880.00, // 36: A5
  987.77, // 37: B5
  1046.50, // 38: C6
  1174.66, // 39: D6
  1046.50, // 40: C6
  987.77, // 41: B5
];

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
    const safeNoteIndex = noteIndex;
    const noteFrequency = INTERSTELLAR_THEME_FREQUENCIES[safeNoteIndex % INTERSTELLAR_THEME_FREQUENCIES.length];

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
      noteIndex: safeNoteIndex,
      noteFrequency,
      isHovered: false,
    };

    this.tracks.set(id, track);
    this.reindexTrackNotes();
    return track;
  }

  /**
   * Sorts all registered planetary orbit tracks strictly from innermost to outermost
   * and assigns the iconic Interstellar theme notes (Hans Zimmer - Cornfield Chase / S.T.A.Y.).
   * Sweeping across the orbits from the central Sun outward plays the instantly recognizable,
   * emotionally resonant melody.
   */
  reindexTrackNotes(): void {
    const sorted = Array.from(this.tracks.values()).sort((a, b) => a.radius - b.radius);
    for (let i = 0; i < sorted.length; i++) {
      sorted[i].noteIndex = i;
      sorted[i].noteFrequency = INTERSTELLAR_THEME_FREQUENCIES[i % INTERSTELLAR_THEME_FREQUENCIES.length];
    }
  }

  /**
   * Resets mouse sweep tracking (e.g. when cursor leaves canvas) to avoid false jump crossings.
   */
  resetPointerTracking(): void {
    this.lastHitDist = null;
    this.lastHitTime = 0;
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
    this.reindexTrackNotes();
  }

  private lastHitDist: number | null = null;
  private lastHitTime = 0;

  /**
   * Raycasts against the orbital plane and detects all orbit strings crossed along the cursor trajectory.
   * Returns a list of plucked tracks ordered in the direction of cursor travel (inner-to-outer or outer-to-inner).
   *
   * @param raycaster Configured Three.js raycaster.
   * @param now Current timestamp in seconds.
   * @returns Array of plucked OrbitTrack instances in sequential melodic order.
   */
  checkHarpPlucks(raycaster: THREE.Raycaster, now: number): OrbitTrack[] {
    if (!this.orbitGroup.visible || this.tracks.size === 0) {
      this.lastHitDist = null;
      return [];
    }

    // Intersect with orbital reference plane (Y = 0)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(plane, hitPoint);

    if (!hit) {
      this.lastHitDist = null;
      return [];
    }

    const hitDist = Math.hypot(hitPoint.x, hitPoint.z);
    const hitAngle = Math.atan2(hitPoint.z, hitPoint.x);

    // Initial mouse entry or after a long pause
    if (this.lastHitDist === null || Math.abs(now - this.lastHitTime) > 0.45) {
      this.lastHitDist = hitDist;
      this.lastHitTime = now;

      let closestTrack: OrbitTrack | null = null;
      let minDelta = 1.35;

      for (const track of this.tracks.values()) {
        const delta = Math.abs(hitDist - track.radius);
        if (delta < minDelta) {
          minDelta = delta;
          closestTrack = track;
        }
      }

      if (closestTrack && (now - (closestTrack.lastPluckTime ?? 0) > 0.18)) {
        closestTrack.harpPluckTime = now;
        closestTrack.harpPluckAngle = hitAngle;
        closestTrack.harpPluckAmplitude = 1.0;
        closestTrack.lastPluckTime = now;
        return [closestTrack];
      }

      return [];
    }

    const prevDist = this.lastHitDist;
    const currDist = hitDist;
    this.lastHitDist = hitDist;
    this.lastHitTime = now;

    // Movement radial interval: dMin to dMax
    const dMin = Math.min(prevDist, currDist);
    const dMax = Math.max(prevDist, currDist);
    const isMovingOutward = currDist >= prevDist;

    const plucked: OrbitTrack[] = [];

    for (const track of this.tracks.values()) {
      // True crossing detection: did the cursor sweep across this orbit between mouse frames?
      const wasCrossed = track.radius >= dMin && track.radius <= dMax;
      const isVeryClose = Math.abs(currDist - track.radius) < 1.35;

      if (wasCrossed || isVeryClose) {
        if (now - (track.lastPluckTime ?? 0) > 0.16) {
          plucked.push(track);
        }
      }
    }

    if (plucked.length === 0) {
      return [];
    }

    // Sort strictly in direction of cursor travel:
    // When moving outward from the Sun: ascending radius -> melody rises into the heavens!
    // When moving inward toward the Sun: descending radius -> melody cascades down
    plucked.sort((a, b) => isMovingOutward ? a.radius - b.radius : b.radius - a.radius);

    for (let i = 0; i < plucked.length; i++) {
      const track = plucked[i];
      track.harpPluckTime = now + (i * 0.035);
      track.harpPluckAngle = hitAngle;
      track.harpPluckAmplitude = 1.0;
      track.lastPluckTime = now;
    }

    return plucked;
  }

  /**
   * Convenience single-track pluck evaluator for backward compatibility.
   */
  checkHarpPluck(raycaster: THREE.Raycaster, now: number): OrbitTrack | null {
    const list = this.checkHarpPlucks(raycaster, now);
    return list.length > 0 ? list[0] : null;
  }

  /**
   * Evaluates dynamic harp string standing waves and updates line vertex buffers.
   *
   * @param now Current timestamp in seconds.
   */
  update(now: number): void {
    for (const track of this.tracks.values()) {
      const elapsed = now - track.harpPluckTime;
      const isVibrating = elapsed >= 0 && elapsed < 3.0;
      const mat = track.line.material as THREE.LineBasicMaterial;

      if (isVibrating && this.orbitGroup.visible) {
        const segments = (track.currentPositions.length / 3) - 1;
        const posAttr = track.geometry.getAttribute('position') as THREE.BufferAttribute;

        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const displacement = evaluateHarpDisplacement(
            theta,
            track.harpPluckAngle,
            elapsed,
            track.frequency,
            1.35
          );

          // Subtle, delicate vertical oscillation perpendicular to orbital plane
          track.currentPositions[i * 3] = track.basePositions[i * 3];
          track.currentPositions[i * 3 + 1] = displacement;
          track.currentPositions[i * 3 + 2] = track.basePositions[i * 3 + 2];
        }

        posAttr.needsUpdate = true;
        // Softly brighten line while ringing and fade back smoothly
        mat.opacity = 0.35 + 0.30 * Math.exp(-elapsed * 1.35) * Math.max(0, 1.0 - elapsed / 3.0);
      } else if (mat.opacity !== 0.35 || track.currentPositions[1] !== 0) {
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
   * Resets all harp string vibrations immediately to the calm resting state.
   */
  resetPlucks(): void {
    this.lastPluckedTrackId = null;
    for (const track of this.tracks.values()) {
      track.harpPluckTime = -999;
      track.isHovered = false;
      const segments = (track.currentPositions.length / 3) - 1;
      const posAttr = track.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i <= segments; i++) {
        track.currentPositions[i * 3] = track.basePositions[i * 3];
        track.currentPositions[i * 3 + 1] = 0;
        track.currentPositions[i * 3 + 2] = track.basePositions[i * 3 + 2];
      }
      posAttr.needsUpdate = true;
      const mat = track.line.material as THREE.LineBasicMaterial;
      mat.opacity = 0.35;
    }
  }

  /**
   * Toggles the visual rendering of all orbital harp lines and stops audio when hidden.
   *
   * @param visible Whether orbit tracks should be visible.
   */
  setVisibility(visible: boolean): void {
    this.orbitGroup.visible = visible;
    if (!visible) {
      this.resetPlucks();
    }
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
    this.reindexTrackNotes();
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
    this.resetPointerTracking();
  }
}
