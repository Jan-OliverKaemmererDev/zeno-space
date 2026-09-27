import { Component, input, output } from '@angular/core';
import { CategoryItem, CraneFlightState } from '../../navbar.models';

/**
 * Interactive Origami Crane component with SVG line art, watercolor gradients,
 * flight entrance path, flapping idle loop, and dropdown toggle button.
 */
@Component({
  selector: 'app-origami-crane',
  standalone: true,
  templateUrl: './origami-crane.component.html',
  styleUrl: './origami-crane.component.scss',
})
export class OrigamiCraneComponent {
  /** Current flight state of the crane ('flying' during entrance or 'landed' when perched). */
  readonly flightState = input<CraneFlightState>('flying');

  /** Whether the crane is flapping its wings in idle state. */
  readonly isFlapping = input<boolean>(false);

  /** Whether the category dropdown is currently open. */
  readonly isOpen = input<boolean>(false);

  /** Currently selected CategoryItem, or null. */
  readonly selectedCategory = input<CategoryItem | null>(null);

  /** Emitted when clicking the crane trigger button to toggle the dropdown menu. */
  readonly toggle = output<void>();
}
