import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AudioService } from '../../../core/services/audio.service';

interface Bubble {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  color: string;
  hue: number;
  wobbleSpeed: number;
  wobblePhase: number;
  alpha: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
}

@Component({
  selector: 'app-bubble-harmony',
  imports: [RouterLink],
  templateUrl: './bubble-harmony.component.html',
  styleUrl: './bubble-harmony.component.scss',
})
export class BubbleHarmonyComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasRef') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly audioService = inject(AudioService);

  readonly bubbleCount = signal<number>(0);
  readonly chainReaction = signal<boolean>(true);
  readonly poppedTotal = signal<number>(0);

  private ctx!: CanvasRenderingContext2D;
  private bubbles: Bubble[] = [];
  private particles: Particle[] = [];
  private animationId: number | null = null;
  private isMouseDown = false;
  private growCurrentBubble: Bubble | null = null;

  ngAfterViewInit(): void {
    this.initCanvas();
    this.spawnInitialBubbles();
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this.onResize);
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.onResize();
    window.addEventListener('resize', this.onResize);
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

  toggleChain(): void {
    this.chainReaction.update((c) => !c);
    this.audioService.playChime(4, 0.15);
  }

  // Pointer Interactions
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

  onPointerMove(e: MouseEvent | TouchEvent): void {
    if (!this.isMouseDown || !this.growCurrentBubble) return;
    const pos = this.getEventPos(e);
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

  private getEventPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
    if ('touches' in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    const me = e as MouseEvent;
    return { x: me.clientX, y: me.clientY };
  }

  // Render Loop
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
