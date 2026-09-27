import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  Input,
  NgZone,
  inject,
} from '@angular/core';
import { RopeCanvasComponent } from './components/rope-canvas/rope-canvas.component';
import { VerletRopeSimulatorService } from './services/verlet-rope-simulator.service';
import { RopeDomSynchronizerService } from './services/rope-dom-synchronizer.service';
import { Rope, RopeConfig, DomSyncItem, PointerState } from './rope-physics.models';
import { DESIGN_W, DESIGN_H, DEFAULT_ROPE_CONFIGS } from './rope-physics.constants';

// Re-export models and constants for convenience and backwards compatibility
export * from './rope-physics.models';
export * from './rope-physics.constants';

/**
 * High-level coordinator component for Verlet rope physics.
 * Coordinates pure physics simulation, high-DPI canvas rendering, and DOM element transforms.
 */
@Component({
  selector: 'app-rope-physics',
  standalone: true,
  imports: [RopeCanvasComponent],
  templateUrl: './rope-physics.component.html',
  styleUrls: ['./rope-physics.component.scss'],
})
export class RopePhysicsComponent implements AfterViewInit, OnDestroy {
  @ViewChild(RopeCanvasComponent) ropeCanvas?: RopeCanvasComponent;

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

  private readonly ngZone = inject(NgZone);
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly simulator = inject(VerletRopeSimulatorService);
  private readonly synchronizer = inject(RopeDomSynchronizerService);

  private _active = false;
  private _initialized = false;
  private _destroyed = false;
  private _rafId: number | null = null;

  private ropes: Rope[] = [];
  private domSyncItems: DomSyncItem[] = [];

  private pointer: PointerState = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    prevX: 0,
    prevY: 0,
    timestamp: 0,
    inside: false,
  };

  ngAfterViewInit(): void {
    const configs = this.ropeConfigs ?? DEFAULT_ROPE_CONFIGS;
    this.ropes = this.simulator.initRopes(configs);
    this.domSyncItems = this.synchronizer.initDomSync(this.ropes);
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
  }

  // ---------------------------------------------------------------------------
  // Public API – called from parent component pointer events
  // ---------------------------------------------------------------------------

  /**
   * Called on pointer move over the sanctuary section.
   * Converts screen coordinates to design space and calculates smoothed velocity.
   */
  onPointerMove(clientX: number, clientY: number): void {
    const rect = this.ropeCanvas?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const now = performance.now();
    const designX = ((clientX - rect.left) / rect.width) * DESIGN_W;
    const designY = ((clientY - rect.top) / rect.height) * DESIGN_H;

    if (this.pointer.timestamp > 0) {
      const dt = Math.max(0.005, Math.min(0.05, (now - this.pointer.timestamp) / 1000));
      const rawVX = (designX - this.pointer.prevX) / dt;
      const rawVY = (designY - this.pointer.prevY) / dt;
      // Exponential smoothing to eliminate micro-jitter and sudden velocity spikes
      this.pointer.vx = this.pointer.vx * 0.35 + rawVX * 0.65;
      this.pointer.vy = this.pointer.vy * 0.35 + rawVY * 0.65;
      this.pointer.vx = Math.max(-1200, Math.min(1200, this.pointer.vx));
      this.pointer.vy = Math.max(-1200, Math.min(1200, this.pointer.vy));
    }

    this.pointer.prevX = this.pointer.x;
    this.pointer.prevY = this.pointer.y;
    this.pointer.x = designX;
    this.pointer.y = designY;
    this.pointer.timestamp = now;
    this.pointer.inside = true;

    // Wake up physics loop if sleeping
    if (!this._rafId && this._active) {
      this.startLoop();
    }
  }

  /** Called when pointer leaves the sanctuary section. */
  onPointerLeave(): void {
    this.pointer.inside = false;
    this.pointer.timestamp = 0;
    this.pointer.vx = 0;
    this.pointer.vy = 0;
  }

  // ---------------------------------------------------------------------------
  // Physics & Animation Loop (runs outside Angular zone)
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

    // Decay cursor velocity if mouse stopped moving while still inside
    if (this.pointer.inside && performance.now() - this.pointer.timestamp > 50) {
      this.pointer.vx *= 0.75;
      this.pointer.vy *= 0.75;
      if (Math.hypot(this.pointer.vx, this.pointer.vy) < 1) {
        this.pointer.vx = 0;
        this.pointer.vy = 0;
      }
    }

    // 1. Advance Verlet physics simulation
    this.simulator.step(this.ropes, dt, this.pointer);

    // 2. Render dynamic ropes on canvas
    this.ropeCanvas?.render(this.ropes);

    // 3. Synchronize hanging DOM elements (lanterns, stars)
    const parentEl = this.hostRef.nativeElement.parentElement;
    this.synchronizer.syncDomElements(this.ropes, this.domSyncItems, parentEl);

    // Continue loop while section is active
    this._rafId = requestAnimationFrame(this.tick);
  };
}
