import { Component, Input } from '@angular/core';

/**
 * Introduction section for game instructions overlay, presenting
 * the subtitle, descriptive summary, and gameplay objective hint.
 */
@Component({
  selector: 'app-game-instructions-intro',
  standalone: true,
  templateUrl: './game-instructions-intro.component.html',
  styleUrl: './game-instructions-intro.component.scss',
})
export class GameInstructionsIntroComponent {
  /** The subtitle or category tagline of the game. */
  @Input({ required: true }) subtitle!: string;

  /** The description detailing the game experience. */
  @Input({ required: true }) description!: string;

  /** Optional gameplay objective tip. */
  @Input() objective?: string;
}
