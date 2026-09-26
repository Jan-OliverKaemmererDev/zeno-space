import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  signal,
  inject,
} from '@angular/core';

/**
 * Data structure representing a fine micro-spark particle shooting outward on mouse hold.
 * Modeled directly after the micro-pixel click sparks in orb-nav (orb-target-btn).
 */
interface CursorSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

/**
 * Interactive soft-body glass orb mouse cursor.
 * Features clean card-cta glassmorphic styling, continuous time-smoothed velocity deformation,
 * 2 calm celestial particle orbits on button hover, balanced micro-pixel sparks on click-hold,
 * complete uniform click shrinkage, and an elastic spring wobble upon release.
 */
@Component({
  selector: 'app-orb-cursor',
  standalone: true,
  templateUrl: './orb-cursor.component.html',
  styleUrl: './orb-cursor.component.scss',
})
export class OrbCursorComponent implements OnInit, OnDestroy {
  private readonly ngZone = inject(NgZone);

  @ViewChild('cursorWrapper', { static: true })
  private cursorWrapperRef!: ElementRef<HTMLDivElement>;

  @ViewChild('cursorMorph', { static: true })
  private cursorMorphRef!: ElementRef<HTMLDivElement>;

  @ViewChild('cursorBody', { static: true })
  private cursorBodyRef!: ElementRef<HTMLDivElement>;

  @ViewChild('sparksCanvas', { static: true })
  private sparksCanvasRef!: ElementRef<HTMLCanvasElement>;

  /** Visibility signal for smooth fade in/out when cursor enters/leaves window. */
  readonly isVisible = signal<boolean>(false);

  /** Signal indicating whether the cursor is hovering over an interactive element. */
  readonly isHovering = signal<boolean>(false);

  /** Signal indicating whether the mouse button is actively held down. */
  readonly isClicking = signal<boolean>(false);

  /** Signal indicating whether the cursor is subtly trembling after being held for >= 2 seconds. */
  readonly isTrembling = signal<boolean>(false);

  /** 8 fine stardust particles rotating in a single close orbit around cursor on button hover. */
  readonly orbitParticleIndices = Array.from({ length: 8 }, (_, i) => i);

  // Position and continuous velocity tracking state
  private targetX = -100;
  private targetY = -100;
  private currentX = -100;
  private currentY = -100;
  private lastPointerX = -100;
  private lastPointerY = -100;
  private lastPointerTime = 0;
  private lastPointerMoveTime = 0;
  private targetVx = 0;
  private targetVy = 0;
  private smoothVx = 0;
  private smoothVy = 0;
  private currentSpeed = 0;
  private currentAngle = 0;

  // Uniform click shrinkage state
  private isMouseDown = false;
  private clickScale = 1.0;

  // 1-Second Hold Tremble state ("Schlottern / Zittern")
  private holdDuration = 0;
  private trembleX = 0;
  private trembleY = 0;
  private readonly trembleHoldThreshold = 1.0; // 1 second continuous hold

  // Release spring wobble state
  private wobbleOffset = 0;
  private wobbleVelocity = 0;
  private readonly springStiffness = 320;
  private readonly springDamping = 16;

  // Subtle micro-spark state (exact colors and sizes from orb-target-btn)
  private sparks: CursorSpark[] = [];
  private sparkSpawnAccumulator = 0;
  private sparksCtx: CanvasRenderingContext2D | null = null;
  private readonly sparkColors = ['#ffffff', '#7dd3fc'];

  // Hover scale transition
  private currentHoverScale = 1.0;

  // Animation frame and event listener references for cleanup
  private rafId: number | null = null;
  private lastTime = 0;
  private abortController: AbortController | null = null;

  ngOnInit(): void {
    // Only activate cursor logic on devices with a fine pointer (desktop mouse/trackpad)
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function' ||
      !window.matchMedia('(pointer: fine)').matches
    ) {
      return;
    }

    this.initSparksCanvas();

    this.abortController = new AbortController();
    const { signal: abortSignal } = this.abortController;

    // Run all high-frequency mouse tracking & animation frames outside Angular zone
    this.ngZone.runOutsideAngular(() => {
      this.initEventListeners(abortSignal);
      this.startRenderLoop();
    });
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Initializes the 2D canvas for rendering continuous micro-sparks on high-DPI displays.
   */
  private initSparksCanvas(): void {
    const canvas = this.sparksCanvasRef?.nativeElement;
    if (canvas && typeof canvas.getContext === 'function') {
      this.sparksCtx = canvas.getContext('2d');
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      canvas.width = 200 * dpr;
      canvas.height = 200 * dpr;
      if (this.sparksCtx) {
        this.sparksCtx.scale(dpr, dpr);
      }
    }
  }

