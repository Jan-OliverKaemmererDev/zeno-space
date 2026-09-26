import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  Input,
  NgZone,
} from '@angular/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single point (particle) along a Verlet rope. */
interface RopePoint {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  /** If true the point is pinned to its anchor and unaffected by forces. */
  pinned: boolean;
}

/**
 * Configuration for one rope that connects a fixed anchor point (ceiling / wall)
 * to a hanging object (lantern / star).
 */
export interface RopeConfig {
  /** Unique identifier – must match the `data-swing-id` on the DOM element. */
  id: string;
  /** Anchor X in the 1376-wide design coordinate space. */
  anchorX: number;
  /** Anchor Y in the 768-high design coordinate space. */
  anchorY: number;
  /** Total rope length in design-space pixels. */
  length: number;
  /** Width of the hanging body in design-space pixels. */
  bodyWidth: number;
  /** Height of the hanging body in design-space pixels. */
  bodyHeight: number;
  /** Number of segments (more = bendier). */
  segments: number;
  /** Rope line width in design-space pixels. */
  thickness: number;
  /** Rope stroke color. */
  color: string;
  /** Optional glow color for a soft halo around the rope. */
  glowColor?: string;
  /** Mouse influence radius in design-space pixels. */
  influenceRadius: number;
  /** How strongly the rope reacts to the mouse (0-1 range). */
  reactivity: number;
  /** Gravity strength multiplier. */
  gravityScale: number;
  /** Damping multiplier per frame (0.98-0.995 range). */
  damping: number;
}

/** Runtime state for one rope, combining config and live particle data. */
interface Rope extends RopeConfig {
  points: RopePoint[];
}

interface DomSyncItem {
  id: string;
  element: HTMLElement | null;
  anchorX: number;
  anchorY: number;
  restLength: number;
}

// ---------------------------------------------------------------------------
// Design coordinate space & default rope configurations
// ---------------------------------------------------------------------------

const DESIGN_W = 1376;
const DESIGN_H = 768;

const ROPE_COLOR_LANTERN = 'rgba(125, 90, 52, 0.85)';
const ROPE_COLOR_STAR    = 'rgba(100, 80, 58, 0.82)';
const ROPE_GLOW_LANTERN  = 'rgba(251, 191, 36, 0.15)';
const ROPE_GLOW_STAR     = 'rgba(251, 191, 36, 0.10)';

/**
 * Measured configurations for all 13 hanging items.
 * Anchor coordinates match the sanctuary artwork coordinate system.
 * Rope lengths match the exact height of the clipped static rope.
 */
