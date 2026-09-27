import {
  Component,
  signal,
  output,
  AfterViewInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { SoundBeaconComponent } from '../sound-beacon/sound-beacon.component';

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
 * Hero section of the landing page featuring the animated "Willkommen im Zeno-Space"
 * bubble letters heading with FLIP smooth-wrapping, cursor evasion physics,
 * sound beacon, and the animated scroll prompter.
 */
@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [SoundBeaconComponent],
  templateUrl: './hero-section.component.html',
  styleUrl: './hero-section.component.scss',
})
export class HeroSectionComponent implements AfterViewInit, OnDestroy {
  /** Emitted when the scroll prompter is clicked to smoothly scroll down. */
  readonly scrollDown = output<void>();

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
  readonly isPrompterVisible = signal<boolean>(true);
  readonly hasPrompterScrolledOnce = signal<boolean>(false);

  private isDestroyed = false;

  // FLIP Layout Wrapping Animation
  private phraseResizeObserver: ResizeObserver | null = null;
  private phraseRafId: number | null = null;
  private lastPhraseRects = new Map<HTMLElement, DOMRect>();
  private isPhraseLayoutInitialized = false;

  // Heading Evasion
  private mouseEvadeRafId: number | null = null;
  private lastPointerEvent: PointerEvent | null = null;

  // Prompter Evasion
  private prompterEvadeRafId: number | null = null;
  private lastPrompterPointerEvent: PointerEvent | null = null;

  ngAfterViewInit(): void {
    this.initPhraseSmoothWrapping();
    if (typeof window !== 'undefined') {
      const atTop = window.scrollY <= 15;
      if (!atTop) {
        this.hasPrompterScrolledOnce.set(true);
        this.isPrompterVisible.set(false);
      }
    }
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
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onWindowResizeForPhrases);
    }
    if (this.mouseEvadeRafId !== null) {
      cancelAnimationFrame(this.mouseEvadeRafId);
      this.mouseEvadeRafId = null;
    }
    if (this.prompterEvadeRafId !== null) {
      cancelAnimationFrame(this.prompterEvadeRafId);
      this.prompterEvadeRafId = null;
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const atTop = window.scrollY <= 15;
    if (atTop !== this.isPrompterVisible()) {
      if (!atTop) {
        this.hasPrompterScrolledOnce.set(true);
      }
      this.isPrompterVisible.set(atTop);
    }
  }

  onPrompterClick(): void {
    this.hasPrompterScrolledOnce.set(true);
    this.isPrompterVisible.set(false);
    this.scrollDown.emit();
  }

  // ----------------------------------------------------
  // FLIP Technique for Smooth Phrase Layout Wrapping
  // ----------------------------------------------------
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
    const phrases = Array.from(document.querySelectorAll<HTMLElement>('.hero-center-container .bubble-phrase'));
    if (phrases.length === 0) return;

    if (!this.isPhraseLayoutInitialized) {
      phrases.forEach((el) => {
        this.lastPhraseRects.set(el, el.getBoundingClientRect());
      });
      this.isPhraseLayoutInitialized = true;
      return;
    }

    const newRects = new Map<HTMLElement, DOMRect>();
    phrases.forEach((el) => {
      el.style.transition = 'none';
      el.style.transform = '';
      newRects.set(el, el.getBoundingClientRect());
    });

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

    document.body.offsetHeight; // Force reflow

    requestAnimationFrame(() => {
      phrases.forEach((el) => {
        el.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = 'translate3d(0, 0, 0)';
      });
    });
  }

  // ----------------------------------------------------
  // Heading Letters Pointer Evasion
  // ----------------------------------------------------
  onHeadingPointerMove(event: PointerEvent): void {
    this.lastPointerEvent = event;
    if (this.mouseEvadeRafId !== null) return;

    this.mouseEvadeRafId = requestAnimationFrame(() => {
      this.mouseEvadeRafId = null;
      if (!this.lastPointerEvent || this.isDestroyed) return;
      this.applyEvadeToLetters(this.lastPointerEvent, '.hero-center-container .bubble-letter');
    });
  }

  onHeadingPointerLeave(): void {
    if (this.mouseEvadeRafId !== null) {
      cancelAnimationFrame(this.mouseEvadeRafId);
      this.mouseEvadeRafId = null;
    }
    this.lastPointerEvent = null;
    this.resetLettersEvade('.hero-center-container .bubble-letter');
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

  // ----------------------------------------------------
  // Prompter Word Evasion
  // ----------------------------------------------------
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
    const radius = 65;
    const maxPush = 5.5;

    words.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - mouseX;
      const dy = cy - mouseY;
      const dist = Math.hypot(dx, dy);

      if (dist < radius && dist > 0.001) {
        const norm = dist / radius;
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
}
