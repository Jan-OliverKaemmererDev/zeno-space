import { Component, Input } from '@angular/core';
import { KeyboardControlDef } from '../../../../../core/models/minigame.model';

/**
 * Keyboard controls showcase featuring interactive 3D keycaps
 * for WASD navigation grids, spacebar triggers, and inline keys.
 */
@Component({
  selector: 'app-game-instructions-keyboard',
  standalone: true,
  templateUrl: './game-instructions-keyboard.component.html',
  styleUrl: './game-instructions-keyboard.component.scss',
})
export class GameInstructionsKeyboardComponent {
  /** Configured keyboard controls list for the minigame. */
  @Input({ required: true }) controls!: KeyboardControlDef[];
}
