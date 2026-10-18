import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
  signal,
  HostListener,
} from '@angular/core';
import { Router } from '@angular/router';
import * as THREE from 'three';
import { AudioService } from '../../../core/services/audio.service';
import { AmeisenTerrainFactory } from './services/ameisen-terrain-factory';
import { AmeisenFruitFactory } from './services/ameisen-fruit-factory';
import { AmeisenEnemyFactory } from './services/ameisen-enemy-factory';
import { AmeisenColonyEngine } from './services/ameisen-colony-engine';
import { AmeisenHeaderComponent } from './components/ameisen-header/ameisen-header.component';
import { AmeisenControlsComponent } from './components/ameisen-controls/ameisen-controls.component';

/**
 * Ameisenhügel – 3D Spherical Ant Planet Simulation in Zeno Space.
 * Features a lush miniature globe with a North Pole ant hill, curved pheromone highways,
 * realistic 3D fruit harvesting with physical crumb transport, defensive ant swarm strikes
 * against invasive beetles, wasps, and spiders, and WASD + Mouse planetary orbit/zoom controls.
 */
@Component({
  selector: 'app-ameisenhuegel',
  standalone: true,
  imports: [AmeisenHeaderComponent, AmeisenControlsComponent],
  templateUrl: './ameisenhuegel.component.html',
  styleUrl: './ameisenhuegel.component.scss',
})
export class AmeisenhuegelComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

  // Subsystems
  private readonly terrainFactory = new AmeisenTerrainFactory();
  private readonly fruitFactory = new AmeisenFruitFactory();
  private readonly enemyFactory = new AmeisenEnemyFactory();
  private readonly colonyEngine = new AmeisenColonyEngine(
    this.fruitFactory,
    this.enemyFactory,
    this.terrainFactory,
  );

  // Reactive UI Signals
  readonly antCount = signal<number>(20);
  readonly foodStock = signal<number>(0);
  readonly hillLevel = signal<number>(1);
  readonly defeatedEnemies = signal<number>(0);
  readonly timeSpeed = signal<number>(1);
  readonly showInfoBubble = signal<boolean>(false);
  readonly closingInfoBubble = signal<boolean>(false);

  private closingBubbleTimeout: ReturnType<typeof setTimeout> | null = null;
  private autoFruitTimer: ReturnType<typeof setInterval> | null = null;
  private autoEnemyTimer: ReturnType<typeof setInterval> | null = null;

  // Three.js Core Instances
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationId: number | null = null;
  private lastFrameTime = performance.now();

  // Raycasting & Pointer State
  private isPointerDown = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private pointerInitialX = 0;
  private pointerInitialY = 0;
  private pointerMoved = false;
  private readonly raycaster = new THREE.Raycaster();
  private readonly mouseNDC = new THREE.Vector2(-9999, -9999);

  // WASD Key State
  private readonly activeKeys: { [key: string]: boolean } = {};
  // Camera focus bias (North Pole hill region)
  private readonly cameraTarget = new THREE.Vector3(0, 8.0, 0);

  // Camera Spherical Coordinates around the enlarged Ant Planet
  private cameraSpherical = {
    radius: 54.0,
    theta: Math.PI / 4,
    phi: Math.PI / 3.2,
  };
  private targetSpherical = {
    radius: 54.0,
    theta: Math.PI / 4,
    phi: Math.PI / 3.2,
  };

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.showInfoBubble()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.stat-pill-wrapper')) return;
    this.closeInfoBubble();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
      this.activeKeys[key] = true;
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.activeKeys[key] = false;
  }

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
    this.initStarterScene();
    this.startSpawningTimers();
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

    if (this.autoFruitTimer) {
      clearInterval(this.autoFruitTimer);
    }

    if (this.autoEnemyTimer) {
      clearInterval(this.autoEnemyTimer);
    }

    window.removeEventListener('resize', this.onWindowResize);

    // Clean up Three.js WebGL resources
    this.terrainFactory.dispose();
    this.fruitFactory.dispose();
    this.enemyFactory.dispose();
    this.colonyEngine.dispose();

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
  }

  private initThree(): void {
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.5, 600);
    this.updateCameraTransform();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    container.appendChild(this.renderer.domElement);

    // 1. Primary Warm Golden Sunlight
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 3.4);
    sunLight.position.set(28, 38, 26);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 110;
    sunLight.shadow.camera.left = -24;
    sunLight.shadow.camera.right = 24;
    sunLight.shadow.camera.top = 24;
    sunLight.shadow.camera.bottom = -24;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    // 2. Cosmic Rim Backlight (illuminates the dark side of the spherical planet)
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.35);
    rimLight.position.set(-26, -22, -24);
    this.scene.add(rimLight);

    // 3. Soft Sky & Emerald Planetary Hemisphere Light
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x14532d, 1.65);
    this.scene.add(hemiLight);

    // 4. Deep Forest Ambient Fill
    const ambientLight = new THREE.AmbientLight(0x1e293b, 1.1);
    this.scene.add(ambientLight);

    // Mount subsystem groups into the scene
    this.scene.add(this.terrainFactory.getGroup());
    this.scene.add(this.fruitFactory.getGroup());
    this.scene.add(this.enemyFactory.getGroup());
    this.scene.add(this.colonyEngine.getGroup());

    window.addEventListener('resize', this.onWindowResize);
  }

  private initStarterScene(): void {
    // Spawn starter fruits along the curved planetary trails
    this.fruitFactory.spawnFruit(
      'apfel',
      AmeisenTerrainFactory.polarToSurfacePoint(0.52, 0.15, 0.52),
    );
    this.fruitFactory.spawnFruit(
      'birne',
      AmeisenTerrainFactory.polarToSurfacePoint(0.62, 2.25, 0.52),
    );
    this.fruitFactory.spawnFruit(
      'erdbeere',
      AmeisenTerrainFactory.polarToSurfacePoint(0.58, 4.35, 0.52),
    );
    this.syncCounts();
  }

  private startSpawningTimers(): void {
    // Periodically spawn a new fresh fruit if planet has few fruits
    this.autoFruitTimer = setInterval(() => {
      if (this.fruitFactory.getActiveFruits().length < 5) {
        this.fruitFactory.spawnFruit();
        this.audioService.playWaterdropToneOn(0.25);
      }
    }, 16000);

    // Periodically spawn an enemy insect seeking food
    this.autoEnemyTimer = setInterval(() => {
      if (this.enemyFactory.getActiveEnemies().length < 2) {
        this.enemyFactory.spawnEnemy();
      }
    }, 26000);
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const rawDt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;

    const dt = rawDt * this.timeSpeed();
    const nowSeconds = now / 1000;

    // Process WASD Planetary Orbit Navigation
    this.processKeyboardNavigation(rawDt);

    // Smooth camera spherical orbit interpolation
    this.cameraSpherical.theta += (this.targetSpherical.theta - this.cameraSpherical.theta) * 0.12;
    this.cameraSpherical.phi += (this.targetSpherical.phi - this.cameraSpherical.phi) * 0.12;
    this.cameraSpherical.radius +=
      (this.targetSpherical.radius - this.cameraSpherical.radius) * 0.12;
    this.updateCameraTransform();

    // Advance 3D World Subsystems
    this.terrainFactory.setHillLevel(this.colonyEngine.getHillLevel());
    this.terrainFactory.update(nowSeconds);
    this.fruitFactory.update(nowSeconds);

    this.enemyFactory.update(
      dt,
      this.fruitFactory.getActiveFruits(),
      (fruit) => {
        // Enemy devours a fruit chunk!
        this.fruitFactory.harvestChunk(fruit);
        this.audioService.playChime(1, 0.22);
      },
      this.camera.position,
    );

    this.colonyEngine.update(
      dt,
      () => {
        // Food deposited in hill
        this.syncCounts();
        this.audioService.playChime(Math.floor(Math.random() * 5) + 3, 0.25);
      },
      () => {
        // Enemy defeated
        this.syncCounts();
        this.audioService.playChime(7, 0.35);
      },
      () => {
        // Ant bite / harvest nibble
        this.audioService.playWaterdropToneOn(0.12);
      },
    );

    this.syncCounts();
    this.renderer.render(this.scene, this.camera);
  };

  /**
   * WASD / Arrow Keys smoothly orbit the camera over the spherical planet's latitude (phi) and longitude (theta).
   */
  private processKeyboardNavigation(dt: number): void {
    const angularSpeed = 1.45 * dt;

    if (this.activeKeys['w'] || this.activeKeys['arrowup']) {
      this.targetSpherical.phi = Math.max(0.12, this.targetSpherical.phi - angularSpeed);
    }
    if (this.activeKeys['s'] || this.activeKeys['arrowdown']) {
      this.targetSpherical.phi = Math.min(Math.PI - 0.2, this.targetSpherical.phi + angularSpeed);
    }
    if (this.activeKeys['a'] || this.activeKeys['arrowleft']) {
      this.targetSpherical.theta += angularSpeed;
    }
    if (this.activeKeys['d'] || this.activeKeys['arrowright']) {
      this.targetSpherical.theta -= angularSpeed;
    }
  }

  private syncCounts(): void {
    this.antCount.set(this.colonyEngine.getAntCount());
    this.foodStock.set(this.colonyEngine.getFoodStock());
    this.hillLevel.set(this.colonyEngine.getHillLevel());
    this.defeatedEnemies.set(this.colonyEngine.getDefeatedEnemies());
  }

  // ---------------------------------------------------------------------------
  // User Actions (Dock & Controls)
  // ---------------------------------------------------------------------------

  onSpawnFruit(): void {
    this.fruitFactory.spawnFruit();
    this.audioService.playChime(5, 0.28);
  }

  onAlarmSwarm(): void {
    this.colonyEngine.alarmAllAnts();
    this.audioService.playChime(2, 0.35);
  }

  setTimeSpeed(speed: number): void {
    this.timeSpeed.set(speed);
    this.audioService.playChime(speed > 1 ? 6 : 4, 0.18);
  }

  resetCameraView(): void {
    this.targetSpherical.radius = 52.0;
    this.targetSpherical.theta = Math.PI / 4;
    this.targetSpherical.phi = Math.PI / 3.2;
  }

  resetColony(): void {
    this.fruitFactory.dispose();
    this.enemyFactory.dispose();
    this.colonyEngine.resetColony();
    this.initStarterScene();
    this.syncCounts();
    this.audioService.playChime(0, 0.28);
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
  // Mouse & Pointer Interaction
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
      }
    }

    if (!this.isPointerDown) return;

    if (
      Math.hypot(event.clientX - this.pointerInitialX, event.clientY - this.pointerInitialY) > 5
    ) {
      this.pointerMoved = true;
    }

    const deltaX = event.clientX - this.pointerStartX;
    const deltaY = event.clientY - this.pointerStartY;

    const rotSpeed = 0.007;
    // Inverted so dragging follows the hand directly (spinning the 3D globe)
    this.targetSpherical.theta += deltaX * rotSpeed;
    this.targetSpherical.phi = Math.max(
      0.12,
      Math.min(Math.PI - 0.12, this.targetSpherical.phi + deltaY * rotSpeed),
    );

    this.pointerStartX = event.clientX;
    this.pointerStartY = event.clientY;
  }

  onPointerUp(event?: PointerEvent): void {
    if (!this.pointerMoved && event) {
      // Clean click: Perform Raycast against Fruits and Enemies
      this.raycaster.setFromCamera(this.mouseNDC, this.camera);

      // 1. Check Enemies first (Combat click)
      const enemyHits = this.raycaster.intersectObjects(
        this.enemyFactory.getGroup().children,
        true,
      );
      if (enemyHits.length > 0) {
        let parent: THREE.Object3D | null = enemyHits[0].object;
        while (parent && !parent.userData['isEnemy']) {
          parent = parent.parent;
        }
        if (parent && parent.userData['enemyId']) {
          this.colonyEngine.orderAttackEnemy(parent.userData['enemyId']);
          this.audioService.playChime(6, 0.32);
          this.isPointerDown = false;
          return;
        }
      }

      // 2. Check Fruits (Harvest click)
      const fruitHits = this.raycaster.intersectObjects(
        this.fruitFactory.getGroup().children,
        true,
      );
      if (fruitHits.length > 0) {
        let parent: THREE.Object3D | null = fruitHits[0].object;
        while (parent && !parent.userData['isFruit']) {
          parent = parent.parent;
        }
        if (parent && parent.userData['fruitId']) {
          this.colonyEngine.orderHarvestFruit(parent.userData['fruitId']);
          this.audioService.playWaterdropToneOn(0.35);
          this.isPointerDown = false;
          return;
        }
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
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomFactor = Math.pow(1.0016, event.deltaY);
    this.targetSpherical.radius = Math.max(
      38.0,
      Math.min(110.0, this.targetSpherical.radius * zoomFactor),
    );
  }

  onDoubleClick(): void {
    this.resetCameraView();
  }

  private updateCameraTransform(): void {
    const { radius, theta, phi } = this.cameraSpherical;
    const focusY = Math.max(0, (1.0 - (radius - 38.0) / 72.0) * 10.0 * Math.max(0, Math.cos(phi)));
    this.cameraTarget.set(0, focusY, 0);

    this.camera.position.x = radius * Math.sin(phi) * Math.cos(theta);
    this.camera.position.y = radius * Math.cos(phi);
    this.camera.position.z = radius * Math.sin(phi) * Math.sin(theta);
    this.camera.lookAt(this.cameraTarget);
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
