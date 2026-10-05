import { Component, Input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MandelbrotSpeechBubbleComponent } from '../mandelbrot-speech-bubble/mandelbrot-speech-bubble.component';

/**
 * Header HUD for the Mandelbrot Fractal minigame, matching the glass aesthetic of Goldener Schnitt.
 * Features back-link, formula status pill, live zoom & generation layer counters, and modal speech bubble.
 */
@Component({
  selector: 'app-mandelbrot-header',
  standalone: true,
  imports: [RouterLink, MandelbrotSpeechBubbleComponent],
  templateUrl: './mandelbrot-header.component.html',
  styleUrl: './mandelbrot-header.component.scss',
})
export class MandelbrotHeaderComponent {
  @Input({ required: true }) zoomFormatted!: string;
  @Input({ required: true }) iterations!: number;
  @Input({ required: true }) currentWaypointName!: string;
  @Input({ required: true }) coordSnippet!: string;
  @Input({ required: true }) currentCenterX!: number | string;
  @Input({ required: true }) currentCenterY!: number | string;
  @Input({ required: true }) currentZoomRaw!: number;
  @Input() generationLevel: number = 0;
  @Input({ required: true }) showBubble!: boolean;
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
