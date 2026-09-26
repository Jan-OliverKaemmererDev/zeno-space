import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
  signal,
  HostListener,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AudioService } from '../../../core/services/audio.service';

/**
 * Represents a floating soap bubble on the 2D harmony canvas.
 */
interface Bubble {
  /** Current X coordinate on the canvas. */
  x: number;
  /** Current Y coordinate on the canvas. */
  y: number;
  /** Radius of the bubble in pixels. */
  radius: number;
  /** Horizontal velocity component. */
  vx: number;
  /** Vertical velocity component. */
  vy: number;
  /** CSS color string for gradient shading. */
  color: string;
  /** Primary HSL hue angle (0 to 360). */
  hue: number;
  /** Speed factor of surface oscillation wobble. */
  wobbleSpeed: number;
  /** Current phase angle of surface wobble. */
  wobblePhase: number;
  /** Opacity alpha factor. */
  alpha: number;
}

/**
 * Visual particle ejected when a bubble pops.
 */
interface Particle {
  /** Current X coordinate on the canvas. */
  x: number;
  /** Current Y coordinate on the canvas. */
  y: number;
  /** Horizontal velocity component. */
  vx: number;
  /** Vertical velocity component. */
  vy: number;
  /** Particle radius in pixels. */
  radius: number;
  /** Current opacity alpha factor. */
  alpha: number;
  /** CSS color string for rendering. */
  color: string;
}

/**
 * Interactive bubble harmony minigame featuring floating iridescent soap bubbles with harmonic audio feedback.
 */
@Component({
  selector: 'app-bubble-harmony',
  imports: [RouterLink],
  templateUrl: './bubble-harmony.component.html',
  styleUrl: './bubble-harmony.component.scss',
})
export class BubbleHarmonyComponent implements AfterViewInit, OnDestroy {
  /** Reference to the full-viewport HTML5 2D canvas. */
  @ViewChild('canvasRef') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

  /**
   * Closes the minigame and returns to the home page on Escape key press.
   *
   * @returns {void}
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.router.navigate(['/']);
  }

  /** Count of currently floating bubbles on the canvas. */
  readonly bubbleCount = signal<number>(0);
  /** Whether popped bubbles trigger cascading chain reactions in adjacent bubbles. */
  readonly chainReaction = signal<boolean>(true);
  /** Total number of bubbles popped in the current session. */
  readonly poppedTotal = signal<number>(0);

  private ctx!: CanvasRenderingContext2D;
  private bubbles: Bubble[] = [];
  private particles: Particle[] = [];
  private animationId: number | null = null;
  private isMouseDown = false;
  private growCurrentBubble: Bubble | null = null;

  /**
   * Lifecycle hook invoked after view initialization to start canvas setup and animations.
   *
   * @returns {void}
   */
  ngAfterViewInit(): void {
    this.initCanvas();
    this.spawnInitialBubbles();
    this.animate();
  }

