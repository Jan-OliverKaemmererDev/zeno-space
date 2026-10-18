import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Floating Glassmorphic Control Dock for Ameisenhügel.
 * Provides controls for spawning fruit, calling the ant swarm, adjusting simulation speed,
 * centering the view, and resetting the ant hill.
 */
@Component({
  selector: 'app-ameisen-controls',
  standalone: true,
  imports: [],
  templateUrl: './ameisen-controls.component.html',
  styleUrl: './ameisen-controls.component.scss',
})
export class AmeisenControlsComponent {
  @Input() timeSpeed = 1;

  @Output() spawnFruit = new EventEmitter<void>();
  @Output() alarmSwarm = new EventEmitter<void>();
  @Output() setSpeed = new EventEmitter<number>();
  @Output() resetCamera = new EventEmitter<void>();
  @Output() resetColony = new EventEmitter<void>();
}
