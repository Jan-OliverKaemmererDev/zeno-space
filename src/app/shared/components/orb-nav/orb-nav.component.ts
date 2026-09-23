import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  input,
  output,
  inject,
  NgZone,
  effect,
  signal,
  AfterViewInit,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { AudioService } from '../../../core/services/audio.service';

export interface NavSection {
  id: string;
  label: string;
}

export interface OrbClickSpark {
  id: number;
  orbIndex: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  size: number;
}

export interface TooltipLetter {
  char: string;
  fromRight: number;
}

interface ParticleOrbData {
  group: THREE.Group;
  tumbleGroup: THREE.Group;
  pointsMesh: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  earthSpinSpeed: number;
  clickSpinSpeed: number;
  baseY: number;
  floatSpeed: number;
  floatPhase: number;
  basePositions: Float32Array;
  currentPositions: Float32Array;
  velocities: Float32Array;
  hasDisplaced: boolean;
}

@Component({
  selector: 'app-orb-nav',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orb-nav.component.html',
  styleUrl: './orb-nav.component.scss',
})
export class OrbNavComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly ngZone = inject(NgZone);
  private readonly audioService = inject(AudioService);

  readonly activeIndex = input<number>(0);
  readonly sections = input<NavSection[]>([
    { id: 'hero', label: 'Kosmos' },
    { id: 'bubble-hub', label: 'Welten' },
    { id: 'sanctuary', label: 'Zuflucht' },
  ]);

  readonly sectionSelect = output<number>();

  // Exact projected screen-Y center coordinates for orbs (height = 260px)
  readonly orbCenterY = [49, 130, 211];

  // Subtle click sparks shooting out from clicked orb
  readonly activeSparks = signal<OrbClickSpark[]>([]);
  private sparkIdCounter = 0;

  @ViewChild('orbCanvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  // Three.js Core
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private animFrameId: number | null = null;
  private isDestroyed = false;

  // Interaction
  private raycaster = new THREE.Raycaster();
  private mouseNDC = new THREE.Vector2(-999, -999);
  private mouseWorldPos = new THREE.Vector3(-999, -999, -999);
  private isPointerOver = false;
  private readonly zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private hoveredOrbIndex: number | null = null;
  readonly activeHoverIndex = signal<number | null>(null);
  private readonly tooltipLettersCache = new Map<string, TooltipLetter[]>();

  // 3D Pixel Orbs
  private orbs: ParticleOrbData[] = [];
  private readonly ORB_COUNT = 3;
  private readonly ORB_RADIUS = 0.23; // Compact, refined smaller orb size
  private readonly PARTICLE_COUNT = 160; // Delicate micro-particle density
  // Opposite diagonal spin axis (sloping down-left into the scene)
  private readonly diagonalSpinAxis = new THREE.Vector3(0.70, -1.0, 0.25).normalize();
  private previousActiveIndex = 0;

  // Idle detection & resource saving
  readonly isIdle = signal<boolean>(false);
  readonly isWaking = signal<boolean>(false);
  private hasInitialEntranceEnded = false;
  private isRenderLoopRunning = false;
  private idleTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pauseRenderTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private initialEntranceTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly IDLE_DELAY_MS = 5000;
  private readonly FADE_DURATION_MS = 900;

  constructor() {
    effect(() => {
      const current = this.activeIndex();
      // Animate active orb with appropriate direction on section change
      if (current !== this.previousActiveIndex && current >= 0 && current < this.orbs.length) {
        const speed = current > this.previousActiveIndex ? 12.5 : -12.5;
        this.triggerSpinBurst(current, speed);
      }
      this.previousActiveIndex = current;
    });
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.initThree();
      this.resumeRenderLoop();
      this.setupIdleDetection();
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.pauseRenderLoop();
    this.cleanupIdleDetection();
    this.disposeThree();
  }

  // ----------------------------------------------------
  // 1. Three.js Initialization (Pure White Pixel Particles)
  // ----------------------------------------------------
  private initThree(): void {
    const canvas = this.canvasRef.nativeElement;
    const width = 76;
    const height = 260;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 4.3);

    // 3 Orbs (Kosmos, Welten, Zuflucht)
    const yOffsets = [0.92, 0.0, -0.92];
    const floatSpeeds = [0.95, 1.12, 0.88];
    const floatPhases = [0.0, 1.9, 3.7];

    for (let k = 0; k < this.ORB_COUNT; k++) {
      const orb = this.createPixelOrb(yOffsets[k], floatSpeeds[k], floatPhases[k]);
      this.orbs.push(orb);
      this.scene.add(orb.group);
    }
  }

  private createPixelOrb(baseY: number, floatSpeed: number, floatPhase: number): ParticleOrbData {
    const group = new THREE.Group();
    group.position.set(0, baseY, 0);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.PARTICLE_COUNT * 3);
    const sizes = new Float32Array(this.PARTICLE_COUNT);
    const twinklePhases = new Float32Array(this.PARTICLE_COUNT);
    const twinkleSpeeds = new Float32Array(this.PARTICLE_COUNT);
    const colors = new Float32Array(this.PARTICLE_COUNT * 3);

    const phi = (1 + Math.sqrt(5)) / 2; // Golden Ratio Fibonacci distribution

    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
      const theta = (2 * Math.PI * i) / phi;
      const y = 1 - (i / (this.PARTICLE_COUNT - 1)) * 2;
      const rAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const x = Math.cos(theta) * rAtY;
      const z = Math.sin(theta) * rAtY;

      // Subtle radial depth variance (+- 3%)
      const rJitter = 1.0 + (Math.random() - 0.5) * 0.06;
      const px = x * this.ORB_RADIUS * rJitter;
      const py = y * this.ORB_RADIUS * rJitter;
      const pz = z * this.ORB_RADIUS * rJitter;

      const idx = i * 3;
      positions[idx] = px;
      positions[idx + 1] = py;
      positions[idx + 2] = pz;

      // Tiny, delicate micro-particles: 0.95px to 1.8px
      sizes[i] = 0.95 + Math.random() * 0.85;

      // Rare and slow twinkle parameters
      twinklePhases[i] = Math.random() * Math.PI * 2;
      twinkleSpeeds[i] = 0.35 + Math.random() * 0.55;

      // Some particles light blue (~30%), majority crisp pure white (~70%)
      const isLightBlue = Math.random() < 0.30;
      if (isLightBlue) {
        // Celestial light blue (#7dd3fc)
        colors[idx] = 0.49;
        colors[idx + 1] = 0.83;
        colors[idx + 2] = 0.99;
      } else {
        // Crisp pure white
        colors[idx] = 1.0;
        colors[idx + 1] = 1.0;
        colors[idx + 2] = 1.0;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aTwinklePhase', new THREE.BufferAttribute(twinklePhases, 1));
    geometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));
    geometry.setAttribute('aBaseColor', new THREE.BufferAttribute(colors, 3));

    // Custom Shader: White & light blue micro-pixels, rare gentle twinkling
    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uActiveBoost: { value: 0.0 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uActiveBoost;
        attribute float aSize;
        attribute float aTwinklePhase;
        attribute float aTwinkleSpeed;
        attribute vec3 aBaseColor;

        varying vec3 vColor;
        varying float vSparkle;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

          // Rare & gentle twinkle
          float twWave = sin(uTime * aTwinkleSpeed + aTwinklePhase);
          float sparkle = smoothstep(0.92, 0.995, twWave);
          vSparkle = sparkle;

          // Base color with bright flash towards white during sparkle
          vColor = mix(aBaseColor, vec3(1.0), sparkle * 0.55);

          // Subtle size expansion (+25% during gentle twinkle)
          float finalSize = aSize * (1.0 + sparkle * 0.28 + uActiveBoost * 0.15);

          // Scaled for crisp micro-pixels (around 1.2 - 2.0px on screen)
          gl_PointSize = finalSize * (4.3 / -mvPosition.z) * 1.05;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uActiveBoost;
        varying vec3 vColor;
        varying float vSparkle;

        void main() {
          // Sharp square micro-pixel
          vec2 coord = abs(gl_PointCoord - 0.5) * 2.0;
          float maxCoord = max(coord.x, coord.y);
          if (maxCoord > 0.92) discard;

          // Opacity: 0.78 base, boosted when active & sparkling
          float baseAlpha = 0.78 + uActiveBoost * 0.16;
          float alpha = baseAlpha + vSparkle * 0.20;

          // Gentle luminance lift for active orb
          vec3 finalColor = vColor + vec3(0.06, 0.10, 0.14) * uActiveBoost;
          gl_FragColor = vec4(finalColor, min(1.0, alpha));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    const tumbleGroup = new THREE.Group();
    group.add(tumbleGroup);

    const pointsMesh = new THREE.Points(geometry, shaderMaterial);
    
    // Subtle Earth-like axial tilt (~22 degrees)
    pointsMesh.rotation.z = 0.38;

    tumbleGroup.add(pointsMesh);

    const basePositions = new Float32Array(this.PARTICLE_COUNT * 3);
    basePositions.set(positions);
    const velocities = new Float32Array(this.PARTICLE_COUNT * 3);

    return {
      group,
      tumbleGroup,
      pointsMesh,
      earthSpinSpeed: 0.11, // Very slow, majestic rotation like planet Earth
      clickSpinSpeed: 0.0,
      baseY,
      floatSpeed,
      floatPhase,
      basePositions,
      currentPositions: positions,
      velocities,
      hasDisplaced: false,
    };
  }

  // ----------------------------------------------------
  // 2. Render & Physics Loop (with resource-saving pause)
  // ----------------------------------------------------
  private startRenderLoop(): void {
    let lastTime = performance.now();

    const animate = (time: number) => {
      if (this.isDestroyed || !this.isRenderLoopRunning) return;

      const dt = Math.min(0.1, (time - lastTime) / 1000.0);
      lastTime = time;

      this.updatePhysicsAndAnimation(time * 0.001, dt);

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }

      this.animFrameId = requestAnimationFrame(animate);
    };

    this.animFrameId = requestAnimationFrame(animate);
  }

  private resumeRenderLoop(): void {
    if (this.isDestroyed || this.isRenderLoopRunning) return;
    this.isRenderLoopRunning = true;
    this.startRenderLoop();
  }

  private pauseRenderLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.isRenderLoopRunning = false;
  }

  private updatePhysicsAndAnimation(sec: number, dt: number): void {
    if (!this.camera) return;

    for (let k = 0; k < this.orbs.length; k++) {
      const orb = this.orbs[k];

      // A. Independent Gentle Vertical Float
      const floatY = Math.sin(sec * orb.floatSpeed + orb.floatPhase) * 0.034;
      orb.group.position.y = orb.baseY + floatY;

      // B. Earth-like slow rotation around itself (polar axis Y)
      orb.pointsMesh.rotation.y += orb.earthSpinSpeed * dt;

      // C. Click Spin: Diagonal tumble around fixed screen axis, decaying smoothly back to 0
      if (Math.abs(orb.clickSpinSpeed) > 0.01) {
        orb.tumbleGroup.rotateOnAxis(this.diagonalSpinAxis, orb.clickSpinSpeed * dt);
        orb.clickSpinSpeed += (0.0 - orb.clickSpinSpeed) * Math.min(1.0, dt * 2.2);
      }

      // D. Interactive Particle Evade & Spring-Back Return
      let isNearThisOrb = false;
      const localMouse = this.mouseWorldPos.clone();
      orb.pointsMesh.updateWorldMatrix(true, false);
      orb.pointsMesh.worldToLocal(localMouse);

      // Check distance from cursor to orb center
      if (this.isPointerOver && localMouse.length() < this.ORB_RADIUS * 2.2) {
        isNearThisOrb = true;
      }

      // Repulsion radius: balanced sweet spot (~0.195 units, ~85% of orb radius)
      const repelRadius = this.ORB_RADIUS * 0.85;
      const repelRadiusSq = repelRadius * repelRadius;
      const dtClamped = Math.min(0.04, dt);
      let needsGeoUpdate = false;

      for (let i = 0; i < this.PARTICLE_COUNT; i++) {
        const idx = i * 3;
        const bx = orb.basePositions[idx];
        const by = orb.basePositions[idx + 1];
        const bz = orb.basePositions[idx + 2];

        let cx = orb.currentPositions[idx];
        let cy = orb.currentPositions[idx + 1];
        let cz = orb.currentPositions[idx + 2];

        let vx = orb.velocities[idx];
        let vy = orb.velocities[idx + 1];
        let vz = orb.velocities[idx + 2];

        // 1. Hooke's Law Spring Force: snappy yet smooth elastic return
        // k = 35.0 (lively spring return), c = 6.8 (controlled damping)
        let fx = (bx - cx) * 35.0 - vx * 6.8;
        let fy = (by - cy) * 35.0 - vy * 6.8;
        let fz = (bz - cz) * 35.0 - vz * 6.8;

        // 2. Mouse Repulsion Force: clearly visible, organic dodge
        if (isNearThisOrb) {
          const dx = cx - localMouse.x;
          const dy = cy - localMouse.y;
          const d2DSq = dx * dx + dy * dy;
          if (d2DSq < repelRadiusSq) {
            const d2D = Math.sqrt(d2DSq);
            const factor = Math.max(0.0, 1.0 - d2D / repelRadius);
            // Balanced push force: expressive and noticeable without chaotic explosion
            const push = factor * factor * 14.5;
            const invD = 1.0 / (d2D + 0.005);
            fx += dx * invD * push;
            fy += dy * invD * push;
            fz += (cz >= 0 ? 1.0 : -1.0) * push * 0.32;
          }
        }

        // 3. Semi-implicit Euler integration
        vx += fx * dtClamped;
        vy += fy * dtClamped;
        vz += fz * dtClamped;

        vx *= 0.982;
        vy *= 0.982;
        vz *= 0.982;

        cx += vx * dtClamped;
        cy += vy * dtClamped;
        cz += vz * dtClamped;

        // Harmonic displacement clamp (~0.095 units: allows expressive 5-6px dodge)
        const diffX = cx - bx;
        const diffY = cy - by;
        const diffZ = cz - bz;
        const diffSq = diffX * diffX + diffY * diffY + diffZ * diffZ;
        const maxDisp = 0.095;
        if (diffSq > maxDisp * maxDisp) {
          const diffLen = Math.sqrt(diffSq);
          const ratio = maxDisp / diffLen;
          cx = bx + diffX * ratio;
          cy = by + diffY * ratio;
          cz = bz + diffZ * ratio;
        }

        orb.velocities[idx] = vx;
        orb.velocities[idx + 1] = vy;
        orb.velocities[idx + 2] = vz;

        orb.currentPositions[idx] = cx;
        orb.currentPositions[idx + 1] = cy;
        orb.currentPositions[idx + 2] = cz;

        const distFromBase = Math.abs(cx - bx) + Math.abs(cy - by) + Math.abs(cz - bz);
        if (distFromBase > 0.0006 || Math.abs(vx) > 0.0006) {
          needsGeoUpdate = true;
        }
      }

      if (needsGeoUpdate || orb.hasDisplaced) {
        orb.pointsMesh.geometry.attributes['position'].needsUpdate = true;
        orb.hasDisplaced = needsGeoUpdate;
      }

      // Update shader uniform time for gentle, rare twinkles
      orb.pointsMesh.material.uniforms['uTime'].value = sec;
      const isCurrentActive = this.activeIndex() === k;
      orb.pointsMesh.material.uniforms['uActiveBoost'].value = isCurrentActive ? 1.0 : 0.0;
    }
  }

  // ----------------------------------------------------
  // 3. Pointer & Interaction Handlers
  // ----------------------------------------------------
  onPointerMove(event: PointerEvent): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();

    this.mouseNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNDC.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

    if (!this.camera) return;
    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    this.raycaster.ray.intersectPlane(this.zPlane, this.mouseWorldPos);
    this.isPointerOver = true;
    this.audioService.warmupAudio();

    let nearestIdx: number | null = null;
    let minDistance = Infinity;

    for (let k = 0; k < this.orbs.length; k++) {
      const orb = this.orbs[k];
      const sphereWorldCenter = new THREE.Vector3();
      orb.group.getWorldPosition(sphereWorldCenter);
      const collisionSphere = new THREE.Sphere(sphereWorldCenter, this.ORB_RADIUS * 1.35);

      if (this.raycaster.ray.intersectSphere(collisionSphere, new THREE.Vector3())) {
        const d = this.raycaster.ray.distanceToPoint(sphereWorldCenter);
        if (d < minDistance) {
          minDistance = d;
          nearestIdx = k;
        }
      }
    }

    if (this.hoveredOrbIndex !== nearestIdx) {
      this.hoveredOrbIndex = nearestIdx;
      this.activeHoverIndex.set(nearestIdx);
    }
  }

  onPointerLeave(): void {
    this.isPointerOver = false;
    this.mouseNDC.set(-999, -999);
    this.mouseWorldPos.set(-999, -999, -999);
    this.hoveredOrbIndex = null;
    this.activeHoverIndex.set(null);
  }

  getTooltipLetters(label: string): TooltipLetter[] {
    let cached = this.tooltipLettersCache.get(label);
    if (!cached) {
      const chars = Array.from(label);
      const total = chars.length;
      cached = chars.map((char, index) => ({
        char,
        fromRight: total - 1 - index,
      }));
      this.tooltipLettersCache.set(label, cached);
    }
    return cached;
  }

  onOrbPointerDown(): void {
    this.audioService.warmupAudio();
  }

  @HostListener('window:wheel', ['$event'])
  onWindowWheel(event: WheelEvent): void {
    if (Math.abs(event.deltaY) > 6) {
      const idx = this.activeIndex();
      if (idx >= 0 && idx < this.orbs.length) {
        const orb = this.orbs[idx];
        if (orb) {
          for (let k = 0; k < this.orbs.length; k++) {
            if (k !== idx) this.orbs[k].clickSpinSpeed = 0.0;
          }
          if (event.deltaY > 0) {
            // Scroll down: spin downwards
            orb.clickSpinSpeed = Math.max(orb.clickSpinSpeed, 9.5);
          } else {
            // Scroll up: spin upwards
            orb.clickSpinSpeed = Math.min(orb.clickSpinSpeed, -9.5);
          }
        }
      }
    }
  }

  onOrbClick(index: number): void {
    const current = this.activeIndex();
    const speed = index >= current ? 12.5 : -12.5;
    this.previousActiveIndex = index;
    // Trigger spin immediately without waiting for scroll completion
    this.triggerSpinBurst(index, speed);
    this.spawnClickSparks(index);
    // Play particle-orb-scroll sound directly and without delay
    this.audioService.playParticleOrbScroll();
    this.sectionSelect.emit(index);
  }

  private spawnClickSparks(orbIndex: number): void {
    const count = Math.random() < 0.5 ? 2 : 3; // 2 or 3 micro-pixels
    const newSparks: OrbClickSpark[] = [];
    const baseAngle = Math.random() * Math.PI * 2;

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i * (Math.PI * 2 / count)) + (Math.random() - 0.5) * 0.5;
      const startDist = 14 + Math.random() * 4; // Start near sphere edge
      const endDist = startDist + 14 + Math.random() * 12; // Shoot outward ~14-26px
      const isBlue = Math.random() < 0.45;

      newSparks.push({
        id: ++this.sparkIdCounter,
        orbIndex,
        startX: Math.round(Math.cos(angle) * startDist * 10) / 10,
        startY: Math.round(Math.sin(angle) * startDist * 10) / 10,
        endX: Math.round(Math.cos(angle) * endDist * 10) / 10,
        endY: Math.round(Math.sin(angle) * endDist * 10) / 10,
        color: isBlue ? '#7dd3fc' : '#ffffff',
        size: Math.random() < 0.5 ? 2 : 1.5,
      });
    }

    this.activeSparks.update((sparks) => [...sparks, ...newSparks]);

    // Extinguish & remove after animation completes (650ms)
    setTimeout(() => {
      const idsToRemove = new Set(newSparks.map((s) => s.id));
      this.activeSparks.update((sparks) => sparks.filter((s) => !idsToRemove.has(s.id)));
    }, 650);
  }

  getSparksForOrb(orbIndex: number): OrbClickSpark[] {
    return this.activeSparks().filter((s) => s.orbIndex === orbIndex);
  }

  private triggerSpinBurst(index: number, speed = 12.5): void {
    if (index < 0 || index >= this.orbs.length) return;
    // Exclusively spin ONLY the targeted orb
    for (let k = 0; k < this.orbs.length; k++) {
      if (k !== index) {
        this.orbs[k].clickSpinSpeed = 0.0;
      }
    }
    this.orbs[index].clickSpinSpeed = speed;
  }

  private disposeThree(): void {
    this.orbs.forEach((orb) => {
      orb.pointsMesh.geometry.dispose();
      (orb.pointsMesh.material as THREE.Material).dispose();
    });

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }

  // ----------------------------------------------------
  // 3. 5-Second Idle Detection (Fade-out & Resource Savings)
  // ----------------------------------------------------
  private readonly onUserActivity = (): void => {
    this.handleActivity();
  };

  private setupIdleDetection(): void {
    if (typeof window === 'undefined') return;

    // Listen to user activity outside Angular to avoid CD thrashing
    window.addEventListener('pointermove', this.onUserActivity, { passive: true });
    window.addEventListener('scroll', this.onUserActivity, { passive: true });
    window.addEventListener('wheel', this.onUserActivity, { passive: true });
    window.addEventListener('touchstart', this.onUserActivity, { passive: true });
    window.addEventListener('keydown', this.onUserActivity, { passive: true });

    // Wait until the initial 3.25s + 1.1s entrance animation is completed
    this.initialEntranceTimeoutId = setTimeout(() => {
      this.hasInitialEntranceEnded = true;
      this.resetIdleTimer();
    }, 4400);
  }

  private cleanupIdleDetection(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('pointermove', this.onUserActivity);
    window.removeEventListener('scroll', this.onUserActivity);
    window.removeEventListener('wheel', this.onUserActivity);
    window.removeEventListener('touchstart', this.onUserActivity);
    window.removeEventListener('keydown', this.onUserActivity);

    if (this.initialEntranceTimeoutId !== null) {
      clearTimeout(this.initialEntranceTimeoutId);
      this.initialEntranceTimeoutId = null;
    }
    if (this.idleTimeoutId !== null) {
      clearTimeout(this.idleTimeoutId);
      this.idleTimeoutId = null;
    }
    if (this.pauseRenderTimeoutId !== null) {
      clearTimeout(this.pauseRenderTimeoutId);
      this.pauseRenderTimeoutId = null;
    }
  }

  private handleActivity(): void {
    // Cancel scheduled render pause if user interacted during fade
    if (this.pauseRenderTimeoutId !== null) {
      clearTimeout(this.pauseRenderTimeoutId);
      this.pauseRenderTimeoutId = null;
    }

    // Wake up if currently idle
    if (this.isIdle()) {
      this.ngZone.run(() => {
        this.isIdle.set(false);
        this.isWaking.set(true);
      });
      this.resumeRenderLoop();
    }

    this.resetIdleTimer();
  }

  private resetIdleTimer(): void {
    if (this.idleTimeoutId !== null) {
      clearTimeout(this.idleTimeoutId);
    }

    this.idleTimeoutId = setTimeout(() => {
      if (!this.hasInitialEntranceEnded || this.isDestroyed) return;

      this.ngZone.run(() => {
        this.isIdle.set(true);
        this.isWaking.set(false);
      });

      // Pause WebGL rendering once the fade-out transition has completely finished
      this.pauseRenderTimeoutId = setTimeout(() => {
        if (this.isIdle() && !this.isDestroyed) {
          this.pauseRenderLoop();
        }
      }, this.FADE_DURATION_MS);
    }, this.IDLE_DELAY_MS);
  }
}
