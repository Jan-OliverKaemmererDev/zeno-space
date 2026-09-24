import { Injectable, NgZone, signal, computed, inject } from '@angular/core';

export interface SmoothScrollOptions {
  friction?: number;
  sensitivity?: number;
  maxOverscroll?: number;
  springStiffness?: number;
  springDamping?: number;
}

@Injectable({
  providedIn: 'root',
})
export class SmoothScrollService {
  private readonly ngZone = inject(NgZone);

  // Reactive state signals
  readonly overscrollOffset = signal<number>(0);
  readonly isOverscrolling = computed(() => Math.abs(this.overscrollOffset()) > 0.5);
  readonly currentScrollY = signal<number>(0);
  readonly isScrolling = signal<boolean>(false);

  // Tuned physics parameters for luxurious, calming zeno-space deceleration
  private sensitivity = 0.84; // Balanced wheel impulse factor
  private maxOverscroll = 85; // Maximum elastic pull in pixels at top and bottom

  // Internal physics coordinates
  private currentY = 0;
  private targetY = 0;
  private currentOverscroll = 0;
  private targetOverscroll = 0;

  private isRunning = false;
  private animFrameId: number | null = null;
  private lastTime = 0;
  private isInternalScroll = false;
  private isEnabled = true;
  private isProgrammatic = false;

  private registeredContainer: HTMLElement | null = null;

  constructor() {
    this.initIfBrowser();
  }

  private initIfBrowser(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Check prefers-reduced-motion for accessibility
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReducedMotion) {
      this.isEnabled = false;
      return;
    }

