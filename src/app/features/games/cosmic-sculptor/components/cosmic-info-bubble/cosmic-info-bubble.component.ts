import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';

/**
 * Interactive glass dialog detailing real-time astrophysical telemetry,
 * Keplerian orbit stability, harp string resonance physics, and singularity dynamics.
 */
@Component({
  selector: 'app-cosmic-info-bubble',
  standalone: true,
  templateUrl: './cosmic-info-bubble.component.html',
  styleUrl: './cosmic-info-bubble.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CosmicInfoBubbleComponent {
  @Input() planetCount = 0;
  @Input() blackHoleCount = 0;
  @Input() collisionCount = 0;
  @Input() isClosing = false;

  @Output() close = new EventEmitter<void>();

  handleClose(event: Event): void {
    event.stopPropagation();
    this.close.emit();
  }

  onBubbleWheel(event: WheelEvent): void {
    event.stopPropagation();
  }
}
