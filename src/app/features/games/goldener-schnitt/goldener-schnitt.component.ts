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
import { PHI_DECIMAL_DIGITS_AFTER_618, getPhiDigitAfter618 } from './phi-digits.data';
import { PhiSeedTile } from './models/goldener-schnitt.types';
import {
  calculateSeedTarget,
  easeOutBack,
  PHYLLOTAXIS_SPREAD,
} from './utils/phyllotaxis-geometry';
import { FibonacciFrame } from './services/fibonacci-frame';
import { PhiTextureFactory } from './services/phi-texture-factory';
import { GoldenerSchnittHeaderComponent } from './components/goldener-schnitt-header/goldener-schnitt-header.component';
import { GoldenerSchnittControlsComponent } from './components/goldener-schnitt-controls/goldener-schnitt-controls.component';

/**
 * Interactive 3D Goldener Schnitt (Golden Ratio) minigame.
 * Displays glowing "1,618" at the center in Orbitron font with a pulsating Phi symbol behind it,
 * and generates subsequent seeds along the golden angle (137.5°) in a radiant sunflower phyllotaxis
 * against an unfolding Fibonacci frame and sparkling cosmic golden pollen.
 */
@Component({
  selector: 'app-goldener-schnitt',
  standalone: true,
  imports: [GoldenerSchnittHeaderComponent, GoldenerSchnittControlsComponent],
  templateUrl: './goldener-schnitt.component.html',
  styleUrl: './goldener-schnitt.component.scss',
})
export class GoldenerSchnittComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

  // Helper modules
  private readonly fibonacciFrame = new FibonacciFrame();
  private readonly textureFactory = new PhiTextureFactory();

  // ---------------------------------------------------------------------------
  // Reactive Signals for UI HUD
  // ---------------------------------------------------------------------------

  /** Count of seeds generated after "1.618". */
  readonly seedCount = signal<number>(0);

  /** Whether the automatic flow mode is active. */
  readonly isAutoFlowActive = signal<boolean>(false);

  /** Whether sound chimes are enabled. */
  readonly isSoundEnabled = signal<boolean>(true);

  /** Whether the Phi speech bubble is currently open. */
  readonly showPhiBubble = signal<boolean>(false);

  /** Whether the balloon deflate closing animation is running. */
  readonly closingPhiBubble = signal<boolean>(false);

  /** Whether the generated Phi string was recently copied to clipboard. */
  readonly isPhiCopied = signal<boolean>(false);

  private closingPhiBubbleTimeout: ReturnType<typeof setTimeout> | null = null;
  private copyPhiTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Short formatted string showing the latest digits for top HUD banner. */
  readonly currentPhiSnippet = computed(() => {
    const count = this.seedCount();
    if (count === 0) return '1,618';
    const recent = PHI_DECIMAL_DIGITS_AFTER_618.slice(0, Math.min(count, 18));
    return `1,618${recent.slice(0, 15)}${count > 15 ? '...' : ''}`;
  });

  /** All decimal digits generated after "1.618" up to current count. */
  readonly generatedPhiDecimalsAfter618 = computed(() => {
    const count = this.seedCount();
    if (count <= 0) return '';
    if (count <= PHI_DECIMAL_DIGITS_AFTER_618.length) {
      return PHI_DECIMAL_DIGITS_AFTER_618.slice(0, count);
    }
    let res = PHI_DECIMAL_DIGITS_AFTER_618;
    for (let i = PHI_DECIMAL_DIGITS_AFTER_618.length; i < count; i++) {
      res += getPhiDigitAfter618(i);
    }
    return res;
  });

  /** Total number of seeds currently placed. */
  readonly totalSeedsFormatted = computed(() => {
    return (3 + this.seedCount()).toLocaleString('de-DE');
  });

  // ---------------------------------------------------------------------------
  // Three.js Scene Members
  // ---------------------------------------------------------------------------

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationFrameId: number | null = null;
  private autoFlowIntervalId: number | null = null;
  private pendingSpawnTimeouts: number[] = [];

  /** Accumulator for frame-synced, continuous Auto-Flow generation. */
  private autoFlowTimer = 0;
  /** Counter for rhythmic alternating chime notes during Auto-Flow. */
  private autoFlowChimeCounter = 0;
  /** Interval in seconds between single seeds during Auto-Flow (~95ms). */
  private readonly AUTO_FLOW_STEP = 0.095;

  /** Total count of seeds scheduled for spawning (prevents race conditions). */
  private scheduledCount = 0;

  /** Root group containing all seeds, allowing global rotation/tilt. */
  private bloomGroup!: THREE.Group;

  /** Hero floating text mesh representing "1,618" at the center. */
  private centerTileMesh!: THREE.Mesh;

  /** Pulsating glowing Phi symbol ("φ") mesh behind "1,618". */
  private centerPhiSymbolMesh!: THREE.Mesh;

  /** Point light brightly illuminating the center and surrounding golden seeds. */
  private centerPointLight!: THREE.PointLight;

  /** Shared plane geometry for individual floating seeds. */
  private tileGeometry!: THREE.PlaneGeometry;

  /** Shared materials for floating digits 0 through 9 in warm glowing gold Orbitron font. */
  private digitMaterials: THREE.MeshBasicMaterial[] = [];

  /** High-performance InstancedMesh per decimal digit 0-9 (Königsklasse: 10 draw calls total). */
  private digitInstancedMeshes: THREE.InstancedMesh[] = [];

  /** Available instance slot pool per digit 0-9. */
  private availableInstanceIds: number[][] = [];

  /** Scratch 3D transform object for matrix updates. */
  private readonly dummyObj = new THREE.Object3D();

  /** Max instance buffer capacity allocated per digit. */
  private readonly MAX_PER_DIGIT = 320;

  /** Total count of generated digits after 1.618 (monotonically increasing). */
  private totalGeneratedCount = 0;

  /** All active floating seeds currently placed in the scene. */
  private seeds: PhiSeedTile[] = [];

  private lastFrameTime = 0;

  // ---------------------------------------------------------------------------
  // Camera & Zoom Parameters
  // ---------------------------------------------------------------------------

  private readonly minCameraZ = 2.0;
  private readonly maxCameraZ = 500.0;
  private readonly baseCameraZ = 28.0;
  private targetCameraZ = 28.0;
  private currentCameraZ = 28.0;

  /** LookAt target in 3D world space (enables panning with arrow keys). */
  private targetLookAt = new THREE.Vector3(0, -0.25, 0);
  private currentLookAt = new THREE.Vector3(0, -0.25, 0);

  /** Active arrow keys for smooth 3D spatial navigation. */
  private readonly activeArrowKeys = new Set<string>();

  /** Rotation angle of the phyllotaxis disk (fixed to 0 to keep numbers and pattern stably oriented). */
  private diskRotation = 0;
  private readonly rotationSpeed = 0;

  /** Tilt angle in radians: 0.20 (~11.5°) provides optimal 3D perspective to view phyllotaxis bowl. */
  private readonly defaultTiltX = 0.20;
  private targetTiltX = 0.20;
  private currentTiltX = 0.20;

  /** Horizontal tilt / orbit (Yaw) in radians. */
  private targetTiltY = 0;
  private currentTiltY = 0;

  // Pointer drag state for manual inspection
  private isPointerDown = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private hasDragged = false;

  // ---------------------------------------------------------------------------
  // Hover Evasion Physics
  // ---------------------------------------------------------------------------

  private readonly raycaster = new THREE.Raycaster();
  private readonly mouseNDC = new THREE.Vector2(9999, 9999);
  private isMouseInsideCanvas = false;
  private readonly bloomPlane = new THREE.Plane();
  private readonly planeHitPoint = new THREE.Vector3();
  private readonly localHitPoint = new THREE.Vector3();

  /** Current 2D displacement offset for the center "1,618" mesh. */
  private centerEvadeOffset = new THREE.Vector2(0, 0);
  /** Current scale multiplier for the center "1,618" mesh. */
  private centerEvadeScale = 1.0;
  /** Current evasion rotation in radians for the center "1,618" mesh. */
  private centerEvadeRotation = 0;

  // ---------------------------------------------------------------------------
  // Keyboard Listeners
  // ---------------------------------------------------------------------------

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      this.activeArrowKeys.add(event.key);
      return;
    }

    if (event.key === 'Escape') {
      if (this.showPhiBubble()) {
        this.closePhiBubble();
        return;
      }
      this.router.navigate(['/'], { fragment: 'bubble-hub' });
      return;
    }

    if (this.showPhiBubble() && (event.target as HTMLElement)?.closest('.speech-bubble')) {
      return;
    }

    if (event.code === 'Space' || event.key === 'Enter') {
      event.preventDefault();
      this.addFiveSeeds();
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'a') {
      this.toggleAutoFlow();
    } else if (key === 'c') {
      this.resetCameraView();
    } else if (key === 'r') {
      this.resetBloom();
    }
  }

  @HostListener('document:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      this.activeArrowKeys.delete(event.key);
    }
  }

  @HostListener('window:blur')
  onWindowBlur(): void {
    this.activeArrowKeys.clear();
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.showPhiBubble()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.stat-pill-wrapper')) return;
    this.closePhiBubble();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.renderer || !this.camera) return;
    const container = this.containerRef?.nativeElement;
    const width = container?.clientWidth || window.innerWidth;
    const height = container?.clientHeight || window.innerHeight;

    if (width <= 0 || height <= 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  async ngAfterViewInit(): Promise<void> {
    await this.textureFactory.loadOrbitronFont();
    this.initThreeScene();
    this.digitMaterials = this.textureFactory.initDigitMaterials([], this.renderer);
    this.initInstancedMeshes();
    const hero = this.textureFactory.createCenterHero(this.bloomGroup, this.renderer);
    this.centerTileMesh = hero.centerTileMesh;
    this.centerPhiSymbolMesh = hero.centerPhiSymbolMesh;
    this.fibonacciFrame.init(this.bloomGroup);
    this.animate();

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        this.textureFactory.refreshAllOrbitronTextures(
          this.centerTileMesh,
          this.digitMaterials,
          this.renderer
        );
      });
    }

    // Start with the first 5 seeds rendered
    setTimeout(() => {
      this.addFiveSeeds(false);
    }, 250);
  }

  ngOnDestroy(): void {
    if (this.closingPhiBubbleTimeout) {
      clearTimeout(this.closingPhiBubbleTimeout);
      this.closingPhiBubbleTimeout = null;
    }
    if (this.copyPhiTimeout) {
      clearTimeout(this.copyPhiTimeout);
      this.copyPhiTimeout = null;
    }
    this.stopAutoFlow();
    this.clearPendingSpawnTimeouts();

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.disposeThreeScene();
  }

  // ---------------------------------------------------------------------------
  // Three.js Initialization & Scene Setup
  // ---------------------------------------------------------------------------

  private initThreeScene(): void {
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0b07); // Warm cosmic obsidian
    this.scene.fog = new THREE.FogExp2(0x0d0b07, 0.0004);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.02, 5000);
    this.camera.position.set(0, 0, this.currentCameraZ);
    this.camera.lookAt(this.currentLookAt);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xfffbeb, 1.45);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfef08a, 2.0);
    keyLight.position.set(6, 12, 14);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xf59e0b, 0.9);
    fillLight.position.set(-8, -10, 8);
    this.scene.add(fillLight);

    this.centerPointLight = new THREE.PointLight(0xfbbf24, 2.8, 36, 1.1);
    this.centerPointLight.position.set(0, 0, 3.2);
    this.scene.add(this.centerPointLight);

    // 5. Bloom Hierarchy Group
    this.bloomGroup = new THREE.Group();
    this.scene.add(this.bloomGroup);

    // 6. Shared geometry for individual seeds
    this.tileGeometry = new THREE.PlaneGeometry(1.05, 1.05);
  }

  /**
   * Initializes high-performance InstancedMesh instances for each digit 0-9.
   * Reduces WebGL draw calls from thousands down to 10 for the entire scene.
   */
  private initInstancedMeshes(): void {
    this.digitInstancedMeshes = [];
    this.availableInstanceIds = [];

    for (let d = 0; d < 10; d++) {
      const mat = this.digitMaterials[d];
      const instMesh = new THREE.InstancedMesh(this.tileGeometry, mat, this.MAX_PER_DIGIT);
      instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      instMesh.frustumCulled = false;
      instMesh.count = this.MAX_PER_DIGIT;

      // Initialize all instance matrices to hidden position (scale 0)
      for (let i = 0; i < this.MAX_PER_DIGIT; i++) {
        this.dummyObj.position.set(0, 0, -1000);
        this.dummyObj.scale.set(0, 0, 0);
        this.dummyObj.rotation.set(0, 0, 0);
        this.dummyObj.updateMatrix();
        instMesh.setMatrixAt(i, this.dummyObj.matrix);
      }
      instMesh.instanceMatrix.needsUpdate = true;

      this.bloomGroup.add(instMesh);
      this.digitInstancedMeshes.push(instMesh);

      const ids: number[] = [];
      for (let i = this.MAX_PER_DIGIT - 1; i >= 0; i--) {
        ids.push(i);
      }
      this.availableInstanceIds.push(ids);
    }
  }

  // ---------------------------------------------------------------------------
  // Seed Spawning & Placement
  // ---------------------------------------------------------------------------

  /**
   * Adds the next 5 seeds along the golden angle phyllotaxis.
   *
   * @param playAudio - Whether to play chime sounds for this batch.
   */
  addFiveSeeds(playAudio = true): void {
    const startIdx = this.scheduledCount;
    this.scheduledCount += 5;

    for (let i = 0; i < 5; i++) {
      const seedIndex = startIdx + i;
      const delayMs = i * 70;

      const timerId = window.setTimeout(() => {
        this.spawnSingleSeed(seedIndex, playAudio, i, false);
      }, delayMs);
      this.pendingSpawnTimeouts.push(timerId);
    }
  }

  /**
   * Calculates the minimum seed index that should remain visible in the active ring.
   * Ensures the phyllotaxis ring retains a generous, constant radial thickness (>= 16.5 units)
   * as the flower expands outward, preventing the ring from becoming narrow at high numbers (3000+).
   */
  private getFadeOutCutoffIndex(totalGenerated: number): number {
    if (totalGenerated < 800) return 0;

    // Generous radial thickness of the visible ring in Three.js world units (approx. 16.5 units)
    const targetRingWidth = 16.5;
    const deltaSqrt = targetRingWidth / PHYLLOTAXIS_SPREAD; // 16.5 / 0.68 ≈ 24.26
    const sqrtN = Math.sqrt(totalGenerated);
    const innerSqrt = Math.max(0, sqrtN - deltaSqrt);
    const radiusBasedCutoff = Math.floor(innerSqrt * innerSqrt);

    // Safety ceiling on total active seeds (max 2,400) to keep 60+ FPS on any hardware
    const maxActiveCap = 2400;
    const capBasedCutoff = Math.max(0, totalGenerated - maxActiveCap);

    return Math.max(radiusBasedCutoff, capBasedCutoff);
  }

  /**
   * Spawns a single seed at its calculated phyllotaxis coordinate using InstancedMesh.
   * Employs center fade-out when seed count exceeds the dynamic botanical radial band.
   */
  private spawnSingleSeed(
    index: number,
    playAudio: boolean,
    batchPosition: number,
    isAutoFlow = false
  ): void {
    // 1. Dynamic Botanical Band: Fade out seeds that fall inside the minimum radial band thickness
    const cutoffIndex = this.getFadeOutCutoffIndex(index + 1);
    if (cutoffIndex > 0) {
      for (const s of this.seeds) {
        if (s.index < cutoffIndex && s.state !== 'fading' && s.state !== 'dead') {
          s.state = 'fading';
          s.isSleeping = false;
        }
      }
    }

    const digit = getPhiDigitAfter618(index);
    let instanceId = this.availableInstanceIds[digit]?.pop();
    if (instanceId === undefined) {
      // Slot fallback: reclaim oldest active instance of this digit
      const oldestDigitSeed = this.seeds.find((s) => s.digit === digit && s.state !== 'dead');
      if (oldestDigitSeed) {
        instanceId = oldestDigitSeed.instanceId;
        oldestDigitSeed.state = 'dead';
      } else {
        instanceId = 0;
      }
    }

    // 2. CPU-Boost: Precompute target coordinates once at spawn time
    const target = calculateSeedTarget(index, index + 1, 0, 0);

    const seed: PhiSeedTile = {
      index,
      digit,
      instanceId,
      baseX: target.x,
      baseY: target.y,
      baseZ: target.z,
      radius: target.r,
      theta: target.th,
      targetScale: target.scale,
      state: 'spawning',
      scaleProgress: 0,
      fadeProgress: 1.0,
      elevation: 0,
      elevationVelocity: 0,
      evadeOffset: new THREE.Vector2(0, 0),
      evadeScale: 1.0,
      isSleeping: false,
    };

    // 3. Set initial instance matrix with scale 0 for pop-in ease
    this.dummyObj.position.set(target.x, target.y, target.z);
    this.dummyObj.scale.set(0, 0, 0);
    this.dummyObj.rotation.set(0, 0, 0);
    this.dummyObj.updateMatrix();

    const instMesh = this.digitInstancedMeshes[digit];
    if (instMesh) {
      instMesh.setMatrixAt(instanceId, this.dummyObj.matrix);
      instMesh.instanceMatrix.needsUpdate = true;
    }

    this.seeds.push(seed);
    this.totalGeneratedCount++;
    this.seedCount.set(this.totalGeneratedCount);

    if (playAudio && this.isSoundEnabled()) {
      const pentatonicIndex = (digit + batchPosition) % 10;
      const vol = isAutoFlow ? 0.14 : 0.26;
      this.audioService.playChime(pentatonicIndex, vol);
    }
  }

  // ---------------------------------------------------------------------------
  // Main Render Loop & Animation Frame
  // ---------------------------------------------------------------------------

  private animate(): void {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    const time = performance.now() * 0.001;
    const dt = this.lastFrameTime > 0 ? Math.min(0.05, time - this.lastFrameTime) : 0.016;
    this.lastFrameTime = time;

    // Golden orbital circular motion disabled to keep the phyllotaxis structure stably oriented
    this.diskRotation = 0;

    this.fibonacciFrame.update(time, this.seedCount(), this.diskRotation);

    if (this.isAutoFlowActive()) {
      this.autoFlowTimer += dt;
      if (this.autoFlowTimer > 0.3) {
        this.autoFlowTimer = this.AUTO_FLOW_STEP;
      }
      while (this.autoFlowTimer >= this.AUTO_FLOW_STEP) {
        this.autoFlowTimer -= this.AUTO_FLOW_STEP;
        this.spawnNextSeedAuto();
      }
    }

    // Raycast for hover evasion
    let hasHit = false;
    if (this.isMouseInsideCanvas && this.camera && this.bloomGroup) {
      this.raycaster.setFromCamera(this.mouseNDC, this.camera);
      this.bloomGroup.updateMatrixWorld();
      const planeNormal = new THREE.Vector3(0, 0, 1)
        .applyEuler(this.bloomGroup.rotation)
        .normalize();
      this.bloomPlane.setFromNormalAndCoplanarPoint(planeNormal, this.bloomGroup.position);

      const hitWorld = this.raycaster.ray.intersectPlane(this.bloomPlane, this.planeHitPoint);
      if (hitWorld) {
        this.localHitPoint.copy(hitWorld);
        this.bloomGroup.worldToLocal(this.localHitPoint);
        hasHit = true;
      }
    }

    // Center Hero ("1,618") hover evasion & pulsating Phi symbol
    if (this.centerTileMesh) {
      let targetCenterPushX = 0;
      let targetCenterPushY = 0;
      let targetCenterScale = 1.0;

      if (hasHit) {
        const dx = 0 - this.localHitPoint.x;
        const dy = 0 - this.localHitPoint.y;
        const dist = Math.hypot(dx, dy);
        const radius = 1.5;

        if (dist < radius && dist > 0.001) {
          const norm = dist / radius;
          const force = Math.pow(1 - norm, 1.8);
          const pushMagnitude = 0.28;
          targetCenterPushX = (dx / dist) * force * pushMagnitude;
          targetCenterPushY = (dy / dist) * force * pushMagnitude;
          targetCenterScale = 1.0 + force * 0.06;
        }
      }

      this.centerEvadeOffset.x += (targetCenterPushX - this.centerEvadeOffset.x) * 0.25;
      this.centerEvadeOffset.y += (targetCenterPushY - this.centerEvadeOffset.y) * 0.25;
      this.centerEvadeScale += (targetCenterScale - this.centerEvadeScale) * 0.22;
      this.centerEvadeRotation = 0;

      const centerHover = Math.sin(time * 1.8) * 0.04;
      this.centerTileMesh.position.set(
        this.centerEvadeOffset.x,
        this.centerEvadeOffset.y,
        0.60 + centerHover
      );
      this.centerTileMesh.scale.set(
        this.centerEvadeScale,
        this.centerEvadeScale,
        this.centerEvadeScale
      );
      this.centerTileMesh.rotation.set(0, 0, 0);
    }

    if (this.centerPhiSymbolMesh) {
      const pulse = 1.0 + Math.sin(time * 2.2) * 0.08;
      this.centerPhiSymbolMesh.scale.set(pulse, pulse, 1.0);
      this.centerPhiSymbolMesh.rotation.set(0, 0, 0);
    }

    // CPU-Boosted Physics & Instanced Matrix updates for floating seeds
    const lerpScaleSpeed = dt * 6.5;
    const evadeLerp = 1.0 - Math.exp(-14.0 * dt);
    const springK = 46.0;
    const damping = 12.0;

    const hitX = this.localHitPoint.x;
    const hitY = this.localHitPoint.y;
    const HOVER_RADIUS = 1.55;
    const HOVER_RADIUS_SQ = HOVER_RADIUS * HOVER_RADIUS;

    const needsMatrixUpload = [false, false, false, false, false, false, false, false, false, false];
    let hasDeadSeeds = false;

    const totalSeeds = this.seeds.length;
    for (let i = 0; i < totalSeeds; i++) {
      const seed = this.seeds[i];

      // 1. Spawning pop-in animation
      let stateChanged = false;
      if (seed.state === 'spawning') {
        seed.scaleProgress += lerpScaleSpeed;
        if (seed.scaleProgress >= 1.0) {
          seed.scaleProgress = 1.0;
          seed.state = 'active';
        }
        stateChanged = true;
      }

      // 2. Center fade-out dissolve animation
      if (seed.state === 'fading') {
        seed.fadeProgress -= dt * 1.8;
        if (seed.fadeProgress <= 0) {
          seed.fadeProgress = 0;
          seed.state = 'dead';
          hasDeadSeeds = true;
        }
        stateChanged = true;
      }

      // 3. Fast spatial hover evasion check (CPU-Boost: skip Math.hypot for distant seeds)
      let targetPushX = 0;
      let targetPushY = 0;
      let targetPushScale = 1.0;

      if (hasHit && seed.state !== 'dead') {
        const dx = seed.baseX - hitX;
        const dy = seed.baseY - hitY;
        // Fast 2D bounding box rejection
        if (Math.abs(dx) < HOVER_RADIUS && Math.abs(dy) < HOVER_RADIUS) {
          const distSq = dx * dx + dy * dy;
          if (distSq < HOVER_RADIUS_SQ && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const norm = dist / HOVER_RADIUS;
            const force = Math.pow(1 - norm, 1.6);
            const pushMag = 0.58;
            targetPushX = (dx / dist) * force * pushMag;
            targetPushY = (dy / dist) * force * pushMag;
            targetPushScale = 1.0 + force * 0.16;
            seed.isSleeping = false;
          }
        }
      }

      // Spring elevation and evasion offset physics
      let physicsActive = false;
      if (!seed.isSleeping) {
        seed.evadeOffset.x += (targetPushX - seed.evadeOffset.x) * evadeLerp;
        seed.evadeOffset.y += (targetPushY - seed.evadeOffset.y) * evadeLerp;
        seed.evadeScale += (targetPushScale - seed.evadeScale) * evadeLerp;

        if (Math.abs(seed.elevation) > 0.001 || Math.abs(seed.elevationVelocity) > 0.001) {
          const force = -springK * seed.elevation - damping * seed.elevationVelocity;
          seed.elevationVelocity += force * dt;
          seed.elevation += seed.elevationVelocity * dt;

          if (Math.abs(seed.elevation) < 0.0015 && Math.abs(seed.elevationVelocity) < 0.0015) {
            seed.elevation = 0;
            seed.elevationVelocity = 0;
          }
          physicsActive = true;
        }

        const isEvading =
          Math.abs(seed.evadeOffset.x) > 0.001 ||
          Math.abs(seed.evadeOffset.y) > 0.001 ||
          Math.abs(seed.evadeScale - 1.0) > 0.005;

        if (isEvading || physicsActive) {
          physicsActive = true;
        } else if (seed.state === 'active') {
          // If completely settled, enter sleep mode to save 100% of CPU cycles
          seed.isSleeping = true;
        }
      }

      // 4. Update GPU instance matrix only if the seed is actively animating
      if (stateChanged || physicsActive || !seed.isSleeping) {
        const s =
          (seed.state === 'spawning' ? easeOutBack(seed.scaleProgress) : 1.0) *
          seed.targetScale *
          seed.evadeScale *
          seed.fadeProgress;

        this.dummyObj.position.set(
          seed.baseX + seed.evadeOffset.x,
          seed.baseY + seed.evadeOffset.y,
          seed.baseZ + seed.elevation
        );
        this.dummyObj.scale.set(s, s, s);
        this.dummyObj.rotation.set(0, 0, 0);
        this.dummyObj.updateMatrix();

        const instMesh = this.digitInstancedMeshes[seed.digit];
        if (instMesh) {
          instMesh.setMatrixAt(seed.instanceId, this.dummyObj.matrix);
          needsMatrixUpload[seed.digit] = true;
        }
      }
    }

    // 5. Commit matrix updates to WebGL for affected digit meshes
    for (let d = 0; d < 10; d++) {
      if (needsMatrixUpload[d]) {
        this.digitInstancedMeshes[d].instanceMatrix.needsUpdate = true;
      }
    }

    // 6. Clean up dead seeds that completed fading out
    if (hasDeadSeeds) {
      const remaining: PhiSeedTile[] = [];
      for (const s of this.seeds) {
        if (s.state === 'dead') {
          this.dummyObj.position.set(0, 0, -1000);
          this.dummyObj.scale.set(0, 0, 0);
          this.dummyObj.updateMatrix();
          const instMesh = this.digitInstancedMeshes[s.digit];
          if (instMesh) {
            instMesh.setMatrixAt(s.instanceId, this.dummyObj.matrix);
            instMesh.instanceMatrix.needsUpdate = true;
          }
          this.availableInstanceIds[s.digit].push(s.instanceId);
        } else {
          remaining.push(s);
        }
      }
      this.seeds = remaining;
    }

    // 3D Spatial Arrow-Keys Navigation
    if (this.activeArrowKeys.size > 0) {
      const panSpeed = Math.max(10.0, this.currentCameraZ * 0.72) * dt;

      const cosY = Math.cos(this.currentTiltY);
      const sinY = Math.sin(this.currentTiltY);
      const rightX = cosY;
      const rightZ = -sinY;

      const cosX = Math.cos(this.currentTiltX);
      const sinX = Math.sin(this.currentTiltX);
      const upX = -sinX * sinY;
      const upY = cosX;
      const upZ = -sinX * cosY;

      if (this.activeArrowKeys.has('ArrowLeft')) {
        this.targetLookAt.x -= rightX * panSpeed;
        this.targetLookAt.z -= rightZ * panSpeed;
      }
      if (this.activeArrowKeys.has('ArrowRight')) {
        this.targetLookAt.x += rightX * panSpeed;
        this.targetLookAt.z += rightZ * panSpeed;
      }
      if (this.activeArrowKeys.has('ArrowUp')) {
        this.targetLookAt.x += upX * panSpeed;
        this.targetLookAt.y += upY * panSpeed;
        this.targetLookAt.z += upZ * panSpeed;
      }
      if (this.activeArrowKeys.has('ArrowDown')) {
        this.targetLookAt.x -= upX * panSpeed;
        this.targetLookAt.y -= upY * panSpeed;
        this.targetLookAt.z -= upZ * panSpeed;
      }
    }

    const panLerp = 1.0 - Math.exp(-8.0 * dt);
    this.currentLookAt.lerp(this.targetLookAt, panLerp);

    // Camera Navigation & Orbit
    const rotLerp = 1.0 - Math.exp(-6.0 * dt);
    this.currentTiltX += (this.targetTiltX - this.currentTiltX) * rotLerp;
    this.currentTiltY += (this.targetTiltY - this.currentTiltY) * rotLerp;

    const camLerp = 1.0 - Math.exp(-4.2 * dt);
    this.currentCameraZ += (this.targetCameraZ - this.currentCameraZ) * camLerp;

    const R = this.currentCameraZ;
    const cosX = Math.cos(this.currentTiltX);
    const sinX = Math.sin(this.currentTiltX);
    const cosY = Math.cos(this.currentTiltY);
    const sinY = Math.sin(this.currentTiltY);

    const camX = this.currentLookAt.x + R * cosX * sinY;
    const camY = this.currentLookAt.y + R * sinX;
    const camZ = this.currentLookAt.z + R * cosX * cosY;

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.currentLookAt);

    this.renderer.render(this.scene, this.camera);
  }

  private spawnNextSeedAuto(): void {
    const seedIndex = this.scheduledCount++;
    this.autoFlowChimeCounter++;
    const playAudio = this.autoFlowChimeCounter % 2 === 0;
    this.spawnSingleSeed(seedIndex, playAudio, this.autoFlowChimeCounter, true);
  }

  // ---------------------------------------------------------------------------
  // Pointer Interaction
  // ---------------------------------------------------------------------------

  onPointerDown(event: PointerEvent): void {
    this.isPointerDown = true;
    this.hasDragged = false;
    this.pointerStartX = event.clientX;
    this.pointerStartY = event.clientY;

    const target = event.currentTarget as HTMLElement;
    if (target?.setPointerCapture) {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {}
    }
  }

  onPointerMove(event: PointerEvent): void {
    const container = this.containerRef?.nativeElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.mouseNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouseNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.isMouseInsideCanvas = true;
      }
    }

    if (!this.isPointerDown) return;

    const deltaX = event.clientX - this.pointerStartX;
    const deltaY = event.clientY - this.pointerStartY;

    if (!this.hasDragged) {
      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        this.hasDragged = true;
      } else {
        return;
      }
    }

    const tiltSpeed = 0.0040;
    this.targetTiltX = Math.max(-0.25, Math.min(0.65, this.targetTiltX + deltaY * tiltSpeed));
    this.targetTiltY = Math.max(-0.65, Math.min(0.65, this.targetTiltY - deltaX * tiltSpeed));

    this.pointerStartX = event.clientX;
    this.pointerStartY = event.clientY;
  }

  onPointerLeave(): void {
    this.isMouseInsideCanvas = false;
    this.mouseNDC.set(9999, 9999);
  }

  onPointerUp(event?: PointerEvent): void {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;

    if (event?.currentTarget) {
      const target = event.currentTarget as HTMLElement;
      if (target?.releasePointerCapture) {
        try {
          target.releasePointerCapture(event.pointerId);
        } catch {}
      }
    }

    if (!this.hasDragged) {
      this.addFiveSeeds();
    }
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomFactor = Math.max(0.018, this.targetCameraZ * 0.0018);
    const zoomDelta = event.deltaY * zoomFactor;
    this.targetCameraZ = Math.max(
      this.minCameraZ,
      Math.min(this.maxCameraZ, this.targetCameraZ + zoomDelta)
    );
  }

  onDoubleClick(): void {
    this.resetCameraView();
  }

  // ---------------------------------------------------------------------------
  // Phi Speech Bubble Interaction
  // ---------------------------------------------------------------------------

  togglePhiBubble(event?: Event): void {
    event?.stopPropagation();
    if (this.showPhiBubble()) {
      this.closePhiBubble();
    } else {
      this.openPhiBubble();
    }
  }

  openPhiBubble(): void {
    if (this.closingPhiBubbleTimeout) {
      clearTimeout(this.closingPhiBubbleTimeout);
      this.closingPhiBubbleTimeout = null;
    }
    this.closingPhiBubble.set(false);
    this.showPhiBubble.set(true);
    if (this.isSoundEnabled()) {
      this.audioService.playWaterdropToneOn(0.4);
    }
  }

  closePhiBubble(): void {
    if (!this.showPhiBubble() || this.closingPhiBubble()) return;
    this.closingPhiBubble.set(true);
    if (this.closingPhiBubbleTimeout) {
      clearTimeout(this.closingPhiBubbleTimeout);
    }
    this.closingPhiBubbleTimeout = setTimeout(() => {
      this.showPhiBubble.set(false);
      this.closingPhiBubble.set(false);
      this.closingPhiBubbleTimeout = null;
    }, 350);
  }

  // ---------------------------------------------------------------------------
  // HUD Actions & Controls
  // ---------------------------------------------------------------------------

  toggleAutoFlow(): void {
    if (this.isAutoFlowActive()) {
      this.stopAutoFlow();
    } else {
      this.startAutoFlow();
    }
  }

  private startAutoFlow(): void {
    this.isAutoFlowActive.set(true);
    this.audioService.playBubbleHover();
    this.autoFlowTimer = 0;
    this.autoFlowChimeCounter = 0;
  }

  private stopAutoFlow(): void {
    this.isAutoFlowActive.set(false);
    this.autoFlowTimer = 0;
    if (this.autoFlowIntervalId !== null) {
      clearInterval(this.autoFlowIntervalId);
      this.autoFlowIntervalId = null;
    }
  }

  resetCameraView(): void {
    this.targetTiltX = this.defaultTiltX;
    this.targetTiltY = 0;
    this.targetCameraZ = this.baseCameraZ;
    this.targetLookAt.set(0, -0.25, 0);
    this.audioService.playBubbleHover();
  }

  toggleSound(): void {
    this.isSoundEnabled.update((v) => !v);
  }

  resetBloom(): void {
    this.stopAutoFlow();
    this.autoFlowTimer = 0;
    this.autoFlowChimeCounter = 0;
    this.clearPendingSpawnTimeouts();

    for (let d = 0; d < 10; d++) {
      this.availableInstanceIds[d] = [];
      for (let i = 0; i < this.MAX_PER_DIGIT; i++) {
        this.availableInstanceIds[d].push(i);
        this.dummyObj.position.set(0, 0, -1000);
        this.dummyObj.scale.set(0, 0, 0);
        this.dummyObj.updateMatrix();
        this.digitInstancedMeshes[d]?.setMatrixAt(i, this.dummyObj.matrix);
      }
      if (this.digitInstancedMeshes[d]) {
        this.digitInstancedMeshes[d].count = this.MAX_PER_DIGIT;
        this.digitInstancedMeshes[d].instanceMatrix.needsUpdate = true;
      }
    }

    this.seeds = [];
    this.totalGeneratedCount = 0;
    this.seedCount.set(0);
    this.scheduledCount = 0;

    if (this.centerTileMesh) {
      this.centerTileMesh.position.set(0, 0, 0.60);
      this.centerTileMesh.scale.set(1, 1, 1);
      this.centerTileMesh.rotation.z = 0;
    }
    this.centerEvadeOffset.set(0, 0);
    this.centerEvadeScale = 1.0;
    this.centerEvadeRotation = 0;
    if (this.centerPhiSymbolMesh) {
      this.centerPhiSymbolMesh.position.set(0, 0, 0.38);
      this.centerPhiSymbolMesh.scale.set(1, 1, 1);
    }

    this.diskRotation = 0;
    this.resetCameraView();
    this.audioService.playWaterdropToneOn(0.6);

    setTimeout(() => {
      this.addFiveSeeds(false);
    }, 250);
  }

  private clearPendingSpawnTimeouts(): void {
    for (const id of this.pendingSpawnTimeouts) {
      clearTimeout(id);
    }
    this.pendingSpawnTimeouts = [];
  }

  // ---------------------------------------------------------------------------
  // Resource Cleanup
  // ---------------------------------------------------------------------------

  private disposeThreeScene(): void {
    if (this.centerTileMesh) {
      this.centerTileMesh.geometry.dispose();
      (this.centerTileMesh.material as THREE.Material).dispose();
    }
    if (this.centerPhiSymbolMesh) {
      this.centerPhiSymbolMesh.geometry.dispose();
      (this.centerPhiSymbolMesh.material as THREE.Material).dispose();
    }
    if (this.tileGeometry) {
      this.tileGeometry.dispose();
    }
    for (const instMesh of this.digitInstancedMeshes) {
      instMesh.geometry.dispose();
      this.bloomGroup.remove(instMesh);
    }
    this.digitInstancedMeshes = [];

    for (const mat of this.digitMaterials) {
      mat.dispose();
    }
    this.digitMaterials = [];

    this.fibonacciFrame.dispose(this.bloomGroup);

    if (this.renderer) {
      this.renderer.dispose();
      const dom = this.renderer.domElement;
      if (dom && dom.parentElement) {
        dom.parentElement.removeChild(dom);
      }
    }
  }
}
