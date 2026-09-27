import {
  Component,
  inject,
  input,
  signal,
  effect,
  ViewChild,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { AudioService } from '../../../../core/services/audio.service';
import { SoundBeaconComponent, TooltipLetter } from '../sound-beacon/sound-beacon.component';
import { RopePhysicsComponent } from '../../../../shared/components/rope-physics/rope-physics.component';

/**
 * Cozy sanctuary ("Zuflucht") section featuring floating whales, interactive hot air balloons
 * with speech bubble modals for Imprint and Privacy, hanging lanterns/stars with Verlet rope physics,
 * and soothing whale song ambience.
 */
@Component({
  selector: 'app-sanctuary-section',
  standalone: true,
  imports: [SoundBeaconComponent, RopePhysicsComponent],
  templateUrl: './sanctuary-section.component.html',
  styleUrl: './sanctuary-section.component.scss',
})
export class SanctuarySectionComponent implements OnDestroy {
  readonly audioService = inject(AudioService);

  @ViewChild(RopePhysicsComponent) ropePhysicsComponent?: RopePhysicsComponent;

  /** Whether the sanctuary section is revealed by scroll position or navigation. */
  readonly isRevealed = input<boolean>(false);

  /** Whether the sanctuary section is currently in the active viewport. */
  readonly isInView = input<boolean>(false);

  // Sanctuary Interactive Balloons & Speech Bubbles
  readonly showImpressum = signal<boolean>(false);
  readonly showDatenschutz = signal<boolean>(false);
  readonly closingImpressum = signal<boolean>(false);
  readonly closingDatenschutz = signal<boolean>(false);
  private closingImpressumTimeout: ReturnType<typeof setTimeout> | null = null;
  private closingDatenschutzTimeout: ReturnType<typeof setTimeout> | null = null;

  // Free-floating warm letter arrays matching orb-tooltip for sanctuary balloons
  readonly impressumTooltipLetters: TooltipLetter[] = (() => {
    const text = 'Impressum';
    const chars = Array.from(text);
    const total = chars.length;
    return chars.map((char, index) => ({
      char: char === ' ' ? '\u00A0' : char,
      fromRight: total - 1 - index,
    }));
  })();

  readonly datenschutzTooltipLetters: TooltipLetter[] = (() => {
    const text = 'Datenschutz';
    const chars = Array.from(text);
    const total = chars.length;
    return chars.map((char, index) => ({
      char: char === ' ' ? '\u00A0' : char,
      fromRight: total - 1 - index,
    }));
  })();

  // Pointer Evasion & Rope Physics Coordination
  private sanctuaryEvadeRafId: number | null = null;
  private lastSanctuaryPointerEvent: PointerEvent | null = null;
  private isDestroyed = false;

  constructor() {
    effect(() => {
      const inSanctuary = this.isInView() || this.isRevealed();
      if (typeof document !== 'undefined') {
        if (inSanctuary) {
          document.body.classList.add('in-sanctuary');
        } else {
          document.body.classList.remove('in-sanctuary');
        }
      }
      if (inSanctuary) {
        this.audioService.startSanctuaryWhales();
      } else {
        this.audioService.stopSanctuaryWhales();
      }
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (typeof document !== 'undefined') {
      document.body.classList.remove('in-sanctuary');
    }
    this.audioService.stopSanctuaryWhales();

    if (this.closingImpressumTimeout) {
      clearTimeout(this.closingImpressumTimeout);
      this.closingImpressumTimeout = null;
    }
    if (this.closingDatenschutzTimeout) {
      clearTimeout(this.closingDatenschutzTimeout);
      this.closingDatenschutzTimeout = null;
    }
    if (this.sanctuaryEvadeRafId !== null) {
      cancelAnimationFrame(this.sanctuaryEvadeRafId);
      this.sanctuaryEvadeRafId = null;
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (this.showImpressum() || this.showDatenschutz()) {
      this.closeBalloons();
    }
  }

  onSanctuaryPointerMove(event: PointerEvent): void {
    if (typeof document !== 'undefined' && !document.body.classList.contains('in-sanctuary')) {
      document.body.classList.add('in-sanctuary');
    }
    this.lastSanctuaryPointerEvent = event;

    // 1. Tooltip Letter Evasion
    if (this.sanctuaryEvadeRafId === null) {
      this.sanctuaryEvadeRafId = requestAnimationFrame(() => {
        this.sanctuaryEvadeRafId = null;
        if (!this.lastSanctuaryPointerEvent || this.isDestroyed) return;
        this.applyEvadeToLetters(
          this.lastSanctuaryPointerEvent,
          '.hotspot-floating-tooltip .tooltip-letter',
          65,
          8.5,
          false,
          0.18
        );
      });
    }

    // 2. Interactive Verlet Rope Physics
    this.ropePhysicsComponent?.onPointerMove(event.clientX, event.clientY);
  }

  onSanctuaryPointerLeave(): void {
    if (this.sanctuaryEvadeRafId !== null) {
      cancelAnimationFrame(this.sanctuaryEvadeRafId);
      this.sanctuaryEvadeRafId = null;
    }
    this.lastSanctuaryPointerEvent = null;
    this.resetLettersEvade('.hotspot-floating-tooltip .tooltip-letter');
    this.ropePhysicsComponent?.onPointerLeave();
  }

  private applyEvadeToLetters(
    event: PointerEvent,
    selector: string,
    radius = 90,
    maxPush = 14,
    allowLift = true,
    verticalRatio = 1
  ): void {
    const letters = document.querySelectorAll<HTMLElement>(selector);
    const mouseX = event.clientX;
    const mouseY = event.clientY;

    letters.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - mouseX;
      const dy = cy - mouseY;
      const dist = Math.hypot(dx, dy);

      if (dist < radius && dist > 0.001) {
        const norm = dist / radius;
        const force = Math.pow(1 - norm, 1.6);
        const dirX = Math.abs(dx) > 0.5 ? Math.sign(dx) : (cx >= mouseX ? 1 : -1);
        const pushRatioX = verticalRatio < 0.5 ? Math.max(Math.abs(dx / dist), 0.6) * dirX : (dx / dist);
        const pushX = pushRatioX * force * maxPush;
        let pushY = (dy / dist) * force * maxPush * verticalRatio;
        if (!allowLift && pushY < 0) {
          pushY = 0;
        }
        const scale = 1 + force * (maxPush > 10 ? 0.08 : 0.045);
        const rot = (dx / dist) * force * (maxPush > 10 ? 3 : 1.8);

        el.style.setProperty('--evade-x', `${pushX.toFixed(2)}px`);
        el.style.setProperty('--evade-y', `${pushY.toFixed(2)}px`);
        el.style.setProperty('--evade-scale', `${scale.toFixed(3)}`);
        el.style.setProperty('--evade-rot', `${rot.toFixed(2)}deg`);
      } else {
        el.style.setProperty('--evade-x', '0px');
        el.style.setProperty('--evade-y', '0px');
        el.style.setProperty('--evade-scale', '1');
        el.style.setProperty('--evade-rot', '0deg');
      }
    });
  }

  private resetLettersEvade(selector: string): void {
    const letters = document.querySelectorAll<HTMLElement>(selector);
    letters.forEach((el) => {
      el.style.setProperty('--evade-x', '0px');
      el.style.setProperty('--evade-y', '0px');
      el.style.setProperty('--evade-scale', '1');
      el.style.setProperty('--evade-rot', '0deg');
    });
  }

  toggleImpressum(event: Event): void {
    event.stopPropagation();
    if (this.showImpressum()) {
      this.animateCloseBubble('impressum');
    } else {
      this.animateCloseBubble('datenschutz');
      this.showImpressum.set(true);
    }
    this.resetLettersEvade('.hotspot-floating-tooltip .tooltip-letter');
  }

  toggleDatenschutz(event: Event): void {
    event.stopPropagation();
    if (this.showDatenschutz()) {
      this.animateCloseBubble('datenschutz');
    } else {
      this.animateCloseBubble('impressum');
      this.showDatenschutz.set(true);
    }
    this.resetLettersEvade('.hotspot-floating-tooltip .tooltip-letter');
  }

  closeBalloons(): void {
    this.animateCloseBubble('impressum');
    this.animateCloseBubble('datenschutz');
    this.resetLettersEvade('.hotspot-floating-tooltip .tooltip-letter');
  }

  onSpeechBubbleWheel(event: WheelEvent): void {
    event.stopPropagation();
    const target = event.target as HTMLElement | null;
    const bubble = event.currentTarget as HTMLElement | null;
    const body = bubble?.querySelector('.bubble-body') as HTMLElement | null;
    if (body && target && !body.contains(target)) {
      body.scrollTop += event.deltaY;
      event.preventDefault();
    }
  }

  private animateCloseBubble(bubble: 'impressum' | 'datenschutz'): void {
    const DEFLATE_DURATION = 350;

    if (bubble === 'impressum' && this.showImpressum()) {
      if (this.closingImpressumTimeout) clearTimeout(this.closingImpressumTimeout);
      this.closingImpressum.set(true);
      this.closingImpressumTimeout = setTimeout(() => {
        this.showImpressum.set(false);
        this.closingImpressum.set(false);
        this.closingImpressumTimeout = null;
      }, DEFLATE_DURATION);
    }

    if (bubble === 'datenschutz' && this.showDatenschutz()) {
      if (this.closingDatenschutzTimeout) clearTimeout(this.closingDatenschutzTimeout);
      this.closingDatenschutz.set(true);
      this.closingDatenschutzTimeout = setTimeout(() => {
        this.showDatenschutz.set(false);
        this.closingDatenschutz.set(false);
        this.closingDatenschutzTimeout = null;
      }, DEFLATE_DURATION);
    }
  }

  onSanctuaryClick(): void {
    this.closeBalloons();
    if (this.audioService.isAwaitingUserGesture()) {
      this.audioService.activateSoundFromUserGesture();
    }
  }
}
