import { Component, Input, output } from '@angular/core';
import { BubbleToolId, BUBBLE_TOOLS, BubbleTool } from '../../models/bubble-tool.model';

/**
 * Speech bubble popup allowing the user to select an interactive bubble tool.
 * Modeled after Pi Spiral's balloon speech bubble with physics animations and glass aesthetics.
 */
@Component({
  selector: 'app-bubble-tool-speech-bubble',
  standalone: true,
  templateUrl: './bubble-tool-speech-bubble.component.html',
  styleUrl: './bubble-tool-speech-bubble.component.scss',
})
export class BubbleToolSpeechBubbleComponent {
  /** Currently active tool identifier (null if none is active). */
  @Input({ required: true }) activeToolId!: BubbleToolId | null;

  /** Whether the deflate closing animation is playing. */
  @Input({ required: true }) isClosing!: boolean;

  /** Emitted when the user chooses a tool or deactivates. */
  readonly selectTool = output<BubbleToolId | null>();

  /** Emitted when closing the speech bubble. */
  readonly close = output<void>();

  /** List of available specialized tools. */
  readonly tools: BubbleTool[] = BUBBLE_TOOLS;

  /**
   * Selects a tool or toggles it off if already active.
   *
   * @param {BubbleToolId | null} id - Chosen tool identifier, or null.
   * @param {Event} [event] - Click event.
   */
  onToolClick(id: BubbleToolId | null, event?: Event): void {
    event?.stopPropagation();
    if (this.activeToolId === id) {
      this.selectTool.emit(null);
    } else {
      this.selectTool.emit(id);
    }
  }

  /**
   * Closes the speech bubble dialog.
   *
   * @param {Event} [event] - Close event.
   */
  handleClose(event?: Event): void {
    event?.stopPropagation();
    this.close.emit();
  }

  /**
   * Prevents mouse wheel scrolling from bubbling up to document listeners.
   *
   * @param {WheelEvent} event - Mouse wheel event.
   */
  onBubbleWheel(event: WheelEvent): void {
    event.stopPropagation();
    const target = event.target as HTMLElement | null;
    const bubble = event.currentTarget as HTMLElement | null;
    const body = bubble?.querySelector('.bubble-body') as HTMLElement | null;
    if (body && target && !body.contains(target)) {
      body.scrollTop += event.deltaY;
      event.preventDefault();
    }
  }
}
