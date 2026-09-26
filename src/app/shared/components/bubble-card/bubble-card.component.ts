import {
  Component,
  Input,
  inject,
  ElementRef,
  HostListener,
  output,
  computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { Minigame } from '../../../core/models/minigame.model';
import { AudioService } from '../../../core/services/audio.service';
import { GameRegistryService } from '../../../core/services/game-registry.service';

/**
 * Component representing an interactive 3D-tilted bubble card for minigame showcases.
 */
@Component({
  selector: 'app-bubble-card',
  templateUrl: './bubble-card.component.html',
  styleUrl: './bubble-card.component.scss',
})
export class BubbleCardComponent {
  /**
   * The minigame data model rendered by this card.
   */
  @Input({ required: true }) game!: Minigame;

  /**
   * Emits when a category tag is selected on the card.
   */
  readonly categorySelect = output<string>();

  private readonly router = inject(Router);
  private readonly audioService = inject(AudioService);
  private readonly gameRegistry = inject(GameRegistryService);
  private readonly el = inject(ElementRef);

  /**
   * Currently active category identifier from the game registry.
   */
  readonly activeCategory = computed(() => this.gameRegistry.selectedCategory());

  /**
   * Whether the card is currently hovered by the user pointer.
   */
  isHovered = false;

  /**
   * Whether the card is executing its popping/opening animation sequence.
   */
  isPopping = false;

  /**
   * Calculated tilt angle on the X axis in degrees.
   */
  tiltX = 0;

  /**
   * Calculated tilt angle on the Y axis in degrees.
   */
  tiltY = 0;

  /**
   * Handles pointer entrance on the card to trigger hover effects and audio.
   *
   * @returns {void}
   */
  @HostListener('mouseenter')
  onMouseEnter(): void {
    this.isHovered = true;
    this.audioService.playBubbleHover();
  }

  /**
   * Handles pointer exit from the card to reset hover state and tilt angles.
   *
   * @returns {void}
   */
  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.isHovered = false;
    this.tiltX = 0;
    this.tiltY = 0;
  }

  /**
   * Calculates a subtle perspective tilt transform based on pointer coordinates relative to card center.
   *
   * @param {MouseEvent} event - The mouse move event.
   * @returns {void}
   */
  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    const rect = this.el.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    
    // Ultra-subtle micro-tilt (max 2 degrees instead of 10)
    this.tiltX = (-y / (rect.height / 2)) * 2;
    this.tiltY = (x / (rect.width / 2)) * 2;
  }

  /**
   * Normalizes a tag string into a standard category identifier.
   *
   * @param {string} tag - The raw tag text to normalize.
   * @returns {string} The normalized category ID or raw trimmed lowercased string.
   */
  normalizeTagToCategory(tag: string): string {
    const lower = tag.trim().toLowerCase();
    const map: Record<string, string> = {
      mathematik: 'mathematik',
      astronomie: 'astronomie',
      natur: 'natur',
      geräusche: 'geraeusche',
      geraeusche: 'geraeusche',
      relax: 'relax',
      abenteuer: 'abenteuer',
    };
    return map[lower] ?? lower;
  }

  /**
   * Checks whether a given tag matches the currently active category filter.
   *
   * @param {string} tag - The tag label to verify.
   * @returns {boolean} True if the tag corresponds to the active category, false otherwise.
   */
  isTagActive(tag: string): boolean {
    const active = this.activeCategory();
    if (!active || active === 'all') return false;
    return this.normalizeTagToCategory(tag) === active.toLowerCase();
  }

  /**
   * Handles clicks on a category badge tag, updating the registry and emitting an event.
   *
   * @param {string} tag - The clicked tag string.
   * @param {MouseEvent} event - The mouse click event.
   * @returns {void}
   */
  onTagClick(tag: string, event: MouseEvent): void {
    event.stopPropagation();
    const cat = this.normalizeTagToCategory(tag);
    this.gameRegistry.setSelectedCategory(cat);
    this.audioService.playChime(3, 0.15);
    this.categorySelect.emit(cat);
  }

  /**
   * Initiates the game launch sequence, playing a bubble pop animation and navigating to the game route.
   *
   * @param {MouseEvent} [event] - Optional mouse event to stop bubbling.
   * @returns {void}
   */
  openGame(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.isPopping) return;
    this.isPopping = true;
    this.audioService.playBubblePop();

    // Short pop animation before navigation
    setTimeout(() => {
      this.router.navigateByUrl(this.game.route);
    }, 350);
  }
}
