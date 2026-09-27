import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
  input,
  output,
  effect,
  AfterViewInit,
} from '@angular/core';
import * as THREE from 'three';
import { ParticleOrbData } from '../../orb-nav.models';

/**
 * Three.js 3D WebGL Canvas component responsible for rendering and simulating
 * the interactive particle spheres, Fibonacci distributions, GLSL shaders,
 * Hooke's law physics, mouse repulsion, and diagonal tumble spin.
 */
@Component({
  selector: 'app-orb-canvas',
  standalone: true,
  templateUrl: './orb-canvas.component.html',
  styleUrl: './orb-canvas.component.scss',
})
export class OrbCanvasComponent implements AfterViewInit, OnDestroy {
  private readonly ngZone = inject(NgZone);

  /** Currently active section index. */
  readonly activeIndex = input<number>(0);

  /** Whether the parent navigation widget is currently idle. */
  readonly isIdle = input<boolean>(false);

  /** Emitted when the cursor hovers over or leaves an orb sphere. */
  readonly hoveredOrbChange = output<number | null>();

  @ViewChild('orbCanvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  // Three.js Core
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private animFrameId: number | null = null;
  private isDestroyed = false;
  private isRenderLoopRunning = false;

  // Interaction
  private raycaster = new THREE.Raycaster();
  private mouseNDC = new THREE.Vector2(-999, -999);
  private mouseWorldPos = new THREE.Vector3(-999, -999, -999);
  private isPointerOver = false;
  private readonly zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private hoveredOrbIndex: number | null = null;

  // 3D Pixel Orbs
  private orbs: ParticleOrbData[] = [];
  private readonly ORB_COUNT = 3;
  private readonly ORB_RADIUS = 0.23;
  private readonly PARTICLE_COUNT = 160;
  private readonly diagonalSpinAxis = new THREE.Vector3(0.70, -1.0, 0.25).normalize();
  private previousActiveIndex = 0;

  constructor() {
    // Animate active orb with appropriate direction on section change
    effect(() => {
      const current = this.activeIndex();
      if (current !== this.previousActiveIndex && current >= 0 && current < this.orbs.length) {
        const speed = current > this.previousActiveIndex ? 12.5 : -12.5;
        this.triggerSpinBurst(current, speed);
      }
      this.previousActiveIndex = current;
    });
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.initThree();
      this.resumeRenderLoop();
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.pauseRenderLoop();
    this.disposeThree();
  }

  /**
   * Initializes Three.js WebGL renderer, perspective camera, scene, and orbs.
   */
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

  /**
   * Constructs an individual 3D particle sphere populated with Fibonacci-distributed micro-points.
   */
  private createPixelOrb(baseY: number, floatSpeed: number, floatPhase: number): ParticleOrbData {
    const group = new THREE.Group();
    group.position.set(0, baseY, 0);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.PARTICLE_COUNT * 3);
    const sizes = new Float32Array(this.PARTICLE_COUNT);
    const twinklePhases = new Float32Array(this.PARTICLE_COUNT);
    const twinkleSpeeds = new Float32Array(this.PARTICLE_COUNT);
    const colors = new Float32Array(this.PARTICLE_COUNT * 3);

    const phi = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
      const theta = (2 * Math.PI * i) / phi;
      const y = 1 - (i / (this.PARTICLE_COUNT - 1)) * 2;
      const rAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const x = Math.cos(theta) * rAtY;
      const z = Math.sin(theta) * rAtY;

      const rJitter = 1.0 + (Math.random() - 0.5) * 0.06;
      const px = x * this.ORB_RADIUS * rJitter;
      const py = y * this.ORB_RADIUS * rJitter;
      const pz = z * this.ORB_RADIUS * rJitter;

      const idx = i * 3;
      positions[idx] = px;
      positions[idx + 1] = py;
      positions[idx + 2] = pz;

      sizes[i] = 0.95 + Math.random() * 0.85;
      twinklePhases[i] = Math.random() * Math.PI * 2;
      twinkleSpeeds[i] = 0.35 + Math.random() * 0.55;

      const isLightBlue = Math.random() < 0.30;
      if (isLightBlue) {
        colors[idx] = 0.49;
        colors[idx + 1] = 0.83;
        colors[idx + 2] = 0.99;
      } else {
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
          float twWave = sin(uTime * aTwinkleSpeed + aTwinklePhase);
          float sparkle = smoothstep(0.92, 0.995, twWave);
          vSparkle = sparkle;
          vColor = mix(aBaseColor, vec3(1.0), sparkle * 0.55);
          float finalSize = aSize * (1.0 + sparkle * 0.28 + uActiveBoost * 0.15);
          gl_PointSize = finalSize * (4.3 / -mvPosition.z) * 1.05;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uActiveBoost;
        varying vec3 vColor;
        varying float vSparkle;

        void main() {
          vec2 coord = abs(gl_PointCoord - 0.5) * 2.0;
          float maxCoord = max(coord.x, coord.y);
          if (maxCoord > 0.92) discard;

          float baseAlpha = 0.78 + uActiveBoost * 0.16;
          float alpha = baseAlpha + vSparkle * 0.20;
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
    pointsMesh.rotation.z = 0.38;
    tumbleGroup.add(pointsMesh);

    const basePositions = new Float32Array(this.PARTICLE_COUNT * 3);
    basePositions.set(positions);
    const velocities = new Float32Array(this.PARTICLE_COUNT * 3);

    return {
      group,
      tumbleGroup,
      pointsMesh,
      earthSpinSpeed: 0.11,
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

  /**
   * Starts the animation frame render loop.
   */
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

  /**
   * Resumes the WebGL render loop.
   */
  resumeRenderLoop(): void {
    if (this.isDestroyed || this.isRenderLoopRunning) return;
    this.isRenderLoopRunning = true;
    this.startRenderLoop();
  }

  /**
   * Pauses the WebGL render loop to save CPU and GPU resources.
   */
  pauseRenderLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.isRenderLoopRunning = false;
  }

  /**
   * Computes Hooke's law spring forces, mouse repulsion, and rotational physics.
   */
  private updatePhysicsAndAnimation(sec: number, dt: number): void {
    if (!this.camera) return;

    for (let k = 0; k < this.orbs.length; k++) {
      const orb = this.orbs[k];

      // A. Independent Gentle Vertical Float
      const floatY = Math.sin(sec * orb.floatSpeed + orb.floatPhase) * 0.034;
      orb.group.position.y = orb.baseY + floatY;

      // B. Earth-like slow rotation around polar axis Y
      orb.pointsMesh.rotation.y += orb.earthSpinSpeed * dt;

      // C. Click Spin: Diagonal tumble around fixed screen axis
      if (Math.abs(orb.clickSpinSpeed) > 0.01) {
        orb.tumbleGroup.rotateOnAxis(this.diagonalSpinAxis, orb.clickSpinSpeed * dt);
        orb.clickSpinSpeed += (0.0 - orb.clickSpinSpeed) * Math.min(1.0, dt * 2.2);
      }

      // D. Interactive Particle Evade & Spring-Back Return
      let isNearThisOrb = false;
      const localMouse = this.mouseWorldPos.clone();
      orb.pointsMesh.updateWorldMatrix(true, false);
      orb.pointsMesh.worldToLocal(localMouse);

      if (this.isPointerOver && localMouse.length() < this.ORB_RADIUS * 2.2) {
        isNearThisOrb = true;
      }

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

        // 1. Hooke's Law Spring Force
        let fx = (bx - cx) * 35.0 - vx * 6.8;
        let fy = (by - cy) * 35.0 - vy * 6.8;
        let fz = (bz - cz) * 35.0 - vz * 6.8;

        // 2. Mouse Repulsion Force
        if (isNearThisOrb) {
          const dx = cx - localMouse.x;
          const dy = cy - localMouse.y;
          const d2DSq = dx * dx + dy * dy;
          if (d2DSq < repelRadiusSq) {
            const d2D = Math.sqrt(d2DSq);
            const factor = Math.max(0.0, 1.0 - d2D / repelRadius);
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

        // Harmonic displacement clamp (~0.095 units: allows 5-6px dodge)
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

      orb.pointsMesh.material.uniforms['uTime'].value = sec;
      const isCurrentActive = this.activeIndex() === k;
      orb.pointsMesh.material.uniforms['uActiveBoost'].value = isCurrentActive ? 1.0 : 0.0;
    }
  }

  /**
   * Projects pointer screen coordinates into 3D world space and calculates raycast collisions.
   *
   * @param {PointerEvent} event - The pointer move event.
   */
  handlePointerMove(event: PointerEvent): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();

    this.mouseNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNDC.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

    if (!this.camera) return;
    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    this.raycaster.ray.intersectPlane(this.zPlane, this.mouseWorldPos);
    this.isPointerOver = true;

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
      this.hoveredOrbChange.emit(nearestIdx);
    }
  }

  /**
   * Resets pointer position and raycaster collision targets when cursor leaves.
   */
  handlePointerLeave(): void {
    this.isPointerOver = false;
    this.mouseNDC.set(-999, -999);
    this.mouseWorldPos.set(-999, -999, -999);
    this.hoveredOrbIndex = null;
    this.hoveredOrbChange.emit(null);
  }

  /**
   * Imparts rotational impulse on active orb from mouse wheel events.
   *
   * @param {number} deltaY - Wheel scroll delta value.
   */
  applyWheelSpin(deltaY: number): void {
    if (Math.abs(deltaY) > 6) {
      const idx = this.activeIndex();
      if (idx >= 0 && idx < this.orbs.length) {
        const orb = this.orbs[idx];
        if (orb) {
          for (let k = 0; k < this.orbs.length; k++) {
            if (k !== idx) this.orbs[k].clickSpinSpeed = 0.0;
          }
          if (deltaY > 0) {
            orb.clickSpinSpeed = Math.max(orb.clickSpinSpeed, 9.5);
          } else {
            orb.clickSpinSpeed = Math.min(orb.clickSpinSpeed, -9.5);
          }
        }
      }
    }
  }

  /**
   * Applies an immediate angular velocity burst to a specific orb while dampening others.
   *
   * @param {number} index - Target orb index.
   * @param {number} [speed=12.5] - Rotational velocity magnitude.
   */
  triggerSpinBurst(index: number, speed = 12.5): void {
    if (index < 0 || index >= this.orbs.length) return;
    for (let k = 0; k < this.orbs.length; k++) {
      if (k !== index) {
        this.orbs[k].clickSpinSpeed = 0.0;
      }
    }
    this.orbs[index].clickSpinSpeed = speed;
  }

  /**
   * Releases Three.js buffer geometries, materials, and renderer contexts.
   */
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
}
