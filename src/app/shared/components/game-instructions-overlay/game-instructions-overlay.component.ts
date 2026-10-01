import {
  Component,
  Input,
  output,
  signal,
  inject,
  HostListener,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { Minigame } from '../../../core/models/minigame.model';
import { AudioService } from '../../../core/services/audio.service';

/**
 * Modal overlay presenting minigame controls (animated keyboard keys & mouse inputs),
 * concise overview, and the "Spiel starten" launch trigger.
 */
@Component({
  selector: 'app-game-instructions-overlay',
  standalone: true,
  templateUrl: './game-instructions-overlay.component.html',
  styleUrl: './game-instructions-overlay.component.scss',
})
export class GameInstructionsOverlayComponent implements AfterViewInit {
  /** The minigame whose instructions and launch controls are shown. */
  @Input({ required: true }) game!: Minigame;

  /** Emitted when the user dismisses the overlay without starting. */
  readonly close = output<void>();

  /** Emitted when the user confirms and clicks "Spiel starten". */
  readonly startGame = output<Minigame>();

  readonly audioService = inject(AudioService);
  private readonly el = inject(ElementRef);

  /** Whether the modal is currently executing its exit animation. */
  readonly isClosing = signal<boolean>(false);

  /**
   * Closes the overlay if Escape key is pressed.
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.handleClose();
  }

  ngAfterViewInit(): void {
    // Focus the primary start button for accessibility
    setTimeout(() => {
      const startBtn = this.el.nativeElement.querySelector('.btn-start-game') as HTMLButtonElement | null;
      startBtn?.focus();
    }, 100);
  }

  /**
   * Handles user request to close the overlay.
   */
  handleClose(): void {
    if (this.isClosing()) return;
    this.isClosing.set(true);
    this.audioService.playBubbleHover();

    setTimeout(() => {
      this.close.emit();
    }, 220);
  }

  /**
   * Handles backdrop click to close the overlay.
   */
  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('overlay-backdrop')) {
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
      this.startGame.emit(this.game);
    }, 250);
  }
}
