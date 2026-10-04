import { Injectable } from '@angular/core';
import { Bubble, Particle } from '../models/bubble.model';

/**
 * Service responsible for high-performance canvas 2D rendering operations for Bubble Harmony.
 * Draws iridescent soap bubbles, tool auras (breeze ripples, magnet auras), burst particles,
 * and rainbow sparks.
 */
@Injectable({
  providedIn: 'root',
})
export class BubbleCanvasRendererService {
  /**
   * Renders an individual soap bubble with multi-stop radial gradient shading,
   * glowing iridescent rim, and specular crescent reflection highlight.
   *
   * @param {CanvasRenderingContext2D} ctx - Target 2D rendering context.
   * @param {Bubble} b - Bubble to render.
   */
  drawSoapBubble(ctx: CanvasRenderingContext2D, b: Bubble): void {
    ctx.save();

    // Bubble outer gradient
    const grad = ctx.createRadialGradient(
      b.x - b.radius * 0.3,
      b.y - b.radius * 0.3,
      b.radius * 0.1,
      b.x,
      b.y,
      b.radius
    );
    grad.addColorStop(0, `hsla(${b.hue}, 90%, 95%, 0.7)`);
    grad.addColorStop(0.35, `hsla(${b.hue}, 80%, 70%, 0.25)`);
    grad.addColorStop(0.85, `hsla(${b.hue + 40}, 90%, 65%, 0.4)`);
    grad.addColorStop(1, `hsla(${b.hue}, 95%, 80%, 0.8)`);

    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Iridescent rim
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = `hsla(${b.hue}, 90%, 85%, 0.65)`;
    ctx.stroke();

    // Specular highlight (top left white reflection crescent)
    ctx.beginPath();
    ctx.ellipse(
      b.x - b.radius * 0.38,
      b.y - b.radius * 0.38,
      b.radius * 0.3,
      b.radius * 0.16,
      -Math.PI / 4,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Renders swirling air stream breeze ripples around cursor coordinates in Ventilator mode.
   *
   * @param {CanvasRenderingContext2D} ctx - Target 2D rendering context.
   * @param {number} cx - Cursor X coordinate.
   * @param {number} cy - Cursor Y coordinate.
   * @param {number} breezePhase - Current phase value for smooth rotation and expansion.
   */
  drawBreezeRipples(ctx: CanvasRenderingContext2D, cx: number, cy: number, breezePhase: number): void {
    ctx.save();
    ctx.lineWidth = 1.6;
    for (let r = 0; r < 3; r++) {
      const radius = ((breezePhase * 30 + r * 40) % 120) + 15;
      const alpha = Math.max(0, 1 - radius / 135) * 0.4;
      ctx.strokeStyle = `rgba(186, 230, 253, ${alpha})`;
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        radius,
        breezePhase + r * 2.1,
        breezePhase + r * 2.1 + Math.PI * 0.75
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Renders magnetic attraction pulses around cursor coordinates in Magnet mode.
   *
   * @param {CanvasRenderingContext2D} ctx - Target 2D rendering context.
   * @param {number} cx - Cursor X coordinate.
   * @param {number} cy - Cursor Y coordinate.
   * @param {number} breezePhase - Current oscillation phase for pulsing rings.
   */
  drawMagnetAura(ctx: CanvasRenderingContext2D, cx: number, cy: number, breezePhase: number): void {
    ctx.save();
    const pulse = Math.sin(breezePhase * 3) * 5;

    ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(cx, cy, 38 + pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(192, 132, 252, 0.22)';
    ctx.beginPath();
    ctx.arc(cx, cy, 70 + pulse * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Renders a bursting pop particle.
   *
   * @param {CanvasRenderingContext2D} ctx - Target 2D rendering context.
   * @param {Particle} p - The particle to draw.
   */
  drawBurstParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  }

  /**
   * Renders a luminous rainbow micro-spark particle with bloom glow shadow.
   *
   * @param {CanvasRenderingContext2D} ctx - Target 2D rendering context.
   * @param {Particle} p - The rainbow spark particle.
   * @param {number} currentRadius - Computed animated radius.
   * @param {number} alpha - Computed opacity value.
   */
  drawRainbowSpark(
    ctx: CanvasRenderingContext2D,
    p: Particle,
    currentRadius: number,
    alpha: number
  ): void {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 3.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.6, currentRadius), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
