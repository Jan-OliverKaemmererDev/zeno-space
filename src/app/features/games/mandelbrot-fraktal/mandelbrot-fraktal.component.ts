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
import { createMandelbrotShaderMaterial, splitDouble } from './services/mandelbrot-shader';
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
 * - True 53-bit emulated double-precision deep zoom (up to 2 Trillion ×) without pixelation.
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
  readonly currentCenterX = signal<number>(-0.65);
  readonly currentCenterY = signal<number>(0.0);
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
    const rx = formatCoordinate(this.currentCenterX(), this.totalZoom());
    const iy = formatCoordinate(this.currentCenterY(), this.totalZoom());
    const sign = this.currentCenterY() >= 0 ? '+' : '-';
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

  // ---------------------------------------------------------------------------
  // Corner Pollen Particle Overlay (Strictly Anchored to the 4 Corners)
  // ---------------------------------------------------------------------------

  private particleCtx: CanvasRenderingContext2D | null = null;
  private cornerParticles: CornerPollenParticle[] = [];
  private zoomActiveTimer = 0; // 0 = invisible, > 0 = visible and decaying
  private zoomDirection: 'in' | 'out' = 'in';

  // ---------------------------------------------------------------------------
  // Coordinates & Deep Continuous Zoom Engine
  // ---------------------------------------------------------------------------

  private currentZoom = 1.0;
  private targetZoom = 1.0;
  private readonly minZoom = 0.5;
  private readonly maxZoom = 2.0e12; // 2 Trillion × zoom without blockiness or snapping

  private targetCenterX = -0.65;
  private targetCenterY = 0.0;
  private renderCenterX = -0.65;
  private renderCenterY = 0.0;

  // Active key sets for continuous WASD and Arrow controls
  private readonly activeKeys = new Set<string>();

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

    this.shaderMaterial = createMandelbrotShaderMaterial();
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

    // Base inward angles:
    // Corner 0 (Top-Left): ~45 deg (+x, +y)
    // Corner 1 (Top-Right): ~135 deg (-x, +y)
    // Corner 2 (Bottom-Left): ~-45 deg (+x, -y)
    // Corner 3 (Bottom-Right): ~-135 deg (-x, -y)
    const baseAngles = [
      Math.PI * 0.25,
      Math.PI * 0.75,
      -Math.PI * 0.25,
      -Math.PI * 0.75,
    ];

    for (let c = 0; c < 4; c++) {
      for (let i = 0; i < countPerCorner; i++) {
        // Wide fan spread for natural corner scattering (+/- 38 deg)
        const spread = (Math.random() - 0.5) * 1.35;
        this.cornerParticles.push({
          cornerIndex: c,
          dist: Math.random() * maxReach, // Staggered along stream
          angle: baseAngles[c] + spread,
          speed: 2.2 + Math.random() * 3.6,
          radius: 0.55 + Math.random() * 0.85, // Ultra-fine pollen (0.55 - 1.4 px)
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
    this.processActiveKeys(dt);

    // Smooth inertia interpolation (Lerp)
    this.currentZoom = lerp(this.currentZoom, this.targetZoom, 0.14);
    this.renderCenterX = lerp(this.renderCenterX, this.targetCenterX, 0.14);
    this.renderCenterY = lerp(this.renderCenterY, this.targetCenterY, 0.14);

    // Split center coordinate & scale for emulated 53-bit double precision
    const [cRxHi, cRxLo] = splitDouble(this.renderCenterX);
    const [cRyHi, cRyLo] = splitDouble(this.renderCenterY);

    const currentScale = 3.0 / this.currentZoom;
    const [scaleHi, scaleLo] = splitDouble(currentScale);

    const recIter = getRecommendedIterations(this.totalZoom());
    this.shaderMaterial.uniforms['uCenterHi'].value.set(cRxHi, cRyHi);
    this.shaderMaterial.uniforms['uCenterLo'].value.set(cRxLo, cRyLo);
    this.shaderMaterial.uniforms['uScaleHi'].value = scaleHi;
    this.shaderMaterial.uniforms['uScaleLo'].value = scaleLo;
    this.shaderMaterial.uniforms['uMaxIterations'].value = recIter;
    this.shaderMaterial.uniforms['uTime'].value = timestamp * 0.001;

    // Sync with reactive UI signals
    this.currentZoomRaw.set(this.currentZoom);
    this.currentCenterX.set(this.renderCenterX);
    this.currentCenterY.set(this.renderCenterY);
    this.iterations.set(recIter);

    // Render WebGL flat 2D scene
    this.renderer.render(this.scene, this.camera);

    // Render Corner Pollen Particles overlay
    this.renderCornerPollenParticles(dt);
  };

  // ---------------------------------------------------------------------------
  // Corner Pollen Particles Renderer
  // - Particles stay strictly anchored to the 4 corners.
  // - Continuous flowing inward movement.
  // - Smooth fade-out towards the middle: particles NEVER reach the center!
  // - Fades out completely when zooming stops.
  // ---------------------------------------------------------------------------

  private renderCornerPollenParticles(dt: number): void {
    if (!this.particleCtx || !this.particleCanvasRef) return;
    const canvas = this.particleCanvasRef.nativeElement;
    const ctx = this.particleCtx;
    const width = canvas.width;
    const height = canvas.height;

    // Decay zoom activity timer
    if (this.zoomActiveTimer > 0) {
      this.zoomActiveTimer -= dt * 1.6; // Smoothly fades over ~0.62s after scrolling stops
      if (this.zoomActiveTimer < 0) {
        this.zoomActiveTimer = 0;
      }
    }

    // When inactive, clear canvas and skip rendering
    if (this.zoomActiveTimer <= 0) {
      ctx.clearRect(0, 0, width, height);
      return;
    }

    ctx.clearRect(0, 0, width, height);

    const masterOpacity = Math.min(1.0, this.zoomActiveTimer * 1.5);
    const dir = this.zoomDirection === 'in' ? 1.0 : -1.0;
    const maxReach = Math.min(Math.max(260, Math.min(width, height) * 0.44), 560);

    for (const p of this.cornerParticles) {
      // Advance particle distance along inward stream
      p.dist += p.speed * dir;

      // Loop continuously within the extended corner reach
      if (p.dist > maxReach) {
        p.dist = 0;
        p.speed = 2.2 + Math.random() * 3.6;
      } else if (p.dist < 0) {
        p.dist = maxReach;
      }

      // Lateral scattering wave for an airy, billowing wind breeze
      const progress = p.dist / maxReach;
      const lateral = Math.sin(p.dist * p.flutterFreq) * p.flutterAmp * progress;
      const rad = p.angle;
      const normalRad = rad + Math.PI * 0.5;

      const mainX = p.dist * Math.cos(rad) + lateral * Math.cos(normalRad);
      const mainY = p.dist * Math.sin(rad) + lateral * Math.sin(normalRad);

      // Compute exact screen coordinate anchored to corner with edge dispersion
      let px = 0;
      let py = 0;
      if (p.cornerIndex === 0) {
        // Top-Left
        px = mainX + p.edgeOffset * 0.7;
        py = mainY + p.edgeOffset * 0.7;
      } else if (p.cornerIndex === 1) {
        // Top-Right
        px = width + mainX - p.edgeOffset * 0.7;
        py = mainY + p.edgeOffset * 0.7;
      } else if (p.cornerIndex === 2) {
        // Bottom-Left
        px = mainX + p.edgeOffset * 0.7;
        py = height + mainY - p.edgeOffset * 0.7;
      } else {
        // Bottom-Right
        px = width + mainX - p.edgeOffset * 0.7;
        py = height + mainY - p.edgeOffset * 0.7;
      }

      // Smooth fade-out towards the middle:
      // Allows particles to be blown further into the image before softly dissolving
      const u = Math.min(1.0, Math.max(0.0, progress));
      let edgeFade = 1.0;

      if (u < 0.10) {
        // Gentle entrance near the corner border
        edgeFade = u / 0.10;
      } else if (u > 0.58) {
        // Soft quadratic dissolve before reaching the central region
        const t = (u - 0.58) / 0.42;
        const remaining = Math.max(0.0, 1.0 - t);
        edgeFade = remaining * remaining;
      }

      const particleAlpha = p.baseAlpha * edgeFade * masterOpacity;
      if (particleAlpha < 0.008) continue;

      // Ultra-fine golden pollen glow
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
        // Warm champagne highlight
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

    // WASD and Arrow keys registration
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

    // Movement speed proportional to 1/currentZoom so screen pan feels constant
    const panSpeed = (2.2 / Math.max(0.1, this.currentZoom)) * dt * 2.8;

    // W: Move Up
    if (this.activeKeys.has('w')) {
      this.targetCenterY += panSpeed;
    }
    // S: Move Down
    if (this.activeKeys.has('s')) {
      this.targetCenterY -= panSpeed;
    }
    // A: Move Left
    if (this.activeKeys.has('a')) {
      this.targetCenterX -= panSpeed;
    }
    // D: Move Right
    if (this.activeKeys.has('d')) {
      this.targetCenterX += panSpeed;
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
    const complexOffset = new THREE.Vector2(
      (mouseX * 0.5 * aspect * 3.0) / this.currentZoom,
      (mouseY * 0.5 * 3.0) / this.currentZoom
    );

    // Exact complex coordinate under mouse pointer
    const mouseC_X = this.targetCenterX + complexOffset.x;
    const mouseC_Y = this.targetCenterY + complexOffset.y;

    const zoomStep = event.deltaY < 0 ? 1.25 : 1 / 1.25;
    const nextTargetZoom = clamp(this.targetZoom * zoomStep, this.minZoom, this.maxZoom);

    // Keep the complex coordinate directly under the mouse pointer
    const newOffset = new THREE.Vector2(
      (mouseX * 0.5 * aspect * 3.0) / nextTargetZoom,
      (mouseY * 0.5 * 3.0) / nextTargetZoom
    );

    this.targetCenterX = mouseC_X - newOffset.x;
    this.targetCenterY = mouseC_Y - newOffset.y;
    this.targetZoom = nextTargetZoom;

    // Trigger corner pollen particles
    this.triggerZoomParticles(event.deltaY < 0 ? 'in' : 'out');
    this.checkZoomChime();
  }

  onPointerDown(event: PointerEvent): void {
    // Strictly flat: no drag tilt
  }

  onPointerMove(event: PointerEvent): void {
    // Strictly flat: no drag tilt
  }

  onPointerUp(event?: PointerEvent): void {
    // Strictly flat: no drag tilt
  }

  onDoubleClick(event: MouseEvent): void {
    // Double click zooms into clicked point
    const container = this.containerRef.nativeElement;
    const rect = container.getBoundingClientRect();
    const aspect = rect.width / Math.max(rect.height, 1);

    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

    const complexOffsetX = (mouseX * 0.5 * aspect * 3.0) / this.currentZoom;
    const complexOffsetY = (mouseY * 0.5 * 3.0) / this.currentZoom;

    this.targetCenterX += complexOffsetX * 0.5;
    this.targetCenterY += complexOffsetY * 0.5;
    this.targetZoom = clamp(this.targetZoom * 2.2, this.minZoom, this.maxZoom);

    this.triggerZoomParticles('in');
    this.triggerHarmonicChime();
  }

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  onZoomInStep(): void {
    this.targetZoom = clamp(this.targetZoom * 1.5, this.minZoom, this.maxZoom);
    this.triggerZoomParticles('in');
    this.triggerHarmonicChime();
  }

  /**
   * Resets view to the initial overview and frees particle canvas.
   */
  resetToOverview(): void {
    this.targetZoom = 1.0;
    this.currentZoom = 1.0;
    this.targetCenterX = -0.65;
    this.targetCenterY = 0.0;
    this.renderCenterX = -0.65;
    this.renderCenterY = 0.0;
    this.currentWaypointId.set('overview');
    this.zoomActiveTimer = 0;

    if (this.particleCtx && this.particleCanvasRef) {
      this.particleCtx.clearRect(
        0,
        0,
        this.particleCanvasRef.nativeElement.width,
        this.particleCanvasRef.nativeElement.height
      );
    }

    this.triggerHarmonicChime();
  }

  onWaypointSelected(waypoint: MandelbrotWaypoint): void {
    this.currentWaypointId.set(waypoint.id);
    this.targetCenterX = waypoint.center.re;
    this.targetCenterY = waypoint.center.im;
    this.targetZoom = clamp(waypoint.zoom, this.minZoom, this.maxZoom);
    this.triggerZoomParticles('in');
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
