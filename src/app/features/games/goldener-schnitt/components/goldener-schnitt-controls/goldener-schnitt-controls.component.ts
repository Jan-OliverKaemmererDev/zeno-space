import { Component, Input, output } from '@angular/core';

/**
 * Bottom Floating Control Dock for the Goldener Schnitt minigame.
 * Provides controls for adding seeds, toggling auto-flow mode,
 * resetting camera view, toggling audio, and restarting the bloom.
 */
@Component({
  selector: 'app-goldener-schnitt-controls',
  standalone: true,
  templateUrl: './goldener-schnitt-controls.component.html',
  styleUrl: './goldener-schnitt-controls.component.scss',
})
export class GoldenerSchnittControlsComponent {
  /** Whether automatic seed flow generation is active. */
  @Input({ required: true }) isAutoFlowActive!: boolean;

  /** Whether chime sound effects are enabled. */
  @Input({ required: true }) isSoundEnabled!: boolean;

  /** Emitted when "+5 Ziffern" button is clicked. */
  readonly addSeeds = output<void>();

  /** Emitted when "Auto-Flow" toggle button is clicked. */
  readonly toggleAutoFlow = output<void>();

  /** Emitted when "Zentrieren" button is clicked. */
  readonly resetCamera = output<void>();

  /** Emitted when "Klang" toggle button is clicked. */
  readonly toggleSound = output<void>();

  /** Emitted when "Neustart" button is clicked. */
  readonly resetBloom = output<void>();
}