  /**
   * Lifecycle hook invoked on destruction to release animation frame handles and event listeners.
   *
   * @returns {void}
   */
  ngOnDestroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this.onResize);
  }

  /**
   * Initializes 2D canvas context and registers window resize listeners.
   *
   * @returns {void}
   */
  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.onResize();
    window.addEventListener('resize', this.onResize);
  }

  /**
   * Resizes canvas buffer dimensions to match the browser window viewport.
   *
   * @returns {void}
   */
  private onResize = (): void => {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };

  /**
   * Spawns an initial peaceful distribution of floating bubbles.
   *
   * @returns {void}
   */
  private spawnInitialBubbles(): void {
    const count = Math.min(Math.floor(window.innerWidth / 90), 16);
    for (let i = 0; i < count; i++) {
      this.createBubble(
        Math.random() * window.innerWidth,
        Math.random() * window.innerHeight,
        25 + Math.random() * 35
      );
    }
  }

  /**
   * Creates a new floating bubble at the specified coordinates.
   *
   * @param {number} x - Horizontal canvas coordinate.
   * @param {number} y - Vertical canvas coordinate.
   * @param {number} [radius=30] - Initial radius of the bubble in pixels.
   * @returns {Bubble} The newly created bubble instance.
   */
  createBubble(x: number, y: number, radius = 30): Bubble {
    const hues = [280, 200, 330, 45, 170]; // Purple, Cyan, Pink, Gold, Teal
    const hue = hues[Math.floor(Math.random() * hues.length)];

    const bubble: Bubble = {
      x,
      y,
      radius,
      vx: (Math.random() - 0.5) * 1.2,
      vy: -0.4 - Math.random() * 0.8, // gentle upward buoyancy
      color: `hsla(${hue}, 85%, 65%, 0.45)`,
      hue,
      wobbleSpeed: 0.03 + Math.random() * 0.03,
      wobblePhase: Math.random() * Math.PI * 2,
      alpha: 0.8,
    };

    this.bubbles.push(bubble);
    this.bubbleCount.set(this.bubbles.length);
    return bubble;
  }

  /**
   * Pops a bubble at the specified array index, generating harmonic audio, burst particles, and potential chain reactions.
   *
   * @param {number} index - Index of the bubble to pop.
   * @param {boolean} [triggerChain=false] - Whether this pop should trigger chain reactions in nearby bubbles.
   * @returns {void}
   */
  popBubble(index: number, triggerChain = false): void {
    if (index < 0 || index >= this.bubbles.length) return;
    const b = this.bubbles[index];

    // Spawn popping burst particles
    this.createBurstParticles(b.x, b.y, b.hue, b.radius);

    // Audio note based on bubble size (larger = deeper, smaller = higher)
    const note = Math.floor(Math.max(0, Math.min(9, 10 - b.radius / 7)));
    this.audioService.playBubblePop(1 + (50 - b.radius) / 60);
    this.audioService.playChime(note, 0.3);

    this.bubbles.splice(index, 1);
    this.bubbleCount.set(this.bubbles.length);
    this.poppedTotal.update((n) => n + 1);

    // Chain reaction
    if (triggerChain && this.chainReaction()) {
      const shockwaveRadius = b.radius * 2.2;
      for (let i = this.bubbles.length - 1; i >= 0; i--) {
        const other = this.bubbles[i];
        const dist = Math.hypot(other.x - b.x, other.y - b.y);
        if (dist < shockwaveRadius) {
          setTimeout(() => {
            this.popBubble(i, false);
          }, 80 + Math.random() * 60);
        }
      }
    }
  }

  /**
   * Spawns burst particles shooting outward in all directions from a popped bubble center.
   *
   * @param {number} x - Center X coordinate.
   * @param {number} y - Center Y coordinate.
   * @param {number} hue - Color hue of the bursting bubble.
   * @param {number} radius - Radius of the bursting bubble.
   * @returns {void}
   */
  private createBurstParticles(x: number, y: number, hue: number, radius: number): void {
    const count = Math.floor(radius / 2.5);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 3,
        alpha: 1,
        color: `hsla(${hue}, 80%, 75%, 0.9)`,
      });
    }
  }

  /**
   * Spawns an animated cluster of bubbles rising from below the viewport.
   *
   * @returns {void}
   */
  spawnBubbleCluster(): void {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        this.createBubble(
          window.innerWidth * 0.2 + Math.random() * window.innerWidth * 0.6,
          window.innerHeight + 40,
          20 + Math.random() * 35
        );
      }, i * 100);
    }
    this.audioService.playBubbleHover();
  }

  /**
   * Sequentially pops all existing bubbles in rapid musical progression.
   *
   * @returns {void}
   */
  popAllSymphony(): void {
    const list = [...this.bubbles];
    list.forEach((_, idx) => {
      setTimeout(() => {
        if (this.bubbles.length > 0) {
          this.popBubble(0, false);
        }
      }, idx * 90);
    });
  }

  /**
   * Toggles whether popping a bubble creates cascading chain reactions.
   *
   * @returns {void}
   */
  toggleChain(): void {
    this.chainReaction.update((c) => !c);
    this.audioService.playChime(4, 0.15);
  }

  /**
   * Handles pointer down events on canvas to either pop an existing bubble or start growing a new one.
   *
   * @param {MouseEvent | TouchEvent} e - Pointer down or touch start event.
   * @returns {void}
   */
  onPointerDown(e: MouseEvent | TouchEvent): void {
    const pos = this.getEventPos(e);
    // Check if clicked an existing bubble
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      const dist = Math.hypot(b.x - pos.x, b.y - pos.y);
      if (dist <= b.radius + 6) {
        this.popBubble(i, true);
        return;
      }
    }

    // Otherwise, start blowing a new bubble
    this.isMouseDown = true;
    this.growCurrentBubble = this.createBubble(pos.x, pos.y, 14);
  }

  /**
   * Handles pointer motion to grow an actively inflated bubble while holding down.
   *
   * @param {MouseEvent | TouchEvent} e - Mouse move or touch move event.
   * @returns {void}
   */
  onPointerMove(e: MouseEvent | TouchEvent): void {
    if (!this.isMouseDown || !this.growCurrentBubble) return;
    const pos = this.getEventPos(e);
    this.growCurrentBubble.x = pos.x;
    this.growCurrentBubble.y = pos.y;
    if (this.growCurrentBubble.radius < 65) {
      this.growCurrentBubble.radius += 0.8;
    }
  }

  /**
   * Handles pointer release to finish inflating and release the active bubble.
   *
   * @returns {void}
   */
  onPointerUp(): void {
    this.isMouseDown = false;
    this.growCurrentBubble = null;
  }

  /**
   * Extracts client coordinates from either a mouse or touch interaction event.
   *
   * @param {MouseEvent | TouchEvent} e - The interaction event.
   * @returns {{ x: number; y: number }} Extracted screen coordinates.
   */
  private getEventPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
    if ('touches' in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    const me = e as MouseEvent;
    return { x: me.clientX, y: me.clientY };
  }

  /**
   * Main animation loop updating physics and rendering bubbles and particles.
   *
   * @returns {void}
   */
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    const { width, height } = this.canvasRef.nativeElement;

    this.ctx.clearRect(0, 0, width, height);

    // Update & draw bubbles
    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i];

      b.wobblePhase += b.wobbleSpeed;
      b.x += b.vx + Math.sin(b.wobblePhase) * 0.4;
      b.y += b.vy;

      // Wrap around or soft float up
      if (b.y + b.radius < -30) {
        b.y = height + b.radius;
        b.x = Math.random() * width;
      }
      if (b.x - b.radius < 0) {
        b.x = b.radius;
        b.vx *= -0.8;
      }
      if (b.x + b.radius > width) {
        b.x = width - b.radius;
        b.vx *= -0.8;
      }

      this.drawSoapBubble(b);
    }

    // Update & draw burst particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.025;
      p.radius *= 0.96;

      if (p.alpha <= 0 || p.radius <= 0.5) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.fill();
      this.ctx.restore();
    }
  };

  /**
   * Renders an iridescent soap bubble with multi-stop radial gradient and specular highlights.
   *
   * @param {Bubble} b - The bubble model to render.
   * @returns {void}
   */
  private drawSoapBubble(b: Bubble): void {
    const ctx = this.ctx;
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
}
