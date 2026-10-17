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
  readonly isPlacingBlackHole = signal<boolean>(false);

  private closingBubbleTimeout: ReturnType<typeof setTimeout> | null = null;

  // Three.js Core Instances
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationId: number | null = null;
  private lastFrameTime = performance.now();

  // Celestial Night Sky Starfield Particle System
  private starfieldPoints!: THREE.Points;
  private blackHolePlacementMarker!: THREE.Mesh;

  // Pure Mouse Interaction State (No WASD!)
  private isPointerDown = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private pointerInitialX = 0;
  private pointerInitialY = 0;
  private pointerMoved = false;
  private readonly raycaster = new THREE.Raycaster();
  private readonly mouseNDC = new THREE.Vector2(-9999, -9999);

  // Camera Spherical Coordinates (comfortable perspective for glowing Sun and spaced orbits)
  private cameraSpherical = {
    radius: 64.0,
    theta: Math.PI / 4.2,
    phi: Math.PI / 3.4,
  };
  private targetSpherical = {
    radius: 64.0,
    theta: Math.PI / 4.2,
    phi: Math.PI / 3.4,
  };

  /**
   * Closes the info/speech bubble when clicking anywhere outside the bubble wrapper.
   */
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.showInfoBubble()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.stat-pill-wrapper')) return;
    this.closeInfoBubble();
  }

  /**
   * Escape key handler: Cancels black hole placement mode, closes info bubble if open, or returns to the hub.
   * Note: Keyboard WASD controls have been intentionally removed in favor of pure mouse navigation.
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isPlacingBlackHole()) {
      this.isPlacingBlackHole.set(false);
      if (this.blackHolePlacementMarker) {
        this.blackHolePlacementMarker.visible = false;
      }
      return;
    }
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

    if (this.blackHolePlacementMarker) {
      this.blackHolePlacementMarker.geometry.dispose();
      (this.blackHolePlacementMarker.material as THREE.Material).dispose();
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
    // Deep crystal-clear space void without fog so solar system stays visible at any zoom distance
    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.5, 10_000_000);
    this.updateCameraTransform();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Balanced celestial exposure
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    // Warm, welcoming solar point light
    const starCoreLight = new THREE.PointLight(0xfff5db, 5.2, 350, 0.45);
    starCoreLight.position.set(0, 0, 0);
    this.scene.add(starCoreLight);

    // Subtle, neutral cosmic ambient light (preserves deep darkness without blue wash)
    const cosmicAmbientLight = new THREE.AmbientLight(0x2d303a, 1.8);
    this.scene.add(cosmicAmbientLight);

    // Soft neutral starlight rim fill for velvety planetary shading
    const rimFillLight = new THREE.DirectionalLight(0xcfd4e2, 0.95);
    rimFillLight.position.set(30, 45, 25);
    this.scene.add(rimFillLight);

    // Mount subsystem groups into the scene
    this.scene.add(this.harpSystem.getGroup());
    this.scene.add(this.physicsEngine.getGroup());

    window.addEventListener('resize', this.onWindowResize);
  }

  /**
   * Creates an expansive, deep cosmic starfield:
   * Multi-magnitude spherical distribution of over 5,500 particle stars across cosmic distances (R >= 930).
   * Features luminary alpha stars, shimmering field stars, and fine deep stellar dust.
   * NOTE: All celestial sky elements are placed at r >= 930 to completely prevent any foreground interference.
   */
  private createCosmicEnvironment(): void {
    const particleTexture = this.textureFactory.getParticleGlowTexture();

    // -------------------------------------------------------------------------
    // Deep Celestial Particle Starfield (320 Alpha Stars + 2,700 Field Stars + 2,500 Stellar Dust)
    // -------------------------------------------------------------------------
    const alphaCount = 320;
    const fieldCount = 2700;
    const dustCount = 2500;
    const totalStars = alphaCount + fieldCount + dustCount;
    const positions = new Float32Array(totalStars * 3);
    const colors = new Float32Array(totalStars * 3);

    // Harmonious, scientifically inspired stellar color spectrum
    const colSirius = new THREE.Color(0xf8fafc);     // Brilliant pure diamond white (Class A)
    const colVega = new THREE.Color(0xe0f2fe);       // Crisp ice topaz blue (Class B)
    const colCapella = new THREE.Color(0xfef3c7);    // Radiant warm sunlight (Class G)
    const colArcturus = new THREE.Color(0xfde68a);   // Luminous golden amber (Class K)
    const colBetelgeuse = new THREE.Color(0xfecaca); // Gentle pastel ruby rose (Class M)
    const colLavender = new THREE.Color(0xede9fe);   // Subtle celestial violet (Nebular starlight)

    for (let i = 0; i < totalStars; i++) {
      const isAlpha = i < alphaCount;
      const isDust = i >= alphaCount + fieldCount;

      // Uniform spherical shell distribution at vast cosmic radius (R >= 930)
      const r = 930.0 + Math.random() * 45.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      let col: THREE.Color;
      let brightness: number;

      if (isAlpha) {
        // Prominent luminary stars anchoring celestial constellations
        const pick = Math.random();
        col = pick < 0.40 ? colSirius : pick < 0.65 ? colVega : pick < 0.85 ? colCapella : pick < 0.94 ? colArcturus : colBetelgeuse;
        brightness = 0.80 + Math.random() * 0.20;
      } else if (isDust) {
        // Faint distant micro-stardust adding incredible depth to the cosmic void
        const pick = Math.random();
        col = pick < 0.50 ? colSirius : pick < 0.80 ? colVega : colLavender;
        brightness = 0.12 + Math.random() * 0.22;
      } else {
        // Crisp intermediate field stars of 2nd - 4th magnitude
        const pick = Math.random();
        col = pick < 0.45 ? colSirius : pick < 0.75 ? colVega : pick < 0.90 ? colCapella : colLavender;
        brightness = 0.35 + Math.random() * 0.45;
      }

      colors[i * 3] = col.r * brightness;
      colors[i * 3 + 1] = col.g * brightness;
      colors[i * 3 + 2] = col.b * brightness;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 1.25,
      sizeAttenuation: false,
      vertexColors: true,
      map: particleTexture,
      transparent: true,
      opacity: 0.90,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });

    this.starfieldPoints = new THREE.Points(starGeo, starMat);
    this.starfieldPoints.renderOrder = -1000;
    this.starfieldPoints.frustumCulled = false;
    this.scene.add(this.starfieldPoints);

    // -------------------------------------------------------------------------
    // Holographic Black Hole Placement Marker Ring on Ecliptic Plane (y = 0)
    // -------------------------------------------------------------------------
    const markerGeo = new THREE.RingGeometry(1.6, 2.5, 48);
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.blackHolePlacementMarker = new THREE.Mesh(markerGeo, markerMat);
    this.blackHolePlacementMarker.rotation.x = Math.PI / 2;
    this.blackHolePlacementMarker.visible = false;
    this.scene.add(this.blackHolePlacementMarker);
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

    // Center celestial starfield on camera so it forms an infinite cosmic dome, and rotate gently
    if (this.starfieldPoints) {
      this.starfieldPoints.position.copy(this.camera.position);
      this.starfieldPoints.rotation.y += 0.000018 * this.timeSpeed();
    }

    // Spin placement marker ring when active
    if (this.blackHolePlacementMarker && this.blackHolePlacementMarker.visible) {
      this.blackHolePlacementMarker.rotation.z += 0.03;
    }

    // Advance serene N-body gravitational physics
    this.physicsEngine.update(dt, (collisionPos, isBlackHole, bothBlackHoles) => {
      const note = bothBlackHoles ? 0 : isBlackHole ? 1 : 5;
      this.audioService.playChime(note, bothBlackHoles ? 0.38 : 0.28);
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

  onStartPlacingBlackHole(): void {
    this.isPlacingBlackHole.set(true);
    this.audioService.playWaterdropToneOn(0.35);
  }

  onSpawnBlackHole(customPosition?: THREE.Vector3): void {
    this.physicsEngine.spawnBlackHole(customPosition);
    this.syncCounts();
    this.audioService.playChime(0, 0.45);
    this.isPlacingBlackHole.set(false);
    if (this.blackHolePlacementMarker) {
      this.blackHolePlacementMarker.visible = false;
    }
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
    this.targetSpherical.radius = 64.0;
    this.targetSpherical.theta = Math.PI / 4.2;
    this.targetSpherical.phi = Math.PI / 3.4;
  }

  resetCosmos(): void {
    this.isPlacingBlackHole.set(false);
    if (this.blackHolePlacementMarker) {
      this.blackHolePlacementMarker.visible = false;
    }
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
    this.pointerInitialX = event.clientX;
    this.pointerInitialY = event.clientY;
    this.pointerMoved = false;

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

        // In black hole placement mode, update holographic placement marker position on ecliptic plane y = 0
        if (this.isPlacingBlackHole() && this.blackHolePlacementMarker) {
          this.raycaster.setFromCamera(this.mouseNDC, this.camera);
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const hitPos = new THREE.Vector3();
          if (this.raycaster.ray.intersectPlane(plane, hitPos)) {
            let dist = Math.hypot(hitPos.x, hitPos.z);
            if (dist < 10.0) {
              const a = Math.atan2(hitPos.z, hitPos.x) || 0;
              hitPos.x = Math.cos(a) * 10.0;
              hitPos.z = Math.sin(a) * 10.0;
            }
            this.blackHolePlacementMarker.position.set(hitPos.x, 0.05, hitPos.z);
            const markerScale = Math.max(1.0, this.cameraSpherical.radius / 55.0);
            this.blackHolePlacementMarker.scale.set(markerScale, markerScale, markerScale);
            this.blackHolePlacementMarker.visible = true;
          }
        } else if (this.blackHolePlacementMarker) {
          this.blackHolePlacementMarker.visible = false;
        }

        // Raycast against thin orbital lines to pluck harp strings only when strings are enabled
        if (this.orbitStringsVisible() && !this.isPlacingBlackHole()) {
          this.raycaster.setFromCamera(this.mouseNDC, this.camera);
          const nowSeconds = performance.now() / 1000;
          const pluckedList = this.harpSystem.checkHarpPlucks(this.raycaster, nowSeconds);
          for (let p = 0; p < pluckedList.length; p++) {
            const track = pluckedList[p];
            const noteFreq = track.noteFrequency || track.noteIndex;
            if (p === 0) {
              this.audioService.playChime(noteFreq, 0.28);
            } else {
              setTimeout(() => {
                if (this.orbitStringsVisible()) {
                  this.audioService.playChime(noteFreq, 0.28);
                }
              }, p * 36);
            }
          }
        }
      }
    }

    if (!this.isPointerDown) return;

    if (Math.hypot(event.clientX - this.pointerInitialX, event.clientY - this.pointerInitialY) > 5) {
      this.pointerMoved = true;
    }

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
    if (this.isPlacingBlackHole() && !this.pointerMoved && event) {
      this.raycaster.setFromCamera(this.mouseNDC, this.camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const targetPos = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(plane, targetPos)) {
        let dist = Math.hypot(targetPos.x, targetPos.z);
        if (dist < 10.0) {
          const a = Math.atan2(targetPos.z, targetPos.x) || 0;
          targetPos.x = Math.cos(a) * 10.0;
          targetPos.z = Math.sin(a) * 10.0;
        }
        targetPos.y = 0;
        this.onSpawnBlackHole(targetPos);
      }
    }

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
    if (this.blackHolePlacementMarker) {
      this.blackHolePlacementMarker.visible = false;
    }
    this.harpSystem.resetPointerTracking();
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    // Smooth geometric zoom scaling with wheel delta for natural zooming at any cosmic scale
    const zoomFactor = Math.pow(1.0016, event.deltaY);
    this.targetSpherical.radius = Math.max(18.0, this.targetSpherical.radius * zoomFactor);
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

    // Expand camera far clipping plane dynamically if user zooms into deep cosmic distances
    if (radius * 4.0 > this.camera.far) {
      this.camera.far = radius * 8.0;
      this.camera.updateProjectionMatrix();
    }
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
