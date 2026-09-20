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

  readonly angleStep = computed(() => {
    const count = Math.max(1, this.worlds().length);
    return 360 / count;
  });

  readonly wheelRadius = computed(() => {
    const count = Math.max(4, this.worlds().length);
    // Cylinder radius based on polygon edge width ~130px
    const dynamicRadius = Math.round(130 / (2 * Math.tan(Math.PI / count)));
    return Math.max(135, dynamicRadius);
  });

  readonly activeWorldIndex = signal<number>(0);

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
    this.startAnimationLoop();
    this.alignToCurrentRoute(this.router.url);
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
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
    const relAngle = index * step;
    const rad = (relAngle * Math.PI) / 180;
    const x = Math.sin(rad) * 155;
    const z = (Math.cos(rad) - 1) * 45;
    const rotY = -Math.sin(rad) * 26;
    const scale = 0.86 + 0.14 * Math.max(0, Math.cos(rad));
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
      this.rotateToIndex(foundIndex);
    }
  }

  private rotateToIndex(index: number): void {
    const step = this.angleStep();
    const count = Math.max(1, this.worlds().length);
    const currentFrontIndex = ((-Math.round(this.targetAngle / step) % count) + count) % count;
    let diff = index - currentFrontIndex;
    if (diff > count / 2) diff -= count;
    if (diff < -count / 2) diff += count;
    this.targetAngle -= diff * step;
  }

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.isDragging = true;
    this.startX = event.clientX;
    this.lastX = event.clientX;
    this.lastTime = performance.now();
    this.dragDistance = 0;
    this.hasDragged = false;
    this.velocity = 0;

    const target = event.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(event.pointerId);
    } catch {}
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging) return;

    const now = performance.now();
    const dt = Math.max(1, now - this.lastTime);
    const dx = event.clientX - this.lastX;

    this.dragDistance += Math.abs(dx);
    if (this.dragDistance > 5) {
      this.hasDragged = true;
    }

    const sensitivity = 0.55;
    this.targetAngle += dx * sensitivity;

    const currentVelocity = (dx / dt) * 16 * sensitivity;
    this.velocity = this.velocity * 0.4 + currentVelocity * 0.6;

    this.lastX = event.clientX;
    this.lastTime = now;
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    try {
      const target = event.currentTarget as HTMLElement;
      target.releasePointerCapture(event.pointerId);
    } catch {}

    if (this.hasDragged) {
      setTimeout(() => {
        this.hasDragged = false;
      }, 120);
    }
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    this.targetAngle += delta * -0.25;
    this.velocity = delta * -0.18;
  }

  onWorldClick(event: MouseEvent, world: WorldItem, index: number): void {
    if (this.hasDragged) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.rotateToIndex(index);
    this.router.navigateByUrl(world.route);
  }

  onToggleAudio(): void {
    this.audioService.toggleSound();
  }

  private startAnimationLoop(): void {
    const loop = () => {
      if (this.isDestroyed) return;

      const step = this.angleStep();
      const count = Math.max(1, this.worlds().length);

      if (!this.isDragging) {
        this.velocity *= 0.92;
        if (Math.abs(this.velocity) > 0.01) {
          this.targetAngle += this.velocity;
        }

        // Snap smoothly to nearest world when coasting down
        if (Math.abs(this.velocity) < 0.12) {
          const snapIndex = Math.round(this.targetAngle / step);
          const snapTarget = snapIndex * step;
          this.targetAngle += (snapTarget - this.targetAngle) * 0.1;
        }
      }

      // Smooth lerp
      this.currentAngle += (this.targetAngle - this.currentAngle) * 0.16;

      // Update 3D carousel positioning: perfectly centered at Y=0, neighbors flanking
      const cylinder = this.wheelCylinderRef?.nativeElement;
      if (cylinder) {
        const items = cylinder.querySelectorAll<HTMLElement>('.wheel-item');
        items.forEach((el, i) => {
          const itemAngle = i * step;
          const relAngle = (((itemAngle + this.currentAngle) % 360) + 540) % 360 - 180;
          const rad = (relAngle * Math.PI) / 180;

          // X spans horizontally: center at 0, neighbors at ~+-155px
          const x = Math.sin(rad) * 155;
          // Z recedes gently into background
          const z = (Math.cos(rad) - 1) * 45;
          // rotY tilts slightly towards viewer
          const rotY = -Math.sin(rad) * 26;
          // scale subtly from 1.0 at front to 0.86 at sides
          const scale = 0.86 + 0.14 * Math.max(0, Math.cos(rad));
          const depthFactor = (1 + Math.cos(rad)) / 2;

          if (depthFactor > 0.15) {
            el.style.transform = `translate3d(${x.toFixed(1)}px, 0px, ${z.toFixed(1)}px) rotateY(${rotY.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
            el.style.opacity = `${Math.max(0.35, Math.pow(depthFactor, 0.6)).toFixed(2)}`;
            el.style.pointerEvents = depthFactor > 0.4 ? 'auto' : 'none';
            el.style.visibility = 'visible';
          } else {
            el.style.opacity = '0';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
          }
        });

        const normalizedIndex = ((-Math.round(this.currentAngle / step) % count) + count) % count;
        if (normalizedIndex !== this.activeWorldIndex()) {
          this.ngZone.run(() => {
            this.activeWorldIndex.set(normalizedIndex);
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
