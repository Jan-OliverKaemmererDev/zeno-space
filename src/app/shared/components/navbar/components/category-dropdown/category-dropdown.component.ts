import { Component, ElementRef, inject, input, output } from '@angular/core';
import { CategoryItem } from '../../navbar.models';

/**
 * Origami unfolding category menu panel showcasing interactive minigame categories
 * with 3D paper fold animations, accessible keyboard navigation, and responsive layouts.
 */
@Component({
  selector: 'app-category-dropdown',
  standalone: true,
  templateUrl: './category-dropdown.component.html',
  styleUrl: './category-dropdown.component.scss',
})
export class CategoryDropdownComponent {
  private readonly elementRef = inject(ElementRef);

  /** Whether the dropdown menu is open. */
  readonly isOpen = input<boolean>(false);

  /** Whether the dropdown menu is currently playing its closing fold sequence. */
  readonly isClosing = input<boolean>(false);

  /** List of available categories with presentation data and SVG icons. */
  readonly categories = input<CategoryItem[]>([]);

  /** Currently selected category item, or null if unfiltered. */
  readonly selectedCategory = input<CategoryItem | null>(null);

  /** Emits the selected CategoryItem when clicked or activated. */
  readonly categorySelect = output<CategoryItem>();

  /** Emits when the user resets the category filter ("Alle Welten anzeigen"). */
  readonly resetCategoryFilter = output<MouseEvent | undefined>();

  /**
   * Handles keyboard navigation (Arrow keys, Home, End) among category cards.
   *
   * @param {KeyboardEvent} event - The keyboard event.
   * @param {number} index - Index of the current active card.
   * @returns {void}
   */
  onCategoryKeydown(event: KeyboardEvent, index: number): void {
    const host = this.elementRef.nativeElement as HTMLElement;
    const cards = Array.from(host.querySelectorAll('.category-card')) as HTMLElement[];
    if (!cards.length) return;

    let targetIndex = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      targetIndex = (index + 1) % cards.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      targetIndex = (index - 1 + cards.length) % cards.length;
    } else if (event.key === 'Home') {
      targetIndex = 0;
    } else if (event.key === 'End') {
      targetIndex = cards.length - 1;
    }

    if (targetIndex >= 0) {
      event.preventDefault();
      cards[targetIndex].focus();
    }
  }

  /**
   * Focuses the first category card for immediate keyboard accessibility.
   *
   * @returns {void}
   */
  focusFirstCard(): void {
    const firstCard = (this.elementRef.nativeElement as HTMLElement).querySelector(
      '.category-card'
    ) as HTMLElement | null;
    if (firstCard) {
      firstCard.focus();
    }
  }
}
