import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AudioService } from '../../../core/services/audio.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

  readonly isVisible = signal<boolean>(false);
  private isLandingPage = signal<boolean>(true);

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = event.urlAfterRedirects.split('#')[0].split('?')[0];
        const isLanding = url === '/' || url === '';
        this.isLandingPage.set(isLanding);
        this.checkVisibility();
      });
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

  onToggleAudio(): void {
    this.audioService.toggleSound();
  }
}
