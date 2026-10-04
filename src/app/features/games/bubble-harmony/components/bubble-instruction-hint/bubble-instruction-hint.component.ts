import { Component, Input } from '@angular/core';

/**
 * Frosted-glass capsule instruction hint bar for Bubble Harmony.
 * Displays contextual instructions based on active tool and global shortcuts.
 */
@Component({
  selector: 'app-bubble-instruction-hint',
  standalone: true,
  templateUrl: './bubble-instruction-hint.component.html',
  styleUrl: './bubble-instruction-hint.component.scss',
})
export class BubbleInstructionHintComponent {
  /** Dynamic interaction hint text for the currently selected tool. */
  @Input({ required: true }) activeToolHint!: string;
}