  /**
   * Initializes mouse, pointer, and hover event listeners on document and window.
   */
  private initEventListeners(signal: AbortSignal): void {
    window.addEventListener(
      'pointermove',
      (e: PointerEvent) => {
        const now = performance.now();
        if (!this.isVisible()) {
          this.isVisible.set(true);
          this.currentX = e.clientX;
          this.currentY = e.clientY;
          this.lastPointerX = e.clientX;
          this.lastPointerY = e.clientY;
          this.lastPointerTime = now;
        }

        const dtSec = (now - this.lastPointerTime) / 1000;
        if (dtSec > 0.002 && dtSec < 0.15) {
          const instantVx = (e.clientX - this.lastPointerX) / dtSec;
          const instantVy = (e.clientY - this.lastPointerY) / dtSec;
          // Smooth the input target velocity to prevent sensor jitter
          this.targetVx = this.targetVx * 0.35 + instantVx * 0.65;
          this.targetVy = this.targetVy * 0.35 + instantVy * 0.65;
        }

        this.lastPointerTime = now;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        this.lastPointerMoveTime = now;
        this.targetX = e.clientX;
        this.targetY = e.clientY;
      },
      { passive: true, signal }
    );

    window.addEventListener(
      'mousedown',
      () => {
        this.isMouseDown = true;
        this.isClicking.set(true);
        this.holdDuration = 0;
        this.trembleX = 0;
        this.trembleY = 0;
        if (this.isTrembling()) {
          this.isTrembling.set(false);
        }
        // Clear previous wobble during active press
        this.wobbleOffset = 0;
        this.wobbleVelocity = 0;
        // Trigger initial subtle micro-spark right upon pressing
        this.spawnSpark();
      },
      { passive: true, signal }
    );

    window.addEventListener(
      'mouseup',
      () => {
        if (this.isMouseDown) {
          this.isMouseDown = false;
          this.isClicking.set(false);
          this.holdDuration = 0;
          this.trembleX = 0;
          this.trembleY = 0;
          if (this.isTrembling()) {
            this.isTrembling.set(false);
          }
          // Launch organic jelly spring impulse on release
          this.wobbleVelocity = 14.0;
        }
      },
      { passive: true, signal }
    );

    document.addEventListener(
      'mouseenter',
      () => {
        this.isVisible.set(true);
      },
      { passive: true, signal }
    );

    document.addEventListener(
      'mouseleave',
      () => {
        this.isVisible.set(false);
        this.isMouseDown = false;
        this.isClicking.set(false);
        this.isHovering.set(false);
        this.holdDuration = 0;
        this.trembleX = 0;
        this.trembleY = 0;
        if (this.isTrembling()) {
          this.isTrembling.set(false);
        }
      },
      { passive: true, signal }
    );

    window.addEventListener(
      'blur',
      () => {
        this.isMouseDown = false;
        this.isClicking.set(false);
        this.holdDuration = 0;
        this.trembleX = 0;
        this.trembleY = 0;
        if (this.isTrembling()) {
          this.isTrembling.set(false);
        }
      },
      { passive: true, signal }
    );

    // Fast event delegation for detecting hover over interactive elements
    document.addEventListener(
      'mouseover',
      (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const interactive = target.closest(
          'a, button, [role="button"], input, select, textarea, label, .card-cta, .bubble-card, .sound-btn, .interactive'
        );
        const shouldHover = interactive !== null;
        if (this.isHovering() !== shouldHover) {
          this.isHovering.set(shouldHover);
        }
      },
      { passive: true, signal }
    );
  }

  /**
   * Starts the 60-120 FPS requestAnimationFrame rendering loop.
   */
  private startRenderLoop(): void {
    this.lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05); // Clamp dt to prevent explosion on tab switch
      this.lastTime = currentTime;

