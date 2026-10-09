import { Component, Input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Top Glass HUD Header for the Gras-Harmonie game.
 * Features back-navigation link to the central bubble hub and audio mute toggle.
 */
@Component({
  selector: 'app-gras-harmonie-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './gras-harmonie-header.component.html',
  styleUrl: './gras-harmonie-header.component.scss',
})
export class GrasHarmonieHeaderComponent {
  /** Whether the audio is currently muted. */
  @Input({ required: true }) isMuted = false;

  /** Emitted when the user toggles sound on/off. */
  readonly toggleSound = output<void>();

  onToggleSound(): void {
    this.toggleSound.emit();
  }
}
