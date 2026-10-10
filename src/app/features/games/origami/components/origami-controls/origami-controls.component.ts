import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrigamiStateService } from '../../services/origami-state.service';

/**
 * Bottom controls dock for stepping through origami folds,
 * toggling guideline visual aids, resetting, and auto-fold autoplay.
 */
@Component({
  selector: 'app-origami-controls',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './origami-controls.component.html',
  styleUrl: './origami-controls.component.scss',
})
export class OrigamiControlsComponent {
  readonly state = inject(OrigamiStateService);

  onPrev(): void {
    this.state.prevStep();
  }

  onNext(): void {
    this.state.nextStep();
  }

  onReset(): void {
    this.state.resetPattern();
  }

  onToggleGuides(): void {
    this.state.toggleGuideLines();
  }

  onToggleAuto(): void {
    this.state.toggleAutoFold();
  }
}
