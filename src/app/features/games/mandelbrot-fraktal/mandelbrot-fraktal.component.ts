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
import { Router } from '@angular/router';
import * as THREE from 'three';
import { AudioService } from '../../../core/services/audio.service';
import { MandelbrotWaypoint } from './models/mandelbrot.types';
import { MANDELBROT_WAYPOINTS } from './utils/mandelbrot-presets';
import {
  formatZoomFactor,
  formatCoordinate,
  lerp,
  clamp,
  getRecommendedIterations,
} from './utils/mandelbrot-math';
import { BigFixed } from './utils/big-fixed';
import {
  createMandelbrotShaderMaterial,
} from './services/mandelbrot-shader';
import {
  computeReferenceOrbit,
  computeRobustReferenceOrbit,
  createOrUpdateOrbitTexture,
  ReferenceOrbitResult,
} from './services/mandelbrot-reference-orbit';
import { MandelbrotHeaderComponent } from './components/mandelbrot-header/mandelbrot-header.component';
import { MandelbrotControlsComponent } from './components/mandelbrot-controls/mandelbrot-controls.component';

interface CornerPollenParticle {
  cornerIndex: number; // 0: Top-Left, 1: Top-Right, 2: Bottom-Left, 3: Bottom-Right
  dist: number; // Current distance along inward stream (0 to maxReach)
  angle: number; // Inward stream angle
  speed: number; // Particle flow speed
  radius: number; // Ultra-fine particle radius (0.55 - 1.4 px)
  colorMix: number; // Champagne vs amber gold
  baseAlpha: number; // Peak base alpha
  flutterFreq: number; // Frequency of lateral air wave
  flutterAmp: number; // Amplitude of lateral scatter wave
  edgeOffset: number; // Spawn displacement along the screen borders
}

/**
 * Interactive Flat 2D Mandelbrot Fractal Minigame.
 * Features:
 * - Perturbation Theory with 128-bit CPU reference orbit for deep zoom (up to 10^30) without pixelation.
 * - Smooth continuous camera travel with zero snapping or abrupt resets.
 * - Corner pollen particle fountains that appear strictly in the 4 corners, stream inwards,
 *   and fade out smoothly towards the center without ever intruding into the middle of the screen.
 * - Mouse wheel zoom centered strictly on mouse pointer position.
 * - WASD directional panning across the complex plane.
 * - Complete reset and memory cleanup on "Neustart".
 */
