import {
  Component,
  inject,
  signal,
  computed,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';
import { GameRegistryService } from '../../core/services/game-registry.service';
import { AudioService } from '../../core/services/audio.service';
import { BubbleCardComponent } from '../../shared/components/bubble-card/bubble-card.component';
import { Minigame } from '../../core/models/minigame.model';

export interface BubbleLetter {
  char: string;
  globalIndex: number;
}

export interface BubbleWord {
  letters: BubbleLetter[];
}

export interface BubblePhrase {
  words: BubbleWord[];
}

@Component({
  selector: 'app-landing',
  imports: [RouterLink, BubbleCardComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  readonly gameRegistry = inject(GameRegistryService);
  readonly audioService = inject(AudioService);

  @ViewChild('cloudCanvas') cloudCanvasRef!: ElementRef<HTMLCanvasElement>;

  // Structured phrases ("Willkommen im" and "Zeno-Space") for controlled responsive wrapping
  readonly textPhrases: BubblePhrase[] = (() => {
    const rawPhrases = [
      ['Willkommen', 'im'],
      ['Zeno-Space'],
    ];
    let runningIndex = 0;
    return rawPhrases.map((words) => ({
      words: words.map((word) => ({
        letters: Array.from(word).map((char) => ({
          char,
          globalIndex: runningIndex++,
        })),
      })),
    }));
  })();

  // Filters
  readonly activeFilter = signal<string>('all');
  readonly filters = [
    { label: 'Alle Welten', value: 'all' },
    { label: '3D WebGL', value: '3D WebGL' },
    { label: 'Zen Audio', value: 'Zen Audio' },
    { label: 'Chill Sandbox', value: 'Chill Sandbox' },
  ];

  readonly filteredGames = computed(() => {
    const filter = this.activeFilter();
    const all = this.gameRegistry.games();
    if (filter === 'all') return all;
    return all.filter((g) => g.badge === filter);
  });

  scrollY = 0;

  // Three.js WebGL Anime Cloudscape
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private planeMesh: THREE.Mesh | null = null;
  private clock = new THREE.Clock();
  private animFrameId: number | null = null;
  private resizeHandler: (() => void) | null = null;

  private isDestroyed = false;

  ngAfterViewInit(): void {
    this.initCloudScene();
    this.initPhraseSmoothWrapping();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.phraseResizeObserver) {
      this.phraseResizeObserver.disconnect();
      this.phraseResizeObserver = null;
    }
    if (this.phraseRafId !== null) {
      cancelAnimationFrame(this.phraseRafId);
      this.phraseRafId = null;
    }
    window.removeEventListener('resize', this.onWindowResizeForPhrases);

    if (this.mouseEvadeRafId !== null) {
      cancelAnimationFrame(this.mouseEvadeRafId);
      this.mouseEvadeRafId = null;
    }
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

  // ----------------------------------------------------
  // Smooth Layout Wrapping Animation (FLIP) for Phrases
  // ----------------------------------------------------
  private phraseResizeObserver: ResizeObserver | null = null;
  private phraseRafId: number | null = null;
  private lastPhraseRects = new Map<HTMLElement, DOMRect>();
  private isPhraseLayoutInitialized = false;

  private initPhraseSmoothWrapping(): void {
    const heading = document.querySelector<HTMLElement>('.bubble-letters-heading');
    if (!heading) return;

    this.phraseResizeObserver = new ResizeObserver(() => {
      if (this.isDestroyed) return;
      this.onWindowResizeForPhrases();
    });
    this.phraseResizeObserver.observe(heading);

    window.addEventListener('resize', this.onWindowResizeForPhrases, { passive: true });
  }

  private onWindowResizeForPhrases = (): void => {
    if (this.phraseRafId !== null) return;
    this.phraseRafId = requestAnimationFrame(() => {
      this.phraseRafId = null;
      if (!this.isDestroyed) {
        this.animatePhraseWrapping();
      }
    });
  };

  private animatePhraseWrapping(): void {
    const phrases = Array.from(document.querySelectorAll<HTMLElement>('.bubble-phrase'));
    if (phrases.length === 0) return;

    if (!this.isPhraseLayoutInitialized) {
      // First measurement: record rects without animating
      phrases.forEach((el) => {
        this.lastPhraseRects.set(el, el.getBoundingClientRect());
      });
      this.isPhraseLayoutInitialized = true;
      return;
    }

    // Step 1: Measure current layout positions without active transform
    const newRects = new Map<HTMLElement, DOMRect>();
    phrases.forEach((el) => {
      el.style.transition = 'none';
      el.style.transform = '';
      newRects.set(el, el.getBoundingClientRect());
    });

    // Step 2: Calculate deltas and invert
    let hasMovement = false;
    phrases.forEach((el) => {
      const oldRect = this.lastPhraseRects.get(el);
      const newRect = newRects.get(el);
      if (oldRect && newRect) {
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;

        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          hasMovement = true;
          el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
        }
      }
      if (newRect) {
        this.lastPhraseRects.set(el, newRect);
      }
    });

    if (!hasMovement) return;

    // Force browser reflow to commit the inverted transform
    document.body.offsetHeight;

    // Step 3: Play smooth transition to natural position
    requestAnimationFrame(() => {
      phrases.forEach((el) => {
        el.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = 'translate3d(0, 0, 0)';
      });
    });
  }

  // ----------------------------------------------------
  // Subtle Bubble Evasion for Heading Letters
  // ----------------------------------------------------
  private mouseEvadeRafId: number | null = null;
  private lastPointerEvent: PointerEvent | null = null;

  onHeadingPointerMove(event: PointerEvent): void {
    this.lastPointerEvent = event;
    if (this.mouseEvadeRafId !== null) return;

    this.mouseEvadeRafId = requestAnimationFrame(() => {
      this.mouseEvadeRafId = null;
      if (!this.lastPointerEvent || this.isDestroyed) return;
      this.applyBubbleEvade(this.lastPointerEvent);
    });
  }

  onHeadingPointerLeave(): void {
    if (this.mouseEvadeRafId !== null) {
      cancelAnimationFrame(this.mouseEvadeRafId);
      this.mouseEvadeRafId = null;
    }
    this.lastPointerEvent = null;

    const letters = document.querySelectorAll<HTMLElement>('.bubble-letter');
    letters.forEach((el) => {
      el.style.setProperty('--evade-x', '0px');
      el.style.setProperty('--evade-y', '0px');
      el.style.setProperty('--evade-scale', '1');
      el.style.setProperty('--evade-rot', '0deg');
    });
  }

  private applyBubbleEvade(event: PointerEvent): void {
    const letters = document.querySelectorAll<HTMLElement>('.bubble-letter');
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    const radius = 90; // Subtle sphere of influence around pointer
    const maxPush = 14; // Gentle bubble displacement ("nicht zu stark")

    letters.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - mouseX;
      const dy = cy - mouseY;
      const dist = Math.hypot(dx, dy);

      if (dist < radius && dist > 0.001) {
        const norm = dist / radius; // 0 (at cursor) to 1 (at outer edge)
        // Smooth falloff curve
        const force = Math.pow(1 - norm, 1.6);
        const pushX = (dx / dist) * force * maxPush;
        const pushY = (dy / dist) * force * maxPush;
        const scale = 1 + force * 0.08;
        const rot = (dx / dist) * force * 3;

        el.style.setProperty('--evade-x', `${pushX.toFixed(2)}px`);
        el.style.setProperty('--evade-y', `${pushY.toFixed(2)}px`);
        el.style.setProperty('--evade-scale', `${scale.toFixed(3)}`);
        el.style.setProperty('--evade-rot', `${rot.toFixed(2)}deg`);
      } else {
        el.style.setProperty('--evade-x', '0px');
        el.style.setProperty('--evade-y', '0px');
        el.style.setProperty('--evade-scale', '1');
        el.style.setProperty('--evade-rot', '0deg');
      }
    });
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrollY = window.scrollY;
    if (this.material) {
      this.material.uniforms['u_scroll'].value = this.scrollY;
    }
  }

  toggleSound(): void {
    this.audioService.toggleSound();
  }

  setFilter(filterValue: string): void {
    this.activeFilter.set(filterValue);
    this.audioService.playChime(3, 0.15);
  }

  scrollToHub(): void {
    const hubElement = document.getElementById('bubble-hub');
    if (hubElement) {
      hubElement.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // ----------------------------------------------------
  // Three.js Procedural Anime Cloud Shader & Living Canvas
  // ----------------------------------------------------
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

      void main() {
        vec2 uv = vUv;
        float screenAspect = u_resolution.x / max(u_resolution.y, 1.0);
        float imgAspect = 16.0 / 9.0;
        float t = u_time * 0.015;
        float scroll = u_scroll / max(u_resolution.y, 1.0);

        // -----------------------------------------------------------------
        // 1. Studio Anime Sky Gradient (Deep Twilight to Luminous Sky)
        // -----------------------------------------------------------------
        vec3 colSkyTop     = vec3(0.040, 0.085, 0.180); // Deep cozy night navy #0a162e
        vec3 colSkyMid     = vec3(0.065, 0.225, 0.470); // Royal anime twilight sky #113978
        vec3 colSkyLow     = vec3(0.160, 0.500, 0.810); // Radiant sky blue #2980cf
        vec3 colSkyHorizon = vec3(0.410, 0.730, 0.940); // Luminous horizon cyan #69baf0

        float skyGradY = uv.y + scroll * 0.15;
        vec3 proceduralSky = mix(colSkyHorizon, colSkyLow, smoothstep(0.0, 0.32, skyGradY));
        proceduralSky = mix(proceduralSky, colSkyMid, smoothstep(0.26, 0.68, skyGradY));
        proceduralSky = mix(proceduralSky, colSkyTop, smoothstep(0.62, 1.15, skyGradY));

        // -----------------------------------------------------------------
        // 2. Texture Background Cover & Living Wind Advection
        // -----------------------------------------------------------------
        vec2 texUv = uv;
        if (screenAspect > imgAspect) {
          // Screen is wider than 16:9 -> fit width, crop top/bottom evenly
          float scale = imgAspect / screenAspect;
          texUv.y = (uv.y - 0.5) * scale + 0.5;
        } else {
          // Screen is taller than 16:9 -> fit height, crop left/right evenly
          float scale = screenAspect / imgAspect;
          texUv.x = (uv.x - 0.5) * scale + 0.5;
        }

        // Parallax vertical drift on scroll (clouds ascend gently)
        texUv.y += scroll * 0.35;

        // Living cloud wind & breathing (fluid, organic drift - NOT smoke curls)
        vec2 wind = vec2(
          sin(texUv.y * 3.5 + u_time * 0.16) * 0.0030 + cos(texUv.x * 2.8 + u_time * 0.12) * 0.0020,
          cos(texUv.x * 3.2 + u_time * 0.14) * 0.0025
        );

        vec2 sampledUv = clamp(texUv + wind, 0.001, 0.999);
        vec4 texColor = texture2D(u_texture, sampledUv);

        // -----------------------------------------------------------------
        // 3. Mini-Games Extension (Seamless Cloud Sea Transition)
        // -----------------------------------------------------------------
        // When scrolling down, smoothly transition into the deep cloud sea before edge clamp
        float scrollFade = smoothstep(0.65, 0.96, texUv.y);
        
        // Procedural floating cloud sea for mini-games section
        vec2 pSea = vec2((uv.x - 0.5) * screenAspect * 0.90 + t * 0.40, uv.y * 1.4 + scroll * 0.50);
        float seaNoise = gnoise(pSea * 1.1) * 0.5 + 0.5;
        vec3 colCloudSea = mix(vec3(0.065, 0.165, 0.340), vec3(0.380, 0.740, 0.960), smoothstep(0.35, 0.75, seaNoise));

        vec3 baseArtColor = texColor.rgb;
        if (u_hasTexture > 0.5) {
          // Warm solar pulse on bright sunlit cloud crests
          float luma = dot(baseArtColor, vec3(0.299, 0.587, 0.114));
          float sunPulse = (sin(u_time * 0.70 + texUv.x * 2.5) * 0.5 + 0.5) * 0.07;
          baseArtColor += vec3(0.12, 0.08, 0.04) * sunPulse * smoothstep(0.62, 0.95, luma);
        } else {
          baseArtColor = proceduralSky;
        }

        // Composite artwork with mini-games cloud sea
        vec3 finalColor = mix(baseArtColor, colCloudSea, scrollFade * 0.85);

        // -----------------------------------------------------------------
        // 4. Cozy Atmosphere: Ambient Starlight Motes in Sky
        // -----------------------------------------------------------------
        vec2 starCoord = uv * vec2(screenAspect * 3.2, 3.2);
        starCoord.y += t * 0.12;
        vec2 starCell = floor(starCoord);
        vec2 starFrac = fract(starCoord);
        vec2 starRnd = hash2(starCell);
        float starDist = length(starFrac - (0.25 + 0.50 * starRnd));
        float starGlow = smoothstep(0.038, 0.005, starDist) * (sin(u_time * 1.8 + starRnd.x * 6.28) * 0.5 + 0.5);
        float starVis = smoothstep(0.35, 0.95, uv.y);
        finalColor += vec3(0.75, 0.90, 1.0) * starGlow * starVis * 0.50;

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

    // Load the widescreen anime clouds artwork into WebGL
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

    // Animation Loop
    const animate = () => {
      if (this.material) {
        this.material.uniforms['u_time'].value = this.clock.getElapsedTime();
      }
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
      this.animFrameId = requestAnimationFrame(animate);
    };

    animate();
  }
}
