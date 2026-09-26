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
 * Represents a decorative glowing zen stone placed on the sand canvas.
 */
interface Stone {
  /** Center X coordinate in pixels. */
  x: number;
  /** Center Y coordinate in pixels. */
  y: number;
  /** Radius of the stone in pixels. */
  radius: number;
  /** CSS fill color of the stone. */
  color: string;
  /** CSS box shadow / glow color around the stone. */
  glow: string;
}

/**
 * Expanding water-like sand ripple wave generated upon placing a stone.
 */
interface Ripple {
  /** Center X coordinate in pixels. */
  x: number;
  /** Center Y coordinate in pixels. */
  y: number;
  /** Current expanding radius in pixels. */
  radius: number;
  /** Maximum radius before fading out. */
  maxRadius: number;
  /** Current opacity alpha factor. */
  alpha: number;
}

/**
 * Meditative Japanese Zen sand garden simulator featuring multi-prong rake grooves, smooth stones, and harmonic ripples.
 */
@Component({
  selector: 'app-zen-sand',
  imports: [RouterLink],
  templateUrl: './zen-sand.component.html',
  styleUrl: './zen-sand.component.scss',
})
export class ZenSandComponent implements AfterViewInit, OnDestroy {
  /** Canvas reference for the interactive sand surface. */
  @ViewChild('sandCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

  /**
   * Navigates back to the landing page on Escape key press.
   *
   * @returns {void}
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.router.navigate(['/']);
  }

  /** Count of placed stones currently on the sand canvas. */
  readonly stoneCount = signal<number>(0);
  /** Currently selected user interaction tool ('rake' or 'stone'). */
  readonly currentTool = signal<'rake' | 'stone'>('rake');

  private ctx!: CanvasRenderingContext2D;
  private stones: Stone[] = [];
  private ripples: Ripple[] = [];
  private isDrawing = false;
  private lastPos = { x: 0, y: 0 };
  private animationId: number | null = null;

  /**
   * Lifecycle hook invoked after view initialization to initialize the sand canvas and start rendering.
   *
   * @returns {void}
   */
  ngAfterViewInit(): void {
    this.initCanvas();
    this.render();
  }

  /**
   * Lifecycle hook invoked on destruction to stop animation loop and clean up resize listeners.
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
   * Sets up 2D canvas context, initial window resize listeners, and default stones.
   *
   * @returns {void}
   */
  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.onResize();
    window.addEventListener('resize', this.onResize);
    this.clearSand();

    // Place 2 initial decorative stones
    this.placeStone(canvas.width * 0.35, canvas.height * 0.4, 28, '#a78bfa', 'rgba(167, 139, 250, 0.4)');
    this.placeStone(canvas.width * 0.65, canvas.height * 0.55, 36, '#f472b6', 'rgba(244, 114, 182, 0.4)');
  }

  /**
   * Resizes canvas buffer dimensions to match window dimensions and redraws the base sand gradient.
   *
   * @returns {void}
   */
  private onResize = (): void => {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    this.drawBaseSand();
  };

