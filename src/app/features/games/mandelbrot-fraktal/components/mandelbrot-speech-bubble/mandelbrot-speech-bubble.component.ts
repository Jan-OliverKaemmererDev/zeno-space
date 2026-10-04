import { Component, Input, output, signal } from '@angular/core';

/**
 * Interactive glass speech bubble modal displaying mathematical insights,
 * exact coordinates, iteration parameters, and copy-to-clipboard functionality.
 */
@Component({
  selector: 'app-mandelbrot-speech-bubble',
  standalone: true,
  templateUrl: './mandelbrot-speech-bubble.component.html',
  styleUrl: './mandelbrot-speech-bubble.component.scss',
})
export class MandelbrotSpeechBubbleComponent {
  @Input({ required: true }) currentWaypointName!: string;
  @Input({ required: true }) coordSnippet!: string;
  @Input({ required: true }) zoomFormatted!: string;
  @Input({ required: true }) iterations!: number;
  @Input({ required: true }) centerX!: number;
  @Input({ required: true }) centerY!: number;
  @Input({ required: true }) rawZoom!: number;
  @Input() generationLevel: number = 0;
  @Input() isClosing: boolean = false;

  readonly close = output<void>();

  readonly isCopied = signal<boolean>(false);
  private copyTimeout: ReturnType<typeof setTimeout> | null = null;

  copyCoordinates(event?: Event): void {
    event?.stopPropagation();
    const coordText = `Re: ${this.centerX}, Im: ${this.centerY} (Zoom: ${this.zoomFormatted}, Ebene: ${this.generationLevel})`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(coordText).catch(() => {});
    }

    this.isCopied.set(true);
    if (this.copyTimeout) clearTimeout(this.copyTimeout);
    this.copyTimeout = setTimeout(() => {
      this.isCopied.set(false);
    }, 2200);
  }

  handleClose(event?: Event): void {
    event?.stopPropagation();
    this.close.emit();
  }

  onBubbleWheel(event: WheelEvent): void {
    event.stopPropagation();
  }
}
