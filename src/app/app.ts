import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { OrbCursorComponent } from './shared/components/orb-cursor/orb-cursor.component';

/**
 * Root component of the application.
 * Manages the top-level routing state and layout elements.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, OrbCursorComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  /**
   * Router instance injected for observing navigation events.
   */
  private readonly router = inject(Router);

  /**
   * Signal indicating whether the current active route is a minigame route.
   */
  readonly isGameRoute = signal<boolean>(false);

  /**
   * Initializes the root component and subscribes to router events
   * to track when the user navigates into or out of a game route.
   */
  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.isGameRoute.set(event.urlAfterRedirects.startsWith('/game'));
      });
  }
}