  /**
   * Renders the deep cosmic background radial gradient representing undisturbed sand.
   *
   * @returns {void}
   */
  private drawBaseSand(): void {
    const { width, height } = this.canvasRef.nativeElement;
    // Warm cosmic zen sand background
    const grad = this.ctx.createRadialGradient(
      width / 2,
      height / 2,
      50,
      width / 2,
      height / 2,
      width * 0.8
    );
    grad.addColorStop(0, '#1c1938');
    grad.addColorStop(0.6, '#131128');
    grad.addColorStop(1, '#090814');

    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, width, height);
  }

  /**
   * Clears all placed stones and sand grooves, restoring pristine smooth sand surface.
   *
   * @returns {void}
   */
  clearSand(): void {
    this.stones = [];
    this.ripples = [];
    this.stoneCount.set(0);
    this.drawBaseSand();
    this.audioService.playBubbleHover();
  }

  /**
   * Switches the active interaction tool between rake and stone placement.
   *
   * @param {'rake' | 'stone'} tool - The desired tool mode.
   * @returns {void}
   */
  setTool(tool: 'rake' | 'stone'): void {
    this.currentTool.set(tool);
    this.audioService.playChime(3, 0.15);
  }

  /**
   * Places a decorative glowing stone at the specified canvas coordinates and triggers a harmonic ripple.
   *
   * @param {number} x - Horizontal canvas coordinate.
   * @param {number} y - Vertical canvas coordinate.
   * @param {number} [radius=24] - Radius of the stone in pixels.
   * @param {string} [color='#cbd5e1'] - Main fill color of the stone.
   * @param {string} [glow='rgba(203, 213, 225, 0.4)'] - Glow shadow color.
   * @returns {void}
   */
  placeStone(x: number, y: number, radius = 24, color = '#cbd5e1', glow = 'rgba(203, 213, 225, 0.4)'): void {
    this.stones.push({ x, y, radius, color, glow });
    this.stoneCount.set(this.stones.length);

    // Ripple
    this.ripples.push({
      x,
      y,
      radius: radius,
      maxRadius: radius + 90,
      alpha: 0.8,
    });

    this.audioService.playChime(Math.floor(Math.random() * 8), 0.3);
  }

  /**
   * Handles pointer down to initiate raking grooves or place a stone at pointer location.
   *
   * @param {MouseEvent | TouchEvent} e - Mouse or touch interaction event.
   * @returns {void}
   */
  onPointerDown(e: MouseEvent | TouchEvent): void {
    const pos = this.getPos(e);
    this.lastPos = pos;
    this.isDrawing = true;

    if (this.currentTool() === 'stone') {
      const colors = ['#a78bfa', '#38bdf8', '#f472b6', '#fb923c', '#e2e8f0'];
      const pick = colors[Math.floor(Math.random() * colors.length)];
      this.placeStone(pos.x, pos.y, 22 + Math.random() * 18, pick, `${pick}66`);
    } else {
      this.drawRakeStroke(pos.x, pos.y, pos.x, pos.y);
      this.audioService.playBubbleHover();
    }
  }

  /**
   * Handles pointer motion to draw multi-pronged rake strokes across the sand surface.
   *
   * @param {MouseEvent | TouchEvent} e - Mouse move or touch move event.
   * @returns {void}
   */
  onPointerMove(e: MouseEvent | TouchEvent): void {
    if (!this.isDrawing) return;
    const pos = this.getPos(e);

    if (this.currentTool() === 'rake') {
      this.drawRakeStroke(this.lastPos.x, this.lastPos.y, pos.x, pos.y);
    }
    this.lastPos = pos;
  }

  /**
   * Handles pointer release to end drawing stroke.
   *
   * @returns {void}
   */
  onPointerUp(): void {
    this.isDrawing = false;
  }

  /**
   * Draws a parallel 5-prong rake stroke with highlighted edges and shadowed contours.
   *
   * @param {number} x1 - Starting X coordinate.
   * @param {number} y1 - Starting Y coordinate.
   * @param {number} x2 - Ending X coordinate.
   * @param {number} y2 - Ending Y coordinate.
   * @returns {void}
   */
  private drawRakeStroke(x1: number, y1: number, x2: number, y2: number): void {
    const ctx = this.ctx;
    ctx.save();
    
    // Multiple prong rake effect
    const prongs = [-12, -6, 0, 6, 12];
    const angle = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;

    for (const p of prongs) {
      const offsetX = Math.cos(angle) * p;
      const offsetY = Math.sin(angle) * p;

      ctx.beginPath();
      ctx.moveTo(x1 + offsetX, y1 + offsetY);
      ctx.lineTo(x2 + offsetX, y2 + offsetY);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.15)';
      ctx.lineCap = 'round';
      ctx.stroke();

      // Shadow side
      ctx.beginPath();
      ctx.moveTo(x1 + offsetX + 1, y1 + offsetY + 1);
      ctx.lineTo(x2 + offsetX + 1, y2 + offsetY + 1);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Extracts screen coordinates from a mouse or touch interaction event.
   *
   * @param {MouseEvent | TouchEvent} e - The interaction event.
   * @returns {{ x: number; y: number }} Extracted coordinates.
   */
  private getPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
    if ('touches' in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    const me = e as MouseEvent;
    return { x: me.clientX, y: me.clientY };
  }

  /**
   * Animation frame loop rendering expanding ripples and glowing stones above the sand canvas.
   *
   * @returns {void}
   */
  private render = (): void => {
    this.animationId = requestAnimationFrame(this.render);

    // Draw ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += 0.4;
      r.alpha -= 0.006;

      if (r.alpha <= 0 || r.radius >= r.maxRadius) {
        this.ripples.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(192, 132, 252, ${r.alpha * 0.4})`;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Draw Stones
    for (const stone of this.stones) {
      this.ctx.save();

      // Drop shadow
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = stone.glow;
      this.ctx.beginPath();
      this.ctx.arc(stone.x, stone.y, stone.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = stone.color;
      this.ctx.fill();

      // Highlight
      this.ctx.beginPath();
      this.ctx.arc(
        stone.x - stone.radius * 0.3,
        stone.y - stone.radius * 0.3,
        stone.radius * 0.4,
        0,
        Math.PI * 2
      );
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.fill();

      this.ctx.restore();
    }
  };
}
