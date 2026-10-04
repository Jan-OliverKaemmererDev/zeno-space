import { Component, Input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PhiSpeechBubbleComponent } from '../phi-speech-bubble/phi-speech-bubble.component';

/**
 * Top Glass HUD Header for the Goldener Schnitt minigame.
 * Displays navigation back-link, Phi live snippet pill with interactive speech-bubble,
 * and total seeds count.
 */
@Component({
  selector: 'app-goldener-schnitt-header',
  standalone: true,
  imports: [RouterLink, PhiSpeechBubbleComponent],
  templateUrl: './goldener-schnitt-header.component.html',
  styleUrl: './goldener-schnitt-header.component.scss',
})
export class GoldenerSchnittHeaderComponent {
  /** Formatted snippet of current Phi progression for HUD pill. */
  @Input({ required: true }) currentPhiSnippet!: string;

  /** Formatted total count of generated seeds. */
  @Input({ required: true }) totalSeedsFormatted!: string;

  /** Total numerical seed count for Fibonacci ratio calculation. */
  @Input() seedCount = 0;

  /** Full stream of generated decimals following '1,618'. */
  @Input({ required: true }) generatedPhiDecimals!: string;

  /** Whether the Phi speech bubble is currently open. */
  @Input({ required: true }) showBubble!: boolean;

  /** Whether the Phi speech bubble is currently in its closing animation. */
  @Input({ required: true }) closingBubble!: boolean;

  /** Emitted when the user clicks the stat pill to toggle the bubble. */
  readonly toggleBubble = output<Event>();

  /** Emitted when the speech bubble close button is clicked. */
  readonly closeBubble = output<void>();

  onStatPillClick(event: Event): void {
    event.stopPropagation();
    this.toggleBubble.emit(event);
  }

  onBubbleClose(): void {
    this.closeBubble.emit();
  }
}
