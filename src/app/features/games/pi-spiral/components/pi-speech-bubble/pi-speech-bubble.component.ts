import { Component, Input, output, signal } from '@angular/core';

/**
 * Floating speech bubble modal displaying the generated Pi digits
 * with animated balloon inflation/deflation and custom scrollable body.
 */
@Component({
  selector: 'app-pi-speech-bubble',
  standalone: true,
  templateUrl: './pi-speech-bubble.component.html',
  styleUrl: './pi-speech-bubble.component.scss',
})
export class PiSpeechBubbleComponent {
  /** The generated decimal digits sequence following '3,14'. */
  @Input({ required: true }) generatedPiDecimals!: string;

  /** Total count of decimal places formatted as a string. */
  @Input({ required: true }) totalDecimalsFormatted!: string;

  /** Whether the balloon deflate closing animation is running. */
  @Input({ required: true }) isClosing!: boolean;

  /** Emitted when the user requests to close the speech bubble. */
  readonly close = output<void>();

  /** Whether the Pi sequence was recently copied to clipboard. */
  readonly isPiCopied = signal<boolean>(false);
  private copyPiTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Prevents mouse wheel scrolling on speech bubble from zooming the parent 3D canvas,
   * while allowing the bubble body to scroll natively.
   */
  onBubbleWheel(event: WheelEvent): void {
    event.stopPropagation();
    const target = event.target as HTMLElement | null;
    const bubble = event.currentTarget as HTMLElement | null;
    const body = bubble?.querySelector('.bubble-body') as HTMLElement | null;
    if (body && target && !body.contains(target)) {
      body.scrollTop += event.deltaY;
      event.preventDefault();
    }
  }

  /**
   * Copies the full Pi number sequence starting with '3,14' to the clipboard.
   */
  copyPiNumber(event?: Event): void {
    event?.stopPropagation();
    const text = '3,14' + (this.generatedPiDecimals || '');
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.isPiCopied.set(true);
        if (this.copyPiTimeout) clearTimeout(this.copyPiTimeout);
        this.copyPiTimeout = setTimeout(() => {
          this.isPiCopied.set(false);
          this.copyPiTimeout = null;
        }, 1800);
      });
    }
  }

  /**
   * Requests speech bubble closure.
   */
  handleClose(event?: Event): void {
    event?.stopPropagation();
    this.close.emit();
  }
}
