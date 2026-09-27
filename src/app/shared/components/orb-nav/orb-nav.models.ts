import * as THREE from 'three';

/**
 * Represents a navigational section anchor item.
 */
export interface NavSection {
  /** Unique section anchor ID. */
  id: string;
  /** Localized display label. */
  label: string;
}

/**
 * Visual spark particle emitted when clicking an orb.
 */
export interface OrbClickSpark {
  /** Unique identifier for the spark particle. */
  id: number;
  /** Index of the orb that spawned the spark. */
  orbIndex: number;
  /** Origin X coordinate relative to orb center. */
  startX: number;
  /** Origin Y coordinate relative to orb center. */
  startY: number;
  /** Destination X coordinate after dispersal. */
  endX: number;
  /** Destination Y coordinate after dispersal. */
  endY: number;
  /** CSS hex color string for spark rendering. */
  color: string;
  /** Particle size in pixels. */
  size: number;
}

/**
 * Character data for wave-animated tooltip text.
 */
export interface TooltipLetter {
  /** The letter character to display. */
  char: string;
  /** Stagger distance index counted from the right. */
  fromRight: number;
}

/**
 * Internal state and WebGL mesh references for an individual particle sphere.
 */
export interface ParticleOrbData {
  group: THREE.Group;
  tumbleGroup: THREE.Group;
  pointsMesh: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  earthSpinSpeed: number;
  clickSpinSpeed: number;
  baseY: number;
  floatSpeed: number;
  floatPhase: number;
  basePositions: Float32Array;
  currentPositions: Float32Array;
  velocities: Float32Array;
  hasDisplaced: boolean;
}
