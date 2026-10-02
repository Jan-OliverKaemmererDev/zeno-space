import {
  Component,
  inject,
  signal,
  computed,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { Router } from '@angular/router';
import { Minigame } from '../../../../core/models/minigame.model';
import { GameRegistryService } from '../../../../core/services/game-registry.service';
import { AudioService } from '../../../../core/services/audio.service';
import { BubbleCardComponent } from '../../../../shared/components/bubble-card/bubble-card.component';
import { BubblePhrase } from '../hero-section/hero-section.component';

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
 * Interactive minigames hub section featuring category filter pills with particle bursts,
 * bubble title with pointer evasion physics, game cards playground, and empty category state.
 */
@Component({
  selector: 'app-bubble-hub-section',
  standalone: true,
  imports: [BubbleCardComponent],
  templateUrl: './bubble-hub-section.component.html',
  styleUrl: './bubble-hub-section.component.scss',
})
export class BubbleHubSectionComponent implements AfterViewInit, OnDestroy {
  readonly gameRegistry = inject(GameRegistryService);
  readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

  /** Currently selected minigame to preview in the instructions overlay. */
  readonly previewGame = this.gameRegistry.previewGame;


  // Structured phrases ("Interaktive" and "Welten") with bubble letters
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

  // Filters matching categories
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

  // Micro-particles on filter-pill click
  readonly activePillSparkTarget = signal<string | null>(null);
  readonly pillSparks = signal<PillSpark[]>([]);
  private pillSparkTimeout: ReturnType<typeof setTimeout> | null = null;

  // Pointer Evasion
  private hubEvadeRafId: number | null = null;
  private lastHubPointerEvent: PointerEvent | null = null;
  private isDestroyed = false;

  ngAfterViewInit(): void {
    this.initHubTitleObserver();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.hubIntersectionObserver) {
      this.hubIntersectionObserver.disconnect();
      this.hubIntersectionObserver = null;
    }
    if (this.hubEvadeRafId !== null) {
      cancelAnimationFrame(this.hubEvadeRafId);
      this.hubEvadeRafId = null;
    }
    if (this.pillSparkTimeout) {
      clearTimeout(this.pillSparkTimeout);
      this.pillSparkTimeout = null;
    }
  }

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

  onHubHeadingPointerMove(event: PointerEvent): void {
    this.lastHubPointerEvent = event;
    if (this.hubEvadeRafId !== null) return;

    this.hubEvadeRafId = requestAnimationFrame(() => {
      this.hubEvadeRafId = null;
      if (!this.lastHubPointerEvent || this.isDestroyed) return;
      this.applyEvadeToLetters(this.lastHubPointerEvent, '.hub-title-container .hub-letter');
    });
  }

  onHubHeadingPointerLeave(): void {
    if (this.hubEvadeRafId !== null) {
      cancelAnimationFrame(this.hubEvadeRafId);
      this.hubEvadeRafId = null;
    }
    this.lastHubPointerEvent = null;
    this.resetLettersEvade('.hub-title-container .hub-letter');
  }

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
        const norm = dist / radius;
        const force = Math.pow(1 - norm, 1.6);
        const dirX = Math.abs(dx) > 0.5 ? Math.sign(dx) : (cx >= mouseX ? 1 : -1);
        const pushRatioX = verticalRatio < 0.5 ? Math.max(Math.abs(dx / dist), 0.6) * dirX : (dx / dist);
        const pushX = pushRatioX * force * maxPush;
        let pushY = (dy / dist) * force * maxPush * verticalRatio;
        if (!allowLift && pushY < 0) {
          pushY = 0;
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

  private resetLettersEvade(selector: string): void {
    const letters = document.querySelectorAll<HTMLElement>(selector);
    letters.forEach((el) => {
      el.style.setProperty('--evade-x', '0px');
      el.style.setProperty('--evade-y', '0px');
      el.style.setProperty('--evade-scale', '1');
      el.style.setProperty('--evade-rot', '0deg');
    });
  }

  setFilter(filterValue: string, event?: MouseEvent, targetEl?: HTMLElement): void {
    this.gameRegistry.setSelectedCategory(filterValue === 'all' ? null : filterValue);
    this.audioService.playChime(3, 0.15);
    const pillElement = targetEl ?? (event?.currentTarget as HTMLElement | undefined);
    this.triggerPillParticleBurst(filterValue, pillElement);
  }

  onCardCategorySelect(categoryValue: string): void {
    const pillBtn = typeof document !== 'undefined'
      ? (document.querySelector(`.filter-pill[data-category="${categoryValue}"]`) as HTMLElement | null)
      : null;
    this.setFilter(categoryValue, undefined, pillBtn ?? undefined);
  }

  private triggerPillParticleBurst(pillValue: string, pillEl?: HTMLElement): void {
    if (this.pillSparkTimeout) {
      clearTimeout(this.pillSparkTimeout);
    }

    const rect = pillEl?.getBoundingClientRect();
    const rx = rect ? rect.width / 2 : 46;
    const ry = rect ? rect.height / 2 : 16;

    const count = 8;
    const sparks: PillSpark[] = [];
    const baseAngle = Math.random() * Math.PI * 2;
    const colors = ['#ffffff', '#93c5fd', '#bae6fd', '#fed7aa'];

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i * ((Math.PI * 2) / count)) + (Math.random() - 0.5) * 0.25;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const startX = Math.round(cosA * rx * 0.84 * 10) / 10;
      const startY = Math.round(sinA * ry * 0.84 * 10) / 10;

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

  resetCategory(): void {
    this.gameRegistry.setSelectedCategory(null);
    this.audioService.playChime(2, 0.15);
  }

  /**
   * Opens the game instructions and controls overlay for a clicked minigame.
   */
  onGameSelect(game: Minigame): void {
    this.previewGame.set(game);
  }

  /**
   * Closes the game instructions overlay without launching.
   */
  onClosePreview(): void {
    this.previewGame.set(null);
  }

  /**
   * Navigates to the selected minigame when "Spiel starten" is clicked.
   */
  onStartGame(game: Minigame): void {
    this.previewGame.set(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/#bubble-hub');
    }
    this.router.navigateByUrl(game.route);
  }
}

