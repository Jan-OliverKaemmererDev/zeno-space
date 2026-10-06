import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { AudioService } from '../../../../../core/services/audio.service';
import { CATEGORY_CONFIG } from '../../data/glueckskarte.data';
import { LuckQuote } from '../../models/glueckskarte.model';

/**
 * Vertical list of all unlocked wisdom quotes.
 * Displays the current/today quote centered and magnified,
 * with preceding and succeeding quotes faded out towards the top and bottom edges.
 * Supports mouse wheel scrolling without visible scrollbar.
 */
@Component({
  selector: 'app-unlocked-quotes-list',
  standalone: true,
  templateUrl: './unlocked-quotes-list.component.html',
  styleUrls: ['./unlocked-quotes-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnlockedQuotesListComponent implements AfterViewInit, OnChanges {
  private readonly audioService = inject(AudioService);

  @Input() quotes: readonly LuckQuote[] = [];
  @Input() activeQuoteId: number | null = null;
  @Output() selectQuote = new EventEmitter<LuckQuote>();

  @ViewChild('scrollContainer') scrollContainerRef?: ElementRef<HTMLDivElement>;

  ngAfterViewInit(): void {
    this.centerActiveItem('auto');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeQuoteId'] || changes['quotes']) {
      setTimeout(() => this.centerActiveItem('smooth'), 50);
    }
  }

  /**
   * Retrieves category metadata including color and label.
   */
  getCategoryColor(category: string): string {
    return (CATEGORY_CONFIG as any)[category]?.badgeColor ?? '#34d399';
  }

  /**
   * Handles user click on a quote card in the list.
   */
  onCardClick(quote: LuckQuote): void {
    this.audioService.playBubbleHover();
    this.selectQuote.emit(quote);
    setTimeout(() => this.centerActiveItem('smooth'), 20);
  }

  /**
   * Plays soft hover feedback on item hover.
   */
  onItemHover(): void {
    try {
      this.audioService.playBubbleHover();
    } catch {
      // Audio fallback
    }
  }

  /**
   * Smoothly centers the currently active quote in the scroll viewport.
   */
  centerActiveItem(behavior: ScrollBehavior = 'smooth'): void {
    if (!this.scrollContainerRef) return;
    const container = this.scrollContainerRef.nativeElement;
    const activeEl = container.querySelector('.unlocked-item.is-active') as HTMLElement | null;

    if (activeEl) {
      const containerHeight = container.clientHeight;
      const elementTop = activeEl.offsetTop;
      const elementHeight = activeEl.clientHeight;
      const targetScrollTop = elementTop - containerHeight / 2 + elementHeight / 2;

      if (typeof container.scrollTo === 'function') {
        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior,
        });
      } else {
        container.scrollTop = Math.max(0, targetScrollTop);
      }
    }
  }
}
