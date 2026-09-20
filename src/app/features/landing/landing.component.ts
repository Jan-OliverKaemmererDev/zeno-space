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
import { LiquidNavComponent } from '../../shared/components/liquid-nav/liquid-nav.component';
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
  imports: [RouterLink, BubbleCardComponent, LiquidNavComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  readonly gameRegistry = inject(GameRegistryService);
  readonly audioService = inject(AudioService);

  @ViewChild('cloudCanvas') cloudCanvasRef!: ElementRef<HTMLCanvasElement>;

  // Floating Glass Orbs with Fluid Water Navigation
  readonly sections = [
    { id: 'hero', label: 'Kosmos' },
    { id: 'bubble-hub', label: 'Welten' },
    { id: 'sanctuary', label: 'Zuflucht' },
  ];
  readonly activeSectionIndex = signal<number>(0);
  readonly glideDirection = signal<'down' | 'up' | null>(null);
  private glideTimeout: ReturnType<typeof setTimeout> | null = null;
  readonly isDragging = signal<boolean>(false);
  readonly scrollPercent = computed(() => {
    if (typeof window === 'undefined') return 0;
    const maxScroll =
      typeof document !== 'undefined'
        ? document.documentElement.scrollHeight - window.innerHeight
        : 0;
    if (maxScroll <= 0) return 0;
    return Math.round(Math.min(100, Math.max(0, (this.scrollY / maxScroll) * 100)));
  });

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

  readonly prompterWords = ['Nach', 'unten', 'schweben'];

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
    this.audioService.playAmbientMusic();
    this.updateActiveSection();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.audioService.pauseAmbientMusic();
    if (this.glideTimeout) {
      clearTimeout(this.glideTimeout);
      this.glideTimeout = null;
    }
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
    if (this.prompterEvadeRafId !== null) {
      cancelAnimationFrame(this.prompterEvadeRafId);
      this.prompterEvadeRafId = null;
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

  // ----------------------------------------------------
  // Subtle Word Evasion for Prompter Text
  // ----------------------------------------------------
  private prompterEvadeRafId: number | null = null;
  private lastPrompterPointerEvent: PointerEvent | null = null;

  onPrompterPointerMove(event: PointerEvent): void {
    this.lastPrompterPointerEvent = event;
    if (this.prompterEvadeRafId !== null) return;

    this.prompterEvadeRafId = requestAnimationFrame(() => {
      this.prompterEvadeRafId = null;
      if (!this.lastPrompterPointerEvent || this.isDestroyed) return;
      this.applyPrompterWordEvade(this.lastPrompterPointerEvent);
    });
  }

  onPrompterPointerLeave(): void {
    if (this.prompterEvadeRafId !== null) {
      cancelAnimationFrame(this.prompterEvadeRafId);
      this.prompterEvadeRafId = null;
    }
    this.lastPrompterPointerEvent = null;

    const words = document.querySelectorAll<HTMLElement>('.prompter-word');
    words.forEach((el) => {
      el.style.setProperty('--evade-x', '0px');
      el.style.setProperty('--evade-y', '0px');
      el.style.setProperty('--evade-scale', '1');
      el.style.setProperty('--evade-rot', '0deg');
    });
  }

  private applyPrompterWordEvade(event: PointerEvent): void {
    const words = document.querySelectorAll<HTMLElement>('.prompter-word');
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    const radius = 65; // Sanfter Einflussbereich um den Zeiger
    const maxPush = 5.5; // Sehr dezente Blasen-Ausweichung

    words.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - mouseX;
      const dy = cy - mouseY;
      const dist = Math.hypot(dx, dy);

      if (dist < radius && dist > 0.001) {
        const norm = dist / radius;
        // Noch weichere Abfallkurve
        const force = Math.pow(1 - norm, 2.0);
        const pushX = (dx / dist) * force * maxPush;
        const pushY = (dy / dist) * force * maxPush;
        const scale = 1 + force * 0.03;
        const rot = (dx / dist) * force * 1.2;

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
    this.updateActiveSection();
  }

  private updateActiveSection(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    // Direct bounds check
    if (scrollY <= 80) {
      this.setSection(0);
      return;
    }
    if (maxScroll > 0 && scrollY >= maxScroll - 60) {
      this.setSection(2);
      return;
    }

    const sanctuaryEl = document.getElementById('sanctuary');
    const hubEl = document.getElementById('bubble-hub');

    if (sanctuaryEl) {
      const rect = sanctuaryEl.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.55) {
        this.setSection(2);
        return;
      }
    }

    if (hubEl) {
      const rect = hubEl.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.55) {
        this.setSection(1);
        return;
      }
    }

    this.setSection(0);
  }

  setSection(index: number, playSound = false): void {
    const current = this.activeSectionIndex();
    if (current === index) return;

    const direction: 'down' | 'up' = index > current ? 'down' : 'up';
    this.activeSectionIndex.set(index);
    this.triggerGlide(direction);

    if (playSound) {
      this.audioService.playChime(3, 0.12);
    }
  }

  private triggerGlide(direction: 'down' | 'up'): void {
    if (this.glideTimeout) {
      clearTimeout(this.glideTimeout);
      this.glideTimeout = null;
    }
    this.glideDirection.set(direction);
    this.glideTimeout = setTimeout(() => {
      this.glideDirection.set(null);
      this.glideTimeout = null;
    }, 740);
  }

  scrollToSection(index: number): void {
    if (typeof document === 'undefined') return;
    const section = this.sections[index];
    if (!section) return;

    this.setSection(index, true);

    if (section.id === 'hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const el = document.getElementById(section.id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // ----------------------------------------------------
  // Round Glass Orbs with Squeezing Jelly Drag & Click Handling
  // ----------------------------------------------------
  onPillPointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);

    const startY = event.clientY;
    const startScrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    let didDrag = false;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY;
      if (Math.abs(deltaY) > 4) {
        didDrag = true;
      }
      if (didDrag) {
        moveEvent.preventDefault();
        const scrollFactor = maxScroll / Math.max(1, window.innerHeight * 0.4);
        const targetScroll = Math.max(0, Math.min(maxScroll, startScrollY + deltaY * scrollFactor));
        window.scrollTo(0, targetScroll);
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      this.isDragging.set(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      if (!didDrag) {
        const targetBtn = (upEvent.target as HTMLElement)?.closest<HTMLElement>('.glass-orb');
        if (targetBtn) {
          const indexAttr = targetBtn.getAttribute('data-index');
          if (indexAttr !== null) {
            this.scrollToSection(parseInt(indexAttr, 10));
          }
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('pointercancel', onPointerUp, { once: true });
  }

  toggleSound(): void {
    this.audioService.toggleSound();
  }

  setFilter(filterValue: string): void {
    this.activeFilter.set(filterValue);
    this.audioService.playChime(3, 0.15);
  }

  scrollToHub(): void {
    this.audioService.playWaterdropScrollDown();
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
        // 4. Cozy Atmosphere: Delicate Starry Sky & Distant Shooting Stars
        // -----------------------------------------------------------------
        float starSkyVis = smoothstep(0.38, 0.85, uv.y + scroll * 0.15);

        // Layer 1: Fine background stardust (Micro-stars)
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

        // Layer 2: Sparkling crystal stars (Twinkling primary stars)
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
          // Subtle warm vs cool tint
          starColor = mix(vec3(0.85, 0.94, 1.00), vec3(1.00, 0.95, 0.88), rnd2.y);
        }

        // Combine stars into finalColor
        finalColor += vec3(0.85, 0.92, 1.00) * microStars * starSkyVis * 0.55;
        finalColor += starColor * crystalStars * starSkyVis * 0.70;

        // Layer 3: Distant gentle shooting stars (Sternschnuppen)
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
