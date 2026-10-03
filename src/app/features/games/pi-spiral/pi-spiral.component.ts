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
import { PI_DECIMAL_DIGITS_AFTER_14, getPiDigitAfter14 } from './pi-digits.data';
import { MosaicTile, FunnelPoint } from './models/pi-spiral.types';
import {
  getWormholeSpine,
  precomputeFunnelPoints,
  calculateTileTarget,
  calculateTileOpacity,
  easeOutBack,
} from './utils/spiral-geometry';
import { WormholeTunnel } from './services/wormhole-tunnel';
import { PiTextureFactory } from './services/pi-texture-factory';
import { PiSpiralHeaderComponent } from './components/pi-spiral-header/pi-spiral-header.component';
import { PiSpiralControlsComponent } from './components/pi-spiral-controls/pi-spiral-controls.component';

/**
 * Interactive 3D Pi Spiral Horizon minigame.
 * Displays glowing "3,14" at the center in Orbitron font with a pulsating Pi symbol behind it,
 * and generates subsequent decimal digits as free-floating blue numbers along the spiral funnel
 * into the cosmic pixel wormhole.
 */
@Component({
  selector: 'app-pi-spiral',
  standalone: true,
  imports: [PiSpiralHeaderComponent, PiSpiralControlsComponent],
  templateUrl: './pi-spiral.component.html',
  styleUrl: './pi-spiral.component.scss',
})
export class PiSpiralComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

  // Helper modules
  private readonly wormholeTunnel = new WormholeTunnel();
  private readonly textureFactory = new PiTextureFactory();

  // ---------------------------------------------------------------------------
  // Reactive Signals for UI HUD
  // ---------------------------------------------------------------------------

  /** Count of decimal digits generated after "3.14". */
  readonly digitCount = signal<number>(0);

  /** Whether the automatic flow mode is active. */
  readonly isAutoFlowActive = signal<boolean>(false);

  /** Whether sound chimes are enabled. */
  readonly isSoundEnabled = signal<boolean>(true);

  /** Whether the Pi speech bubble is currently open. */
  readonly showPiBubble = signal<boolean>(false);

  /** Whether the balloon deflate closing animation is running. */
  readonly closingPiBubble = signal<boolean>(false);

  /** Whether the generated Pi string was recently copied to clipboard. */
  readonly isPiCopied = signal<boolean>(false);

  private closingPiBubbleTimeout: ReturnType<typeof setTimeout> | null = null;
  private copyPiTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Short formatted string showing the latest digits for the top HUD banner. */
  readonly currentPiSnippet = computed(() => {
    const count = this.digitCount();
    if (count === 0) return '3,14';
    const recent = PI_DECIMAL_DIGITS_AFTER_14.slice(0, Math.min(count, 18));
    return `3,14${recent.slice(0, 15)}${count > 15 ? '...' : ''}`;
  });

  /** All decimal digits generated after "3.14" up to the current count. */
  readonly generatedPiDecimalsAfter14 = computed(() => {
    const count = this.digitCount();
    if (count <= 0) return '';
    if (count <= PI_DECIMAL_DIGITS_AFTER_14.length) {
      return PI_DECIMAL_DIGITS_AFTER_14.slice(0, count);
    }
    let res = PI_DECIMAL_DIGITS_AFTER_14;
    for (let i = PI_DECIMAL_DIGITS_AFTER_14.length; i < count; i++) {
      res += getPiDigitAfter14(i);
    }
    return res;
  });

  /** Total number of decimals currently placed. */
  readonly totalDecimalsFormatted = computed(() => {
    return (2 + this.digitCount()).toLocaleString('de-DE');
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

  /** Accumulator for frame-synced, continuous Auto-Flow digit generation. */
  private autoFlowTimer = 0;
  /** Counter for rhythmic alternating chime notes during Auto-Flow. */
  private autoFlowChimeCounter = 0;
  /** Interval in seconds between single digits during Auto-Flow (~92ms = 10.8 digits/sec). */
  private readonly AUTO_FLOW_STEP = 0.092;

  /** Total count of digits scheduled for spawning (prevents race conditions on rapid clicks). */
  private scheduledCount = 0;

  /** Root group containing all tiles, allowing global rotation/tilt. */
  private spiralGroup!: THREE.Group;

  /** Hero floating text mesh representing "3,14" at the center. */
  private centerTileMesh!: THREE.Mesh;

  /** Pulsating glowing Pi symbol ("π") mesh behind "3,14". */
  private centerPiSymbolMesh!: THREE.Mesh;

  /** Point light brightly illuminating the center "3,14" and surrounding floating numbers. */
  private centerPointLight!: THREE.PointLight;

  /** Shared plane geometry for individual floating numbers. */
  private tileGeometry!: THREE.PlaneGeometry;

  /** Shared materials for floating digits 0 through 9 in pleasant blue Orbitron font. */
  private digitMaterials: THREE.MeshBasicMaterial[] = [];

  /** All active floating digits currently placed in the scene. */
  private tiles: MosaicTile[] = [];

  /** Precomputed 3D path points for the 5 outer rings of the foreground funnel. */
  private funnelPoints: FunnelPoint[] = [];

  private lastFrameTime = 0;

  // ---------------------------------------------------------------------------
  // Camera & Zoom Parameters (Supports overview and full wormhole flight)
  // ---------------------------------------------------------------------------

  private readonly maxCameraZ = 34.0;
  private readonly baseCameraZ = 29.0;
  private targetCameraZ = 29.0;
  private currentCameraZ = 29.0;

  /** Tilt angle in radians: 0.22 (~13°) gives the optimal 3D perspective to view
   * the foreground funnel and the snaking wormhole hose looping through space behind it. */
  private readonly defaultTiltX = 0.22;
  private targetTiltX = 0.22;
  private currentTiltX = 0.22;

  /** Horizontal tilt / orbit (Yaw) in radians: allows tilting/orbiting in all directions. */
  private targetTiltY = 0;
  private currentTiltY = 0;

  // Pointer drag state for manual inspection
  private isPointerDown = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private hasDragged = false;

  // ---------------------------------------------------------------------------
  // Bubble-Letter Hover Evasion Physics
  // ---------------------------------------------------------------------------

  private readonly raycaster = new THREE.Raycaster();
  private readonly mouseNDC = new THREE.Vector2(9999, 9999);
  private isMouseInsideCanvas = false;
  private readonly spiralPlane = new THREE.Plane();
  private readonly planeHitPoint = new THREE.Vector3();
  private readonly localHitPoint = new THREE.Vector3();

  /** Current 2D displacement offset for the center "3,14" mesh. */
  private centerEvadeOffset = new THREE.Vector2(0, 0);
  /** Current scale multiplier for the center "3,14" mesh. */
  private centerEvadeScale = 1.0;
  /** Current evasion rotation in radians for the center "3,14" mesh. */
  private centerEvadeRotation = 0;

  // ---------------------------------------------------------------------------
  // Keyboard Listeners
  // ---------------------------------------------------------------------------

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.showPiBubble()) {
        this.closePiBubble();
        return;
      }
      this.router.navigate(['/'], { fragment: 'bubble-hub' });
      return;
    }

    if (this.showPiBubble() && (event.target as HTMLElement)?.closest('.speech-bubble')) {
      return;
    }

    if (event.code === 'Space' || event.key === 'Enter') {
      event.preventDefault();
      this.addFiveDigits();
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'a') {
      this.toggleAutoFlow();
    } else if (key === 'c') {
      this.resetCameraView();
    } else if (key === 'r') {
      this.resetSpiral();
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.showPiBubble()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.stat-pill-wrapper')) return;
    this.closePiBubble();
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
    const hero = this.textureFactory.createCenterHero(this.spiralGroup, this.renderer);
    this.centerTileMesh = hero.centerTileMesh;
    this.centerPiSymbolMesh = hero.centerPiSymbolMesh;
    this.wormholeTunnel.init(this.spiralGroup);
    this.animate();

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        this.textureFactory.refreshAllOrbitronTextures(
          this.centerTileMesh,
          this.digitMaterials,
          this.renderer
        );
        for (const tile of this.tiles) {
          tile.material.map = this.digitMaterials[tile.digit]?.map || null;
          tile.material.needsUpdate = true;
        }
      });
    }

    // Start with the first 5 digits already rendered
    setTimeout(() => {
      this.addFiveDigits(false);
    }, 250);
  }

  ngOnDestroy(): void {
    if (this.closingPiBubbleTimeout) {
      clearTimeout(this.closingPiBubbleTimeout);
      this.closingPiBubbleTimeout = null;
    }
    if (this.copyPiTimeout) {
      clearTimeout(this.copyPiTimeout);
      this.copyPiTimeout = null;
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

    this.funnelPoints = precomputeFunnelPoints();

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0b16); // Deep cosmic warm obsidian
    this.scene.fog = new THREE.FogExp2(0x0c0b16, 0.0035);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 5000);
    this.camera.position.set(0, 0, this.currentCameraZ);
    this.camera.lookAt(0, -0.25, 0);

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
    const ambientLight = new THREE.AmbientLight(0xfff6ea, 1.45);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffedd5, 2.0);
    keyLight.position.set(6, 12, 14);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xc4b5fd, 0.9);
    fillLight.position.set(-8, -10, 8);
    this.scene.add(fillLight);

    this.centerPointLight = new THREE.PointLight(0x38bdf8, 2.8, 32, 1.1);
    this.centerPointLight.position.set(0, 0, 3.2);
    this.scene.add(this.centerPointLight);

    // 5. Spiral Hierarchy Group
    this.spiralGroup = new THREE.Group();
    this.scene.add(this.spiralGroup);

    // 6. Shared geometry for individual floating numbers
    this.tileGeometry = new THREE.PlaneGeometry(1.05, 1.05);
  }

  // ---------------------------------------------------------------------------
  // Mosaic Tile Spawning & Texturing
  // ---------------------------------------------------------------------------

  /**
   * Adds the next 5 decimal digits of Pi along the spiral with staggered pop-in and Laola waves.
   *
   * @param playAudio - Whether to play chime sounds for this batch.
   */
  addFiveDigits(playAudio = true): void {
    const startIdx = this.scheduledCount;
    this.scheduledCount += 5;

    for (let i = 0; i < 5; i++) {
      const digitIndex = startIdx + i;
      const delayMs = i * 70;

      const timerId = window.setTimeout(() => {
        this.spawnSingleTile(digitIndex, playAudio, i, false);
      }, delayMs);
      this.pendingSpawnTimeouts.push(timerId);
    }
  }

  /**
   * Spawns a single free-floating decimal digit at the calculated coordinate.
   */
  private spawnSingleTile(
    index: number,
    playAudio: boolean,
    batchPosition: number,
    isAutoFlow = false
  ): void {
    const digit = getPiDigitAfter14(index);
    const currentTotal = this.tiles.length + 1;
    const target = calculateTileTarget(index, currentTotal, this.funnelPoints);

    const basePosition = new THREE.Vector3(target.x, target.y, target.z);
    const targetPosition = new THREE.Vector3(target.x, target.y, target.z);
    const baseMaterial = this.digitMaterials[digit] || this.digitMaterials[0];
    const material = baseMaterial.clone();

    const mesh = new THREE.Mesh(this.tileGeometry, material);
    mesh.position.copy(basePosition);
    mesh.rotation.z = 0;
    mesh.scale.set(0, 0, 0);

    this.spiralGroup.add(mesh);

    const tile: MosaicTile = {
      mesh,
      material,
      index,
      digit,
      theta: target.th,
      radius: target.r,
      basePosition,
      targetPosition,
      targetScale: target.scale,
      elevation: 0,
      elevationVelocity: 0,
      scaleProgress: 0,
      evadeOffset: new THREE.Vector2(0, 0),
      evadeScale: 1.0,
      evadeRotation: 0,
    };

    this.tiles.push(tile);
    this.digitCount.set(this.tiles.length);

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

    const deepestZ = this.getDeepestDigitZ();
    // Wormhole is always at least -650.0 and at least 450 units deeper than the entire digit chain
    const targetWormholeZMin = Math.min(-650.0, deepestZ - 450.0);
    this.wormholeTunnel.update(time, targetWormholeZMin);

    if (this.isAutoFlowActive()) {
      this.autoFlowTimer += dt;
      if (this.autoFlowTimer > 0.3) {
        this.autoFlowTimer = this.AUTO_FLOW_STEP;
      }
      while (this.autoFlowTimer >= this.AUTO_FLOW_STEP) {
        this.autoFlowTimer -= this.AUTO_FLOW_STEP;
        this.spawnNextDigitAuto();
      }
    }

    // Raycast for hover evasion
    let hasHit = false;
    if (this.isMouseInsideCanvas && this.camera && this.spiralGroup) {
      this.raycaster.setFromCamera(this.mouseNDC, this.camera);
      this.spiralGroup.updateMatrixWorld();
      const planeNormal = new THREE.Vector3(0, 0, 1)
        .applyEuler(this.spiralGroup.rotation)
        .normalize();
      this.spiralPlane.setFromNormalAndCoplanarPoint(planeNormal, this.spiralGroup.position);

      const hitWorld = this.raycaster.ray.intersectPlane(this.spiralPlane, this.planeHitPoint);
      if (hitWorld) {
        this.localHitPoint.copy(hitWorld);
        this.spiralGroup.worldToLocal(this.localHitPoint);
        hasHit = true;
      }
    }

    // Center Hero ("3,14") hover evasion & pulsating Pi symbol
    if (this.centerTileMesh) {
      let targetCenterPushX = 0;
      let targetCenterPushY = 0;
      let targetCenterScale = 1.0;
      let targetCenterRot = 0;

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
          targetCenterRot = (dx / dist) * force * 0.06;
        }
      }

      this.centerEvadeOffset.x += (targetCenterPushX - this.centerEvadeOffset.x) * 0.25;
      this.centerEvadeOffset.y += (targetCenterPushY - this.centerEvadeOffset.y) * 0.25;
      this.centerEvadeScale += (targetCenterScale - this.centerEvadeScale) * 0.22;
      this.centerEvadeRotation += (targetCenterRot - this.centerEvadeRotation) * 0.22;

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
      this.centerTileMesh.rotation.z = this.centerEvadeRotation;
    }

    if (this.centerPiSymbolMesh) {
      const pulse = 1.0 + Math.sin(time * 2.2) * 0.08;
      const subtleRot = Math.sin(time * 0.8) * 0.03;
      this.centerPiSymbolMesh.scale.set(pulse, pulse, 1.0);
      this.centerPiSymbolMesh.rotation.z = subtleRot;
    }

    if (this.centerPointLight) {
      this.centerPointLight.position.set(0, 0, 3.2);
    }

    // Physics, 3D Wormhole Glide & Bubble Evasion for all floating digits
    const totalTiles = this.tiles.length;
    const lerpHose = 1.0 - Math.exp(-12.0 * dt);
    const lerpFunnel = 1.0 - Math.exp(-8.0 * dt);
    const lerpScaleSpeed = dt * 6.5;

    for (let i = 0; i < totalTiles; i++) {
      const tile = this.tiles[i];
      const target = calculateTileTarget(tile.index, totalTiles, this.funnelPoints, time);
      tile.targetPosition.set(target.x, target.y, target.z);
      tile.targetScale = target.scale;
      tile.radius = target.r;
      tile.theta = target.th;

      if (target.inHose) {
        tile.basePosition.x += (target.x - tile.basePosition.x) * lerpHose;
        tile.basePosition.y += (target.y - tile.basePosition.y) * lerpHose;
        tile.basePosition.z += (target.z - tile.basePosition.z) * (1.0 - Math.exp(-5.0 * dt));
      } else {
        tile.basePosition.lerp(tile.targetPosition, lerpFunnel);
      }

      let targetTilePushX = 0;
      let targetTilePushY = 0;
      let targetTileScale = 1.0;
      let targetTileRot = 0;

      if (hasHit && tile.basePosition.z > -4.5) {
        const dx = tile.basePosition.x - this.localHitPoint.x;
        const dy = tile.basePosition.y - this.localHitPoint.y;
        const dist = Math.hypot(dx, dy);
        const radius = 1.55;

        if (dist < radius && dist > 0.001) {
          const norm = dist / radius;
          const force = Math.pow(1 - norm, 1.6);
          const pushMagnitude = 0.58;
          targetTilePushX = (dx / dist) * force * pushMagnitude;
          targetTilePushY = (dy / dist) * force * pushMagnitude;
          targetTileScale = 1.0 + force * 0.16;
          targetTileRot = (dx / dist) * force * 0.15;
        }
      }

      const evadeLerp = 1.0 - Math.exp(-14.0 * dt);
      tile.evadeOffset.x += (targetTilePushX - tile.evadeOffset.x) * evadeLerp;
      tile.evadeOffset.y += (targetTilePushY - tile.evadeOffset.y) * evadeLerp;
      tile.evadeScale += (targetTileScale - tile.evadeScale) * evadeLerp;
      tile.evadeRotation += (targetTileRot - tile.evadeRotation) * evadeLerp;

      if (!target.inHose) {
        const tiltAngle = 0.16;
        const cosTh = Math.cos(tile.theta);
        const sinTh = Math.sin(tile.theta);
        tile.mesh.rotation.x = -sinTh * tiltAngle;
        tile.mesh.rotation.y = cosTh * tiltAngle;
      } else {
        const spineAhead = getWormholeSpine(tile.basePosition.z - 2.0, time);
        const spineBehind = getWormholeSpine(tile.basePosition.z + 2.0, time);
        const dX = (spineAhead.x - spineBehind.x) / 4.0;
        const dY = (spineAhead.y - spineBehind.y) / 4.0;
        tile.mesh.rotation.x = Math.max(-0.40, Math.min(0.40, -dY * 0.7));
        tile.mesh.rotation.y = Math.max(-0.40, Math.min(0.40, dX * 0.7));
      }
      tile.mesh.rotation.z = tile.evadeRotation;

      if (tile.scaleProgress < 1) {
        tile.scaleProgress = Math.min(1, tile.scaleProgress + lerpScaleSpeed);
      }
      const s = easeOutBack(tile.scaleProgress) * tile.targetScale * tile.evadeScale;
      tile.mesh.scale.set(s, s, s);

      if (Math.abs(tile.elevation) > 0.001 || Math.abs(tile.elevationVelocity) > 0.001) {
        const springK = 46.0;
        const damping = 12.0;

        const force = -springK * tile.elevation - damping * tile.elevationVelocity;
        tile.elevationVelocity += force * dt;
        tile.elevation += tile.elevationVelocity * dt;

        if (Math.abs(tile.elevation) < 0.0015 && Math.abs(tile.elevationVelocity) < 0.0015) {
          tile.elevation = 0;
          tile.elevationVelocity = 0;
        }
      }

      tile.mesh.position.set(
        tile.basePosition.x + tile.evadeOffset.x,
        tile.basePosition.y + tile.evadeOffset.y,
        tile.basePosition.z + tile.elevation
      );

      // Distance-based fading along the wormhole: numbers further back fade out,
      // and only become visible when scrolling towards them
      const opacity = calculateTileOpacity(tile.mesh.position.z, this.currentCameraZ);
      if (opacity <= 0.001) {
        tile.mesh.visible = false;
      } else {
        tile.mesh.visible = true;
        tile.material.opacity = opacity;
      }
    }

    // Camera Flight Navigation
    const rotLerp = 1.0 - Math.exp(-6.0 * dt);
    this.currentTiltX += (this.targetTiltX - this.currentTiltX) * rotLerp;
    this.currentTiltY += (this.targetTiltY - this.currentTiltY) * rotLerp;

    this.spiralGroup.rotation.set(0, 0, 0);
    this.spiralGroup.updateMatrixWorld(true);

    const camLerp = 1.0 - Math.exp(-4.2 * dt);
    this.currentCameraZ += (this.targetCameraZ - this.currentCameraZ) * camLerp;

    let worldCamPos: THREE.Vector3;
    let worldLookAt: THREE.Vector3;

    if (this.currentCameraZ >= 14.0) {
      const R = this.currentCameraZ;
      const cosX = Math.cos(this.currentTiltX);
      const sinX = Math.sin(this.currentTiltX);
      const cosY = Math.cos(this.currentTiltY);
      const sinY = Math.sin(this.currentTiltY);

      const camX = R * cosX * sinY;
      const camY = -0.25 + R * sinX;
      const camZ = R * cosX * cosY;

      worldCamPos = new THREE.Vector3(camX, camY, camZ);
      worldLookAt = new THREE.Vector3(0, -0.25, 0);
    } else if (this.currentCameraZ >= -2.60) {
      const t = (14.0 - this.currentCameraZ) / (14.0 - (-2.60));
      const blend = t * t * (3.0 - 2.0 * t);

      const R = this.currentCameraZ;
      const cosX = Math.cos(this.currentTiltX);
      const sinX = Math.sin(this.currentTiltX);
      const cosY = Math.cos(this.currentTiltY);
      const sinY = Math.sin(this.currentTiltY);

      const oCamX = R * cosX * sinY;
      const oCamY = -0.25 + R * sinX;
      const oCamZ = R * cosX * cosY;

      const throatX = 3.20;
      const throatY = 0.0;
      const tCamX = throatX + 0.35 + 2.0 * sinY;
      const tCamY = throatY + 0.65 + 2.0 * (sinX - Math.sin(this.defaultTiltX));
      const tCamZ = this.currentCameraZ;

      const camX = THREE.MathUtils.lerp(oCamX, tCamX, blend);
      const camY = THREE.MathUtils.lerp(oCamY, tCamY, blend);
      const camZ = THREE.MathUtils.lerp(oCamZ, tCamZ, blend);
      worldCamPos = new THREE.Vector3(camX, camY, camZ);

      const lookAheadSpine = getWormholeSpine(-2.60 - 10.0, time);
      const lookX = THREE.MathUtils.lerp(0, lookAheadSpine.x + 8.0 * sinY, blend);
      const lookY = THREE.MathUtils.lerp(
        -0.25,
        lookAheadSpine.y + 8.0 * (sinX - Math.sin(this.defaultTiltX)),
        blend
      );
      const lookZ = THREE.MathUtils.lerp(0, -2.60 - 10.0, blend);
      worldLookAt = new THREE.Vector3(lookX, lookY, lookZ);
    } else {
      const camSpine = getWormholeSpine(this.currentCameraZ, time);
      worldCamPos = new THREE.Vector3(camSpine.x + 0.35, camSpine.y + 0.65, this.currentCameraZ);

      const lookAheadZ = this.currentCameraZ - 12.0;
      const lookSpine = getWormholeSpine(lookAheadZ, time);
      const lookX = lookSpine.x + 12.0 * Math.sin(this.currentTiltY);
      const lookY = lookSpine.y + 12.0 * (Math.sin(this.currentTiltX) - Math.sin(this.defaultTiltX));
      worldLookAt = new THREE.Vector3(lookX, lookY, lookAheadZ);
    }

    this.camera.position.copy(worldCamPos);
    this.camera.lookAt(worldLookAt);

    this.renderer.render(this.scene, this.camera);
  }

  private spawnNextDigitAuto(): void {
    const digitIndex = this.scheduledCount++;
    this.autoFlowChimeCounter++;
    const playAudio = this.autoFlowChimeCounter % 2 === 0;
    this.spawnSingleTile(digitIndex, playAudio, this.autoFlowChimeCounter, true);
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
    this.targetTiltX = Math.max(-0.10, Math.min(0.55, this.targetTiltX + deltaY * tiltSpeed));
    this.targetTiltY = Math.max(-0.45, Math.min(0.45, this.targetTiltY - deltaX * tiltSpeed));

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
      this.addFiveDigits();
    }
  }

  /** Returns the z-coordinate of the deepest (oldest) decimal digit tile in the scene. */
  private getDeepestDigitZ(): number {
    if (this.tiles.length === 0) return -2.60;
    const oldestTile = this.tiles[0];
    return oldestTile ? oldestTile.basePosition.z : -2.60;
  }

  /** Dynamic minimum camera Z allowing scrolling comfortably past the entire digit chain. */
  private getMinCameraZ(): number {
    const deepestZ = this.getDeepestDigitZ();
    return Math.min(-450.0, deepestZ - 35.0);
  }

  /** Responsive wheel speed adapting to depth for smooth travel through long wormhole tunnels. */
  private getWheelSpeed(): number {
    if (this.targetCameraZ >= 5.0) return 0.018;
    if (this.targetCameraZ > -80.0) return 0.055;
    return 0.110;
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const speed = this.getWheelSpeed();
    const zoomDelta = event.deltaY * speed;
    const minZ = this.getMinCameraZ();
    this.targetCameraZ = Math.max(minZ, Math.min(this.maxCameraZ, this.targetCameraZ + zoomDelta));
  }

  onDoubleClick(): void {
    this.targetCameraZ = this.baseCameraZ;
    this.targetTiltX = this.defaultTiltX;
    this.targetTiltY = 0;
  }

  // ---------------------------------------------------------------------------
  // Pi Speech Bubble Interaction
  // ---------------------------------------------------------------------------

  togglePiBubble(event?: Event): void {
    event?.stopPropagation();
    if (this.showPiBubble()) {
      this.closePiBubble();
    } else {
      this.openPiBubble();
    }
  }

  openPiBubble(): void {
    if (this.closingPiBubbleTimeout) {
      clearTimeout(this.closingPiBubbleTimeout);
      this.closingPiBubbleTimeout = null;
    }
    this.closingPiBubble.set(false);
    this.showPiBubble.set(true);
    if (this.isSoundEnabled()) {
      this.audioService.playWaterdropToneOn(0.4);
    }
  }

  closePiBubble(): void {
    if (!this.showPiBubble() || this.closingPiBubble()) return;
    this.closingPiBubble.set(true);
    if (this.closingPiBubbleTimeout) {
      clearTimeout(this.closingPiBubbleTimeout);
    }
    this.closingPiBubbleTimeout = setTimeout(() => {
      this.showPiBubble.set(false);
      this.closingPiBubble.set(false);
      this.closingPiBubbleTimeout = null;
    }, 350);
  }

  copyPiNumber(event?: Event): void {
    event?.stopPropagation();
    const text = '3,14' + this.generatedPiDecimalsAfter14();
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.isPiCopied.set(true);
        if (this.copyPiTimeout) clearTimeout(this.copyPiTimeout);
        this.copyPiTimeout = setTimeout(() => {
          this.isPiCopied.set(false);
          this.copyPiTimeout = null;
        }, 1800);
      });
    }
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
    this.audioService.playBubbleHover();
  }

  toggleSound(): void {
    this.isSoundEnabled.update((v) => !v);
  }

  resetSpiral(): void {
    this.stopAutoFlow();
    this.autoFlowTimer = 0;
    this.autoFlowChimeCounter = 0;
    this.clearPendingSpawnTimeouts();

    for (const tile of this.tiles) {
      this.spiralGroup.remove(tile.mesh);
      tile.material.dispose();
    }
    this.tiles = [];
    this.digitCount.set(0);
    this.scheduledCount = 0;

    if (this.centerTileMesh) {
      this.centerTileMesh.position.set(0, 0, 0.60);
      this.centerTileMesh.scale.set(1, 1, 1);
      this.centerTileMesh.rotation.z = 0;
    }
    this.centerEvadeOffset.set(0, 0);
    this.centerEvadeScale = 1.0;
    this.centerEvadeRotation = 0;
    if (this.centerPiSymbolMesh) {
      this.centerPiSymbolMesh.position.set(0, 0, 0.38);
      this.centerPiSymbolMesh.scale.set(1, 1, 1);
    }
    if (this.centerPointLight) {
      this.centerPointLight.position.set(0, 0, 3.2);
      this.centerPointLight.distance = 32;
    }

    this.resetCameraView();
    this.audioService.playWaterdropToneOn(0.6);

    setTimeout(() => {
      this.addFiveDigits(false);
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
    if (this.centerPiSymbolMesh) {
      this.centerPiSymbolMesh.geometry.dispose();
      (this.centerPiSymbolMesh.material as THREE.Material).dispose();
    }
    if (this.tileGeometry) {
      this.tileGeometry.dispose();
    }
    for (const tile of this.tiles) {
      tile.material.dispose();
    }
    for (const mat of this.digitMaterials) {
      mat.dispose();
    }
    this.digitMaterials = [];

    this.wormholeTunnel.dispose(this.spiralGroup);

    if (this.renderer) {
      this.renderer.dispose();
      const dom = this.renderer.domElement;
      if (dom && dom.parentElement) {
        dom.parentElement.removeChild(dom);
      }
    }
  }
}
