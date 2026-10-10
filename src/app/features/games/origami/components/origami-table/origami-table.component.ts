import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrigamiStateService } from '../../services/origami-state.service';
import { FoldAnimation, PaperFacet } from '../../models/origami.models';

/**
 * Top-down bird's-eye view (Vogelperspektive) interactive desktop table.
 * Renders the wooden table surface, falling sakura breeze,
 * and the responsive SVG origami paper sheet with authentic physical 3D folding animations.
 */
@Component({
  selector: 'app-origami-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './origami-table.component.html',
  styleUrl: './origami-table.component.scss',
})
export class OrigamiTableComponent {
  readonly state = inject(OrigamiStateService);

  /**
   * Click handler on the origami paper or hotspot.
   * Advances to the next fold step and executes the physical 3D folding animation.
   */
  onPaperClick(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.state.isCompleted() && !this.state.isFolding()) {
      this.state.nextStep();
    }
  }

  /**
   * Normalizes SVG point strings by collapsing whitespaces
   * to guarantee reliable polygon equality comparison.
   */
  normalizePoints(points: string | undefined): string {
    if (!points) return '';
    return points.trim().replace(/\s+/g, ' ');
  }

  /**
   * Returns active facets to render on the stationary base paper layer.
   * When isFolding() is active, the moving flap is excluded from the stationary base,
   * so the desk beneath it is revealed as the flap lifts off into 3D!
   */
  getStationaryFacets(): PaperFacet[] {
    const step = this.state.currentStep();
    if (!step) return [];

    if (!this.state.isFolding()) {
      return step.facets;
    }

    const anim = this.getActiveFoldAnimation();
    if (!anim) return step.facets;

    // During full model turnover, squash, reverse or final: whole model moves together
    if (
      anim.type === 'turnover' ||
      anim.type === 'squash' ||
      anim.type === 'reverse' ||
      anim.type === 'final'
    ) {
      return step.facets;
    }

    if ((anim.type === 'flap' || anim.type === 'unfold') && anim.flapPoints) {
      const normalizedFlap = this.normalizePoints(anim.flapPoints);
      let flapRemoved = false;
      return step.facets.filter((f) => {
        if (!flapRemoved && this.normalizePoints(f.points) === normalizedFlap) {
          flapRemoved = true;
          return false;
        }
        return true;
      });
    }

    return step.facets;
  }

  /**
   * Calculates the SVG fill for the front face of the 3D folding flap.
   */
  getFlapFrontFill(anim: FoldAnimation): string {
    if (anim.type === 'unfold') {
      return this.getFacetFill({ points: anim.flapPoints || '', shadeFactor: 1.0 });
    }
    return this.getFacetFill({ points: anim.flapPoints || '', shadeFactor: 1.06 });
  }

  /**
   * Calculates the SVG fill for the back face of the 3D folding flap.
   */
  getFlapBackFill(anim: FoldAnimation): string {
    if (anim.type === 'unfold') {
      return '#faf5ec';
    }
    return anim.showsReverseSide ? '#faf5ec' : this.getFacetFill({ points: anim.flapPoints || '', shadeFactor: 0.96 });
  }

  /**
   * Returns the active 3D fold animation configuration for the current step.
   * Never generates arbitrary phantom triangles!
   */
  getActiveFoldAnimation(): FoldAnimation | null {
    const step = this.state.currentStep();
    if (!step) return null;

    if (step.foldAnimation) {
      return step.foldAnimation;
    }

    if (step.creaseType === 'turnover') {
      return { type: 'turnover', rotateTransform: 'rotateY(180deg)' };
    }
    if (step.creaseType === 'squash') {
      return { type: 'squash' };
    }
    if (step.creaseType === 'reverse') {
      return { type: 'reverse' };
    }
    if (step.creaseType === 'final') {
      return { type: 'final' };
    }

    // Default safe paper crease motion without phantom flap
    return { type: 'squash' };
  }

  /**
   * Horizontal center of rotation as percentage string.
   */
  getFlapOriginPctX(): string {
    const anim = this.getActiveFoldAnimation();
    const x = anim?.origin?.x ?? 250;
    return `${x / 5}%`;
  }

  /**
   * Vertical center of rotation as percentage string.
   */
  getFlapOriginPctY(): string {
    const anim = this.getActiveFoldAnimation();
    const y = anim?.origin?.y ?? 250;
    return `${y / 5}%`;
  }

  /**
   * Resolves the dedicated CSS animation class for the 3D flap.
   */
  getFlapAnimationClass(): string {
    const anim = this.getActiveFoldAnimation();
    if (anim?.animationClass) {
      return anim.animationClass;
    }
    const rot = anim?.rotateTransform || '';
    if (rot.includes('rotateX(-180deg)')) return 'anim-fold-up-x';
    if (rot.includes('rotateX(180deg)')) return 'anim-fold-down-x';
    if (rot.includes('rotateY(-180deg)')) return 'anim-fold-left-y';
    if (rot.includes('rotateY(180deg)')) return 'anim-fold-right-y';
    return 'anim-fold-up-x';
  }

  /**
   * Calculates the SVG fill style for a facet, handling pattern fills,
   * reverse white paper face, or individual face shade highlights.
   */
  getFacetFill(facet: PaperFacet): string {
    if (facet.fillOverride) {
      return facet.fillOverride;
    }
    if (facet.isReverseSide) {
      const shade = facet.shadeFactor ?? 1.0;
      const base = Math.min(255, Math.round(248 * shade));
      return `rgb(${base}, ${base - 4}, ${base - 10})`;
    }

    const style = this.state.selectedPaperStyle();
    if (style.patternType === 'seigaiha') {
      return 'url(#pattern-seigaiha)';
    }
    if (style.patternType === 'asanoha') {
      return 'url(#pattern-asanoha)';
    }

    return this.applyShadeToHex(style.primaryColor, facet.shadeFactor ?? 1.0);
  }

  /**
   * Helper to tint/shade a hex color by a lighting factor (e.g. 1.1 = highlight, 0.9 = shadow).
   */
  private applyShadeToHex(hex: string, factor: number): string {
    const cleanHex = hex.replace('#', '');
    let r = parseInt(cleanHex.substring(0, 2), 16);
    let g = parseInt(cleanHex.substring(2, 4), 16);
    let b = parseInt(cleanHex.substring(4, 6), 16);

    r = Math.min(255, Math.max(0, Math.round(r * factor)));
    g = Math.min(255, Math.max(0, Math.round(g * factor)));
    b = Math.min(255, Math.max(0, Math.round(b * factor)));

    return `rgb(${r}, ${g}, ${b})`;
  }
}
