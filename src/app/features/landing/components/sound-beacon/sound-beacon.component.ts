import {
  Component,
  inject,
  input,
  signal,
  effect,
  OnDestroy,
} from '@angular/core';
import { AudioService } from '../../../../core/services/audio.service';

/**
 * Character data with right-aligned stagger index for wave tooltips.
 */
export interface TooltipLetter {
  /** Character to display. */
  char: string;
  /** Distance index counted from the right edge. */
  fromRight: number;
}

/**
 * Visual spark particle emitted from the sound toggle button burst animation.
 */
export interface SoundBurstSpark {
  /** Unique identifier for the spark. */
  id: number;
  /** Starting X coordinate. */
  startX: number;
  /** Starting Y coordinate. */
  startY: number;
  /** Destination X coordinate. */
  endX: number;
  /** Destination Y coordinate. */
  endY: number;
  /** CSS color hex code. */
  color: string;
  /** Particle size in pixels. */
  size: number;
  /** Stagger delay in milliseconds. */
  delayMs: number;
}

/**
 * Interactive sound activation button with orbital stardust micro-particles,
 * wave-animated tooltip, beacon pulse halo, and explosive click sparks.
 * Reusable for both Hero (cyan) and Sanctuary (warm amber) themes.
 */
@Component({
  selector: 'app-sound-beacon',
  standalone: true,
  templateUrl: './sound-beacon.component.html',
  styleUrl: './sound-beacon.component.scss',
})
export class SoundBeaconComponent implements OnDestroy {
  readonly audioService = inject(AudioService);

  /** Visual variant: 'hero' (celestial cyan) or 'sanctuary' (warm amber). */
  readonly variant = input<'hero' | 'sanctuary'>('hero');

  /** Whether the sanctuary container is revealed (triggers smooth entrance animation). */
  readonly isRevealed = input<boolean>(true);

  readonly isBursting = signal<boolean>(false);
  readonly burstSparks = signal<SoundBurstSpark[]>([]);
  readonly orbitParticleIndices = Array.from({ length: 12 }, (_, i) => i);

  private wasAwaitingGesture = false;
  private burstTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Staggered letter wave for "Sound an?" tooltip matching orb-tooltip */
  readonly soundTooltipLetters: TooltipLetter[] = (() => {
    const text = 'Sound an?';
    const chars = Array.from(text);
    const total = chars.length;
    return chars.map((char, index) => ({
      char: char === ' ' ? '\u00A0' : char,
      fromRight: total - 1 - index,
    }));
  })();

  constructor() {
    effect(() => {
      const awaiting = this.audioService.isAwaitingUserGesture();
      if (awaiting) {
        this.wasAwaitingGesture = true;
      } else if (this.wasAwaitingGesture) {
        this.wasAwaitingGesture = false;
        this.triggerParticleBurst();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.burstTimeout) {
      clearTimeout(this.burstTimeout);
      this.burstTimeout = null;
    }
  }

  /**
   * Spawns an explosive burst of 14 delicate micro-sparks radiating outward from the audio toggle button.
   */
  triggerParticleBurst(): void {
    if (this.burstTimeout) {
      clearTimeout(this.burstTimeout);
    }
    this.isBursting.set(true);

    const count = 14;
    const sparks: SoundBurstSpark[] = [];
    const baseAngle = Math.random() * Math.PI * 2;
    const isSanctuary = this.variant() === 'sanctuary';

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i * ((Math.PI * 2) / count)) + (Math.random() - 0.5) * 0.22;
      const startDist = 22 + Math.random() * 3;
      const endDist = startDist + 32 + Math.random() * 45;
      const isAlt = Math.random() < 0.5;

      const color = isSanctuary
        ? (isAlt ? '#fcd34d' : '#fffbeb')
        : (isAlt ? '#7dd3fc' : '#ffffff');

      sparks.push({
        id: i + 1,
        startX: Math.round(Math.cos(angle) * startDist * 10) / 10,
        startY: Math.round(Math.sin(angle) * startDist * 10) / 10,
        endX: Math.round(Math.cos(angle) * endDist * 10) / 10,
        endY: Math.round(Math.sin(angle) * endDist * 10) / 10,
        color,
        size: Math.random() < 0.6 ? 1.5 : 2,
        delayMs: Math.round(Math.random() * 50),
      });
    }

    this.burstSparks.set(sparks);

    this.burstTimeout = setTimeout(() => {
      this.isBursting.set(false);
      this.burstSparks.set([]);
      this.burstTimeout = null;
    }, 680);
  }

  /**
   * Toggles sound muted/unmuted state with particle burst if awaiting user gesture.
   */
  toggleSound(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.audioService.isAwaitingUserGesture()) {
      this.triggerParticleBurst();
    }
    this.audioService.toggleSound();
  }
}
