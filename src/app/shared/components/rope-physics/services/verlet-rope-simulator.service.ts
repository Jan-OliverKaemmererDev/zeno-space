import { Injectable } from '@angular/core';
import { Rope, RopeConfig, RopePoint, PointerState } from '../rope-physics.models';
import { DEFAULT_ROPE_CONFIGS } from '../rope-physics.constants';

/**
 * Pure Verlet physics engine for hanging ropes, strings, and attached bodies (lanterns, stars).
 * Decoupled from Angular DOM/Zone for high performance and testability.
 */
@Injectable({
  providedIn: 'root',
})
export class VerletRopeSimulatorService {
  /** Gravity constant in design-space px per second². */
  private readonly GRAVITY = 980;

  /** Number of constraint-solving iterations per frame. */
  private readonly CONSTRAINT_ITERATIONS = 5;

  /** Wind perturbation phase for atmospheric ambient swaying. */
  private windPhase = 0;

  /**
   * Initializes rope runtime objects with equidistant particle points.
   */
  initRopes(configs: RopeConfig[] = DEFAULT_ROPE_CONFIGS): Rope[] {
    return configs.map(cfg => {
      const segLen = cfg.length / cfg.segments;
      const points: RopePoint[] = [];
      for (let i = 0; i <= cfg.segments; i++) {
        const y = cfg.anchorY + i * segLen;
        points.push({
          x: cfg.anchorX,
          y,
          oldX: cfg.anchorX,
          oldY: y,
          pinned: i === 0, // Only top particle is pinned to the ceiling/wall anchor
        });
      }
      return {
        ...cfg,
        points,
        bodyAngle: 0,
        bodyAngleVel: 0,
      };
    });
  }

  /**
   * Advances the physical simulation by dt seconds.
   */
  step(ropes: Rope[], dt: number, pointer: PointerState): void {
    this.windPhase += dt * 1.35; // Calming, organic ambient breeze rhythm

    for (const rope of ropes) {
      this.updateRope(rope, dt, pointer);
    }
  }

  /**
   * Updates one rope: Verlet integration, ambient breeze, mouse interaction,
   * distance constraint solving, and harmonic angular pendulum equilibrium.
   */
  private updateRope(rope: Rope, dt: number, pointer: PointerState): void {
    const gravity = this.GRAVITY * rope.gravityScale * dt * dt;

    // Organic ambient breeze: gentle dual-sine rhythm with spatial phase shift
    const phase1 = this.windPhase + rope.anchorX * 0.006;
    const phase2 = this.windPhase * 0.6 + rope.anchorX * 0.003 + 1.2;
    const breeze = Math.sin(phase1) * 0.75 + Math.sin(phase2) * 0.25;
    // Scale slightly for longer ropes so all items sway with a harmonious ~1.8px amplitude
    const lengthScale = Math.min(1.0, 90 / rope.length);
    const baseWind = breeze * 0.006 * lengthScale;

    for (let i = 1; i < rope.points.length; i++) {
      const point = rope.points[i];
      if (point.pinned) continue;

      // Verlet step: newPos = 2*pos - oldPos + accel*dt²
      const vx = (point.x - point.oldX) * rope.damping;
      const vy = (point.y - point.oldY) * rope.damping;

      point.oldX = point.x;
      point.oldY = point.y;

      // Leverage: wind has stronger effect lower along the rope
      const pointFraction = i / rope.points.length;
      const windAtPoint = baseWind * pointFraction;

      point.x += vx + windAtPoint;
      point.y += vy + gravity;
    }

    // Mouse velocity & proximity force
    if (pointer.inside) {
      this.applyMouseForce(rope, pointer);
    }

    // Constraint solving (Verlet distance preservation)
    for (let iter = 0; iter < this.CONSTRAINT_ITERATIONS; iter++) {
      this.solveConstraints(rope);
    }

    // Pendulum equilibrium angle: aligns with the suspension line from anchor to lastPoint
    const lastPoint = rope.points[rope.points.length - 1];
    const pendDx = lastPoint.x - rope.anchorX;
    const targetDeg = -(pendDx / Math.max(40, rope.length)) * (180 / Math.PI) * 0.65;

    // Harmonic spring tracking the pendulum equilibrium with natural rotational damping
    const angleSpring = 0.08;
    const angleDamping = 0.92;
    rope.bodyAngleVel = (rope.bodyAngleVel + (targetDeg - rope.bodyAngle) * angleSpring) * angleDamping;
    rope.bodyAngle += rope.bodyAngleVel;
  }

