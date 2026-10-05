import { Component, Input, Output, EventEmitter, signal, HostListener } from '@angular/core';
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

  // Drag-to-scroll support for the waypoint list
  private isListDragging = false;
  private hasListDragged = false;
  private listDragStartY = 0;
  private listScrollStartY = 0;

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.showWaypointMenu()) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (target.closest('.waypoints-flyout') || target.closest('.waypoints-toggle-btn')) {
      return;
    }

    this.closeWaypointMenu();
  }

  toggleWaypointMenu(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.showWaypointMenu.update((v) => !v);
  }

  onSelectWaypoint(wp: MandelbrotWaypoint, event: MouseEvent): void {
    event.stopPropagation();
    if (this.hasListDragged) return;
    this.selectWaypoint.emit(wp);
    this.showWaypointMenu.set(false);
  }

  closeWaypointMenu(): void {
    this.showWaypointMenu.set(false);
  }

  onListWheel(event: WheelEvent): void {
    event.stopPropagation();
    event.preventDefault();
    const el = event.currentTarget as HTMLElement;
    if (el) {
      el.scrollTop += event.deltaY;
    }
  }

  onListPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.isListDragging = true;
    this.hasListDragged = false;
    this.listDragStartY = event.clientY;
    const el = event.currentTarget as HTMLElement;
    this.listScrollStartY = el?.scrollTop || 0;
  }

  onListPointerMove(event: PointerEvent): void {
    if (!this.isListDragging) return;
    const dy = event.clientY - this.listDragStartY;
    if (Math.abs(dy) > 6) {
      this.hasListDragged = true;
    }
    if (this.hasListDragged) {
      const el = event.currentTarget as HTMLElement;
      if (el) {
        el.scrollTop = this.listScrollStartY - dy;
      }
    }
  }

  onListPointerUp(event?: PointerEvent): void {
    if (!this.isListDragging) return;
    this.isListDragging = false;
    // Allow pending click events to check hasListDragged before resetting
    setTimeout(() => {
      this.hasListDragged = false;
    }, 100);
  }
}
