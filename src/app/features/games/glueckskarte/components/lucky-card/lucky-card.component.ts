import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { CATEGORY_CONFIG } from '../../data/glueckskarte.data';
import { LuckQuote } from '../../models/glueckskarte.model';

/**
 * 3D Flip Card displaying either the mysterious Zen back ornament
 * or the revealed daily wisdom quote on its front face.
 */
@Component({
  selector: 'app-lucky-card',
  standalone: true,
  templateUrl: './lucky-card.component.html',
  styleUrls: ['./lucky-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LuckyCardComponent {
  /** The revealed quote object, or null if unrevealed */
  @Input() quote: LuckQuote | null = null;

  /** Whether the card is currently flipped to the front side */
  @Input() isFlipped = false;

  /** Whether the user can draw a new card today */
  @Input() canDrawToday = true;

  /** Current completion cycle number */
  @Input() cycleCount = 1;

  /** Emitted when the user triggers the flip via click or keyboard */
  @Output() flipCard = new EventEmitter<void>();

  /** Hover micro-tilt degrees */
  tiltX = 0;
  tiltY = 0;

  constructor(private readonly el: ElementRef<HTMLElement>) {}

  /**
   * Retrieves category metadata including color and label.
   */
  get categoryMeta() {
    if (!this.quote) return null;
    return CATEGORY_CONFIG[this.quote.category] ?? null;
  }

  /**
   * Triggers card reveal if eligible to draw or if flipped.
   */
  onCardClick(): void {
    if (this.canDrawToday && !this.isFlipped) {
      this.flipCard.emit();
    }
  }

  /**
   * Handles keyboard interaction (Space or Enter to flip).
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      this.onCardClick();
    }
  }

  /**
   * Calculates perspective micro-tilt based on cursor position.
   */
  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    const rect = this.el.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    this.tiltX = (-y / (rect.height / 2)) * 4;
    this.tiltY = (x / (rect.width / 2)) * 4;
  }

  /**
   * Resets tilt on mouse leave.
   */
  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.tiltX = 0;
    this.tiltY = 0;
  }
}
