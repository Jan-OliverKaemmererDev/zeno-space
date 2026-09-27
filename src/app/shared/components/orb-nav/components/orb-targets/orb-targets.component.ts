import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavSection, OrbClickSpark, TooltipLetter } from '../../orb-nav.models';

/**
 * Interactive target anchors overlay providing accessible keyboard navigation,
 * click detection, wave-animated tooltips, and floating micro-pixel sparks.
 */
@Component({
  selector: 'app-orb-targets',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orb-targets.component.html',
  styleUrl: './orb-targets.component.scss',
})
export class OrbTargetsComponent {
  /** List of navigational sections. */
  readonly sections = input<NavSection[]>([]);

  /** Currently active section index. */
  readonly activeIndex = input<number>(0);

  /** Currently hovered orb index from raycaster, or null. */
  readonly activeHoverIndex = input<number | null>(null);

  /** Emitted when an orb is clicked or selected via keyboard. */
  readonly orbSelect = output<number>();

  /** Emitted when pointer presses down on an orb target to warm up audio. */
  readonly orbPointerDown = output<void>();

  /** Exact projected screen-Y center coordinates for orbs (height = 260px). */
  readonly orbCenterY = [49, 130, 211];

  /** Subtle click sparks shooting out from clicked orb. */
  readonly activeSparks = signal<OrbClickSpark[]>([]);
  private sparkIdCounter = 0;
  private readonly tooltipLettersCache = new Map<string, TooltipLetter[]>();

  /**
   * Splits a section label into letter objects with right-to-left animation indices, with caching.
   *
   * @param {string} label - The text label to decompose.
   * @returns {TooltipLetter[]} Array of characters with staggered animation indices.
   */
  getTooltipLetters(label: string): TooltipLetter[] {
    let cached = this.tooltipLettersCache.get(label);
    if (!cached) {
      const chars = Array.from(label);
      const total = chars.length;
      cached = chars.map((char, index) => ({
        char,
        fromRight: total - 1 - index,
      }));
      this.tooltipLettersCache.set(label, cached);
    }
    return cached;
  }

  /**
   * Filters and returns active spark particles belonging to a specific orb.
   *
   * @param {number} orbIndex - Index of the orb.
   * @returns {OrbClickSpark[]} Array of active sparks for the specified orb.
   */
  getSparksForOrb(orbIndex: number): OrbClickSpark[] {
    return this.activeSparks().filter((s) => s.orbIndex === orbIndex);
  }

  /**
   * Handles orb clicks to spawn sparks and emit selection event.
   *
   * @param {number} index - Index of the clicked orb.
   */
  onOrbClick(index: number): void {
    this.spawnClickSparks(index);
    this.orbSelect.emit(index);
  }

  /**
   * Emits floating micro-sparks shooting outward from a clicked orb center.
   *
   * @param {number} orbIndex - Index of the target orb.
   */
  spawnClickSparks(orbIndex: number): void {
    const count = Math.random() < 0.5 ? 2 : 3;
    const newSparks: OrbClickSpark[] = [];
    const baseAngle = Math.random() * Math.PI * 2;

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i * ((Math.PI * 2) / count)) + (Math.random() - 0.5) * 0.5;
      const startDist = 14 + Math.random() * 4;
      const endDist = startDist + 14 + Math.random() * 12;
      const isBlue = Math.random() < 0.45;

      newSparks.push({
        id: ++this.sparkIdCounter,
        orbIndex,
        startX: Math.round(Math.cos(angle) * startDist * 10) / 10,
        startY: Math.round(Math.sin(angle) * startDist * 10) / 10,
        endX: Math.round(Math.cos(angle) * endDist * 10) / 10,
        endY: Math.round(Math.sin(angle) * endDist * 10) / 10,
        color: isBlue ? '#7dd3fc' : '#ffffff',
        size: Math.random() < 0.5 ? 2 : 1.5,
      });
    }

    this.activeSparks.update((sparks) => [...sparks, ...newSparks]);

    setTimeout(() => {
      const idsToRemove = new Set(newSparks.map((s) => s.id));
      this.activeSparks.update((sparks) => sparks.filter((s) => !idsToRemove.has(s.id)));
    }, 650);
  }

  /**
   * Handles keyboard navigation (Arrow keys, Home, End) among navigation orbs.
   *
   * @param {KeyboardEvent} event - The keyboard event.
   * @param {number} index - Index of the currently focused orb.
   */
  onOrbKeydown(event: KeyboardEvent, index: number): void {
    const total = this.sections().length;
    let targetIndex = -1;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      targetIndex = (index + 1) % total;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      targetIndex = (index - 1 + total) % total;
    } else if (event.key === 'Home') {
      targetIndex = 0;
    } else if (event.key === 'End') {
      targetIndex = total - 1;
    }

    if (targetIndex >= 0) {
      event.preventDefault();
      this.onOrbClick(targetIndex);
      const targetBtn = document.getElementById('orb-target-' + targetIndex);
      if (targetBtn) {
        targetBtn.focus();
      }
    }
  }
}
