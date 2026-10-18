import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AmeisenInfoBubbleComponent } from '../ameisen-info-bubble/ameisen-info-bubble.component';

/**
 * Top Glass HUD Header for Ameisenhügel.
 * Features a return-to-hub button and a responsive live status pill trigger for the info bubble dialog.
 */
@Component({
  selector: 'app-ameisen-header',
  standalone: true,
  imports: [RouterLink, AmeisenInfoBubbleComponent],
  templateUrl: './ameisen-header.component.html',
  styleUrl: './ameisen-header.component.scss',
})
export class AmeisenHeaderComponent {
  @Input({ required: true }) antCount = 20;
  @Input({ required: true }) foodStock = 0;
  @Input({ required: true }) hillLevel = 1;
  @Input({ required: true }) defeatedEnemies = 0;
  @Input({ required: true }) showBubble = false;
  @Input({ required: true }) closingBubble = false;

  @Output() toggleBubble = new EventEmitter<Event>();
  @Output() closeBubble = new EventEmitter<void>();

  onStatPillClick(event: Event): void {
    this.toggleBubble.emit(event);
  }

  onBubbleClose(): void {
    this.closeBubble.emit();
  }
}
