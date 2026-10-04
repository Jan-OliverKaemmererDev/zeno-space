import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Top Glass HUD Header for the Bubble Harmony minigame.
 * Displays navigation back-link and live bubble stats (floating & popped).
 */
@Component({
  selector: 'app-bubble-harmony-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './bubble-harmony-header.component.html',
  styleUrl: './bubble-harmony-header.component.scss',
})
export class BubbleHarmonyHeaderComponent {
  /** Count of currently floating bubbles on the canvas. */
  @Input({ required: true }) bubbleCount!: number;

  /** Total number of bubbles popped in the current session. */
  @Input({ required: true }) poppedTotal!: number;
}