@Component({
  selector: 'app-mandelbrot-fraktal',
  standalone: true,
  imports: [MandelbrotHeaderComponent, MandelbrotControlsComponent],
  templateUrl: './mandelbrot-fraktal.component.html',
  styleUrl: './mandelbrot-fraktal.component.scss',
})
export class MandelbrotFraktalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('particleCanvas') particleCanvasRef!: ElementRef<HTMLCanvasElement>;

  readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

  // ---------------------------------------------------------------------------
  // Reactive Signals for UI HUD
  // ---------------------------------------------------------------------------

  readonly currentZoomRaw = signal<number>(1.0);
  readonly currentCenterX = signal<number | string>('-0.65');
  readonly currentCenterY = signal<number | string>('0.0');
  readonly iterations = signal<number>(100);
  readonly isSoundEnabled = signal<boolean>(true);
  readonly currentWaypointId = signal<string>('overview');

  readonly showBubble = signal<boolean>(false);
  readonly closingBubble = signal<boolean>(false);
  private closingBubbleTimeout: ReturnType<typeof setTimeout> | null = null;

  // Direct total zoom factor
  readonly totalZoom = computed(() => this.currentZoomRaw());

  // Dynamic procedural depth tier for educational HUD badge
  readonly generationLevel = computed(() => {
    const z = Math.max(1, this.currentZoomRaw());
    return Math.max(0, Math.floor(Math.log10(z) / 2.4));
  });

  readonly zoomFormatted = computed(() => formatZoomFactor(this.totalZoom()));

  readonly coordSnippet = computed(() => {
    const rx = formatCoordinate(this.renderCenterX, this.totalZoom());
    const iy = formatCoordinate(this.renderCenterY, this.totalZoom());
    const sign = this.renderCenterY.raw >= 0n ? '+' : '-';
    return `c = ${rx} ${sign} ${iy.replace('-', '')}i`;
  });

  readonly currentWaypointName = computed(() => {
    const wp = MANDELBROT_WAYPOINTS.find((w) => w.id === this.currentWaypointId());
    return wp ? wp.name : 'Mandelbrot Fraktal';
  });

  // ---------------------------------------------------------------------------
  // Three.js Members (Strictly Flat 2D Viewport)
  // ---------------------------------------------------------------------------

  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private fractalMesh!: THREE.Mesh;
  private shaderMaterial!: THREE.ShaderMaterial;

  // Stable Reference Orbit for Perturbation Theory (Mode 1)
  private orbitTexture: THREE.DataTexture | null = null;
  private refOrbitResult: ReferenceOrbitResult | null = null;
  private refCenterRe: BigFixed = BigFixed.fromNumber(-0.65);
  private refCenterIm: BigFixed = BigFixed.zero();
  private refZoom: number = 1.0;
  private refMaxIter: number = 120;

  // ---------------------------------------------------------------------------
  // Corner Pollen Particle Overlay (Strictly Anchored to the 4 Corners)
  // ---------------------------------------------------------------------------

  private particleCtx: CanvasRenderingContext2D | null = null;
  private cornerParticles: CornerPollenParticle[] = [];
  private zoomActiveTimer = 0; // 0 = invisible, > 0 = visible and decaying
  private zoomDirection: 'in' | 'out' = 'in';

  // ---------------------------------------------------------------------------
  // Coordinates & Deep Continuous Zoom Engine (128-bit BigFixed)
  // ---------------------------------------------------------------------------

  private currentZoom = 1.0;
  private targetZoom = 1.0;
  private readonly minZoom = 0.5;
  private readonly maxZoom = 1.0e30; // Limitless zoom up to 10^30

  private targetCenterX: BigFixed = BigFixed.fromNumber(-0.65);
  private targetCenterY: BigFixed = BigFixed.zero();
  private renderCenterX: BigFixed = BigFixed.fromNumber(-0.65);
  private renderCenterY: BigFixed = BigFixed.zero();

  // Reset animation state
  private isResetting = false;
  private resetStartCenterRe: BigFixed = BigFixed.fromNumber(-0.65);
  private resetStartCenterIm: BigFixed = BigFixed.zero();

  // Waypoint flight animation state
  private isFlying = false;
  private flightStartCenterRe: BigFixed = BigFixed.fromNumber(-0.65);
  private flightStartCenterIm: BigFixed = BigFixed.zero();
  private flightTargetCenterRe: BigFixed = BigFixed.fromNumber(-0.65);
  private flightTargetCenterIm: BigFixed = BigFixed.zero();
  private flightStartZoom = 1.0;
  private flightTargetZoom = 1.0;
  private flightProgress = 0.0;
  private flightDuration = 1.6;

  // Active key sets for continuous WASD and Arrow controls
  private readonly activeKeys = new Set<string>();

  // Mouse drag panning state (matches WASD pan across complex space)
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragOriginCenterX: BigFixed = BigFixed.fromNumber(-0.65);
  private dragOriginCenterY: BigFixed = BigFixed.zero();

  // Audio chimes pacing
  private lastChimeZoomLog = 0;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  ngAfterViewInit(): void {
    this.initThree();
    this.initParticleCanvas();
    this.setupResizeObserver();
    this.animate(0);
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.closingBubbleTimeout) {
      clearTimeout(this.closingBubbleTimeout);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.disposeThree();
  }

  // ---------------------------------------------------------------------------
  // Three.js Setup (Flat 2D Viewport)
  // ---------------------------------------------------------------------------

  private initThree(): void {
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e0a06);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    this.camera.position.set(0, 0, 1);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(this.renderer.domElement);

    // Initial reference orbit
    this.refOrbitResult = computeRobustReferenceOrbit(
      this.renderCenterX,
      this.renderCenterY,
      3.0,
      null
    );
    this.orbitTexture = createOrUpdateOrbitTexture(null, this.refOrbitResult.data, 2048);
    this.refCenterRe = this.refOrbitResult.centerRe;
    this.refCenterIm = this.refOrbitResult.centerIm;
    this.refZoom = 1.0;
    this.refMaxIter = this.refOrbitResult.escapeIteration;

    this.shaderMaterial = createMandelbrotShaderMaterial(this.orbitTexture);
    this.shaderMaterial.uniforms['uResolution'].value.set(width, height);

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    this.fractalMesh = new THREE.Mesh(quadGeo, this.shaderMaterial);
    this.scene.add(this.fractalMesh);
  }

  // ---------------------------------------------------------------------------
  // Corner Pollen Particle Overlay Setup (Strictly 4 Screen Corners)
  // ---------------------------------------------------------------------------

  private initParticleCanvas(): void {
    const canvas = this.particleCanvasRef.nativeElement;
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    canvas.width = width;
    canvas.height = height;
    this.particleCtx = canvas.getContext('2d');

    this.createCornerPollenPool(width, height);
  }

  private createCornerPollenPool(width: number, height: number): void {
    this.cornerParticles = [];
    const countPerCorner = 110; // 440 fine golden pollen particles in total
    const maxReach = Math.min(Math.max(260, Math.min(width, height) * 0.44), 560);

    const baseAngles = [
      Math.PI * 0.25,
      Math.PI * 0.75,
      -Math.PI * 0.25,
      -Math.PI * 0.75,
    ];

    for (let c = 0; c < 4; c++) {
      for (let i = 0; i < countPerCorner; i++) {
        const spread = (Math.random() - 0.5) * 1.35;
        this.cornerParticles.push({
          cornerIndex: c,
          dist: Math.random() * maxReach,
          angle: baseAngles[c] + spread,
          speed: 2.2 + Math.random() * 3.6,
          radius: 0.55 + Math.random() * 0.85,
          colorMix: Math.random(),
          baseAlpha: 0.45 + Math.random() * 0.45,
          flutterFreq: 0.016 + Math.random() * 0.024,
          flutterAmp: 10.0 + Math.random() * 24.0,
          edgeOffset: (Math.random() - 0.5) * 60.0,
        });
      }
    }
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          this.handleResize(width, height);
        }
      }
    });
    this.resizeObserver.observe(this.containerRef.nativeElement);
  }

  private handleResize(width: number, height: number): void {
    if (this.renderer && this.shaderMaterial) {
      this.renderer.setSize(width, height);
      this.shaderMaterial.uniforms['uResolution'].value.set(width, height);
    }

    if (this.particleCanvasRef) {
      const pCanvas = this.particleCanvasRef.nativeElement;
      pCanvas.width = width;
      pCanvas.height = height;
      this.createCornerPollenPool(width, height);
    }
  }

  // ---------------------------------------------------------------------------
  // Main Render Loop
  // ---------------------------------------------------------------------------

  private animate = (timestamp: number): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    const dt = 0.016;

    // Process continuous WASD & arrow key movements
    if (this.activeKeys.size > 0) {
      this.isResetting = false;
      this.processActiveKeys(dt);
    }

    if (this.isResetting) {
      // Smooth logarithmic zoom out
      const curLog = Math.log(this.currentZoom);
      const newLog = curLog * 0.93;

      if (newLog < 0.015) {
        this.currentZoom = 1.0;
        this.targetZoom = 1.0;
        this.renderCenterX = this.targetCenterX;
        this.renderCenterY = this.targetCenterY;
        this.isResetting = false;
      } else {
        this.currentZoom = Math.exp(newLog);

        // Keep centered on deep feature until overview region is in sight,
        // then smoothly blend toward (-0.65, 0.0)
        if (this.currentZoom > 4.0) {
          this.renderCenterX = this.resetStartCenterRe;
          this.renderCenterY = this.resetStartCenterIm;
        } else {
          const t = Math.max(0, Math.min(1, (4.0 - this.currentZoom) / 3.0));
          const smoothT = t * t * (3.0 - 2.0 * t);
          this.renderCenterX = this.resetStartCenterRe.add(
            this.targetCenterX.sub(this.resetStartCenterRe).mulNumber(smoothT)
          );
          this.renderCenterY = this.resetStartCenterIm.add(
            this.targetCenterY.sub(this.resetStartCenterIm).mulNumber(smoothT)
          );
        }
      }

      this.triggerZoomParticles('out');
      this.checkZoomChime();
    } else if (this.isFlying) {
      this.flightProgress += dt / this.flightDuration;

      if (this.flightProgress >= 1.0) {
        this.flightProgress = 1.0;
        this.currentZoom = this.flightTargetZoom;
        this.renderCenterX = this.flightTargetCenterRe;
        this.renderCenterY = this.flightTargetCenterIm;
        this.isFlying = false;
      } else {
        const t = this.flightProgress;

        // Smooth ease-in-out curve for zoom
        const zoomT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        // Center curve: align target location before diving into high zoom
        const isZoomingIn = this.flightTargetZoom >= this.flightStartZoom;
        const centerT = isZoomingIn
          ? 1 - Math.pow(1 - t, 2.2)
          : Math.pow(t, 2.2);

        // Continuous logarithmic zoom
        const logStart = Math.log(this.flightStartZoom);
        const logTarget = Math.log(this.flightTargetZoom);
        const curLog = logStart + (logTarget - logStart) * zoomT;
        this.currentZoom = Math.exp(curLog);

        // Smooth coordinate interpolation across complex space
        const diffX = this.flightTargetCenterRe.sub(this.flightStartCenterRe);
        const diffY = this.flightTargetCenterIm.sub(this.flightStartCenterIm);
        this.renderCenterX = this.flightStartCenterRe.add(diffX.mulNumber(centerT));
        this.renderCenterY = this.flightStartCenterIm.add(diffY.mulNumber(centerT));

        this.triggerZoomParticles(isZoomingIn ? 'in' : 'out');
        this.checkZoomChime();
      }
    } else {
      // Smooth inertia interpolation (Lerp)
      this.currentZoom = lerp(this.currentZoom, this.targetZoom, 0.14);
      const diffX = this.targetCenterX.sub(this.renderCenterX);
      this.renderCenterX = this.renderCenterX.add(diffX.mulNumber(0.14));
      const diffY = this.targetCenterY.sub(this.renderCenterY);
      this.renderCenterY = this.renderCenterY.add(diffY.mulNumber(0.14));
    }

    const recIter = getRecommendedIterations(this.totalZoom());
    const currentScale = 3.0 / this.currentZoom;

    this.shaderMaterial.uniforms['uTime'].value = timestamp * 0.001;
    this.shaderMaterial.uniforms['uMaxIterations'].value = recIter;
    this.shaderMaterial.uniforms['uScale'].value = currentScale;

    this.shaderMaterial.uniforms['uCenter'].value.set(
      this.renderCenterX.toNumber(),
      this.renderCenterY.toNumber()
    );

    if (this.currentZoom < 1000) {
      // Mode 0: Fast direct float32 for overview (zoom < 1000)
      this.shaderMaterial.uniforms['uMode'].value = 0;
    } else {
      // Mode 1: Perturbation Theory (Deep zoom >= 1000, up to 10^30)
      this.shaderMaterial.uniforms['uMode'].value = 1;

      // Stable reference orbit re-anchoring check
      const diffX = this.renderCenterX.sub(this.refCenterRe).toNumber();
      const diffY = this.renderCenterY.sub(this.refCenterIm).toNumber();
      const distFromRef = Math.hypot(diffX, diffY);

      // Re-anchor ONLY when:
      // 1. We have no orbit yet
      // 2. The camera panned so far away that refCenter is off-screen by more than 2 screen widths
      const needsNewOrbit =
        !this.refOrbitResult ||
        distFromRef > currentScale * 2.0;

      if (needsNewOrbit) {
        this.refOrbitResult = computeRobustReferenceOrbit(
          this.renderCenterX,
          this.renderCenterY,
          currentScale,
          this.refOrbitResult
        );
        this.refCenterRe = this.refOrbitResult.centerRe;
        this.refCenterIm = this.refOrbitResult.centerIm;
        this.refZoom = this.currentZoom;
        this.refMaxIter = this.refOrbitResult.escapeIteration;
        createOrUpdateOrbitTexture(this.orbitTexture, this.refOrbitResult.data);
      }

      // Exact offset from stable reference center to camera center in float32
      const deltaRe = this.renderCenterX.sub(this.refCenterRe).toNumber();
      const deltaIm = this.renderCenterY.sub(this.refCenterIm).toNumber();
      this.shaderMaterial.uniforms['uDeltaCenter'].value.set(deltaRe, deltaIm);
      this.shaderMaterial.uniforms['uRefEscapeIter'].value =
        this.refOrbitResult?.escapeIteration ?? 2048;
    }

    // Sync with reactive UI signals
    this.currentZoomRaw.set(this.currentZoom);
    this.currentCenterX.set(formatCoordinate(this.renderCenterX, this.currentZoom));
    this.currentCenterY.set(formatCoordinate(this.renderCenterY, this.currentZoom));
    this.iterations.set(recIter);

    // Render WebGL flat 2D scene
    this.renderer.render(this.scene, this.camera);

    // Render Corner Pollen Particles overlay
    this.renderCornerPollenParticles(dt);
  };

  // ---------------------------------------------------------------------------
  // Corner Pollen Particles Renderer
  // ---------------------------------------------------------------------------

  private renderCornerPollenParticles(dt: number): void {
    if (!this.particleCtx || !this.particleCanvasRef) return;
    const canvas = this.particleCanvasRef.nativeElement;
    const ctx = this.particleCtx;
    const width = canvas.width;
    const height = canvas.height;

    if (this.zoomActiveTimer > 0) {
      this.zoomActiveTimer -= dt * 1.6;
      if (this.zoomActiveTimer < 0) {
        this.zoomActiveTimer = 0;
      }
    }

    if (this.zoomActiveTimer <= 0) {
      ctx.clearRect(0, 0, width, height);
      return;
    }

    ctx.clearRect(0, 0, width, height);

    const masterOpacity = Math.min(1.0, this.zoomActiveTimer * 1.5);
    const dir = this.zoomDirection === 'in' ? 1.0 : -1.0;
    const maxReach = Math.min(Math.max(260, Math.min(width, height) * 0.44), 560);

    for (const p of this.cornerParticles) {
      p.dist += p.speed * dir;

      if (p.dist > maxReach) {
        p.dist = 0;
        p.speed = 2.2 + Math.random() * 3.6;
      } else if (p.dist < 0) {
        p.dist = maxReach;
      }

      const progress = p.dist / maxReach;
      const lateral = Math.sin(p.dist * p.flutterFreq) * p.flutterAmp * progress;
      const rad = p.angle;
      const normalRad = rad + Math.PI * 0.5;

      const mainX = p.dist * Math.cos(rad) + lateral * Math.cos(normalRad);
      const mainY = p.dist * Math.sin(rad) + lateral * Math.sin(normalRad);

      let px = 0;
      let py = 0;
      if (p.cornerIndex === 0) {
        px = mainX + p.edgeOffset * 0.7;
        py = mainY + p.edgeOffset * 0.7;
      } else if (p.cornerIndex === 1) {
        px = width + mainX - p.edgeOffset * 0.7;
        py = mainY + p.edgeOffset * 0.7;
      } else if (p.cornerIndex === 2) {
        px = mainX + p.edgeOffset * 0.7;
        py = height + mainY - p.edgeOffset * 0.7;
      } else {
        px = width + mainX - p.edgeOffset * 0.7;
        py = height + mainY - p.edgeOffset * 0.7;
      }

      const u = Math.min(1.0, Math.max(0.0, progress));
      let edgeFade = 1.0;

      if (u < 0.10) {
        edgeFade = u / 0.10;
      } else if (u > 0.58) {
        const t = (u - 0.58) / 0.42;
        const remaining = Math.max(0.0, 1.0 - t);
        edgeFade = remaining * remaining;
      }

      const particleAlpha = p.baseAlpha * edgeFade * masterOpacity;
      if (particleAlpha < 0.008) continue;

      const drawRadius = Math.max(0.7, p.radius * 1.8);
      const grad = ctx.createRadialGradient(px, py, 0, px, py, drawRadius);

      if (p.colorMix < 0.45) {
        grad.addColorStop(0.0, `rgba(255, 255, 255, ${particleAlpha})`);
        grad.addColorStop(0.35, `rgba(254, 240, 138, ${particleAlpha * 0.9})`);
        grad.addColorStop(0.75, `rgba(245, 158, 11, ${particleAlpha * 0.35})`);
        grad.addColorStop(1.0, 'rgba(245, 158, 11, 0.0)');
      } else if (p.colorMix < 0.8) {
        grad.addColorStop(0.0, `rgba(255, 250, 220, ${particleAlpha})`);
        grad.addColorStop(0.35, `rgba(251, 191, 36, ${particleAlpha * 0.85})`);
        grad.addColorStop(0.75, `rgba(217, 119, 6, ${particleAlpha * 0.3})`);
        grad.addColorStop(1.0, 'rgba(217, 119, 6, 0.0)');
      } else {
        grad.addColorStop(0.0, `rgba(255, 255, 245, ${particleAlpha})`);
        grad.addColorStop(0.45, `rgba(253, 230, 138, ${particleAlpha * 0.75})`);
        grad.addColorStop(1.0, 'rgba(253, 230, 138, 0.0)');
      }

      ctx.beginPath();
      ctx.arc(px, py, drawRadius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  private triggerZoomParticles(direction: 'in' | 'out'): void {
    this.zoomDirection = direction;
    this.zoomActiveTimer = 1.0;
  }

  // ---------------------------------------------------------------------------
  // Keyboard Listeners (Strictly WASD Movement + Arrow Keys Zoom)
  // ---------------------------------------------------------------------------

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();

    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown'].includes(key)) {
      event.preventDefault();
      this.activeKeys.add(key);
      return;
    }

    if (event.key === 'Escape') {
      if (this.showBubble()) {
        this.closeBubble();
        return;
      }
      this.router.navigate(['/'], { fragment: 'bubble-hub' });
      return;
    }

    if (this.showBubble() && (event.target as HTMLElement)?.closest('.speech-bubble')) {
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      this.onZoomInStep();
      return;
    }

    if (key === 'r') {
      this.resetToOverview();
    }
  }

  @HostListener('document:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (this.activeKeys.has(key)) {
      this.activeKeys.delete(key);
    }
  }

  private processActiveKeys(dt: number): void {
    if (this.activeKeys.size === 0) return;
    this.isResetting = false;
    this.isFlying = false;

    // Movement speed proportional to 1/currentZoom so screen pan feels constant
    const panStep = (2.2 / Math.max(0.1, this.currentZoom)) * dt * 2.8;
    const panDeltaFixed = BigFixed.fromNumber(panStep);

    // W: Move Up
    if (this.activeKeys.has('w')) {
      this.targetCenterY = this.targetCenterY.add(panDeltaFixed);
    }
    // S: Move Down
    if (this.activeKeys.has('s')) {
      this.targetCenterY = this.targetCenterY.sub(panDeltaFixed);
    }
    // A: Move Left
    if (this.activeKeys.has('a')) {
      this.targetCenterX = this.targetCenterX.sub(panDeltaFixed);
    }
    // D: Move Right
    if (this.activeKeys.has('d')) {
      this.targetCenterX = this.targetCenterX.add(panDeltaFixed);
    }

    // ArrowUp: Zoom In
    if (this.activeKeys.has('arrowup')) {
      this.targetZoom = clamp(this.targetZoom * 1.04, this.minZoom, this.maxZoom);
      this.triggerZoomParticles('in');
      this.checkZoomChime();
    }
    // ArrowDown: Zoom Out
    if (this.activeKeys.has('arrowdown')) {
      this.targetZoom = clamp(this.targetZoom / 1.04, this.minZoom, this.maxZoom);
      this.triggerZoomParticles('out');
      this.checkZoomChime();
    }
  }

  // ---------------------------------------------------------------------------
  // Mouse Wheel Zoom (Focuses Precisely on Mouse Pointer Location)
  // ---------------------------------------------------------------------------

  onWheel(event: WheelEvent): void {
    event.preventDefault();

    const container = this.containerRef.nativeElement;
    const rect = container.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    const aspect = rect.width / Math.max(rect.height, 1);

    // Offset in complex space relative to center at current zoom
    const complexOffsetX = (mouseX * 0.5 * aspect * 3.0) / this.currentZoom;
    const complexOffsetY = (mouseY * 0.5 * 3.0) / this.currentZoom;

    // Exact complex coordinate under mouse pointer
    const mouseC_X = this.targetCenterX.add(BigFixed.fromNumber(complexOffsetX));
    const mouseC_Y = this.targetCenterY.add(BigFixed.fromNumber(complexOffsetY));

    const zoomStep = event.deltaY < 0 ? 1.25 : 1 / 1.25;
    const nextTargetZoom = clamp(this.targetZoom * zoomStep, this.minZoom, this.maxZoom);

    // Keep the complex coordinate directly under the mouse pointer
    const newOffsetX = (mouseX * 0.5 * aspect * 3.0) / nextTargetZoom;
    const newOffsetY = (mouseY * 0.5 * 3.0) / nextTargetZoom;

    this.isResetting = false;
    this.isFlying = false;
    this.targetCenterX = mouseC_X.sub(BigFixed.fromNumber(newOffsetX));
    this.targetCenterY = mouseC_Y.sub(BigFixed.fromNumber(newOffsetY));
    this.targetZoom = nextTargetZoom;

    // Trigger corner pollen particles
    this.triggerZoomParticles(event.deltaY < 0 ? 'in' : 'out');
    this.checkZoomChime();
  }

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return; // Primary mouse button only
    if (this.showBubble()) {
      this.closeBubble();
    }
    this.isDragging = true;
    this.isResetting = false;
    this.isFlying = false;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragOriginCenterX = this.targetCenterX;
    this.dragOriginCenterY = this.targetCenterY;
    try {
      (event.target as HTMLElement)?.setPointerCapture?.(event.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported or denied
    }
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging) return;

    const container = this.containerRef?.nativeElement;
    const height = Math.max(container?.clientHeight || window.innerHeight, 1);

    const deltaPixelsX = event.clientX - this.dragStartX;
    const deltaPixelsY = event.clientY - this.dragStartY;

    const currentScale = 3.0 / this.currentZoom;
    const complexDeltaX = (deltaPixelsX / height) * currentScale;
    const complexDeltaY = (deltaPixelsY / height) * currentScale;

    this.targetCenterX = this.dragOriginCenterX.sub(BigFixed.fromNumber(complexDeltaX));
    this.targetCenterY = this.dragOriginCenterY.add(BigFixed.fromNumber(complexDeltaY));
  }

  onPointerUp(event?: PointerEvent): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (event) {
      try {
        (event.target as HTMLElement)?.releasePointerCapture?.(event.pointerId);
      } catch {
        // Ignore if pointer release fails
      }
    }
  }

  @HostListener('window:pointerup')
  onWindowPointerUp(): void {
    if (this.isDragging) {
      this.isDragging = false;
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.showBubble()) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (target.closest('.mandelbrot-speech-bubble') || target.closest('.mandelbrot-snippet-pill')) {
      return;
    }

    this.closeBubble();
  }

  onDoubleClick(event: MouseEvent): void {
    this.isResetting = false;
    this.isFlying = false;
    const container = this.containerRef.nativeElement;
    const rect = container.getBoundingClientRect();
    const aspect = rect.width / Math.max(rect.height, 1);

    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

    const complexOffsetX = (mouseX * 0.5 * aspect * 3.0) / this.currentZoom;
    const complexOffsetY = (mouseY * 0.5 * 3.0) / this.currentZoom;

    this.targetCenterX = this.targetCenterX.add(BigFixed.fromNumber(complexOffsetX * 0.5));
    this.targetCenterY = this.targetCenterY.add(BigFixed.fromNumber(complexOffsetY * 0.5));
    this.targetZoom = clamp(this.targetZoom * 2.2, this.minZoom, this.maxZoom);

    this.triggerZoomParticles('in');
    this.triggerHarmonicChime();
  }

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  onZoomInStep(): void {
    this.isResetting = false;
    this.isFlying = false;
    this.targetZoom = clamp(this.targetZoom * 1.5, this.minZoom, this.maxZoom);
    this.triggerZoomParticles('in');
    this.triggerHarmonicChime();
  }

  /**
   * Resets view to the initial overview with a smooth, cinematic zoom-out animation.
   */
  resetToOverview(): void {
    this.isFlying = false;
    this.currentWaypointId.set('overview');
    this.targetZoom = 1.0;
    this.targetCenterX = BigFixed.fromNumber(-0.65);
    this.targetCenterY = BigFixed.zero();

    if (this.currentZoom > 1.05) {
      this.isResetting = true;
      this.resetStartCenterRe = this.renderCenterX;
      this.resetStartCenterIm = this.renderCenterY;
      this.triggerZoomParticles('out');
    } else {
      this.isResetting = false;
      this.currentZoom = 1.0;
      this.renderCenterX = BigFixed.fromNumber(-0.65);
      this.renderCenterY = BigFixed.zero();
      this.currentZoomRaw.set(1.0);
      if (this.particleCtx && this.particleCanvasRef) {
        this.particleCtx.clearRect(
          0,
          0,
          this.particleCanvasRef.nativeElement.width,
          this.particleCanvasRef.nativeElement.height
        );
      }
    }

    this.refOrbitResult = null;
    this.triggerHarmonicChime();
  }

  onWaypointSelected(waypoint: MandelbrotWaypoint): void {
    this.isResetting = false;
    this.currentWaypointId.set(waypoint.id);
    const destCenterX =
      typeof waypoint.center.re === 'string'
        ? BigFixed.fromString(waypoint.center.re)
        : BigFixed.fromNumber(waypoint.center.re);
    const destCenterY =
      typeof waypoint.center.im === 'string'
        ? BigFixed.fromString(waypoint.center.im)
        : BigFixed.fromNumber(waypoint.center.im);
    const destZoom = clamp(waypoint.zoom, this.minZoom, this.maxZoom);

    this.targetCenterX = destCenterX;
    this.targetCenterY = destCenterY;
    this.targetZoom = destZoom;

    // Start smooth cosmic flight
    this.isFlying = true;
    this.flightStartCenterRe = this.renderCenterX;
    this.flightStartCenterIm = this.renderCenterY;
    this.flightTargetCenterRe = destCenterX;
    this.flightTargetCenterIm = destCenterY;
    this.flightStartZoom = Math.max(1.0, this.currentZoom);
    this.flightTargetZoom = destZoom;
    this.flightProgress = 0.0;

    const logSpan = Math.abs(Math.log10(this.flightTargetZoom) - Math.log10(this.flightStartZoom));
    this.flightDuration = Math.max(1.3, Math.min(2.8, 1.1 + logSpan * 0.16));

    this.zoomDirection = destZoom >= this.currentZoom ? 'in' : 'out';
    this.zoomActiveTimer = 1.0;
    this.triggerZoomParticles(this.zoomDirection);
    this.triggerHarmonicChime();
  }

  toggleSound(): void {
    this.isSoundEnabled.update((v) => !v);
  }

  toggleBubble(event?: Event): void {
    event?.stopPropagation();
    if (this.showBubble()) {
      this.closeBubble();
    } else {
      this.showBubble.set(true);
      this.closingBubble.set(false);
    }
  }

  closeBubble(): void {
    if (!this.showBubble() || this.closingBubble()) return;
    this.closingBubble.set(true);
    this.closingBubbleTimeout = setTimeout(() => {
      this.showBubble.set(false);
      this.closingBubble.set(false);
    }, 350);
  }

  // ---------------------------------------------------------------------------
  // Sound Chime Feedback
  // ---------------------------------------------------------------------------

  private checkZoomChime(): void {
    const logVal = Math.log10(Math.max(1, this.totalZoom()));
    if (Math.abs(logVal - this.lastChimeZoomLog) > 0.45) {
      this.lastChimeZoomLog = logVal;
      this.triggerHarmonicChime();
    }
  }

  private triggerHarmonicChime(): void {
    if (!this.isSoundEnabled()) return;
    const noteIndex = Math.floor(Math.abs(Math.log10(Math.max(1, this.totalZoom())) * 2)) % 8;
    this.audioService.playChime(noteIndex, 0.16);
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  private disposeThree(): void {
    if (this.orbitTexture) {
      this.orbitTexture.dispose();
      this.orbitTexture = null;
    }
    if (this.fractalMesh) {
      this.fractalMesh.geometry.dispose();
      (this.fractalMesh.material as THREE.Material).dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}
