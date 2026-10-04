import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  Input,
  output,
  inject,
} from '@angular/core';
import { AudioService } from '../../../../../core/services/audio.service';
import { BubbleCanvasRendererService } from '../../services/bubble-canvas-renderer.service';
import { BubbleToolId } from '../../models/bubble-tool.model';
import { Bubble, Particle, RAINBOW_SPARK_COLORS } from '../../models/bubble.model';

/**
 * Interactive 2D canvas simulation component for Bubble Harmony.
 * Handles soap bubble physics, procedural air stream clusters, audio chimes,
 * tool interaction forces, and visual particle effects.
 */
@Component({
  selector: 'app-bubble-canvas',
  standalone: true,
  templateUrl: './bubble-canvas.component.html',
  styleUrl: './bubble-canvas.component.scss',
})
export class BubbleCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasRef') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly audioService = inject(AudioService);
  private readonly rendererService = inject(BubbleCanvasRendererService);

  /** Currently selected interactive tool (e.g. fan, magnet, prism, chime). */
  @Input() activeTool: BubbleToolId | null = null;

  /** Whether popping a bubble induces a cascading chain reaction in neighbors. */
  @Input() chainReaction = true;

  /** Emitted whenever the active count of floating bubbles changes. */
  readonly bubbleCountChange = output<number>();

  /** Emitted whenever any soap bubble pops. */
  readonly bubblePopped = output<void>();

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
  private lastClusterSide: 'left' | 'right' | 'top' | 'bottom' | null = null;
  private clusterTimeouts: ReturnType<typeof setTimeout>[] = [];

  /**
   * Current number of floating bubbles.
   */
  get bubbleCount(): number {
    return this.bubbles.length;
  }

  ngAfterViewInit(): void {
    this.initCanvas();
    this.spawnInitialBubbles();
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    this.clusterTimeouts.forEach((t) => clearTimeout(t));
    this.clusterTimeouts = [];
    window.removeEventListener('resize', this.onResize);
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.onResize();
    window.addEventListener('resize', this.onResize, { passive: true });
  }

  private onResize = (): void => {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };

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
   * Creates a new floating bubble at the specified coordinates with optional initial velocity.
   *
   * @param {number} x - Horizontal canvas coordinate.
   * @param {number} y - Vertical canvas coordinate.
   * @param {number} [radius=30] - Initial radius of the bubble in pixels.
   * @param {number} [vx] - Initial horizontal velocity.
   * @param {number} [vy] - Initial vertical velocity.
   * @returns {Bubble} The newly created bubble instance.
   */
  createBubble(x: number, y: number, radius = 30, vx?: number, vy?: number): Bubble {
    const hues = [280, 200, 330, 45, 170]; // Purple, Cyan, Pink, Gold, Teal
    const hue = hues[Math.floor(Math.random() * hues.length)];

    const bubble: Bubble = {
      x,
      y,
      radius,
      vx: vx !== undefined ? vx : (Math.random() - 0.5) * 1.2,
      vy: vy !== undefined ? vy : -0.4 - Math.random() * 0.8,
      color: `hsla(${hue}, 85%, 65%, 0.45)`,
      hue,
      wobbleSpeed: 0.03 + Math.random() * 0.03,
      wobblePhase: Math.random() * Math.PI * 2,
      alpha: 0.8,
    };

    this.bubbles.push(bubble);
    this.bubbleCountChange.emit(this.bubbles.length);
    return bubble;
  }

  /**
   * Pops a bubble at the specified array index, generating harmonic audio, burst particles, and potential chain reactions.
   *
   * @param {number} index - Index of the bubble to pop.
   * @param {boolean} [triggerChain=false] - Whether this pop should trigger chain reactions in nearby bubbles.
   */
  popBubble(index: number, triggerChain = false): void {
    if (index < 0 || index >= this.bubbles.length) return;
    const b = this.bubbles[index];

    this.createBurstParticles(b.x, b.y, b.hue, b.radius);

    const note = Math.floor(Math.max(0, Math.min(9, 10 - b.radius / 7)));
    this.audioService.playBubblePop(1 + (50 - b.radius) / 60);
    this.audioService.playChime(note, 0.3);

    this.bubbles.splice(index, 1);
    this.bubbleCountChange.emit(this.bubbles.length);
    this.bubblePopped.emit();

    if (triggerChain && this.chainReaction) {
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

  private triggerPrismAudio(): void {
    const now = Date.now();
    if (now - this.lastPrismSoundTime > 240) {
      this.lastPrismSoundTime = now;
      this.audioService.playChime(6 + Math.floor(Math.random() * 4), 0.16);
    }
  }

  /**
   * Spawns a concentrated stream of bubbles blown in from a randomly selected edge of the screen.
   */
  spawnBubbleCluster(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const sides: Array<'left' | 'right' | 'top' | 'bottom'> = ['left', 'right', 'top', 'bottom'];
    const candidates = sides.filter((s) => s !== this.lastClusterSide);
    const chosenSide = candidates[Math.floor(Math.random() * candidates.length)];
    this.lastClusterSide = chosenSide;

    let originX = 0;
    let originY = 0;
    let targetX = 0;
    let targetY = 0;

    switch (chosenSide) {
      case 'left':
        originX = -25;
        originY = height * (0.2 + Math.random() * 0.6);
        targetX = width * (0.45 + Math.random() * 0.35);
        targetY = height * (0.2 + Math.random() * 0.6);
        break;
      case 'right':
        originX = width + 25;
        originY = height * (0.2 + Math.random() * 0.6);
        targetX = width * (0.2 + Math.random() * 0.35);
        targetY = height * (0.2 + Math.random() * 0.6);
        break;
      case 'top':
        originX = width * (0.2 + Math.random() * 0.6);
        originY = -25;
        targetX = width * (0.2 + Math.random() * 0.6);
        targetY = height * (0.45 + Math.random() * 0.35);
        break;
      case 'bottom':
      default:
        originX = width * (0.2 + Math.random() * 0.6);
        originY = height + 25;
        targetX = width * (0.2 + Math.random() * 0.6);
        targetY = height * (0.2 + Math.random() * 0.35);
        break;
    }

    const baseAngle = Math.atan2(targetY - originY, targetX - originX);
    const perpAngle = baseAngle + Math.PI / 2;
    const count = 9 + Math.floor(Math.random() * 5);

    this.audioService.playBubbleHover();

    for (let i = 0; i < count; i++) {
      const timer = setTimeout(() => {
        const angleSpread = (Math.random() - 0.5) * 0.16;
        const speed = 5.2 + Math.random() * 3.4;
        const bubbleAngle = baseAngle + angleSpread;

        const nozzleJitter = (Math.random() - 0.5) * 16;
        const spawnX = originX + Math.cos(perpAngle) * nozzleJitter;
        const spawnY = originY + Math.sin(perpAngle) * nozzleJitter;

        const vx = Math.cos(bubbleAngle) * speed;
        const vy = Math.sin(bubbleAngle) * speed;
        const radius = i % 3 === 0 ? 30 + Math.random() * 15 : 16 + Math.random() * 14;

        this.createBubble(spawnX, spawnY, radius, vx, vy);

        for (let p = 0; p < 2; p++) {
          const pAngle = baseAngle + (Math.random() - 0.5) * 0.22;
          const pSpeed = speed * (1.1 + Math.random() * 0.4);
          this.particles.push({
            x: spawnX,
            y: spawnY,
            vx: Math.cos(pAngle) * pSpeed,
            vy: Math.sin(pAngle) * pSpeed,
            radius: 1.5 + Math.random() * 1.5,
            alpha: 0.7,
            color: 'rgba(224, 242, 254, 0.85)',
          });
        }

        if (i > 0 && i % 3 === 0) {
          this.audioService.playChime(4 + (i % 4), 0.12);
        }
      }, i * 75);

      this.clusterTimeouts.push(timer);
    }
  }

  /**
   * Sequentially pops all existing bubbles in rapid musical progression.
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

  onPointerDown(e: MouseEvent | TouchEvent): void {
    const pos = this.getEventPos(e);
    this.mousePos = pos;

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      const dist = Math.hypot(b.x - pos.x, b.y - pos.y);
      if (dist <= b.radius + 6) {
        this.popBubble(i, true);
        return;
      }
    }

    this.isMouseDown = true;
    this.growCurrentBubble = this.createBubble(pos.x, pos.y, 14);
  }

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

  onPointerUp(): void {
    this.isMouseDown = false;
    this.growCurrentBubble = null;
  }

  onPointerLeave(): void {
    this.mousePos = null;
    this.onPointerUp();
  }

  private getEventPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
    if ('touches' in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    const me = e as MouseEvent;
    return { x: me.clientX, y: me.clientY };
  }

  private triggerWindAudio(): void {
    const now = Date.now();
    if (now - this.lastWindSoundTime > 350) {
      this.lastWindSoundTime = now;
      this.audioService.playBubbleHover();
    }
  }

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

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    const { width, height } = this.canvasRef.nativeElement;

    this.ctx.clearRect(0, 0, width, height);

    const tool = this.activeTool;
    const mouse = this.mousePos;

    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i];

      if (mouse) {
        const dx = b.x - mouse.x;
        const dy = b.y - mouse.y;
        const dist = Math.hypot(dx, dy);

        if (tool === 'fan') {
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
          const magnetRadius = 240;
          if (dist < magnetRadius && dist > 20) {
            const intensity = 1 - dist / magnetRadius;
            const pull = intensity * 1.3;
            const orbit = intensity * 0.8;
            b.vx -= (dx / dist) * pull - (dy / dist) * orbit;
            b.vy -= (dy / dist) * pull + (dx / dist) * orbit;
          }
        } else if (tool === 'prism') {
          if (dist < b.radius + 15) {
            b.hue = (b.hue + 2.5) % 360;
            b.wobbleSpeed = 0.045;
            this.spawnBubbleRainbowSparks(b);
            this.triggerPrismAudio();
          }
        } else if (tool === 'chime') {
          if (dist < b.radius + 25) {
            this.triggerResonance(b, i);
          }
        }
      }

      b.vx *= 0.985;
      b.vy = b.vy * 0.985 - 0.01;

      b.wobblePhase += b.wobbleSpeed;
      b.x += b.vx + Math.sin(b.wobblePhase) * 0.4;
      b.y += b.vy;

      if (b.y + b.radius < -30 && b.vy < 0) {
        b.y = height + b.radius;
        b.x = Math.random() * width;
      }
      if (b.x - b.radius < 0 && b.vx < 0) {
        b.x = b.radius;
        b.vx *= -0.8;
      }
      if (b.x + b.radius > width && b.vx > 0) {
        b.x = width - b.radius;
        b.vx *= -0.8;
      }
      if (b.y + b.radius > height && b.vy > 0) {
        b.y = height - b.radius;
        b.vy *= -0.6;
      }

      this.rendererService.drawSoapBubble(this.ctx, b);
    }

    if (mouse) {
      if (tool === 'fan') {
        this.rendererService.drawBreezeRipples(this.ctx, mouse.x, mouse.y, (this.breezePhase += 0.06));
      } else if (tool === 'magnet') {
        this.rendererService.drawMagnetAura(this.ctx, mouse.x, mouse.y, (this.breezePhase += 0.04));
      }
    }

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

        this.rendererService.drawRainbowSpark(this.ctx, p, currentRadius, alpha);
        continue;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.025;
      p.radius *= 0.96;

      if (p.alpha <= 0 || p.radius <= 0.4) {
        this.particles.splice(i, 1);
        continue;
      }

      this.rendererService.drawBurstParticle(this.ctx, p);
    }
  };
}
