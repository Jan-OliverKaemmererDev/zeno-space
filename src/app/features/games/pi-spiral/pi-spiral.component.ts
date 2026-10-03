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
import { Router, RouterLink } from '@angular/router';
import * as THREE from 'three';
import { AudioService } from '../../../core/services/audio.service';
import { PI_DECIMAL_DIGITS_AFTER_14, getPiDigitAfter14 } from './pi-digits.data';
import { ORBITRON_REGULAR_BASE64 } from './orbitron-font.data';

/**
 * Metadata and animation state for a single 3D mosaic tile in the Pi spiral.
 */
interface MosaicTile {
  /** The Three.js mesh representing the physical mosaic stone. */
  mesh: THREE.Mesh;
  /** Index in the decimal sequence after 14 (0 = first digit after 14, which is 1). */
  index: number;
  /** Decimal digit value (0-9). */
  digit: number;
  /** Polar angle theta along the Archimedean spiral. */
  theta: number;
  /** Radial distance from the spiral origin. */
  radius: number;
  /** Base rest position in 3D world space. */
  basePosition: THREE.Vector3;
  /** Target position for smooth gliding down the tunnel. */
  targetPosition: THREE.Vector3;
  /** Target visual scale factor (1.0 in outer rings, tapering in deep tunnel). */
  targetScale: number;
  /** Current vertical elevation offset above base position for wave animation. */
  elevation: number;
  /** Vertical velocity for spring physics simulation. */
  elevationVelocity: number;
  /** Scale animation progress (0 to 1). */
  scaleProgress: number;
  /** Current 2D evasion offset for bubble-letter hover effect. */
  evadeOffset: THREE.Vector2;
  /** Current scale multiplier for bubble evasion bounce. */
  evadeScale: number;
  /** Current tilt rotation in radians for bubble evasion. */
  evadeRotation: number;
}

// ---------------------------------------------------------------------------
// Component Implementation
// ---------------------------------------------------------------------------

/**
 * Interactive 3D Pi Spiral Horizon minigame.
 * Displays glowing "3,14" at the center in Orbitron font with a pulsating Pi symbol behind it,
 * and generates subsequent decimal digits as free-floating, pleasant blue numbers in Orbitron
 * along the spiral funnel and into the cosmic wormhole.
 */