      this.updatePhysics(dt);
      this.render();

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  /**
   * Computes position smoothing, continuous time-smoothed velocity deformation,
   * uniform click shrinkage, 2s hold subtle tremble ("Schlottern"), spring wobble, and spark emission.
   */
  private updatePhysics(dt: number): void {
    // Position follows mouse instantly for zero cursor lag
    this.currentX += (this.targetX - this.currentX) * 0.95;
    this.currentY += (this.targetY - this.currentY) * 0.95;

    // Decay target velocity if no pointer movement received for 40ms
    const timeSinceMove = performance.now() - this.lastPointerMoveTime;
    if (timeSinceMove > 40) {
      this.targetVx *= 0.82;
      this.targetVy *= 0.82;
    }

    // Exponential smoothing for continuous, flicker-free velocity
    const filterFactor = 1 - Math.exp(-dt * 16);
    this.smoothVx += (this.targetVx - this.smoothVx) * filterFactor;
    this.smoothVy += (this.targetVy - this.smoothVy) * filterFactor;

    this.currentSpeed = Math.hypot(this.smoothVx, this.smoothVy);

    // Calculate velocity orientation angle with angular wrapping
    if (this.currentSpeed > 25) {
      const targetAngle = Math.atan2(this.smoothVy, this.smoothVx);
      let angleDiff = targetAngle - this.currentAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.currentAngle += angleDiff * (1 - Math.exp(-dt * 18));
    }

    // 1. Uniform Click Shrinkage & 1-Second Hold Tremble ("Schlottern / Zittern")
    if (this.isMouseDown) {
      this.holdDuration += dt;

      if (this.holdDuration >= this.trembleHoldThreshold) {
        if (!this.isTrembling()) {
          this.isTrembling.set(true);
        }

        // Smoothly ramp in tremble intensity over 0.2s
        const ramp = Math.min((this.holdDuration - this.trembleHoldThreshold) / 0.2, 1.0);
        const now = performance.now();

        // Balanced, clearly noticeable yet refined multi-frequency shivering in all directions
        const freq1 = now * 0.055;
        const freq2 = now * 0.092;
        const freq3 = now * 0.145;
        const baseShakeX =
          Math.sin(freq1) * 0.42 + Math.cos(freq2) * 0.26 + (Math.random() - 0.5) * 0.3;
        const baseShakeY =
          Math.cos(freq1 * 1.1) * 0.42 + Math.sin(freq3) * 0.26 + (Math.random() - 0.5) * 0.3;

        // Balanced golden-mean amplitude (typically ~0.45px to 0.85px max)
        this.trembleX = baseShakeX * ramp;
        this.trembleY = baseShakeY * ramp;
      } else {
        this.trembleX = 0;
        this.trembleY = 0;
        if (this.isTrembling()) {
          this.isTrembling.set(false);
        }
      }

      const targetClickScale = 0.68; // Clean, uniform shrinkage to 68%
      this.clickScale += (targetClickScale - this.clickScale) * 0.35;
      this.wobbleOffset = 0;
      this.wobbleVelocity = 0;

      // Balanced micro-spark emission while pressed and shrunk (~13-14 sparks/sec)
      this.sparkSpawnAccumulator += dt;
      while (this.sparkSpawnAccumulator >= 0.075) {
        this.sparkSpawnAccumulator -= 0.075;
        this.spawnSpark();
      }
    } else {
      this.holdDuration = 0;
      this.trembleX = 0;
      this.trembleY = 0;
      if (this.isTrembling()) {
        this.isTrembling.set(false);
      }

      this.clickScale += (1.0 - this.clickScale) * 0.22;
      this.sparkSpawnAccumulator = 0;

      // 2. Damped Harmonic Oscillator Spring Wobble on Mouse Release
      const springForce = -this.springStiffness * this.wobbleOffset;
      const dampingForce = -this.springDamping * this.wobbleVelocity;
      const acceleration = springForce + dampingForce;

      this.wobbleVelocity += acceleration * dt;
      this.wobbleOffset += this.wobbleVelocity * dt;
    }

    // Update existing sparks (balanced deceleration and decay)
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.925; // smooth balanced deceleration
      s.vy *= 0.925;
      s.life -= dt;
      if (s.life <= 0) {
        this.sparks.splice(i, 1);
      }
    }

