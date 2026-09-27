import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { Rope, RopePoint } from '../../rope-physics.models';
import { DESIGN_W, DESIGN_H } from '../../rope-physics.constants';

/**
 * Presentation component responsible for HTML5 Canvas lifecycle,
 * Retina/DPR scaling, ResizeObserver, and 2D Bézier curve rendering.
 */
@Component({
  selector: 'app-rope-canvas',
  standalone: true,
  templateUrl: './rope-canvas.component.html',
  styleUrls: ['./rope-canvas.component.scss'],
})
export class RopeCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('ropeCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;

  scaleX = 1;
  scaleY = 1;

  ngAfterViewInit(): void {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d');
    this.setupResizeObserver();
    this.resizeCanvas();
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  /**
   * Sets up a ResizeObserver observing the parent element.
   */
  private setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
    });
    this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas);
  }

  /**
   * Adjusts canvas pixel buffer for crisp high-DPI rendering and updates scale factors.
   */
  resizeCanvas(): void {
    const parent = this.canvas?.parentElement;
    if (!parent || !this.canvas) return;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.scaleX = (rect.width * dpr) / DESIGN_W;
    this.scaleY = (rect.height * dpr) / DESIGN_H;
  }

  /**
   * Returns current bounding client rectangle of the canvas element.
   */
  getBoundingClientRect(): DOMRect | null {
    return this.canvas ? this.canvas.getBoundingClientRect() : null;
  }

  /**
   * Returns the underlying canvas element.
   */
  getCanvasElement(): HTMLCanvasElement | null {
    return this.canvas;
  }

  /**
   * Clears the canvas and renders all ropes.
   */
  render(ropes: Rope[]): void {
    const { ctx, canvas } = this;
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const rope of ropes) {
      this.drawRope(rope);
    }
  }

  /**
   * Draws a single rope with optional glow halo, main stroke, and anchor pin dot.
   */
  private drawRope(rope: Rope): void {
    const { ctx } = this;
    if (!ctx) return;
    const points = rope.points;
    if (points.length < 2) return;

    const tx = (x: number) => x * this.scaleX;
    const ty = (y: number) => y * this.scaleY;
    const uniformScale = Math.min(this.scaleX, this.scaleY);

    // Glow stroke
    if (rope.glowColor) {
      ctx.save();
      ctx.strokeStyle = rope.glowColor;
      ctx.lineWidth = rope.thickness * 3.5 * uniformScale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      this.drawRopePath(points, tx, ty);
      ctx.stroke();
      ctx.restore();
    }

    // Main rope stroke
    ctx.save();
    ctx.strokeStyle = rope.color;
    ctx.lineWidth = rope.thickness * uniformScale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.drawRopePath(points, tx, ty);
    ctx.stroke();
    ctx.restore();

    // Small anchor pin dot at the top ceiling/wall point
    ctx.save();
    ctx.fillStyle = rope.color;
    ctx.beginPath();
    ctx.arc(tx(points[0].x), ty(points[0].y), rope.thickness * 1.2 * uniformScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Builds quadratic Bézier interpolation path connecting particles.
   */
  private drawRopePath(
    points: RopePoint[],
    tx: (x: number) => number,
    ty: (y: number) => number,
  ): void {
    const { ctx } = this;
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(tx(points[0].x), ty(points[0].y));

    if (points.length === 2) {
      ctx.lineTo(tx(points[1].x), ty(points[1].y));
      return;
    }

    // Smooth quadratic Bézier interpolation through midpoint control points
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];

      if (i === points.length - 2) {
        ctx.quadraticCurveTo(
          tx(p0.x),
          ty(p0.y),
          tx(p1.x),
          ty(p1.y),
        );
      } else {
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        ctx.quadraticCurveTo(
          tx(p0.x),
          ty(p0.y),
          tx(midX),
          ty(midY),
        );
      }
    }
  }
}