    this.currentY = window.scrollY;
    this.targetY = window.scrollY;
    this.currentScrollY.set(window.scrollY);

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('wheel', this.onWheel, { passive: false });
      window.addEventListener('scroll', this.onNativeScroll, { passive: true });
      window.addEventListener('resize', this.onResize, { passive: true });
    });
  }

  /**
   * Registers the main page content element that will receive the elastic rubber-band transform.
   */
  registerContainer(element: HTMLElement | null): void {
    this.registeredContainer = element;
    if (element) {
      element.style.willChange = 'transform';
      element.style.transformOrigin = 'center top';
    }
  }

  /**
   * Enables or disables smooth scrolling.
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.stop();
      this.resetOverscroll();
    }
  }

  /**
   * Smoothly animates the scroll position to the target Y coordinate.
   */
  smoothScrollTo(destinationY: number, duration = 800): void {
    if (typeof window === 'undefined') return;

    const maxScroll = this.getMaxScroll();
    const clampedDest = Math.max(0, Math.min(maxScroll, destinationY));

    this.isProgrammatic = true;
    this.targetY = clampedDest;
    this.targetOverscroll = 0;

    // Wake physics loop if sleeping
    if (!this.isRunning) {
      this.start();
    }

    setTimeout(() => {
      this.isProgrammatic = false;
    }, duration);
  }

  /**
   * Synchronizes internal positions when external scrolls occur (e.g. drag or page resize).
   */
  syncWithCurrentScroll(): void {
    if (typeof window === 'undefined') return;
    this.currentY = window.scrollY;
    this.targetY = window.scrollY;
    this.targetOverscroll = 0;
    this.currentOverscroll = 0;
    this.applyTransform(0);
    this.overscrollOffset.set(0);
    this.currentScrollY.set(window.scrollY);
  }

  private onWheel = (event: WheelEvent): void => {
    if (!this.isEnabled) return;
    if (event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey) return; // Allow browser pinch-to-zoom

    const maxScroll = this.getMaxScroll();
    if (maxScroll <= 5 && this.currentOverscroll === 0 && Math.abs(event.deltaY) < 1) {
      return;
    }

    // Intercept standard wheel to apply momentum & overscroll
    event.preventDefault();

    let delta = event.deltaY;
    if (event.deltaMode === 1) {
      // Line mode (Windows mouse wheels)
      delta *= 32;
    } else if (event.deltaMode === 2) {
      // Page mode
      delta *= window.innerHeight;
    }

    delta *= this.sensitivity;

    // Detect if we are in or entering the rubber-band overscroll territory
    if (this.currentY <= 0 && delta < 0) {
      // Top overscroll: pulling upwards past 0
      const stretch = Math.abs(this.targetOverscroll);
      const resistance = Math.pow(Math.max(0, 1 - stretch / this.maxOverscroll), 2) * 0.42;
      this.targetOverscroll = Math.min(this.maxOverscroll, this.targetOverscroll - delta * resistance);
      this.targetY = 0;
    } else if (this.currentY >= maxScroll && delta > 0) {
      // Bottom overscroll: pulling downwards past maxScroll
      const stretch = Math.abs(this.targetOverscroll);
      const resistance = Math.pow(Math.max(0, 1 - stretch / this.maxOverscroll), 2) * 0.42;
      this.targetOverscroll = Math.max(-this.maxOverscroll, this.targetOverscroll - delta * resistance);
      this.targetY = maxScroll;
    } else {
      // Normal within-bounds scrolling
      // If there was residual overscroll, dissipate it rapidly
      if (Math.abs(this.targetOverscroll) > 0) {
        this.targetOverscroll += (0 - this.targetOverscroll) * 0.25;
      }
      this.targetY += delta;
      this.targetY = Math.max(0, Math.min(maxScroll, this.targetY));
    }

    if (!this.isRunning) {
      this.start();
    }
  };

  private onNativeScroll = (): void => {
    if (this.isInternalScroll) return;

    // External scroll detected (drag, anchor jump, etc.)
    if (Math.abs(window.scrollY - this.currentY) > 4) {
      this.currentY = window.scrollY;
      this.targetY = window.scrollY;
      this.currentScrollY.set(window.scrollY);
      if (this.currentOverscroll !== 0) {
        this.resetOverscroll();
      }
    }
  };

  private onResize = (): void => {
    const maxScroll = this.getMaxScroll();
    if (this.targetY > maxScroll) {
      this.targetY = maxScroll;
    }
  };

  private start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isScrolling.set(true);
    this.lastTime = performance.now();
    this.animFrameId = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    this.isRunning = false;
    this.isScrolling.set(false);
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private tick = (time: number): void => {
    if (!this.isRunning) return;

    const dt = Math.min(0.06, (time - this.lastTime) / 1000.0);
    this.lastTime = time;

    const maxScroll = this.getMaxScroll();

    // 1. In-Bounds Deceleration & Lerp
    const distY = this.targetY - this.currentY;
    // Dynamic lerp factor adjusted for 60-120hz frame rates
    const lerpRate = 1.0 - Math.pow(1.0 - 0.105, dt * 60);
    this.currentY += distY * lerpRate;

    // Apply native window scroll clamped between 0 and maxScroll
    const clampedY = Math.max(0, Math.min(maxScroll, this.currentY));
    if (Math.abs(window.scrollY - clampedY) >= 0.25) {
      this.isInternalScroll = true;
      window.scrollTo(0, clampedY);
      this.isInternalScroll = false;
      this.currentScrollY.set(clampedY);
    }

    // 2. Rubber-band Overscroll Snap-Back Spring Physics
    // Always attract targetOverscroll back to 0 (harmonic snap-back)
    const springSnap = 1.0 - Math.pow(1.0 - 0.135, dt * 60);
    this.targetOverscroll += (0 - this.targetOverscroll) * springSnap;

    // Smoothly interpolate current visual overscroll towards target
    const overscrollLerp = 1.0 - Math.pow(1.0 - 0.12, dt * 60);
    this.currentOverscroll += (this.targetOverscroll - this.currentOverscroll) * overscrollLerp;

    // Threshold check for complete rest
    if (Math.abs(this.currentOverscroll) < 0.15 && Math.abs(this.targetOverscroll) < 0.15) {
      this.currentOverscroll = 0;
      this.targetOverscroll = 0;
    }

    // 3. Direct GPU DOM Update for Zero-Jank 120 FPS
    this.applyTransform(this.currentOverscroll);
    if (Math.abs(this.overscrollOffset() - this.currentOverscroll) > 0.15 || this.currentOverscroll === 0) {
      this.overscrollOffset.set(Math.round(this.currentOverscroll * 10) / 10);
    }

    // 4. Idle Detection
    const isAtRestY = Math.abs(this.targetY - this.currentY) < 0.3;
    const isAtRestOverscroll = this.currentOverscroll === 0 && this.targetOverscroll === 0;

    if (isAtRestY && isAtRestOverscroll && !this.isProgrammatic) {
      this.currentY = this.targetY;
      this.stop();
      return;
    }

    this.animFrameId = requestAnimationFrame(this.tick);
  };

  private applyTransform(offset: number): void {
    if (!this.registeredContainer) return;
    if (offset === 0) {
      this.registeredContainer.style.transform = '';
    } else {
      this.registeredContainer.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    }
  }

  private resetOverscroll(): void {
    this.currentOverscroll = 0;
    this.targetOverscroll = 0;
    this.applyTransform(0);
    this.overscrollOffset.set(0);
  }

  private getMaxScroll(): number {
    if (typeof document === 'undefined' || typeof window === 'undefined') return 0;
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }
}
