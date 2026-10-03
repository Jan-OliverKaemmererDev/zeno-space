import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
  signal,
  computed,
  HostListener,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AudioService } from '../../../core/services/audio.service';
import { BubbleToolSpeechBubbleComponent } from './components/bubble-tool-speech-bubble/bubble-tool-speech-bubble.component';
import { BubbleToolId, BUBBLE_TOOLS } from './models/bubble-tool.model';

/** Rainbow palette for micro-sparks on bubble hover, covering all 7 spectrum colors plus luminous white. */
const RAINBOW_SPARK_COLORS = [
  '#ff4444', // Red
  '#ff9436', // Orange
  '#ffea3b', // Yellow
  '#4ade80', // Green
  '#38bdf8', // Cyan
  '#6366f1', // Blue / Indigo
  '#c084fc', // Violet / Purple
  '#ffffff', // Luminous White Spark
];

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
 * Visual particle ejected when a bubble pops or emits rainbow sparks.
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
  /** Whether this particle is a shining micro-spark from the prism tool. */
  isRainbowSpark?: boolean;
  /** Remaining frames of lifetime. */
  life?: number;
  /** Maximum frames of lifetime for progress calculation. */
  maxLife?: number;
}

/**
 * Interactive bubble harmony minigame featuring floating iridescent soap bubbles with harmonic audio feedback.
 */
@Component({
  selector: 'app-bubble-harmony',
  imports: [RouterLink, BubbleToolSpeechBubbleComponent],
  templateUrl: './bubble-harmony.component.html',
  styleUrl: './bubble-harmony.component.scss',
})
export class BubbleHarmonyComponent implements AfterViewInit, OnDestroy {
  /** Reference to the full-viewport HTML5 2D canvas. */
  @ViewChild('canvasRef') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

  /** Currently selected interactive tool (null by default). */
  readonly activeTool = signal<BubbleToolId | null>(null);

  /** Whether the tool selection speech bubble is open. */
  readonly showToolBubble = signal<boolean>(false);

  /** Whether the balloon deflate closing animation is active. */
  readonly closingToolBubble = signal<boolean>(false);
  private toolBubbleTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Display label of the currently active tool. */
  readonly activeToolLabel = computed(() => {
    const tool = BUBBLE_TOOLS.find((t) => t.id === this.activeTool());
    return tool ? tool.label : '';
  });

  /** Dynamic interaction hint displayed in the bottom capsule. */
  readonly activeToolHint = computed(() => {
    switch (this.activeTool()) {
      case 'fan':
        return 'Maus in Nähe führen zum Wegpusten (Ventilator)';
      case 'magnet':
        return 'Maus bewegen zum Anziehen & Kreisen (Magnet)';
      case 'prism':
        return 'Über Blasen fahren für bunte Regenbogen-Funken';
      case 'chime':
        return 'Blasen berühren für Theremin-Klang & Schwingung';
      default:
        return 'Klicke eine Blase zum Platzen & Hören';
    }
  });

