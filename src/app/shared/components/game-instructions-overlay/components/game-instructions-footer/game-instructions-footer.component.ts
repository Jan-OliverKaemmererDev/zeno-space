import { Component, Input, output } from '@angular/core';

/**
 * Footer action row for game instructions overlay, featuring the
 * primary "Spiel starten" launcher.
 */
@Component({
  selector: 'app-game-instructions-footer',
  standalone: true,
  templateUrl: './game-instructions-footer.component.html',
  styleUrl: './game-instructions-footer.component.scss',
})
export class GameInstructionsFooterComponent {
  /** Title of the game to populate accessible ARIA label. */
  @Input({ required: true }) gameTitle!: string;

  /** Emitted when user clicks "Spiel starten" confirmation button. */
  readonly startGame = output<void>();
}
