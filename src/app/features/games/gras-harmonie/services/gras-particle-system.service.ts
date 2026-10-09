import { Injectable } from '@angular/core';
import * as THREE from 'three';
import {
  WindParticle,
  DirectionalWave,
  GustWave,
} from '../models/gras-harmonie.models';

export interface ParticleUpdateOptions {
  tornadoActive: boolean;
  tornadoStrength: number;
  targetX: number;
  targetZ: number;
  currentWindSpeed: number;
  currentNightWeight: number;
  dirWaves: DirectionalWave[];
  gustWaves: GustWave[];
}

/**
 * Service managing ambient night fireflies and swirling interactive tornado particles.
 */
@Injectable()
export class GrasParticleSystemService {
  readonly ambientParticleCount = 180;
  readonly tornadoParticleCount = 140;
  readonly particleCount = 320;

  private particles: WindParticle[] = [];
  private particlePoints!: THREE.Points;
  private particlePositions!: Float32Array;
  private particleColors!: Float32Array;
  private tornadoSpawnTimer = 0.0;
  private getTerrainHeight!: (x: number, z: number) => number;

  /**
   * Initializes particle state and Three.js Points mesh.
   */
  init(
    scene: THREE.Scene,
    getTerrainHeight: (x: number, z: number) => number
  ): void {
    this.getTerrainHeight = getTerrainHeight;
    this.particles = [];
    this.particlePositions = new Float32Array(this.particleCount * 3);
    this.particleColors = new Float32Array(this.particleCount * 3);

    // 1. Ambient meadow firefly particles (180, active and visible ONLY at night)
    for (let i = 0; i < this.ambientParticleCount; i++) {
      const z = 18.0 - Math.random() * 52.0;
      const halfSpan = 28.0 + (18.0 - z) * 1.8;
      const x = (Math.random() - 0.5) * (halfSpan * 2.0);
      const groundY = this.getTerrainHeight(x, z);
      const y = groundY + 0.35 + Math.random() * 0.75;

      const colRand = Math.random();
      let cr = 0.82,
        cg = 0.98,
        cb = 0.28;
      if (colRand < 0.45) {
        cr = 0.82;
        cg = 0.98;
        cb = 0.28;
      } else if (colRand < 0.75) {
        cr = 0.98;
        cg = 0.92;
        cb = 0.35;
      } else {
        cr = 0.5;
        cg = 1.0;
        cb = 0.48;
      }

      this.particles.push({
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        baseY: y,
        baseX: x,
        baseZ: z,
        wanderPhase: Math.random() * Math.PI * 2,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 1.6 + Math.random() * 2.2,
        swirlPhase: Math.random() * Math.PI * 2,
        isAirborne: false,
        isTornadoVortex: false,
        funnelHeight: 0,
        swirlAngle: 0,
        radiusOffset: 0,
        speedMultiplier: 1.0,
        colorR: cr,
        colorG: cg,
        colorB: cb,
        alpha: 0.0,
        isSettling: false,
      });

      this.particlePositions[i * 3] = x;
      this.particlePositions[i * 3 + 1] = y;
      this.particlePositions[i * 3 + 2] = z;

      this.particleColors[i * 3] = 0;
      this.particleColors[i * 3 + 1] = 0;
      this.particleColors[i * 3 + 2] = 0;
    }

    // 2. Dedicated Tornado Whirlwind particles (140)
    for (let i = 0; i < this.tornadoParticleCount; i++) {
      const idx = this.ambientParticleCount + i;
      const colRand = Math.random();
      let cr = 1.0,
        cg = 1.0,
        cb = 1.0;
      if (colRand < 0.45) {
        cr = 1.0;
        cg = 0.94;
        cb = 0.45;
      } else if (colRand < 0.75) {
        cr = 0.58;
        cg = 0.98;
        cb = 0.48;
      } else if (colRand < 0.88) {
        cr = 1.0;
        cg = 1.0;
        cb = 1.0;
      } else {
        cr = 0.98;
        cg = 0.7;
        cb = 0.78;
      }

      const initialAngle = Math.random() * Math.PI * 2;
      const radiusOffset = (Math.random() - 0.5) * 0.45;
      const speedMult = 0.85 + Math.random() * 0.35;

      this.particles.push({
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        baseY: 0,
        baseX: 0,
        baseZ: 0,
        wanderPhase: 0,
        pulsePhase: 0,
        pulseSpeed: 1.0,
        swirlPhase: Math.random() * Math.PI * 2,
        isAirborne: false,
        isTornadoVortex: true,
        funnelHeight: 0,
        swirlAngle: initialAngle,
        radiusOffset,
        speedMultiplier: speedMult,
        colorR: cr,
        colorG: cg,
        colorB: cb,
        alpha: 0.0,
        isSettling: false,
      });

      this.particlePositions[idx * 3] = 0;
      this.particlePositions[idx * 3 + 1] = -999;
      this.particlePositions[idx * 3 + 2] = 0;

      this.particleColors[idx * 3] = 0;
      this.particleColors[idx * 3 + 1] = 0;
      this.particleColors[idx * 3 + 2] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.particlePositions, 3)
    );
    geo.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));

    // Circular soft glow point texture procedurally
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 64;
    pCanvas.height = 64;
    const pCtx = pCanvas.getContext('2d');
    if (pCtx && typeof pCtx.createRadialGradient === 'function') {
      const radGrad = pCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
      radGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      radGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.95)');
      radGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.5)');
      radGrad.addColorStop(0.85, 'rgba(255, 255, 255, 0.15)');
      radGrad.addColorStop(1.0, 'transparent');
      pCtx.fillStyle = radGrad;
      pCtx.fillRect(0, 0, 64, 64);
    }

    const pointTexture = new THREE.CanvasTexture(pCanvas);

    const mat = new THREE.PointsMaterial({
      size: 0.15,
      map: pointTexture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.95,
    });

    this.particlePoints = new THREE.Points(geo, mat);
    this.particlePoints.frustumCulled = false;
    scene.add(this.particlePoints);
  }

  /**
   * Updates particle dynamics and attribute buffers.
   */
  update(delta: number, elapsed: number, options: ParticleUpdateOptions): void {
    if (!this.particlePoints) return;

    const {
      tornadoActive,
      tornadoStrength,
      targetX,
      targetZ,
      currentWindSpeed,
      currentNightWeight,
      dirWaves,
      gustWaves,
    } = options;

    const centerGroundY = this.getTerrainHeight(targetX, targetZ);
    const fireflyVisibility = currentNightWeight;

    // 1. Update Ambient Firefly Particles
    for (let i = 0; i < this.ambientParticleCount; i++) {
      const p = this.particles[i];
      const dx = p.x - targetX;
      const dz = p.z - targetZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Suction into the tornado if near the center
      if (tornadoActive && dist < 8.0) {
        const tForce = (1.0 - dist / 8.0) * tornadoStrength;
        const spinX = -dz / (dist + 0.12);
        const spinZ = dx / (dist + 0.12);
        const pullX = -dx / (dist + 0.12);
        const pullZ = -dz / (dist + 0.12);
        p.vx += (spinX * 14.0 + pullX * 4.5) * tForce * delta;
        p.vz += (spinZ * 14.0 + pullZ * 4.5) * tForce * delta;
        p.vy += (7.5 + Math.random() * 5.0) * tForce * delta;
        p.isAirborne = true;
      }

      if (p.isAirborne) {
        const windDrift = currentWindSpeed / 1.8;
        p.vx += 0.85 * windDrift * delta;
        p.vz += 0.52 * windDrift * delta;

        p.swirlPhase += delta * 2.5 * windDrift;
        p.x += (p.vx + Math.sin(p.swirlPhase) * 0.35) * delta;
        p.y += p.vy * delta;
        p.z += (p.vz + Math.cos(p.swirlPhase) * 0.35) * delta;

        p.vx *= 0.94;
        p.vz *= 0.94;
        p.vy -= 1.7 * delta;

        const groundY = this.getTerrainHeight(p.x, p.z) + 0.35;
        if (p.y <= groundY) {
          p.y = groundY;
          p.vy = 0;
          p.isAirborne = false;
          p.baseX = p.x;
          p.baseY = groundY;
          p.baseZ = p.z;
        }
      } else {
        const hoverY =
          p.baseY +
          Math.sin(elapsed * 1.3 + p.wanderPhase) * 0.22 +
          Math.cos(elapsed * 0.85 + i) * 0.12;
        const wanderX =
          p.baseX + Math.sin(elapsed * 0.75 + p.wanderPhase) * 0.4;
        const wanderZ =
          p.baseZ + Math.cos(elapsed * 0.85 + p.wanderPhase) * 0.4;

        p.x = wanderX;
        p.y = hoverY;
        p.z = wanderZ;

        // Wave crest lift
        for (let wIdx = 0; wIdx < dirWaves.length; wIdx++) {
          const w = dirWaves[wIdx];
          if (w.strength > 0.08) {
            const waveRadius = w.time * w.speed;
            if (waveRadius > 0.8 && waveRadius < w.maxDist) {
              const toPartX = p.x - w.originX;
              const toPartZ = p.z - w.originZ;
              const partDist = Math.sqrt(toPartX * toPartX + toPartZ * toPartZ);
              if (partDist > 0.2) {
                const forwardProj =
                  (toPartX * w.dirX + toPartZ * w.dirZ) / partDist;
                if (forwardProj > -0.35) {
                  const distDiff = partDist - waveRadius;
                  if (distDiff > -6.0 && distDiff < 2.8) {
                    const waveFactor =
                      distDiff >= 0
                        ? (1.0 - distDiff / 2.8) *
                          w.strength *
                          Math.max(forwardProj + 0.35, 0.2)
                        : Math.pow(1.0 + distDiff / 6.0, 1.8) *
                          w.strength *
                          Math.max(forwardProj + 0.35, 0.2);
                    const pushX = (w.dirX + toPartX / partDist) * 0.5;
                    const pushZ = (w.dirZ + toPartZ / partDist) * 0.5;
                    p.vy += (1.4 + Math.random() * 2.0) * waveFactor;
                    p.vx += pushX * 3.5 * waveFactor;
                    p.vz += pushZ * 3.5 * waveFactor;
                    p.isAirborne = true;
                    break;
                  }
                }
              }
            }
          }
        }

        // Gust wave lift
        for (let gIdx = 0; gIdx < gustWaves.length; gIdx++) {
          const g = gustWaves[gIdx];
          if (g.strength > 0.05) {
            const waveFrontDist = g.time * g.speed;
            if (waveFrontDist > 0.5 && waveFrontDist < g.maxDist) {
              const toPartX = p.x - g.originX;
              const toPartZ = p.z - g.originZ;
              const travelDist = toPartX * g.dirX + toPartZ * g.dirZ;
              const deltaR = Math.abs(travelDist - waveFrontDist);
              if (deltaR < g.width * 0.6) {
                const waveFactor =
                  (1.0 - deltaR / (g.width * 0.6)) * g.strength;
                p.vy += (2.2 + Math.random() * 2.5) * waveFactor;
                p.vx +=
                  (g.dirX * 3.8 + (Math.random() - 0.5) * 1.5) * waveFactor;
                p.vz +=
                  (g.dirZ * 3.8 + (Math.random() - 0.5) * 1.5) * waveFactor;
                p.isAirborne = true;
                break;
              }
            }
          }
        }
      }

      // Recycle ambient particles
      if (p.x > 35 || p.x < -35 || p.z > 18 || p.z < -42) {
        p.x = (Math.random() - 0.5) * 50.0;
        p.z = 14.0 - Math.random() * 40.0;
        p.baseX = p.x;
        p.baseZ = p.z;
        p.baseY = this.getTerrainHeight(p.x, p.z) + 0.35 + Math.random() * 0.6;
        p.y = p.baseY;
        p.vx = 0;
        p.vy = 0;
        p.vz = 0;
        p.isAirborne = false;
      }

      this.particlePositions[i * 3] = p.x;
      this.particlePositions[i * 3 + 1] = p.y;
      this.particlePositions[i * 3 + 2] = p.z;

      if (fireflyVisibility > 0.001) {
        const pulse = Math.pow(
          Math.sin(elapsed * p.pulseSpeed + p.pulsePhase) * 0.5 + 0.5,
          2.4
        );
        const glow = (0.08 + pulse * 0.92) * fireflyVisibility;
        p.alpha = glow;

        this.particleColors[i * 3] = p.colorR * p.alpha * 0.65;
        this.particleColors[i * 3 + 1] = p.colorG * p.alpha * 0.65;
        this.particleColors[i * 3 + 2] = p.colorB * p.alpha * 0.65;
      } else {
        p.alpha = 0.0;
        this.particleColors[i * 3] = 0.0;
        this.particleColors[i * 3 + 1] = 0.0;
        this.particleColors[i * 3 + 2] = 0.0;
      }
    }

    // 2. Staggered Liftoff for Tornado Particles
    if (tornadoActive) {
      this.tornadoSpawnTimer += delta;
      const spawnInterval = 0.024;
      while (this.tornadoSpawnTimer >= spawnInterval) {
        this.tornadoSpawnTimer -= spawnInterval;

        let candidate: WindParticle | undefined;
        for (let i = this.ambientParticleCount; i < this.particleCount; i++) {
          const pt = this.particles[i];
          if (!pt.isAirborne && !pt.isSettling) {
            candidate = pt;
            break;
          }
        }
        if (!candidate) {
          for (let i = this.ambientParticleCount; i < this.particleCount; i++) {
            const pt = this.particles[i];
            if (pt.isSettling && pt.alpha < 0.25) {
              candidate = pt;
              break;
            }
          }
        }

        if (candidate) {
          candidate.isAirborne = true;
          candidate.isSettling = false;
          candidate.funnelHeight = 0.02 + Math.random() * 0.16;
          candidate.swirlAngle = Math.random() * Math.PI * 2;
          candidate.radiusOffset = (Math.random() - 0.5) * 0.45;
          candidate.speedMultiplier = 0.85 + Math.random() * 0.35;
          candidate.alpha = 0.0;
        }
      }
    }

    // 3. Update Tornado Funnel Particles
    for (let i = this.ambientParticleCount; i < this.particleCount; i++) {
      const p = this.particles[i];

      if (tornadoActive && p.isAirborne && !p.isSettling) {
        const normH = Math.min(1.0, Math.max(0.0, p.funnelHeight / 17.5));
        const climbSpeed =
          (1.2 + Math.pow(normH, 1.8) * 13.8) *
          tornadoStrength *
          p.speedMultiplier;
        p.funnelHeight += climbSpeed * delta;

        const spinSpeed =
          (5.5 + Math.pow(normH, 1.4) * 19.5) *
          tornadoStrength *
          p.speedMultiplier;
        p.swirlAngle += spinSpeed * delta;

        const funnelRadius = 0.45 + Math.pow(normH, 1.25) * 3.4 + p.radiusOffset;
        const axisSway = normH * 0.75;
        const axisX =
          targetX +
          Math.sin(elapsed * 3.2 + p.funnelHeight * 0.35) * axisSway;
        const axisZ =
          targetZ +
          Math.cos(elapsed * 2.7 + p.funnelHeight * 0.35) * axisSway;

        p.x = axisX + Math.cos(p.swirlAngle) * funnelRadius;
        p.z = axisZ + Math.sin(p.swirlAngle) * funnelRadius;
        p.y = centerGroundY + p.funnelHeight;

        const fadeIn = Math.min(1.0, p.funnelHeight / 0.85);
        const fadeOut = Math.max(0.0, (17.5 - p.funnelHeight) / 2.5);
        p.alpha = Math.min(fadeIn, fadeOut) * tornadoStrength;

        if (p.funnelHeight >= 17.5) {
          p.funnelHeight = 0.02 + Math.random() * 0.16;
          p.swirlAngle = Math.random() * Math.PI * 2;
          p.radiusOffset = (Math.random() - 0.5) * 0.45;
          p.alpha = 0.0;
        }

        this.particlePositions[i * 3] = p.x;
        this.particlePositions[i * 3 + 1] = p.y;
        this.particlePositions[i * 3 + 2] = p.z;

        this.particleColors[i * 3] = p.colorR * p.alpha;
        this.particleColors[i * 3 + 1] = p.colorG * p.alpha;
        this.particleColors[i * 3 + 2] = p.colorB * p.alpha;
      } else if (p.isSettling) {
        p.vy = Math.max(-0.95, p.vy - 1.1 * delta);
        p.vx *= 0.96;
        p.vz *= 0.96;

        p.swirlPhase += delta * 2.2;
        const flutter = Math.sin(p.swirlPhase + p.y * 2.2) * 0.22 * delta;
        p.x += (p.vx + flutter) * delta;
        p.y += p.vy * delta;
        p.z += (p.vz + flutter) * delta;

        p.alpha = Math.max(0.0, p.alpha - 0.38 * delta);

        const groundY = this.getTerrainHeight(p.x, p.z) + 0.12;
        if (p.y <= groundY) {
          p.y = groundY;
          p.vy = 0;
          p.vx *= 0.75;
          p.vz *= 0.75;
          p.alpha = Math.max(0.0, p.alpha - 1.6 * delta);
        }

        if (p.alpha <= 0.01) {
          p.y = -999;
          p.isAirborne = false;
          p.isSettling = false;
          p.alpha = 0.0;
        }

        this.particlePositions[i * 3] = p.x;
        this.particlePositions[i * 3 + 1] = p.y;
        this.particlePositions[i * 3 + 2] = p.z;

        this.particleColors[i * 3] = p.colorR * p.alpha;
        this.particleColors[i * 3 + 1] = p.colorG * p.alpha;
        this.particleColors[i * 3 + 2] = p.colorB * p.alpha;
      } else {
        if (p.isAirborne && !tornadoActive) {
          p.isSettling = true;
          const swirlTangX = -Math.sin(p.swirlAngle) * 0.9;
          const swirlTangZ = Math.cos(p.swirlAngle) * 0.9;
          p.vx = swirlTangX + (Math.random() - 0.5) * 0.3;
          p.vz = swirlTangZ + (Math.random() - 0.5) * 0.3;
          p.vy = -0.25 - Math.random() * 0.35;
        } else {
          this.particlePositions[i * 3 + 1] = -999;
          this.particleColors[i * 3] = 0;
          this.particleColors[i * 3 + 1] = 0;
          this.particleColors[i * 3 + 2] = 0;
        }
      }
    }

    this.particlePoints.geometry.attributes['position'].needsUpdate = true;
    this.particlePoints.geometry.attributes['color'].needsUpdate = true;
  }

  /**
   * Stirs pollen in the forward fan of a directional wave.
   */
  stirInForwardFan(
    originX: number,
    originZ: number,
    dirX: number,
    dirZ: number,
    strength: number
  ): void {
    if (!this.particlePoints) return;

    for (let i = 0; i < this.ambientParticleCount; i++) {
      const p = this.particles[i];
      const dx = p.x - originX;
      const dz = p.z - originZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.1 && dist < 5.8) {
        const forwardProj = (dx * dirX + dz * dirZ) / dist;
        if (forwardProj > -0.3) {
          const fanForce =
            (1.0 - dist / 5.8) * strength * Math.max(forwardProj + 0.3, 0.2);
          p.vy += (1.6 + Math.random() * 2.4) * fanForce;
          const pushX = (dirX + dx / dist) * 0.5;
          const pushZ = (dirZ + dz / dist) * 0.5;
          p.vx += pushX * 4.5 * fanForce;
          p.vz += pushZ * 4.5 * fanForce;
          p.isAirborne = true;
        }
      }
    }
  }

  /**
   * Outward puff on shockwave click.
   */
  stirInShockwave(x: number, z: number): void {
    if (!this.particlePoints) return;

    for (let i = 0; i < this.ambientParticleCount; i++) {
      const p = this.particles[i];
      const dx = p.x - x;
      const dz = p.z - z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 6.5) {
        p.vy += (2.2 + Math.random() * 2.8) * (1.0 - dist / 6.5);
        p.vx += (dx / (dist + 0.01)) * 3.5;
        p.vz += (dz / (dist + 0.01)) * 3.5;
        p.isAirborne = true;
      }
    }
  }

  /**
   * Lifts foreground particles on monumental wind gust.
   */
  stirInGust(dirX: number, dirZ: number): void {
    if (!this.particlePoints) return;

    for (let i = 0; i < this.ambientParticleCount; i++) {
      const p = this.particles[i];
      if (p.z > 8.0 && Math.random() < 0.6) {
        p.vy += 2.0 + Math.random() * 2.2;
        p.vx += (dirX * 3.2 + (Math.random() - 0.5)) * 1.5;
        p.vz += (dirZ * 3.2 + (Math.random() - 0.5)) * 1.5;
        p.isAirborne = true;
      }
    }
  }

  /**
   * Sets airborne tornado particles into settling mode.
   */
  startTornadoSettling(): void {
    for (let i = this.ambientParticleCount; i < this.particleCount; i++) {
      const p = this.particles[i];
      if (p.isAirborne && p.y > -900 && !p.isSettling) {
        p.isSettling = true;
        const swirlTangX = -Math.sin(p.swirlAngle) * 0.9;
        const swirlTangZ = Math.cos(p.swirlAngle) * 0.9;
        p.vx = swirlTangX + (Math.random() - 0.5) * 0.3;
        p.vz = swirlTangZ + (Math.random() - 0.5) * 0.3;
        p.vy = -0.25 - Math.random() * 0.35;
      }
    }
  }

  dispose(): void {
    if (this.particlePoints) {
      this.particlePoints.geometry.dispose();
      (this.particlePoints.material as THREE.Material).dispose();
    }
  }
}
