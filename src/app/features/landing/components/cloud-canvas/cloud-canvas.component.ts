import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
  inject,
} from '@angular/core';
import * as THREE from 'three';
import { SmoothScrollService } from '../../../../core/services/smooth-scroll.service';

/**
 * Procedural anime cloudscape rendered onto a full-screen WebGL canvas using Three.js.
 * Handles living cloud advection, stars, shooting stars, breathing cycle, and parallax scroll reaction.
 */
@Component({
  selector: 'app-cloud-canvas',
  standalone: true,
  templateUrl: './cloud-canvas.component.html',
  styleUrl: './cloud-canvas.component.scss',
})
export class CloudCanvasComponent implements AfterViewInit, OnDestroy {
  readonly smoothScroll = inject(SmoothScrollService);

  @ViewChild('cloudCanvas') cloudCanvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private planeMesh: THREE.Mesh | null = null;
  private clock = new THREE.Clock();
  private animFrameId: number | null = null;
  private resizeHandler: (() => void) | null = null;
  private isDestroyed = false;
  private scrollY = 0;

  ngAfterViewInit(): void {
    this.initCloudScene();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.planeMesh) {
      this.planeMesh.geometry.dispose();
      this.planeMesh = null;
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

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrollY = window.scrollY;
    if (this.material) {
      this.material.uniforms['u_scroll'].value = this.scrollY;
    }
  }

