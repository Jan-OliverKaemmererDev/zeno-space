import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
  signal,
  HostListener,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { AudioService } from '../../../core/services/audio.service';

/**
 * Represents an individual ambient audio track channel in the soundscape mixer.
 */
interface SoundChannel {
  /** Unique channel identifier. */
  id: string;
  /** Localized display name. */
  name: string;
  /** Icon identifier for UI rendering. */
  icon: string;
  /** Atmospheric description of the sound source. */
  description: string;
  /** Volume level ranging between 0.0 and 1.0. */
  volume: number;
  /** Hex color code for the audio visualizer ribbon. */
  color: string;
  /** Whether this channel is currently active and audible. */
  active: boolean;
}

/**
 * Interactive soundscape mixer minigame allowing users to customize and blend ambient space audio layers.
 */
@Component({
  selector: 'app-soundscape-mixer',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './soundscape-mixer.component.html',
  styleUrl: './soundscape-mixer.component.scss',
})
export class SoundscapeMixerComponent implements AfterViewInit, OnDestroy {
  /** Canvas element reference for the animated audio frequency ribbons. */
  @ViewChild('visualizer') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly audioService = inject(AudioService);
  private readonly router = inject(Router);

  /**
   * Closes the minigame and navigates back to the landing page on Escape key press.
   *
   * @returns {void}
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.router.navigate(['/']);
  }

  /**
   * Signal list of available ambient sound channels.
   */
  readonly channels = signal<SoundChannel[]>([
    {
      id: 'rain',
      name: 'Kosmischer Regen',
      icon: 'rain',
      description: 'Zartes Prasseln von Sternenregen auf Glas',
      volume: 0.6,
      color: '#38bdf8',
      active: true,
    },
    {
      id: 'drone',
      name: 'Warmer Raum-Synth',
      icon: 'drone',
      description: 'Tiefer, vibrierender 432Hz Ambient-Akkord',
      volume: 0.7,
      color: '#a78bfa',
      active: true,
    },
    {
      id: 'fire',
      name: 'Sternenfeuer',
      icon: 'fire',
      description: 'Sanftes, behagliches Knistern im Kamin',
      volume: 0.5,
      color: '#fb923c',
      active: false,
    },
    {
      id: 'chimes',
      name: 'Windspiel im All',
      icon: 'chimes',
      description: 'Zarte kristalline Töne im fernen Wind',
      volume: 0.4,
      color: '#f472b6',
      active: true,
    },
  ]);

  private ctx!: CanvasRenderingContext2D;
  private animationId: number | null = null;
  private chimeIntervalId: number | null = null;

  /**
   * Lifecycle hook invoked after view initialization to start visualizer and chime timers.
   *
   * @returns {void}
   */
  ngAfterViewInit(): void {
    this.initVisualizer();
    this.startChimeLoop();
  }

  /**
   * Lifecycle hook invoked upon destruction to clean up animation frames and intervals.
   *
   * @returns {void}
   */
  ngOnDestroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.chimeIntervalId !== null) {
      clearInterval(this.chimeIntervalId);
    }
    window.removeEventListener('resize', this.onResize);
  }

  /**
   * Toggles the active state of an audio channel.
   *
   * @param {string} channelId - The unique identifier of the sound channel.
   * @returns {void}
   */
  toggleChannel(channelId: string): void {
    this.channels.update((chs) =>
      chs.map((c) => (c.id === channelId ? { ...c, active: !c.active } : c))
    );
    this.audioService.playBubbleHover();
  }

  /**
   * Updates the volume level of a given audio channel based on input slider changes.
   *
   * @param {string} channelId - The unique identifier of the sound channel.
   * @param {Event} event - The slider input event.
   * @returns {void}
   */
  updateVolume(channelId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseFloat(input.value);
    this.channels.update((chs) =>
      chs.map((c) => (c.id === channelId ? { ...c, volume: val, active: val > 0 } : c))
    );
  }

  /**
   * Starts periodic chime generation for the wind chime channel when enabled.
   *
   * @returns {void}
   */
  private startChimeLoop(): void {
    this.chimeIntervalId = window.setInterval(() => {
      const chimes = this.channels().find((c) => c.id === 'chimes');
      if (chimes?.active && !this.audioService.isMuted()) {
        const randomNote = Math.floor(Math.random() * 8);
        this.audioService.playChime(randomNote, chimes.volume * 0.3);
      }
    }, 3200);
  }

  /**
   * Sets up 2D canvas visualizer context and initiates resize listeners and render loop.
   *
   * @returns {void}
   */
  private initVisualizer(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.onResize();
    window.addEventListener('resize', this.onResize);
    this.render();
  }

  /**
   * Handles canvas resize to adjust internal buffer dimensions to client width.
   *
   * @returns {void}
   */
  private onResize = (): void => {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = canvas.parentElement?.clientWidth || 600;
    canvas.height = 200;
  };

  /**
   * Continuous 2D canvas render loop drawing undulating harmonic ribbons for active channels.
   *
   * @returns {void}
   */
  private render = (): void => {
    this.animationId = requestAnimationFrame(this.render);
    const canvas = this.canvasRef.nativeElement;
    const { width, height } = canvas;

    this.ctx.clearRect(0, 0, width, height);

    // Draw wavy soothing visualizer ribbons
    const time = Date.now() * 0.002;
    const activeChs = this.channels().filter((c) => c.active);

    activeChs.forEach((ch, idx) => {
      this.ctx.beginPath();
      const waveCount = 40;
      const amplitude = ch.volume * 35;
      const freq = 0.05 + idx * 0.02;

      for (let i = 0; i <= waveCount; i++) {
        const x = (i / waveCount) * width;
        const y =
          height / 2 +
          Math.sin(i * freq + time + idx * 1.5) * amplitude * Math.sin((i / waveCount) * Math.PI);

        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }

      this.ctx.strokeStyle = ch.color;
      this.ctx.lineWidth = 2.5;
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = ch.color;
      this.ctx.stroke();
    });
  };
}
