import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';

/**
 * Floating glass dock control panel for Cosmic Sculptor.
 * Styled after pi-spiral control dock with pure typography (no icons in buttons).
 */
@Component({
  selector: 'app-cosmic-controls',
  standalone: true,
  templateUrl: './cosmic-controls.component.html',
  styleUrl: './cosmic-controls.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CosmicControlsComponent {
  @Input() timeSpeed = 1;
  @Input() orbitStringsVisible = true;

  @Output() spawnPlanet = new EventEmitter<void>();
  @Output() spawnBlackHole = new EventEmitter<void>();
  @Output() setSpeed = new EventEmitter<number>();
  @Output() toggleOrbitStrings = new EventEmitter<void>();
  @Output() resetCamera = new EventEmitter<void>();
  @Output() resetSystem = new EventEmitter<void>();
}
