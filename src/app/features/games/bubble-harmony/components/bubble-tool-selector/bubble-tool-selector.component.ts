import { Component, Input, output } from '@angular/core';
import { BubbleToolSpeechBubbleComponent } from '../bubble-tool-speech-bubble/bubble-tool-speech-bubble.component';
import { BubbleToolId } from '../../models/bubble-tool.model';

/**
 * Interactive tool selector pill button and dropdown speech bubble for Bubble Harmony.
 */
@Component({
  selector: 'app-bubble-tool-selector',
  standalone: true,
  imports: [BubbleToolSpeechBubbleComponent],
  templateUrl: './bubble-tool-selector.component.html',
  styleUrl: './bubble-tool-selector.component.scss',
})
export class BubbleToolSelectorComponent {
  /** Currently selected interactive tool. */
  @Input({ required: true }) activeTool!: BubbleToolId | null;

  /** Whether the tool speech bubble menu is open. */
  @Input({ required: true }) showToolBubble!: boolean;

  /** Whether the tool speech bubble is playing its deflate closing animation. */
  @Input({ required: true }) closingToolBubble!: boolean;

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
