import {
  Component,
  OnDestroy,
  ViewChild,
  input,
  output,
  inject,
  NgZone,
  signal,
  AfterViewInit,
  HostListener,
} from '@angular/core';
import { AudioService } from '../../../core/services/audio.service';
import {
  NavSection,
  OrbClickSpark,
  TooltipLetter,
  ParticleOrbData,
} from './orb-nav.models';
import { OrbTrayComponent } from './components/orb-tray/orb-tray.component';
import { OrbCanvasComponent } from './components/orb-canvas/orb-canvas.component';
import { OrbTargetsComponent } from './components/orb-targets/orb-targets.component';

export type { NavSection, OrbClickSpark, TooltipLetter, ParticleOrbData };

/**
 * 3D Particle Orb navigation widget orchestrating Three.js WebGL canvas simulation,
 * glass plate backdrop tray, interactive target overlay, and 5-second resource-saving idle detection.
 */
@Component({
  selector: 'app-orb-nav',
  standalone: true,
  imports: [OrbTrayComponent, OrbCanvasComponent, OrbTargetsComponent],
  templateUrl: './orb-nav.component.html',
  styleUrl: './orb-nav.component.scss',
})
export class OrbNavComponent implements AfterViewInit, OnDestroy {
  private readonly ngZone = inject(NgZone);
  private readonly audioService = inject(AudioService);

  /** Currently active section index. */
  readonly activeIndex = input<number>(0);

  /** List of section anchors rendered in the navigation widget. */
  readonly sections = input<NavSection[]>([
    { id: 'hero', label: 'Kosmos' },
    { id: 'bubble-hub', label: 'Welten' },
    { id: 'sanctuary', label: 'Zuflucht' },
  ]);

  /** Emitted when an orb is clicked or selected. */
  readonly sectionSelect = output<number>();

  @ViewChild('canvasComponent')
  private canvasComponent?: OrbCanvasComponent;

  /** Currently hovered orb index projected from WebGL raycaster. */
  readonly activeHoverIndex = signal<number | null>(null);

  // Idle detection & resource saving
  readonly isIdle = signal<boolean>(false);
  readonly isWaking = signal<boolean>(false);
  private hasInitialEntranceEnded = false;
  private isDestroyed = false;
  private idleTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pauseRenderTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private initialEntranceTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly IDLE_DELAY_MS = 5000;
  private readonly FADE_DURATION_MS = 900;

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.setupIdleDetection();
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.cleanupIdleDetection();
  }

  /**
   * Forwards pointer movements to the canvas raycaster and warms up audio.
   *
   * @param {PointerEvent} event - The pointer move event.
   */
  onPointerMove(event: PointerEvent): void {
    this.canvasComponent?.handlePointerMove(event);
    this.audioService.warmupAudio();
  }

  /**
   * Forwards pointer leave to the canvas raycaster.
   */
  onPointerLeave(): void {
    this.canvasComponent?.handlePointerLeave();
    this.activeHoverIndex.set(null);
  }

  /**
   * Warms up web audio on target pointerdown.
   */
  onOrbPointerDown(): void {
    this.audioService.warmupAudio();
  }

  /**
   * Imparts rotational impulse on active orb from window wheel events.
   *
   * @param {WheelEvent} event - The mouse wheel event.
   */
  @HostListener('window:wheel', ['$event'])
  onWindowWheel(event: WheelEvent): void {
    this.canvasComponent?.applyWheelSpin(event.deltaY);
  }

  /**
   * Handles selection of an orb, plays audio chime/sound, triggers canvas spin, and emits section index.
   *
   * @param {number} index - Index of selected section.
   */
  onOrbClick(index: number): void {
    const current = this.activeIndex();
    const speed = index >= current ? 12.5 : -12.5;
    this.canvasComponent?.triggerSpinBurst(index, speed);
    this.audioService.playParticleOrbScroll();
    this.sectionSelect.emit(index);
  }

  // ----------------------------------------------------
  // Idle Detection (Fade-out & Resource Savings)
  // ----------------------------------------------------
  private readonly onUserActivity = (): void => {
    this.handleActivity();
  };

  private setupIdleDetection(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('pointermove', this.onUserActivity, { passive: true });
    window.addEventListener('scroll', this.onUserActivity, { passive: true });
    window.addEventListener('wheel', this.onUserActivity, { passive: true });
    window.addEventListener('touchstart', this.onUserActivity, { passive: true });
    window.addEventListener('keydown', this.onUserActivity, { passive: true });

    this.initialEntranceTimeoutId = setTimeout(() => {
      this.hasInitialEntranceEnded = true;
      this.resetIdleTimer();
    }, 4400);
  }

  private cleanupIdleDetection(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('pointermove', this.onUserActivity);
    window.removeEventListener('scroll', this.onUserActivity);
    window.removeEventListener('wheel', this.onUserActivity);
    window.removeEventListener('touchstart', this.onUserActivity);
    window.removeEventListener('keydown', this.onUserActivity);

    if (this.initialEntranceTimeoutId !== null) {
      clearTimeout(this.initialEntranceTimeoutId);
      this.initialEntranceTimeoutId = null;
    }
    if (this.idleTimeoutId !== null) {
      clearTimeout(this.idleTimeoutId);
      this.idleTimeoutId = null;
    }
    if (this.pauseRenderTimeoutId !== null) {
      clearTimeout(this.pauseRenderTimeoutId);
      this.pauseRenderTimeoutId = null;
    }
  }

  private handleActivity(): void {
    if (this.pauseRenderTimeoutId !== null) {
      clearTimeout(this.pauseRenderTimeoutId);
      this.pauseRenderTimeoutId = null;
    }

    if (this.isIdle()) {
      this.ngZone.run(() => {
        this.isIdle.set(false);
        this.isWaking.set(true);
      });
      this.canvasComponent?.resumeRenderLoop();
    }

    this.resetIdleTimer();
  }

  private resetIdleTimer(): void {
    if (this.idleTimeoutId !== null) {
      clearTimeout(this.idleTimeoutId);
    }

    this.idleTimeoutId = setTimeout(() => {
      if (!this.hasInitialEntranceEnded || this.isDestroyed) return;

      this.ngZone.run(() => {
        this.isIdle.set(true);
        this.isWaking.set(false);
      });

      this.pauseRenderTimeoutId = setTimeout(() => {
        if (this.isIdle() && !this.isDestroyed) {
          this.canvasComponent?.pauseRenderLoop();
        }
      }, this.FADE_DURATION_MS);
    }, this.IDLE_DELAY_MS);
  }
}
