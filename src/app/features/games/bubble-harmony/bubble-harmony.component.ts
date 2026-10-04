import {
  Component,
  ViewChild,
  inject,
  signal,
  computed,
  HostListener,
} from '@angular/core';
import { Router } from '@angular/router';
import { AudioService } from '../../../core/services/audio.service';
import { BubbleCanvasComponent } from './components/bubble-canvas/bubble-canvas.component';
import { BubbleHarmonyHeaderComponent } from './components/bubble-harmony-header/bubble-harmony-header.component';
import { BubbleHarmonyControlsComponent } from './components/bubble-harmony-controls/bubble-harmony-controls.component';
import { BubbleToolId, BUBBLE_TOOLS } from './models/bubble-tool.model';

/**
 * Interactive bubble harmony minigame orchestrator featuring floating iridescent soap bubbles with harmonic audio feedback.
 */
@Component({
  selector: 'app-bubble-harmony',
  imports: [
    BubbleCanvasComponent,
    BubbleHarmonyHeaderComponent,
    BubbleHarmonyControlsComponent,
  ],
  templateUrl: './bubble-harmony.component.html',
  styleUrl: './bubble-harmony.component.scss',
})
export class BubbleHarmonyComponent {
  @ViewChild('canvasComp') canvasComp?: BubbleCanvasComponent;

  readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

  /** Currently selected interactive tool (null by default). */
  readonly activeTool = signal<BubbleToolId | null>(null);

  /** Whether the tool selection speech bubble is open. */
  readonly showToolBubble = signal<boolean>(false);

  /** Whether the balloon deflate closing animation is active. */
  readonly closingToolBubble = signal<boolean>(false);
  private toolBubbleTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Count of currently floating bubbles on the canvas. */
  readonly bubbleCount = signal<number>(0);

  /** Whether popped bubbles trigger cascading chain reactions in adjacent bubbles. */
  readonly chainReaction = signal<boolean>(true);

  /** Total number of bubbles popped in the current session. */
  readonly poppedTotal = signal<number>(0);

  /** Display label of the currently active tool. */
  readonly activeToolLabel = computed(() => {
    const tool = BUBBLE_TOOLS.find((t) => t.id === this.activeTool());
    return tool ? tool.label : '';
  });

  /** Dynamic interaction hint displayed in the bottom capsule. */
  readonly activeToolHint = computed(() => {
    switch (this.activeTool()) {
      case 'fan':
        return 'Maus in Nähe führen zum Wegpusten (Ventilator)';
      case 'magnet':
        return 'Maus bewegen zum Anziehen & Kreisen (Magnet)';
      case 'prism':
        return 'Über Blasen fahren für bunte Regenbogen-Funken';
      case 'chime':
        return 'Blasen berühren für Theremin-Klang & Schwingung';
      default:
        return 'Klicke eine Blase zum Platzen & Hören';
    }
  });

  /**
   * Closes the minigame or open tool bubble on Escape key press.
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showToolBubble()) {
      this.closeToolBubble();
      return;
    }
    this.router.navigate(['/'], { fragment: 'bubble-hub' });
  }

  /**
   * Closes the tool speech bubble when clicking outside the tool pill wrapper.
   */
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.showToolBubble() || this.closingToolBubble()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.tool-pill-wrapper')) return;
    this.closeToolBubble();
  }

  /**
   * Spawns an animated cluster stream of bubbles upon pressing Spacebar.
   */
  @HostListener('document:keydown.space', ['$event'])
  onSpace(event: Event): void {
    event.preventDefault();
    this.spawnBubbleCluster();
  }

  /**
   * Spawns an animated stream of bubbles blown in from an edge.
   */
  spawnBubbleCluster(): void {
    this.canvasComp?.spawnBubbleCluster();
  }

  /**
   * Pops all existing bubbles in rapid musical sequence.
   */
  popAllSymphony(): void {
    this.canvasComp?.popAllSymphony();
  }

  /**
   * Increments the popped bubbles counter when a bubble is popped on the canvas.
   */
  onBubblePopped(): void {
    this.poppedTotal.update((n) => n + 1);
  }

  /**
   * Toggles chain reaction mode.
   */
  toggleChain(): void {
    this.chainReaction.update((c) => !c);
    this.audioService.playChime(4, 0.15);
  }

  /**
   * Toggles the tool selection speech bubble.
   */
  toggleToolBubble(event?: Event): void {
    event?.stopPropagation();
    if (this.showToolBubble()) {
      this.closeToolBubble();
    } else {
      this.openToolBubble();
    }
  }

  /**
   * Opens the tool selection speech bubble with audio feedback.
   */
  openToolBubble(): void {
    if (this.toolBubbleTimeout) {
      clearTimeout(this.toolBubbleTimeout);
      this.toolBubbleTimeout = null;
    }
    this.closingToolBubble.set(false);
    this.showToolBubble.set(true);
    this.audioService.playWaterdropToneOn(0.4);
  }

  /**
   * Closes the tool speech bubble with a smooth deflate animation.
   */
  closeToolBubble(): void {
    if (!this.showToolBubble() || this.closingToolBubble()) return;
    this.closingToolBubble.set(true);
    if (this.toolBubbleTimeout) {
      clearTimeout(this.toolBubbleTimeout);
    }
    this.toolBubbleTimeout = setTimeout(() => {
      this.showToolBubble.set(false);
      this.closingToolBubble.set(false);
      this.toolBubbleTimeout = null;
    }, 320);
  }

  /**
   * Handles user selection of a tool from the speech bubble.
   */
  onSelectTool(toolId: BubbleToolId | null): void {
    this.activeTool.set(toolId);
    this.audioService.playWaterdropToneOn(0.5);
    this.closeToolBubble();
  }
}
