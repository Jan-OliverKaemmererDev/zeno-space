import { Component, Input, output, signal, computed } from '@angular/core';
import { getFibonacciRatio } from '../../utils/phyllotaxis-geometry';

/**
 * Floating speech bubble modal displaying the generated Phi decimals
 * and Fibonacci convergence ratio with animated balloon inflation/deflation.
 */
@Component({
  selector: 'app-phi-speech-bubble',
  standalone: true,
  templateUrl: './phi-speech-bubble.component.html',
  styleUrl: './phi-speech-bubble.component.scss',
})
export class PhiSpeechBubbleComponent {
  /** The generated decimal digits sequence following '1,618'. */
  @Input({ required: true }) generatedPhiDecimals!: string;

  /** Total count of placed seeds formatted as a string. */
  @Input({ required: true }) totalSeedsFormatted!: string;

  /** Numerical count of seeds for calculating Fibonacci convergence. */
  @Input() seedCount = 0;

  /** Whether the balloon deflate closing animation is running. */
  @Input({ required: true }) isClosing!: boolean;

  /** Emitted when the user requests to close the speech bubble. */
  readonly close = output<void>();

  /** Whether the Phi sequence was recently copied to clipboard. */
  readonly isPhiCopied = signal<boolean>(false);
  private copyPhiTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Current Fibonacci convergence ratio info. */
  readonly fibonacciRatioInfo = computed(() => {
    // Map seed count to Fibonacci step (clamp to reasonable sequence)
    const step = Math.max(1, Math.min(25, Math.floor(this.seedCount / 4) + 1));
    return getFibonacciRatio(step);
  });

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
   * Copies the full Golden Ratio sequence starting with '1,618' to the clipboard.
   */
  copyPhiNumber(event?: Event): void {
    event?.stopPropagation();
    const text = '1,618' + (this.generatedPhiDecimals || '');
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.isPhiCopied.set(true);
        if (this.copyPhiTimeout) clearTimeout(this.copyPhiTimeout);
        this.copyPhiTimeout = setTimeout(() => {
          this.isPhiCopied.set(false);
          this.copyPhiTimeout = null;
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
