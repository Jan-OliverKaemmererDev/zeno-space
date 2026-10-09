import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
  signal,
  HostListener,
  NgZone,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import * as THREE from 'three';
import { GrasAudioService } from './services/gras-audio.service';
import {
  GRASS_VERTEX_SHADER,
  GRASS_FRAGMENT_SHADER,
  SKY_BACKDROP_VERTEX_SHADER,
  SKY_BACKDROP_FRAGMENT_SHADER,
} from './shaders/grass.shaders';
import {
  TimeOfDay,
  THEMES,
} from './utils/sky-cloud-generator';

/**
 * Wind particle interface for prairie pollen / dandelion specks and
 * the swirling anime tornado whirlwind funnel rising into the sky.
 */
interface WindParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  baseY: number;
  baseX: number;              // Rest anchor X for firefly 3D wandering
  baseZ: number;              // Rest anchor Z for firefly 3D wandering
  wanderPhase: number;        // Individual hovering Lissajous phase
  pulsePhase: number;         // Firefly bioluminescence flicker phase
  pulseSpeed: number;         // Individual breathing frequency
  swirlPhase: number;
  isAirborne: boolean;
  // Dedicated tornado whirlwind properties
  isTornadoVortex: boolean;
  funnelHeight: number;       // Height above terrain inside the tornado (0 to 18m)
  swirlAngle: number;         // Rotation angle around the vortex axis
  radiusOffset: number;       // Individual radius variation
  speedMultiplier: number;    // Upward suction speed variation
  colorR: number;
  colorG: number;
  colorB: number;
  alpha: number;              // Opacity / visibility (0.0 to 1.0)
  isSettling: boolean;        // True when mouse released: particle drifts gently to ground
}

/**
 * "Gras-Harmonie" - Interactive 3D Wind & Grass Oasis minigame for zeno-space.
 * Authentic Studio Ghibli countryside experience:
 * - Monumental breathing anime cumulus cloud backdrop
 * - Rolling green prairie topography mirroring the iconic anime reference
 * - 180,000 multi-segmented silky grass blades + delicate wildflower blooms
 * - Painterly lush green moss & clover ground texture (no brown dirt!)
 */