  /**
   * Applies mouse interaction forces: Zone 1 body silhouette and Zone 2 rope segment leverage.
   */
  private applyMouseForce(rope: Rope, pointer: PointerState): void {
    const speed = Math.hypot(pointer.vx, pointer.vy);
    if (speed < 10) return;

    // Harmonious speed factor curve: gentle sway at slow speeds, clear natural swing at high speeds
    const speedFactor = Math.min(speed / 500, 1.25);
    const lastIdx = rope.points.length - 1;
    const lastPoint = rope.points[lastIdx];

    // --- Zone 1: Body interaction (lantern / star hanging below the last particle) ---
    const bodyTop = lastPoint.y;
    const bodyBottom = lastPoint.y + rope.bodyHeight;

    // Strict vertical check: mouse must be vertically within the body
    if (pointer.y >= bodyTop && pointer.y <= bodyBottom) {
      const u = (pointer.y - bodyTop) / (rope.bodyHeight || 60);

      // Visual centerline of the body taking current swing tilt into account
      const bodyAxisX = lastPoint.x - (u * rope.bodyHeight) * Math.sin((rope.bodyAngle * Math.PI) / 180);
      const dx = Math.abs(pointer.x - bodyAxisX);

      // Natural tapered silhouette (lanterns are wider in upper-mid, narrower at bottom tip)
      const taper = 0.70 + 0.30 * (1 - u);
      const halfW = (rope.bodyWidth * 0.5) * taper;

      // Only trigger if mouse actually touches within the visible body silhouette
      if (dx <= halfW) {
        const normDist = dx / halfW;
        const smoothWeight = 1 - normDist * normDist;

        // Controlled, natural swing impulse (calm and atmospheric)
        const bodySpeedFactor = Math.min(speed / 300, 1.4);
        const pushStrength = bodySpeedFactor * smoothWeight * rope.reactivity * 2.4;
        const maxBodyStep = 2.8;
        const pushX = Math.max(-maxBodyStep, Math.min(maxBodyStep, (pointer.vx / speed) * pushStrength));
        const pushY = Math.max(-maxBodyStep * 0.25, Math.min(maxBodyStep * 0.25, (pointer.vy / speed) * pushStrength * 0.25));

        // Physical lever factor for top pivot displacement:
        // u = 0.0 (top)    => factor = +1.0 (top moves in push direction)
        // u = 0.5 (middle) => factor =  0.0 (top does NOT move in push direction)
        // u = 1.0 (bottom) => factor = -1.0 (top moves in OPPOSITE direction, recoil)
        const topFactor = 1.0 - 2.0 * u;

        // 1. Gentle instantaneous displacement of top pivot (recoil when hitting bottom)
        lastPoint.x += pushX * topFactor * 0.22;
        lastPoint.y += pushY * 0.2;

        // 2. Calm angular torque impulse on the body (negative angle swings bottom to right)
        const torqueImpulse = -pushX * u * 1.2;
        rope.bodyAngleVel += torqueImpulse * 0.4;
        rope.bodyAngle += torqueImpulse * 0.2;

        // 3. Impart gentle forward pendulum momentum
        for (let i = 1; i <= lastIdx; i++) {
          const leverage = i / lastIdx;
          rope.points[i].oldX -= pushX * leverage * 0.25;
        }
        return; // Body interaction takes priority – skip rope segment interaction
      }
    }

    // --- Zone 2: Rope segment interaction (upper & middle particles only) ---
    const ropeInteractionEnd = Math.max(2, lastIdx - 2);

    for (let i = 1; i <= ropeInteractionEnd; i++) {
      const point = rope.points[i];
      if (point.pinned) continue;

      const dx = point.x - pointer.x;
      const dy = point.y - pointer.y;
      const dist = Math.hypot(dx, dy);

      if (dist < rope.influenceRadius && dist > 0.1) {
        const normDist = dist / rope.influenceRadius;
        const falloff = 1 - normDist * normDist;
        const smoothWeight = falloff * falloff;

        // Mechanical leverage: points further down react moderately more
        const leverage = 0.45 + 0.55 * (i / rope.points.length);

        let pushX = (pointer.vx / speed) * speedFactor * smoothWeight * leverage * rope.reactivity * 1.1;
        let pushY = (pointer.vy / speed) * speedFactor * smoothWeight * leverage * rope.reactivity * 0.35;

        // Mild soft repulsion
        const repulse = smoothWeight * leverage * rope.reactivity * 0.3;
        const repulseX = (dx / dist) * repulse;
        const repulseY = (dy / dist) * repulse;

        const maxStep = 2.2;
        pushX = Math.max(-maxStep, Math.min(maxStep, pushX + repulseX));
        pushY = Math.max(-maxStep, Math.min(maxStep, pushY + repulseY));

        point.x += pushX;
        point.y += pushY;
      }
    }
  }

  /**
   * Solves distance constraints between adjacent particles along the rope.
   */
  private solveConstraints(rope: Rope): void {
    const segLen = rope.length / rope.segments;

    for (let i = 0; i < rope.points.length - 1; i++) {
      const p1 = rope.points[i];
      const p2 = rope.points[i + 1];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.0001) continue;

      const diff = (dist - segLen) / dist;

      if (p1.pinned && p2.pinned) continue;

      if (p1.pinned) {
        p2.x -= dx * diff;
        p2.y -= dy * diff;
      } else if (p2.pinned) {
        p1.x += dx * diff;
        p1.y += dy * diff;
      } else {
        const halfDiff = diff * 0.5;
        p1.x += dx * halfDiff;
        p1.y += dy * halfDiff;
        p2.x -= dx * halfDiff;
        p2.y -= dy * halfDiff;
      }
    }
  }
}
