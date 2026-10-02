import { Component, Input, output } from '@angular/core';

/**
 * Header row for the game instructions overlay, featuring the game title
 * and close button in a clean single-row layout.
 */
@Component({
  selector: 'app-game-instructions-header',
  standalone: true,
  templateUrl: './game-instructions-header.component.html',
  styleUrl: './game-instructions-header.component.scss',
})
export class GameInstructionsHeaderComponent {
  /** The title of the minigame. */
  @Input({ required: true }) title!: string;

  /** Emitted when the user clicks the close button. */
  readonly close = output<void>();
}
