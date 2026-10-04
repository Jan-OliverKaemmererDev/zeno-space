import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { MANDELBROT_WAYPOINTS } from '../../utils/mandelbrot-presets';
import { MandelbrotWaypoint } from '../../models/mandelbrot.types';

/**
 * Bottom floating glass dock with controls for zooming,
 * waypoint exploration, audio toggle, and memory reset.
 */
@Component({
  selector: 'app-mandelbrot-controls',
  standalone: true,
  templateUrl: './mandelbrot-controls.component.html',
  styleUrl: './mandelbrot-controls.component.scss',
})
export class MandelbrotControlsComponent {
  @Input() isSoundEnabled = true;
  @Input() currentWaypointId = 'overview';

  @Output() zoomIn = new EventEmitter<void>();
  @Output() toggleSound = new EventEmitter<void>();
  @Output() resetView = new EventEmitter<void>();
  @Output() selectWaypoint = new EventEmitter<MandelbrotWaypoint>();

  readonly waypoints = MANDELBROT_WAYPOINTS;
  readonly showWaypointMenu = signal<boolean>(false);

  toggleWaypointMenu(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.showWaypointMenu.update((v) => !v);
  }

  onSelectWaypoint(wp: MandelbrotWaypoint, event: MouseEvent): void {
    event.stopPropagation();
    this.selectWaypoint.emit(wp);
    this.showWaypointMenu.set(false);
  }

  closeWaypointMenu(): void {
    this.showWaypointMenu.set(false);
  }
}
