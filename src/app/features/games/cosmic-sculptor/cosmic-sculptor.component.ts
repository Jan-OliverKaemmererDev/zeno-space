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
import { CelestialTextureFactory } from './services/celestial-texture-factory';
import { OrbitHarpSystem } from './services/orbit-harp-system';
import { CosmicPhysicsEngine } from './services/cosmic-physics-engine';
import { CosmicHeaderComponent } from './components/cosmic-header/cosmic-header.component';
import { CosmicControlsComponent } from './components/cosmic-controls/cosmic-controls.component';

/**
 * Cosmic Sculptor – Aesthetic, luminous planetary system simulation in Zeno Space.
 * Features a breathtaking Milky Way night sky, gentle orbital and axial velocities,
 * velvety harmonious colors, resonant harp string orbits, and pure mouse navigation.
 */
@Component({
  selector: 'app-cosmic-sculptor',
  standalone: true,
  imports: [CosmicHeaderComponent, CosmicControlsComponent],
  templateUrl: './cosmic-sculptor.component.html',
  styleUrl: './cosmic-sculptor.component.scss',
})
export class CosmicSculptorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

  // Subsystems
  private readonly textureFactory = new CelestialTextureFactory();
  private readonly harpSystem = new OrbitHarpSystem();
  private readonly physicsEngine = new CosmicPhysicsEngine(this.textureFactory, this.harpSystem);

  // Reactive UI Signals
  readonly planetCount = signal<number>(0);
  readonly blackHoleCount = signal<number>(0);
  readonly collisionCount = signal<number>(0);
  readonly timeSpeed = signal<number>(1);
  readonly orbitStringsVisible = signal<boolean>(true);
  readonly showInfoBubble = signal<boolean>(false);
  readonly closingInfoBubble = signal<boolean>(false);

  private closingBubbleTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly systemStability = computed<'Harmonisch' | 'Gravitativ aktiv' | 'Singulär verzerrt'>(() => {
    if (this.blackHoleCount() > 0) return 'Singulär verzerrt';
    if (this.collisionCount() > 0 || this.planetCount() > 5) return 'Gravitativ aktiv';
    return 'Harmonisch';
  });

  // Three.js Core Instances
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationId: number | null = null;
  private lastFrameTime = performance.now();

  // Celestial Night Sky Particle Systems
  private starfieldPoints!: THREE.Points;
  private milkyWayPoints!: THREE.Points;
  private milkyWayGroup!: THREE.Group;

  // Pure Mouse Interaction State (No WASD!)
  private isPointerDown = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private readonly raycaster = new THREE.Raycaster();
  private readonly mouseNDC = new THREE.Vector2(-9999, -9999);

  // Camera Spherical Coordinates
  private cameraSpherical = {
    radius: 54.0,
    theta: Math.PI / 4.2,
    phi: Math.PI / 3.4,
  };
  private targetSpherical = {
    radius: 54.0,
    theta: Math.PI / 4.2,
    phi: Math.PI / 3.4,
  };

  /**
   * Escape key handler: Closes info bubble if open, otherwise returns to the hub.
   * Note: Keyboard WASD controls have been intentionally removed in favor of pure mouse navigation.
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showInfoBubble()) {
      this.closeInfoBubble();
    } else {
      this.router.navigate(['/'], { fragment: 'bubble-hub' });
    }
  }

  ngAfterViewInit(): void {
    this.initThree();
    this.createCosmicEnvironment();
    this.initStarterSolarSystem();
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.closingBubbleTimeout) {
      clearTimeout(this.closingBubbleTimeout);
    }

    window.removeEventListener('resize', this.onWindowResize);

    // Clean up Three.js WebGL resources
    this.physicsEngine.dispose();
    this.harpSystem.clear();
    this.textureFactory.dispose();

    if (this.starfieldPoints) {
      this.starfieldPoints.geometry.dispose();
      (this.starfieldPoints.material as THREE.Material).dispose();
    }

    if (this.milkyWayGroup) {
      this.milkyWayGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        } else if (obj instanceof THREE.Points) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
  }

  /**
   * Sets up WebGL renderer, perspective camera, and luminous, welcoming celestial illumination.
   */
  private initThree(): void {
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    // Ultra-light atmospheric depth for the solar plane without obscuring the deep cosmic night sky
    this.scene.fog = new THREE.FogExp2(0x0c102a, 0.0004);

    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 1200);
    this.updateCameraTransform();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Brighter, radiant exposure
    this.renderer.toneMappingExposure = 1.55;
    container.appendChild(this.renderer.domElement);

    // Warm, welcoming solar point light
    const starCoreLight = new THREE.PointLight(0xfff5db, 5.2, 350, 0.45);
    starCoreLight.position.set(0, 0, 0);
    this.scene.add(starCoreLight);

    // Radiant celestial ambient fill light (bright and gentle)
    const cosmicAmbientLight = new THREE.AmbientLight(0x4a5d85, 2.4);
    this.scene.add(cosmicAmbientLight);

    // Soft dimensional directional light for velvety shading
    const rimFillLight = new THREE.DirectionalLight(0x8ba6d4, 1.3);
    rimFillLight.position.set(30, 45, 25);
    this.scene.add(rimFillLight);

    // Mount subsystem groups into the scene
    this.scene.add(this.harpSystem.getGroup());
    this.scene.add(this.physicsEngine.getGroup());

    window.addEventListener('resize', this.onWindowResize);
  }

  /**
   * Creates the magnificent, tranquil deep cosmic night sky:
   * 1. The Milky Way: A smooth, glowing ethereal galactic ribbon with soft dust nebulae and stardust core.
   * 2. Distant Starfield: Delicate, quiet pinprick background stars placed strictly on the far celestial dome.
   * NOTE: All celestial sky elements are placed at r >= 780 to completely prevent any foreground noise or jitter.
   */
  private createCosmicEnvironment(): void {
    const particleTexture = this.textureFactory.getParticleGlowTexture();
    const nebulaTexture = this.textureFactory.createMilkyWayNebulaTexture();
    const coreTexture = this.textureFactory.createGalacticCoreTexture();

    // -------------------------------------------------------------------------
    // 1. The Milky Way Band (Die Milchstraße: Smooth Luminous Galactic Nebula)
    // -------------------------------------------------------------------------
    this.milkyWayGroup = new THREE.Group();
    // Majestic celestial angle across the cosmic sphere
    this.milkyWayGroup.rotation.x = 0.62;
    this.milkyWayGroup.rotation.z = -0.42;

    const cloudSegments = 36;
    const bandRadius = 800.0;
    const cloudGeo = new THREE.PlaneGeometry(240, 130);

    for (let k = 0; k < cloudSegments; k++) {
      const alpha = (k / cloudSegments) * Math.PI * 2;
      const x = Math.cos(alpha) * bandRadius;
      const z = Math.sin(alpha) * bandRadius;
      const y = (Math.sin(alpha * 2.0) * 0.08) * bandRadius;

      // Distance to galactic core (Sagittarius region near alpha = 0 or 2pi)
      const distToCore = Math.min(alpha, Math.PI * 2 - alpha);
      const isCore = distToCore < 0.65;

      const mat = new THREE.MeshBasicMaterial({
        map: isCore ? coreTexture : nebulaTexture,
        transparent: true,
        opacity: isCore ? 0.28 : 0.19,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      });

      const mesh = new THREE.Mesh(cloudGeo, mat);
      mesh.position.set(x, y, z);
      mesh.lookAt(0, 0, 0); // Always face inward toward the solar system
      this.milkyWayGroup.add(mesh);
    }

    // Embedded delicate stardust along the galactic lane
    const mwStarCount = 750;
    const mwStarPositions = new Float32Array(mwStarCount * 3);
    const mwStarColors = new Float32Array(mwStarCount * 3);

    const colCoreGold = new THREE.Color(0xfde68a);
    const colDiamond = new THREE.Color(0xffffff);
    const colIceBlue = new THREE.Color(0xbae6fd);
    const colLavender = new THREE.Color(0xc084fc);

    for (let i = 0; i < mwStarCount; i++) {
      const alpha = Math.random() * Math.PI * 2;
      const r = 780.0 + Math.random() * 50.0;
      const dispY = (Math.random() + Math.random() + Math.random() - 1.5) * 36.0;

      mwStarPositions[i * 3] = Math.cos(alpha) * r;
      mwStarPositions[i * 3 + 1] = dispY;
      mwStarPositions[i * 3 + 2] = Math.sin(alpha) * r;

      const mix = Math.random();
      const col = mix < 0.4 ? colDiamond : mix < 0.7 ? colIceBlue : mix < 0.88 ? colCoreGold : colLavender;
      const brightness = 0.4 + Math.random() * 0.5;

      mwStarColors[i * 3] = col.r * brightness;
      mwStarColors[i * 3 + 1] = col.g * brightness;
      mwStarColors[i * 3 + 2] = col.b * brightness;
    }

    const mwStarGeo = new THREE.BufferGeometry();
    mwStarGeo.setAttribute('position', new THREE.BufferAttribute(mwStarPositions, 3));
    mwStarGeo.setAttribute('color', new THREE.BufferAttribute(mwStarColors, 3));

    const mwStarMat = new THREE.PointsMaterial({
      size: 1.4,
      sizeAttenuation: false, // Prevents close-up scaling or foreground noise
      vertexColors: true,
      map: particleTexture,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });

    this.milkyWayPoints = new THREE.Points(mwStarGeo, mwStarMat);
    this.milkyWayPoints.frustumCulled = false;
    this.milkyWayGroup.add(this.milkyWayPoints);
    this.scene.add(this.milkyWayGroup);

    // -------------------------------------------------------------------------
    // 2. Surrounding Deep Celestial Starfield (~1,200 delicate pinprick stars)
    // -------------------------------------------------------------------------
    const starCount = 1200;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      // Placed strictly on the distant cosmic sphere (r = 820 to 880)
      const r = 820.0 + Math.random() * 60.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const mix = Math.random();
      const col = mix < 0.6 ? colDiamond : mix < 0.85 ? colIceBlue : colCoreGold;
      const brightness = 0.35 + Math.random() * 0.55;

      colors[i * 3] = col.r * brightness;
      colors[i * 3 + 1] = col.g * brightness;
      colors[i * 3 + 2] = col.b * brightness;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 1.2,
      sizeAttenuation: false, // Delicate, calm pinprick starlight, zero noise
      vertexColors: true,
      map: particleTexture,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });

    this.starfieldPoints = new THREE.Points(starGeo, starMat);
    this.starfieldPoints.frustumCulled = false;
    this.scene.add(this.starfieldPoints);
  }

  /**
   * Initializes the central glowing Sun and three peaceful starter planets on separate orbits.
   */
  private initStarterSolarSystem(): void {
    this.physicsEngine.initSun();
    this.physicsEngine.spawnPlanet('terrestrial');
    this.physicsEngine.spawnPlanet('gas-giant');
    this.physicsEngine.spawnPlanet('ice-giant');
    this.syncCounts();
  }

  /**
   * Continuous animation and physics loop with serene N-body gravitation and harp string dynamics.
   */
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const rawDt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;

    const dt = rawDt * this.timeSpeed();
    const nowSeconds = now / 1000;

    // Smooth camera inertia interpolation
    this.cameraSpherical.theta += (this.targetSpherical.theta - this.cameraSpherical.theta) * 0.12;
    this.cameraSpherical.phi += (this.targetSpherical.phi - this.cameraSpherical.phi) * 0.12;
    this.cameraSpherical.radius += (this.targetSpherical.radius - this.cameraSpherical.radius) * 0.12;
    this.updateCameraTransform();

    // Rotate night sky and Milky Way very slowly and majestically
    if (this.starfieldPoints) {
      this.starfieldPoints.rotation.y += 0.000018 * this.timeSpeed();
    }
    if (this.milkyWayGroup) {
      this.milkyWayGroup.rotation.y += 0.000025 * this.timeSpeed();
    }

    // Advance serene N-body gravitational physics
    this.physicsEngine.update(dt, (collisionPos, isBlackHole) => {
      const note = isBlackHole ? 1 : 5;
      this.audioService.playChime(note, 0.28);
    });

    // Update harp string standing wave displacements
    this.harpSystem.update(nowSeconds);

    this.syncCounts();
    this.renderer.render(this.scene, this.camera);
  };

  private syncCounts(): void {
    this.planetCount.set(this.physicsEngine.getPlanetCount());
    this.blackHoleCount.set(this.physicsEngine.getBlackHoleCount());
    this.collisionCount.set(this.physicsEngine.getCollisionCount());
  }

  // ---------------------------------------------------------------------------
  // User Actions (Dock & Controls)
  // ---------------------------------------------------------------------------

  onSpawnPlanet(): void {
    this.physicsEngine.spawnPlanet();
    this.syncCounts();
    this.audioService.playChime(Math.floor(Math.random() * 8), 0.22);
  }

  onSpawnBlackHole(): void {
    this.physicsEngine.spawnBlackHole();
    this.syncCounts();
    this.audioService.playChime(0, 0.35);
  }

  setTimeSpeed(speed: number): void {
    this.timeSpeed.set(speed);
    this.audioService.playChime(speed > 1 ? 6 : 3, 0.16);
  }

  toggleOrbitStrings(): void {
    const nextVal = !this.orbitStringsVisible();
    this.orbitStringsVisible.set(nextVal);
    this.harpSystem.setVisibility(nextVal);
  }

  resetCameraView(): void {
    this.targetSpherical.radius = 54.0;
    this.targetSpherical.theta = Math.PI / 4.2;
    this.targetSpherical.phi = Math.PI / 3.4;
  }

  resetCosmos(): void {
    this.physicsEngine.resetSystem();
    this.syncCounts();
    this.audioService.playChime(2, 0.25);
  }

  // ---------------------------------------------------------------------------
  // Info Bubble Interaction
  // ---------------------------------------------------------------------------

  toggleInfoBubble(event?: Event): void {
    event?.stopPropagation();
    if (this.showInfoBubble()) {
      this.closeInfoBubble();
    } else {
      this.openInfoBubble();
    }
  }

  openInfoBubble(): void {
    if (this.closingBubbleTimeout) {
      clearTimeout(this.closingBubbleTimeout);
      this.closingBubbleTimeout = null;
    }
    this.closingInfoBubble.set(false);
    this.showInfoBubble.set(true);
    this.audioService.playWaterdropToneOn(0.35);
  }

  closeInfoBubble(): void {
    if (this.closingBubbleTimeout) {
      clearTimeout(this.closingBubbleTimeout);
    }
    this.closingInfoBubble.set(true);
    this.closingBubbleTimeout = setTimeout(() => {
      this.showInfoBubble.set(false);
      this.closingInfoBubble.set(false);
      this.closingBubbleTimeout = null;
    }, 320);
  }

  // ---------------------------------------------------------------------------
  // Pure Mouse & Pointer Interaction (NO WASD!)
  // ---------------------------------------------------------------------------

  onPointerDown(event: PointerEvent): void {
    this.isPointerDown = true;
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

        // Raycast against thin orbital lines to pluck harp strings
        this.raycaster.setFromCamera(this.mouseNDC, this.camera);
        const nowSeconds = performance.now() / 1000;
        const plucked = this.harpSystem.checkHarpPluck(this.raycaster, nowSeconds);
        if (plucked) {
          this.audioService.playChime(plucked.noteIndex, 0.24);
        }
      }
    }

    if (!this.isPointerDown) return;

    const deltaX = event.clientX - this.pointerStartX;
    const deltaY = event.clientY - this.pointerStartY;

    const rotSpeed = 0.007;
    this.targetSpherical.theta -= deltaX * rotSpeed;
    this.targetSpherical.phi = Math.max(
      0.15,
      Math.min(Math.PI / 2 - 0.05, this.targetSpherical.phi - deltaY * rotSpeed)
    );

    this.pointerStartX = event.clientX;
    this.pointerStartY = event.clientY;
  }

  onPointerUp(event?: PointerEvent): void {
    this.isPointerDown = false;
    if (event?.currentTarget) {
      const target = event.currentTarget as HTMLElement;
      if (target?.releasePointerCapture) {
        try {
          target.releasePointerCapture(event.pointerId);
        } catch {}
      }
    }
  }

  onPointerLeave(): void {
    this.isPointerDown = false;
    this.mouseNDC.set(-9999, -9999);
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomSpeed = 0.055;
    this.targetSpherical.radius = Math.max(
      18.0,
      Math.min(130.0, this.targetSpherical.radius + event.deltaY * zoomSpeed)
    );
  }

  onDoubleClick(): void {
    this.resetCameraView();
  }

  private updateCameraTransform(): void {
    const { radius, theta, phi } = this.cameraSpherical;
    this.camera.position.x = radius * Math.sin(phi) * Math.cos(theta);
    this.camera.position.y = radius * Math.cos(phi);
    this.camera.position.z = radius * Math.sin(phi) * Math.sin(theta);
    this.camera.lookAt(0, 0, 0);
  }

  private onWindowResize = (): void => {
    if (!this.containerRef?.nativeElement) return;
    const width = this.containerRef.nativeElement.clientWidth;
    const height = this.containerRef.nativeElement.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };
}
