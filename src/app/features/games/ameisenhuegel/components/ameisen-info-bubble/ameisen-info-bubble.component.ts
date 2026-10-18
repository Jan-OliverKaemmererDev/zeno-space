import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Glassmorphic Info/Lore Bubble modal displaying live ant colony telemetry
 * and biological lore on swarm intelligence and communication.
 */
@Component({
  selector: 'app-ameisen-info-bubble',
  standalone: true,
  imports: [],
  templateUrl: './ameisen-info-bubble.component.html',
  styleUrl: './ameisen-info-bubble.component.scss',
})
export class AmeisenInfoBubbleComponent {
  @Input({ required: true }) antCount = 20;
  @Input({ required: true }) foodStock = 0;
  @Input({ required: true }) hillLevel = 1;
  @Input({ required: true }) defeatedEnemies = 0;
  @Input({ required: true }) isClosing = false;

  @Output() close = new EventEmitter<void>();

  handleClose(event: Event): void {
    event.stopPropagation();
    this.close.emit();
  }

  onBubbleWheel(event: WheelEvent): void {
    event.stopPropagation();
  }
}