const DEFAULT_ROPE_CONFIGS: RopeConfig[] = [
  // ---- Hanging Lanterns (6 items) ----
  {
    id: 'lantern-hanging-left-top',
    anchorX: 152,
    anchorY: 6,
    length: 16,
    bodyWidth: 39,
    bodyHeight: 53,
    segments: 4,
    thickness: 1.4,
    color: ROPE_COLOR_LANTERN,
    glowColor: ROPE_GLOW_LANTERN,
    influenceRadius: 40,
    reactivity: 0.42,
    gravityScale: 1.0,
    damping: 0.976,
  },
  {
    id: 'lantern-hanging-left-mid',
    anchorX: 156,
    anchorY: 310,
    length: 38,
    bodyWidth: 39,
    bodyHeight: 47,
    segments: 6,
    thickness: 1.4,
    color: ROPE_COLOR_LANTERN,
    glowColor: ROPE_GLOW_LANTERN,
    influenceRadius: 42,
    reactivity: 0.40,
    gravityScale: 1.0,
    damping: 0.977,
  },
  {
    id: 'lantern-hanging-center-left',
    anchorX: 502,
    anchorY: 354,
    length: 25,
    bodyWidth: 32,
    bodyHeight: 26,
    segments: 5,
    thickness: 1.3,
    color: ROPE_COLOR_LANTERN,
    glowColor: ROPE_GLOW_LANTERN,
    influenceRadius: 38,
    reactivity: 0.42,
    gravityScale: 1.0,
    damping: 0.975,
  },
  {
    id: 'lantern-hanging-center-right',
    anchorX: 874,
    anchorY: 392,
    length: 20,
    bodyWidth: 27,
    bodyHeight: 42,
    segments: 4,
    thickness: 1.3,
    color: ROPE_COLOR_LANTERN,
    glowColor: ROPE_GLOW_LANTERN,
    influenceRadius: 38,
    reactivity: 0.40,
    gravityScale: 1.0,
    damping: 0.975,
  },
  {
    id: 'lantern-hanging-right-mid',
    anchorX: 1220,
    anchorY: 296,
    length: 42,
    bodyWidth: 40,
    bodyHeight: 44,
    segments: 6,
    thickness: 1.4,
    color: ROPE_COLOR_LANTERN,
    glowColor: ROPE_GLOW_LANTERN,
    influenceRadius: 42,
    reactivity: 0.40,
    gravityScale: 1.0,
    damping: 0.977,
  },
  {
    id: 'lantern-hanging-right-top',
    anchorX: 1216,
    anchorY: 76,
    length: 8,
    bodyWidth: 33,
    bodyHeight: 42,
    segments: 3,
    thickness: 1.3,
    color: ROPE_COLOR_LANTERN,
    glowColor: ROPE_GLOW_LANTERN,
    influenceRadius: 36,
    reactivity: 0.38,
    gravityScale: 1.0,
    damping: 0.974,
  },

  // ---- Hanging Star Lanterns (7 items) ----
  {
    id: 'star-left-1',
    anchorX: 163,
    anchorY: 628,
    length: 92,
    bodyWidth: 54,
    bodyHeight: 26,
    segments: 10,
    thickness: 1.1,
    color: ROPE_COLOR_STAR,
    glowColor: ROPE_GLOW_STAR,
    influenceRadius: 40,
    reactivity: 0.46,
    gravityScale: 1.0,
    damping: 0.980,
  },
  {
    id: 'star-left-2',
    anchorX: 220,
    anchorY: 560,
    length: 70,
    bodyWidth: 46,
    bodyHeight: 15,
    segments: 8,
    thickness: 1.1,
    color: ROPE_COLOR_STAR,
    glowColor: ROPE_GLOW_STAR,
    influenceRadius: 38,
    reactivity: 0.45,
    gravityScale: 1.0,
    damping: 0.978,
  },
  {
    id: 'star-center',
    anchorX: 505,
    anchorY: 465,
    length: 50,
    bodyWidth: 46,
    bodyHeight: 14,
    segments: 7,
    thickness: 1.1,
    color: ROPE_COLOR_STAR,
    glowColor: ROPE_GLOW_STAR,
    influenceRadius: 38,
    reactivity: 0.45,
    gravityScale: 1.0,
    damping: 0.977,
  },
  {
    id: 'star-right-1',
    anchorX: 1175,
    anchorY: 542,
    length: 71,
    bodyWidth: 50,
    bodyHeight: 19,
    segments: 8,
    thickness: 1.1,
    color: ROPE_COLOR_STAR,
    glowColor: ROPE_GLOW_STAR,
    influenceRadius: 38,
    reactivity: 0.45,
    gravityScale: 1.0,
    damping: 0.978,
  },
  {
    id: 'star-right-2',
    anchorX: 1205,
    anchorY: 553,
    length: 135,
    bodyWidth: 58,
    bodyHeight: 28,
    segments: 12,
    thickness: 1.1,
    color: ROPE_COLOR_STAR,
    glowColor: ROPE_GLOW_STAR,
    influenceRadius: 42,
    reactivity: 0.48,
    gravityScale: 1.0,
    damping: 0.981,
  },
  {
    id: 'star-right-3',
    anchorX: 1239,
    anchorY: 604,
    length: 53,
    bodyWidth: 42,
    bodyHeight: 14,
    segments: 7,
    thickness: 1.1,
    color: ROPE_COLOR_STAR,
    glowColor: ROPE_GLOW_STAR,
    influenceRadius: 36,
    reactivity: 0.44,
    gravityScale: 1.0,
    damping: 0.977,
  },
  {
    id: 'star-right-4',
    anchorX: 1276,
    anchorY: 685,
    length: 25,
    bodyWidth: 40,
    bodyHeight: 16,
    segments: 5,
    thickness: 1.1,
    color: ROPE_COLOR_STAR,
    glowColor: ROPE_GLOW_STAR,
    influenceRadius: 34,
    reactivity: 0.42,
    gravityScale: 1.0,
    damping: 0.975,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@Component({
  selector: 'app-rope-physics',
  standalone: true,
  templateUrl: './rope-physics.component.html',
  styleUrls: ['./rope-physics.component.scss'],
})
export class RopePhysicsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('ropeCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  /** Custom rope configurations (if not set, DEFAULT_ROPE_CONFIGS is used). */
  @Input() ropeConfigs?: RopeConfig[];

  /** Whether the sanctuary section is revealed (controls physics activation). */
  @Input() set active(value: boolean) {
    this._active = value;
    if (value && !this._rafId && this._initialized) {
      this.startLoop();
    }
  }
  get active(): boolean {
    return this._active;
  }

  // ---- Private state ----
  private _active = false;
  private _initialized = false;
  private _destroyed = false;
  private _rafId: number | null = null;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private ropes: Rope[] = [];
  private domSyncItems: DomSyncItem[] = [];

  // Pointer tracking (in design coordinate space)
  private pointerX = 0;
  private pointerY = 0;
  private pointerVX = 0;
  private pointerVY = 0;
  private prevPointerX = 0;
  private prevPointerY = 0;
  private pointerTimestamp = 0;
  private pointerInside = false;

  // Scale factor from design space to actual canvas pixels
  private scaleX = 1;
  private scaleY = 1;

  // ResizeObserver
  private resizeObserver: ResizeObserver | null = null;

  // Gravity constant in design-space px per second²
  private readonly GRAVITY = 980;

  // Number of constraint-solving iterations per frame
  private readonly CONSTRAINT_ITERATIONS = 5;

  // Wind perturbation for idle breathing animation
  private windPhase = 0;

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit(): void {
    this.canvas = this.canvasRef.nativeElement;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;

    this.initRopes();
    this.initDomSync();
    this.setupResizeObserver();
    this.resizeCanvas();
    this._initialized = true;

    if (this._active) {
      this.startLoop();
    }
  }

  ngOnDestroy(): void {
    this._destroyed = true;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API – called from parent component pointer events
  // ---------------------------------------------------------------------------

  /**
   * Called on pointer move over the sanctuary section.
   * Converts screen coordinates to design space and calculates velocity.
   */
  onPointerMove(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const now = performance.now();
    const designX = ((clientX - rect.left) / rect.width) * DESIGN_W;
    const designY = ((clientY - rect.top) / rect.height) * DESIGN_H;

    if (this.pointerTimestamp > 0) {
      const dt = Math.max(0.005, Math.min(0.05, (now - this.pointerTimestamp) / 1000));
      const rawVX = (designX - this.prevPointerX) / dt;
      const rawVY = (designY - this.prevPointerY) / dt;
      // Exponential smoothing to eliminate micro-jitter and sudden velocity spikes
      this.pointerVX = this.pointerVX * 0.35 + rawVX * 0.65;
      this.pointerVY = this.pointerVY * 0.35 + rawVY * 0.65;
      this.pointerVX = Math.max(-1200, Math.min(1200, this.pointerVX));
      this.pointerVY = Math.max(-1200, Math.min(1200, this.pointerVY));
    }

    this.prevPointerX = this.pointerX;
    this.prevPointerY = this.pointerY;
    this.pointerX = designX;
    this.pointerY = designY;
    this.pointerTimestamp = now;
    this.pointerInside = true;

    // Wake up physics loop if sleeping
    if (!this._rafId && this._active) {
      this.startLoop();
    }
  }

  /** Called when pointer leaves the sanctuary section. */
  onPointerLeave(): void {
    this.pointerInside = false;
    this.pointerTimestamp = 0;
    this.pointerVX = 0;
    this.pointerVY = 0;
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  private initRopes(): void {
    const configs = this.ropeConfigs ?? DEFAULT_ROPE_CONFIGS;
    this.ropes = configs.map(cfg => {
      const segLen = cfg.length / cfg.segments;
      const points: RopePoint[] = [];
      for (let i = 0; i <= cfg.segments; i++) {
        const y = cfg.anchorY + i * segLen;
        points.push({
          x: cfg.anchorX,
          y,
          oldX: cfg.anchorX,
          oldY: y,
          pinned: i === 0, // Only top particle is pinned to anchor
        });
      }
      return { ...cfg, points };
    });
  }

  private initDomSync(): void {
    this.domSyncItems = this.ropes.map(r => ({
      id: r.id,
      element: null,
      anchorX: r.anchorX,
      anchorY: r.anchorY,
      restLength: r.length,
    }));
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
    });
    this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas);
  }

  private resizeCanvas(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.scaleX = (rect.width * dpr) / DESIGN_W;
    this.scaleY = (rect.height * dpr) / DESIGN_H;
  }

  // ---------------------------------------------------------------------------
  // Physics Loop
  // ---------------------------------------------------------------------------

  private startLoop(): void {
    if (this._rafId !== null || this._destroyed) return;
    this.ngZone.runOutsideAngular(() => {
      this._rafId = requestAnimationFrame(this.tick);
    });
  }

  private tick = (): void => {
    if (this._destroyed || !this._active) {
      this._rafId = null;
      return;
    }

    const dt = 1 / 60;
    this.windPhase += dt * 0.45; // Subtle breeze rhythm

    // Physics update
    for (const rope of this.ropes) {
      this.updateRope(rope, dt);
    }

    // Canvas render
    this.render();

    // Synchronize DOM positions and rotations
    this.syncDomElements();

    // Continue loop while section is active
    this._rafId = requestAnimationFrame(this.tick);
  };

  // ---------------------------------------------------------------------------
  // Verlet Integration Physics
  // ---------------------------------------------------------------------------

  private updateRope(rope: Rope, dt: number): void {
    const gravity = this.GRAVITY * rope.gravityScale * dt * dt;

    // Organic wind breeze: gentle sine oscillation with spatial phase shift across sanctuary
    const baseWind = Math.sin(this.windPhase + rope.anchorX * 0.008) * 0.22 * dt;

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
    if (this.pointerInside) {
      this.applyMouseForce(rope);
    }

    // Constraint solving (Verlet distance preservation)
    for (let iter = 0; iter < this.CONSTRAINT_ITERATIONS; iter++) {
      this.solveConstraints(rope);
    }
  }

  private applyMouseForce(rope: Rope): void {
    const speed = Math.hypot(this.pointerVX, this.pointerVY);
    if (speed < 10) return;

    // Harmonious speed factor curve: gentle sway at slow speeds, clear natural swing at high speeds
    const speedFactor = Math.min(speed / 500, 1.25);
    const lastIdx = rope.points.length - 1;
    const lastPoint = rope.points[lastIdx];

    // --- Zone 1: Body interaction (lantern / star hanging below the last particle) ---
    // The body center is offset below the last rope particle by half its height.
    const bodyCenterX = lastPoint.x;
    const bodyCenterY = lastPoint.y + rope.bodyHeight * 0.5;
    const bodyDx = bodyCenterX - this.pointerX;
    const bodyDy = bodyCenterY - this.pointerY;
    const bodyDist = Math.hypot(bodyDx, bodyDy);
    // Hit radius is the larger body dimension plus a comfortable margin
    const bodyRadius = Math.max(rope.bodyWidth, rope.bodyHeight) * 0.75 + rope.influenceRadius * 0.5;

    if (bodyDist < bodyRadius && bodyDist > 0.1) {
      // Force applied ONLY to the last particle – rope follows via constraints.
      // Pure velocity-direction push (like an air current), NO radial repulsion.
      // Repulsion would fight the movement direction when hovering from below,
      // causing counterintuitive tilting.
      const normDist = bodyDist / bodyRadius;
      const falloff = 1 - normDist * normDist;
      const smoothWeight = falloff * falloff;

      const maxStep = 2.2;
      const pushX = Math.max(-maxStep, Math.min(maxStep,
        (this.pointerVX / speed) * speedFactor * smoothWeight * rope.reactivity * 1.1));
      const pushY = Math.max(-maxStep, Math.min(maxStep,
        (this.pointerVY / speed) * speedFactor * smoothWeight * rope.reactivity * 0.35));

      lastPoint.x += pushX;
      lastPoint.y += pushY;
      return; // Body interaction takes priority – skip rope segment interaction
    }

    // --- Zone 2: Rope segment interaction (upper & middle particles only) ---
    // Exclude the last ~2 particles so the bottom rope end doesn't twitch directly;
    // it will follow naturally through the constraint solver.
    const ropeInteractionEnd = Math.max(2, lastIdx - 2);

    for (let i = 1; i <= ropeInteractionEnd; i++) {
      const point = rope.points[i];
      if (point.pinned) continue;

      const dx = point.x - this.pointerX;
      const dy = point.y - this.pointerY;
      const dist = Math.hypot(dx, dy);

      if (dist < rope.influenceRadius && dist > 0.1) {
        const normDist = dist / rope.influenceRadius;
        const falloff = 1 - normDist * normDist;
        const smoothWeight = falloff * falloff;

        // Mechanical leverage: points further down react moderately more
        const leverage = 0.45 + 0.55 * (i / rope.points.length);

        // Direction of cursor motion pushes rope particles with balanced force
        let pushX = (this.pointerVX / speed) * speedFactor * smoothWeight * leverage * rope.reactivity * 1.1;
        let pushY = (this.pointerVY / speed) * speedFactor * smoothWeight * leverage * rope.reactivity * 0.35;

        // Mild soft repulsion
        const repulse = smoothWeight * leverage * rope.reactivity * 0.3;
        const repulseX = (dx / dist) * repulse;
        const repulseY = (dy / dist) * repulse;

        // Limit maximum displacement per frame to prevent extreme sudden jerks
        const maxStep = 2.2;
        pushX = Math.max(-maxStep, Math.min(maxStep, pushX + repulseX));
        pushY = Math.max(-maxStep, Math.min(maxStep, pushY + repulseY));

        point.x += pushX;
        point.y += pushY;
      }
    }
  }

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

  // ---------------------------------------------------------------------------
  // Canvas Rendering
  // ---------------------------------------------------------------------------

  private render(): void {
    const { ctx, canvas } = this;
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const rope of this.ropes) {
      this.drawRope(rope);
    }
  }

  private drawRope(rope: Rope): void {
    const { ctx } = this;
    const points = rope.points;
    if (points.length < 2) return;

    const tx = (x: number) => x * this.scaleX;
    const ty = (y: number) => y * this.scaleY;

    // Glow stroke
    if (rope.glowColor) {
      ctx.save();
      ctx.strokeStyle = rope.glowColor;
      ctx.lineWidth = (rope.thickness * 3.5) * Math.min(this.scaleX, this.scaleY);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      this.drawRopePath(points, tx, ty);
      ctx.stroke();
      ctx.restore();
    }

    // Main rope stroke
    ctx.save();
    ctx.strokeStyle = rope.color;
    ctx.lineWidth = rope.thickness * Math.min(this.scaleX, this.scaleY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.drawRopePath(points, tx, ty);
    ctx.stroke();
    ctx.restore();

    // Small anchor pin dot at the top ceiling/wall point
    ctx.save();
    ctx.fillStyle = rope.color;
    ctx.beginPath();
    ctx.arc(tx(points[0].x), ty(points[0].y), rope.thickness * 1.2 * Math.min(this.scaleX, this.scaleY), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawRopePath(
    points: RopePoint[],
    tx: (x: number) => number,
    ty: (y: number) => number,
  ): void {
    const { ctx } = this;

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

  // ---------------------------------------------------------------------------
  // DOM Elements Synchronization
  // ---------------------------------------------------------------------------

  private syncDomElements(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    // Scale from design space (1376) to current rendered CSS pixel width
    const currentScale = parent.getBoundingClientRect().width / DESIGN_W;

    for (let i = 0; i < this.ropes.length; i++) {
      const rope = this.ropes[i];
      const syncItem = this.domSyncItems[i];

      if (!syncItem.element) {
        syncItem.element = document.querySelector(`[data-swing-id="${rope.id}"]`);
        if (!syncItem.element) continue;
      }

      const lastPoint = rope.points[rope.points.length - 1];
      const prevPoint = rope.points[rope.points.length - 2];

      // Displacement from rest position in screen pixels
      const dx = (lastPoint.x - syncItem.anchorX) * currentScale;
      const dy = (lastPoint.y - (syncItem.anchorY + syncItem.restLength)) * currentScale;

      // Tangent angle of the bottom rope segment with natural weight damping and bounds
      const angleRad = Math.atan2(lastPoint.x - prevPoint.x, lastPoint.y - prevPoint.y);
      const rawDeg = angleRad * (180 / Math.PI) * 0.72;
      const deg = Math.max(-18, Math.min(18, rawDeg)).toFixed(2);

      syncItem.element.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) rotate(${deg}deg)`;
    }
  }
}
