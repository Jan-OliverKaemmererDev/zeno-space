import { Component, ChangeDetectionStrategy, signal } from '@angular/core';

/**
 * Orientation Guard Component.
 * Displays an atmospheric, cozy animation prompting mobile and tablet users to rotate
 * their device into landscape orientation when held in portrait mode.
 */
@Component({
  selector: 'app-orientation-guard',
  standalone: true,
  templateUrl: './orientation-guard.component.html',
  styleUrl: './orientation-guard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrientationGuardComponent {
  /**
   * Signal indicating whether the orientation overlay has been dismissed by the user (e.g. during testing).
   */
  readonly isDismissed = signal<boolean>(false);

  /**
   * Dismisses the orientation guard overlay.
   */
  dismiss(): void {
    this.isDismissed.set(true);
  }
}
