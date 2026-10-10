import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrigamiStateService } from '../../services/origami-state.service';

/**
 * Celebratory zen completion overlay displayed when an origami motif has been folded.
 */
@Component({
  selector: 'app-origami-completion-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './origami-completion-modal.component.html',
  styleUrl: './origami-completion-modal.component.scss',
})
export class OrigamiCompletionModalComponent {
  readonly state = inject(OrigamiStateService);

  /** User can dismiss modal to admire the folded figure on the table */
  readonly isDismissed = signal<boolean>(false);

  dismiss(): void {
    this.isDismissed.set(true);
  }

  onFoldAgain(): void {
    this.isDismissed.set(false);
    this.state.resetPattern();
  }

  onChooseNewMotif(): void {
    this.isDismissed.set(false);
    this.state.clearSelection();
  }
}
