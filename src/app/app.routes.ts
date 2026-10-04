import { Routes } from '@angular/router';

/**
 * Defines the application routing configuration.
 * Routes map URL paths to their respective lazily-loaded standalone components.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'game/cosmic-sculptor',
    loadComponent: () =>
      import('./features/games/cosmic-sculptor/cosmic-sculptor.component').then(
        (m) => m.CosmicSculptorComponent
      ),
  },
  {
    path: 'game/bubble-harmony',
    loadComponent: () =>
      import('./features/games/bubble-harmony/bubble-harmony.component').then(
        (m) => m.BubbleHarmonyComponent
      ),
  },
  {
    path: 'game/pi-spiral',
    loadComponent: () =>
      import('./features/games/pi-spiral/pi-spiral.component').then((m) => m.PiSpiralComponent),
  },
  {
    path: 'game/goldener-schnitt',
    loadComponent: () =>
      import('./features/games/goldener-schnitt/goldener-schnitt.component').then(
        (m) => m.GoldenerSchnittComponent
      ),
  },
  {
    path: 'game/soundscape-mixer',
    loadComponent: () =>
      import('./features/games/soundscape-mixer/soundscape-mixer.component').then(
        (m) => m.SoundscapeMixerComponent
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
