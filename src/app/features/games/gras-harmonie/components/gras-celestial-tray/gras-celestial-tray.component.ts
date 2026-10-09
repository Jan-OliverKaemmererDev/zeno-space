import { Component, Input, output } from '@angular/core';
import { TimeOfDay } from '../../models/gras-harmonie.models';

/**
 * Right Side Celestial Time & Atmosphere Tray for Gras-Harmonie.
 * Allows switching between Sun (Day), Setting Sun (Golden Hour), and Moon (Night).
 */
@Component({
  selector: 'app-gras-celestial-tray',
  standalone: true,
  templateUrl: './gras-celestial-tray.component.html',
  styleUrl: './gras-celestial-tray.component.scss',
})
export class GrasCelestialTrayComponent {
  /** Current active time of day. */
  @Input({ required: true }) timeOfDay: TimeOfDay = 'day';

  /** Emitted when the user chooses a different celestial time of day. */
  readonly timeOfDayChange = output<TimeOfDay>();

  setTime(time: TimeOfDay): void {
    if (this.timeOfDay !== time) {
      this.timeOfDayChange.emit(time);
    }
  }
}
