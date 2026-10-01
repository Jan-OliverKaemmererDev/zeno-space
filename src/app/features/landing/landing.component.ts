import {
  Component,
  inject,
  signal,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { GameRegistryService } from '../../core/services/game-registry.service';
import { AudioService } from '../../core/services/audio.service';
import { SmoothScrollService } from '../../core/services/smooth-scroll.service';
import { CloudCanvasComponent } from './components/cloud-canvas/cloud-canvas.component';
import { HeroSectionComponent } from './components/hero-section/hero-section.component';
import { BubbleHubSectionComponent } from './components/bubble-hub-section/bubble-hub-section.component';
import { SanctuarySectionComponent } from './components/sanctuary-section/sanctuary-section.component';
import { OrbNavComponent, NavSection } from '../../shared/components/orb-nav/orb-nav.component';

/**
 * Main landing page orchestrator component.
 * Coordinates smooth scrolling, section detection, global navigation, and ambient music.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CloudCanvasComponent,
    HeroSectionComponent,
    BubbleHubSectionComponent,
    SanctuarySectionComponent,
    OrbNavComponent,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  readonly gameRegistry = inject(GameRegistryService);
  readonly audioService = inject(AudioService);
  readonly smoothScroll = inject(SmoothScrollService);
  private readonly route = inject(ActivatedRoute);
  private fragmentSub?: Subscription;

  @ViewChild('scrollBody') scrollBodyRef!: ElementRef<HTMLElement>;

  // Navigation Anchors
  readonly sections: NavSection[] = [
    { id: 'hero', label: 'Kosmos' },
    { id: 'bubble-hub', label: 'Welten' },
    { id: 'sanctuary', label: 'Zuflucht' },
  ];
  readonly activeSectionIndex = signal<number>(0);

  // Sanctuary Viewport Visibility
  readonly isSanctuaryRevealed = signal<boolean>(false);
  readonly isInSanctuaryView = signal<boolean>(false);
  private sanctuaryIntersectionObserver: IntersectionObserver | null = null;

  private isProgrammaticScroll = false;
  private programmaticScrollTimeout: ReturnType<typeof setTimeout> | null = null;
  private hasTriggeredHubScroll = false;

  ngAfterViewInit(): void {
    this.smoothScroll.registerContainer(this.scrollBodyRef?.nativeElement ?? null);
    this.smoothScroll.syncWithCurrentScroll();
    this.initSanctuaryObserver();
    this.audioService.playAmbientMusic();
    this.updateActiveSection();

    this.fragmentSub = this.route.fragment.subscribe((fragment) => {
      if (fragment === 'bubble-hub') {
        this.triggerHubScroll();
      }
    });

    if (typeof window !== 'undefined') {
      if (window.location.hash === '#bubble-hub' || this.gameRegistry.selectedCategory()) {
        this.triggerHubScroll();
      }
    }
  }

  private triggerHubScroll(): void {
    if (this.hasTriggeredHubScroll) return;
    this.hasTriggeredHubScroll = true;
    setTimeout(() => {
      this.scrollToHub();
      this.hasTriggeredHubScroll = false;
    }, 150);
  }

  ngOnDestroy(): void {
    this.fragmentSub?.unsubscribe();
    this.smoothScroll.registerContainer(null);
    this.audioService.pauseAmbientMusic();
    if (this.programmaticScrollTimeout) {
      clearTimeout(this.programmaticScrollTimeout);
      this.programmaticScrollTimeout = null;
    }
    if (this.sanctuaryIntersectionObserver) {
      this.sanctuaryIntersectionObserver.disconnect();
      this.sanctuaryIntersectionObserver = null;
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (!this.isProgrammaticScroll) {
      this.updateActiveSection();
    }
  }

  private initSanctuaryObserver(): void {
    if (typeof window === 'undefined') return;

    if (!('IntersectionObserver' in window)) {
      this.isSanctuaryRevealed.set(true);
      return;
    }

    const sanctuaryEl = document.getElementById('sanctuary');
    if (!sanctuaryEl) return;

    this.sanctuaryIntersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.isSanctuaryRevealed.set(true);
            this.isInSanctuaryView.set(true);
          } else {
            const rect = entry.boundingClientRect;
            if (rect.top > window.innerHeight || rect.bottom < 0) {
              this.isSanctuaryRevealed.set(false);
              this.isInSanctuaryView.set(false);
            }
          }
        }
      },
      { threshold: [0, 0.05], rootMargin: '0px 0px -5% 0px' }
    );
    this.sanctuaryIntersectionObserver.observe(sanctuaryEl);
  }

  private updateActiveSection(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    if (scrollY <= 80) {
      this.setSection(0);
      this.isSanctuaryRevealed.set(false);
      return;
    }
    if (maxScroll > 0 && scrollY >= maxScroll - 60) {
      this.setSection(2);
      this.isSanctuaryRevealed.set(true);
      return;
    }

    const sanctuaryEl = document.getElementById('sanctuary');
    const hubEl = document.getElementById('bubble-hub');

    if (sanctuaryEl) {
      const rect = sanctuaryEl.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.85 && rect.bottom > 60;
      this.isInSanctuaryView.set(inView);

      if (rect.top <= window.innerHeight * 0.75) {
        this.isSanctuaryRevealed.set(true);
      } else if (rect.top > window.innerHeight * 0.90) {
        this.isSanctuaryRevealed.set(false);
      }

      if (rect.top <= window.innerHeight * 0.60) {
        this.setSection(2);
        return;
      }
    } else {
      this.isInSanctuaryView.set(false);
    }

    if (hubEl) {
      const rect = hubEl.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.55) {
        this.setSection(1);
        return;
      }
    }

    this.setSection(0);
  }

  setSection(index: number, playSound = false): void {
    const current = this.activeSectionIndex();
    if (current === index) return;

    this.activeSectionIndex.set(index);

    if (index === 2) {
      this.isSanctuaryRevealed.set(true);
    }

    if (playSound) {
      this.audioService.playChime(3, 0.12);
    }
  }

  scrollToSection(index: number): void {
    if (typeof document === 'undefined') return;
    const section = this.sections[index];
    if (!section) return;

    this.isProgrammaticScroll = true;
    if (this.programmaticScrollTimeout) {
      clearTimeout(this.programmaticScrollTimeout);
    }
    this.programmaticScrollTimeout = setTimeout(() => {
      this.isProgrammaticScroll = false;
      this.programmaticScrollTimeout = null;
    }, 850);

    this.setSection(index, false);

    if (section.id === 'hero') {
      this.smoothScroll.smoothScrollTo(0);
      return;
    }

    const el = document.getElementById(section.id);
    if (el) {
      const targetY = el.getBoundingClientRect().top + window.scrollY;
      this.smoothScroll.smoothScrollTo(targetY);
    }
  }

  scrollToHub(): void {
    this.scrollToSection(1);
    this.audioService.playWaterdropScrollDown();
  }
}
