import {
  Component,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
  signal,
  HostListener,
} from '@angular/core';
import { Router } from '@angular/router';
import { GrasAudioService } from './services/gras-audio.service';
import { TimeOfDay, WindPreset } from './models/gras-harmonie.models';
import { GrasHarmonieHeaderComponent } from './components/gras-harmonie-header/gras-harmonie-header.component';
import { GrasCelestialTrayComponent } from './components/gras-celestial-tray/gras-celestial-tray.component';
import { GrasControlsDockComponent } from './components/gras-controls-dock/gras-controls-dock.component';
import { GrasCanvasComponent } from './components/gras-canvas/gras-canvas.component';

/**
 * "Gras-Harmonie" - Interactive 3D Wind & Grass Oasis minigame for zeno-space.
 * Authentic Studio Ghibli countryside experience:
 * - Monumental breathing anime cumulus cloud backdrop
 * - Rolling green prairie topography mirroring the iconic anime reference
 * - 240,000 multi-segmented silky grass blades + delicate wildflower blooms
 * - Painterly lush green moss & clover ground texture
 */
@Component({
  selector: 'app-gras-harmonie',
  standalone: true,
  imports: [
    GrasHarmonieHeaderComponent,
    GrasCelestialTrayComponent,
    GrasControlsDockComponent,
    GrasCanvasComponent,
  ],
  providers: [GrasAudioService],
  templateUrl: './gras-harmonie.component.html',
  styleUrl: './gras-harmonie.component.scss',
})
export class GrasHarmonieComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasComp') canvasComp?: GrasCanvasComponent;

  readonly audio = inject(GrasAudioService);
  private readonly router = inject(Router);

  // Reactive UI signals
  readonly timeOfDay = signal<TimeOfDay>('day');
  readonly windPreset = signal<WindPreset>('fresh');
  readonly windSpeedDisplay = signal<string>('Frische Brise (18 km/h)');
  readonly isMuted = this.audio.isMuted;

  /**
   * Escape key returns gracefully to the central bubble hub.
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.router.navigate(['/'], { fragment: 'bubble-hub' });
  }

  /**
   * Space key triggers a wide sweeping wind gust.
   */
  @HostListener('document:keydown.space', ['$event'])
  onSpace(event: Event): void {
    event.preventDefault();
    this.triggerWindGust();
  }

  /**
   * Number keys 1, 2, 3 toggle time of day.
   */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.key === '1') this.setTimeOfDay('day');
    if (event.key === '2') this.setTimeOfDay('golden');
    if (event.key === '3') this.setTimeOfDay('night');
  }

  ngAfterViewInit(): void {
    this.audio.init();
    this.syncCursorAtmosphere(this.timeOfDay());
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('in-sanctuary');
      document.body.classList.remove('in-night');
    }
    this.audio.destroy();
  }

  setTimeOfDay(time: TimeOfDay): void {
    this.timeOfDay.set(time);
    this.syncCursorAtmosphere(time);
    this.canvasComp?.applyTimeOfDay(time);
  }

  setWindPreset(preset: WindPreset): void {
    this.windPreset.set(preset);
    this.canvasComp?.applyWindPreset(preset);
  }

  triggerWindGust(): void {
    this.canvasComp?.triggerWindGust();
  }

  toggleSound(): void {
    this.audio.toggleMute();
  }

  /**
   * Syncs custom glass orb-cursor color state with the prairie time of day:
   * - 'golden': activates 'in-sanctuary' (warm glowing amber/gold)
   * - 'night': activates 'in-night' (luminous deep sapphire midnight blue)
   * - 'day': standard luminous cyan/sky blue
   */
  private syncCursorAtmosphere(time: TimeOfDay): void {
    if (typeof document === 'undefined') return;
    if (time === 'golden') {
      document.body.classList.remove('in-night');
      document.body.classList.add('in-sanctuary');
    } else if (time === 'night') {
      document.body.classList.remove('in-sanctuary');
      document.body.classList.add('in-night');
    } else {
      document.body.classList.remove('in-sanctuary');
      document.body.classList.remove('in-night');
    }
  }
}
