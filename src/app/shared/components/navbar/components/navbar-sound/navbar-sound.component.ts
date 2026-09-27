import { Component, inject, input, output } from '@angular/core';
import { AudioService } from '../../../../../core/services/audio.service';
import { SoundBurstSpark, TooltipLetter } from '../../navbar.models';

/**
 * Navbar sound toggle experience featuring orbit stardust particles,
 * a pulsing ethereal beacon halo, wave-animated tooltip, and explosive shockwave sparks.
 */
@Component({
  selector: 'app-navbar-sound',
  standalone: true,
  templateUrl: './navbar-sound.component.html',
  styleUrl: './navbar-sound.component.scss',
})
export class NavbarSoundComponent {
  readonly audioService = inject(AudioService);

  /** Whether the sound button is playing an explosive spark burst. */
  readonly isBursting = input<boolean>(false);

  /** List of explosive micro-sparks radiating from the sound button. */
  readonly burstSparks = input<SoundBurstSpark[]>([]);

  /** Staggered letters for the wave tooltip. */
  readonly soundTooltipLetters = input<TooltipLetter[]>([]);

  /** Indices for the 12 orbit particles. */
  readonly orbitParticleIndices = input<number[]>([]);

  /** Emitted when clicking the sound toggle button. */
  readonly toggleAudio = output<void>();
}
