import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AudioService } from '../../../core/services/audio.service';
import { LuckyCardComponent } from './components/lucky-card/lucky-card.component';
import { LuckyProgressComponent } from './components/lucky-progress/lucky-progress.component';
import { UnlockedQuotesListComponent } from './components/unlocked-quotes-list/unlocked-quotes-list.component';
import { LuckQuote } from './models/glueckskarte.model';
import { GlueckskarteStorageService } from './services/glueckskarte-storage.service';

interface SparkleParticle {
  id: number;
  x: number;
  y: number;
  scale: number;
  delay: number;
}

/**
 * Main component for the Zen Glückskarte game experience.
 * Features a 4-card fan selection on new days, direct reveal for returning users,
 * 3D card flips, unlocked quotes chronicle sidebar on the right, and particle animations.
 */
@Component({
  selector: 'app-glueckskarte',
  standalone: true,
  imports: [LuckyCardComponent, LuckyProgressComponent, UnlockedQuotesListComponent],
  templateUrl: './glueckskarte.component.html',
  styleUrls: ['./glueckskarte.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlueckskarteComponent implements OnInit, OnDestroy {
  readonly storageService = inject(GlueckskarteStorageService);
  readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

  /** The 4 visual fan cards representing the intuitive choice */
  readonly fanCards = [0, 1, 2, 3];

  /** Whether today's card is currently showing its revealed front face */
  readonly isFlipped = signal<boolean>(false);

  /** Currently revealed quote (or today's existing quote) */
  readonly currentQuote = signal<LuckQuote | null>(null);

  /** List of all unlocked quotes from local storage */
  readonly unlockedQuotes = computed(() => this.storageService.unlockedQuotes());

  /** ID of active quote to highlight and center in the right list */
  readonly activeQuoteId = computed(() => {
    return this.currentQuote()?.id ?? this.storageService.latestUnlockedQuote()?.id ?? null;
  });

  /** Real-time formatted countdown until next day */
  readonly countdown = signal<string>('');

  /** Sparkle particles burst on flip */
  readonly sparkles = signal<SparkleParticle[]>([]);

  /** Timer handle for countdown */
  private timerIntervalId: number | null = null;

  /** Reactive progress computed from storage */
  readonly progress = computed(() => this.storageService.progress());

  /** Whether the user can draw today */
  readonly canDrawToday = computed(() => this.storageService.canDrawToday());

  /** Bubble letters heading data for playful bounce & cursor evasion */
  readonly titleWords: { letters: { char: string; globalIndex: number }[] }[] = (() => {
    const rawWords = ['Zen', 'Glückskarte'];
    let runningIndex = 0;
    return rawWords.map((word) => ({
      letters: Array.from(word).map((char) => ({
        char,
        globalIndex: runningIndex++,
      })),
    }));
  })();

  // Heading Letters Pointer Evasion
  private mouseEvadeRafId: number | null = null;
  private lastPointerEvent: PointerEvent | null = null;
  private isDestroyed = false;

  ngOnInit(): void {
    // Check if card was already revealed earlier today.
    // If so, skip the 4 fan cards and display today's revealed card directly!
    if (!this.storageService.canDrawToday()) {
      const existing = this.storageService.todayQuote();
      if (existing) {
        this.currentQuote.set(existing);
        this.isFlipped.set(true);
      }
    }

    this.updateCountdown();
    this.startCountdownTimer();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.timerIntervalId !== null) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
    if (this.mouseEvadeRafId !== null) {
      cancelAnimationFrame(this.mouseEvadeRafId);
      this.mouseEvadeRafId = null;
    }
  }

  /**
   * Pointer move handler for bubble letters evasion physics.
   */
  onHeadingPointerMove(event: PointerEvent): void {
    this.lastPointerEvent = event;
    if (this.mouseEvadeRafId !== null) return;

    this.mouseEvadeRafId = requestAnimationFrame(() => {
      this.mouseEvadeRafId = null;
      if (!this.lastPointerEvent || this.isDestroyed) return;
      this.applyEvadeToLetters(this.lastPointerEvent);
    });
  }

  /**
   * Smoothly resets letter positions when the pointer leaves the heading.
   */
  onHeadingPointerLeave(): void {
    if (this.mouseEvadeRafId !== null) {
      cancelAnimationFrame(this.mouseEvadeRafId);
      this.mouseEvadeRafId = null;
    }
    this.lastPointerEvent = null;
    this.resetLettersEvade();
  }

  private applyEvadeToLetters(event: PointerEvent): void {
    const letters = document.querySelectorAll<HTMLElement>('.header-titles .bubble-letter');
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    const radius = 80;
    const maxPush = 14;

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
        const pushX = (dx / dist) * force * maxPush;
        const pushY = (dy / dist) * force * maxPush;
        const scale = 1 + force * 0.08;
        const rot = (dx / dist) * force * 2.8;

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

  private resetLettersEvade(): void {
    const letters = document.querySelectorAll<HTMLElement>('.header-titles .bubble-letter');
    letters.forEach((el) => {
      el.style.setProperty('--evade-x', '0px');
      el.style.setProperty('--evade-y', '0px');
      el.style.setProperty('--evade-scale', '1');
      el.style.setProperty('--evade-rot', '0deg');
    });
  }

  /**
   * Plays subtle hover sound when hovering over any card in the fan.
   */
  onFanCardHover(): void {
    try {
      this.audioService.playBubbleHover();
    } catch {
      // Audio fallback
    }
  }

  /** Fan card index (0..3) chosen by the user for entrance flight animation, or null if on revisit */
  readonly originCardIndex = signal<number | null>(null);

  /**
   * Selects a card from the fan (or via keyboard) and reveals today's random wisdom quote.
   *
   * @param cardIndex - Visual index (0..3) of the selected card in the fan
   */
  onSelectCard(cardIndex: number = 0): void {
    if (!this.canDrawToday() || this.isFlipped()) {
      return;
    }

    // Set origin index to trigger smooth flight & flip animation
    this.originCardIndex.set(cardIndex);

    // Play soothing pentatonic chords
    this.playRevealChimes();

    // Trigger visual sparkles
    this.triggerSparkles();

    // Persist and retrieve random quote from the remaining 100-cycle pool
    const drawn = this.storageService.drawCard();
    this.currentQuote.set(drawn);
    this.isFlipped.set(true);
  }

  /**
   * Called once the 3D flight & flip keyframe animation from the fan completes.
   */
  onCardAnimationFinished(): void {
    this.originCardIndex.set(null);
  }

  /**
   * Compatibility alias for card flip interactions.
   */
  onFlipCard(): void {
    this.onSelectCard(0);
  }

  /**
   * Selects an already unlocked quote from the sidebar chronicle.
   */
  onSelectUnlockedQuote(quote: LuckQuote): void {
    this.currentQuote.set(quote);
    if (!this.isFlipped()) {
      this.isFlipped.set(true);
    }
  }

  /**
   * Navigates back to the main hub.
   */
  onNavigateHome(): void {
    this.audioService.playBubbleHover();
    this.router.navigate(['/']);
  }

  /**
   * Toggles sound mute status.
   */
  toggleSound(): void {
    this.audioService.toggleSound();
  }

  /**
   * Global keyboard shortcut handler.
   */
  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.onNavigateHome();
      return;
    }

    if (this.canDrawToday() && !this.isFlipped()) {
      // Numbers 1 to 4 choose the respective fan card
      if (['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        this.onSelectCard(parseInt(event.key, 10) - 1);
      } else if (event.code === 'Space') {
        event.preventDefault();
        this.onSelectCard(0);
      }
    }
  }

  /**
   * Plays harmonic chime tones on reveal.
   */
  private playRevealChimes(): void {
    try {
      this.audioService.playChime(3, 0.2);
      setTimeout(() => {
        this.audioService.playChime(6, 0.25);
      }, 160);
      setTimeout(() => {
        this.audioService.playChime(8, 0.28);
      }, 340);
    } catch {
      // Audio fallback in non-supported environments
    }
  }

  /**
   * Creates an array of burst sparkle coordinates.
   */
  private triggerSparkles(): void {
    const particles: SparkleParticle[] = [];
    const count = 30;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
      const distance = 120 + Math.random() * 190;
      particles.push({
        id: i,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        scale: 0.6 + Math.random() * 0.8,
        delay: Math.random() * 0.2,
      });
    }
    this.sparkles.set(particles);

    setTimeout(() => {
      this.sparkles.set([]);
    }, 1200);
  }

  /**
   * Starts periodic updates for midnight countdown.
   */
  private startCountdownTimer(): void {
    this.timerIntervalId = window.setInterval(() => {
      this.updateCountdown();
    }, 1000);
  }

  /**
   * Recalculates countdown until next midnight.
   */
  private updateCountdown(): void {
    const time = this.storageService.getTimeUntilMidnight();
    this.countdown.set(time.formatted);
  }
}