  private initCloudScene(): void {
    const canvas = this.cloudCanvasRef?.nativeElement;
    if (!canvas) return;

    // Vertex Shader: Fullscreen quad passing normalized UV
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    // Fragment Shader: Living Anime Cumulus Cloudscape (Widescreen 16:9 + WebGL Living Advection)
    const fragmentShader = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform float u_scroll;
      uniform sampler2D u_texture;
      uniform float u_hasTexture;
      varying vec2 vUv;

      // Fast 2D Hash
      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453123);
      }

      // Smooth Quintic Gradient Noise
      float gnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
        return mix(
          mix(dot(hash2(i + vec2(0.0, 0.0)) * 2.0 - 1.0, f - vec2(0.0, 0.0)),
              dot(hash2(i + vec2(1.0, 0.0)) * 2.0 - 1.0, f - vec2(1.0, 0.0)), u.x),
          mix(dot(hash2(i + vec2(0.0, 1.0)) * 2.0 - 1.0, f - vec2(0.0, 1.0)),
              dot(hash2(i + vec2(1.0, 1.0)) * 2.0 - 1.0, f - vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      // Distance from point p to line segment between a and b
      float segDist(vec2 p, vec2 a, vec2 b, out float h) {
        vec2 pa = p - a;
        vec2 ba = b - a;
        h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
        return length(pa - ba * h);
      }

      // Gentle, distant shooting star generator
      float shootingStar(vec2 uv, float time, float seed, float cycleTime, float aspect) {
        float t = time + seed * 19.41;
        float cycleId = floor(t / cycleTime);
        float progress = fract(t / cycleTime);

        vec2 r = hash2(vec2(cycleId, seed * 7.13));

        // Active window: shooting star is active for ~18% of the cycle, then quiet pause
        float activeDuration = 0.18;
        if (progress > activeDuration) return 0.0;

        float flight = progress / activeDuration; // 0.0 -> 1.0 during flight

        // Trajectory in aspect-corrected coordinates
        float startX = (0.15 + 0.70 * r.x) * aspect;
        float startY = 0.72 + 0.20 * r.y;
        vec2 startPos = vec2(startX, startY);

        // Trajectory angle: gentle downward-left diagonal (~-150 to -165 degrees)
        float angle = -2.65 - 0.35 * (r.y - 0.5); 
        vec2 dir = vec2(cos(angle), sin(angle));

        // Travel distance (delicate and distant)
        float speedDist = (0.24 + 0.12 * r.x) * aspect;
        vec2 head = startPos + dir * (speedDist * flight);

        // Tail extends behind head
        float tailLength = 0.10 + 0.06 * r.y;
        vec2 tail = head - dir * tailLength;

        vec2 p = vec2(uv.x * aspect, uv.y);

        float h;
        float dist = segDist(p, head, tail, h);

        float width = mix(0.0016, 0.0003, h);
        float trailFade = pow(1.0 - h, 2.4);

        float streak = smoothstep(width, 0.0, dist) * trailFade;
        float halo = smoothstep(width * 4.5, 0.0, dist) * trailFade * 0.30;

        float headDist = length(p - head);
        float headGlow = smoothstep(0.0035, 0.0005, headDist) * 1.4;

        float life = sin(flight * 3.14159);
        float skyMask = smoothstep(0.38, 0.65, head.y);

        return (streak + halo + headGlow) * life * skyMask;
      }

      void main() {
        vec2 uv = vUv;
        float screenAspect = u_resolution.x / max(u_resolution.y, 1.0);
        float imgAspect = 16.0 / 9.0;
        float t = u_time * 0.015;
        float scroll = u_scroll / max(u_resolution.y, 1.0);

        // 1. Studio Anime Sky Gradient (Deep Twilight to Luminous Sky)
        vec3 colSkyTop     = vec3(0.040, 0.085, 0.180);
        vec3 colSkyMid     = vec3(0.065, 0.225, 0.470);
        vec3 colSkyLow     = vec3(0.160, 0.500, 0.810);
        vec3 colSkyHorizon = vec3(0.410, 0.730, 0.940);

        float skyGradY = uv.y + scroll * 0.15;
        vec3 proceduralSky = mix(colSkyHorizon, colSkyLow, smoothstep(0.0, 0.32, skyGradY));
        proceduralSky = mix(proceduralSky, colSkyMid, smoothstep(0.26, 0.68, skyGradY));
        proceduralSky = mix(proceduralSky, colSkyTop, smoothstep(0.62, 1.15, skyGradY));

        // 2. Texture Background Cover, Meditative Breathing & Living Wind
        vec2 texUv = uv;
        if (screenAspect > imgAspect) {
          float scale = imgAspect / screenAspect;
          texUv.y = (uv.y - 0.5) * scale + 0.5;
        } else {
          float scale = screenAspect / imgAspect;
          texUv.x = (uv.x - 0.5) * scale + 0.5;
        }

        float breath = sin(u_time * 0.255);
        float breatheZoom = 1.018 + breath * 0.013;
        texUv = (texUv - 0.5) / breatheZoom + 0.5;

        texUv.y += scroll * 0.35;

        vec2 wind = vec2(
          sin(texUv.y * 3.5 + u_time * 0.16) * 0.0030 + cos(texUv.x * 2.8 + u_time * 0.12) * 0.0020,
          cos(texUv.x * 3.2 + u_time * 0.14) * 0.0025
        );

        vec2 sampledUv = clamp(texUv + wind, 0.001, 0.999);
        vec4 texColor = texture2D(u_texture, sampledUv);

        // 3. Mini-Games Extension (Seamless Cloud Sea Transition)
        float scrollFade = smoothstep(0.65, 0.96, texUv.y);
        vec2 pSea = vec2((uv.x - 0.5) * screenAspect * 0.90 + t * 0.40, uv.y * 1.4 + scroll * 0.50);
        float seaNoise = gnoise(pSea * 1.1) * 0.5 + 0.5;
        vec3 colCloudSea = mix(vec3(0.065, 0.165, 0.340), vec3(0.380, 0.740, 0.960), smoothstep(0.35, 0.75, seaNoise));

        vec3 baseArtColor = texColor.rgb;
        if (u_hasTexture > 0.5) {
          float luma = dot(baseArtColor, vec3(0.299, 0.587, 0.114));
          float sunPulse = (sin(u_time * 0.70 + texUv.x * 2.5) * 0.5 + 0.5) * 0.07;
          baseArtColor += vec3(0.12, 0.08, 0.04) * sunPulse * smoothstep(0.62, 0.95, luma);
        } else {
          baseArtColor = proceduralSky;
        }

        vec3 finalColor = mix(baseArtColor, colCloudSea, scrollFade * 0.85);

        // 4. Atmosphere: Delicate Starry Sky & Shooting Stars
        float starSkyVis = smoothstep(0.38, 0.85, uv.y + scroll * 0.15);

        // Layer 1: Fine background stardust
        vec2 starCoord1 = uv * vec2(screenAspect * 36.0, 36.0);
        starCoord1.y += t * 0.06;
        vec2 cell1 = floor(starCoord1);
        vec2 frac1 = fract(starCoord1);
        vec2 rnd1 = hash2(cell1);
        
        float microStars = 0.0;
        if (rnd1.x > 0.35) {
          vec2 pos1 = 0.15 + 0.70 * hash2(cell1 + 3.17);
          float d1 = length(frac1 - pos1);
          float tw1 = sin(u_time * (1.1 + rnd1.y * 1.6) + rnd1.x * 6.28) * 0.35 + 0.65;
          microStars = smoothstep(0.016, 0.001, d1) * tw1 * (0.35 + 0.50 * rnd1.y);
        }

        // Layer 2: Sparkling crystal stars
        vec2 starCoord2 = uv * vec2(screenAspect * 15.0, 15.0);
        starCoord2.y += t * 0.04;
        vec2 cell2 = floor(starCoord2);
        vec2 frac2 = fract(starCoord2);
        vec2 rnd2 = hash2(cell2);

        float crystalStars = 0.0;
        vec3 starColor = vec3(0.90, 0.96, 1.0);
        if (rnd2.x > 0.58) {
          vec2 pos2 = 0.20 + 0.60 * hash2(cell2 + 8.91);
          float d2 = length(frac2 - pos2);
          float tw2 = pow(sin(u_time * (1.5 + rnd2.y * 2.1) + rnd2.x * 6.28) * 0.5 + 0.5, 1.6);
          float core = smoothstep(0.018, 0.002, d2);
          float halo = smoothstep(0.045, 0.004, d2) * 0.25;
          crystalStars = (core + halo) * tw2 * (0.50 + 0.50 * rnd2.y);
          starColor = mix(vec3(0.85, 0.94, 1.00), vec3(1.00, 0.95, 0.88), rnd2.y);
        }

        finalColor += vec3(0.85, 0.92, 1.00) * microStars * starSkyVis * 0.55;
        finalColor += starColor * crystalStars * starSkyVis * 0.70;

        // Layer 3: Shooting stars
        float shoot1 = shootingStar(uv, u_time, 1.0, 7.8, screenAspect);
        float shoot2 = shootingStar(uv, u_time, 2.0, 12.4, screenAspect);
        vec3 colShoot = vec3(0.92, 0.97, 1.00);
        finalColor += colShoot * (shoot1 + shoot2) * starSkyVis * 0.85;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { value: 0.0 },
        u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        u_scroll: { value: window.scrollY },
        u_texture: { value: null },
        u_hasTexture: { value: 0.0 },
      },
      depthWrite: false,
      depthTest: false,
    });

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      '/images/landing-clouds-wide.jpg',
      (texture) => {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        if (!this.isDestroyed && this.material?.uniforms?.['u_texture']) {
          this.material.uniforms['u_texture'].value = texture;
          this.material.uniforms['u_hasTexture'].value = 1.0;
        }
      },
      undefined,
      (err) => {
        console.warn('Anime clouds wide texture fallback:', err);
      }
    );

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.planeMesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.planeMesh);

    this.resizeHandler = () => {
      if (!this.renderer || !this.material) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.setSize(w, h);
      this.material.uniforms['u_resolution'].value.set(w, h);
    };
    window.addEventListener('resize', this.resizeHandler);

    const animate = () => {
      if (this.material) {
        this.material.uniforms['u_time'].value = this.clock.getElapsedTime();
        const bounce = this.smoothScroll.overscrollOffset();
        this.material.uniforms['u_scroll'].value = this.scrollY - bounce * 0.25;
      }
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
      this.animFrameId = requestAnimationFrame(animate);
    };

    animate();
  }
}
