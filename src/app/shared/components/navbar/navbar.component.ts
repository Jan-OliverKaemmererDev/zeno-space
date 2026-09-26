import {
  Component,
  inject,
  signal,
  computed,
  HostListener,
  NgZone,
  AfterViewInit,
  OnDestroy,
  ElementRef,
} from '@angular/core';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { filter } from 'rxjs/operators';
import { AudioService } from '../../../core/services/audio.service';
import { SmoothScrollService } from '../../../core/services/smooth-scroll.service';
import { GameRegistryService } from '../../../core/services/game-registry.service';

export interface CategoryItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge?: string;
  route?: string;
  iconSvg: SafeHtml;
  tags?: string[];
}

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
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

  readonly isVisible = signal<boolean>(false);
  private isLandingPage = signal<boolean>(true);

  // Origami Crane State
  readonly flightState = signal<'flying' | 'landed'>('flying');
  readonly isFlapping = signal<boolean>(false);
  readonly isDropdownOpen = signal<boolean>(false);
  readonly isDropdownClosing = signal<boolean>(false);

  private flapTimeoutId: number | null = null;
  private flightTimeoutId: number | null = null;
  private closeTimeoutId: number | null = null;
  private lastScrollY = 0;
  private dropdownOpenScrollY = 0;
  private isDestroyed = false;

  readonly selectedCategory = computed(() => {
    const id = this.gameRegistry.selectedCategory();
    if (!id) return null;
    return this.categories.find((c) => c.id.toLowerCase() === id.toLowerCase()) ?? null;
  });

  readonly categories: CategoryItem[] = [
    {
      id: 'mathematik',
      title: 'Mathematik',
      subtitle: 'Geometrie & Kosmische Ordnung',
      description: 'Erforsche fraktale Harmonien, geometrische Muster und die mathematische Symmetrie des Raumes.',
      iconSvg: this.sanitizer.bypassSecurityTrustHtml(`
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9" opacity="0.35"/>
          <polygon points="12 4 20 18 4 18"/>
          <circle cx="12" cy="13" r="2.5"/>
          <line x1="12" y1="4" x2="12" y2="18" stroke-dasharray="1.5 2"/>
        </svg>
      `),
    },
    {
      id: 'astronomie',
      title: 'Astronomie',
      subtitle: 'Sterne, Kosmos & Himmelskörper',
      description: 'Erkunde die unendlichen Weiten des Weltalls, ferne Galaxien und die Gravitation kosmischer Sphären.',
      iconSvg: this.sanitizer.bypassSecurityTrustHtml(`
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(-25 12 12)"/>
          <path d="M19 5 L20 7 L22 7.5 L20 8.5 L19 10.5 L18 8.5 L16 7.5 L18 7 Z" fill="currentColor" stroke="none"/>
        </svg>
      `),
    },
    {
      id: 'natur',
      title: 'Natur',
      subtitle: 'Organische Welten & Elemente',
      description: 'Erlebe die beruhigende Kraft der Natur, von sanft fließendem Wasser bis zu lebendigen floralen Strukturen.',
      iconSvg: this.sanitizer.bypassSecurityTrustHtml(`
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2C6.5 7 4 12 6 16.5C8 21 16 21 18 16.5C20 12 17.5 7 12 2Z"/>
          <path d="M12 7V19"/>
          <path d="M12 12C9.5 13 8 14.5 8 16"/>
          <path d="M12 10C14.5 11 16 12.5 16 14"/>
        </svg>
      `),
    },
    {
      id: 'geraeusche',
      title: 'Geräusche',
      subtitle: 'Klanglandschaften & Akustik',
      description: 'Tauche ein in meditative Frequenzen, atmosphärische Klangflächen und beruhigende akustische Räume.',
      iconSvg: this.sanitizer.bypassSecurityTrustHtml(`
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 14h3l3.5-7 3.5 14 3.5-9 2 4h3"/>
          <circle cx="3" cy="14" r="1.5" fill="currentColor"/>
          <circle cx="21" cy="16" r="1.5" fill="currentColor"/>
        </svg>
      `),
    },
    {
      id: 'relax',
      title: 'Relax',
      subtitle: 'Achtsamkeit & Entschleunigung',
      description: 'Finde innere Ruhe und Balance durch sanfte Interaktionen, meditative Momente und stressfreie Sphären.',
      iconSvg: this.sanitizer.bypassSecurityTrustHtml(`
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="10" cy="14" r="6"/>
          <circle cx="17" cy="8" r="4" opacity="0.75"/>
          <circle cx="17.5" cy="16.5" r="2.5" opacity="0.6"/>
          <path d="M7.5 11.5a3 3 0 0 1 3-3" stroke-linecap="round"/>
        </svg>
      `),
    },
    {
      id: 'abenteuer',
      title: 'Abenteuer',
      subtitle: 'Erkundung & Kosmische Mysterien',
      description: 'Begib dich auf intuitive Entdeckungsreisen, entschlüssele Geheimnisse und erforsche verborgene Pfade.',
      iconSvg: this.sanitizer.bypassSecurityTrustHtml(`
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"/>
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fill-opacity="0.2"/>
          <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
        </svg>
      `),
    },
  ];

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
  }

  ngAfterViewInit(): void {
    this.checkVisibility();
    this.startCraneFlight();
    this.scheduleNextFlap();
  }

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
  }

  @HostListener('window:wheel', ['$event'])
  onWindowWheel(event: WheelEvent): void {
    // Immediately collapse dropdown on upward scroll gesture
    if (this.isDropdownOpen() && event.deltaY < -1) {
      this.closeDropdown();
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const currentScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    const isScrollingUp = currentScrollY < this.lastScrollY - 2;
    const wasVisible = this.isVisible();
    this.checkVisibility();

    // Close dropdown on scroll up, or when scrolling away from open point
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

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDropdown(false, true);
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.isDropdownOpen()) return;

    if (event.key === 'Tab') {
      const host = this.elementRef.nativeElement as HTMLElement;
      const dropdown = host.querySelector('.origami-dropdown-menu') as HTMLElement | null;
      if (!dropdown) return;

      const focusables = (Array.from(
        dropdown.querySelectorAll('button, [tabindex="0"], a')
      ) as HTMLElement[]).filter(el => el.offsetParent !== null);

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

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.isDropdownOpen() && !this.isDropdownClosing()) return;
    const target = event.target as HTMLElement | null;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.closeDropdown(false, false);
    }
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
   * Periodically triggers a brief 1-2 wing flap idle motion
   * matching public/images/1C3E8D36-FF53-4C56-90B4-35DF073A0B54.gif
   */
  private scheduleNextFlap(): void {
    if (this.isDestroyed) return;

    // Random delay between 3.5s and 6.5s
    const delay = 3500 + Math.random() * 3000;

    this.flapTimeoutId = window.setTimeout(() => {
      if (this.isDestroyed) return;

      // Flap when perched peacefully, uninterrupted whether menu is open or closed
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

      // Focus first category card inside dropdown for immediate keyboard usability
      setTimeout(() => {
        const firstCard = this.elementRef.nativeElement.querySelector('.category-card') as HTMLElement | null;
        if (firstCard) {
          firstCard.focus();
        }
      }, 50);
    }
  }

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

  onCategoryKeydown(event: KeyboardEvent, index: number): void {
    const host = this.elementRef.nativeElement as HTMLElement;
    const cards = Array.from(
      host.querySelectorAll('.category-card')
    ) as HTMLElement[];
    if (!cards.length) return;

    let targetIndex = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      targetIndex = (index + 1) % cards.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      targetIndex = (index - 1 + cards.length) % cards.length;
    } else if (event.key === 'Home') {
      targetIndex = 0;
    } else if (event.key === 'End') {
      targetIndex = cards.length - 1;
    }

    if (targetIndex >= 0) {
      event.preventDefault();
      cards[targetIndex].focus();
    }
  }

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

  onToggleAudio(): void {
    this.audioService.toggleSound();
  }
}