  /**
   * Closes the minigame or open tool bubble on Escape key press.
   *
   * @returns {void}
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showToolBubble()) {
      this.closeToolBubble();
      return;
    }
    this.router.navigate(['/'], { fragment: 'bubble-hub' });
  }

  /**
   * Closes the tool speech bubble when clicking outside the tool pill wrapper.
   */
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.showToolBubble() || this.closingToolBubble()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.tool-pill-wrapper')) return;
    this.closeToolBubble();
  }

  /**
   * Spawns an animated cluster of bubbles upon pressing Spacebar.
   */
  @HostListener('document:keydown.space', ['$event'])
  onSpace(event: Event): void {
    event.preventDefault();
    this.spawnBubbleCluster();
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
  private mousePos: { x: number; y: number } | null = null;
  private breezePhase = 0;
  private lastWindSoundTime = 0;
  private lastPrismSoundTime = 0;
  private lastResonanceMap = new Map<Bubble, number>();

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
    if (this.toolBubbleTimeout) {
      clearTimeout(this.toolBubbleTimeout);
    }
    window.removeEventListener('resize', this.onResize);
  }

  /**
   * Toggles the tool selection speech bubble.
   *
   * @param {Event} [event] - The trigger event.
   */
  toggleToolBubble(event?: Event): void {
    event?.stopPropagation();
    if (this.showToolBubble()) {
      this.closeToolBubble();
    } else {
      this.openToolBubble();
    }
  }

  /**
   * Opens the tool selection speech bubble with audio feedback.
   */
  openToolBubble(): void {
    if (this.toolBubbleTimeout) {
      clearTimeout(this.toolBubbleTimeout);
      this.toolBubbleTimeout = null;
    }
    this.closingToolBubble.set(false);
    this.showToolBubble.set(true);
    this.audioService.playWaterdropToneOn(0.4);
  }

  /**
   * Closes the tool speech bubble with a smooth deflate animation.
   */
  closeToolBubble(): void {
    if (!this.showToolBubble() || this.closingToolBubble()) return;
    this.closingToolBubble.set(true);
    if (this.toolBubbleTimeout) {
      clearTimeout(this.toolBubbleTimeout);
    }
    this.toolBubbleTimeout = setTimeout(() => {
      this.showToolBubble.set(false);
      this.closingToolBubble.set(false);
      this.toolBubbleTimeout = null;
    }, 320);
  }

  /**
   * Handles user selection of a tool from the speech bubble.
   *
   * @param {BubbleToolId} toolId - Selected tool identifier.
   */
  onSelectTool(toolId: BubbleToolId | null): void {
    this.activeTool.set(toolId);
    this.audioService.playWaterdropToneOn(0.5);
    this.closeToolBubble();
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
    window.addEventListener('resize', this.onResize, { passive: true });
  }

  /**
   * Window resize handler updating canvas dimensions to match viewport.
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
      const speed = 1.2 + Math.random() * 3.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.5 + Math.random() * 2.5,
        alpha: 0.9,
        color: `hsla(${hue + (Math.random() * 30 - 15)}, 90%, 75%, 0.8)`,
      });
    }
  }

  /**
   * Spawns radiant micro-pixel sparks shooting outward from the bubble's perimeter on hover,
   * modeled directly after the orb-cursor hold sparks, featuring all spectrum colors of the rainbow.
   *
   * @param {Bubble} b - The hovered soap bubble.
   */
  private spawnBubbleRainbowSparks(b: Bubble): void {
    const count = 4 + Math.floor(Math.random() * 4);
    for (let k = 0; k < count; k++) {
      const color = RAINBOW_SPARK_COLORS[Math.floor(Math.random() * RAINBOW_SPARK_COLORS.length)];
      const angle = Math.random() * Math.PI * 2;
      const startDist = b.radius + (Math.random() - 0.5) * 3;
      const speed = 2.0 + Math.random() * 3.6;
      const maxLife = 24 + Math.floor(Math.random() * 16);

      this.particles.push({
        x: b.x + Math.cos(angle) * startDist,
        y: b.y + Math.sin(angle) * startDist,
        vx: Math.cos(angle) * speed + b.vx * 0.3,
        vy: Math.sin(angle) * speed + b.vy * 0.3,
        radius: Math.random() < 0.5 ? 2.0 : 1.5,
        alpha: 1,
        color,
        isRainbowSpark: true,
        life: maxLife,
        maxLife,
      });
    }
  }

  /**
   * Throttled audio player for magical rainbow chime sparkles.
   */
  private triggerPrismAudio(): void {
    const now = Date.now();
    if (now - this.lastPrismSoundTime > 240) {
      this.lastPrismSoundTime = now;
      this.audioService.playChime(6 + Math.floor(Math.random() * 4), 0.16);
    }
  }

  /**
   * Spawns an ascending cluster of multiple bubbles from the bottom of the screen.
   *
   * @returns {void}
   */
  spawnBubbleCluster(): void {
    const count = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
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
    this.mousePos = pos;

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
   * Handles pointer motion to grow an actively inflated bubble while holding down, and updates pointer coordinates.
   *
   * @param {MouseEvent | TouchEvent} e - Mouse move or touch move event.
   * @returns {void}
   */
  onPointerMove(e: MouseEvent | TouchEvent): void {
    const pos = this.getEventPos(e);
    this.mousePos = pos;

    if (!this.isMouseDown || !this.growCurrentBubble) return;
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
   * Clears mouse position when cursor leaves canvas.
   */
  onPointerLeave(): void {
    this.mousePos = null;
    this.onPointerUp();
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
   * Throttled audio player for wind gust repulsion chimes.
   */
  private triggerWindAudio(): void {
    const now = Date.now();
    if (now - this.lastWindSoundTime > 350) {
      this.lastWindSoundTime = now;
      this.audioService.playBubbleHover();
    }
  }

  /**
   * Triggers a resonant harmonic bell when interacting with the chime resonator tool.
   *
   * @param {Bubble} b - The vibrating bubble.
   * @param {number} index - Index of the bubble.
   */
  private triggerResonance(b: Bubble, index: number): void {
    const now = Date.now();
    const last = this.lastResonanceMap.get(b) || 0;
    if (now - last > 500) {
      this.lastResonanceMap.set(b, now);
      this.audioService.playChime(index % 10, 0.22);
      b.wobblePhase += 0.4;
      b.radius = Math.min(b.radius + 1.2, 70);
    }
  }

  /**
   * Main animation loop updating physics and rendering bubbles, particles, and active tool effects.
   *
   * @returns {void}
   */
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    const { width, height } = this.canvasRef.nativeElement;

    this.ctx.clearRect(0, 0, width, height);

    const tool = this.activeTool();
    const mouse = this.mousePos;

    // Update & draw bubbles
    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i];

      // Interactive tool effects
      if (mouse) {
        const dx = b.x - mouse.x;
        const dy = b.y - mouse.y;
        const dist = Math.hypot(dx, dy);

        if (tool === 'fan') {
          // Ventilator tool: Repels bubbles like an aerodynamic air stream
          const fanRadius = 145;
          if (dist < fanRadius && dist > 1) {
            const intensity = 1 - dist / fanRadius;
            const force = intensity * 3.4;
            b.vx += (dx / dist) * force;
            b.vy += (dy / dist) * force;
            b.wobblePhase += intensity * 0.2;
            this.triggerWindAudio();
          }
        } else if (tool === 'magnet') {
          // Magnet tool: Pulls bubbles inward into a swirling orbit
          const magnetRadius = 240;
          if (dist < magnetRadius && dist > 20) {
            const intensity = 1 - dist / magnetRadius;
            const pull = intensity * 1.3;
            const orbit = intensity * 0.8;
            b.vx -= (dx / dist) * pull - (dy / dist) * orbit;
            b.vy -= (dy / dist) * pull + (dx / dist) * orbit;
          }
        } else if (tool === 'prism') {
          // Rainbow Prism: Bubble sprays vibrant rainbow micro-sparks on hover like orb-cursor hold
          if (dist < b.radius + 15) {
            b.hue = (b.hue + 2.5) % 360;
            b.wobbleSpeed = 0.045;
            this.spawnBubbleRainbowSparks(b);
            this.triggerPrismAudio();
          }
        } else if (tool === 'chime') {
          // Soundwave Chime: Induces gentle resonance chime & pulse
          if (dist < b.radius + 25) {
            this.triggerResonance(b, i);
          }
        }
      }

      // Air resistance and subtle upward buoyancy
      b.vx *= 0.985;
      b.vy = b.vy * 0.985 - 0.01;

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

    // Draw tool visual effects on canvas around the mouse
    if (mouse) {
      if (tool === 'fan') {
        this.drawBreezeRipples(mouse.x, mouse.y);
      } else if (tool === 'magnet') {
        this.drawMagnetAura(mouse.x, mouse.y);
      }
    }

    // Update & draw burst & micro-spark particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      if (p.isRainbowSpark && p.life !== undefined && p.maxLife !== undefined) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.93;
        p.vy *= 0.93;
        p.life--;

        const progress = 1 - p.life / p.maxLife;

        let alpha = 1.0;
        if (progress < 0.35) {
          alpha = 1.0 - (progress / 0.35) * 0.08;
        } else if (progress < 0.75) {
          alpha = 0.92 - ((progress - 0.35) / 0.4) * 0.42;
        } else {
          alpha = 0.5 * (1 - (progress - 0.75) / 0.25);
        }

        const scale = 1.1 - progress * 0.7;
        const currentRadius = p.radius * scale;

        if (p.life <= 0 || alpha <= 0.02) {
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        this.ctx.fillStyle = p.color;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 3.5;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, Math.max(0.6, currentRadius), 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        continue;
      }

      // Regular burst particle from popping
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.025;
      p.radius *= 0.96;

      if (p.alpha <= 0 || p.radius <= 0.4) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.fill();
      this.ctx.restore();
    }
  };

  /**
   * Renders swirling air stream breeze ripples around the mouse cursor in Ventilator mode.
   *
   * @param {number} cx - Cursor X coordinate.
   * @param {number} cy - Cursor Y coordinate.
   */
  private drawBreezeRipples(cx: number, cy: number): void {
    const ctx = this.ctx;
    this.breezePhase += 0.06;
    ctx.save();
    ctx.lineWidth = 1.6;
    for (let r = 0; r < 3; r++) {
      const radius = ((this.breezePhase * 30 + r * 40) % 120) + 15;
      const alpha = Math.max(0, 1 - radius / 135) * 0.4;
      ctx.strokeStyle = `rgba(186, 230, 253, ${alpha})`;
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        radius,
        this.breezePhase + r * 2.1,
        this.breezePhase + r * 2.1 + Math.PI * 0.75
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Renders magnetic attraction pulses around the mouse cursor in Magnet mode.
   *
   * @param {number} cx - Cursor X coordinate.
   * @param {number} cy - Cursor Y coordinate.
   */
  private drawMagnetAura(cx: number, cy: number): void {
    const ctx = this.ctx;
    this.breezePhase += 0.04;
    ctx.save();
    const pulse = Math.sin(this.breezePhase * 3) * 5;

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