@Component({
  selector: 'app-gras-harmonie',
  standalone: true,
  imports: [RouterLink],
  providers: [GrasAudioService],
  templateUrl: './gras-harmonie.component.html',
  styleUrl: './gras-harmonie.component.scss',
})
export class GrasHarmonieComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  readonly audio = inject(GrasAudioService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  // Reactive UI signals
  readonly timeOfDay = signal<TimeOfDay>('day');
  readonly windPreset = signal<'gentle' | 'fresh' | 'gust'>('fresh');
  readonly bladeCount = signal<number>(240000);
  readonly windSpeedDisplay = signal<string>('Sanfte Brise (14 km/h)');
  readonly isMuted = this.audio.isMuted;

  // Three.js Core
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private animFrameId: number | null = null;
  private isDestroyed = false;
  private textureLoader = new THREE.TextureLoader();

  // Sky Backdrop
  private skyMesh!: THREE.Mesh;
  private skyMaterial!: THREE.ShaderMaterial;

  // Grass Engine & Terrain
  private grassMesh!: THREE.InstancedMesh;
  private grassMaterial!: THREE.ShaderMaterial;
  private terrainMesh!: THREE.Mesh;

  // Atmosphere theme smooth transition state
  private targetTheme = THEMES[this.timeOfDay()];
  private targetGoldenWeight = this.timeOfDay() === 'golden' ? 1.0 : 0.0;
  private targetNightWeight = this.timeOfDay() === 'night' ? 1.0 : 0.0;
  private currentGoldenWeight = this.timeOfDay() === 'golden' ? 1.0 : 0.0;
  private currentNightWeight = this.timeOfDay() === 'night' ? 1.0 : 0.0;
  private targetFogDensity = this.timeOfDay() === 'night' ? 0.016 : 0.008;
  private currentFogDensity = this.timeOfDay() === 'night' ? 0.016 : 0.008;
  private isThemeTransitioning = false;

  // Interaction Raycaster & Wind Physics
  private raycaster = new THREE.Raycaster();
  private groundRayPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private pointer2D = new THREE.Vector2(-999, -999);
  private targetMouseGround = new THREE.Vector3(0, 0, 0);
  private smoothMouseGround = new THREE.Vector3(0, 0, 0);
  private prevMouseGround = new THREE.Vector3(0, 0, 0);
  private isPointerDown = false;
  private pointerHoldTimer = 0.0;
  private tornadoStrength = 0.0;

  // Concurrent Directional Waves (Ring buffer for 16 waves rolling across the entire prairie)
  // Each wave propagates forward independently across the hills to the horizon,
  // unaffected by subsequent strokes or direction changes.
  // Concurrent Directional & Circular Waves (Ring buffer for 24 waves rolling across the entire prairie)
  private readonly maxDirWaves = 24;
  private dirWaves = Array.from({ length: 24 }, () => ({
    originX: 0,
    originZ: 0,
    dirX: 0,
    dirZ: 1,
    time: 99.0,
    strength: 0.0,
    speed: 18.0,
    maxDist: 95.0,
  }));
  private nextDirWaveIndex = 0;
  private dirWaveUniformsA = Array.from(
    { length: 24 },
    () => new THREE.Vector4(0, 0, 0, 1)
  );
  private dirWaveUniformsB = Array.from(
    { length: 24 },
    () => new THREE.Vector4(99, 0, 18.0, 95.0)
  );

  private lastStrokePos = new THREE.Vector3(0, 0, 0);
  private lastSpawnDir = new THREE.Vector2(0, 1);
  private lastSpawnTime = 0;

  // Concurrent Click Shockwaves (Ring buffer for 5 waves)
  private shockwaves = [
    { x: 0, z: 0, time: 99.0, strength: 0.0 },
    { x: 0, z: 0, time: 99.0, strength: 0.0 },
    { x: 0, z: 0, time: 99.0, strength: 0.0 },
    { x: 0, z: 0, time: 99.0, strength: 0.0 },
    { x: 0, z: 0, time: 99.0, strength: 0.0 },
  ];
  private nextShockwaveIndex = 0;
  private shockwaveUniforms = [
    new THREE.Vector4(0, 0, 99.0, 0.0),
    new THREE.Vector4(0, 0, 99.0, 0.0),
    new THREE.Vector4(0, 0, 99.0, 0.0),
    new THREE.Vector4(0, 0, 99.0, 0.0),
    new THREE.Vector4(0, 0, 99.0, 0.0),
  ];

  // Concurrent Monumental Windstoß Gust Waves (Ring buffer for 3 panoramic waves rolling across the entire field)
  private readonly maxGustWaves = 3;
  private gustWaves = Array.from({ length: 3 }, () => ({
    time: 99.0,
    strength: 0.0,
    speed: 28.0,
    width: 22.0,
    dirX: 0.12,
    dirZ: -0.99,
    originX: 0.0,
    originZ: 24.0,
    maxDist: 125.0,
  }));
  private nextGustWaveIndex = 0;
  private gustWaveUniformsA = Array.from(
    { length: 3 },
    () => new THREE.Vector4(99.0, 0.0, 28.0, 22.0)
  );
  private gustWaveUniformsB = Array.from(
    { length: 3 },
    () => new THREE.Vector4(0.12, -0.99, 0.0, 24.0)
  );

  // Wind Particle System: 180 ambient meadow specks + 140 swirling tornado vortex particles
  private readonly ambientParticleCount = 180;
  private readonly tornadoParticleCount = 140;
  private readonly particleCount = 320;
  private particles: WindParticle[] = [];
  private particlePoints!: THREE.Points;
  private particlePositions!: Float32Array;
  private particleColors!: Float32Array;
  private tornadoSpawnTimer = 0.0;

  // Camera vantage point: elevated view overlooking the rolling prairie hillside
  private baseCamPos = new THREE.Vector3(0, 10.8, 19.5);
  private targetCamLookAt = new THREE.Vector3(0, 1.2, -13.5);

  /**
   * Escape key returns gracefully to the central bubble hub.
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.router.navigate(['/'], { fragment: 'bubble-hub' });
  }

  /**
   * Space key triggers a wide sweeping wind gust.
   */
  @HostListener('document:keydown.space', ['$event'])
  onSpace(event: Event): void {
    event.preventDefault();
    this.triggerWindGust();
  }

  /**
   * Number keys 1, 2, 3 toggle time of day.
   */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.key === '1') this.setTimeOfDay('day');
    if (event.key === '2') this.setTimeOfDay('golden');
    if (event.key === '3') this.setTimeOfDay('night');
  }

  ngAfterViewInit(): void {
    this.audio.init();
    this.initThree();
    this.buildSkyBackdrop();
    this.buildTerrainAndGrass();
    this.buildMinimalistParticles();
    this.onResize();
    this.syncCursorAtmosphere(this.timeOfDay());

    window.addEventListener('resize', this.onResize);

    // Run animation outside Angular zone for steady 60-120 FPS
    this.ngZone.runOutsideAngular(() => {
      this.animate();
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (typeof document !== 'undefined') {
      document.body.classList.remove('in-sanctuary');
      document.body.classList.remove('in-night');
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    this.audio.destroy();
    this.disposeThree();
  }

  /**
   * Initializes Three.js WebGL scene, camera and anti-aliased renderer.
   */
  private initThree(): void {
    const container = this.containerRef.nativeElement;

    this.scene = new THREE.Scene();
    const initialTheme = THEMES[this.timeOfDay()];
    this.scene.background = new THREE.Color(initialTheme.skyColor);
    this.scene.fog = new THREE.FogExp2(initialTheme.skyColor.getHex(), 0.008);

    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / (container.clientHeight || 1),
      0.1,
      400
    );
    this.camera.position.copy(this.baseCamPos);
    this.camera.lookAt(this.targetCamLookAt);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(initialTheme.skyColor, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    container.appendChild(this.renderer.domElement);
  }

  /**
   * Terrain elevation function creating the rolling hills and hillside vista
   * authentically reflecting the reference artwork:
   * - Vordergrund: Hang fällt sanft von rechts nach links und nach vorne ab.
   * - Mittelgrund: Weites, saftig grünes Tal mit sanft gewellten Hängen.
   * - Hintergrund: Sanfte Vorgebirgskette entlang des Horizonts unter den Wolken.
   */
  private getTerrainHeight(x: number, z: number): number {
    // 1. Vordergrund-Hang (wie im Bild: von rechts-oben nach links-unten abfallend)
    const foreSlopeZ = Math.max(-0.6, Math.min(2.5, (17.0 - z) * 0.11));
    // Sanfte Sättigung mit tanh: Rechts sanft höher (~+2.6m), links tiefer (~-2.6m),
    // bleibt auch auf extremen Widescreen-Monitoren natürlich begrenzt und rollend
    const foreSlopeX = Math.tanh(x * 0.036) * 2.6;
    const foregroundHill = foreSlopeZ + foreSlopeX;

    // 2. Weites Tal & mittlere geschwungene Hügel (z: +4 bis -24)
    const midValley =
      Math.sin(x * 0.046 + z * 0.076 + 1.25) * 2.3 +
      Math.cos(-x * 0.052 + z * 0.068 + 0.70) * 1.9;

    // 3. Durchgehende Vorgebirgskette am Horizont (direkt unter der Wolke, wie im Bild)
    const horizonFoothills =
      Math.sin(x * 0.038) * 1.7 + Math.sin(x * 0.082) * 0.95;
    const distantRise = Math.max(0.0, -z - 6.0) * 0.078;

    // Tiefenblendung:
    // Im unmittelbaren Vordergrund (z >= 10) dominiert der geneigte Hang wie im Bild,
    // ab mittlerer Tiefe öffnen sich das Tal und die Horizont-Hügelkette
    const depthT = Math.min(1.0, Math.max(0.0, (18.0 - z) / 15.0));

    return (
      foregroundHill * (1.0 - depthT * 0.65) +
      (midValley * 0.95 + horizonFoothills * 1.2 + distantRise) * depthT
    );
  }

  /**
   * Builds the monumental Studio Ghibli cumulus backdrop plane
   * with meditative breathing, living wind animation, and seamless panoramic widescreen support.
   */
  private buildSkyBackdrop(): void {
    const skyTexture = this.textureLoader.load('/images/gras-harmonie/sky-backdrop.jpg');
    skyTexture.wrapS = THREE.MirroredRepeatWrapping;
    skyTexture.wrapT = THREE.ClampToEdgeWrapping;
    skyTexture.colorSpace = THREE.SRGBColorSpace;

    // Panoramic plane geometry covering up to 48:9 multi-monitor setups without cut-off
    const skyGeo = new THREE.PlaneGeometry(640, 150);
    const container = this.containerRef.nativeElement;
    const currentAspect = container.clientWidth / (container.clientHeight || 1);
    const theme = THEMES[this.timeOfDay()];

    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: SKY_BACKDROP_VERTEX_SHADER,
      fragmentShader: SKY_BACKDROP_FRAGMENT_SHADER,
      uniforms: {
        uSkyTexture: { value: skyTexture },
        uTime: { value: 0.0 },
        uTimeOfDay: { value: this.timeOfDay() === 'day' ? 0.0 : this.timeOfDay() === 'golden' ? 1.0 : 2.0 },
        uGoldenWeight: { value: this.currentGoldenWeight },
        uNightWeight: { value: this.currentNightWeight },
        uTint: { value: new THREE.Color(1.0, 1.0, 1.0) },
        uAspect: { value: currentAspect },
        uSkyColor: { value: theme.skyColor.clone() },
      },
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });

    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.skyMesh.position.set(0, 5.0, -84.0);
    this.skyMesh.renderOrder = -2;
    this.scene.add(this.skyMesh);
  }

  /**
   * Builds the rolling ground plane with painterly green moss/turf texture
   * and 180,000 multi-segmented artistic grass blades covering ALL visible hills
   * from foreground to the distant horizon.
   */
  private buildTerrainAndGrass(): void {
    const theme = THEMES[this.timeOfDay()];

    // 1. Underlying rolling ground mesh covering from foreground (z: +45) to deep horizon (z: -85)
    // with width 380 (x: -190 to +190) seamlessly spanning even 32:9 and multi-monitor screens
    const groundGeo = new THREE.PlaneGeometry(380, 130, 200, 120);
    groundGeo.rotateX(-Math.PI / 2);
    const posAttr = groundGeo.attributes['position'];
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i) - 20.0;
      posAttr.setZ(i, z);
      posAttr.setY(i, this.getTerrainHeight(x, z) - 0.04);
    }
    groundGeo.computeVertexNormals();

    const groundTex = this.textureLoader.load('/images/gras-harmonie/moss-ground.jpg');
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(52, 20);
    groundTex.colorSpace = THREE.SRGBColorSpace;

    const groundMat = new THREE.MeshBasicMaterial({
      map: groundTex,
      color: theme.groundColor.clone(),
    });
    this.terrainMesh = new THREE.Mesh(groundGeo, groundMat);
    this.scene.add(this.terrainMesh);

    // 2. Custom Multi-Segmented Hair Blade Geometry (7 height segments for butter-soft bending)
    const bladeHeight = 1.18;
    const bladeWidth = 0.038;
    const bladeSegmentsY = 7;
    const bladeGeo = new THREE.PlaneGeometry(bladeWidth, bladeHeight, 1, bladeSegmentsY);

    const bladePos = bladeGeo.attributes['position'];
    for (let i = 0; i < bladePos.count; i++) {
      const y = bladePos.getY(i) + bladeHeight / 2; // Base rooted at y = 0
      bladePos.setY(i, y);

      const t = y / bladeHeight; // 0 at base, 1 at tip
      const taper = Math.max(0.12, 1.0 - Math.pow(t, 1.25) * 0.88); // Taper to fine hair tip
      bladePos.setX(i, bladePos.getX(i) * taper);

      const curve = Math.pow(t, 2.2) * 0.22; // Subtle natural hair arch
      bladePos.setZ(i, curve);
    }
    bladeGeo.computeVertexNormals();

    // 3. Shader Material with uniforms
    const uniforms = {
      uTime: { value: 0 },
      uWindDir: { value: new THREE.Vector2(0.85, 0.52).normalize() },
      uWindStrength: { value: 1.25 },
      uMousePos: { value: new THREE.Vector3(0, 0, 0) },
      uDirWaveA: { value: this.dirWaveUniformsA },
      uDirWaveB: { value: this.dirWaveUniformsB },
      uShockwaves: { value: this.shockwaveUniforms },
      uTornadoPos: { value: new THREE.Vector2(0, 0) },
      uTornadoStrength: { value: 0.0 },
      uGustWaves: { value: this.gustWaveUniformsA },
      uGustDirs: { value: this.gustWaveUniformsB },
      uBaseColor: { value: theme.grassBase.clone() },
      uMidColor: { value: theme.grassMid.clone() },
      uTipColor: { value: theme.grassTip.clone() },
      uSunDirection: { value: theme.sunDirection.clone() },
      uSunColor: { value: theme.sunColor.clone() },
      uSkyColor: { value: theme.skyColor.clone() },
      uTimeOfDay: { value: this.timeOfDay() === 'day' ? 0.0 : this.timeOfDay() === 'golden' ? 1.0 : 2.0 },
    };

    this.grassMaterial = new THREE.ShaderMaterial({
      vertexShader: GRASS_VERTEX_SHADER,
      fragmentShader: GRASS_FRAGMENT_SHADER,
      uniforms,
      side: THREE.DoubleSide,
      wireframe: false,
    });

    // 4. InstancedMesh Setup: 180,000 dense silky blades covering ALL visible hills from foreground to horizon
    const count = this.bladeCount();
    const instMesh = new THREE.InstancedMesh(bladeGeo, this.grassMaterial, count);

    const colorVars = new Float32Array(count);
    const bladeSeeds = new Float32Array(count);
    const isFlowers = new Float32Array(count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      let x: number;
      let z: number;
      let scaleMult = 1.0;

      if (i < count * 0.28) {
        // Zone 1: Foreground & immediate hillside (z: +20 to +3)
        const t = Math.pow(Math.random(), 0.85);
        z = 20.0 - t * 17.0;
        const halfSpan = 20.0 + (20.0 - z) * 1.6; // 20m at z=20, 47m at z=3
        x = (Math.random() - 0.5) * (halfSpan * 2.0);
        scaleMult = 1.0;
      } else if (i < count * 0.64) {
        // Zone 2: Midground rolling valley & pastures (z: +3 to -24)
        z = 3.0 - Math.random() * 27.0;
        const distFactor = (3.0 - z) / 27.0;
        const halfSpan = 45.0 + distFactor * 52.0; // 45m at z=3, 97m at z=-24
        x = (Math.random() - 0.5) * (halfSpan * 2.0);
        scaleMult = 1.35;
      } else {
        // Zone 3: Distant background rolling foothills all the way to horizon (z: -24 to -75)
        const t = Math.pow(Math.random(), 0.90);
        z = -24.0 - t * 51.0;
        const distFactor = (-z - 24.0) / 51.0; // 0.0 at -24, 1.0 at -75
        const halfSpan = 96.0 + distFactor * 84.0; // 96m at z=-24, 180m at z=-75
        x = (Math.random() - 0.5) * (halfSpan * 2.0);
        scaleMult = 1.55 + distFactor * 1.35; // dense silky coverage all the way to ridge tops
      }

      const y = this.getTerrainHeight(x, z);

      dummy.position.set(x, y, z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.rotation.x = (Math.random() - 0.5) * 0.22;
      dummy.rotation.z = (Math.random() - 0.5) * 0.22;

      // ~4.2% delicate wildflower blooms
      const isFlower = Math.random() < 0.042 ? 1.0 : 0.0;
      isFlowers[i] = isFlower;

      // Natural organic variation
      const heightScale = (0.82 + Math.random() * 0.42) * scaleMult * (isFlower > 0.5 ? 1.2 : 1.0);
      const widthScale = (0.88 + Math.random() * 0.32) * scaleMult * (isFlower > 0.5 ? 1.15 : 1.0);
      dummy.scale.set(widthScale, heightScale, widthScale);

      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);

      colorVars[i] = Math.random();
      bladeSeeds[i] = Math.random();
    }

    bladeGeo.setAttribute('aColorVariation', new THREE.InstancedBufferAttribute(colorVars, 1));
    bladeGeo.setAttribute('aBladeSeed', new THREE.InstancedBufferAttribute(bladeSeeds, 1));
    bladeGeo.setAttribute('aIsFlower', new THREE.InstancedBufferAttribute(isFlowers, 1));

    instMesh.instanceMatrix.needsUpdate = true;
    this.grassMesh = instMesh;
    this.scene.add(this.grassMesh);
  }

  /**
   * Builds the dual wind particle system:
   * 1. 180 delicate firefly particles (Glühwürmchen) that emerge and glow ONLY at night
   * 2. 140 delicate tornado particles that lift smoothly from the ground into the sky
   */
  private buildMinimalistParticles(): void {
    this.particles = [];
    this.particlePositions = new Float32Array(this.particleCount * 3);
    this.particleColors = new Float32Array(this.particleCount * 3);

    // 1. Ambient meadow firefly particles (180, active and visible ONLY at night)
    for (let i = 0; i < this.ambientParticleCount; i++) {
      const z = 18.0 - Math.random() * 52.0;
      const halfSpan = 28.0 + (18.0 - z) * 1.8;
      const x = (Math.random() - 0.5) * (halfSpan * 2.0);
      const groundY = this.getTerrainHeight(x, z);
      const y = groundY + 0.35 + Math.random() * 0.75;

      const colRand = Math.random();
      let cr = 0.82, cg = 0.98, cb = 0.28;
      if (colRand < 0.45) {
        // Warm neon chartreuse firefly glow
        cr = 0.82; cg = 0.98; cb = 0.28;
      } else if (colRand < 0.75) {
        // Warm golden fairy ember glow
        cr = 0.98; cg = 0.92; cb = 0.35;
      } else {
        // Luminous spring green emerald firefly
        cr = 0.50; cg = 1.00; cb = 0.48;
      }

      this.particles.push({
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        baseY: y,
        baseX: x,
        baseZ: z,
        wanderPhase: Math.random() * Math.PI * 2,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 1.6 + Math.random() * 2.2,
        swirlPhase: Math.random() * Math.PI * 2,
        isAirborne: false,
        isTornadoVortex: false,
        funnelHeight: 0,
        swirlAngle: 0,
        radiusOffset: 0,
        speedMultiplier: 1.0,
        colorR: cr,
        colorG: cg,
        colorB: cb,
        alpha: 0.0, // Start invisible: appears only at night!
        isSettling: false,
      });

      this.particlePositions[i * 3] = x;
      this.particlePositions[i * 3 + 1] = y;
      this.particlePositions[i * 3 + 2] = z;

      // Start dark (invisible during day and golden hour)
      this.particleColors[i * 3] = 0;
      this.particleColors[i * 3 + 1] = 0;
      this.particleColors[i * 3 + 2] = 0;
    }

    // 2. Dedicated Tornado Whirlwind particles (140)
    for (let i = 0; i < this.tornadoParticleCount; i++) {
      const idx = this.ambientParticleCount + i;
      const colRand = Math.random();
      let cr = 1.0, cg = 1.0, cb = 1.0;
      if (colRand < 0.45) {
        // Luminous sunlit gold dandelion seeds
        cr = 1.0; cg = 0.94; cb = 0.45;
      } else if (colRand < 0.75) {
        // Emerald & chartreuse meadow leaf flakes
        cr = 0.58; cg = 0.98; cb = 0.48;
      } else if (colRand < 0.88) {
        // Ethereal white wind wisps
        cr = 1.0; cg = 1.0; cb = 1.0;
      } else {
        // Coral / pink sakura petal flakes
        cr = 0.98; cg = 0.70; cb = 0.78;
      }

      const initialAngle = Math.random() * Math.PI * 2;
      const radiusOffset = (Math.random() - 0.5) * 0.45;
      const speedMult = 0.85 + Math.random() * 0.35;

      this.particles.push({
        x: 0,
        y: -999, // dormant below ground until tornado begins
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        baseY: 0,
        baseX: 0,
        baseZ: 0,
        wanderPhase: 0,
        pulsePhase: 0,
        pulseSpeed: 1.0,
        swirlPhase: Math.random() * Math.PI * 2,
        isAirborne: false,
        isTornadoVortex: true,
        funnelHeight: 0,
        swirlAngle: initialAngle,
        radiusOffset,
        speedMultiplier: speedMult,
        colorR: cr,
        colorG: cg,
        colorB: cb,
        alpha: 0.0,
        isSettling: false,
      });

      this.particlePositions[idx * 3] = 0;
      this.particlePositions[idx * 3 + 1] = -999;
      this.particlePositions[idx * 3 + 2] = 0;

      this.particleColors[idx * 3] = 0;
      this.particleColors[idx * 3 + 1] = 0;
      this.particleColors[idx * 3 + 2] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));

    // Circular soft glow point texture procedurally
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 64;
    pCanvas.height = 64;
    const pCtx = pCanvas.getContext('2d')!;
    const radGrad = pCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
    radGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    radGrad.addColorStop(0.20, 'rgba(255, 255, 255, 0.95)');
    radGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.50)');
    radGrad.addColorStop(0.85, 'rgba(255, 255, 255, 0.15)');
    radGrad.addColorStop(1.0, 'transparent');
    pCtx.fillStyle = radGrad;
    pCtx.fillRect(0, 0, 64, 64);

    const pointTexture = new THREE.CanvasTexture(pCanvas);

    const mat = new THREE.PointsMaterial({
      size: 0.15, // Feiner und kleiner (zartes Glühwürmchen- und Wirbelsturm-Leuchten)
      map: pointTexture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.95,
    });

    this.particlePoints = new THREE.Points(geo, mat);
    this.particlePoints.frustumCulled = false;
    this.scene.add(this.particlePoints);
  }

  /**
   * Main render and animation loop running at 60-120 FPS.
   */
  private animate = (): void => {
    if (this.isDestroyed) return;
    this.animFrameId = requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.08);
    const elapsed = this.clock.getElapsedTime();

    // 1. Update Sky Backdrop Breathing Animation
    if (this.skyMaterial) {
      this.skyMaterial.uniforms['uTime'].value = elapsed;
    }

    // Smooth atmosphere & time-of-day transition
    if (this.isThemeTransitioning) {
      this.updateAtmosphereTransition(delta);
    }

    // 2. Smooth Pointer and Tornado Interpolation
    const lerpPos = 1.0 - Math.exp(-22.0 * delta);
    this.smoothMouseGround.lerp(this.targetMouseGround, lerpPos);

    // Update 16 concurrent Directional Bow Waves rolling across the hills
    for (let i = 0; i < this.maxDirWaves; i++) {
      const w = this.dirWaves[i];
      if (w.strength > 0.005) {
        w.time += delta;
        // Turn off only when wave and its trailing recovery tail have crossed beyond horizon
        if (w.time * w.speed > w.maxDist + 22.0) {
          w.strength = 0.0;
        }
      }
      this.dirWaveUniformsA[i].set(w.originX, w.originZ, w.dirX, w.dirZ);
      this.dirWaveUniformsB[i].set(w.time, w.strength, w.speed, w.maxDist);
    }

    // Update concurrent monumental Windstoß waves rolling across the entire field
    let maxActiveGustStrength = 0.0;
    for (let i = 0; i < this.maxGustWaves; i++) {
      const g = this.gustWaves[i];
      if (g.strength > 0.005) {
        g.time += delta;
        const currentDist = g.time * g.speed;
        if (currentDist > g.maxDist + 5.0) {
          g.strength = 0.0;
        } else {
          maxActiveGustStrength = Math.max(maxActiveGustStrength, g.strength);
        }
      }
      this.gustWaveUniformsA[i].set(g.time, g.strength, g.speed, g.width);
      this.gustWaveUniformsB[i].set(g.dirX, g.dirZ, g.originX, g.originZ);
    }

    // Smoothly restore wind display & audio intensity as the wave rolls into the distance
    if (maxActiveGustStrength > 0.01 && this.tornadoStrength < 0.2) {
      const primaryGust = this.gustWaves.find((w) => w.strength > 0.01);
      if (primaryGust) {
        const prog = Math.min(1.0, (primaryGust.time * primaryGust.speed) / primaryGust.maxDist);
        if (prog > 0.6) {
          const fade = (1.0 - prog) / 0.4;
          const baselineAudio = this.getBaselineAudioIntensity();
          this.audio.updateWindIntensity(baselineAudio + fade * 3.2);
          if (prog > 0.88) {
            this.windSpeedDisplay.set(this.getBaselineWindDisplay());
          }
        }
      }
    }

    // Long press Windhose (Mini-Tornado vortex)
    if (this.isPointerDown) {
      this.pointerHoldTimer += delta;
      if (this.pointerHoldTimer > 0.18) {
        this.tornadoStrength = Math.min(1.0, this.tornadoStrength + delta * 2.4);
        this.windSpeedDisplay.set('Wirbelnder Tornado (85 km/h)');
        this.audio.updateWindIntensity(1.6 + this.tornadoStrength * 3.4);
      }
    } else {
      this.pointerHoldTimer = 0.0;
      this.tornadoStrength = Math.max(0.0, this.tornadoStrength - delta * 2.2);
    }

    // Update Grass Shader Uniforms
    if (this.grassMaterial) {
      this.grassMaterial.uniforms['uTime'].value = elapsed;
      this.grassMaterial.uniforms['uMousePos'].value.copy(this.smoothMouseGround);

      this.grassMaterial.uniforms['uTornadoPos'].value.set(
        this.smoothMouseGround.x,
        this.smoothMouseGround.z
      );
      this.grassMaterial.uniforms['uTornadoStrength'].value = this.tornadoStrength;

      // Update 5 concurrent shockwaves without interrupting each other
      for (let i = 0; i < 5; i++) {
        const sw = this.shockwaves[i];
        if (sw.strength > 0.001) {
          sw.time += delta;
          sw.strength = Math.max(0, sw.strength - delta * 0.75);
        }
        this.shockwaveUniforms[i].set(sw.x, sw.z, sw.time, sw.strength);
      }
    }

    // 4. Minimalist Particle Dynamics (Stirred by wind & Windhose)
    this.updateWindParticles(delta, elapsed);

    // 5. Gentle Camera Ambient Sway
    const camSwayX = Math.sin(elapsed * 0.45) * 0.18;
    const camSwayY = Math.cos(elapsed * 0.6) * 0.10;
    this.camera.position.x = this.baseCamPos.x + camSwayX;
    this.camera.position.y = this.baseCamPos.y + camSwayY;
    this.camera.lookAt(this.targetCamLookAt);

    // 6. Render
    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Updates particle positions:
   * - 180 ambient prairie particles float gently and stir with wind waves
   * - 140 delicate tornado particles that lift smoothly and slowly from the ground,
   *   accelerating quadratically as they rise into the sky, and gently sinking down
   *   to the ground like dandelion seeds before vanishing when pointer is released.
   */
  private updateWindParticles(delta: number, elapsed: number): void {
    if (!this.particlePoints) return;

    const tornadoActive = this.isPointerDown && this.pointerHoldTimer > 0.18;
    const targetX = this.smoothMouseGround.x;
    const targetZ = this.smoothMouseGround.z;
    const centerGroundY = this.getTerrainHeight(targetX, targetZ);

    // 1. Update Ambient Firefly Particles (0 .. ambientParticleCount - 1)
    // ONLY visible at night!
    const fireflyVisibility = this.currentNightWeight;

    for (let i = 0; i < this.ambientParticleCount; i++) {
      const p = this.particles[i];

      const dx = p.x - targetX;
      const dz = p.z - targetZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Suction into the tornado if near the center
      if (tornadoActive && dist < 8.0) {
        const tForce = (1.0 - dist / 8.0) * this.tornadoStrength;
        const spinX = -dz / (dist + 0.12);
        const spinZ = dx / (dist + 0.12);
        const pullX = -dx / (dist + 0.12);
        const pullZ = -dz / (dist + 0.12);
        p.vx += (spinX * 14.0 + pullX * 4.5) * tForce * delta;
        p.vz += (spinZ * 14.0 + pullZ * 4.5) * tForce * delta;
        p.vy += (7.5 + Math.random() * 5.0) * tForce * delta;
        p.isAirborne = true;
      }

      // Physics integration for ambient particles
      if (p.isAirborne) {
        p.vx += 0.85 * delta;
        p.vz += 0.52 * delta;

        p.swirlPhase += delta * 2.5;
        p.x += (p.vx + Math.sin(p.swirlPhase) * 0.35) * delta;
        p.y += p.vy * delta;
        p.z += (p.vz + Math.cos(p.swirlPhase) * 0.35) * delta;

        p.vx *= 0.94;
        p.vz *= 0.94;
        p.vy -= 1.7 * delta;

        const groundY = this.getTerrainHeight(p.x, p.z) + 0.35;
        if (p.y <= groundY) {
          p.y = groundY;
          p.vy = 0;
          p.isAirborne = false;
          p.baseX = p.x;
          p.baseY = groundY;
          p.baseZ = p.z;
        }
      } else {
        // Organic 3D wandering & gentle hover like living fireflies among the grass
        const hoverY =
          p.baseY +
          Math.sin(elapsed * 1.3 + p.wanderPhase) * 0.22 +
          Math.cos(elapsed * 0.85 + i) * 0.12;
        const wanderX =
          p.baseX + Math.sin(elapsed * 0.75 + p.wanderPhase) * 0.40;
        const wanderZ =
          p.baseZ + Math.cos(elapsed * 0.85 + p.wanderPhase) * 0.40;

        p.x = wanderX;
        p.y = hoverY;
        p.z = wanderZ;

        // Wave crest lift: as directional waves roll past, lift fireflies
        for (let wIdx = 0; wIdx < this.maxDirWaves; wIdx++) {
          const w = this.dirWaves[wIdx];
          if (w.strength > 0.08) {
            const waveRadius = w.time * w.speed;
            if (waveRadius > 0.8 && waveRadius < w.maxDist) {
              const toPartX = p.x - w.originX;
              const toPartZ = p.z - w.originZ;
              const partDist = Math.sqrt(toPartX * toPartX + toPartZ * toPartZ);
              if (partDist > 0.2) {
                const forwardProj = (toPartX * w.dirX + toPartZ * w.dirZ) / partDist;
                if (forwardProj > -0.35) {
                  const distDiff = partDist - waveRadius;
                  // Stir particles both ahead of the crest and in the relaxing wake
                  if (distDiff > -6.0 && distDiff < 2.8) {
                    const waveFactor =
                      distDiff >= 0
                        ? (1.0 - distDiff / 2.8) * w.strength * Math.max(forwardProj + 0.35, 0.2)
                        : Math.pow(1.0 + distDiff / 6.0, 1.8) * w.strength * Math.max(forwardProj + 0.35, 0.2);
                    const pushX = (w.dirX + toPartX / partDist) * 0.5;
                    const pushZ = (w.dirZ + toPartZ / partDist) * 0.5;
                    p.vy += (1.4 + Math.random() * 2.0) * waveFactor;
                    p.vx += pushX * 3.5 * waveFactor;
                    p.vz += pushZ * 3.5 * waveFactor;
                    p.isAirborne = true;
                    break;
                  }
                }
              }
            }
          }
        }

        // Monumental Windstoß Wave lift: as the grand panoramic wave sweeps across, lift particles
        for (let gIdx = 0; gIdx < this.maxGustWaves; gIdx++) {
          const g = this.gustWaves[gIdx];
          if (g.strength > 0.05) {
            const waveFrontDist = g.time * g.speed;
            if (waveFrontDist > 0.5 && waveFrontDist < g.maxDist) {
              const toPartX = p.x - g.originX;
              const toPartZ = p.z - g.originZ;
              const travelDist = toPartX * g.dirX + toPartZ * g.dirZ;
              const deltaR = Math.abs(travelDist - waveFrontDist);
              if (deltaR < g.width * 0.6) {
                const waveFactor = (1.0 - deltaR / (g.width * 0.6)) * g.strength;
                p.vy += (2.2 + Math.random() * 2.5) * waveFactor;
                p.vx += (g.dirX * 3.8 + (Math.random() - 0.5) * 1.5) * waveFactor;
                p.vz += (g.dirZ * 3.8 + (Math.random() - 0.5) * 1.5) * waveFactor;
                p.isAirborne = true;
                break;
              }
            }
          }
        }
      }

      // Recycle ambient particles drifting off-limits
      if (p.x > 35 || p.x < -35 || p.z > 18 || p.z < -42) {
        p.x = (Math.random() - 0.5) * 50.0;
        p.z = 14.0 - Math.random() * 40.0;
        p.baseX = p.x;
        p.baseZ = p.z;
        p.baseY = this.getTerrainHeight(p.x, p.z) + 0.35 + Math.random() * 0.6;
        p.y = p.baseY;
        p.vx = 0;
        p.vy = 0;
        p.vz = 0;
        p.isAirborne = false;
      }

      this.particlePositions[i * 3] = p.x;
      this.particlePositions[i * 3 + 1] = p.y;
      this.particlePositions[i * 3 + 2] = p.z;

      // Firefly Bioluminescent Pulse: ONLY visible at night!
      if (fireflyVisibility > 0.001) {
        const pulse = Math.pow(
          Math.sin(elapsed * p.pulseSpeed + p.pulsePhase) * 0.5 + 0.5,
          2.4
        );
        const glow = (0.08 + pulse * 0.92) * fireflyVisibility;
        p.alpha = glow;

        // Finer & smaller: subtle delicate ember glow (fein und klein wie echte Glühwürmchen)
        this.particleColors[i * 3] = p.colorR * p.alpha * 0.65;
        this.particleColors[i * 3 + 1] = p.colorG * p.alpha * 0.65;
        this.particleColors[i * 3 + 2] = p.colorB * p.alpha * 0.65;
      } else {
        // Tag & Goldene Stunde: Vollständig unsichtbar
        p.alpha = 0.0;
        this.particleColors[i * 3] = 0.0;
        this.particleColors[i * 3 + 1] = 0.0;
        this.particleColors[i * 3 + 2] = 0.0;
      }
    }

    // 2. Staggered Liftoff from Ground for Tornado Particles
    if (tornadoActive) {
      this.tornadoSpawnTimer += delta;
      const spawnInterval = 0.024; // ~42 particles launched per second
      while (this.tornadoSpawnTimer >= spawnInterval) {
        this.tornadoSpawnTimer -= spawnInterval;

        // Find dormant particle to launch from ground
        let candidate: WindParticle | undefined;
        for (let i = this.ambientParticleCount; i < this.particleCount; i++) {
          const pt = this.particles[i];
          if (!pt.isAirborne && !pt.isSettling) {
            candidate = pt;
            break;
          }
        }
        // If all are airborne/settling, recycle a low-alpha settling particle
        if (!candidate) {
          for (let i = this.ambientParticleCount; i < this.particleCount; i++) {
            const pt = this.particles[i];
            if (pt.isSettling && pt.alpha < 0.25) {
              candidate = pt;
              break;
            }
          }
        }

        if (candidate) {
          candidate.isAirborne = true;
          candidate.isSettling = false;
          candidate.funnelHeight = 0.02 + Math.random() * 0.16; // Starts slowly at the ground
          candidate.swirlAngle = Math.random() * Math.PI * 2;
          candidate.radiusOffset = (Math.random() - 0.5) * 0.45;
          candidate.speedMultiplier = 0.85 + Math.random() * 0.35;
          candidate.alpha = 0.0;
        }
      }
    }

    // 3. Update Dedicated Tornado Funnel Particles
    for (let i = this.ambientParticleCount; i < this.particleCount; i++) {
      const p = this.particles[i];

      if (tornadoActive && p.isAirborne && !p.isSettling) {
        // Accelerating ascent:
        // Slow liftoff from the ground (normH ≈ 0), accelerating up into the sky
        const normH = Math.min(1.0, Math.max(0.0, p.funnelHeight / 17.5));

        // Upward speed: starts at ~1.2 m/s at the ground and accelerates up to ~15 m/s in the sky
        const climbSpeed =
          (1.2 + Math.pow(normH, 1.8) * 13.8) *
          this.tornadoStrength *
          p.speedMultiplier;
        p.funnelHeight += climbSpeed * delta;

        // Rotational spin: starts at ~5.5 rad/s at the ground and accelerates up to ~25 rad/s
        const spinSpeed =
          (5.5 + Math.pow(normH, 1.4) * 19.5) *
          this.tornadoStrength *
          p.speedMultiplier;
        p.swirlAngle += spinSpeed * delta;

        // Inverted conical funnel radius (narrow tight base expanding into sky)
        const funnelRadius =
          0.45 + Math.pow(normH, 1.25) * 3.4 + p.radiusOffset;

        // Helical axis sway
        const axisSway = normH * 0.75;
        const axisX =
          targetX +
          Math.sin(elapsed * 3.2 + p.funnelHeight * 0.35) * axisSway;
        const axisZ =
          targetZ +
          Math.cos(elapsed * 2.7 + p.funnelHeight * 0.35) * axisSway;

        // Calculate 3D position
        p.x = axisX + Math.cos(p.swirlAngle) * funnelRadius;
        p.z = axisZ + Math.sin(p.swirlAngle) * funnelRadius;
        p.y = centerGroundY + p.funnelHeight;

        // Soft fading in at ground lift and out near sky limit
        const fadeIn = Math.min(1.0, p.funnelHeight / 0.85);
        const fadeOut = Math.max(0.0, (17.5 - p.funnelHeight) / 2.5);
        p.alpha = Math.min(fadeIn, fadeOut) * this.tornadoStrength;

        // Continuous stream loop: recycle at the top back to the ground
        if (p.funnelHeight >= 17.5) {
          p.funnelHeight = 0.02 + Math.random() * 0.16;
          p.swirlAngle = Math.random() * Math.PI * 2;
          p.radiusOffset = (Math.random() - 0.5) * 0.45;
          p.alpha = 0.0;
        }

        this.particlePositions[i * 3] = p.x;
        this.particlePositions[i * 3 + 1] = p.y;
        this.particlePositions[i * 3 + 2] = p.z;

        this.particleColors[i * 3] = p.colorR * p.alpha;
        this.particleColors[i * 3 + 1] = p.colorG * p.alpha;
        this.particleColors[i * 3 + 2] = p.colorB * p.alpha;
      } else if (p.isSettling) {
        // Pointer released: particles sink gently to the ground like dandelion seeds and disappear
        p.vy = Math.max(-0.95, p.vy - 1.1 * delta);
        p.vx *= 0.96;
        p.vz *= 0.96;

        p.swirlPhase += delta * 2.2;
        const flutter = Math.sin(p.swirlPhase + p.y * 2.2) * 0.22 * delta;
        p.x += (p.vx + flutter) * delta;
        p.y += p.vy * delta;
        p.z += (p.vz + flutter) * delta;

        // Graceful alpha fadeout while sinking
        p.alpha = Math.max(0.0, p.alpha - 0.38 * delta);

        const groundY = this.getTerrainHeight(p.x, p.z) + 0.12;
        if (p.y <= groundY) {
          p.y = groundY;
          p.vy = 0;
          p.vx *= 0.75;
          p.vz *= 0.75;
          // Quicker fade once touching the ground
          p.alpha = Math.max(0.0, p.alpha - 1.6 * delta);
        }

        if (p.alpha <= 0.01) {
          p.y = -999;
          p.isAirborne = false;
          p.isSettling = false;
          p.alpha = 0.0;
        }

        this.particlePositions[i * 3] = p.x;
        this.particlePositions[i * 3 + 1] = p.y;
        this.particlePositions[i * 3 + 2] = p.z;

        this.particleColors[i * 3] = p.colorR * p.alpha;
        this.particleColors[i * 3 + 1] = p.colorG * p.alpha;
        this.particleColors[i * 3 + 2] = p.colorB * p.alpha;
      } else {
        // Dormant or newly deactivated: start settling if in the air
        if (p.isAirborne && !tornadoActive) {
          p.isSettling = true;
          const swirlTangX = -Math.sin(p.swirlAngle) * 0.9;
          const swirlTangZ = Math.cos(p.swirlAngle) * 0.9;
          p.vx = swirlTangX + (Math.random() - 0.5) * 0.3;
          p.vz = swirlTangZ + (Math.random() - 0.5) * 0.3;
          p.vy = -0.25 - Math.random() * 0.35;
        } else {
          this.particlePositions[i * 3 + 1] = -999;
          this.particleColors[i * 3] = 0;
          this.particleColors[i * 3 + 1] = 0;
          this.particleColors[i * 3 + 2] = 0;
        }
      }
    }

    this.particlePoints.geometry.attributes['position'].needsUpdate = true;
    this.particlePoints.geometry.attributes['color'].needsUpdate = true;
  }

  // -------------------------------------------------------------
  // Pointer & Wind Interaction Handlers
  // -------------------------------------------------------------

  onPointerDown(event: PointerEvent): void {
    try {
      (event.target as HTMLElement)?.setPointerCapture?.(event.pointerId);
    } catch {}
    this.isPointerDown = true;
    this.pointerHoldTimer = 0.0;
    this.tornadoSpawnTimer = 0.0;
    this.updatePointerCoords(event);
    this.smoothMouseGround.copy(this.targetMouseGround);
    this.prevMouseGround.copy(this.targetMouseGround);
    this.lastStrokePos.copy(this.targetMouseGround);
    this.lastSpawnTime = 0;
    this.triggerClickWave();
  }

  onPointerMove(event: PointerEvent): void {
    this.updatePointerCoords(event);

    const dx = this.targetMouseGround.x - this.prevMouseGround.x;
    const dz = this.targetMouseGround.z - this.prevMouseGround.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.02) {
      const dirX = dx / dist;
      const dirZ = dz / dist;
      const now = performance.now();

      const distFromLastSpawn = this.targetMouseGround.distanceTo(this.lastStrokePos);
      const dotDir = dirX * this.lastSpawnDir.x + dirZ * this.lastSpawnDir.y;
      const timeSinceSpawn = now - this.lastSpawnTime;

      // Responsive spawn triggers:
      // 1. Initial movement or restart after pause (> 160ms)
      // 2. Turning / circling smoothly along curve (turned by > ~18 deg: dotDir < 0.95 && distFromLastSpawn >= 0.28)
      // 3. Continuous straight advance along current stroke (distFromLastSpawn >= 0.75)
      const isNewStroke = timeSinceSpawn > 160;
      const isTurned = dotDir < 0.95 && distFromLastSpawn >= 0.28;
      const isContinuousAdvance = distFromLastSpawn >= 0.75;

      if (isNewStroke || isTurned || isContinuousAdvance) {
        const speed = dist / Math.max((now - this.lastSpawnTime) / 1000, 0.016);
        const intensity = Math.min(Math.max(speed * 0.1, 0.25), 0.85);

        this.spawnDirectionalWave(
          this.targetMouseGround.x,
          this.targetMouseGround.z,
          dirX,
          dirZ,
          intensity
        );
        this.lastStrokePos.copy(this.targetMouseGround);
        this.lastSpawnDir.set(dirX, dirZ);
        this.lastSpawnTime = now;
      }
    }

    this.prevMouseGround.copy(this.targetMouseGround);
  }

  /**
   * Spawns an independent directional wave expanding forward, left and right.
   * Runs in a 24-wave ring buffer so previous waves keep rolling across the field
   * completely uninterrupted even if the player abruptly changes direction or circles.
   */
  private spawnDirectionalWave(
    originX: number,
    originZ: number,
    dirX: number,
    dirZ: number,
    intensity: number
  ): void {
    const wave = this.dirWaves[this.nextDirWaveIndex];
    wave.originX = originX;
    wave.originZ = originZ;
    wave.dirX = dirX;
    wave.dirZ = dirZ;
    wave.time = 0.0;
    wave.strength = Math.min(Math.max(intensity * 0.55, 0.2), 0.8);
    wave.speed = 18.0 + Math.min(intensity * 3.0, 4.0); // Schnelle, direkte Ausbreitung wie vor 40 Min!
    wave.maxDist = 95.0;

    this.nextDirWaveIndex = (this.nextDirWaveIndex + 1) % this.maxDirWaves;

    // Stir particles ahead in the forward fan
    this.stirParticlesInForwardFan(originX, originZ, dirX, dirZ, wave.strength);

    // Audio feedback
    const normX = originX / 18.0;
    this.audio.triggerGrassChime(normX, Math.min(wave.strength * 0.7, 0.85));
    this.audio.updateWindIntensity(wave.strength * 2.0);

    if (this.tornadoStrength < 0.2) {
      const kmh = Math.round(18 + wave.strength * 36);
      this.windSpeedDisplay.set(`Windwelle (${kmh} km/h)`);
    }
  }

  /**
   * Stirs pollen / dandelion seeds in the forward and lateral fan of a wave.
   */
  private stirParticlesInForwardFan(
    originX: number,
    originZ: number,
    dirX: number,
    dirZ: number,
    strength: number
  ): void {
    if (!this.particlePoints) return;

    for (let i = 0; i < this.ambientParticleCount; i++) {
      const p = this.particles[i];
      const dx = p.x - originX;
      const dz = p.z - originZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.1 && dist < 5.8) {
        const forwardProj = (dx * dirX + dz * dirZ) / dist;
        if (forwardProj > -0.3) {
          const fanForce = (1.0 - dist / 5.8) * strength * Math.max(forwardProj + 0.3, 0.2);
          p.vy += (1.6 + Math.random() * 2.4) * fanForce;
          const pushX = (dirX + dx / dist) * 0.5;
          const pushZ = (dirZ + dz / dist) * 0.5;
          p.vx += pushX * 4.5 * fanForce;
          p.vz += pushZ * 4.5 * fanForce;
          p.isAirborne = true;
        }
      }
    }
  }

  onPointerUp(event?: PointerEvent): void {
    if (event) {
      try {
        (event.target as HTMLElement)?.releasePointerCapture?.(event.pointerId);
      } catch {}
    }
    this.isPointerDown = false;
    this.pointerHoldTimer = 0.0;
    this.startTornadoParticlesSettling();
    if (this.tornadoStrength > 0.2) {
      this.windSpeedDisplay.set('Sanfte Brise (14 km/h)');
      this.audio.updateWindIntensity(0.2);
    }
  }

  onPointerLeave(event?: PointerEvent): void {
    // If the user is still actively holding down the mouse button, maintain tornado!
    if (event && (event.buttons & 1) === 1) {
      return;
    }
    this.isPointerDown = false;
    this.pointerHoldTimer = 0.0;
    this.tornadoStrength = 0.0;
    this.startTornadoParticlesSettling();
    this.windSpeedDisplay.set('Sanfte Brise (14 km/h)');
    this.audio.updateWindIntensity(0.1);
  }

  /**
   * When mouse button is released, transitions all airborne tornado particles
   * into settling mode so they sink gently to the ground like dandelion seeds.
   */
  private startTornadoParticlesSettling(): void {
    for (let i = this.ambientParticleCount; i < this.particleCount; i++) {
      const p = this.particles[i];
      if (p.isAirborne && p.y > -900 && !p.isSettling) {
        p.isSettling = true;
        // Tangential momentum gives soft outward drift
        const swirlTangX = -Math.sin(p.swirlAngle) * 0.9;
        const swirlTangZ = Math.cos(p.swirlAngle) * 0.9;
        p.vx = swirlTangX + (Math.random() - 0.5) * 0.3;
        p.vz = swirlTangZ + (Math.random() - 0.5) * 0.3;
        p.vy = -0.25 - Math.random() * 0.35;
      }
    }
  }

  /**
   * Projects 2D screen coordinates onto the 3D terrain surface.
   */
  private updatePointerCoords(event: PointerEvent): void {
    const rect = this.containerRef.nativeElement.getBoundingClientRect();
    this.pointer2D.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer2D.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer2D, this.camera);

    if (this.terrainMesh) {
      const intersects = this.raycaster.intersectObject(this.terrainMesh);
      if (intersects.length > 0) {
        this.targetMouseGround.copy(intersects[0].point);
        return;
      }
    }

    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundRayPlane, hit)) {
      this.targetMouseGround.copy(hit);
    }
  }

  /**
   * Triggers an expanding circular shockwave ripple pushing the grass outwards.
   * Runs in a 5-wave ring buffer so rapid successive clicks all expand naturally.
   */
  triggerClickWave(): void {
    const sw = this.shockwaves[this.nextShockwaveIndex];
    sw.x = this.targetMouseGround.x;
    sw.z = this.targetMouseGround.z;
    sw.time = 0.0;
    sw.strength = 1.0;
    this.nextShockwaveIndex = (this.nextShockwaveIndex + 1) % 5;

    // Stir surrounding ambient particles with an outward puff
    for (let i = 0; i < this.ambientParticleCount; i++) {
      const p = this.particles[i];
      const dx = p.x - sw.x;
      const dz = p.z - sw.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 6.5) {
        p.vy += (2.2 + Math.random() * 2.8) * (1.0 - dist / 6.5);
        p.vx += (dx / (dist + 0.01)) * 3.5;
        p.vz += (dz / (dist + 0.01)) * 3.5;
        p.isAirborne = true;
      }
    }

    this.audio.triggerPulseChord();
  }

  /**
   * Triggers a monumental sweeping wind gust wave across the entire grass field.
   * Smoothly rolls from foreground over the rolling hills all the way to the horizon.
   */
  triggerWindGust(): void {
    if (!this.grassMaterial) return;

    const wave = this.gustWaves[this.nextGustWaveIndex];
    wave.time = 0.0;
    wave.strength = 1.35;
    wave.speed = 28.0;
    wave.width = 22.0;

    // Organic direction variation matching the natural ambient prairie breeze
    const angleOffset = (Math.random() - 0.5) * 0.2;
    const baseDir = new THREE.Vector2(0.12, -0.99)
      .rotateAround(new THREE.Vector2(0, 0), angleOffset)
      .normalize();
    wave.dirX = baseDir.x;
    wave.dirZ = baseDir.y;
    wave.originX = (Math.random() - 0.5) * 10.0;
    wave.originZ = 24.0;
    wave.maxDist = 125.0;

    this.nextGustWaveIndex = (this.nextGustWaveIndex + 1) % this.maxGustWaves;

    this.windSpeedDisplay.set('Mächtige Sommer-Böe (54 km/h)');
    this.audio.triggerPulseChord();
    this.audio.triggerGrassChime(0, 0.95);
    this.audio.updateWindIntensity(3.8);

    // Lift immediate foreground particles right at wave launch
    for (let i = 0; i < this.ambientParticleCount; i++) {
      const p = this.particles[i];
      if (p.z > 8.0 && Math.random() < 0.6) {
        p.vy += 2.0 + Math.random() * 2.2;
        p.vx += (wave.dirX * 3.2 + (Math.random() - 0.5)) * 1.5;
        p.vz += (wave.dirZ * 3.2 + (Math.random() - 0.5)) * 1.5;
        p.isAirborne = true;
      }
    }
  }

  // -------------------------------------------------------------
  // Preset & Configuration Setters
  // -------------------------------------------------------------

  setTimeOfDay(time: TimeOfDay): void {
    this.timeOfDay.set(time);
    this.syncCursorAtmosphere(time);
    this.targetTheme = THEMES[time];
    this.targetGoldenWeight = time === 'golden' ? 1.0 : 0.0;
    this.targetNightWeight = time === 'night' ? 1.0 : 0.0;
    this.targetFogDensity = time === 'night' ? 0.016 : 0.008;
    this.isThemeTransitioning = true;

    this.audio.triggerGrassChime(0, 0.15);
  }

  /**
   * Syncs the custom glass orb-cursor color state with the prairie time of day:
   * - 'golden': activates 'in-sanctuary' (warm glowing amber/gold like in cozy-sanctuary-section)
   * - 'night': activates 'in-night' (luminous deep sapphire midnight blue)
   * - 'day': standard luminous cyan/sky blue
   */
  private syncCursorAtmosphere(time: TimeOfDay): void {
    if (typeof document === 'undefined') return;
    if (time === 'golden') {
      document.body.classList.remove('in-night');
      document.body.classList.add('in-sanctuary');
    } else if (time === 'night') {
      document.body.classList.remove('in-sanctuary');
      document.body.classList.add('in-night');
    } else {
      document.body.classList.remove('in-sanctuary');
      document.body.classList.remove('in-night');
    }
  }

  /**
   * Smoothly interpolates lighting, grass color hues, sky tint, and fog
   * when transitioning between Mittag (Day), Goldene Stunde (Sunset), and Zen-Nacht (Night).
   */
  private updateAtmosphereTransition(delta: number): void {
    const lerpSpeed = Math.min(1.0, 5.0 * delta); // Smooth transition completed in ~0.6-0.8s

    // 1. Interpolate weights & fog density
    this.currentGoldenWeight += (this.targetGoldenWeight - this.currentGoldenWeight) * lerpSpeed;
    this.currentNightWeight += (this.targetNightWeight - this.currentNightWeight) * lerpSpeed;
    this.currentFogDensity += (this.targetFogDensity - this.currentFogDensity) * lerpSpeed;

    // 2. Sky Material Uniforms
    if (this.skyMaterial) {
      this.skyMaterial.uniforms['uGoldenWeight'].value = this.currentGoldenWeight;
      this.skyMaterial.uniforms['uNightWeight'].value = this.currentNightWeight;
      this.skyMaterial.uniforms['uSkyColor'].value.lerp(this.targetTheme.skyColor, lerpSpeed);
      this.skyMaterial.uniforms['uTimeOfDay'].value =
        this.timeOfDay() === 'day' ? 0.0 : this.timeOfDay() === 'golden' ? 1.0 : 2.0;
    }

    // 3. Grass Material Uniforms
    if (this.grassMaterial) {
      this.grassMaterial.uniforms['uBaseColor'].value.lerp(this.targetTheme.grassBase, lerpSpeed);
      this.grassMaterial.uniforms['uMidColor'].value.lerp(this.targetTheme.grassMid, lerpSpeed);
      this.grassMaterial.uniforms['uTipColor'].value.lerp(this.targetTheme.grassTip, lerpSpeed);
      this.grassMaterial.uniforms['uSunColor'].value.lerp(this.targetTheme.sunColor, lerpSpeed);
      this.grassMaterial.uniforms['uSkyColor'].value.lerp(this.targetTheme.skyColor, lerpSpeed);
      this.grassMaterial.uniforms['uSunDirection'].value.lerp(this.targetTheme.sunDirection, lerpSpeed);
      this.grassMaterial.uniforms['uTimeOfDay'].value =
        this.timeOfDay() === 'day' ? 0.0 : this.timeOfDay() === 'golden' ? 1.0 : 2.0;
    }

    // 4. Ground Mesh Color
    if (this.terrainMesh) {
      (this.terrainMesh.material as THREE.MeshBasicMaterial).color.lerp(
        this.targetTheme.groundColor,
        lerpSpeed
      );
    }

    // 5. Scene Fog & Background
    if (this.scene) {
      if (this.scene.background instanceof THREE.Color) {
        this.scene.background.lerp(this.targetTheme.skyColor, lerpSpeed);
      } else {
        this.scene.background = this.targetTheme.skyColor.clone();
      }
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.lerp(this.targetTheme.skyColor, lerpSpeed);
        this.scene.fog.density = this.currentFogDensity;
      }
    }
    if (this.renderer) {
      const bg = (this.scene?.background as THREE.Color) || this.targetTheme.skyColor;
      this.renderer.setClearColor(bg, 1);
    }

    // Check completion threshold
    const diffGolden = Math.abs(this.targetGoldenWeight - this.currentGoldenWeight);
    const diffNight = Math.abs(this.targetNightWeight - this.currentNightWeight);
    if (diffGolden < 0.005 && diffNight < 0.005) {
      // Snap to exact target values to cleanly finish transition
      this.currentGoldenWeight = this.targetGoldenWeight;
      this.currentNightWeight = this.targetNightWeight;
      this.currentFogDensity = this.targetFogDensity;

      if (this.skyMaterial) {
        this.skyMaterial.uniforms['uGoldenWeight'].value = this.currentGoldenWeight;
        this.skyMaterial.uniforms['uNightWeight'].value = this.currentNightWeight;
        this.skyMaterial.uniforms['uSkyColor'].value.copy(this.targetTheme.skyColor);
      }
      if (this.grassMaterial) {
        this.grassMaterial.uniforms['uBaseColor'].value.copy(this.targetTheme.grassBase);
        this.grassMaterial.uniforms['uMidColor'].value.copy(this.targetTheme.grassMid);
        this.grassMaterial.uniforms['uTipColor'].value.copy(this.targetTheme.grassTip);
        this.grassMaterial.uniforms['uSunColor'].value.copy(this.targetTheme.sunColor);
        this.grassMaterial.uniforms['uSkyColor'].value.copy(this.targetTheme.skyColor);
        this.grassMaterial.uniforms['uSunDirection'].value.copy(this.targetTheme.sunDirection);
      }
      if (this.terrainMesh) {
        (this.terrainMesh.material as THREE.MeshBasicMaterial).color.copy(
          this.targetTheme.groundColor
        );
      }
      if (this.scene) {
        if (this.scene.background instanceof THREE.Color) {
          this.scene.background.copy(this.targetTheme.skyColor);
        }
        if (this.scene.fog instanceof THREE.FogExp2) {
          this.scene.fog.color.copy(this.targetTheme.skyColor);
          this.scene.fog.density = this.targetFogDensity;
        }
      }
      if (this.renderer) {
        this.renderer.setClearColor(this.targetTheme.skyColor, 1);
      }
      this.isThemeTransitioning = false;
    }
  }

  setWindPreset(preset: 'gentle' | 'fresh' | 'gust'): void {
    this.windPreset.set(preset);
    if (!this.grassMaterial) return;

    let strength = 1.25;
    if (preset === 'gentle') strength = 0.75;
    if (preset === 'gust') strength = 2.1;

    this.grassMaterial.uniforms['uWindStrength'].value = strength;
    this.windSpeedDisplay.set(this.getBaselineWindDisplay());
    this.audio.updateWindIntensity(this.getBaselineAudioIntensity());
  }

  private getBaselineWindDisplay(): string {
    const p = this.windPreset();
    if (p === 'gentle') return 'Sanfte Brise (9 km/h)';
    if (p === 'gust') return 'Frischer Wind (28 km/h)';
    return 'Frische Brise (16 km/h)';
  }

  private getBaselineAudioIntensity(): number {
    const p = this.windPreset();
    if (p === 'gentle') return 0.1;
    if (p === 'gust') return 0.45;
    return 0.2;
  }

  toggleSound(): void {
    this.audio.toggleMute();
  }

  private onResize = (): void => {
    if (!this.containerRef || !this.renderer || !this.camera) return;
    const container = this.containerRef.nativeElement;
    const w = container.clientWidth;
    const h = container.clientHeight || 1;
    const aspect = w / h;

    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);

    if (this.skyMaterial) {
      this.skyMaterial.uniforms['uAspect'].value = aspect;
    }
  };

  private disposeThree(): void {
    if (this.grassMesh) {
      this.grassMesh.geometry.dispose();
      (this.grassMesh.material as THREE.Material).dispose();
    }
    if (this.terrainMesh) {
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
    }
    if (this.skyMesh) {
      this.skyMesh.geometry.dispose();
      (this.skyMesh.material as THREE.Material).dispose();
    }
    if (this.particlePoints) {
      this.particlePoints.geometry.dispose();
      (this.particlePoints.material as THREE.Material).dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
