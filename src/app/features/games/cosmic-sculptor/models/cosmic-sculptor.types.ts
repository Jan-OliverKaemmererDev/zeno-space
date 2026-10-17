import * as THREE from 'three';

/**
 * High-level classification of celestial bodies in the cosmic simulation.
 */
export type CelestialBodyType = 'sun' | 'planet' | 'black-hole';

/**
 * Realistic planetary subtypes based on astronomical classifications.
 */
export type PlanetSubtype =
  | 'terrestrial'
  | 'gas-giant'
  | 'ice-giant'
  | 'desert'
  | 'volcanic';

/**
 * Comprehensive physics, rendering, and lifecycle state of a celestial body.
 */
export interface CelestialBody {
  /** Unique identifier for tracking and collision resolution. */
  id: string;
  /** Primary body classification. */
  type: CelestialBodyType;
  /** Human-readable scientific name (e.g. Kepler-452b, Zephyros). */
  name: string;
  /** Subtype classification for realistic planet rendering. */
  subtype?: PlanetSubtype;
  /** Three.js mesh for the solid core or event horizon. */
  mesh: THREE.Mesh;
  /** Optional secondary mesh for atmospheric cloud layers (rotates at differential speed). */
  cloudsMesh?: THREE.Mesh;
  /** Optional mesh or particle system for realistic planetary rings (e.g. Saturnian rings). */
  ringsMesh?: THREE.Object3D;
  /** Optional glowing corona or accretion disk object. */
  glowMesh?: THREE.Object3D;
  /** Optional camera-facing radiant solar corona sprite. */
  coronaSprite?: THREE.Sprite;
  /** Optional rotating solar starburst rays sprite. */
  solarRaysSprite?: THREE.Sprite;
  /** Optional soft, slender expanding solar light pulse sprites. */
  solarPulseSprites?: THREE.Sprite[];
  /** Gravitational mass in simulation units. */
  mass: number;
  /** Physical radius in 3D units. */
  radius: number;
  /** Current 3D position vector in world space. */
  position: THREE.Vector3;
  /** Current 3D velocity vector for N-body Verlet integration. */
  velocity: THREE.Vector3;
  /** Base dominant color of the body. */
  color: THREE.Color;
  /** Axial self-rotation speed in radians per second. */
  rotationSpeed: number;
  /** Identifier of the corresponding orbital harp track. */
  orbitTrackId: string;
  /** Fixed circular orbit radius when undisturbed by a black hole. */
  orbitRadius?: number;
  /** Current angular coordinate in radians along the circular orbit. */
  orbitalAngle?: number;
}

/**
 * State and geometry representation of an orbital harp string.
 * Vibrates dynamically upon cursor hover without affecting the celestial body's trajectory.
 */
export interface OrbitTrack {
  /** Unique identifier corresponding to the celestial body. */
  id: string;
  /** Identifier of the associated body. */
  bodyId: string;
  /** The Three.js line object rendering the thin orbital path. */
  line: THREE.LineLoop;
  /** The BufferGeometry containing vertex positions. */
  geometry: THREE.BufferGeometry;
  /** Fixed base unperturbed Keplerian ellipse vertices (192 points). */
  basePositions: Float32Array;
  /** Dynamic displaced vertices reflecting harp string vibration. */
  currentPositions: Float32Array;
  /** Semi-major radius of the orbit. */
  radius: number;
  /** Normal vector defining the orbital plane. */
  normal: THREE.Vector3;
  /** Color of the orbital harp line. */
  color: THREE.Color;
  /** Timestamp when the harp string was last plucked by cursor hover. */
  harpPluckTime: number;
  /** Angle in radians where the pluck occurred. */
  harpPluckAngle: number;
  /** Current vibration amplitude (decays exponentially). */
  harpPluckAmplitude: number;
  /** Resonant musical frequency of the string (higher for tight orbits, deeper for distant orbits). */
  frequency: number;
  /** Note index within the active melody sequence. */
  noteIndex: number;
  /** Exact pitch frequency (Hz) for the melody note (e.g. Interstellar theme). */
  noteFrequency: number;
  /** Whether the cursor is currently hovering over this orbit line. */
  isHovered: boolean;
  /** Timestamp when sound was last triggered for this track to enforce clean cooldowns. */
  lastPluckTime?: number;
}

/**
 * Expanding energy ring spawned when two celestial bodies collide or merge.
 */
export interface CollisionShockwave {
  /** Three.js mesh representing the glowing expanding shockwave ring. */
  mesh: THREE.Mesh;
  /** World position of the collision epicenter. */
  position: THREE.Vector3;
  /** Simulation timestamp when the shockwave originated. */
  startTime: number;
  /** Total duration in seconds before fading away completely. */
  duration: number;
  /** Maximum expansion radius. */
  maxRadius: number;
  /** Primary glow color of the shockwave. */
  color: THREE.Color;
}

/**
 * Sparkling burst of stardust sparks ejected upon planetary collision or black hole tidal disruption.
 */
export interface StardustBurst {
  /** Three.js Points object rendering the explosion stardust. */
  points: THREE.Points;
  /** Velocity vectors for each spark particle. */
  velocities: Float32Array;
  /** Simulation timestamp of origin. */
  birthTime: number;
  /** Particle lifetime in seconds. */
  lifetime: number;
}

/**
 * Real-time telemetry summary displayed in the cosmic HUD and info bubble.
 */
export interface CosmicSimulationStats {
  /** Count of active orbiting planets. */
  planetCount: number;
  /** Count of active black hole singularities. */
  blackHoleCount: number;
  /** Total cumulative collisions and mergers observed. */
  collisionCount: number;
  /** Simulation speed multiplier (0.5x, 1x, 2x). */
  timeSpeed: number;
  /** Whether orbital harp string lines are visible. */
  orbitStringsVisible: boolean;
}
