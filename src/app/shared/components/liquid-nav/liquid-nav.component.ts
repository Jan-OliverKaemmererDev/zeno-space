import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  input,
  output,
  effect,
  inject,
  NgZone,
  AfterViewInit,
} from '@angular/core';
import * as THREE from 'three';

/**
 * Represents a discrete navigational section item.
 */
export interface NavSection {
  /** Unique section identifier matching anchor or section IDs. */
  id: string;
  /** Human-readable localized section label. */
  label: string;
}

/**
 * Vertical fluid navigation component featuring WebGL Three.js liquid simulation with cascading droplets.
 */
@Component({
  selector: 'app-liquid-nav',
  standalone: true,
  templateUrl: './liquid-nav.component.html',
  styleUrl: './liquid-nav.component.scss',
})
export class LiquidNavComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly ngZone = inject(NgZone);

  /** Zero-based index of the currently active navigation section. */
  readonly activeIndex = input<number>(0);
  /** Whether the user is actively dragging the scroll position. */
  readonly isDragging = input<boolean>(false);
  /** List of navigation section models rendered along the liquid track. */
  readonly sections = input<NavSection[]>([
    { id: 'hero', label: 'Kosmos' },
    { id: 'bubble-hub', label: 'Welten' },
    { id: 'sanctuary', label: 'Zuflucht' },
  ]);

  /** Emits the newly selected section index when clicked. */
  readonly sectionSelect = output<number>();

  @ViewChild('liquidCanvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  // Three.js instances
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private mesh: THREE.Mesh | null = null;
  private startTime = 0;
  private lastTime = 0;
  private animFrameId: number | null = null;

  // Fluid flow state
  private sourceY = 1.0;
  private targetY = 1.0;
  private flowProgress = 1.0; // 1.0 = resting in target
  private flowTime = 0.0;
  private flowDuration = 0.82;
  private isFlowing = false;
  private hasSloshedInTransition = false;
  private sloshAngle = 0.0;
  private sloshVelocity = 0.0;
  private lastIndex = 0;
  private isDestroyed = false;

  /**
   * Sets up a reactive effect on activeIndex to initiate fluid flow transitions between spheres.
   */
  constructor() {
    // React to activeIndex changes and trigger fluid flow
    effect(() => {
      const idx = this.activeIndex();
      const clampedIdx = Math.max(0, Math.min(2, idx));
      this.triggerFlow(clampedIdx);
    });
  }

  /**
   * Initializes initial resting fluid coordinates based on current active section.
   *
   * @returns {void}
   */
  ngOnInit(): void {
    const initialIdx = Math.max(0, Math.min(2, this.activeIndex()));
    this.targetY = 1.0 - initialIdx * 1.0;
    this.sourceY = this.targetY;
    this.flowProgress = 1.0;
    this.isFlowing = false;
    this.lastIndex = initialIdx;
  }

  /**
   * Initiates a fluid transfer animation between spheres toward the given target section index.
   *
   * @param {number} newIndex - Index of the target sphere (0 to 2).
   * @returns {void}
   */
  private triggerFlow(newIndex: number): void {
    const newTargetY = 1.0 - newIndex * 1.0;
    if (newIndex === this.lastIndex && !this.isFlowing) {
      return;
    }

    // Determine the origin of the liquid flow
    if (this.isFlowing) {
      this.sourceY = this.flowProgress < 0.4 ? this.sourceY : this.targetY;
    } else {
      this.sourceY = this.targetY;
    }

    this.targetY = newTargetY;
    this.lastIndex = newIndex;
    this.flowTime = 0.0;
    const dist = Math.abs(this.targetY - this.sourceY);
    this.flowDuration = dist > 1.1 ? 0.88 : 0.70;
    this.isFlowing = dist > 0.01;
    this.flowProgress = this.isFlowing ? 0.0 : 1.0;
    this.hasSloshedInTransition = false;
  }

  /**
   * Lifecycle hook to initialize WebGL rendering outside Angular's zone to prevent change detection overhead.
   *
   * @returns {void}
   */
  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    this.ngZone.runOutsideAngular(() => {
      this.initThree();
      this.startAnimationLoop();
    });
  }

  /**
   * Cleans up WebGL resources, shaders, geometries, and cancels animation frame requests.
   *
   * @returns {void}
   */
  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh = null;
    }

    if (this.material) {
      this.material.dispose();
      this.material = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }

  /**
   * Emits the selected section index when user clicks an orb or label.
   *
   * @param {number} index - Index of the clicked navigation section.
   * @returns {void}
   */
  onSelect(index: number): void {
    this.sectionSelect.emit(index);
  }

  /**
   * Sets up Three.js scene, orthographic camera, and custom fluid raymarching shader.
   *
   * @returns {void}
   */
  private initThree(): void {
    const canvas = this.canvasRef.nativeElement;
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return;

    const width = 64;
    const height = 192;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(dpr);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;

      uniform float u_time;
      uniform float u_source_y;
      uniform float u_target_y;
      uniform float u_flow_p;
      uniform float u_slosh_angle;

      varying vec2 vUv;

      float sdCircle(vec2 p, vec2 c, float r) {
        return length(p - c) - r;
      }

      // Smooth anti-aliased fill function: 1.0 inside (d < 0), 0.0 outside (d > 0)
      float fill(float d, float feather) {
        return clamp(0.5 - d / feather, 0.0, 1.0);
      }

      // Polynomial smooth minimum for organic fluid metaball blending
      float smin(float a, float b, float k) {
        float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
        return mix(b, a, h) - k * h * (1.0 - h);
      }

      void main() {
        // Map uv to centered coordinates with 3:1 vertical aspect ratio
        // x in [-0.5, 0.5], y in [-1.5, 1.5]
        vec2 p = (vUv - 0.5) * vec2(1.0, 3.0);

        vec2 c0 = vec2(0.0, 1.0);
        vec2 c1 = vec2(0.0, 0.0);
        vec2 c2 = vec2(0.0, -1.0);
        
        // Sphere dimensions: smaller, elegant glass orbs (36px diameter)
        float R = 0.280;
        float innerR = R - 0.018;

        // Glass Spheres Outer Bounds
        float d0 = sdCircle(p, c0, R);
        float d1 = sdCircle(p, c1, R);
        float d2 = sdCircle(p, c2, R);
        float dSpheres = min(d0, min(d1, d2));

        // Inner Spheres Boundary
        float di0 = sdCircle(p, c0, innerR);
        float di1 = sdCircle(p, c1, innerR);
        float di2 = sdCircle(p, c2, innerR);
        float dInnerSpheres = min(di0, min(di1, di2));

        // Anti-aliased glass rim and interior
        float inOuter = fill(dSpheres, 0.012);
        float inInner = fill(dInnerSpheres, 0.012);
        float glassRim = clamp(inOuter - inInner, 0.0, 1.0);
        float glassInside = inInner;

        // ---------------------------------------------------------------------
        // Ambient Drop Shadow Behind Spheres (for clear contrast against clouds)
        // ---------------------------------------------------------------------
        vec2 shadowOffset = vec2(0.010, -0.020);
        float ds0 = sdCircle(p - shadowOffset, c0, R + 0.012);
        float ds1 = sdCircle(p - shadowOffset, c1, R + 0.012);
        float ds2 = sdCircle(p - shadowOffset, c2, R + 0.012);
        float dShadow = min(ds0, min(ds1, ds2));

        float shadowAlpha = clamp(1.0 - (dShadow + 0.012) / 0.065, 0.0, 1.0) * (1.0 - inOuter) * 0.40;
        vec4 finalColor = vec4(0.01, 0.04, 0.12, shadowAlpha);

        // ---------------------------------------------------------------------
        // Frosted Glass Interior & Atmospheric Mist
        // ---------------------------------------------------------------------
        if (glassInside > 0.001) {
          float mist = sin(p.x * 12.0 + u_time * 0.35) * cos(p.y * 10.0 - u_time * 0.28) * 0.5 + 0.5;
          vec4 mistColor = vec4(0.85, 0.95, 1.0, 0.12 * mist);
          vec4 glassBase = vec4(0.92, 0.96, 1.0, 0.15);
          finalColor = mix(finalColor, glassBase + mistColor, glassInside);
        }

        // ---------------------------------------------------------------------
        // Continuous Flowing Water Simulation (Slender, crystal-clear water cascade)
        // ---------------------------------------------------------------------
        // Lively water surface ripples and gentle sloshing
        float idleWave = sin(p.x * 24.0 + u_time * 3.4) * 0.006 + cos(p.x * 15.0 - u_time * 2.2) * 0.004;
        float sloshTilt = p.x * u_slosh_angle * 0.70;
        float meniscus = pow(clamp(abs(p.x) / innerR, 0.0, 1.0), 3.0) * 0.009;
        float waveOffset = idleWave + sloshTilt + meniscus;

        float t = clamp(u_flow_p, 0.0, 1.0);
        float dLiquid = 999.0;

        // Check if resting in target sphere or actively flowing between spheres
        bool isAtRest = abs(u_source_y - u_target_y) < 0.01 || t >= 0.999;

        if (isAtRest) {
          // Liquid is resting in the active sphere with ~28% air headroom
          vec2 cTarget = vec2(0.0, u_target_y);
          float dInnerT = length(p - cTarget) - innerR;
          float surfaceTarget = u_target_y + 0.070 + waveOffset;
          dLiquid = max(dInnerT, p.y - surfaceTarget);
        } else {
          bool flowingDown = u_target_y < u_source_y;
          float flowDir = flowingDown ? -1.0 : 1.0;

          // 1. Source Sphere: water level strictly drains downwards without bulging or jumping
          float fillSource = clamp(1.0 - t / 0.50, 0.0, 1.0);
          float dWaterSource = 999.0;
          if (fillSource > 0.001) {
            vec2 cSource = vec2(0.0, u_source_y);
            float dInnerS = length(p - cSource) - innerR;
            float surfaceSource = mix(u_source_y - innerR - 0.01, u_source_y + 0.070, fillSource);
            surfaceSource += idleWave * 0.25 * fillSource;
            surfaceSource = min(surfaceSource, u_source_y + 0.070);
            dWaterSource = max(dInnerS, p.y - surfaceSource);
          }

          // 2. Target Sphere: water level rises up from the bottom as fluid fills in
          float fillTarget = clamp((t - 0.28) / 0.68, 0.0, 1.0);
          float dWaterTarget = 999.0;
          if (fillTarget > 0.001) {
            vec2 cTarget = vec2(0.0, u_target_y);
            float dInnerT = length(p - cTarget) - innerR;
            float surfaceTarget = mix(u_target_y - innerR - 0.01, u_target_y + 0.070, fillTarget) + waveOffset * fillTarget;
            dWaterTarget = max(dInnerT, p.y - surfaceTarget);
          }

          // 3. Slender, cascading water stream (not a thick blunt sausage!)
          float streamExitY = flowingDown ? (u_source_y - innerR + 0.01) : (u_source_y + innerR - 0.01);
          float streamEntryY = flowingDown ? (u_target_y - innerR * 0.15) : (u_target_y + innerR * 0.15);

          float dStream = 999.0;
          if (t > 0.03 && t < 0.95) {
            // Accelerating head and tail for natural gravity motion
            float rawHeadT = clamp((t - 0.03) / 0.30, 0.0, 1.0);
            float headT = rawHeadT * rawHeadT;
            float rawTailT = clamp((t - 0.40) / 0.42, 0.0, 1.0);
            float tailT = rawTailT * rawTailT;

            float streamHeadY = mix(streamExitY, streamEntryY, headT);
            float streamTailY = mix(streamExitY, streamEntryY, tailT);

            // Thin, elegant water stream radius for the smaller spheres
            float streamPhase = clamp((t - 0.03) / 0.88, 0.0, 1.0);
            float streamIntensity = sin(streamPhase * 3.14159);
            float rStream = mix(0.018, 0.028, streamIntensity);

            // Delicate liquid stream ripples and surface tension flutter
            float streamWobble = sin(p.y * 24.0 - u_time * 14.0 * flowDir) * 0.003 * streamIntensity;
            float yMin = min(streamHeadY, streamTailY);
            float yMax = max(streamHeadY, streamTailY);
            float clampedY = clamp(p.y, yMin, yMax);
            dStream = length(vec2(p.x - streamWobble, p.y - clampedY)) - rStream;
          }

          // 4. Secondary water droplets dancing along the stream path (capillary breakup)
          float dDroplets = 999.0;
          if (t > 0.05 && t < 0.85) {
            // Fast scout droplet rushing ahead
            float d1_T = clamp((t - 0.02) / 0.28, 0.0, 1.0);
            float d1_Y = mix(streamExitY, streamEntryY, d1_T * d1_T);
            if (d1_T > 0.1 && d1_T < 0.95) {
              float drop1 = length(vec2(p.x, p.y - d1_Y)) - 0.018;
              dDroplets = min(dDroplets, drop1);
            }

            // Trailing satellite droplet pinching off near the end
            float d2_T = clamp((t - 0.42) / 0.35, 0.0, 1.0);
            float d2_Y = mix(streamExitY, streamEntryY, d2_T * d2_T);
            if (d2_T > 0.1 && d2_T < 0.95) {
              float drop2 = length(vec2(p.x, p.y - d2_Y)) - 0.014;
              dDroplets = min(dDroplets, drop2);
            }
          }

          // 5. Combine water bodies with organic surface tension
          dLiquid = smin(dWaterSource, dStream, 0.038);
          dLiquid = smin(dLiquid, dDroplets, 0.028);
          dLiquid = smin(dLiquid, dWaterTarget, 0.038);
        }

        // Liquid alpha mask
        float liquidAlpha = fill(dLiquid, 0.010);

        // ---------------------------------------------------------------------
        // Crystal-Clear Very Light Blue Water Rendering ("ganz hell blaue farbe")
        // ---------------------------------------------------------------------
        if (liquidAlpha > 0.001) {
          float depthInWater = clamp(-dLiquid / 0.12, 0.0, 1.0);

          // Very light, ethereal ice-blue and sky-cyan palette
          vec3 deepWater = vec3(0.50, 0.80, 0.98); // very soft, light crystal sky-blue
          vec3 midWater  = vec3(0.72, 0.91, 1.00); // luminous pale ice-cyan
          vec3 glint     = vec3(0.97, 0.99, 1.00); // sparkling white-cyan highlight

          vec3 waterColor = mix(deepWater, midWater, depthInWater);

          // Soft glistening edge meniscus
          float surfaceBand = clamp(1.0 - abs(dLiquid) / 0.010, 0.0, 1.0);
          waterColor = mix(waterColor, glint, surfaceBand * 0.65);

          // Centerline water glint (makes the flowing stream sparkle like wet water!)
          float centerGlint = pow(clamp(1.0 - abs(p.x) / 0.03, 0.0, 1.0), 3.0) * 0.50;
          waterColor = mix(waterColor, glint, centerGlint);

          // Translucent water (0.38 to 0.56) - transparent and crystalline!
          float waterAlpha = liquidAlpha * mix(0.38, 0.56, depthInWater);
          vec4 waterRGBA = vec4(waterColor, waterAlpha);

          // Blend water over glass interior and shadow
          finalColor = vec4(
            waterRGBA.rgb * waterRGBA.a + finalColor.rgb * (1.0 - waterRGBA.a),
            waterRGBA.a + finalColor.a * (1.0 - waterRGBA.a)
          );
        }

        // ---------------------------------------------------------------------
        // Glass Outer Rim & Contrast Edge (distinct visibility against clouds)
        // ---------------------------------------------------------------------
        if (glassRim > 0.001) {
          // Subtle dark outer border to ensure distinct visibility against bright white clouds
          vec4 edgeShadow = vec4(0.02, 0.06, 0.18, 0.35);
          finalColor = mix(finalColor, edgeShadow, glassRim * 0.40);

          vec4 rimColor = vec4(1.0, 1.0, 1.0, 0.72);
          finalColor = mix(finalColor, rimColor, glassRim * 0.88);
        }

        // Ambient outer glow around spheres
        float glowDist = max(0.0, dSpheres);
        float glassOuterGlow = clamp(1.0 - glowDist / 0.05, 0.0, 1.0) * (1.0 - inOuter);
        if (glassOuterGlow > 0.001) {
          vec4 glowColor = vec4(0.24, 0.74, 0.98, 0.22 * glassOuterGlow);
          finalColor += glowColor;
        }

        gl_FragColor = finalColor;
      }
    `;

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { value: 0.0 },
        u_source_y: { value: this.sourceY },
        u_target_y: { value: this.targetY },
        u_flow_p: { value: this.flowProgress },
        u_slosh_angle: { value: 0.0 },
      },
      transparent: true,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);
  }

  /**
   * Runs the continuous requestAnimationFrame render loop outside Angular zone, updating uniforms and sloshing dynamics.
   *
   * @returns {void}
   */
  private startAnimationLoop(): void {
    this.startTime = performance.now();
    this.lastTime = this.startTime;

    const animate = (timestamp: number) => {
      if (this.isDestroyed) return;

      const now = timestamp || performance.now();
      const dt = Math.min((now - this.lastTime) / 1000.0, 0.05);
      this.lastTime = now;
      const elapsedTime = (now - this.startTime) / 1000.0;

      // Update fluid flow progress
      if (this.isFlowing) {
        this.flowTime += dt;
        const normalized = Math.min(1.0, this.flowTime / this.flowDuration);
        // Smoothstep curve for natural fluid acceleration and settling
        this.flowProgress = normalized * normalized * (3.0 - 2.0 * normalized);

        // Water impact impulse when the pouring stream rushes into the destination sphere
        if (normalized >= 0.45 && !this.hasSloshedInTransition) {
          const dir = this.targetY < this.sourceY ? -1.0 : 1.0;
          this.sloshVelocity += dir * 1.25;
          this.hasSloshedInTransition = true;
        }

        if (normalized >= 1.0) {
          this.isFlowing = false;
          this.flowProgress = 1.0;
          this.sourceY = this.targetY;
        }
      }

      // Water sloshing dynamics (quick, natural liquid wave oscillations with damping)
      this.sloshVelocity += (-this.sloshAngle * 26.0 - this.sloshVelocity * 3.4) * dt;
      this.sloshAngle += this.sloshVelocity * dt;

      // Update shader uniforms
      if (this.material && this.renderer && this.scene && this.camera) {
        this.material.uniforms['u_time'].value = elapsedTime;
        this.material.uniforms['u_source_y'].value = this.sourceY;
        this.material.uniforms['u_target_y'].value = this.targetY;
        this.material.uniforms['u_flow_p'].value = this.flowProgress;
        this.material.uniforms['u_slosh_angle'].value = this.sloshAngle;

        this.renderer.render(this.scene, this.camera);
      }

      this.animFrameId = requestAnimationFrame(animate);
    };

    this.animFrameId = requestAnimationFrame(animate);
  }
}
