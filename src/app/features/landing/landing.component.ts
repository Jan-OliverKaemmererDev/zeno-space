import {
  Component,
  inject,
  signal,
  computed,
  effect,
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
import { SmoothScrollService } from '../../core/services/smooth-scroll.service';
import { BubbleCardComponent } from '../../shared/components/bubble-card/bubble-card.component';
import { LiquidNavComponent } from '../../shared/components/liquid-nav/liquid-nav.component';
import { OrbNavComponent } from '../../shared/components/orb-nav/orb-nav.component';
import { Minigame } from '../../core/models/minigame.model';

/**
 * Character data item with global index for staggered bubble animations.
 */
export interface BubbleLetter {
  /** Character to display. */
  char: string;
  /** Global sequence index across the phrase. */
  globalIndex: number;
}

/**
 * Word grouping of bubble letters.
 */
export interface BubbleWord {
  /** Ordered list of letters within the word. */
  letters: BubbleLetter[];
}

/**
 * Phrase grouping of bubble words for structured responsive layout wrapping.
 */
export interface BubblePhrase {
  /** Ordered list of words in the phrase. */
  words: BubbleWord[];
}

/**
 * Character data with right-aligned stagger index for wave tooltips.
 */
export interface TooltipLetter {
  /** Character to display. */
  char: string;
  /** Distance index counted from the right edge. */
  fromRight: number;
}

/**
 * Physics-driven swinging hanging object (lantern or star) in the cozy sanctuary section.
 */
export interface SanctuarySwingItem {
  id: string;
  type: 'lantern' | 'star';
  /** Normalized X anchor in 1376 coordinate space */
  anchorX: number;
  /** Normalized Y anchor in 768 coordinate space */
  anchorY: number;
  /** Length of the pendulum / hanging string in px */
  length: number;
  /** Current deflection angle in radians */
  angle: number;
  /** Angular velocity in radians per second */
  velocity: number;
  /** Natural angular frequency omega_0 (rad/s) */
  omega0: number;
  /** Damping multiplier per frame */
  damping: number;
  /** Interaction radius in 1376px scale */
  influenceRadius: number;
  /** Max deflection angle limit in radians */
  maxAngle: number;
  /** Cached DOM element */
  element?: HTMLElement | null;
}

/**
 * Visual spark particle emitted from the sound toggle button burst animation.
 */
export interface SoundBurstSpark {
  /** Unique identifier for the spark. */
  id: number;
  /** Starting X coordinate. */
  startX: number;
  /** Starting Y coordinate. */
  startY: number;
  /** Destination X coordinate. */
  endX: number;
  /** Destination Y coordinate. */
  endY: number;
  /** CSS color hex code. */
  color: string;
  /** Particle size in pixels. */
  size: number;
  /** Stagger delay in milliseconds. */
  delayMs: number;
}

/**
 * Visual micro-spark emitted when selecting a category filter pill button.
 */
export interface PillSpark {
  /** Unique identifier for the spark. */
  id: number;
  /** Starting X coordinate. */
  startX: number;
  /** Starting Y coordinate. */
  startY: number;
  /** Destination X coordinate. */
  endX: number;
  /** Destination Y coordinate. */
  endY: number;
  /** CSS color hex code. */
  color: string;
  /** Particle size in pixels. */
  size: number;
  /** Stagger delay in milliseconds. */
  delayMs: number;
}

/**
 * Main landing page component featuring the animated anime cloudscape, hero text, and interactive bubble minigame hub.
 */
@Component({
  selector: 'app-landing',
  imports: [
    RouterLink,
    BubbleCardComponent,
    OrbNavComponent,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  readonly gameRegistry = inject(GameRegistryService);
  readonly audioService = inject(AudioService);
  readonly smoothScroll = inject(SmoothScrollService);

  @ViewChild('cloudCanvas') cloudCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('scrollBody') scrollBodyRef!: ElementRef<HTMLElement>;

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

  // Sanctuary Interactive Balloons & Smooth Scroll Reveal
  readonly showImpressum = signal<boolean>(false);
  readonly showDatenschutz = signal<boolean>(false);
  readonly isSanctuaryRevealed = signal<boolean>(false);
  readonly isInSanctuaryView = signal<boolean>(false);
  private sanctuaryIntersectionObserver: IntersectionObserver | null = null;

  // Free-floating warm letter arrays matching orb-tooltip for sanctuary balloons
  readonly impressumTooltipLetters: TooltipLetter[] = (() => {
    const text = 'Impressum';
    const chars = Array.from(text);
    const total = chars.length;
    return chars.map((char, index) => ({
      char: char === ' ' ? '\u00A0' : char,
      fromRight: total - 1 - index,
    }));
  })();

  readonly datenschutzTooltipLetters: TooltipLetter[] = (() => {
    const text = 'Datenschutz';
    const chars = Array.from(text);
    const total = chars.length;
    return chars.map((char, index) => ({
      char: char === ' ' ? '\u00A0' : char,
      fromRight: total - 1 - index,
    }));
  })();

  // Audio activation state & fine stardust particles
  readonly isBursting = signal<boolean>(false);
  private wasAwaitingGesture = false;
  private burstTimeout: ReturnType<typeof setTimeout> | null = null;

  // Staggered letter wave for "Sound an?" tooltip matching orb-tooltip
  readonly soundTooltipLetters: TooltipLetter[] = (() => {
    const text = 'Sound an?';
    const chars = Array.from(text);
    const total = chars.length;
    return chars.map((char, index) => ({
      char: char === ' ' ? '\u00A0' : char,
      fromRight: total - 1 - index,
    }));
  })();

  // 12 fine micro-particles orbiting calmly on 2 tracks (6 per track)
  readonly orbitParticleIndices = Array.from({ length: 12 }, (_, i) => i);

  // Explosive micro-sparks on click (14 delicate light points scattering outward)
  readonly burstSparks = signal<SoundBurstSpark[]>([]);

  // Subtle explosive micro-particles on filter-pill click (8 subtle light points)
  readonly activePillSparkTarget = signal<string | null>(null);
  readonly pillSparks = signal<PillSpark[]>([]);
  private pillSparkTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const awaiting = this.audioService.isAwaitingUserGesture();
      if (awaiting) {
        this.wasAwaitingGesture = true;
      } else if (this.wasAwaitingGesture) {
        this.wasAwaitingGesture = false;
        this.triggerParticleBurst();
      }
    });

    effect(() => {
      const inSanctuary = this.isInSanctuaryView() || this.isSanctuaryRevealed() || this.activeSectionIndex() === 2;
      if (typeof document !== 'undefined') {
        if (inSanctuary) {
          document.body.classList.add('in-sanctuary');
        } else {
          document.body.classList.remove('in-sanctuary');
        }
      }
      if (inSanctuary) {
        this.audioService.startSanctuaryWhales();
      } else {
        this.audioService.stopSanctuaryWhales();
      }
    });
  }

  /**
   * Spawns an explosive burst of 14 delicate micro-sparks radiating outward from the audio toggle button.
   *
   * @returns {void}
   */
  private triggerParticleBurst(): void {
    if (this.burstTimeout) {
      clearTimeout(this.burstTimeout);
    }
    this.isBursting.set(true);

    // Spawn 14 fine micro-sparks shooting outward like the orb click sparks
    const count = 14;
    const sparks: SoundBurstSpark[] = [];
    const baseAngle = Math.random() * Math.PI * 2;

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i * ((Math.PI * 2) / count)) + (Math.random() - 0.5) * 0.22;
      const startDist = 22 + Math.random() * 3; // Start near button edge
      const endDist = startDist + 32 + Math.random() * 45; // Explode outward ~32-77px
      const isBlue = Math.random() < 0.5;

      sparks.push({
        id: i + 1,
        startX: Math.round(Math.cos(angle) * startDist * 10) / 10,
        startY: Math.round(Math.sin(angle) * startDist * 10) / 10,
        endX: Math.round(Math.cos(angle) * endDist * 10) / 10,
        endY: Math.round(Math.sin(angle) * endDist * 10) / 10,
        color: isBlue ? '#7dd3fc' : '#ffffff',
        size: Math.random() < 0.6 ? 1.5 : 2,
        delayMs: Math.round(Math.random() * 50),
      });
    }

    this.burstSparks.set(sparks);

    this.burstTimeout = setTimeout(() => {
      this.isBursting.set(false);
      this.burstSparks.set([]);
      this.burstTimeout = null;
    }, 680);
  }
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

  // Structured phrases ("Interaktive" and "Welten") with bubble letters & Sniglet font
  readonly hubPhrases: BubblePhrase[] = (() => {
    const rawPhrases = [
      ['Interaktive'],
      ['Welten'],
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

  readonly isHubTitleVisible = signal<boolean>(false);
  private hubIntersectionObserver: IntersectionObserver | null = null;

  readonly prompterWords = ['Nach', 'unten', 'schweben'];
  readonly isPrompterVisible = signal<boolean>(true);
  readonly hasPrompterScrolledOnce = signal<boolean>(false);

  // Filters matching the dropdown categories
  readonly filters = [
    { label: 'Alle Welten', value: 'all' },
    { label: 'Mathematik', value: 'mathematik' },
    { label: 'Astronomie', value: 'astronomie' },
    { label: 'Natur', value: 'natur' },
    { label: 'Geräusche', value: 'geraeusche' },
    { label: 'Relax', value: 'relax' },
    { label: 'Abenteuer', value: 'abenteuer' },
  ];

  readonly activeFilter = computed(() => this.gameRegistry.selectedCategory() ?? 'all');

  readonly filteredGames = computed(() => {
    const selectedCategory = this.gameRegistry.selectedCategory();
    const all = this.gameRegistry.games();

    if (selectedCategory && selectedCategory !== 'all') {
      const target = selectedCategory.toLowerCase();
      return all.filter((g) => {
        const catMatch = g.category?.toLowerCase() === target;
        const tagMatch = g.tags?.some((t) => {
          const norm = t
            .toLowerCase()
            .replace('ä', 'ae')
            .replace('ö', 'oe')
            .replace('ü', 'ue');
          return norm === target || t.toLowerCase() === target;
        });
        return catMatch || tagMatch;
      });
    }

    return all;
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

  /**
   * Lifecycle hook invoked after view initialization to start audio, scroll observers, and WebGL cloudscape.
   *
   * @returns {void}
   */
  ngAfterViewInit(): void {
    this.smoothScroll.registerContainer(this.scrollBodyRef?.nativeElement ?? null);
    this.initCloudScene();
    this.initPhraseSmoothWrapping();
    this.initHubTitleObserver();
    this.initSanctuaryObserver();
    this.audioService.playAmbientMusic();
    this.updateActiveSection();
    if (typeof window !== 'undefined') {
      const atTop = window.scrollY <= 15;
      if (!atTop) {
        this.hasPrompterScrolledOnce.set(true);
        this.isPrompterVisible.set(false);
      }
      if (window.location.hash === '#bubble-hub' || this.gameRegistry.selectedCategory()) {
        setTimeout(() => {
          this.scrollToHub();
        }, 150);
      }
    }
  }

  /**
   * Lifecycle hook invoked on destruction to release WebGL contexts, observers, and animation frame handles.
   *
   * @returns {void}
   */
  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('in-sanctuary');
    }
    this.isDestroyed = true;
    this.smoothScroll.registerContainer(null);
    this.audioService.pauseAmbientMusic();
    this.audioService.stopSanctuaryWhales();
    if (this.glideTimeout) {
      clearTimeout(this.glideTimeout);
      this.glideTimeout = null;
    }
    if (this.programmaticScrollTimeout) {
      clearTimeout(this.programmaticScrollTimeout);
      this.programmaticScrollTimeout = null;
    }
    if (this.burstTimeout) {
      clearTimeout(this.burstTimeout);
      this.burstTimeout = null;
    }
    if (this.pillSparkTimeout) {
      clearTimeout(this.pillSparkTimeout);
      this.pillSparkTimeout = null;
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
    if (this.hubEvadeRafId !== null) {
      cancelAnimationFrame(this.hubEvadeRafId);
      this.hubEvadeRafId = null;
    }
    if (this.sanctuaryEvadeRafId !== null) {
      cancelAnimationFrame(this.sanctuaryEvadeRafId);
      this.sanctuaryEvadeRafId = null;
    }
    if (this.sanctuaryPhysicsRafId !== null) {
      cancelAnimationFrame(this.sanctuaryPhysicsRafId);
      this.sanctuaryPhysicsRafId = null;
    }
    if (this.hubIntersectionObserver) {
      this.hubIntersectionObserver.disconnect();
      this.hubIntersectionObserver = null;
    }
    if (this.sanctuaryIntersectionObserver) {
      this.sanctuaryIntersectionObserver.disconnect();
      this.sanctuaryIntersectionObserver = null;
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

  /**
   * Registers ResizeObserver and window listeners to animate heading phrase layout wrapping smoothly via FLIP technique.
   *
   * @returns {void}
   */
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

  /**
   * Throttles window resize events via requestAnimationFrame to animate phrase wrapping.
   *
   * @returns {void}
   */
  private onWindowResizeForPhrases = (): void => {
    if (this.phraseRafId !== null) return;
    this.phraseRafId = requestAnimationFrame(() => {
      this.phraseRafId = null;
      if (!this.isDestroyed) {
        this.animatePhraseWrapping();
      }
    });
  };

  /**
   * Computes FLIP layout inversions and smoothly animates phrases into their wrapped positions.
   *
   * @returns {void}
   */
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
  private hubEvadeRafId: number | null = null;
  private lastHubPointerEvent: PointerEvent | null = null;
  private sanctuaryEvadeRafId: number | null = null;
  private lastSanctuaryPointerEvent: PointerEvent | null = null;

  // ----------------------------------------------------
  // Sanctuary Interactive Strings & Pendulum Physics
  // ----------------------------------------------------
  private sanctuaryPhysicsRafId: number | null = null;
  private lastSanctuaryPointerNormX = 0;
  private lastSanctuaryPointerNormY = 0;
  private lastSanctuaryPointerTimestamp = 0;
  private isSanctuaryPointerInside = false;

  private readonly sanctuarySwingItems: SanctuarySwingItem[] = [
    // Hanging Lanterns (6 items)
    {
      id: 'lantern-hanging-left-top',
      type: 'lantern',
      anchorX: 152,
      anchorY: 6,
      length: 69,
      angle: 0,
      velocity: 0,
      omega0: 5.8,
      damping: 0.983,
      influenceRadius: 50,
      maxAngle: 0.20, // ~11.5 deg
    },
    {
      id: 'lantern-hanging-left-mid',
      type: 'lantern',
      anchorX: 156,
      anchorY: 310,
      length: 85,
      angle: 0,
      velocity: 0,
      omega0: 5.4,
      damping: 0.985,
      influenceRadius: 54,
      maxAngle: 0.18, // ~10.3 deg
    },
    {
      id: 'lantern-hanging-center-left',
      type: 'lantern',
      anchorX: 502,
      anchorY: 354,
      length: 51,
      angle: 0,
      velocity: 0,
      omega0: 6.3,
      damping: 0.981,
      influenceRadius: 46,
      maxAngle: 0.22, // ~12.6 deg
    },
    {
      id: 'lantern-hanging-center-right',
      type: 'lantern',
      anchorX: 874,
      anchorY: 392,
      length: 62,
      angle: 0,
      velocity: 0,
      omega0: 6.0,
      damping: 0.983,
      influenceRadius: 48,
      maxAngle: 0.21, // ~12.0 deg
    },
    {
      id: 'lantern-hanging-right-mid',
      type: 'lantern',
      anchorX: 1220,
      anchorY: 296,
      length: 86,
      angle: 0,
      velocity: 0,
      omega0: 5.4,
      damping: 0.985,
      influenceRadius: 54,
      maxAngle: 0.18, // ~10.3 deg
    },
    {
      id: 'lantern-hanging-right-top',
      type: 'lantern',
      anchorX: 1216,
      anchorY: 76,
      length: 50,
      angle: 0,
      velocity: 0,
      omega0: 6.3,
      damping: 0.981,
      influenceRadius: 46,
      maxAngle: 0.22, // ~12.6 deg
    },

    // Hanging Star Lanterns (7 items)
    {
      id: 'star-left-1',
      type: 'star',
      anchorX: 163,
      anchorY: 628,
      length: 118,
      angle: 0,
      velocity: 0,
      omega0: 5.0,
      damping: 0.986,
      influenceRadius: 46,
      maxAngle: 0.17, // ~9.7 deg
    },
    {
      id: 'star-left-2',
      type: 'star',
      anchorX: 220,
      anchorY: 560,
      length: 85,
      angle: 0,
      velocity: 0,
      omega0: 5.5,
      damping: 0.984,
      influenceRadius: 44,
      maxAngle: 0.19, // ~10.9 deg
    },
    {
      id: 'star-center',
      type: 'star',
      anchorX: 505,
      anchorY: 465,
      length: 64,
      angle: 0,
      velocity: 0,
      omega0: 5.9,
      damping: 0.982,
      influenceRadius: 44,
      maxAngle: 0.21, // ~12.0 deg
    },
    {
      id: 'star-right-1',
      type: 'star',
      anchorX: 1175,
      anchorY: 542,
      length: 90,
      angle: 0,
      velocity: 0,
      omega0: 5.4,
      damping: 0.984,
      influenceRadius: 44,
      maxAngle: 0.19, // ~10.9 deg
    },
    {
      id: 'star-right-2',
      type: 'star',
      anchorX: 1205,
      anchorY: 553,
      length: 163,
      angle: 0,
      velocity: 0,
      omega0: 4.8,
      damping: 0.987,
      influenceRadius: 48,
      maxAngle: 0.15, // ~8.6 deg
    },
    {
      id: 'star-right-3',
      type: 'star',
      anchorX: 1239,
      anchorY: 604,
      length: 67,
      angle: 0,
      velocity: 0,
      omega0: 5.9,
      damping: 0.982,
      influenceRadius: 42,
      maxAngle: 0.21, // ~12.0 deg
    },
    {
      id: 'star-right-4',
      type: 'star',
      anchorX: 1276,
      anchorY: 685,
      length: 41,
      angle: 0,
      velocity: 0,
      omega0: 6.5,
      damping: 0.980,
      influenceRadius: 40,
      maxAngle: 0.24, // ~13.8 deg
    },
  ];

  /**
   * Handles pointer motion over the hero title container, scheduling letter evasion calculation.
   *
   * @param {PointerEvent} event - The pointer move event.
   * @returns {void}
   */
  onHeadingPointerMove(event: PointerEvent): void {
    this.lastPointerEvent = event;
    if (this.mouseEvadeRafId !== null) return;

    this.mouseEvadeRafId = requestAnimationFrame(() => {
      this.mouseEvadeRafId = null;
      if (!this.lastPointerEvent || this.isDestroyed) return;
      this.applyEvadeToLetters(this.lastPointerEvent, '.hero-center-container .bubble-letter');
    });
  }

  /**
   * Resets hero letter evasion transforms upon pointer leaving the hero title area.
   *
   * @returns {void}
   */
  onHeadingPointerLeave(): void {
    if (this.mouseEvadeRafId !== null) {
      cancelAnimationFrame(this.mouseEvadeRafId);
      this.mouseEvadeRafId = null;
    }
    this.lastPointerEvent = null;
    this.resetLettersEvade('.hero-center-container .bubble-letter');
  }

  /**
   * Handles pointer motion over the bubble hub heading, scheduling letter evasion calculation.
   *
   * @param {PointerEvent} event - The pointer move event.
   * @returns {void}
   */
  onHubHeadingPointerMove(event: PointerEvent): void {
    this.lastHubPointerEvent = event;
    if (this.hubEvadeRafId !== null) return;

    this.hubEvadeRafId = requestAnimationFrame(() => {
      this.hubEvadeRafId = null;
      if (!this.lastHubPointerEvent || this.isDestroyed) return;
      this.applyEvadeToLetters(this.lastHubPointerEvent, '.hub-title-container .hub-letter');
    });
  }

  /**
   * Resets bubble hub letter evasion transforms upon pointer leaving the hub heading area.
   *
   * @returns {void}
   */
  onHubHeadingPointerLeave(): void {
    if (this.hubEvadeRafId !== null) {
      cancelAnimationFrame(this.hubEvadeRafId);
      this.hubEvadeRafId = null;
    }
    this.lastHubPointerEvent = null;
    this.resetLettersEvade('.hub-title-container .hub-letter');
  }

  /**
   * Handles pointer motion over the sanctuary area, scheduling letter evasion calculation for Datenschutz and Impressum
   * as well as physics-based deflection for hanging lanterns and stars (CodingStella Strings Animation).
   *
   * @param {PointerEvent} event - The pointer move event.
   * @returns {void}
   */
  onSanctuaryPointerMove(event: PointerEvent): void {
    if (typeof document !== 'undefined' && !document.body.classList.contains('in-sanctuary')) {
      document.body.classList.add('in-sanctuary');
    }
    this.lastSanctuaryPointerEvent = event;
    this.isSanctuaryPointerInside = true;

    // 1. Tooltip Letter Evasion
    if (this.sanctuaryEvadeRafId === null) {
      this.sanctuaryEvadeRafId = requestAnimationFrame(() => {
        this.sanctuaryEvadeRafId = null;
        if (!this.lastSanctuaryPointerEvent || this.isDestroyed) return;
        this.applyEvadeToLetters(
          this.lastSanctuaryPointerEvent,
          '.hotspot-floating-tooltip .tooltip-letter',
          65,    // radius: 65px (harmonious middle ground between 90px and 40px)
          8.5,   // maxPush: 8.5px (balanced displacement between 14px and 4px)
          false, // allowLift: false (strictly prevent lifting the text upwards)
          0.18   // verticalRatio: 0.18 (soft organic downward cushion, never upwards)
        );
      });
    }

    // 2. Interactive Strings & Lanterns Physics Impulse
    this.applyPointerImpulseToSanctuaryItems(event);
  }

  /**
   * Resets sanctuary balloon letter evasion transforms upon pointer leaving the sanctuary area
   * and allows swinging lanterns/stars to smoothly dampen to rest.
   *
   * @returns {void}
   */
  onSanctuaryPointerLeave(): void {
    this.isSanctuaryPointerInside = false;
    this.lastSanctuaryPointerTimestamp = 0;
    if (this.sanctuaryEvadeRafId !== null) {
      cancelAnimationFrame(this.sanctuaryEvadeRafId);
      this.sanctuaryEvadeRafId = null;
    }
    this.lastSanctuaryPointerEvent = null;
    this.resetLettersEvade('.hotspot-floating-tooltip .tooltip-letter');

    // Ensure physics loop runs until all swaying items settle naturally to 0
    if (this.sanctuaryPhysicsRafId === null) {
      const anyActive = this.sanctuarySwingItems.some(i => Math.abs(i.angle) > 0.0001 || Math.abs(i.velocity) > 0.0001);
      if (anyActive) {
        this.sanctuaryPhysicsRafId = requestAnimationFrame(this.runSanctuaryPhysicsLoop);
      }
    }
  }

  /**
   * Calculates physical force impulses imparted to hanging sanctuary lanterns and stars
   * based on pointer movement velocity and proximity (inspired by CodingStella interactive strings physics).
   *
   * @param {PointerEvent} event - The pointer move event.
   * @returns {void}
   */
  private applyPointerImpulseToSanctuaryItems(event: PointerEvent): void {
    const container = document.querySelector('.sanctuary-canvas-wrapper') as HTMLElement | null;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const normX = ((event.clientX - rect.left) / rect.width) * 1376;
    const normY = ((event.clientY - rect.top) / rect.height) * 768;
    const now = performance.now();
    const dt = Math.max(0.005, Math.min(0.05, (now - this.lastSanctuaryPointerTimestamp) / 1000));

    // Pointer velocity in normalized coordinate pixels per second (smoothed & clamped)
    let vx = 0;
    if (this.lastSanctuaryPointerTimestamp > 0) {
      vx = (normX - this.lastSanctuaryPointerNormX) / dt;
    }
    vx = Math.max(-1000, Math.min(1000, vx));

    this.lastSanctuaryPointerNormX = normX;
    this.lastSanctuaryPointerNormY = normY;
    this.lastSanctuaryPointerTimestamp = now;

    let impartedMotion = false;

    for (const item of this.sanctuarySwingItems) {
      // Screen space tip position: clockwise rotation (angle > 0) moves the bottom to the LEFT (-X)
      const sinA = Math.sin(item.angle);
      const cosA = Math.cos(item.angle);
      const tipX = item.anchorX - item.length * sinA;
      const tipY = item.anchorY + item.length * cosA;

      const segX = tipX - item.anchorX;
      const segY = tipY - item.anchorY;
      const segLenSq = segX * segX + segY * segY;

      // Project pointer onto hanging string segment
      const u = segLenSq > 0
        ? Math.max(0, Math.min(1, ((normX - item.anchorX) * segX + (normY - item.anchorY) * segY) / segLenSq))
        : 0;

      const closestX = item.anchorX + u * segX;
      const closestY = item.anchorY + u * segY;

      const dx = normX - closestX;
      const dy = normY - closestY;
      const dist = Math.hypot(dx, dy);

      if (dist < item.influenceRadius) {
        // Smooth normalized distance factor [0 .. 1]
        const normDist = dist / item.influenceRadius;
        const falloff = 1 - normDist * normDist;
        const smoothWeight = falloff * falloff;

        // Mechanical leverage: hitting the bob produces greater torque than near the top wire anchor
        const leverage = 0.25 + 0.75 * u;

        // 1. Proximity push: pushes the lamp AWAY from the mouse.
        // Screen physics with CSS rotate:
        // Clockwise rotation (angle > 0) moves the lamp bottom to the LEFT.
        // Counter-clockwise rotation (angle < 0) moves the lamp bottom to the RIGHT.
        // If mouse is on left (dx < 0), we push lamp to the RIGHT (angle < 0).
        // If mouse is on right (dx > 0), we push lamp to the LEFT (angle > 0).
        // Using dipole p * smoothWeight ensures 0 torque when directly centered on the wire (no flipping jerk!).
        const p = Math.max(-1, Math.min(1, dx / item.influenceRadius));
        const repulseTorque = p * smoothWeight * 0.75;

        // 2. Dynamic swipe impulse: cursor moving horizontally pushes lamp in the swipe direction
        // If mouse moves right (vx > 0), push lamp to the right (angle < 0).
        // If mouse moves left (vx < 0), push lamp to the left (angle > 0).
        const swipeTorque = -(vx / 800) * smoothWeight * 0.65;

        // Total balanced torque scaled by dt to be framerate independent
        const totalTorque = (repulseTorque + swipeTorque) * leverage;
        const impulse = totalTorque * 18.0 * dt;

        item.velocity += impulse;

        // Natural peak velocity clamp (~3.2 rad/s = ~183 deg/s) for snappy yet controlled response
        item.velocity = Math.max(-3.2, Math.min(3.2, item.velocity));
        impartedMotion = true;
      }
    }

    if (impartedMotion && this.sanctuaryPhysicsRafId === null) {
      this.sanctuaryPhysicsRafId = requestAnimationFrame(this.runSanctuaryPhysicsLoop);
    }
  }

  /**
   * Continuous requestAnimationFrame loop updating damped harmonic pendulum physics
   * for all swinging sanctuary lanterns and stars. Pauses when all items reach rest.
   *
   * @returns {void}
   */
  private runSanctuaryPhysicsLoop = (): void => {
    if (this.isDestroyed) {
      this.sanctuaryPhysicsRafId = null;
      return;
    }

    const dt = 0.016; // Stable 60Hz step for harmonic integration
    let anyActive = false;

    for (const item of this.sanctuarySwingItems) {
      if (!item.element) {
        item.element = document.querySelector(`[data-swing-id="${item.id}"]`) as HTMLElement;
      }

      // Gravitational / spring restoring torque: -omega0^2 * angle
      // Add progressive cubic resistance near maxAngle for a silky-smooth soft cushion without hard bounce
      const ratio = item.angle / item.maxAngle;
      const restoringTorque = -item.omega0 * item.omega0 * (item.angle + Math.pow(ratio, 3) * item.maxAngle * 1.5);

      // Angular acceleration integrated with smooth natural damping
      item.velocity = (item.velocity + restoringTorque * dt) * item.damping;
      item.angle += item.velocity * dt;

      // Elastic limit bounds with soft velocity deceleration (no sudden snap or reverse jerk)
      if (item.angle > item.maxAngle) {
        item.angle = item.maxAngle;
        item.velocity *= 0.5;
      } else if (item.angle < -item.maxAngle) {
        item.angle = -item.maxAngle;
        item.velocity *= 0.5;
      }

      // Settle to sleep when motion is imperceptible
      if (Math.abs(item.angle) < 0.0003 && Math.abs(item.velocity) < 0.001) {
        item.angle = 0;
        item.velocity = 0;
      } else {
        anyActive = true;
      }

      // Synchronously update element transform
      if (item.element) {
        const deg = (item.angle * (180 / Math.PI)).toFixed(2);
        item.element.style.transform = `rotate(${deg}deg)`;
      }
    }

    if (anyActive || this.isSanctuaryPointerInside) {
      this.sanctuaryPhysicsRafId = requestAnimationFrame(this.runSanctuaryPhysicsLoop);
    } else {
      this.sanctuaryPhysicsRafId = null;
    }
  };

  /**
   * Applies subtle physics-based repulsion vectors to letters matching the given selector based on pointer position.
   *
   * @param {PointerEvent} event - The pointer event.
   * @param {string} selector - CSS selector matching the target letter elements.
   * @param {number} [radius=90] - Distance in pixels within which letters react to the pointer.
   * @param {number} [maxPush=14] - Maximum displacement in pixels for letters closest to the pointer.
   * @param {boolean} [allowLift=true] - Whether letters can be pushed upwards (negative Y).
   * @param {number} [verticalRatio=1] - Multiplier for vertical repulsion (0 for horizontal-only).
   * @returns {void}
   */
  private applyEvadeToLetters(
    event: PointerEvent,
    selector: string,
    radius = 90,
    maxPush = 14,
    allowLift = true,
    verticalRatio = 1
  ): void {
    const letters = document.querySelectorAll<HTMLElement>(selector);
    const mouseX = event.clientX;
    const mouseY = event.clientY;

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
        const dirX = Math.abs(dx) > 0.5 ? Math.sign(dx) : (cx >= mouseX ? 1 : -1);
        const pushRatioX = verticalRatio < 0.5 ? Math.max(Math.abs(dx / dist), 0.6) * dirX : (dx / dist);
        const pushX = pushRatioX * force * maxPush;
        let pushY = (dy / dist) * force * maxPush * verticalRatio;
        if (!allowLift && pushY < 0) {
          pushY = 0; // Strictly prevent lifting the text upwards
        }
        const scale = 1 + force * (maxPush > 10 ? 0.08 : 0.045);
        const rot = (dx / dist) * force * (maxPush > 10 ? 3 : 1.8);

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

  /**
   * Resets CSS evasion custom properties back to baseline for matching letter elements.
   *
   * @param {string} selector - CSS selector for target letters.
   * @returns {void}
   */
  private resetLettersEvade(selector: string): void {
    const letters = document.querySelectorAll<HTMLElement>(selector);
    letters.forEach((el) => {
      el.style.setProperty('--evade-x', '0px');
      el.style.setProperty('--evade-y', '0px');
      el.style.setProperty('--evade-scale', '1');
      el.style.setProperty('--evade-rot', '0deg');
    });
  }

  /**
   * Initializes an IntersectionObserver to trigger bubble hub title entrance animation when scrolled into view.
   *
   * @returns {void}
   */
  private initHubTitleObserver(): void {
    if (typeof window === 'undefined') return;

    if (!('IntersectionObserver' in window)) {
      this.isHubTitleVisible.set(true);
      return;
    }

    const hubTitle = document.querySelector<HTMLElement>('.hub-title-container');
    if (!hubTitle) return;

    this.hubIntersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.isHubTitleVisible.set(true);
            this.hubIntersectionObserver?.disconnect();
            this.hubIntersectionObserver = null;
            break;
          }
        }
      },
      { threshold: 0.15 }
    );
    this.hubIntersectionObserver.observe(hubTitle);
  }

  /**
   * Initializes an IntersectionObserver to smoothly fade in the sanctuary section when scrolled into view.
   *
   * @returns {void}
   */
  private initSanctuaryObserver(): void {
    if (typeof window === 'undefined') return;

    if (!('IntersectionObserver' in window)) {
      this.isSanctuaryRevealed.set(true);
      return;
    }

    const sanctuaryEl = document.getElementById('sanctuary');
    if (!sanctuaryEl) return;

    this.sanctuaryIntersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.isSanctuaryRevealed.set(true);
            this.isInSanctuaryView.set(true);
          } else {
            const rect = entry.boundingClientRect;
            if (rect.top > window.innerHeight || rect.bottom < 0) {
              this.isSanctuaryRevealed.set(false);
              this.isInSanctuaryView.set(false);
            }
          }
        }
      },
      { threshold: [0, 0.05], rootMargin: '0px 0px -5% 0px' }
    );
    this.sanctuaryIntersectionObserver.observe(sanctuaryEl);
  }

  // ----------------------------------------------------
  // Subtle Word Evasion for Prompter Text
  // ----------------------------------------------------
  private prompterEvadeRafId: number | null = null;
  private lastPrompterPointerEvent: PointerEvent | null = null;

  /**
   * Handles pointer move over prompter container to calculate subtle word dodging.
   *
   * @param {PointerEvent} event - The pointer move event.
   * @returns {void}
   */
  onPrompterPointerMove(event: PointerEvent): void {
    this.lastPrompterPointerEvent = event;
    if (this.prompterEvadeRafId !== null) return;

    this.prompterEvadeRafId = requestAnimationFrame(() => {
      this.prompterEvadeRafId = null;
      if (!this.lastPrompterPointerEvent || this.isDestroyed) return;
      this.applyPrompterWordEvade(this.lastPrompterPointerEvent);
    });
  }

  /**
   * Resets prompter words evasion upon pointer exit.
   *
   * @returns {void}
   */
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

  /**
   * Applies gentle evasion transforms to prompter word elements away from the pointer.
   *
   * @param {PointerEvent} event - The pointer event.
   * @returns {void}
   */
  private applyPrompterWordEvade(event: PointerEvent): void {
    const words = document.querySelectorAll<HTMLElement>('.prompter-word');
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    const radius = 65; // Gentle influence radius around pointer
    const maxPush = 5.5; // Subtle bubble displacement

    words.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - mouseX;
      const dy = cy - mouseY;
      const dist = Math.hypot(dx, dy);

      if (dist < radius && dist > 0.001) {
        const norm = dist / radius;
        // Soft falloff curve
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

  private isProgrammaticScroll = false;
  private programmaticScrollTimeout: any = null;

  /**
   * Listens to window scroll events to update cloud shader parallax uniforms and prompter visibility.
   *
   * @returns {void}
   */
  @HostListener('window:scroll')
  onScroll(): void {
    this.scrollY = window.scrollY;
    if (this.material) {
      this.material.uniforms['u_scroll'].value = this.scrollY;
    }

    const atTop = this.scrollY <= 15;
    if (atTop !== this.isPrompterVisible()) {
      if (!atTop) {
        this.hasPrompterScrolledOnce.set(true);
      }
      this.isPrompterVisible.set(atTop);
    }

    // Only update active section during manual scroll, not during programmatic smooth scroll
    if (!this.isProgrammaticScroll) {
      this.updateActiveSection();
    }
  }

  /**
   * Re-evaluates viewport position against section anchors to update the active navigation section.
   *
   * @returns {void}
   */
  private updateActiveSection(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    // Direct bounds check
    if (scrollY <= 80) {
      this.setSection(0);
      this.isSanctuaryRevealed.set(false);
      return;
    }
    if (maxScroll > 0 && scrollY >= maxScroll - 60) {
      this.setSection(2);
      this.isSanctuaryRevealed.set(true);
      return;
    }

    const sanctuaryEl = document.getElementById('sanctuary');
    const hubEl = document.getElementById('bubble-hub');

    if (sanctuaryEl) {
      const rect = sanctuaryEl.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.85 && rect.bottom > 60;
      this.isInSanctuaryView.set(inView);

      if (rect.top <= window.innerHeight * 0.75) {
        this.isSanctuaryRevealed.set(true);
      } else if (rect.top > window.innerHeight * 0.90) {
        this.isSanctuaryRevealed.set(false);
      }

      if (rect.top <= window.innerHeight * 0.60) {
        this.setSection(2);
        return;
      }
    } else {
      this.isInSanctuaryView.set(false);
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

  /**
   * Sets the active navigation section index and triggers directional glide transitions.
   *
   * @param {number} index - Target section index (0 for hero, 1 for hub, 2 for sanctuary).
   * @param {boolean} [playSound=false] - Whether to play a harmonic chime sound.
   * @returns {void}
   */
  setSection(index: number, playSound = false): void {
    if (index >= 1) {
      this.isHubTitleVisible.set(true);
    }
    const current = this.activeSectionIndex();
    if (current === index) return;

    const direction: 'down' | 'up' = index > current ? 'down' : 'up';
    this.activeSectionIndex.set(index);
    
    if (typeof document !== 'undefined') {
      if (index === 2) {
        document.body.classList.add('in-sanctuary');
        this.isSanctuaryRevealed.set(true);
      } else {
        document.body.classList.remove('in-sanctuary');
        this.resetLettersEvade('.hotspot-floating-tooltip .tooltip-letter');
      }
    }
    
    this.triggerGlide(direction);

    if (playSound) {
      this.audioService.playChime(3, 0.12);
    }
  }

  /**
   * Initiates a timed directional glide indicator state ('up' or 'down').
   *
   * @param {'down' | 'up'} direction - The movement direction.
   * @returns {void}
   */
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

  /**
   * Smoothly scrolls the window to the designated navigation section anchor.
   *
   * @param {number} index - Index of the target section.
   * @returns {void}
   */
  scrollToSection(index: number): void {
    if (typeof document === 'undefined') return;
    const section = this.sections[index];
    if (!section) return;

    if (index > 0) {
      this.hasPrompterScrolledOnce.set(true);
      this.isPrompterVisible.set(false);
    }

    this.isProgrammaticScroll = true;
    if (this.programmaticScrollTimeout) {
      clearTimeout(this.programmaticScrollTimeout);
    }
    this.programmaticScrollTimeout = setTimeout(() => {
      this.isProgrammaticScroll = false;
      this.programmaticScrollTimeout = null;
    }, 850);

    this.setSection(index, false);

    if (section.id === 'hero') {
      this.smoothScroll.smoothScrollTo(0);
      return;
    }

    const el = document.getElementById(section.id);
    if (el) {
      const targetY = el.getBoundingClientRect().top + window.scrollY;
      this.smoothScroll.smoothScrollTo(targetY);
    }
  }

  // ----------------------------------------------------
  // Round Glass Orbs with Squeezing Jelly Drag & Click Handling
  // ----------------------------------------------------
  /**
   * Handles pointer down on navigation pill buttons supporting both drag scrubbing and single clicks.
   *
   * @param {PointerEvent} event - The pointer event.
   * @returns {void}
   */
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
        this.smoothScroll.syncWithCurrentScroll();
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      this.isDragging.set(false);
      this.smoothScroll.syncWithCurrentScroll();
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

  /**
   * Toggles audio sound muted/unmuted state with particle burst if awaiting first user gesture.
   *
   * @returns {void}
   */
  toggleSound(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.audioService.isAwaitingUserGesture()) {
      this.triggerParticleBurst();
    }
    this.audioService.toggleSound();
  }

  /**
   * Sets the active minigame category filter, emits particles, and plays audio feedback.
   *
   * @param {string} filterValue - The category identifier or 'all'.
   * @param {MouseEvent} [event] - Optional mouse event from click.
   * @param {HTMLElement} [targetEl] - Optional specific pill element reference for particle emission.
   * @returns {void}
   */
  setFilter(filterValue: string, event?: MouseEvent, targetEl?: HTMLElement): void {
    this.gameRegistry.setSelectedCategory(filterValue === 'all' ? null : filterValue);
    this.audioService.playChime(3, 0.15);
    const pillElement = targetEl ?? (event?.currentTarget as HTMLElement | undefined);
    this.triggerPillParticleBurst(filterValue, pillElement);
  }

  /**
   * Handles category tag clicks on child bubble cards, synchronizing the filter pills.
   *
   * @param {string} categoryValue - Selected category string.
   * @returns {void}
   */
  onCardCategorySelect(categoryValue: string): void {
    const pillBtn = typeof document !== 'undefined'
      ? (document.querySelector(`.filter-pill[data-category="${categoryValue}"]`) as HTMLElement | null)
      : null;
    this.setFilter(categoryValue, undefined, pillBtn ?? undefined);
  }

  /**
   * Emits subtle micro-sparks radiating from a clicked category pill element.
   *
   * @param {string} pillValue - Identifier of the active category.
   * @param {HTMLElement} [pillEl] - Target pill element bounding box origin.
   * @returns {void}
   */
  private triggerPillParticleBurst(pillValue: string, pillEl?: HTMLElement): void {
    if (this.pillSparkTimeout) {
      clearTimeout(this.pillSparkTimeout);
    }

    const rect = pillEl?.getBoundingClientRect();
    const rx = rect ? rect.width / 2 : 46;
    const ry = rect ? rect.height / 2 : 16;

    // Spawn 8 delicate micro-sparks shooting gently outward
    const count = 8;
    const sparks: PillSpark[] = [];
    const baseAngle = Math.random() * Math.PI * 2;
    const colors = ['#ffffff', '#93c5fd', '#bae6fd', '#fed7aa'];

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i * ((Math.PI * 2) / count)) + (Math.random() - 0.5) * 0.25;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Start gently along the pill contour
      const startX = Math.round(cosA * rx * 0.84 * 10) / 10;
      const startY = Math.round(sinA * ry * 0.84 * 10) / 10;

      // Subtle outward dispersion (~14-26px)
      const dist = 14 + Math.random() * 12;
      const endX = Math.round((startX + cosA * dist) * 10) / 10;
      const endY = Math.round((startY + sinA * dist) * 10) / 10;

      sparks.push({
        id: i + 1,
        startX,
        startY,
        endX,
        endY,
        color: colors[i % colors.length],
        size: Math.random() < 0.6 ? 1.4 : 1.8,
        delayMs: Math.round(Math.random() * 30),
      });
    }

    this.activePillSparkTarget.set(pillValue);
    this.pillSparks.set(sparks);

    this.pillSparkTimeout = setTimeout(() => {
      this.activePillSparkTarget.set(null);
      this.pillSparks.set([]);
      this.pillSparkTimeout = null;
    }, 550);
  }

  /**
   * Clears the active category filter, restoring display of all minigames.
   *
   * @returns {void}
   */
  resetCategory(): void {
    this.gameRegistry.setSelectedCategory(null);
    this.audioService.playChime(2, 0.15);
  }

  /**
   * Plays a waterdrop sound and smoothly scrolls down to the minigames bubble hub section.
   *
   * @returns {void}
   */
  scrollToHub(): void {
    this.audioService.playWaterdropScrollDown();
    this.hasPrompterScrolledOnce.set(true);
    this.isPrompterVisible.set(false);
    this.isHubTitleVisible.set(true);
    const hubElement = document.getElementById('bubble-hub');
    if (hubElement) {
      const targetY = hubElement.getBoundingClientRect().top + window.scrollY;
      this.smoothScroll.smoothScrollTo(targetY);
    }
  }

  // ----------------------------------------------------
  // Three.js Procedural Anime Cloud Shader & Living Canvas
  // ----------------------------------------------------
  /**
   * Initializes Three.js WebGL scene, orthographic camera, and procedural anime cumulus cloud shader.
   *
   * @returns {void}
   */
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
        // 2. Texture Background Cover, Meditative Breathing & Living Wind
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

        // Balanced breathing cycle (~25s period, approx. 2.6% gentle lift)
        float breath = sin(u_time * 0.255);
        float breatheZoom = 1.018 + breath * 0.013;
        texUv = (texUv - 0.5) / breatheZoom + 0.5;

        // Parallax vertical drift on scroll (clouds ascend gently)
        texUv.y += scroll * 0.35;

        // Living cloud wind (fluid, organic micro-drift)
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
        // Subtle organic reaction to rubber-band bounce
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

  toggleImpressum(event: Event) {
    event.stopPropagation();
    this.showImpressum.update(v => !v);
    this.showDatenschutz.set(false);
    this.resetLettersEvade('.hotspot-floating-tooltip .tooltip-letter');
  }

  toggleDatenschutz(event: Event) {
    event.stopPropagation();
    this.showDatenschutz.update(v => !v);
    this.showImpressum.set(false);
    this.resetLettersEvade('.hotspot-floating-tooltip .tooltip-letter');
  }

  closeBalloons() {
    this.showImpressum.set(false);
    this.showDatenschutz.set(false);
    this.resetLettersEvade('.hotspot-floating-tooltip .tooltip-letter');
  }

  onSanctuaryClick(): void {
    this.closeBalloons();
    if (this.audioService.isAwaitingUserGesture()) {
      this.audioService.activateSoundFromUserGesture();
    }
  }
}
