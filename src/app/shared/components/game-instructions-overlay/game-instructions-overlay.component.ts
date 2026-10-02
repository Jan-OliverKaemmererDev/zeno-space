import {
  Component,
  Input,
  output,
  signal,
  inject,
  HostListener,
  ElementRef,
  ViewChild,
  OnInit,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { Minigame } from '../../../core/models/minigame.model';
import { AudioService } from '../../../core/services/audio.service';
import { SmoothScrollService } from '../../../core/services/smooth-scroll.service';

import { GameInstructionsHeaderComponent } from './components/game-instructions-header/game-instructions-header.component';
import { GameInstructionsIntroComponent } from './components/game-instructions-intro/game-instructions-intro.component';
import { GameInstructionsKeyboardComponent } from './components/game-instructions-keyboard/game-instructions-keyboard.component';
import { GameInstructionsMouseComponent } from './components/game-instructions-mouse/game-instructions-mouse.component';
import { GameInstructionsFooterComponent } from './components/game-instructions-footer/game-instructions-footer.component';

/**
 * Modal overlay presenting minigame controls (animated keyboard keys & mouse inputs),
 * concise overview, and the "Spiel starten" launch trigger.
 * Rendered in root viewport layer with full background scroll lock and custom orb cursor support.
 */
@Component({
  selector: 'app-game-instructions-overlay',
  standalone: true,
  imports: [
    GameInstructionsHeaderComponent,
    GameInstructionsIntroComponent,
    GameInstructionsKeyboardComponent,
    GameInstructionsMouseComponent,
    GameInstructionsFooterComponent,
  ],
  templateUrl: './game-instructions-overlay.component.html',
  styleUrl: './game-instructions-overlay.component.scss',
})
export class GameInstructionsOverlayComponent implements OnInit, AfterViewInit, OnDestroy {
  /** The minigame whose instructions and launch controls are shown. */
  @Input({ required: true }) game!: Minigame;

  /** Emitted when the user dismisses the overlay without starting. */
  readonly close = output<void>();

  /** Emitted when the user confirms and clicks "Spiel starten". */
  readonly startGame = output<Minigame>();

  readonly audioService = inject(AudioService);
  private readonly smoothScroll = inject(SmoothScrollService, { optional: true });
  private readonly el = inject(ElementRef);

  @ViewChild('cardRef') cardRef?: ElementRef<HTMLElement>;

  /** Whether the modal is currently executing its exit animation. */
  readonly isClosing = signal<boolean>(false);

  private isScrollLocked = false;
  private prevBodyOverflow = '';
  private prevHtmlOverflow = '';
  private prevBodyOverscroll = '';
  private prevHtmlOverscroll = '';

  /**
   * Intercepts wheel events on the backdrop to prevent background page scroll bleed.
   * Scrolling within the card is permitted if its content is taller than the viewport.
   */
  private readonly onBackdropWheel = (event: WheelEvent): void => {
    const target = event.target as HTMLElement | null;
    const card = this.cardRef?.nativeElement ?? this.el.nativeElement.querySelector('.game-instructions-card');
    if (!card || !target || !card.contains(target)) {
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (card.scrollHeight <= card.clientHeight) {
      if (event.cancelable) {
        event.preventDefault();
      }
    }
  };

  /**
   * Intercepts touch gestures on smart devices to prevent background pull and scroll bleed.
   */
  private readonly onBackdropTouchMove = (event: TouchEvent): void => {
    const target = event.target as HTMLElement | null;
    const card = this.cardRef?.nativeElement ?? this.el.nativeElement.querySelector('.game-instructions-card');
    if (!card || !target || !card.contains(target)) {
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (card.scrollHeight <= card.clientHeight) {
      if (event.cancelable) {
        event.preventDefault();
      }
    }
  };

  ngOnInit(): void {
    this.lockScroll();
  }

  ngAfterViewInit(): void {
    const backdrop = this.el.nativeElement.querySelector('.game-instructions-backdrop') as HTMLElement | null;
    if (backdrop) {
      backdrop.addEventListener('wheel', this.onBackdropWheel, { passive: false });
      backdrop.addEventListener('touchmove', this.onBackdropTouchMove, { passive: false });
    }

    // Focus the primary start button for accessibility
    setTimeout(() => {
      const startBtn = this.el.nativeElement.querySelector('.btn-start-game') as HTMLButtonElement | null;
      startBtn?.focus();
    }, 100);
  }

  ngOnDestroy(): void {
    const backdrop = this.el.nativeElement.querySelector('.game-instructions-backdrop') as HTMLElement | null;
    if (backdrop) {
      backdrop.removeEventListener('wheel', this.onBackdropWheel);
      backdrop.removeEventListener('touchmove', this.onBackdropTouchMove);
    }
    this.unlockScroll();
  }

  /**
   * Closes the overlay if Escape key is pressed.
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.handleClose();
  }

  /**
   * Handles user request to close the overlay.
   */
  handleClose(): void {
    if (this.isClosing()) return;
    this.isClosing.set(true);
    this.audioService.playBubbleHover();

    setTimeout(() => {
      this.unlockScroll();
      this.close.emit();
    }, 220);
  }

  /**
   * Handles backdrop click to close the overlay.
   */
  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('game-instructions-backdrop')) {
      this.handleClose();
    }
  }

  /**
   * Handles launch request when user clicks "Spiel starten".
   */
  handleStartGame(): void {
    if (this.isClosing()) return;
    this.isClosing.set(true);
    this.audioService.playBubblePop(1.1);

    setTimeout(() => {
      this.unlockScroll();
      this.startGame.emit(this.game);
    }, 250);
  }

  /**
   * Locks background page scrolling completely on desktop and touch smart devices.
   */
  private lockScroll(): void {
    if (this.isScrollLocked) return;
    this.isScrollLocked = true;

    this.smoothScroll?.setEnabled(false);

    if (typeof document !== 'undefined') {
      this.prevBodyOverflow = document.body.style.overflow;
      this.prevHtmlOverflow = document.documentElement.style.overflow;
      this.prevBodyOverscroll = document.body.style.overscrollBehavior;
      this.prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overscrollBehavior = 'none';
    }
  }

  /**
   * Restores background scrolling and reconnects the smooth scroll engine.
   */
  private unlockScroll(): void {
    if (!this.isScrollLocked) return;
    this.isScrollLocked = false;

    if (typeof document !== 'undefined') {
      document.body.style.overflow = this.prevBodyOverflow;
      document.documentElement.style.overflow = this.prevHtmlOverflow;
      document.body.style.overscrollBehavior = this.prevBodyOverscroll;
      document.documentElement.style.overscrollBehavior = this.prevHtmlOverscroll;
    }

    this.smoothScroll?.setEnabled(true);
    this.smoothScroll?.syncWithCurrentScroll();
  }
}
