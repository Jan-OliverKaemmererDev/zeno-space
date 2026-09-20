import {
  Component,
  inject,
  signal,
  computed,
  HostListener,
  ViewChild,
  ElementRef,
  NgZone,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AudioService } from '../../../core/services/audio.service';
import { GameRegistryService } from '../../../core/services/game-registry.service';

export interface WorldItem {
  id: string;
  title: string;
  fullTitle: string;
  route: string;
}

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent implements AfterViewInit, OnDestroy {
  readonly audioService = inject(AudioService);
  private readonly gameRegistry = inject(GameRegistryService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  readonly isVisible = signal<boolean>(false);
  private isLandingPage = signal<boolean>(true);

  @ViewChild('wheelViewport')
  private wheelViewportRef?: ElementRef<HTMLElement>;

  @ViewChild('wheelCylinder')
  private wheelCylinderRef?: ElementRef<HTMLElement>;

  // Dynamically registered worlds (clean display titles, no emojis)
  readonly worlds = computed<WorldItem[]>(() => {
    return this.gameRegistry.games().map((game) => ({
      id: game.id,
      title: this.cleanWorldTitle(game.title),
      fullTitle: game.title,
      route: game.route,
    }));
  });

  // 8 tire slots repeating the 4 worlds around the tire circumference
  readonly tireSlots = computed<WorldItem[]>(() => {
    const w = this.worlds();
    if (w.length === 0) return [];
    return [...w, ...w];
  });

  readonly angleStep = computed(() => {
    const count = Math.max(1, this.tireSlots().length);
    return 360 / count; // 45 degrees per slot for 8 slots
  });

  readonly activeSlotIndex = signal<number>(0);
  readonly activeWorldIndex = computed(() => {
    const count = this.worlds().length;
    if (count === 0) return 0;
    return this.activeSlotIndex() % count;
  });

  // 3D physics state
  private currentAngle = 0;
  private targetAngle = 0;
  private velocity = 0;
  private isDragging = false;
  private startX = 0;
  private lastX = 0;
  private lastTime = 0;
  private dragDistance = 0;
  private hasDragged = false;
  private animFrameId: number | null = null;
  private isDestroyed = false;

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = event.urlAfterRedirects.split('#')[0].split('?')[0];
        const isLanding = url === '/' || url === '';
        this.isLandingPage.set(isLanding);
        this.checkVisibility();
        this.alignToCurrentRoute(url);
      });
  }

  ngAfterViewInit(): void {
    this.setupViewportEvents();
    this.startAnimationLoop();
    this.alignToCurrentRoute(this.router.url);
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    const el = this.wheelViewportRef?.nativeElement;
    if (el) {
      el.removeEventListener('pointerdown', this.handlePointerDown);
      el.removeEventListener('wheel', this.handleWheel);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', this.handlePointerMove);
      window.removeEventListener('pointerup', this.handlePointerUp);
      window.removeEventListener('pointercancel', this.handlePointerUp);
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.checkVisibility();
  }

  private checkVisibility(): void {
    if (typeof window === 'undefined') return;
    if (!this.isLandingPage()) {
      this.isVisible.set(true);
      return;
    }
    // On landing page, only show below the hero viewport
    const threshold = window.innerHeight * 0.7;
    this.isVisible.set(window.scrollY >= threshold);
  }

  getItemTransform(index: number): string {
    const step = this.angleStep();
    const itemAngle = index * step;
    const relAngle = (((itemAngle + this.currentAngle) % 360) + 540) % 360 - 180;
    const rad = (relAngle * Math.PI) / 180;
    const R = 168;
    const x = Math.sin(rad) * R;
    const z = (Math.cos(rad) - 1) * R;
    const rotY = relAngle;
    const scale = 0.92 + 0.08 * Math.max(0, Math.cos(rad));
    return `translate3d(${x.toFixed(1)}px, 0px, ${z.toFixed(1)}px) rotateY(${rotY.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
  }

  private cleanWorldTitle(title: string): string {
    return title
      .replace('Zen Sculptor', 'Sculptor')
      .replace(' & Ripple', '')
      .replace('Cozy ', '')
      .trim();
  }

  private alignToCurrentRoute(url: string): void {
    const worlds = this.worlds();
    const foundIndex = worlds.findIndex((w) => url.startsWith(w.route));
    if (foundIndex !== -1) {
      this.rotateToWorldIndex(foundIndex);
    }
  }

  private rotateToWorldIndex(worldIndex: number): void {
    const step = this.angleStep();
    const count = Math.max(1, this.tireSlots().length);
    const currentFrontSlot = ((-Math.round(this.targetAngle / step) % count) + count) % count;
    const opt1 = worldIndex;
    const opt2 = worldIndex + 4;
    let diff1 = opt1 - currentFrontSlot;
    if (diff1 > count / 2) diff1 -= count;
    if (diff1 < -count / 2) diff1 += count;
    let diff2 = opt2 - currentFrontSlot;
    if (diff2 > count / 2) diff2 -= count;
    if (diff2 < -count / 2) diff2 += count;
    const bestDiff = Math.abs(diff1) <= Math.abs(diff2) ? diff1 : diff2;
    this.targetAngle -= bestDiff * step;
  }

  private rotateToSlotIndex(slotIndex: number): void {
    const step = this.angleStep();
    const count = Math.max(1, this.tireSlots().length);
    const currentFrontSlot = ((-Math.round(this.targetAngle / step) % count) + count) % count;
    let diff = slotIndex - currentFrontSlot;
    if (diff > count / 2) diff -= count;
    if (diff < -count / 2) diff += count;
    this.targetAngle -= diff * step;
  }

  private setupViewportEvents(): void {
    const el = this.wheelViewportRef?.nativeElement;
    if (!el) return;

    this.ngZone.runOutsideAngular(() => {
      el.addEventListener('pointerdown', this.handlePointerDown);
      if (typeof window !== 'undefined') {
        window.addEventListener('pointermove', this.handlePointerMove);
        window.addEventListener('pointerup', this.handlePointerUp);
        window.addEventListener('pointercancel', this.handlePointerUp);
      }
      el.addEventListener('wheel', this.handleWheel, { passive: false });
    });
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.isDragging = true;
    this.startX = event.clientX;
    this.lastX = event.clientX;
    this.lastTime = performance.now();
    this.dragDistance = 0;
    this.hasDragged = false;
    this.velocity = 0;
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.isDragging) return;

    const now = performance.now();
    const dt = Math.max(1, now - this.lastTime);
    const dx = event.clientX - this.lastX;

    this.dragDistance += Math.abs(dx);
    if (this.dragDistance > 5) {
      this.hasDragged = true;
    }

    const sensitivity = 0.36;
    this.targetAngle += dx * sensitivity;

    const currentVelocity = (dx / dt) * 16 * sensitivity;
    this.velocity = this.velocity * 0.4 + currentVelocity * 0.6;

    this.lastX = event.clientX;
    this.lastTime = now;
  };

  private handlePointerUp = (_event: PointerEvent): void => {
    if (!this.isDragging) return;
    this.isDragging = false;

    if (this.hasDragged) {
      setTimeout(() => {
        this.hasDragged = false;
      }, 120);
    }
  };

  private handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    this.targetAngle += delta * -0.22;
    this.velocity = delta * -0.15;
  };

  onSlotClick(event: MouseEvent, slot: WorldItem, index: number): void {
    if (this.hasDragged || this.activeSlotIndex() !== index) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.router.navigateByUrl(slot.route);
  }

  onToggleAudio(): void {
    this.audioService.toggleSound();
  }

  private startAnimationLoop(): void {
    const loop = () => {
      if (this.isDestroyed) return;

      const step = this.angleStep();
      const count = Math.max(1, this.tireSlots().length);

      if (!this.isDragging) {
        this.velocity *= 0.92;
        if (Math.abs(this.velocity) > 0.01) {
          this.targetAngle += this.velocity;
        }

        // Snap smoothly to nearest tire slot when coasting down
        if (Math.abs(this.velocity) < 0.12) {
          const snapSlot = Math.round(this.targetAngle / step);
          const snapTarget = snapSlot * step;
          if (Math.abs(snapTarget - this.targetAngle) < 0.02) {
            this.targetAngle = snapTarget;
          } else {
            this.targetAngle += (snapTarget - this.targetAngle) * 0.12;
          }
        }
      }

      // Smooth lerp with zero-jitter standstill threshold
      if (Math.abs(this.targetAngle - this.currentAngle) < 0.02) {
        this.currentAngle = this.targetAngle;
      } else {
        this.currentAngle += (this.targetAngle - this.currentAngle) * 0.16;
      }

      // Update 3D tire positioning: pills glued onto the outer circumference of a horizontal tire
      const cylinder = this.wheelCylinderRef?.nativeElement;
      if (cylinder) {
        const viewport = cylinder.parentElement;
        const viewportWidth = viewport?.clientWidth || 390;
        const R = Math.min(168, Math.round(viewportWidth * 0.42));

        const items = cylinder.querySelectorAll<HTMLElement>('.wheel-item');
        items.forEach((el, i) => {
          const itemAngle = i * step;
          const relAngle = (((itemAngle + this.currentAngle) % 360) + 540) % 360 - 180;
          const rad = (relAngle * Math.PI) / 180;

          // Pure circular tire math: center at (0, 0, -R)
          const x = Math.sin(rad) * R;
          const z = (Math.cos(rad) - 1) * R;
          // Tangent to cylinder surface: tilted backwards into depth
          const rotY = relAngle;
          const scale = 0.92 + 0.08 * Math.max(0, Math.cos(rad));
          const depthFactor = (1 + Math.cos(rad)) / 2;

          // Render visible front half and flanks; hide back of the tire
          if (Math.cos(rad) > -0.2) {
            el.style.transform = `translate3d(${x.toFixed(1)}px, 0px, ${z.toFixed(1)}px) rotateY(${rotY.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
            const isCenterPill = Math.abs(relAngle) < 12 && i === this.activeSlotIndex();
            el.style.pointerEvents = isCenterPill ? 'auto' : 'none';
            el.style.cursor = isCenterPill ? 'pointer' : 'grab';
            el.style.visibility = 'visible';

            // Depth blur: center pill is crisp, outer curving ends get blur
            const blurAmount = Math.pow(1 - depthFactor, 1.35) * 3.6;
            el.style.filter = blurAmount > 0.15 ? `blur(${blurAmount.toFixed(1)}px)` : 'none';

            el.classList.toggle('is-side-left', relAngle < -15);
            el.classList.toggle('is-side-right', relAngle > 15);
          } else {
            el.style.opacity = '0';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
            el.style.filter = 'none';
            el.classList.remove('is-side-left', 'is-side-right');
          }
        });

        const normalizedSlot = ((-Math.round(this.currentAngle / step) % count) + count) % count;
        if (normalizedSlot !== this.activeSlotIndex()) {
          this.ngZone.run(() => {
            this.activeSlotIndex.set(normalizedSlot);
          });
        }
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.ngZone.runOutsideAngular(() => {
      this.animFrameId = requestAnimationFrame(loop);
    });
  }
}
