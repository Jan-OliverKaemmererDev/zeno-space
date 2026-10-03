import { Component, Input, output } from '@angular/core';

/**
 * Bottom Floating Control Dock for the Pi Spiral minigame.
 * Provides controls for adding digits, toggling auto-flow mode,
 * resetting camera view, toggling audio, and restarting the spiral.
 */
@Component({
  selector: 'app-pi-spiral-controls',
  standalone: true,
  templateUrl: './pi-spiral-controls.component.html',
  styleUrl: './pi-spiral-controls.component.scss',
})
export class PiSpiralControlsComponent {
  /** Whether automatic digit stream generation is active. */
  @Input({ required: true }) isAutoFlowActive!: boolean;

  /** Whether chime sound effects are enabled. */
  @Input({ required: true }) isSoundEnabled!: boolean;

  /** Emitted when "+5 Ziffern" button is clicked. */
  readonly addDigits = output<void>();

  /** Emitted when "Auto-Flow" toggle button is clicked. */
  readonly toggleAutoFlow = output<void>();

  /** Emitted when "Zentrieren" button is clicked. */
  readonly resetCamera = output<void>();

  /** Emitted when "Klang" toggle button is clicked. */
  readonly toggleSound = output<void>();

  /** Emitted when "Neustart" button is clicked. */
  readonly resetSpiral = output<void>();
}
