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
    path: 'game/zen-sand',
    loadComponent: () =>
      import('./features/games/zen-sand/zen-sand.component').then((m) => m.ZenSandComponent),
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
