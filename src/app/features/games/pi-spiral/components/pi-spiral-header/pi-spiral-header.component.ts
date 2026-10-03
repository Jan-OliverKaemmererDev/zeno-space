import { Component, Input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PiSpeechBubbleComponent } from '../pi-speech-bubble/pi-speech-bubble.component';

/**
 * Top Glass HUD Header for the Pi Spiral minigame.
 * Displays navigation back-link, Pi live snippet pill with interactive speech-bubble,
 * and total decimals count.
 */
@Component({
  selector: 'app-pi-spiral-header',
  standalone: true,
  imports: [RouterLink, PiSpeechBubbleComponent],
  templateUrl: './pi-spiral-header.component.html',
  styleUrl: './pi-spiral-header.component.scss',
})
export class PiSpiralHeaderComponent {
  /** Formatted snippet of the current Pi digit progression for the HUD pill. */
  @Input({ required: true }) currentPiSnippet!: string;

  /** Formatted total count of generated decimals. */
  @Input({ required: true }) totalDecimalsFormatted!: string;

  /** Full stream of generated decimals following '3,14'. */
  @Input({ required: true }) generatedPiDecimals!: string;

  /** Whether the Pi speech bubble is currently open. */
  @Input({ required: true }) showBubble!: boolean;

  /** Whether the Pi speech bubble is currently in its closing animation. */
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
