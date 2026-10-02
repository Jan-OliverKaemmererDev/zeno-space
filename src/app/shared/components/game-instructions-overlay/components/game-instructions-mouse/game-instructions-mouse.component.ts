import { Component, Input } from '@angular/core';
import { MouseControlDef } from '../../../../../core/models/minigame.model';

/**
 * Mouse & touch controls showcase featuring an animated hardware mouse illustration
 * with glowing active buttons (LMB / RMB), scrolling wheel carrier, and drag motion hint.
 */
@Component({
  selector: 'app-game-instructions-mouse',
  standalone: true,
  templateUrl: './game-instructions-mouse.component.html',
  styleUrl: './game-instructions-mouse.component.scss',
})
export class GameInstructionsMouseComponent {
  /** Configured mouse controls definition for the minigame. */
  @Input({ required: true }) mouse!: MouseControlDef;
}
