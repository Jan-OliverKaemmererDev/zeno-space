import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  Input,
  output,
  inject,
  NgZone,
} from '@angular/core';
import * as THREE from 'three';
import { GrasAudioService } from '../../services/gras-audio.service';
import { GrasTerrainService } from '../../services/gras-terrain.service';
import { GrasWaveManagerService } from '../../services/gras-wave-manager.service';
import { GrasParticleSystemService } from '../../services/gras-particle-system.service';
import {
  GRASS_VERTEX_SHADER,
  GRASS_FRAGMENT_SHADER,
  SKY_BACKDROP_VERTEX_SHADER,
  SKY_BACKDROP_FRAGMENT_SHADER,
} from '../../shaders/grass.shaders';
import { TimeOfDay, THEMES } from '../../utils/sky-cloud-generator';
import { WindPreset } from '../../models/gras-harmonie.models';

/**
 * Interactive 3D Canvas component for Gras-Harmonie.
 * Hosts the Three.js viewport, sky backdrop, rolling terrain, 240,000 instanced grass blades,
 * particle dynamics (fireflies & tornado), and pointer interaction raycasting.
 */
@Component({
  selector: 'app-gras-canvas',
  standalone: true,
  providers: [
    GrasTerrainService,
    GrasWaveManagerService,
    GrasParticleSystemService,
  ],
  templateUrl: './gras-canvas.component.html',
  styleUrl: './gras-canvas.component.scss',
})
export class GrasCanvasComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  @Input({ required: true }) timeOfDay: TimeOfDay = 'day';
  @Input({ required: true }) windPreset: WindPreset = 'fresh';

  /** Emitted whenever wind speed / state display text updates. */
  readonly windSpeedChange = output<string>();

  private readonly audio = inject(GrasAudioService);
  private readonly terrain = inject(GrasTerrainService);
  private readonly waveManager = inject(GrasWaveManagerService);
  private readonly particleSystem = inject(GrasParticleSystemService);
  private readonly ngZone = inject(NgZone);

  // Three.js Core
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private animFrameId: number | null = null;
  private isDestroyed = false;
  private textureLoader = new THREE.TextureLoader();

  // Meshes & Materials
  private skyMesh!: THREE.Mesh;
  private skyMaterial!: THREE.ShaderMaterial;
  private grassMesh!: THREE.InstancedMesh;
  private grassMaterial!: THREE.ShaderMaterial;
  private terrainMesh!: THREE.Mesh;

  // Atmosphere transition state
  private targetTheme = THEMES[this.timeOfDay];
  private targetGoldenWeight = this.timeOfDay === 'golden' ? 1.0 : 0.0;
  private targetNightWeight = this.timeOfDay === 'night' ? 1.0 : 0.0;
  private currentGoldenWeight = this.timeOfDay === 'golden' ? 1.0 : 0.0;
  private currentNightWeight = this.timeOfDay === 'night' ? 1.0 : 0.0;
  private targetFogDensity = this.timeOfDay === 'night' ? 0.016 : 0.008;
  private currentFogDensity = this.timeOfDay === 'night' ? 0.016 : 0.008;
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

  private lastStrokePos = new THREE.Vector3(0, 0, 0);
  private lastSpawnDir = new THREE.Vector2(0, 1);
  private lastSpawnTime = 0;

  // Wind Preset Parameters
  private currentWindStrength = 1.4;
  private targetWindStrength = 1.4;
  private currentWindSpeed = 1.8;
  private targetWindSpeed = 1.8;
  private currentFlutterSpeed = 8.5;
  private targetFlutterSpeed = 8.5;
  private currentFlutterStrength = 0.06;
  private targetFlutterStrength = 0.06;
  private windPhase = 0.0;
  private flutterPhase = 0.0;

  private readonly bladeCount = 240000;
  private baseCamPos = new THREE.Vector3(0, 10.8, 19.5);
  private targetCamLookAt = new THREE.Vector3(0, 1.2, -13.5);

  ngAfterViewInit(): void {
    this.initThree();
    if (!this.renderer) return;

    this.buildSkyBackdrop();
    this.buildTerrainAndGrass();
    this.particleSystem.init(this.scene, (x, z) =>
      this.terrain.getTerrainHeight(x, z)
    );
    this.onResize();

    window.addEventListener('resize', this.onResize);

    this.ngZone.runOutsideAngular(() => {
      this.animate();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['timeOfDay'] && !changes['timeOfDay'].firstChange) {
      this.applyTimeOfDay(this.timeOfDay);
    }
    if (changes['windPreset'] && !changes['windPreset'].firstChange) {
      this.applyWindPreset(this.windPreset);
    }
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    this.particleSystem.dispose();
    this.disposeThree();
  }

  /**
   * Triggers a sweeping wind gust wave across the grass field.
   */
  triggerWindGust(): void {
    if (!this.grassMaterial) return;

    const wave = this.waveManager.triggerWindGust();

    this.windSpeedChange.emit('Mächtige Sommer-Böe (54 km/h)');
    this.audio.triggerPulseChord();
    this.audio.triggerGrassChime(0, 0.95);
    this.audio.updateWindIntensity(3.8);

    this.particleSystem.stirInGust(wave.dirX, wave.dirZ);
  }

  /**
   * Applies a new time of day smoothly.
   */
  applyTimeOfDay(time: TimeOfDay): void {
    this.timeOfDay = time;
    this.targetTheme = THEMES[time];
    this.targetGoldenWeight = time === 'golden' ? 1.0 : 0.0;
    this.targetNightWeight = time === 'night' ? 1.0 : 0.0;
    this.targetFogDensity = time === 'night' ? 0.016 : 0.008;
    this.isThemeTransitioning = true;
    this.audio.triggerGrassChime(0, 0.15);
  }

  /**
   * Applies a wind preset smoothly.
   */
  applyWindPreset(preset: WindPreset): void {
    this.windPreset = preset;
    if (preset === 'gentle') {
      this.targetWindStrength = 0.45;
      this.targetWindSpeed = 0.75;
      this.targetFlutterSpeed = 4.0;
      this.targetFlutterStrength = 0.02;
    } else if (preset === 'gust') {
      this.targetWindStrength = 3.2;
      this.targetWindSpeed = 3.8;
      this.targetFlutterSpeed = 16.0;
      this.targetFlutterStrength = 0.16;
    } else {
      this.targetWindStrength = 1.4;
      this.targetWindSpeed = 1.8;
      this.targetFlutterSpeed = 8.5;
      this.targetFlutterStrength = 0.06;
    }

    this.windSpeedChange.emit(this.getBaselineWindDisplay());
    this.audio.updateWindIntensity(this.getBaselineAudioIntensity());
  }

  private initThree(): void {
    const container = this.containerRef?.nativeElement;
    if (!container) return;

    this.scene = new THREE.Scene();
    const initialTheme = THEMES[this.timeOfDay];
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

    try {
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
    } catch {
      // In headless test environments where WebGL is not available
      return;
    }
  }

  private buildSkyBackdrop(): void {
    if (!this.renderer) return;
    const skyTexture = this.textureLoader.load(
      '/images/gras-harmonie/sky-backdrop.jpg'
    );
    skyTexture.wrapS = THREE.MirroredRepeatWrapping;
    skyTexture.wrapT = THREE.ClampToEdgeWrapping;
    skyTexture.colorSpace = THREE.SRGBColorSpace;

    const skyGeo = new THREE.PlaneGeometry(640, 150);
    const container = this.containerRef.nativeElement;
    const currentAspect = container.clientWidth / (container.clientHeight || 1);
    const theme = THEMES[this.timeOfDay];

    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: SKY_BACKDROP_VERTEX_SHADER,
      fragmentShader: SKY_BACKDROP_FRAGMENT_SHADER,
      uniforms: {
        uSkyTexture: { value: skyTexture },
        uTime: { value: 0.0 },
        uTimeOfDay: {
          value:
            this.timeOfDay === 'day'
              ? 0.0
              : this.timeOfDay === 'golden'
              ? 1.0
              : 2.0,
        },
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

  private buildTerrainAndGrass(): void {
    if (!this.renderer) return;
    const theme = THEMES[this.timeOfDay];

    this.terrainMesh = this.terrain.createTerrainMesh(
      this.textureLoader,
      theme
    );
    this.scene.add(this.terrainMesh);

    const uniforms = {
      uTime: { value: 0 },
      uWindDir: { value: new THREE.Vector2(0.85, 0.52).normalize() },
      uWindStrength: { value: this.currentWindStrength },
      uWindPhase: { value: 0.0 },
      uFlutterPhase: { value: 0.0 },
      uFlutterStrength: { value: this.currentFlutterStrength },
      uMousePos: { value: new THREE.Vector3(0, 0, 0) },
      uDirWaveA: { value: this.waveManager.dirWaveUniformsA },
      uDirWaveB: { value: this.waveManager.dirWaveUniformsB },
      uShockwaves: { value: this.waveManager.shockwaveUniforms },
      uTornadoPos: { value: new THREE.Vector2(0, 0) },
      uTornadoStrength: { value: 0.0 },
      uGustWaves: { value: this.waveManager.gustWaveUniformsA },
      uGustDirs: { value: this.waveManager.gustWaveUniformsB },
      uBaseColor: { value: theme.grassBase.clone() },
      uMidColor: { value: theme.grassMid.clone() },
      uTipColor: { value: theme.grassTip.clone() },
      uSunDirection: { value: theme.sunDirection.clone() },
      uSunColor: { value: theme.sunColor.clone() },
      uSkyColor: { value: theme.skyColor.clone() },
      uTimeOfDay: {
        value:
          this.timeOfDay === 'day'
            ? 0.0
            : this.timeOfDay === 'golden'
            ? 1.0
            : 2.0,
      },
    };

    this.grassMaterial = new THREE.ShaderMaterial({
      vertexShader: GRASS_VERTEX_SHADER,
      fragmentShader: GRASS_FRAGMENT_SHADER,
      uniforms,
      side: THREE.DoubleSide,
      wireframe: false,
    });

    this.grassMesh = this.terrain.createGrassMesh(
      this.bladeCount,
      this.grassMaterial
    );
    this.scene.add(this.grassMesh);
  }

  private animate = (): void => {
    if (this.isDestroyed || !this.renderer) return;
    this.animFrameId = requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.08);
    const elapsed = this.clock.getElapsedTime();

    if (this.skyMaterial) {
      this.skyMaterial.uniforms['uTime'].value = elapsed;
    }

    if (this.isThemeTransitioning) {
      this.updateAtmosphereTransition(delta);
    }

    const lerpPos = 1.0 - Math.exp(-22.0 * delta);
    this.smoothMouseGround.lerp(this.targetMouseGround, lerpPos);

    const { maxActiveGustStrength, primaryGust } =
      this.waveManager.update(delta);

    // Audio & display recovery after gust
    if (maxActiveGustStrength > 0.01 && this.tornadoStrength < 0.2) {
      if (primaryGust) {
        const prog = Math.min(
          1.0,
          (primaryGust.time * primaryGust.speed) / primaryGust.maxDist
        );
        if (prog > 0.6) {
          const fade = (1.0 - prog) / 0.4;
          const baselineAudio = this.getBaselineAudioIntensity();
          this.audio.updateWindIntensity(baselineAudio + fade * 3.2);
          if (prog > 0.88) {
            this.windSpeedChange.emit(this.getBaselineWindDisplay());
          }
        }
      }
    }

    // Tornado vortex hold
    if (this.isPointerDown) {
      this.pointerHoldTimer += delta;
      if (this.pointerHoldTimer > 0.18) {
        this.tornadoStrength = Math.min(1.0, this.tornadoStrength + delta * 2.4);
        this.windSpeedChange.emit('Wirbelnder Tornado (85 km/h)');
        this.audio.updateWindIntensity(1.6 + this.tornadoStrength * 3.4);
      }
    } else {
      this.pointerHoldTimer = 0.0;
      this.tornadoStrength = Math.max(0.0, this.tornadoStrength - delta * 2.2);
    }

    // Wind preset blending
    const windLerp = Math.min(1.0, 2.5 * delta);
    this.currentWindStrength +=
      (this.targetWindStrength - this.currentWindStrength) * windLerp;
    this.currentWindSpeed +=
      (this.targetWindSpeed - this.currentWindSpeed) * windLerp;
    this.currentFlutterSpeed +=
      (this.targetFlutterSpeed - this.currentFlutterSpeed) * windLerp;
    this.currentFlutterStrength +=
      (this.targetFlutterStrength - this.currentFlutterStrength) * windLerp;

    this.windPhase += delta * this.currentWindSpeed;
    this.flutterPhase += delta * this.currentFlutterSpeed;

    if (this.grassMaterial) {
      this.grassMaterial.uniforms['uTime'].value = elapsed;
      this.grassMaterial.uniforms['uWindStrength'].value =
        this.currentWindStrength;
      this.grassMaterial.uniforms['uWindPhase'].value = this.windPhase;
      this.grassMaterial.uniforms['uFlutterPhase'].value = this.flutterPhase;
      this.grassMaterial.uniforms['uFlutterStrength'].value =
        this.currentFlutterStrength;
      this.grassMaterial.uniforms['uMousePos'].value.copy(
        this.smoothMouseGround
      );
      this.grassMaterial.uniforms['uTornadoPos'].value.set(
        this.smoothMouseGround.x,
        this.smoothMouseGround.z
      );
      this.grassMaterial.uniforms['uTornadoStrength'].value =
        this.tornadoStrength;
    }

    // Update particle dynamics
    const tornadoActive = this.isPointerDown && this.pointerHoldTimer > 0.18;
    this.particleSystem.update(delta, elapsed, {
      tornadoActive,
      tornadoStrength: this.tornadoStrength,
      targetX: this.smoothMouseGround.x,
      targetZ: this.smoothMouseGround.z,
      currentWindSpeed: this.currentWindSpeed,
      currentNightWeight: this.currentNightWeight,
      dirWaves: this.waveManager.dirWaves,
      gustWaves: this.waveManager.gustWaves,
    });

    // Gentle Camera Ambient Sway
    const camSwayX = Math.sin(elapsed * 0.45) * 0.18;
    const camSwayY = Math.cos(elapsed * 0.6) * 0.1;
    this.camera.position.x = this.baseCamPos.x + camSwayX;
    this.camera.position.y = this.baseCamPos.y + camSwayY;
    this.camera.lookAt(this.targetCamLookAt);

    this.renderer.render(this.scene, this.camera);
  };

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

    const sw = this.waveManager.triggerClickWave(
      this.targetMouseGround.x,
      this.targetMouseGround.z
    );
    this.particleSystem.stirInShockwave(sw.x, sw.z);
    this.audio.triggerPulseChord();
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

      const distFromLastSpawn =
        this.targetMouseGround.distanceTo(this.lastStrokePos);
      const dotDir = dirX * this.lastSpawnDir.x + dirZ * this.lastSpawnDir.y;
      const timeSinceSpawn = now - this.lastSpawnTime;

      const isNewStroke = timeSinceSpawn > 160;
      const isTurned = dotDir < 0.95 && distFromLastSpawn >= 0.28;
      const isContinuousAdvance = distFromLastSpawn >= 0.75;

      if (isNewStroke || isTurned || isContinuousAdvance) {
        const speed = dist / Math.max((now - this.lastSpawnTime) / 1000, 0.016);
        const intensity = Math.min(Math.max(speed * 0.1, 0.25), 0.85);

        const wave = this.waveManager.spawnDirectionalWave(
          this.targetMouseGround.x,
          this.targetMouseGround.z,
          dirX,
          dirZ,
          intensity
        );

        this.particleSystem.stirInForwardFan(
          this.targetMouseGround.x,
          this.targetMouseGround.z,
          dirX,
          dirZ,
          wave.strength
        );

        const normX = this.targetMouseGround.x / 18.0;
        this.audio.triggerGrassChime(
          normX,
          Math.min(wave.strength * 0.7, 0.85)
        );
        this.audio.updateWindIntensity(wave.strength * 2.0);

        if (this.tornadoStrength < 0.2) {
          const kmh = Math.round(18 + wave.strength * 36);
          this.windSpeedChange.emit(`Windwelle (${kmh} km/h)`);
        }

        this.lastStrokePos.copy(this.targetMouseGround);
        this.lastSpawnDir.set(dirX, dirZ);
        this.lastSpawnTime = now;
      }
    }

    this.prevMouseGround.copy(this.targetMouseGround);
  }

  onPointerUp(event?: PointerEvent): void {
    if (event) {
      try {
        (event.target as HTMLElement)?.releasePointerCapture?.(event.pointerId);
      } catch {}
    }
    this.isPointerDown = false;
    this.pointerHoldTimer = 0.0;
    this.particleSystem.startTornadoSettling();
    if (this.tornadoStrength > 0.2) {
      this.windSpeedChange.emit(this.getBaselineWindDisplay());
      this.audio.updateWindIntensity(this.getBaselineAudioIntensity());
    }
  }

  onPointerLeave(event?: PointerEvent): void {
    if (event && (event.buttons & 1) === 1) {
      return;
    }
    this.isPointerDown = false;
    this.pointerHoldTimer = 0.0;
    this.tornadoStrength = 0.0;
    this.particleSystem.startTornadoSettling();
    this.windSpeedChange.emit(this.getBaselineWindDisplay());
    this.audio.updateWindIntensity(this.getBaselineAudioIntensity());
  }

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

  private updateAtmosphereTransition(delta: number): void {
    const lerpSpeed = Math.min(1.0, 5.0 * delta);

    this.currentGoldenWeight +=
      (this.targetGoldenWeight - this.currentGoldenWeight) * lerpSpeed;
    this.currentNightWeight +=
      (this.targetNightWeight - this.currentNightWeight) * lerpSpeed;
    this.currentFogDensity +=
      (this.targetFogDensity - this.currentFogDensity) * lerpSpeed;

    if (this.skyMaterial) {
      this.skyMaterial.uniforms['uGoldenWeight'].value =
        this.currentGoldenWeight;
      this.skyMaterial.uniforms['uNightWeight'].value = this.currentNightWeight;
      this.skyMaterial.uniforms['uSkyColor'].value.lerp(
        this.targetTheme.skyColor,
        lerpSpeed
      );
      this.skyMaterial.uniforms['uTimeOfDay'].value =
        this.timeOfDay === 'day'
          ? 0.0
          : this.timeOfDay === 'golden'
          ? 1.0
          : 2.0;
    }

    if (this.grassMaterial) {
      this.grassMaterial.uniforms['uBaseColor'].value.lerp(
        this.targetTheme.grassBase,
        lerpSpeed
      );
      this.grassMaterial.uniforms['uMidColor'].value.lerp(
        this.targetTheme.grassMid,
        lerpSpeed
      );
      this.grassMaterial.uniforms['uTipColor'].value.lerp(
        this.targetTheme.grassTip,
        lerpSpeed
      );
      this.grassMaterial.uniforms['uSunColor'].value.lerp(
        this.targetTheme.sunColor,
        lerpSpeed
      );
      this.grassMaterial.uniforms['uSkyColor'].value.lerp(
        this.targetTheme.skyColor,
        lerpSpeed
      );
      this.grassMaterial.uniforms['uSunDirection'].value.lerp(
        this.targetTheme.sunDirection,
        lerpSpeed
      );
      this.grassMaterial.uniforms['uTimeOfDay'].value =
        this.timeOfDay === 'day'
          ? 0.0
          : this.timeOfDay === 'golden'
          ? 1.0
          : 2.0;
    }

    if (this.terrainMesh) {
      (this.terrainMesh.material as THREE.MeshBasicMaterial).color.lerp(
        this.targetTheme.groundColor,
        lerpSpeed
      );
    }

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
      const bg =
        (this.scene?.background as THREE.Color) || this.targetTheme.skyColor;
      this.renderer.setClearColor(bg, 1);
    }

    const diffGolden = Math.abs(
      this.targetGoldenWeight - this.currentGoldenWeight
    );
    const diffNight = Math.abs(this.targetNightWeight - this.currentNightWeight);
    if (diffGolden < 0.005 && diffNight < 0.005) {
      this.currentGoldenWeight = this.targetGoldenWeight;
      this.currentNightWeight = this.targetNightWeight;
      this.currentFogDensity = this.targetFogDensity;

      if (this.skyMaterial) {
        this.skyMaterial.uniforms['uGoldenWeight'].value =
          this.currentGoldenWeight;
        this.skyMaterial.uniforms['uNightWeight'].value =
          this.currentNightWeight;
        this.skyMaterial.uniforms['uSkyColor'].value.copy(
          this.targetTheme.skyColor
        );
      }
      if (this.grassMaterial) {
        this.grassMaterial.uniforms['uBaseColor'].value.copy(
          this.targetTheme.grassBase
        );
        this.grassMaterial.uniforms['uMidColor'].value.copy(
          this.targetTheme.grassMid
        );
        this.grassMaterial.uniforms['uTipColor'].value.copy(
          this.targetTheme.grassTip
        );
        this.grassMaterial.uniforms['uSunColor'].value.copy(
          this.targetTheme.sunColor
        );
        this.grassMaterial.uniforms['uSkyColor'].value.copy(
          this.targetTheme.skyColor
        );
        this.grassMaterial.uniforms['uSunDirection'].value.copy(
          this.targetTheme.sunDirection
        );
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

  private getBaselineWindDisplay(): string {
    if (this.windPreset === 'gentle') return 'Sanfte Brise (8 km/h)';
    if (this.windPreset === 'gust') return 'Kräftiger Wind (38 km/h)';
    return 'Frische Brise (18 km/h)';
  }

  private getBaselineAudioIntensity(): number {
    if (this.windPreset === 'gentle') return 0.08;
    if (this.windPreset === 'gust') return 0.5;
    return 0.22;
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
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
