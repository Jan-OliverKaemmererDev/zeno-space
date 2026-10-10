import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AudioService } from '../../../../../core/services/audio.service';
import { OrigamiStateService } from '../../services/origami-state.service';

/**
 * Top HUD header for the Origami minigame featuring:
 * - Back to hub link (left)
 * - Centered step indicator & fold instruction pill
 * - Sound mute toggle button (right)
 */
@Component({
  selector: 'app-origami-header',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './origami-header.component.html',
  styleUrl: './origami-header.component.scss',
})
export class OrigamiHeaderComponent {
  readonly state = inject(OrigamiStateService);
  readonly audioService = inject(AudioService);

  onToggleSound(): void {
    this.audioService.toggleSound();
  }
}
