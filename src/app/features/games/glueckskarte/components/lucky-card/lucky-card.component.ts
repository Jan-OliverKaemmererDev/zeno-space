import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
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
export class LuckyCardComponent implements OnInit, OnChanges {
  /** The revealed quote object, or null if unrevealed */
  @Input() quote: LuckQuote | null = null;

  /** Whether the card is currently flipped to the front side */
  @Input() isFlipped = false;

  /** Whether the user can draw a new card today */
  @Input() canDrawToday = true;

  /** Current completion cycle number */
  @Input() cycleCount = 1;

  /** Fan card index (0..3) if transitioning from fan selection, or null if on revisit */
  @Input() originCardIndex: number | null = null;

  /** Emitted when the user triggers the flip via click or keyboard */
  @Output() flipCard = new EventEmitter<void>();

  /** Emitted when the 3D entrance flight and flip from the fan completes */
  @Output() animationFinished = new EventEmitter<void>();

  /** Whether the front quote face is fully settled and back face completely removed */
  isFullyRevealed = false;

  /** Hover micro-tilt degrees */
  tiltX = 0;
  tiltY = 0;

  constructor(private readonly el: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    this.updateRevealedState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['originCardIndex'] || changes['isFlipped']) {
      this.updateRevealedState();
    }
  }

  private updateRevealedState(): void {
    if (this.originCardIndex === null && this.isFlipped) {
      this.isFullyRevealed = true;
    } else if (this.originCardIndex !== null) {
      this.isFullyRevealed = false;
    } else if (!this.isFlipped) {
      this.isFullyRevealed = false;
    }
  }

  /**
   * Resets the fan origin animation lock once the keyframe completes.
   */
  onAnimationEnd(event: AnimationEvent): void {
    if (event.animationName.includes('flipCard3D') || event.animationName.includes('flyChassis')) {
      this.isFullyRevealed = true;
      this.animationFinished.emit();
    }
  }

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