@Component({
  selector: 'app-pi-spiral',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './pi-spiral.component.html',
  styleUrl: './pi-spiral.component.scss',
})
export class PiSpiralComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

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

  /** Pulsating glowing Pi symbol ("π") mesh behind "3,14" in the background (replaces the donut). */
  private centerPiSymbolMesh!: THREE.Mesh;

  /** Point light brightly illuminating the center "3,14" and surrounding floating numbers. */
  private centerPointLight!: THREE.PointLight;

  /** Shared plane geometry for individual floating numbers. */
  private tileGeometry!: THREE.PlaneGeometry;

  /** Shared materials for floating digits 0 through 9 in pleasant blue Orbitron font. */
  private digitMaterials: THREE.MeshBasicMaterial[] = [];

  /** All active floating digits currently placed in the scene. */
  private tiles: MosaicTile[] = [];

  // ---------------------------------------------------------------------------
  // Spiral Funnel & Snaking Wormhole Hose Parameters
  // ---------------------------------------------------------------------------

  /** Throat radius where the foreground funnel narrows into the wormhole hose. */
  private readonly throatRadius = 3.20;

  /** Maximum outer mouth radius where the 5 outer rings stay comfortably framed. */
  private readonly mouthRadius = 8.20;

  /** Linear spacing along the spiral arc and along the snaking hose spine. */
  private readonly tileArcSpacing = 1.02;

  /** Precomputed 3D path points for the 5 outer rings of the foreground funnel. */
  private funnelPoints: { x: number; y: number; z: number; r: number; th: number }[] = [];

  // ---------------------------------------------------------------------------
  // 3D Pixel Wormhole Tunnel & Holographic Wall Membrane (inspired by orb-nav)
  // ---------------------------------------------------------------------------

  private wormholePointsMesh: THREE.Points | null = null;
  private wormholeGeometry: THREE.BufferGeometry | null = null;
  private wormholeMaterial: THREE.ShaderMaterial | null = null;
  private readonly wormholeParticleCount = 16000;

  private wormholeMembraneMesh: THREE.Mesh | null = null;
  private wormholeMembraneGeometry: THREE.BufferGeometry | null = null;
  private wormholeMembraneMaterial: THREE.ShaderMaterial | null = null;

  private lastFrameTime = 0;

  // ---------------------------------------------------------------------------
  // Camera & Zoom Parameters (Supports overview and full wormhole flight)
  // ---------------------------------------------------------------------------

  private readonly minCameraZ = -280.0;
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
    this.updateTargetCameraZoom();
  }

  async ngAfterViewInit(): Promise<void> {
    await this.loadOrbitronFont();
    this.initThreeScene();
    this.initDigitMaterials();
    this.createCenterHeroTile();
    this.animate();

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        this.refreshAllOrbitronTextures();
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

  /**
   * Registers font data with multiple weight descriptors and family aliases
   * so Canvas 2D font matching succeeds whether 400, 700, bold, or normal is specified.
   */
  private async registerOrbitronFontFaces(fontData: ArrayBuffer): Promise<void> {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return;

    const weights = ['400', '700', 'normal', 'bold', '100 900'];
    const families = ['Orbitron', 'Orbitron-Regular'];

    for (const family of families) {
      for (const weight of weights) {
        try {
          const fontFace = new FontFace(family, fontData.slice(0), {
            weight,
            style: 'normal',
            display: 'swap',
          });
          await fontFace.load();
          document.fonts.add(fontFace);
        } catch {
          // Ignore individual duplicate weight registration issues
        }
      }
    }

    try {
      await document.fonts.ready;
    } catch {
      // Ignore ready error
    }
  }

  /**
   * Pre-loads the Orbitron font from public/fonts/Orbitron/static/Orbitron-Regular.ttf
   * with multi-path resolution and embedded byte-for-byte binary fallback.
   * Guarantees 100% reliable font availability even when deployed on Netcup webhosting.
   */
  private async loadOrbitronFont(): Promise<void> {
    let buffer: ArrayBuffer | null = null;

    if (typeof window !== 'undefined') {
      const candidates: string[] = [];
      try {
        if (typeof document !== 'undefined' && document.baseURI) {
          candidates.push(new URL('fonts/Orbitron/static/Orbitron-Regular.ttf', document.baseURI).href);
        }
      } catch {}
      candidates.push('fonts/Orbitron/static/Orbitron-Regular.ttf');
      candidates.push('/fonts/Orbitron/static/Orbitron-Regular.ttf');

      for (const url of candidates) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const ab = await response.arrayBuffer();
            if (ab && ab.byteLength > 1000) {
              buffer = ab;
              break;
            }
          }
        } catch {
          // Try next candidate URL
        }
      }

      if (!buffer) {
        try {
          // Decode embedded exact Orbitron-Regular.ttf binary data
          const binaryString = atob(ORBITRON_REGULAR_BASE64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          buffer = bytes.buffer;
        } catch (err) {
          console.warn('Fallback base64 font decode error:', err);
        }
      }

      if (buffer) {
        await this.registerOrbitronFontFaces(buffer);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Three.js Initialization & Scene Setup
  // ---------------------------------------------------------------------------

  private initThreeScene(): void {
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 0. Precompute 3D funnel and snaking wormhole hose path
    this.precomputeFunnelAndHosePath();

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0b16); // Deep cosmic warm obsidian
    // Gentle cosmic fog that preserves readability down the tunnel
    this.scene.fog = new THREE.FogExp2(0x0c0b16, 0.0035);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 2000);
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

    // Dynamic celestial blue point light centered on "3,14" and the Pi symbol
    this.centerPointLight = new THREE.PointLight(0x38bdf8, 2.8, 32, 1.1);
    this.centerPointLight.position.set(0, 0, 3.2);
    this.scene.add(this.centerPointLight);

    // 5. Spiral Hierarchy Group
    this.spiralGroup = new THREE.Group();
    this.scene.add(this.spiralGroup);

    // 6. Shared geometry for individual floating numbers (flat plane for free-floating digits)
    this.tileGeometry = new THREE.PlaneGeometry(1.05, 1.05);

    // 7. Background 3D Pixel Wormhole Tunnel & Holographic Wall Membrane
    this.createWormholeMembrane();
    this.createWormholeParticleTunnel();
  }

  // ---------------------------------------------------------------------------
  // Center Hero: Pulsating Pi ("π") Symbol & Free-Floating "3,14" in Orbitron
  // ---------------------------------------------------------------------------

  /**
   * Creates the center hero display:
   * 1. A majestic pulsating Pi symbol ("π") in the background (replacing the old donut)
   * 2. Free-floating, glowing "3,14" in Orbitron font in the foreground
   */
  private createCenterHeroTile(): void {
    // 1. Majestic Glowing Pi Symbol ("π") with direct dark blue border & hub-letter inner shadow
    const piCanvas = document.createElement('canvas');
    piCanvas.width = 1024;
    piCanvas.height = 1024;
    const piCtx = piCanvas.getContext('2d')!;

    // Clean transparent canvas
    piCtx.clearRect(0, 0, 1024, 1024);

    // Ethereal radial cyan/blue glow behind Pi
    const piHalo = piCtx.createRadialGradient(512, 512, 60, 512, 512, 480);
    piHalo.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
    piHalo.addColorStop(0.55, 'rgba(59, 130, 246, 0.20)');
    piHalo.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    piCtx.fillStyle = piHalo;
    piCtx.beginPath();
    piCtx.arc(512, 512, 480, 0, Math.PI * 2);
    piCtx.fill();

    piCtx.textAlign = 'center';
    piCtx.textBaseline = 'middle';
    piCtx.font = 'bold 700px "Sniglet-ExtraBold", "Sniglet", serif, sans-serif';

    // Drop-shadow 1: Deep dark shadow (rgba(7, 20, 50, 0.90)) to elevate Pi from background
    piCtx.shadowColor = 'rgba(7, 20, 50, 0.90)';
    piCtx.shadowOffsetX = 12;
    piCtx.shadowOffsetY = 20;
    piCtx.shadowBlur = 24;
    piCtx.fillStyle = '#071432';
    piCtx.fillText('π', 512, 530);

    // Drop-shadow 2: Radiant sky-blue glow aura
    piCtx.shadowColor = 'rgba(56, 189, 248, 0.70)';
    piCtx.shadowOffsetX = 0;
    piCtx.shadowOffsetY = 0;
    piCtx.shadowBlur = 28;
    piCtx.fillStyle = '#071432';
    piCtx.fillText('π', 512, 530);

    // Luminous gradient body fill (hub-letter style: crisp white -> ice blue -> radiant cyan -> deep sky blue)
    piCtx.shadowColor = 'transparent';
    piCtx.shadowBlur = 0;
    const piGrad = piCtx.createLinearGradient(0, 180, 0, 860);
    piGrad.addColorStop(0, '#ffffff');
    piGrad.addColorStop(0.35, '#bae6fd');
    piGrad.addColorStop(0.68, '#38bdf8');
    piGrad.addColorStop(1, '#0284c7');
    piCtx.fillStyle = piGrad;
    piCtx.fillText('π', 512, 530);

    // Inset shadow / shadow to the inside (Dunkelblauer Schatten nach innen wie hub-letter)
    piCtx.save();
    piCtx.globalCompositeOperation = 'source-atop';

    // Inset inner edge shadow around the contour
    piCtx.strokeStyle = 'rgba(7, 20, 50, 0.80)';
    piCtx.lineWidth = 18;
    piCtx.shadowColor = 'rgba(7, 20, 50, 0.90)';
    piCtx.shadowBlur = 16;
    piCtx.shadowOffsetX = 0;
    piCtx.shadowOffsetY = 6;
    piCtx.strokeText('π', 512, 530);

    // Inset bottom occlusion shading (bubble glass 3D depth)
    const innerDepthGrad = piCtx.createLinearGradient(0, 320, 0, 860);
    innerDepthGrad.addColorStop(0, 'rgba(7, 20, 50, 0.0)');
    innerDepthGrad.addColorStop(0.55, 'rgba(7, 20, 50, 0.18)');
    innerDepthGrad.addColorStop(1, 'rgba(7, 20, 50, 0.60)');
    piCtx.fillStyle = innerDepthGrad;
    piCtx.fillRect(0, 0, 1024, 1024);

    // Subtle top specular highlight gloss (hub-letter reflection)
    const topHighlightGrad = piCtx.createLinearGradient(0, 180, 0, 420);
    topHighlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.60)');
    topHighlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    piCtx.fillStyle = topHighlightGrad;
    piCtx.fillRect(0, 0, 1024, 440);

    piCtx.restore();

    const piTexture = new THREE.CanvasTexture(piCanvas);
    piTexture.generateMipmaps = true;
    piTexture.minFilter = THREE.LinearMipmapLinearFilter;
    piTexture.magFilter = THREE.LinearFilter;
    if (this.renderer) {
      piTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    }
    // Enlarged Pi symbol plane (5.2 x 5.2)
    const piGeo = new THREE.PlaneGeometry(5.2, 5.2);
    const piMat = new THREE.MeshBasicMaterial({
      map: piTexture,
      transparent: true,
      opacity: 0.95,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.centerPiSymbolMesh = new THREE.Mesh(piGeo, piMat);
    this.centerPiSymbolMesh.position.set(0, 0, 0.38);
    this.spiralGroup.add(this.centerPiSymbolMesh);

    // 2. Crisp Free-Floating "3,14" in Orbitron font (enlarged to 3.0 x 1.5, slightly darker blue #2563eb with drop-shadow)
    const centerTexture = this.createCenterNumberTexture();

    // Enlarged center plane (3.0 x 1.5)
    const centerGeo = new THREE.PlaneGeometry(3.0, 1.5);
    const centerMat = new THREE.MeshBasicMaterial({
      map: centerTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.centerTileMesh = new THREE.Mesh(centerGeo, centerMat);
    this.centerTileMesh.position.set(0, 0, 0.60);
    this.spiralGroup.add(this.centerTileMesh);
  }

  /**
   * Generates crisp CanvasTexture for center "3,14" in Orbitron font (#2563eb with drop-shadows).
   */
  private createCenterNumberTexture(): THREE.CanvasTexture {
    const centerCanvas = document.createElement('canvas');
    centerCanvas.width = 1024;
    centerCanvas.height = 512;
    const centerCtx = centerCanvas.getContext('2d')!;

    // Clean transparent canvas
    centerCtx.clearRect(0, 0, 1024, 512);

    centerCtx.textAlign = 'center';
    centerCtx.textBaseline = 'middle';
    centerCtx.font = '700 280px "Orbitron", "Orbitron-Regular", sans-serif';

    // 1. Subtle dark depth drop-shadow to elevate the number from the background
    centerCtx.shadowColor = 'rgba(0, 0, 0, 0.80)';
    centerCtx.shadowOffsetX = 14;
    centerCtx.shadowOffsetY = 22;
    centerCtx.shadowBlur = 18;
    centerCtx.fillText('3,14', 512, 256);

    // 2. Light blue drop-shadow (#38bdf8)
    centerCtx.shadowColor = 'rgba(56, 189, 248, 0.75)';
    centerCtx.shadowOffsetX = 6;
    centerCtx.shadowOffsetY = 10;
    centerCtx.shadowBlur = 12;
    centerCtx.fillText('3,14', 512, 256);

    // 3. Solid distinct blue fill pass
    centerCtx.shadowColor = 'transparent';
    centerCtx.shadowBlur = 0;
    centerCtx.fillStyle = '#2563eb';
    centerCtx.fillText('3,14', 512, 256);

    const centerTexture = new THREE.CanvasTexture(centerCanvas);
    centerTexture.generateMipmaps = true;
    centerTexture.minFilter = THREE.LinearMipmapLinearFilter;
    centerTexture.magFilter = THREE.LinearFilter;
    if (this.renderer) {
      centerTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    }
    return centerTexture;
  }

  /**
   * Refreshes the center "3,14" texture when Orbitron font is ready.
   */
  private updateCenterHeroNumberTexture(): void {
    if (!this.centerTileMesh) return;
    const mat = this.centerTileMesh.material as THREE.MeshBasicMaterial;
    if (mat) {
      const oldMap = mat.map;
      mat.map = this.createCenterNumberTexture();
      mat.needsUpdate = true;
      oldMap?.dispose();
    }
  }

  /**
   * Refreshes all Orbitron-based canvas textures (center 3,14 and digits 0-9)
   * once the Orbitron webfont is confirmed loaded into the document FontFaceSet.
   */
  private refreshAllOrbitronTextures(): void {
    this.initDigitMaterials();
    this.updateCenterHeroNumberTexture();
  }

  // ---------------------------------------------------------------------------
  // Mosaic Tile Spawning & Texturing
  // ---------------------------------------------------------------------------

  /**
   * Adds the next 5 decimal digits of Pi along the spiral with staggered pop-in and Laola waves.
   * Uses scheduledCount to prevent race conditions on rapid clicks or auto-flow.
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
   * Constructs the holographic 3D wormhole membrane mesh with Fresnel glow.
   * A translucent, additive curved cylinder skin that sways synchronously along the wormhole spine.
   * Glows vividly at the silhouette edges (cyan & violet), highlighting the inner walls
   * while remaining crystal clear down the center so the decimal digits and particles shine through.
   */
  private createWormholeMembrane(): void {
    const ringCount = 160; // Rings along depth Z
    const segsPerRing = 60; // Circumference segments (cleanly divides by 10 energy ribs)
    const zMin = -360.0;
    const zMax = 80.0; // Extends well past camera to completely envelope viewport
    const zSpan = zMax - zMin;

    const vertexCount = (ringCount + 1) * (segsPerRing + 1);
    const indexCount = ringCount * segsPerRing * 6;

    const positions = new Float32Array(vertexCount * 3);
    const aZ = new Float32Array(vertexCount);
    const aTheta = new Float32Array(vertexCount);
    const indices = new Uint32Array(indexCount);

    let vIdx = 0;
    for (let r = 0; r <= ringCount; r++) {
      const v = r / ringCount;
      const z = zMin + v * zSpan;
      for (let s = 0; s <= segsPerRing; s++) {
        const u = s / segsPerRing;
        const th = u * Math.PI * 2;

        const i = vIdx++;
        aZ[i] = z;
        aTheta[i] = th;
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = z;
      }
    }

    let iIdx = 0;
    const stride = segsPerRing + 1;
    for (let r = 0; r < ringCount; r++) {
      for (let s = 0; s < segsPerRing; s++) {
        const i1 = r * stride + s;
        const i2 = (r + 1) * stride + s;
        const i3 = (r + 1) * stride + (s + 1);
        const i4 = r * stride + (s + 1);

        indices[iIdx++] = i1;
        indices[iIdx++] = i2;
        indices[iIdx++] = i3;

        indices[iIdx++] = i1;
        indices[iIdx++] = i3;
        indices[iIdx++] = i4;
      }
    }

    this.wormholeMembraneGeometry = new THREE.BufferGeometry();
    this.wormholeMembraneGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.wormholeMembraneGeometry.setAttribute('aZ', new THREE.BufferAttribute(aZ, 1));
    this.wormholeMembraneGeometry.setAttribute('aTheta', new THREE.BufferAttribute(aTheta, 1));
    this.wormholeMembraneGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
    this.wormholeMembraneGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -140), 350);

    this.wormholeMembraneMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        attribute float aZ;
        attribute float aTheta;

        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying float vZ;
        varying float vTheta;
        varying float vDistToCam;

        vec2 getWormholeSpine(float z, float time) {
          if (z >= 0.0) {
            return vec2(0.0, 0.0);
          }
          if (z >= -2.60) {
            float t = -z / 2.60;
            return vec2(3.20 * t, 0.0);
          }
          float d = -2.60 - z;
          float ramp = 1.0 - exp(-0.045 * d);
          float slowTime = time * 0.60;
          float swayX = 10.5 * sin(0.024 * d - slowTime * 0.80) + 4.2 * sin(0.048 * d + slowTime * 0.50 + 0.9);
          float swayY = 7.2 * cos(0.020 * d - slowTime * 0.65) + 3.0 * sin(0.038 * d - slowTime * 0.45 + 1.3);
          float throatDecay = exp(-0.06 * d);
          float x = 3.20 * throatDecay + (1.0 - throatDecay) * (ramp * swayX);
          float y = 0.0 * throatDecay + (1.0 - throatDecay) * (ramp * swayY);
          return vec2(x, y);
        }

        void main() {
          vec2 spine = getWormholeSpine(aZ, uTime);

          float d = max(0.0, -2.60 - aZ);
          float tunnelR = 8.0 + 24.0 * exp(-0.016 * d);
          if (aZ > -2.60) {
            // Expand gently outward behind camera so tube completely encloses viewer
            tunnelR += (aZ - (-2.60)) * 0.35;
          }

          vec3 worldPos = vec3(
            spine.x + tunnelR * cos(aTheta),
            spine.y + tunnelR * sin(aTheta),
            aZ
          );

          vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          // Inward-pointing normal for looking at inner tube wall
          vec3 normalInward = vec3(-cos(aTheta), -sin(aTheta), 0.0);
          vNormal = normalize(normalMatrix * normalInward);
          vViewDir = normalize(-mvPosition.xyz);
          vZ = aZ;
          vTheta = aTheta;
          vDistToCam = -mvPosition.z;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying float vZ;
        varying float vTheta;
        varying float vDistToCam;

        void main() {
          // Fresnel factor: maximum glow at grazing angles along the tube wall boundary
          float fresnel = 1.0 - abs(dot(vNormal, vViewDir));
          fresnel = clamp(fresnel, 0.0, 1.0);
          float edgeGlow = pow(fresnel, 2.0);

          // 10 Longitudinal holographic energy ribs along theta
          float streamWave = sin(vTheta * 10.0 + uTime * 0.45 + vZ * 0.025);
          float streamer = smoothstep(0.62, 0.98, streamWave);

          // Balanced middle-ground animated rings traveling along the wall
          float zFlow = vZ + uTime * 6.0;
          float ringWave = sin(zFlow * 0.125); // Middle ground: wavelength ~50 units
          float ringPulse = smoothstep(0.65, 0.98, ringWave); // Balanced & visible

          // Radiant celestial color palette (Cyan & Violet)
          vec3 colorCyan = vec3(0.22, 0.74, 0.98);   // #38bdf8
          vec3 colorViolet = vec3(0.58, 0.40, 0.96); // #a855f7
          vec3 colorDeep = vec3(0.12, 0.35, 0.88);   // rich electric blue
          vec3 colorCore = vec3(0.85, 0.94, 1.00);   // crystalline ice highlight

          // Color gradient: mystic violet in deep wormhole, celestial cyan near foreground
          float depthMix = smoothstep(-280.0, -15.0, vZ);
          vec3 wallBaseColor = mix(colorViolet, colorCyan, depthMix);
          wallBaseColor = mix(wallBaseColor, colorDeep, (1.0 - edgeGlow) * 0.4);

          vec3 finalColor = mix(wallBaseColor, colorCore, ringPulse * 0.28 + streamer * 0.38);

          // Alpha: crystal clear down the center (0.025), glowing visibly along the cylindrical rim (0.40)
          float centerAlpha = 0.025;
          float rimAlpha = 0.40;
          float pulseAlpha = ringPulse * 0.06 + streamer * 0.07;
          float rawAlpha = centerAlpha + rimAlpha * edgeGlow + pulseAlpha;

          // Depth fade into cosmic infinity and near camera fade
          float depthFade = smoothstep(-360.0, -35.0, vZ);
          // Soft fade at front edge so opening is never cut off
          float frontFade = smoothstep(80.0, 48.0, vZ);
          float nearCamFade = smoothstep(1.5, 6.0, vDistToCam);

          float alpha = rawAlpha * depthFade * nearCamFade * frontFade;

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    this.wormholeMembraneMesh = new THREE.Mesh(this.wormholeMembraneGeometry, this.wormholeMembraneMaterial);
    this.wormholeMembraneMesh.frustumCulled = false;
    this.wormholeMembraneMesh.renderOrder = 0;
    this.spiralGroup.add(this.wormholeMembraneMesh);
  }

  /**
   * Constructs the 3D particle pixel wormhole tunnel spanning the entire background.
   * Uses square pixel shader points (matching orb-nav aesthetics) that form:
   * 1. Concentric illuminated rings / ribs that delineate the cylindrical tube
   * 2. Flowing streamlines / filaments drifting forward along the tube walls
   * 3. Ambient cosmic micro-dust covering the entire background viewport
   * All positions and undulations are computed on the GPU for maximum 120+ FPS smoothness.
   */
  private createWormholeParticleTunnel(): void {
    const count = this.wormholeParticleCount;
    this.wormholeGeometry = new THREE.BufferGeometry();

    const dummyPositions = new Float32Array(count * 3);
    const baseZ = new Float32Array(count);
    const basePos = new Float32Array(count * 3);
    const theta = new Float32Array(count);
    const radiusRatio = new Float32Array(count);
    const speed = new Float32Array(count);
    const rotSpeed = new Float32Array(count);
    const type = new Float32Array(count);
    const sizes = new Float32Array(count);
    const twinklePhases = new Float32Array(count);
    const twinkleSpeeds = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    // Warm pastel & cosmic wormhole palette (harmonious with pastel tiles & orb-nav)
    const colorPalette = [
      { r: 1.00, g: 1.00, b: 1.00 }, // Pure sparkling white stars
      { r: 1.00, g: 1.00, b: 1.00 },
      { r: 0.38, g: 0.82, b: 0.99 }, // Radiant celestial cyan
      { r: 0.38, g: 0.82, b: 0.99 },
      { r: 0.76, g: 0.52, b: 0.99 }, // Mystic lavender / violet
      { r: 1.00, g: 0.84, b: 0.60 }, // Warm golden peach
      { r: 0.98, g: 0.46, b: 0.72 }, // Cosmic rose
    ];

    let pIdx = 0;
    const zMin = -360.0;
    const zSpan = 440.0; // from -360.0 to +80.0

    // Layer 1: Concentric Rings & Ribs (balanced middle ground: 36 rings, 100 particles each)
    const ringCount = 36;
    const particlesPerRing = 100;
    const ringSpacing = zSpan / ringCount;

    for (let r = 0; r < ringCount; r++) {
      const ringZ = zMin + r * ringSpacing;
      for (let p = 0; p < particlesPerRing; p++) {
        if (pIdx >= count) break;
        const i = pIdx++;

        baseZ[i] = ringZ + (Math.random() - 0.5) * 0.40;
        theta[i] = (p / particlesPerRing) * Math.PI * 2 + (Math.random() - 0.5) * 0.035;
        radiusRatio[i] = 0.97 + (Math.random() - 0.5) * 0.07;
        speed[i] = 7.5; // Constant uniform forward speed for coherent rings
        rotSpeed[i] = 0.038;
        type[i] = 0.0; // Tunnel ring rib

        sizes[i] = 0.68 + Math.random() * 0.70;
        twinklePhases[i] = Math.random() * Math.PI * 2;
        twinkleSpeeds[i] = 0.5 + Math.random() * 0.9;

        const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;

        dummyPositions[i * 3] = 0;
        dummyPositions[i * 3 + 1] = 0;
        dummyPositions[i * 3 + 2] = ringZ;
      }
    }

    // Layer 2: Longitudinal Filaments & Streamlines (6500 particles for clean, sleek tube flow)
    const filamentCount = 6500;
    for (let f = 0; f < filamentCount; f++) {
      if (pIdx >= count) break;
      const i = pIdx++;

      baseZ[i] = zMin + Math.random() * zSpan;
      theta[i] = Math.random() * Math.PI * 2;
      radiusRatio[i] = 0.88 + Math.random() * 0.26;
      speed[i] = 9.5 + Math.random() * 8.0; // Rapid flowing streamers
      rotSpeed[i] = (Math.random() - 0.5) * 0.15;
      type[i] = 1.0; // Streamline filament

      sizes[i] = 0.65 + Math.random() * 0.75;
      twinklePhases[i] = Math.random() * Math.PI * 2;
      twinkleSpeeds[i] = 0.6 + Math.random() * 1.1;

      const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      dummyPositions[i * 3] = 0;
      dummyPositions[i * 3 + 1] = 0;
      dummyPositions[i * 3 + 2] = baseZ[i];
    }

    // Layer 3: Full-Field Ambient Cosmic Dust across entire background (remaining ~5900 particles)
    while (pIdx < count) {
      const i = pIdx++;

      baseZ[i] = zMin + Math.random() * zSpan;
      const ax = (Math.random() - 0.5) * 120.0; // -60 to +60
      const ay = (Math.random() - 0.5) * 84.0;  // -42 to +42
      basePos[i * 3] = ax;
      basePos[i * 3 + 1] = ay;
      basePos[i * 3 + 2] = baseZ[i];

      theta[i] = 0;
      radiusRatio[i] = 1.0;
      speed[i] = 3.8 + Math.random() * 4.2; // Brisk ambient drift
      rotSpeed[i] = 0;
      type[i] = 2.0; // Ambient space dust

      sizes[i] = 0.60 + Math.random() * 0.70;
      twinklePhases[i] = Math.random() * Math.PI * 2;
      twinkleSpeeds[i] = 0.4 + Math.random() * 0.8;

      const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      dummyPositions[i * 3] = ax;
      dummyPositions[i * 3 + 1] = ay;
      dummyPositions[i * 3 + 2] = baseZ[i];
    }

    this.wormholeGeometry.setAttribute('position', new THREE.BufferAttribute(dummyPositions, 3));
    this.wormholeGeometry.setAttribute('aBaseZ', new THREE.BufferAttribute(baseZ, 1));
    this.wormholeGeometry.setAttribute('aBasePos', new THREE.BufferAttribute(basePos, 3));
    this.wormholeGeometry.setAttribute('aTheta', new THREE.BufferAttribute(theta, 1));
    this.wormholeGeometry.setAttribute('aRadiusRatio', new THREE.BufferAttribute(radiusRatio, 1));
    this.wormholeGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    this.wormholeGeometry.setAttribute('aRotSpeed', new THREE.BufferAttribute(rotSpeed, 1));
    this.wormholeGeometry.setAttribute('aType', new THREE.BufferAttribute(type, 1));
    this.wormholeGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.wormholeGeometry.setAttribute('aTwinklePhase', new THREE.BufferAttribute(twinklePhases, 1));
    this.wormholeGeometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));
    this.wormholeGeometry.setAttribute('aBaseColor', new THREE.BufferAttribute(colors, 3));

    this.wormholeGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -140), 350);

    // Custom ShaderMaterial featuring fine square pixel points of orb-nav & GPU tunnel dynamics
    this.wormholeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;

        attribute float aBaseZ;
        attribute vec3 aBasePos;
        attribute float aTheta;
        attribute float aRadiusRatio;
        attribute float aSpeed;
        attribute float aRotSpeed;
        attribute float aType;
        attribute float aSize;
        attribute float aTwinklePhase;
        attribute float aTwinkleSpeed;
        attribute vec3 aBaseColor;

        varying vec3 vColor;
        varying float vSparkle;
        varying float vDepth;
        varying float vDistToCam;
        varying float vType;

        // Dynamic 3D wormhole spine with pronounced curves and faster motion
        vec2 getWormholeSpine(float z, float time) {
          if (z >= 0.0) {
            return vec2(0.0, 0.0);
          }
          if (z >= -2.60) {
            float t = -z / 2.60;
            return vec2(3.20 * t, 0.0);
          }
          float d = -2.60 - z;
          float ramp = 1.0 - exp(-0.045 * d);
          float slowTime = time * 0.60;
          float swayX = 10.5 * sin(0.024 * d - slowTime * 0.80) + 4.2 * sin(0.048 * d + slowTime * 0.50 + 0.9);
          float swayY = 7.2 * cos(0.020 * d - slowTime * 0.65) + 3.0 * sin(0.038 * d - slowTime * 0.45 + 1.3);
          float throatDecay = exp(-0.06 * d);
          float x = 3.20 * throatDecay + (1.0 - throatDecay) * (ramp * swayX);
          float y = 0.0 * throatDecay + (1.0 - throatDecay) * (ramp * swayY);
          return vec2(x, y);
        }

        void main() {
          vType = aType;

          // Seamless loop through space spanning from -360.0 to +80.0
          float zSpan = 440.0;
          float zOffset = aBaseZ + uTime * aSpeed;
          float z = -360.0 + mod(zOffset - (-360.0), zSpan);

          vec2 spine = getWormholeSpine(z, uTime);

          // Tunnel radius: flares out gently towards entrance, tapers to 8.0 in deep cosmic depth
          float d = max(0.0, -2.60 - z);
          float tunnelR = 8.0 + 24.0 * exp(-0.016 * d);
          if (z > -2.60) {
            tunnelR += (z - (-2.60)) * 0.35;
          }

          vec3 worldPos;
          if (aType > 1.5) {
            // Ambient cosmic starfield across full viewport background
            float ambSwayX = sin(uTime * 0.25 + aBasePos.z * 0.02) * 2.2;
            float ambSwayY = cos(uTime * 0.20 + aBasePos.z * 0.02) * 1.8;
            worldPos = vec3(aBasePos.x + ambSwayX, aBasePos.y + ambSwayY, z);
          } else {
            // Wormhole tunnel tube (rings and streamlines)
            float th = aTheta + uTime * aRotSpeed + z * 0.007;
            float r = tunnelR * aRadiusRatio;
            worldPos = vec3(spine.x + r * cos(th), spine.y + r * sin(th), z);
          }

          vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
          float distToCam = -mvPosition.z;
          vDistToCam = distToCam;
          vDepth = -z;

          // Twinkle & Sparkle (orb-nav signature)
          float twWave = sin(uTime * aTwinkleSpeed + aTwinklePhase);
          float sparkle = smoothstep(0.86, 0.995, twWave);
          vSparkle = sparkle;
          vColor = mix(aBaseColor, vec3(1.0), sparkle * 0.70);

          // Fine micro-pixel point size (crisp, delicate pixel dots matching orb-nav)
          float pointPx = (aSize * 42.0) / max(1.0, distToCam);
          if (aType < 0.5) {
            pointPx *= 0.95;
          }
          pointPx *= (1.0 + sparkle * 0.35);
          gl_PointSize = clamp(pointPx, 1.0, 2.6);

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vColor;
        varying float vSparkle;
        varying float vDepth;
        varying float vDistToCam;
        varying float vType;

        void main() {
          // Square pixel particle shape (exact signature of orb-nav)
          vec2 coord = abs(gl_PointCoord - 0.5) * 2.0;
          float maxCoord = max(coord.x, coord.y);
          if (maxCoord > 0.90) discard;

          // Soft depth fade into the cosmic background
          float depthFade = smoothstep(380.0, 30.0, vDepth);
          // Soft fade near camera to prevent abrupt popping
          float nearCamFade = smoothstep(1.5, 6.0, vDistToCam);

          // Ring particles have balanced visibility (0.62), filaments and starfield remain crisp (0.78)
          float baseAlpha = (vType < 0.5) ? 0.62 : 0.78;
          float alpha = (baseAlpha + vSparkle * 0.22) * depthFade * nearCamFade;

          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.wormholePointsMesh = new THREE.Points(this.wormholeGeometry, this.wormholeMaterial);
    this.wormholePointsMesh.frustumCulled = false;
    // Add to spiralGroup so it aligns with tilt and rotation
    this.spiralGroup.add(this.wormholePointsMesh);
  }

  /**
   * Evaluates the 3D center spine of the wormhole at depth z and time t.
   * Anchors solidly to the foreground funnel throat at z = -2.60,
   * then gently sways left/right (X) and up/down (Y) in an expressive cosmic dance.
   * Identical in formula to the GLSL vertex shader so numbers ride inside the tube in sync.
   */
  private getWormholeSpine(z: number, time: number): { x: number; y: number } {
    if (z >= 0.0) {
      return { x: 0.0, y: 0.0 };
    }
    if (z >= -2.60) {
      const t = -z / 2.60;
      return { x: 3.20 * t, y: 0.0 };
    }
    const d = -2.60 - z;
    const ramp = 1.0 - Math.exp(-0.045 * d);

    // Faster, dynamic motion with stronger 3D curves
    const slowTime = time * 0.60;
    const swayX =
      10.5 * Math.sin(0.024 * d - slowTime * 0.80) +
      4.2 * Math.sin(0.048 * d + slowTime * 0.50 + 0.9);
    const swayY =
      7.2 * Math.cos(0.020 * d - slowTime * 0.65) +
      3.0 * Math.sin(0.038 * d - slowTime * 0.45 + 1.3);

    // Smooth transition from throat point (3.20, 0.0)
    const throatDecay = Math.exp(-0.06 * d);
    const x = 3.20 * throatDecay + (1.0 - throatDecay) * (ramp * swayX);
    const y = 0.0 * throatDecay + (1.0 - throatDecay) * (ramp * swayY);

    return { x, y };
  }

  /**
   * Advances the background wormhole particle animation uniform.
   * The GPU vertex shader executes all forward motion and tube physics.
   */
  private updateWormholeParticles(time: number, dt: number): void {
    if (this.wormholeMaterial) {
      this.wormholeMaterial.uniforms['uTime'].value = time;
    }
    if (this.wormholeMembraneMaterial) {
      this.wormholeMembraneMaterial.uniforms['uTime'].value = time;
    }
  }

  /**
   * Precomputes 3D coordinates for the 5 outer rings of the foreground funnel (Trichter).
   */
  private precomputeFunnelAndHosePath(): void {
    this.funnelPoints = [];

    const targetTotalTh = 5.0 * 2 * Math.PI; // 5 full turns
    const dr_step = (this.mouthRadius - this.throatRadius) / targetTotalTh;

    let currTh = 0;
    let currR = this.throatRadius;

    // Funnel points from throat (index 0, R=3.20, Z=-2.60) to mouth (R=8.20, Z=0.0)
    while (currTh < targetTotalTh) {
      const t = currTh / targetTotalTh;
      const z = -2.60 * Math.pow(1 - t, 1.35);
      this.funnelPoints.push({
        x: currR * Math.cos(currTh),
        y: currR * Math.sin(currTh),
        z,
        r: currR,
        th: currTh,
      });
      const dth = this.tileArcSpacing / currR;
      currTh += dth;
      currR = this.throatRadius + dr_step * currTh;
    }
  }

  /**
   * Computes target 3D coordinates (x, y, z), polar angle, radius, and scale for a tile.
   * Maps tiles strictly to either the foreground funnel (outer 5 rings) or the snaking wormhole:
   * - When totalCount <= funnelLength: tiles naturally spiral outward from throat to rim.
   * - When totalCount > funnelLength: the newest funnelLength tiles remain in the foreground funnel,
   *   while older tiles are sucked backward and sway synchronously with the wormhole.
   * - Separation between all adjacent tiles is strictly >= 0.30, preventing any overlap at 1000+ digits.
   */
  private calculateTileTarget(
    tileIndex: number,
    totalCount: number,
    time = 0
  ): { x: number; y: number; z: number; r: number; th: number; scale: number; inHose: boolean } {
    const funnelLen = this.funnelPoints.length;
    if (funnelLen === 0) {
      return { x: 0, y: 0, z: 0, r: 0, th: 0, scale: 1.0, inHose: false };
    }

    const fromNewest = Math.max(0, totalCount - 1 - tileIndex);

    if (totalCount <= funnelLen) {
      const idx = Math.min(tileIndex, funnelLen - 1);
      const pt = this.funnelPoints[idx];
      return { x: pt.x, y: pt.y, z: pt.z, r: pt.r, th: pt.th, scale: 1.0, inHose: false };
    } else {
      if (fromNewest < funnelLen) {
        const funnelIdx = funnelLen - 1 - fromNewest;
        const pt = this.funnelPoints[funnelIdx];
        return { x: pt.x, y: pt.y, z: pt.z, r: pt.r, th: pt.th, scale: 1.0, inHose: false };
      } else {
        // Tile is in the snaking wormhole hose: sways dynamically with the wormhole!
        const hoseIdx = fromNewest - funnelLen;
        const targetZ = -2.60 - (hoseIdx + 1) * 0.98;
        const spine = this.getWormholeSpine(targetZ, time);
        return {
          x: spine.x,
          y: spine.y,
          z: targetZ,
          r: Math.hypot(spine.x, spine.y),
          th: Math.atan2(spine.y, spine.x),
          scale: 1.0,
          inHose: true,
        };
      }
    }
  }

  /**
   * Spawns a single free-floating decimal digit at the calculated coordinate.
   * Renders the digit in Orbitron font with pleasant glowing blue aura and no tile box.
   */
  private spawnSingleTile(
    index: number,
    playAudio: boolean,
    batchPosition: number,
    isAutoFlow = false
  ): void {
    const digit = getPiDigitAfter14(index);
    const currentTotal = this.tiles.length + 1;
    const target = this.calculateTileTarget(index, currentTotal);

    // Initial 3D Position
    const basePosition = new THREE.Vector3(target.x, target.y, target.z);
    const targetPosition = new THREE.Vector3(target.x, target.y, target.z);

    // Reuse the pre-rendered glowing blue Orbitron digit material
    const material = this.digitMaterials[digit] || this.digitMaterials[0];

    const mesh = new THREE.Mesh(this.tileGeometry, material);
    mesh.position.copy(basePosition);
    // Keep digit upright so numbers are always legible and never upside-down
    mesh.rotation.z = 0;
    mesh.scale.set(0, 0, 0); // starts smoothly at 0 for seamless bloom-in

    this.spiralGroup.add(mesh);

    const tile: MosaicTile = {
      mesh,
      index,
      digit,
      theta: target.th,
      radius: target.r,
      basePosition,
      targetPosition,
      targetScale: target.scale,
      elevation: isAutoFlow ? 0.16 : 0.38, // Subtle, soft lift for elegant emergence
      elevationVelocity: 0,
      scaleProgress: 0,
      evadeOffset: new THREE.Vector2(0, 0),
      evadeScale: 1.0,
      evadeRotation: 0,
    };

    this.tiles.push(tile);
    this.digitCount.set(this.tiles.length);

    // Play harmonious pentatonic chime
    if (playAudio && this.isSoundEnabled()) {
      const pentatonicIndex = (digit + batchPosition) % 10;
      const vol = isAutoFlow ? 0.14 : 0.26;
      this.audioService.playChime(pentatonicIndex, vol);
    }

    // Trigger resonant Laola impulse only on manual additions to keep Auto-Flow calm and silky
    if (!isAutoFlow) {
      this.propagateLaolaWave(this.tiles.length - 1);
    }

    // Update target camera distance to keep the expanding spiral in view
    this.updateTargetCameraZoom();
  }

  /**
   * Triggers a traveling wave pulse backwards through the most recent tiles.
   * Imparts velocity smoothly to spring physics rather than abruptly teleporting positions.
   */
  private propagateLaolaWave(newestTileIndex: number): void {
    const waveLength = 12;
    const start = Math.max(0, newestTileIndex - waveLength);

    for (let i = start; i < newestTileIndex; i++) {
      const distance = newestTileIndex - i;
      const delayMs = distance * 22;
      const impulse = 0.28 * Math.pow(0.82, distance);

      const timerId = window.setTimeout(() => {
        if (i < this.tiles.length) {
          const t = this.tiles[i];
          t.elevationVelocity += impulse * 9.0;
        }
      }, delayMs);
      this.pendingSpawnTimeouts.push(timerId);
    }
  }

  /**
   * Pre-renders crisp textures and materials for digits 0-9 in Orbitron font (#3b82f6)
   * with a clearly visible, bright luminous light-blue drop-shadow positioned to the right behind each digit.
   */
  private initDigitMaterials(): void {
    const maxAnisotropy = this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : 16;
    const isUpdating = this.digitMaterials.length === 10;

    for (let d = 0; d < 10; d++) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      // Clear transparent canvas
      ctx.clearRect(0, 0, 512, 512);

      // 1. Ethereal centered circular blue glow halo with wider diffusion/spread
      const radialGlow = ctx.createRadialGradient(256, 256, 25, 256, 256, 235);
      radialGlow.addColorStop(0, 'rgba(56, 189, 248, 0.46)');
      radialGlow.addColorStop(0.35, 'rgba(59, 130, 246, 0.28)');
      radialGlow.addColorStop(0.68, 'rgba(37, 99, 235, 0.12)');
      radialGlow.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
      ctx.fillStyle = radialGlow;
      ctx.beginPath();
      ctx.arc(256, 256, 235, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '700 290px "Orbitron", "Orbitron-Regular", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 2. Centered vibrant blue neon glow directly on the digit with broader spread
      ctx.shadowColor = 'rgba(56, 189, 248, 0.95)';
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.shadowBlur = 52;
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(d.toString(), 256, 256);

      // 3. Drop-shadow placed slightly to the right behind the number with softer spread (+20px X, +8px Y)
      ctx.shadowColor = '#38bdf8';
      ctx.shadowOffsetX = 20;
      ctx.shadowOffsetY = 8;
      ctx.shadowBlur = 20;
      ctx.fillStyle = 'rgba(125, 211, 252, 0.85)';
      ctx.fillText(d.toString(), 256, 256);

      // 4. Front sharp number in #3b82f6 (crisp, solid glyph)
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#3b82f6';
      ctx.fillText(d.toString(), 256, 256);

      const texture = new THREE.CanvasTexture(canvas);
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = maxAnisotropy;

      if (isUpdating && this.digitMaterials[d]) {
        this.digitMaterials[d].map?.dispose();
        this.digitMaterials[d].map = texture;
        this.digitMaterials[d].needsUpdate = true;
      } else {
        const mat = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        if (isUpdating) {
          this.digitMaterials[d] = mat;
        } else {
          this.digitMaterials.push(mat);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Camera Auto-Zoom Calculation
  // ---------------------------------------------------------------------------

  /**
   * Dynamically calculates target camera distance Z so the outer 5 rings
   * of the spiral are comfortably framed, cleanly centered, and strictly above the dock.
   */
  private updateTargetCameraZoom(): void {
    if (this.tiles.length === 0) {
      this.targetCameraZ = this.baseCameraZ * 0.75;
      return;
    }

    const aspect = this.camera?.aspect || 1;
    if (isNaN(aspect) || aspect <= 0) return;

    const vFovRad = (this.camera.fov * Math.PI) / 180;
    const tanHalfFov = Math.tan(vFovRad / 2);

    // Current effective outer radius (capped once outer 5 rings are reached at ~176 tiles)
    const funnelLen = this.funnelPoints.length || 176;
    const progress = Math.min(1.0, this.tiles.length / funnelLen);
    const effectiveOuterR = this.throatRadius + progress * (this.mouthRadius - this.throatRadius);
    const marginRadius = effectiveOuterR + 0.85;

    // Framing factors: 0.68 vertically guarantees dock is always below the spiral;
    // 0.75 horizontally guarantees comfortable flank margins on desktop and mobile.
    const requiredZVertical = marginRadius / (tanHalfFov * 0.68);
    const requiredZHorizontal = marginRadius / (tanHalfFov * aspect * 0.75);

    const neededZ = Math.max(requiredZVertical, requiredZHorizontal);
    if (!isNaN(neededZ) && isFinite(neededZ)) {
      // Only auto-adjust when user is in spiral overview mode (not flying deep inside the wormhole)
      if (this.targetCameraZ >= 10.0) {
        this.targetCameraZ = Math.min(this.maxCameraZ, Math.max(16.0, neededZ));
      }
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

    // 0. Update background 3D particle pixel wormhole tunnel (orb-nav square pixel aesthetics)
    this.updateWormholeParticles(time, dt);

    // Auto-Flow continuous generation: frame-synced, smooth cadence without burst stalls
    if (this.isAutoFlowActive()) {
      this.autoFlowTimer += dt;
      // Cap accumulator to avoid spiral bursts if tab was backgrounded
      if (this.autoFlowTimer > 0.3) {
        this.autoFlowTimer = this.AUTO_FLOW_STEP;
      }
      while (this.autoFlowTimer >= this.AUTO_FLOW_STEP) {
        this.autoFlowTimer -= this.AUTO_FLOW_STEP;
        this.spawnNextDigitAuto();
      }
    }

    // 1. Raycast onto spiralGroup local plane for bubble-letter hover evasion
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

    // 2. Center Hero ("3,14") with bubble-letter hover evasion and Pulsating Pi symbol ("π")
    if (this.centerTileMesh) {
      let targetCenterPushX = 0;
      let targetCenterPushY = 0;
      let targetCenterScale = 1.0;
      let targetCenterRot = 0;

      if (hasHit) {
        const dx = 0 - this.localHitPoint.x;
        const dy = 0 - this.localHitPoint.y;
        const dist = Math.hypot(dx, dy);
        const radius = 1.5; // Interaction radius for center 3,14 (subtle micro-reaction)

        if (dist < radius && dist > 0.001) {
          const norm = dist / radius;
          const force = Math.pow(1 - norm, 1.8);
          const pushMagnitude = 0.28; // Very subtle, gentle evasion
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

    // 3. Physics, 3D Wormhole Glide & Bubble-Letter Hover Evasion for all floating digits
    const totalTiles = this.tiles.length;
    const lerpHose = 1.0 - Math.exp(-12.0 * dt);
    const lerpFunnel = 1.0 - Math.exp(-8.0 * dt);
    const lerpScaleSpeed = dt * 6.5;

    for (let i = 0; i < totalTiles; i++) {
      const tile = this.tiles[i];

      // Refresh target position based on current total tiles and current wormhole sway time
      const target = this.calculateTileTarget(tile.index, totalTiles, time);
      tile.targetPosition.set(target.x, target.y, target.z);
      tile.targetScale = target.scale;
      tile.radius = target.r;
      tile.theta = target.th;

      // Smoothly glide existing tiles along funnel & hose as new ones appear (dt-based)
      if (target.inHose) {
        tile.basePosition.x += (target.x - tile.basePosition.x) * lerpHose;
        tile.basePosition.y += (target.y - tile.basePosition.y) * lerpHose;
        tile.basePosition.z += (target.z - tile.basePosition.z) * (1.0 - Math.exp(-5.0 * dt));
      } else {
        tile.basePosition.lerp(tile.targetPosition, lerpFunnel);
      }

      // Bubble-letter hover evasion for decimal digits (active for foreground funnel tiles)
      let targetTilePushX = 0;
      let targetTilePushY = 0;
      let targetTileScale = 1.0;
      let targetTileRot = 0;

      if (hasHit && tile.basePosition.z > -4.5) {
        const dx = tile.basePosition.x - this.localHitPoint.x;
        const dy = tile.basePosition.y - this.localHitPoint.y;
        const dist = Math.hypot(dx, dy);
        const radius = 1.55; // Interaction radius for decimal digits

        if (dist < radius && dist > 0.001) {
          const norm = dist / radius;
          const force = Math.pow(1 - norm, 1.6);
          const pushMagnitude = 0.58; // Gently reduced evasion force
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

      // Tile surface orientation: digits upright + camera slope tilt + evade tilt around Z
      if (!target.inHose) {
        const tiltAngle = 0.16;
        const cosTh = Math.cos(tile.theta);
        const sinTh = Math.sin(tile.theta);
        tile.mesh.rotation.x = -sinTh * tiltAngle;
        tile.mesh.rotation.y = cosTh * tiltAngle;
      } else {
        const spineAhead = this.getWormholeSpine(tile.basePosition.z - 2.0, time);
        const spineBehind = this.getWormholeSpine(tile.basePosition.z + 2.0, time);
        const dX = (spineAhead.x - spineBehind.x) / 4.0;
        const dY = (spineAhead.y - spineBehind.y) / 4.0;
        tile.mesh.rotation.x = Math.max(-0.40, Math.min(0.40, -dY * 0.7));
        tile.mesh.rotation.y = Math.max(-0.40, Math.min(0.40, dX * 0.7));
      }
      tile.mesh.rotation.z = tile.evadeRotation;

      // Pop-in scale animation multiplied by bubble evasion scale (frame-rate independent)
      if (tile.scaleProgress < 1) {
        tile.scaleProgress = Math.min(1, tile.scaleProgress + lerpScaleSpeed);
      }
      const s = this.easeOutBack(tile.scaleProgress) * tile.targetScale * tile.evadeScale;
      tile.mesh.scale.set(s, s, s);

      // Spring elevation wave physics: z'' = -k*z - d*v (critically damped)
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

      // Final position: base 3D wormhole position + dynamic wave elevation + bubble evasion offset
      tile.mesh.position.set(
        tile.basePosition.x + tile.evadeOffset.x,
        tile.basePosition.y + tile.evadeOffset.y,
        tile.basePosition.z + tile.elevation
      );
    }

    // 4. Smooth Rotation/Tilt interpolation
    const rotLerp = 1.0 - Math.exp(-6.0 * dt);
    this.currentTiltX += (this.targetTiltX - this.currentTiltX) * rotLerp;
    this.currentTiltY += (this.targetTiltY - this.currentTiltY) * rotLerp;

    this.spiralGroup.rotation.set(0, 0, 0);
    this.spiralGroup.updateMatrixWorld(true);

    // 5. Smooth Camera Position & Dynamic Wormhole Flight Navigation with True 3D Tilt in all directions
    const camLerp = 1.0 - Math.exp(-4.2 * dt);
    this.currentCameraZ += (this.targetCameraZ - this.currentCameraZ) * camLerp;

    let worldCamPos: THREE.Vector3;
    let worldLookAt: THREE.Vector3;

    if (this.currentCameraZ >= 14.0) {
      // Full overview: camera orbits center (0, -0.25, 0) with Pitch (tiltX) and Yaw (tiltY)
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
      // Transition zone: smoothly banking from center overview towards throat
      const t = (14.0 - this.currentCameraZ) / (14.0 - (-2.60));
      const blend = t * t * (3.0 - 2.0 * t); // smoothstep

      // Overview anchor at current distance
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

      const lookAheadSpine = this.getWormholeSpine(-2.60 - 10.0, time);
      const lookX = THREE.MathUtils.lerp(0, lookAheadSpine.x + 8.0 * sinY, blend);
      const lookY = THREE.MathUtils.lerp(-0.25, lookAheadSpine.y + 8.0 * (sinX - Math.sin(this.defaultTiltX)), blend);
      const lookZ = THREE.MathUtils.lerp(0, -2.60 - 10.0, blend);
      worldLookAt = new THREE.Vector3(lookX, lookY, lookZ);
    } else {
      // Deep inside wormhole: camera flies through the snaking tube and looks around in all directions
      const camSpine = this.getWormholeSpine(this.currentCameraZ, time);
      worldCamPos = new THREE.Vector3(camSpine.x + 0.35, camSpine.y + 0.65, this.currentCameraZ);

      const lookAheadZ = this.currentCameraZ - 12.0;
      const lookSpine = this.getWormholeSpine(lookAheadZ, time);
      const lookX = lookSpine.x + 12.0 * Math.sin(this.currentTiltY);
      const lookY = lookSpine.y + 12.0 * (Math.sin(this.currentTiltX) - Math.sin(this.defaultTiltX));
      worldLookAt = new THREE.Vector3(lookX, lookY, lookAheadZ);
    }

    this.camera.position.copy(worldCamPos);
    this.camera.lookAt(worldLookAt);

    // 6. Render Scene
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Spawns the next decimal digit during Auto-Flow meditation mode.
   * Frame-synced and evenly spaced for a soothing, seamless flow.
   */
  private spawnNextDigitAuto(): void {
    const digitIndex = this.scheduledCount++;
    this.autoFlowChimeCounter++;
    // Play gentle chime every 2nd digit for a musical, non-intrusive rhythm
    const playAudio = (this.autoFlowChimeCounter % 2 === 0);
    this.spawnSingleTile(digitIndex, playAudio, this.autoFlowChimeCounter, true);
  }

  /**
   * Smooth, gentle ease function with soft overshoot for organic tile pop-in.
   */
  private easeOutBack(x: number): number {
    const c1 = 0.82;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  // ---------------------------------------------------------------------------
  // Pointer Interaction (Click to add, Drag to tilt/rotate, Wheel to zoom)
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

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      this.hasDragged = true;
    }

    const tiltSpeed = 0.0040;

    // Pitch (vertical tilt: up/down) strictly bounded around default 0.22 (approx -6° to +32°)
    this.targetTiltX = Math.max(-0.10, Math.min(0.55, this.targetTiltX + deltaY * tiltSpeed));
    // Yaw (horizontal tilt: left/right) strictly clamped to ±0.45 rad (~±26°) to prevent full rotation
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

    // If it was a clean click without significant drag, add 5 more digits!
    if (!this.hasDragged) {
      this.addFiveDigits();
    }
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    // Dynamic wheel step: fine control in overview, swift responsive travel through deep wormhole
    const speed = this.targetCameraZ < 5.0 ? 0.050 : 0.018;
    const zoomDelta = event.deltaY * speed;
    this.targetCameraZ = Math.max(this.minCameraZ, Math.min(this.maxCameraZ, this.targetCameraZ + zoomDelta));
  }

  /**
   * Double-clicking anywhere on the canvas smoothly resets the camera back to the centered overview.
   */
  onDoubleClick(): void {
    this.targetCameraZ = this.baseCameraZ;
    this.targetTiltX = this.defaultTiltX;
    this.targetTiltY = 0;
  }

  // ---------------------------------------------------------------------------
  // Pi Speech Bubble Interaction
  // ---------------------------------------------------------------------------

  /**
   * Toggles the visibility of the Pi speech bubble.
   */
  togglePiBubble(event?: Event): void {
    event?.stopPropagation();
    if (this.showPiBubble()) {
      this.closePiBubble();
    } else {
      this.openPiBubble();
    }
  }

  /**
   * Opens the Pi speech bubble with balloon inflate animation.
   */
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

  /**
   * Closes the Pi speech bubble with balloon deflate animation.
   */
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

  /**
   * Handles mouse wheel scrolling specifically for the speech bubble content
   * and prevents bubbling to parent canvas zoom.
   */
  onPiBubbleWheel(event: WheelEvent): void {
    event.stopPropagation();
    const target = event.target as HTMLElement | null;
    const bubble = event.currentTarget as HTMLElement | null;
    const body = bubble?.querySelector('.bubble-body') as HTMLElement | null;
    if (body && target && !body.contains(target)) {
      body.scrollTop += event.deltaY;
      event.preventDefault();
    }
  }

  /**
   * Copies the full Pi number generated so far to the clipboard.
   */
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

  /**
   * Toggles the automatic meditation flow mode.
   */
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

  /**
   * Resets camera tilt, rotation, and distance to optimal auto-framed view.
   */
  resetCameraView(): void {
    this.targetTiltX = this.defaultTiltX;
    this.targetTiltY = 0;
    this.updateTargetCameraZoom();
    this.audioService.playBubbleHover();
  }

  /**
   * Toggles chime sound effects.
   */
  toggleSound(): void {
    this.isSoundEnabled.update((v) => !v);
  }

  /**
   * Resets the entire spiral back to the initial center stone.
   */
  resetSpiral(): void {
    this.stopAutoFlow();
    this.autoFlowTimer = 0;
    this.autoFlowChimeCounter = 0;
    this.clearPendingSpawnTimeouts();

    // Remove all standard tiles from scene
    for (const tile of this.tiles) {
      this.spiralGroup.remove(tile.mesh);
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

    // Re-seed initial 5 digits after reset
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
    for (const mat of this.digitMaterials) {
      mat.dispose();
    }
    this.digitMaterials = [];

    if (this.wormholeMembraneMesh) {
      this.spiralGroup?.remove(this.wormholeMembraneMesh);
    }
    if (this.wormholeMembraneGeometry) {
      this.wormholeMembraneGeometry.dispose();
    }
    if (this.wormholeMembraneMaterial) {
      this.wormholeMembraneMaterial.dispose();
    }

    if (this.wormholePointsMesh) {
      this.spiralGroup?.remove(this.wormholePointsMesh);
    }
    if (this.wormholeGeometry) {
      this.wormholeGeometry.dispose();
    }
    if (this.wormholeMaterial) {
      this.wormholeMaterial.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
      const dom = this.renderer.domElement;
      if (dom && dom.parentElement) {
        dom.parentElement.removeChild(dom);
      }
    }
  }
}
