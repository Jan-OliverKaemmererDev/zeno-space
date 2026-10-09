import { Injectable } from '@angular/core';
import * as THREE from 'three';
import {
  DirectionalWave,
  Shockwave,
  GustWave,
} from '../models/gras-harmonie.models';

/**
 * Service managing concurrent directional waves, click shockwaves,
 * and monumental gust waves across the grass prairie.
 */
@Injectable()
export class GrasWaveManagerService {
  readonly maxDirWaves = 24;
  readonly maxShockwaves = 5;
  readonly maxGustWaves = 3;

  readonly dirWaves: DirectionalWave[] = Array.from({ length: 24 }, () => ({
    originX: 0,
    originZ: 0,
    dirX: 0,
    dirZ: 1,
    time: 99.0,
    strength: 0.0,
    speed: 18.0,
    maxDist: 95.0,
  }));
  private nextDirWaveIndex = 0;

  readonly dirWaveUniformsA = Array.from(
    { length: 24 },
    () => new THREE.Vector4(0, 0, 0, 1)
  );
  readonly dirWaveUniformsB = Array.from(
    { length: 24 },
    () => new THREE.Vector4(99, 0, 18.0, 95.0)
  );

  readonly shockwaves: Shockwave[] = Array.from({ length: 5 }, () => ({
    x: 0,
    z: 0,
    time: 99.0,
    strength: 0.0,
  }));
  private nextShockwaveIndex = 0;

  readonly shockwaveUniforms = Array.from(
    { length: 5 },
    () => new THREE.Vector4(0, 0, 99.0, 0.0)
  );

  readonly gustWaves: GustWave[] = Array.from({ length: 3 }, () => ({
    time: 99.0,
    strength: 0.0,
    speed: 28.0,
    width: 22.0,
    dirX: 0.12,
    dirZ: -0.99,
    originX: 0.0,
    originZ: 24.0,
    maxDist: 125.0,
  }));
  private nextGustWaveIndex = 0;

  readonly gustWaveUniformsA = Array.from(
    { length: 3 },
    () => new THREE.Vector4(99.0, 0.0, 28.0, 22.0)
  );
  readonly gustWaveUniformsB = Array.from(
    { length: 3 },
    () => new THREE.Vector4(0.12, -0.99, 0.0, 24.0)
  );

  /**
   * Updates wave lifetimes and syncs shader uniforms.
   */
  update(delta: number): {
    maxActiveGustStrength: number;
    primaryGust?: GustWave;
  } {
    // 1. Update Directional Waves
    for (let i = 0; i < this.maxDirWaves; i++) {
      const w = this.dirWaves[i];
      if (w.strength > 0.005) {
        w.time += delta;
        if (w.time * w.speed > w.maxDist + 22.0) {
          w.strength = 0.0;
        }
      }
      this.dirWaveUniformsA[i].set(w.originX, w.originZ, w.dirX, w.dirZ);
      this.dirWaveUniformsB[i].set(w.time, w.strength, w.speed, w.maxDist);
    }

    // 2. Update Gust Waves
    let maxActiveGustStrength = 0.0;
    let primaryGust: GustWave | undefined;

    for (let i = 0; i < this.maxGustWaves; i++) {
      const g = this.gustWaves[i];
      if (g.strength > 0.005) {
        g.time += delta;
        const currentDist = g.time * g.speed;
        if (currentDist > g.maxDist + 5.0) {
          g.strength = 0.0;
        } else {
          maxActiveGustStrength = Math.max(maxActiveGustStrength, g.strength);
          if (!primaryGust) {
            primaryGust = g;
          }
        }
      }
      this.gustWaveUniformsA[i].set(g.time, g.strength, g.speed, g.width);
      this.gustWaveUniformsB[i].set(g.dirX, g.dirZ, g.originX, g.originZ);
    }

    // 3. Update Shockwaves
    for (let i = 0; i < this.maxShockwaves; i++) {
      const sw = this.shockwaves[i];
      if (sw.strength > 0.001) {
        sw.time += delta;
        sw.strength = Math.max(0, sw.strength - delta * 0.75);
      }
      this.shockwaveUniforms[i].set(sw.x, sw.z, sw.time, sw.strength);
    }

    return { maxActiveGustStrength, primaryGust };
  }

  /**
   * Spawns an independent directional wave rolling forward.
   */
  spawnDirectionalWave(
    originX: number,
    originZ: number,
    dirX: number,
    dirZ: number,
    intensity: number
  ): DirectionalWave {
    const wave = this.dirWaves[this.nextDirWaveIndex];
    wave.originX = originX;
    wave.originZ = originZ;
    wave.dirX = dirX;
    wave.dirZ = dirZ;
    wave.time = 0.0;
    wave.strength = Math.min(Math.max(intensity * 0.55, 0.2), 0.8);
    wave.speed = 18.0 + Math.min(intensity * 3.0, 4.0);
    wave.maxDist = 95.0;

    this.nextDirWaveIndex = (this.nextDirWaveIndex + 1) % this.maxDirWaves;
    return wave;
  }

  /**
   * Triggers an expanding circular shockwave ripple pushing the grass outwards.
   */
  triggerClickWave(x: number, z: number): Shockwave {
    const sw = this.shockwaves[this.nextShockwaveIndex];
    sw.x = x;
    sw.z = z;
    sw.time = 0.0;
    sw.strength = 1.0;
    this.nextShockwaveIndex = (this.nextShockwaveIndex + 1) % this.maxShockwaves;
    return sw;
  }

  /**
   * Triggers a monumental sweeping wind gust wave across the entire prairie field.
   */
  triggerWindGust(): GustWave {
    const wave = this.gustWaves[this.nextGustWaveIndex];
    wave.time = 0.0;
    wave.strength = 1.35;
    wave.speed = 28.0;
    wave.width = 22.0;

    const angleOffset = (Math.random() - 0.5) * 0.2;
    const baseDir = new THREE.Vector2(0.12, -0.99)
      .rotateAround(new THREE.Vector2(0, 0), angleOffset)
      .normalize();

    wave.dirX = baseDir.x;
    wave.dirZ = baseDir.y;
    wave.originX = (Math.random() - 0.5) * 10.0;
    wave.originZ = 24.0;
    wave.maxDist = 125.0;

    this.nextGustWaveIndex = (this.nextGustWaveIndex + 1) % this.maxGustWaves;
    return wave;
  }
}