    // Hover scale interpolation
    const targetHover = this.isHovering() ? 1.15 : 1.0;
    this.currentHoverScale += (targetHover - this.currentHoverScale) * 0.2;
  }

  /**
   * Spawns a fine micro-pixel spark with balanced speed and drift distance.
   */
  private spawnSpark(): void {
    const isBlue = Math.random() < 0.45;
    const color = isBlue ? '#7dd3fc' : '#ffffff';
    const size = Math.random() < 0.5 ? 2.0 : 1.5; // Exactly 1.5px or 2px micro-pixel
    const angle = Math.random() * Math.PI * 2;
    // Spawn near the edge of the shrunken orb (radius ~7.5px)
    const startDist = 7.0 + Math.random() * 2.0;
    const speed = 44 + Math.random() * 30; // px/sec - lively yet controlled outward drift (~18-24px total)
    const maxLife = 0.52 + Math.random() * 0.12; // ~0.55s duration

    this.sparks.push({
      x: Math.cos(angle) * startDist,
      y: Math.sin(angle) * startDist,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size,
      color,
      life: maxLife,
      maxLife,
    });
  }

  /**
   * Applies transforms, velocity stretch, asymmetric border-radius, and renders spark particles.
   */
  private render(): void {
    const wrapper = this.cursorWrapperRef.nativeElement;
    const morph = this.cursorMorphRef.nativeElement;
    const body = this.cursorBodyRef.nativeElement;

    // Normalized speed factor [0.0 ... 1.0], calibrated to px/sec
    const speedNorm = Math.min(this.currentSpeed / 750, 1.0);

    // 1. Velocity deformation along motion axis (subtle, continuous soft-body elongation)
    const stretchFactor = 1 + speedNorm * 0.25;
    const compressFactor = 1 / Math.sqrt(stretchFactor);

    // 2. Wobble resonance on release
    const wobbleX = 1 + this.wobbleOffset * 0.28;
    const wobbleY = 1 - this.wobbleOffset * 0.18;

    // 3. Combined scale: When clicking, both X and Y shrink uniformly with clickScale
    const finalScaleX = stretchFactor * this.clickScale * wobbleX * this.currentHoverScale;
    const finalScaleY = compressFactor * this.clickScale * wobbleY * this.currentHoverScale;

    // Position wrapper directly at current cursor coordinates + subtle tremble offset
    const posX = this.currentX + this.trembleX;
    const posY = this.currentY + this.trembleY;
    wrapper.style.transform = `translate3d(${posX.toFixed(2)}px, ${posY.toFixed(2)}px, 0)`;

    // Rotate morph aligned with movement vector and apply scale
    morph.style.transform = `rotate(${this.currentAngle}rad) scale(${finalScaleX.toFixed(3)}, ${finalScaleY.toFixed(3)})`;

    // 4. Asymmetric Border-Radius for soft-body inertia bulge:
    // Leading front (+X, right): streamlined
    // Trailing back (-X, left, opposite to motion): soft rounded bulge forming naturally in the orb
    const bulgeIntensity = speedNorm * 18;
    const topBack = 50 + bulgeIntensity;
    const bottomBack = 50 + bulgeIntensity;
    const topFront = Math.max(30, 50 - bulgeIntensity * 0.65);
    const bottomFront = Math.max(30, 50 - bulgeIntensity * 0.65);

    body.style.borderRadius = `${topBack.toFixed(1)}% ${topFront.toFixed(1)}% ${bottomFront.toFixed(1)}% ${bottomBack.toFixed(1)}% / 50% 50% 50% 50%`;

    // 5. Render discrete micro-pixel sparks on canvas matching orb-target-btn animation
    if (this.sparksCtx) {
      this.sparksCtx.clearRect(0, 0, 200, 200);
      if (this.sparks.length > 0) {
        const cx = 100;
        const cy = 100;
        for (const s of this.sparks) {
          // Progress from 0 (spawn) to 1 (extinguish)
          const p = 1 - s.life / s.maxLife;

          // Opacity curve matching orb-nav @keyframes sparkShootOut:
          // 0%: opacity 1.0, 35%: 0.92, 75%: 0.50, 100%: 0.0
          let alpha = 1.0;
          if (p < 0.35) {
            alpha = 1.0 - (p / 0.35) * 0.08;
          } else if (p < 0.75) {
            alpha = 0.92 - ((p - 0.35) / 0.4) * 0.42;
          } else {
            alpha = 0.5 * (1 - (p - 0.75) / 0.25);
          }

          // Scale curve: 1.1 down to 0.4 towards extinction
          const scale = 1.1 - p * 0.7;
          const currentSize = s.size * scale;

          this.sparksCtx.fillStyle = s.color;
          this.sparksCtx.globalAlpha = Math.max(0, Math.min(1, alpha));
          this.sparksCtx.shadowColor =
            s.color === '#7dd3fc'
              ? 'rgba(125, 211, 252, 0.95)'
              : 'rgba(255, 255, 255, 0.85)';
          this.sparksCtx.shadowBlur = s.color === '#7dd3fc' ? 3 : 2;

          // Draw crisp square micro-pixel (border-radius: 0)
          this.sparksCtx.fillRect(
            cx + s.x - currentSize / 2,
            cy + s.y - currentSize / 2,
            currentSize,
            currentSize
          );
        }
        this.sparksCtx.globalAlpha = 1.0;
        this.sparksCtx.shadowBlur = 0;
      }
    }
  }
}
