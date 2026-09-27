import { Injectable } from '@angular/core';
import { Rope, DomSyncItem } from '../rope-physics.models';
import { DESIGN_W } from '../rope-physics.constants';

/**
 * Synchronizes physical rope positions and tilt angles with corresponding DOM elements
 * that match the `[data-swing-id="..."]` attribute.
 */
@Injectable({
  providedIn: 'root',
})
export class RopeDomSynchronizerService {
  /**
   * Initializes sync metadata tracking for each rope.
   */
  initDomSync(ropes: Rope[]): DomSyncItem[] {
    return ropes.map(r => ({
      id: r.id,
      element: null,
      anchorX: r.anchorX,
      anchorY: r.anchorY,
      restLength: r.length,
    }));
  }

  /**
   * Applies CSS transforms (3D translation + rotation) to target DOM elements.
   */
  syncDomElements(
    ropes: Rope[],
    domSyncItems: DomSyncItem[],
    parentElement: HTMLElement | null
  ): void {
    if (!parentElement || typeof document === 'undefined') return;

    // Scale from design space (1376) to current rendered CSS pixel width
    const currentScale = parentElement.getBoundingClientRect().width / DESIGN_W;

    for (let i = 0; i < ropes.length; i++) {
      const rope = ropes[i];
      const syncItem = domSyncItems[i];
      if (!syncItem) continue;

      if (!syncItem.element) {
        syncItem.element = document.querySelector(`[data-swing-id="${rope.id}"]`);
        if (!syncItem.element) continue;
      }

      const lastPoint = rope.points[rope.points.length - 1];

      // Displacement from rest position in screen pixels
      const dx = (lastPoint.x - syncItem.anchorX) * currentScale;
      const dy = (lastPoint.y - (syncItem.anchorY + syncItem.restLength)) * currentScale;

      // Bound body angle within realistic swing limits
      const deg = Math.max(-15, Math.min(15, rope.bodyAngle)).toFixed(2);

      syncItem.element.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) rotate(${deg}deg)`;
    }
  }
}
