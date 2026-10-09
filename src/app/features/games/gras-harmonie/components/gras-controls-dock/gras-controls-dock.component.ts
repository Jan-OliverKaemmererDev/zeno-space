import { Component, Input, output } from '@angular/core';
import { WindPreset } from '../../models/gras-harmonie.models';

/**
 * Bottom Floating Glass Control Dock for Gras-Harmonie.
 * Allows choosing the wind preset (Sanft, Frisch, Kräftig) and triggering a wind gust.
 */
@Component({
  selector: 'app-gras-controls-dock',
  standalone: true,
  templateUrl: './gras-controls-dock.component.html',
  styleUrl: './gras-controls-dock.component.scss',
})
export class GrasControlsDockComponent {
  /** Current active wind preset. */
  @Input({ required: true }) windPreset: WindPreset = 'fresh';

  /** Emitted when a different wind preset is selected. */
  readonly windPresetChange = output<WindPreset>();

  /** Emitted when the wind gust action button is clicked. */
  readonly windGust = output<void>();

  selectPreset(preset: WindPreset): void {
    if (this.windPreset !== preset) {
      this.windPresetChange.emit(preset);
    }
  }

  onTriggerGust(): void {
    this.windGust.emit();
  }
}
