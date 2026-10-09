import * as THREE from 'three';
import { TimeOfDay } from '../utils/sky-cloud-generator';

export type { TimeOfDay };
export type WindPreset = 'gentle' | 'fresh' | 'gust';

/**
 * Wind particle interface for prairie pollen / dandelion specks and
 * the swirling anime tornado whirlwind funnel rising into the sky.
 */
export interface WindParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  baseY: number;
  baseX: number; // Rest anchor X for firefly 3D wandering
  baseZ: number; // Rest anchor Z for firefly 3D wandering
  wanderPhase: number; // Individual hovering Lissajous phase
  pulsePhase: number; // Firefly bioluminescence flicker phase
  pulseSpeed: number; // Individual breathing frequency
  swirlPhase: number;
  isAirborne: boolean;
  // Dedicated tornado whirlwind properties
  isTornadoVortex: boolean;
  funnelHeight: number; // Height above terrain inside the tornado (0 to 18m)
  swirlAngle: number; // Rotation angle around the vortex axis
  radiusOffset: number; // Individual radius variation
  speedMultiplier: number; // Upward suction speed variation
  colorR: number;
  colorG: number;
  colorB: number;
  alpha: number; // Opacity / visibility (0.0 to 1.0)
  isSettling: boolean; // True when mouse released: particle drifts gently to ground
}

/**
 * Directional wave rolling across the prairie.
 */
export interface DirectionalWave {
  originX: number;
  originZ: number;
  dirX: number;
  dirZ: number;
  time: number;
  strength: number;
  speed: number;
  maxDist: number;
}

/**
 * Expanding circular shockwave ripple pushing grass outwards on click.
 */
export interface Shockwave {
  x: number;
  z: number;
  time: number;
  strength: number;
}

/**
 * Panoramic wind gust wave rolling across the entire field.
 */
export interface GustWave {
  time: number;
  strength: number;
  speed: number;
  width: number;
  dirX: number;
  dirZ: number;
  originX: number;
  originZ: number;
  maxDist: number;
}
