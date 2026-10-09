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
  private readonly maxDirWaves = 16;
  private dirWaves = Array.from({ length: 16 }, () => ({
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
    { length: 16 },
    () => new THREE.Vector4(0, 0, 0, 1)
  );
  private dirWaveUniformsB = Array.from(
    { length: 16 },
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

  // Wind Particle System: 300 ambient meadow specks + 750 swirling tornado vortex particles
  private readonly ambientParticleCount = 300;
  private readonly tornadoParticleCount = 750;
  private readonly particleCount = 1050;
  private particles: WindParticle[] = [];
  private particlePoints!: THREE.Points;
  private particlePositions!: Float32Array;
  private particleColors!: Float32Array;

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

    window.addEventListener('resize', this.onResize);

    // Run animation outside Angular zone for steady 60-120 FPS
    this.ngZone.runOutsideAngular(() => {
      this.animate();
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
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
        uTimeOfDay: { value: 0.0 },
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
      color: theme.grassMid.clone().multiplyScalar(0.92),
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
      uBaseColor: { value: theme.grassBase },
      uMidColor: { value: theme.grassMid },
      uTipColor: { value: theme.grassTip },
      uSunDirection: { value: theme.sunDirection },
      uSunColor: { value: theme.sunColor },
      uSkyColor: { value: theme.skyColor },
      uTimeOfDay: { value: 0.0 },
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
   * 1. 200 ambient meadow specks (dandelion seeds, sunlight pollen, petals)
   * 2. 750 dedicated tornado vortex particles sucked skyward in a swirling column
   */
  private buildMinimalistParticles(): void {
    this.particles = [];
    this.particlePositions = new Float32Array(this.particleCount * 3);
    this.particleColors = new Float32Array(this.particleCount * 3);

    // 1. Ambient meadow particles (300)
    for (let i = 0; i < this.ambientParticleCount; i++) {
      const z = 18.0 - Math.random() * 52.0;
      const halfSpan = 28.0 + (18.0 - z) * 1.8;
      const x = (Math.random() - 0.5) * (halfSpan * 2.0);
      const groundY = this.getTerrainHeight(x, z);
      const y = groundY + 0.35 + Math.random() * 0.8;

      const colRand = Math.random();
      let cr = 1.0, cg = 1.0, cb = 1.0;
      if (colRand < 0.5) {
        // Golden sunlight pollen
        cr = 1.0; cg = 0.94; cb = 0.45;
      } else if (colRand < 0.8) {
        // Fresh clover lime
        cr = 0.65; cg = 0.95; cb = 0.50;
      } else {
        // Delicate blossom petal
        cr = 0.98; cg = 0.70; cb = 0.78;
      }

      this.particles.push({
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        baseY: y,
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
      });

      this.particlePositions[i * 3] = x;
      this.particlePositions[i * 3 + 1] = y;
      this.particlePositions[i * 3 + 2] = z;

      this.particleColors[i * 3] = cr * 0.85;
      this.particleColors[i * 3 + 1] = cg * 0.85;
      this.particleColors[i * 3 + 2] = cb * 0.85;
    }

    // 2. Dedicated Tornado Whirlwind particles (750)
    for (let i = 0; i < this.tornadoParticleCount; i++) {
      const idx = this.ambientParticleCount + i;
      const colRand = Math.random();
      let cr = 1.0, cg = 1.0, cb = 1.0;
      if (colRand < 0.45) {
        // Luminous sunlit gold dandelion seeds
        cr = 1.0; cg = 0.92; cb = 0.40;
      } else if (colRand < 0.75) {
        // Emerald & chartreuse meadow leaf flakes
        cr = 0.52; cg = 0.96; cb = 0.45;
      } else if (colRand < 0.88) {
        // Ethereal white wind wisps
        cr = 1.0; cg = 1.0; cb = 1.0;
      } else {
        // Coral / pink sakura petal flakes
        cr = 0.98; cg = 0.64; cb = 0.72;
      }

      const initialHeight = Math.random() * 18.0;
      const initialAngle = Math.random() * Math.PI * 2;
      const radiusOffset = (Math.random() - 0.5) * 0.7;
      const speedMult = 0.85 + Math.random() * 0.45;

      this.particles.push({
        x: 0,
        y: -999, // dormant below ground until windhose appears
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        baseY: 0,
        swirlPhase: 0,
        isAirborne: false,
        isTornadoVortex: true,
        funnelHeight: initialHeight,
        swirlAngle: initialAngle,
        radiusOffset,
        speedMultiplier: speedMult,
        colorR: cr,
        colorG: cg,
        colorB: cb,
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
    radGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.95)');
    radGrad.addColorStop(0.60, 'rgba(255, 255, 255, 0.45)');
    radGrad.addColorStop(0.85, 'rgba(255, 255, 255, 0.12)');
    radGrad.addColorStop(1.0, 'transparent');
    pCtx.fillStyle = radGrad;
    pCtx.fillRect(0, 0, 64, 64);

    const pointTexture = new THREE.CanvasTexture(pCanvas);

    const mat = new THREE.PointsMaterial({
      size: 0.46,
      map: pointTexture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.92,
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

    // 2. Smooth Pointer and Tornado Interpolation
    const lerpPos = 1.0 - Math.exp(-22.0 * delta);
    this.smoothMouseGround.lerp(this.targetMouseGround, lerpPos);

    // Update 16 concurrent Directional Bow Waves rolling across the hills
    for (let i = 0; i < this.maxDirWaves; i++) {
      const w = this.dirWaves[i];
      if (w.strength > 0.005) {
        w.time += delta;
        // Turn off only when wave has crossed the entire landscape beyond horizon
        if (w.time * w.speed > w.maxDist + 5.0) {
          w.strength = 0.0;
        }
      }
      this.dirWaveUniformsA[i].set(w.originX, w.originZ, w.dirX, w.dirZ);
      this.dirWaveUniformsB[i].set(w.time, w.strength, w.speed, w.maxDist);
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
   * - 200 ambient prairie particles float gently and stir with wind waves
   * - 750 tornado whirlwind particles get sucked into an inverted conical spiral
   *   funnel accelerating towards the sky like a real anime whirlwind!
   */
  private updateWindParticles(delta: number, elapsed: number): void {
    if (!this.particlePoints) return;

    const tornadoActive = this.tornadoStrength > 0.02;
    const targetX = this.smoothMouseGround.x;
    const targetZ = this.smoothMouseGround.z;
    const centerGroundY = this.getTerrainHeight(targetX, targetZ);

    // 1. Update Ambient Particles (0 .. 199)
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
        }
      } else {
        p.y = p.baseY + Math.sin(elapsed * 1.8 + i) * 0.08;

        // Wave crest lift: as directional waves roll past across the entire field, lift seeds
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
                if (forwardProj > 0.15) {
                  const deltaR = Math.abs(partDist - waveRadius);
                  if (deltaR < 3.0) {
                    const waveFactor = (1.0 - deltaR / 3.0) * w.strength * forwardProj;
                    p.vy += (1.4 + Math.random() * 2.0) * waveFactor;
                    p.vx += (w.dirX + toPartX / partDist) * 2.5 * waveFactor;
                    p.vz += (w.dirZ + toPartZ / partDist) * 2.5 * waveFactor;
                    p.isAirborne = true;
                    break;
                  }
                }
              }
            }
          }
        }
      }

      // Recycle ambient particles drifting off-limits
      if (p.x > 35 || p.x < -35 || p.z > 18 || p.z < -42) {
        p.x = (Math.random() - 0.5) * 50.0;
        p.z = 14.0 - Math.random() * 40.0;
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
    }

    // 2. Update Dedicated Tornado Funnel Particles (200 .. 949)
    for (let i = this.ambientParticleCount; i < this.particleCount; i++) {
      const p = this.particles[i];

      if (tornadoActive) {
        // Fast cyclonic spin around the tornado axis
        const spinSpeed =
          (18.0 + 10.0 * (1.0 - p.funnelHeight / 18.0)) *
          this.tornadoStrength *
          p.speedMultiplier;
        p.swirlAngle += spinSpeed * delta;

        // Strong upward suction towards the sky!
        const climbSpeed =
          (10.5 + 3.2 * Math.sin(p.swirlAngle * 2.0)) *
          this.tornadoStrength *
          p.speedMultiplier;
        p.funnelHeight += climbSpeed * delta;

        // Inverted conical funnel radius (narrow base expanding gracefully into sky)
        const funnelRadius =
          0.75 + (p.funnelHeight / 17.5) * 3.8 + p.radiusOffset;

        // Organic helical axis sway (wie ein lebendiger Wirbelsturm im Wind)
        const axisSway = (p.funnelHeight / 17.5) * 0.85;
        const axisX =
          targetX +
          Math.sin(elapsed * 3.4 + p.funnelHeight * 0.30) * axisSway;
        const axisZ =
          targetZ +
          Math.cos(elapsed * 2.8 + p.funnelHeight * 0.30) * axisSway;

        // Calculate 3D position
        p.x = axisX + Math.cos(p.swirlAngle) * funnelRadius;
        p.z = axisZ + Math.sin(p.swirlAngle) * funnelRadius;
        p.y = centerGroundY + p.funnelHeight;

        // Continuous stream loop: when particle reaches top of funnel in the sky,
        // recycle it immediately back to the vortex base on the ground
        if (p.funnelHeight > 17.5) {
          p.funnelHeight = 0.05 + Math.random() * 0.7;
          p.swirlAngle = Math.random() * Math.PI * 2;
          p.radiusOffset = (Math.random() - 0.5) * 0.7;
        }

        // Soft fading at ground entrance & high sky exit
        const fadeIn = Math.min(1.0, p.funnelHeight / 0.75);
        const fadeOut = Math.max(0.0, (17.5 - p.funnelHeight) / 3.2);
        const alpha = Math.min(fadeIn, fadeOut) * this.tornadoStrength;

        this.particlePositions[i * 3] = p.x;
        this.particlePositions[i * 3 + 1] = p.y;
        this.particlePositions[i * 3 + 2] = p.z;

        this.particleColors[i * 3] = p.colorR * alpha;
        this.particleColors[i * 3 + 1] = p.colorG * alpha;
        this.particleColors[i * 3 + 2] = p.colorB * alpha;
      } else {
        // Tornado stopped: particles currently in the air scatter gently on the wind
        if (p.y > -900) {
          if (!p.isAirborne) {
            p.isAirborne = true;
            p.vx = -Math.sin(p.swirlAngle) * 3.2 + 0.6;
            p.vz = Math.cos(p.swirlAngle) * 3.2 + 0.4;
            p.vy = -1.2 - Math.random() * 0.6;
          }

          p.x += p.vx * delta;
          p.y += p.vy * delta;
          p.z += p.vz * delta;
          p.vx *= 0.95;
          p.vz *= 0.95;

          const gY = this.getTerrainHeight(p.x, p.z) + 0.15;
          if (p.y <= gY) {
            p.y = -999;
            p.isAirborne = false;
          }

          this.particlePositions[i * 3] = p.x;
          this.particlePositions[i * 3 + 1] = p.y;
          this.particlePositions[i * 3 + 2] = p.z;

          // Fade out as it settles
          this.particleColors[i * 3] *= 0.95;
          this.particleColors[i * 3 + 1] *= 0.95;
          this.particleColors[i * 3 + 2] *= 0.95;
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

      // Spawn conditions:
      // 1. Initial movement or stroke restart (> 280ms since last wave)
      // 2. Direction change: turned by more than ~28 degrees (dotDir < 0.88)
      // 3. Traveled distance along current stroke (>= 1.1m)
      const isNewStroke = timeSinceSpawn > 280;
      const isTurned = dotDir < 0.88 && distFromLastSpawn >= 0.45;
      const isContinuousAdvance = distFromLastSpawn >= 1.1;

      if (isNewStroke || isTurned || isContinuousAdvance) {
        const intensity = Math.min(dist * 10.0, 1.0);
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

      this.prevMouseGround.copy(this.targetMouseGround);
    }
  }

  /**
   * Spawns an independent directional wave expanding forward, left and right.
   * Runs in an 8-wave ring buffer so previous waves keep rolling across the field
   * completely uninterrupted even if the player abruptly changes direction.
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
    wave.strength = Math.min(Math.max(intensity * 0.55, 0.18), 0.75);
    wave.speed = 18.0 + Math.min(intensity * 3.0, 4.0);
    wave.maxDist = 95.0;

    this.nextDirWaveIndex = (this.nextDirWaveIndex + 1) % this.maxDirWaves;

    // Stir particles ahead in the forward fan only (never behind the wave)
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
   * Stirs pollen / dandelion seeds strictly in the forward expansion cone of a wave.
   * Particles behind the wave origin are NEVER touched.
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
        // STRICT: only ahead of the wave origin
        const forwardProj = dx * dirX + dz * dirZ;
        if (forwardProj > 0.1) {
          const cosTheta = forwardProj / dist;
          if (cosTheta > 0.12) {
            const fanForce = (1.0 - dist / 5.8) * strength * cosTheta;
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
  }

  onPointerUp(event?: PointerEvent): void {
    if (event) {
      try {
        (event.target as HTMLElement)?.releasePointerCapture?.(event.pointerId);
      } catch {}
    }
    this.isPointerDown = false;
    this.pointerHoldTimer = 0.0;
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
    this.windSpeedDisplay.set('Sanfte Brise (14 km/h)');
    this.audio.updateWindIntensity(0.1);
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
   * Triggers a sweeping wind gust across the entire field.
   */
  triggerWindGust(): void {
    if (!this.grassMaterial) return;

    const originalStrength = this.grassMaterial.uniforms['uWindStrength'].value;
    this.grassMaterial.uniforms['uWindStrength'].value = originalStrength * 2.4;
    this.windSpeedDisplay.set('Sommer-Böe (42 km/h)');
    this.audio.updateWindIntensity(4.0);
    this.audio.triggerPulseChord();

    // Stir random ambient particles across the field
    for (let i = 0; i < this.ambientParticleCount; i++) {
      const p = this.particles[i];
      if (Math.random() < 0.45) {
        p.vy += 1.8 + Math.random() * 2.0;
        p.vx += 2.5 + Math.random() * 2.0;
        p.isAirborne = true;
      }
    }

    setTimeout(() => {
      if (this.grassMaterial) {
        this.grassMaterial.uniforms['uWindStrength'].value = originalStrength;
        this.windSpeedDisplay.set('Sanfte Brise (14 km/h)');
        this.audio.updateWindIntensity(0.2);
      }
    }, 1400);
  }

  // -------------------------------------------------------------
  // Preset & Configuration Setters
  // -------------------------------------------------------------

  setTimeOfDay(time: TimeOfDay): void {
    this.timeOfDay.set(time);
    const theme = THEMES[time];

    // Update sky backdrop shader
    if (this.skyMaterial) {
      this.skyMaterial.uniforms['uTimeOfDay'].value =
        time === 'day' ? 0.0 : time === 'golden' ? 1.0 : 2.0;
      this.skyMaterial.uniforms['uSkyColor'].value.copy(theme.skyColor);
    }

    // Update grass shader uniforms
    if (this.grassMaterial) {
      this.grassMaterial.uniforms['uBaseColor'].value.copy(theme.grassBase);
      this.grassMaterial.uniforms['uMidColor'].value.copy(theme.grassMid);
      this.grassMaterial.uniforms['uTipColor'].value.copy(theme.grassTip);
      this.grassMaterial.uniforms['uSunColor'].value.copy(theme.sunColor);
      this.grassMaterial.uniforms['uSkyColor'].value.copy(theme.skyColor);
      this.grassMaterial.uniforms['uSunDirection'].value.copy(theme.sunDirection);
      this.grassMaterial.uniforms['uTimeOfDay'].value =
        time === 'day' ? 0.0 : time === 'golden' ? 1.0 : 2.0;
    }

    // Update ground mesh color
    if (this.terrainMesh) {
      (this.terrainMesh.material as THREE.MeshBasicMaterial).color.copy(
        theme.grassMid.clone().multiplyScalar(0.92)
      );
    }

    // Update scene fog & background
    if (this.scene) {
      this.scene.background = new THREE.Color(theme.skyColor);
      this.scene.fog = new THREE.FogExp2(
        theme.skyColor.getHex(),
        time === 'night' ? 0.016 : 0.008
      );
    }
    if (this.renderer) {
      this.renderer.setClearColor(theme.skyColor, 1);
    }

    this.audio.triggerGrassChime(0, 0.15);
  }

  setWindPreset(preset: 'gentle' | 'fresh' | 'gust'): void {
    this.windPreset.set(preset);
    if (!this.grassMaterial) return;

    let strength = 1.25;
    if (preset === 'gentle') strength = 0.75;
    if (preset === 'gust') strength = 2.1;

    this.grassMaterial.uniforms['uWindStrength'].value = strength;
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
