import { Component, Input, output } from '@angular/core';
import { BubbleToolSelectorComponent } from '../bubble-tool-selector/bubble-tool-selector.component';
import { BubbleInstructionHintComponent } from '../bubble-instruction-hint/bubble-instruction-hint.component';
import { BubbleToolId } from '../../models/bubble-tool.model';

/**
 * Bottom Floating Control Dock for the Bubble Harmony minigame.
 * Houses spawn cluster, chain reaction toggle, symphony pop, interactive tool selector,
 * and user hint capsule.
 */
@Component({
  selector: 'app-bubble-harmony-controls',
  standalone: true,
  imports: [BubbleToolSelectorComponent, BubbleInstructionHintComponent],
  templateUrl: './bubble-harmony-controls.component.html',
  styleUrl: './bubble-harmony-controls.component.scss',
})
export class BubbleHarmonyControlsComponent {
  /** Whether chain reaction mode is enabled. */
  @Input({ required: true }) chainReaction!: boolean;

  /** Currently selected interactive tool. */
  @Input({ required: true }) activeTool!: BubbleToolId | null;

  /** Contextual hint text for the current tool. */
  @Input({ required: true }) activeToolHint!: string;

  /** Whether the tool speech bubble menu is open. */
  @Input({ required: true }) showToolBubble!: boolean;

  /** Whether the tool speech bubble is playing its deflate animation. */
  @Input({ required: true }) closingToolBubble!: boolean;

  /** Emitted when "Blasen-Schwarm" button is clicked. */
  readonly spawnCluster = output<void>();

  /** Emitted when "Kettenreaktion" toggle button is clicked. */
  readonly toggleChain = output<void>();

  /** Emitted when "Klang-Symphonie" button is clicked. */
  readonly popAllSymphony = output<void>();

  /** Emitted when the tool button is clicked to toggle the speech bubble. */
  readonly toggleToolBubble = output<Event>();

  /** Emitted when a tool is selected from the speech bubble. */
  readonly selectTool = output<BubbleToolId | null>();

  /** Emitted when the speech bubble requests to close. */
  readonly closeToolBubble = output<void>();

  onToggleToolBubble(event: Event): void {
    this.toggleToolBubble.emit(event);
  }

  onSelectTool(toolId: BubbleToolId | null): void {
    this.selectTool.emit(toolId);
  }

  onCloseToolBubble(): void {
    this.closeToolBubble.emit();
  }
}
