import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CosmicInfoBubbleComponent } from '../cosmic-info-bubble/cosmic-info-bubble.component';

/**
 * Top Glass HUD Header for Cosmic Sculptor.
 * Features back navigation, interactive celestial status pill, and info dialog trigger.
 */
@Component({
  selector: 'app-cosmic-header',
  standalone: true,
  imports: [RouterLink, CosmicInfoBubbleComponent],
  templateUrl: './cosmic-header.component.html',
  styleUrl: './cosmic-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CosmicHeaderComponent {
  @Input() planetCount = 0;
  @Input() blackHoleCount = 0;
  @Input() collisionCount = 0;
  @Input() systemStability = 'Harmonisch';
  @Input() showBubble = false;
  @Input() closingBubble = false;

  @Output() toggleBubble = new EventEmitter<Event>();
  @Output() closeBubble = new EventEmitter<void>();

  onStatPillClick(event: Event): void {
    this.toggleBubble.emit(event);
  }

  onBubbleClose(): void {
    this.closeBubble.emit();
  }
}
