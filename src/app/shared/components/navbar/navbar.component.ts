import {
  Component,
  inject,
  signal,
  computed,
  effect,
  HostListener,
  NgZone,
  AfterViewInit,
  OnDestroy,
  ElementRef,
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { filter } from 'rxjs/operators';
import { AudioService } from '../../../core/services/audio.service';
import { SmoothScrollService } from '../../../core/services/smooth-scroll.service';
import { GameRegistryService } from '../../../core/services/game-registry.service';
import {
  CategoryItem,
  TooltipLetter,
  SoundBurstSpark,
  CraneFlightState,
} from './navbar.models';
import { createNavbarCategories } from './category.data';
import { NavbarBrandComponent } from './components/navbar-brand/navbar-brand.component';
import { OrigamiCraneComponent } from './components/origami-crane/origami-crane.component';
import { CategoryDropdownComponent } from './components/category-dropdown/category-dropdown.component';
import { NavbarSoundComponent } from './components/navbar-sound/navbar-sound.component';

export type { CategoryItem, TooltipLetter, SoundBurstSpark, CraneFlightState };

/**
 * Top navigation bar orchestrator component coordinating glass bar visibility,
 * origami crane flight states, unfolding categories portal, and global sound experiences.
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    NavbarBrandComponent,
    OrigamiCraneComponent,
    CategoryDropdownComponent,
    NavbarSoundComponent,
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent implements AfterViewInit, OnDestroy {
  readonly audioService = inject(AudioService);
  readonly gameRegistry = inject(GameRegistryService);
  private readonly smoothScroll = inject(SmoothScrollService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly elementRef = inject(ElementRef);

  /** Whether the navigation bar is currently visible on screen. */
  readonly isVisible = signal<boolean>(false);
  private readonly isLandingPage = signal<boolean>(true);

  // Origami Crane State
  /** Current flight state of the origami crane ('flying' during entrance or 'landed' when perched). */
  readonly flightState = signal<CraneFlightState>('flying');
  /** Whether the crane is currently flapping its wings in idle state. */
  readonly isFlapping = signal<boolean>(false);
  /** Whether the category dropdown menu is currently opened. */
  readonly isDropdownOpen = signal<boolean>(false);
  /** Whether the category dropdown menu is currently playing its closing transition. */
  readonly isDropdownClosing = signal<boolean>(false);

  // Audio activation state & fine stardust particles
  /** Whether the sound button is currently playing an explosive particle burst animation upon activation. */
  readonly isBursting = signal<boolean>(false);
  private wasAwaitingGesture = false;
  private burstTimeoutId: number | null = null;

  /** Staggered letter wave for "Sound an?" tooltip matching the hero sound activation prompt. */
  readonly soundTooltipLetters: TooltipLetter[] = (() => {
    const text = 'Sound an?';
    const chars = Array.from(text);
    const total = chars.length;
    return chars.map((char, index) => ({
      char: char === ' ' ? '\u00A0' : char,
      fromRight: total - 1 - index,
    }));
  })();

  /** 12 fine micro-particles orbiting calmly on 2 tracks (6 per track). */
  readonly orbitParticleIndices = Array.from({ length: 12 }, (_, i) => i);

  /** Explosive micro-sparks on audio activation click (14 delicate light points scattering outward). */
  readonly burstSparks = signal<SoundBurstSpark[]>([]);

  private flapTimeoutId: number | null = null;
  private flightTimeoutId: number | null = null;
  private closeTimeoutId: number | null = null;
  private lastScrollY = 0;
  private dropdownOpenScrollY = 0;
  private isDestroyed = false;

  /** List of available category items presented in the navigation menu. */
  readonly categories: CategoryItem[] = createNavbarCategories(this.sanitizer);

  /**
   * The currently active CategoryItem derived from the game registry selection.
   */
  readonly selectedCategory = computed(() => {
    const id = this.gameRegistry.selectedCategory();
    if (!id) return null;
    return this.categories.find((c) => c.id.toLowerCase() === id.toLowerCase()) ?? null;
  });

  /**
   * Initializes navigation subscriptions and smooth scroll listeners.
   */
  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = event.urlAfterRedirects.split('#')[0].split('?')[0];
        const isLanding = url === '/' || url === '';
        this.isLandingPage.set(isLanding);
        this.checkVisibility();
        this.closeDropdown(true);
      });

    // Automatically collapse dropdown when switching sections via Orbs or smooth scroll
    this.smoothScroll.programmaticScroll$.subscribe(() => {
      if (this.isDropdownOpen()) {
        this.closeDropdown();
      }
    });

    // Synchronize particle burst when user gesture activates audio playback
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

  /**
   * Lifecycle hook invoked after view initialization to start crane animations.
   *
   * @returns {void}
   */
  ngAfterViewInit(): void {
    this.checkVisibility();
    this.startCraneFlight();
    this.scheduleNextFlap();
  }

  /**
   * Lifecycle hook invoked when the component is destroyed to clean up timers.
   *
   * @returns {void}
   */
  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.flapTimeoutId !== null) {
      clearTimeout(this.flapTimeoutId);
    }
    if (this.flightTimeoutId !== null) {
      clearTimeout(this.flightTimeoutId);
    }
    if (this.closeTimeoutId !== null) {
      clearTimeout(this.closeTimeoutId);
    }
    if (this.burstTimeoutId !== null) {
      clearTimeout(this.burstTimeoutId);
    }
  }

  /**
   * Handles window wheel events to quickly collapse the dropdown on upward scroll.
   *
   * @param {WheelEvent} event - The mouse wheel event.
   * @returns {void}
   */
  @HostListener('window:wheel', ['$event'])
  onWindowWheel(event: WheelEvent): void {
    if (this.isDropdownOpen() && event.deltaY < -1) {
      this.closeDropdown();
    }
  }

  /**
   * Handles window scroll events to recalculate navbar visibility and dismiss dropdown on scroll.
   *
   * @returns {void}
   */
  @HostListener('window:scroll')
  onScroll(): void {
    const currentScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    const isScrollingUp = currentScrollY < this.lastScrollY - 2;
    const wasVisible = this.isVisible();
    this.checkVisibility();

    if (this.isDropdownOpen()) {
      if (isScrollingUp || Math.abs(currentScrollY - this.dropdownOpenScrollY) > 25) {
        this.closeDropdown();
      }
    }

    if (!wasVisible && this.isVisible()) {
      this.startCraneFlight();
    }

    this.lastScrollY = currentScrollY;
  }

  /**
   * Closes dropdown and returns focus on Escape keypress.
   *
   * @returns {void}
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDropdown(false, true);
  }

  /**
   * Traps keyboard tab focus inside the open dropdown menu.
   *
   * @param {KeyboardEvent} event - The keyboard event.
   * @returns {void}
   */
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.isDropdownOpen()) return;

    if (event.key === 'Tab') {
      const host = this.elementRef.nativeElement as HTMLElement;
      const dropdown = host.querySelector('.origami-dropdown-menu') as HTMLElement | null;
      if (!dropdown) return;

      const focusables = (Array.from(
        dropdown.querySelectorAll('button, [tabindex="0"], a')
      ) as HTMLElement[]).filter((el) => el.offsetParent !== null);

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  /**
   * Closes dropdown when clicking or tapping outside of the navbar host element.
   *
   * @param {PointerEvent} event - The document pointer down event.
   * @returns {void}
   */
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.isDropdownOpen() && !this.isDropdownClosing()) return;
    const target = event.target as HTMLElement | null;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.closeDropdown(false, false);
    }
  }

  /**
   * Checks current window scroll position against threshold to determine visibility.
   *
   * @returns {void}
   */
  private checkVisibility(): void {
    if (typeof window === 'undefined') return;
    if (!this.isLandingPage()) {
      this.isVisible.set(true);
      return;
    }
    const threshold = window.innerHeight * 0.7;
    let visible = window.scrollY >= threshold;

    const sanctuaryElement = document.getElementById('sanctuary');
    if (sanctuaryElement) {
      const rect = sanctuaryElement.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.5) {
        visible = false;
      }
    }
    this.isVisible.set(visible);
  }

  /**
   * Initiates the crane flight animation sequence, transitioning to landed state after delay.
   *
   * @returns {void}
   */
  private startCraneFlight(): void {
    if (this.flightTimeoutId !== null) {
      clearTimeout(this.flightTimeoutId);
    }
    this.flightState.set('flying');

    this.flightTimeoutId = window.setTimeout(() => {
      if (this.isDestroyed) return;
      this.flightState.set('landed');
      this.flightTimeoutId = null;
    }, 2500);
  }

  /**
   * Periodically triggers a brief 1-2 wing flap idle motion when the crane is landed.
   *
   * @returns {void}
   */
  private scheduleNextFlap(): void {
    if (this.isDestroyed) return;

    const delay = 3500 + Math.random() * 3000;

    this.flapTimeoutId = window.setTimeout(() => {
      if (this.isDestroyed) return;

      if (this.flightState() === 'landed') {
        this.ngZone.run(() => {
          this.isFlapping.set(true);
        });

        window.setTimeout(() => {
          if (this.isDestroyed) return;
          this.ngZone.run(() => {
            this.isFlapping.set(false);
          });
          this.scheduleNextFlap();
        }, 900);
      } else {
        this.scheduleNextFlap();
      }
    }, delay);
  }

  /**
   * Toggles the dropdown menu open/closed state with origami sound effect.
   *
   * @returns {void}
   */
  toggleDropdown(): void {
    if (this.isDropdownOpen()) {
      this.closeDropdown(false, true);
    } else {
      if (this.closeTimeoutId !== null) {
        clearTimeout(this.closeTimeoutId);
        this.closeTimeoutId = null;
      }
      this.isDropdownClosing.set(false);
      this.dropdownOpenScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
      this.isDropdownOpen.set(true);
      this.audioService.playCraneFolding(1.0);

      setTimeout(() => {
        const firstCard = this.elementRef.nativeElement.querySelector('.category-card') as HTMLElement | null;
        if (firstCard) {
          firstCard.focus();
        }
      }, 50);
    }
  }

  /**
   * Closes the dropdown menu with animated origami paper folding sequence.
   *
   * @param {boolean} [immediate=false] - Whether to close immediately without delay or animation.
   * @param {boolean} [returnFocus=false] - Whether to restore focus to the crane toggle button.
   * @returns {void}
   */
  closeDropdown(immediate = false, returnFocus = false): void {
    if (!this.isDropdownOpen() && !this.isDropdownClosing()) return;

    if (returnFocus) {
      const trigger = this.elementRef.nativeElement.querySelector('.crane-trigger-btn') as HTMLElement | null;
      if (trigger) {
        trigger.focus();
      }
    }

    if (immediate) {
      if (this.closeTimeoutId !== null) {
        clearTimeout(this.closeTimeoutId);
        this.closeTimeoutId = null;
      }
      this.isDropdownOpen.set(false);
      this.isDropdownClosing.set(false);
      return;
    }

    if (this.isDropdownClosing()) return;

    this.isDropdownOpen.set(false);
    this.isDropdownClosing.set(true);
    this.audioService.playCraneFolding(1.0);

    if (this.closeTimeoutId !== null) {
      clearTimeout(this.closeTimeoutId);
    }

    this.closeTimeoutId = window.setTimeout(() => {
      if (this.isDestroyed) return;
      this.isDropdownClosing.set(false);
      this.closeTimeoutId = null;
    }, 1450);
  }

  /**
   * Handles selection of a category item, scrolls to bubble hub or navigates home.
   *
   * @param {CategoryItem} cat - The chosen category item.
   * @returns {void}
   */
  onCategoryClick(cat: CategoryItem): void {
    this.gameRegistry.setSelectedCategory(cat.id);
    this.closeDropdown(false, true);
    this.audioService.playChime(3, 0.15);

    if (this.isLandingPage()) {
      const hubElement = document.getElementById('bubble-hub');
      if (hubElement) {
        const targetY = hubElement.getBoundingClientRect().top + window.scrollY;
        this.smoothScroll.smoothScrollTo(targetY);
      }
    } else {
      this.router.navigate(['/'], { fragment: 'bubble-hub' });
    }
  }

  /**
   * Resets active category filter to null and scrolls to bubble hub.
   *
   * @param {MouseEvent} [event] - Optional click event to prevent propagation.
   * @returns {void}
   */
  resetCategory(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.gameRegistry.setSelectedCategory(null);
    this.closeDropdown();
    this.audioService.playChime(2, 0.15);

    if (this.isLandingPage()) {
      const hubElement = document.getElementById('bubble-hub');
      if (hubElement) {
        const targetY = hubElement.getBoundingClientRect().top + window.scrollY;
        this.smoothScroll.smoothScrollTo(targetY);
      }
    } else {
      this.router.navigate(['/'], { fragment: 'bubble-hub' });
    }
  }

  /**
   * Spawns an explosive burst of 14 delicate micro-sparks radiating outward from the audio toggle button.
   *
   * @returns {void}
   */
  private triggerParticleBurst(): void {
    if (this.burstTimeoutId !== null) {
      clearTimeout(this.burstTimeoutId);
    }
    this.isBursting.set(true);

    const count = 14;
    const sparks: SoundBurstSpark[] = [];
    const baseAngle = Math.random() * Math.PI * 2;

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i * ((Math.PI * 2) / count)) + (Math.random() - 0.5) * 0.22;
      const startDist = 22 + Math.random() * 3;
      const endDist = startDist + 32 + Math.random() * 45;
      const isBlue = Math.random() < 0.5;

      sparks.push({
        id: i + 1,
        startX: Math.round(Math.cos(angle) * startDist * 10) / 10,
        startY: Math.round(Math.sin(angle) * startDist * 10) / 10,
        endX: Math.round(Math.cos(angle) * endDist * 10) / 10,
        endY: Math.round(Math.sin(angle) * endDist * 10) / 10,
        color: isBlue ? '#7dd3fc' : '#ffffff',
        size: Math.random() < 0.6 ? 1.5 : 2,
        delayMs: Math.round(Math.random() * 50),
      });
    }

    this.burstSparks.set(sparks);

    this.burstTimeoutId = window.setTimeout(() => {
      if (this.isDestroyed) return;
      this.isBursting.set(false);
      this.burstSparks.set([]);
      this.burstTimeoutId = null;
    }, 680);
  }

  /**
   * Toggles the master audio playback state.
   *
   * @returns {void}
   */
  onToggleAudio(): void {
    if (this.audioService.isAwaitingUserGesture()) {
      this.triggerParticleBurst();
    }
    this.audioService.toggleSound();
  }
}
