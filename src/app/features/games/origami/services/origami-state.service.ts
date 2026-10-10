import { Injectable, computed, inject, signal } from '@angular/core';
import { AudioService } from '../../../../core/services/audio.service';
import { OrigamiPaperStyle, OrigamiPattern, OrigamiPatternId, OrigamiStep } from '../models/origami.models';
import { ORIGAMI_PATTERNS, PAPER_STYLES } from '../data/origami-patterns.data';

/**
 * Reactive state management for the Origami zen game using Angular Signals.
 * Handles motif selection, paper styles, step progression and acoustic feedback.
 */
@Injectable()
export class OrigamiStateService {
  private readonly audioService = inject(AudioService);

  /** All available animal patterns */
  readonly patterns = signal<OrigamiPattern[]>(ORIGAMI_PATTERNS);

  /** Available paper colors and Japanese patterns */
  readonly paperStyles = signal<OrigamiPaperStyle[]>(PAPER_STYLES);

  /** Currently chosen origami pattern, or null if table is still empty */
  readonly selectedPattern = signal<OrigamiPattern | null>(null);

  /** Currently selected paper color/pattern style */
  readonly selectedPaperStyle = signal<OrigamiPaperStyle>(PAPER_STYLES[0]);

  /** 0-based index of current folding step */
  readonly currentStepIndex = signal<number>(0);

  /** Whether a folding transition animation is currently running */
  readonly isFolding = signal<boolean>(false);

  /** Whether dotted crease guide lines and arrows should be visible */
  readonly showGuideLines = signal<boolean>(true);

  /** Whether auto-fold slideshow is currently running */
  readonly isAutoFolding = signal<boolean>(false);

  private autoFoldTimer: ReturnType<typeof setInterval> | null = null;

  /** Total number of steps for the currently active pattern */
  readonly totalSteps = computed<number>(() => {
    return this.selectedPattern()?.totalSteps ?? 0;
  });

  /** Current step data object */
  readonly currentStep = computed<OrigamiStep | null>(() => {
    const pattern = this.selectedPattern();
    if (!pattern) return null;
    return pattern.steps[this.currentStepIndex()] ?? null;
  });

  /** Human-readable step indicator label, e.g. "Schritt 1 / 18" */
  readonly stepLabel = computed<string>(() => {
    const pattern = this.selectedPattern();
    if (!pattern) return '';
    return `Schritt ${this.currentStepIndex() + 1} / ${pattern.totalSteps}`;
  });

  /** Progress percentage (0..100) */
  readonly progressPercentage = computed<number>(() => {
    const total = this.totalSteps();
    if (total <= 1) return 0;
    return Math.round((this.currentStepIndex() / (total - 1)) * 100);
  });

  /** Whether the origami is completely finished */
  readonly isCompleted = computed<boolean>(() => {
    const pattern = this.selectedPattern();
    if (!pattern) return false;
    return this.currentStepIndex() >= pattern.totalSteps - 1;
  });

  /**
   * Select a motif and spawn the square origami sheet in the table center.
   */
  selectPattern(patternId: OrigamiPatternId): void {
    const pattern = this.patterns().find((p) => p.id === patternId);
    if (!pattern) return;

    this.stopAutoFold();
    this.selectedPattern.set(pattern);
    this.currentStepIndex.set(0);

    // Audio cue: Soft paper unfolding sound and delicate bell chime
    this.audioService.playCraneFolding(0.8);
    this.audioService.playChime(2, 0.2);
  }

  /**
   * Change paper color or Washi pattern style.
   */
  selectPaperStyle(styleId: string): void {
    const style = this.paperStyles().find((s) => s.id === styleId);
    if (style) {
      this.selectedPaperStyle.set(style);
      this.audioService.playChime(3, 0.15);
    }
  }

  /**
   * Advance to the next folding step.
   * Plays the relaxing crane paper folding audio and executes the visible 3D fold animation
   * before settling into the next step.
   */
  nextStep(): void {
    const pattern = this.selectedPattern();
    if (!pattern) return;

    const currentIndex = this.currentStepIndex();
    if (currentIndex >= pattern.totalSteps - 1) {
      this.stopAutoFold();
      return;
    }

    // Debounce to allow current physical fold animation to complete
    if (this.isFolding()) return;

    // 1. Initiate 3D paper folding motion
    this.isFolding.set(true);

    // Audio cue starts synchronously with the initial paper crease movement
    this.audioService.playCraneFolding(0.85);

    // 2. Once the flap visibly rotates and touches down (520ms), advance step and chime
    setTimeout(() => {
      const nextIndex = currentIndex + 1;
      this.currentStepIndex.set(nextIndex);
      this.isFolding.set(false);

      // Relaxing harmonious chime note upon completing the fold
      const chimeNote = nextIndex % 5;
      this.audioService.playChime(chimeNote, 0.22);
    }, 520);
  }

  /**
   * Go back one step cleanly without playing a forward fold animation.
   */
  prevStep(): void {
    const currentIndex = this.currentStepIndex();
    if (currentIndex <= 0) return;
    if (this.isFolding()) return;

    this.stopAutoFold();
    this.currentStepIndex.set(currentIndex - 1);
    this.audioService.playCraneFolding(0.6);
    this.audioService.playChime(0, 0.15);
  }

  /**
   * Jump directly to a given step index.
   */
  goToStep(index: number): void {
    const pattern = this.selectedPattern();
    if (!pattern) return;
    const clamped = Math.max(0, Math.min(index, pattern.totalSteps - 1));
    this.currentStepIndex.set(clamped);
    this.audioService.playCraneFolding(0.6);
  }

  /**
   * Reset current pattern back to step 1 (unfolded square paper).
   */
  resetPattern(): void {
    this.stopAutoFold();
    this.currentStepIndex.set(0);
    this.audioService.playCraneFolding(0.7);
    this.audioService.playChime(1, 0.18);
  }

  /**
   * Clear pattern selection and return to an empty table.
   */
  clearSelection(): void {
    this.stopAutoFold();
    this.selectedPattern.set(null);
    this.currentStepIndex.set(0);
    this.audioService.playChime(0, 0.15);
  }

  /**
   * Toggle crease and direction guide lines.
   */
  toggleGuideLines(): void {
    this.showGuideLines.update((v) => !v);
  }

  /**
   * Toggle automated folding slideshow.
   */
  toggleAutoFold(): void {
    if (this.isAutoFolding()) {
      this.stopAutoFold();
    } else {
      this.startAutoFold();
    }
  }

  private startAutoFold(): void {
    if (!this.selectedPattern()) return;
    if (this.isCompleted()) {
      this.currentStepIndex.set(0);
    }
    this.isAutoFolding.set(true);
    this.autoFoldTimer = setInterval(() => {
      if (this.isCompleted()) {
        this.stopAutoFold();
      } else {
        this.nextStep();
      }
    }, 2200);
  }

  private stopAutoFold(): void {
    this.isAutoFolding.set(false);
    if (this.autoFoldTimer) {
      clearInterval(this.autoFoldTimer);
      this.autoFoldTimer = null;
    }
  }

  /**
   * Cleanup on component destruction.
   */
  destroy(): void {
    this.stopAutoFold();
  }
}
