import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  HostListener,
} from '@angular/core';
import { Router } from '@angular/router';
import { AudioService } from '../../../core/services/audio.service';
import { OrigamiStateService } from './services/origami-state.service';
import { OrigamiHeaderComponent } from './components/origami-header/origami-header.component';
import { OrigamiTableComponent } from './components/origami-table/origami-table.component';
import { OrigamiSidebarComponent } from './components/origami-sidebar/origami-sidebar.component';
import { OrigamiControlsComponent } from './components/origami-controls/origami-controls.component';
import { OrigamiCompletionModalComponent } from './components/origami-completion-modal/origami-completion-modal.component';

/**
 * "Origami" – Traditional Japanese Paper Folding Meditation minigame.
 * Top-down bird's-eye view (Vogelperspektive) of a serene wooden desktop.
 * Step-by-step interactive origami folding for Crane (Kranich), Owl (Eule), and Turtle (Schildkröte),
 * accompanied by authentic paper folding sounds and the meditative landing page ambient soundtrack.
 */
@Component({
  selector: 'app-origami',
  standalone: true,
  imports: [
    OrigamiHeaderComponent,
    OrigamiTableComponent,
    OrigamiSidebarComponent,
    OrigamiControlsComponent,
    OrigamiCompletionModalComponent,
  ],
  providers: [OrigamiStateService],
  templateUrl: './origami.component.html',
  styleUrl: './origami.component.scss',
})
export class OrigamiComponent implements OnInit, OnDestroy {
  readonly state = inject(OrigamiStateService);
  private readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    // Ensure ambient soundtrack from landing page runs smoothly
    this.audioService.playAmbientMusic();
  }

  ngOnDestroy(): void {
    this.state.destroy();
  }

  /**
   * Escape key returns gracefully to the central bubble hub.
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.router.navigate(['/'], { fragment: 'bubble-hub' });
  }

  /**
   * Space or Right Arrow advances to next fold step.
   */
  @HostListener('document:keydown.space', ['$event'])
  onSpace(event: Event): void {
    event.preventDefault();
    if (this.state.selectedPattern()) {
      this.state.nextStep();
    }
  }

  @HostListener('document:keydown.arrowright')
  onArrowRight(): void {
    if (this.state.selectedPattern()) {
      this.state.nextStep();
    }
  }

  @HostListener('document:keydown.arrowleft')
  onArrowLeft(): void {
    if (this.state.selectedPattern()) {
      this.state.prevStep();
    }
  }

  /**
   * Number keys 1, 2, 3 quick-select pattern.
   */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.key === '1') this.state.selectPattern('crane');
    if (event.key === '2') this.state.selectPattern('owl');
    if (event.key === '3') this.state.selectPattern('turtle');
    if (event.key === 'm' || event.key === 'M') this.audioService.toggleSound();
    if (event.key === 'r' || event.key === 'R') this.state.resetPattern();
  }
}
