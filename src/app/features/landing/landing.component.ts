import {
  Component,
  inject,
  signal,
  computed,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameRegistryService } from '../../core/services/game-registry.service';
import { AudioService } from '../../core/services/audio.service';
import { BubbleCardComponent } from '../../shared/components/bubble-card/bubble-card.component';
import { Minigame } from '../../core/models/minigame.model';

interface Star3D {
  x: number;
  y: number;
  z: number;
  baseSize: number;
  alpha: number;
}

interface LetterItem {
  char: string;
  isSpace: boolean;
}

@Component({
  selector: 'app-landing',
  imports: [RouterLink, BubbleCardComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  readonly gameRegistry = inject(GameRegistryService);
  readonly audioService = inject(AudioService);

  @ViewChild('starCanvas') starCanvasRef!: ElementRef<HTMLCanvasElement>;

  // Letters of the heading "Willkommen im Zeno-Space"
  readonly textLetters: LetterItem[] = Array.from('Willkommen im Zeno-Space').map((char) => ({
    char,
    isSpace: char === ' ',
  }));

  // Filters
  readonly activeFilter = signal<string>('all');
  readonly filters = [
    { label: 'Alle Welten', value: 'all' },
    { label: '3D WebGL', value: '3D WebGL' },
    { label: 'Zen Audio', value: 'Zen Audio' },
    { label: 'Chill Sandbox', value: 'Chill Sandbox' },
  ];

  readonly filteredGames = computed(() => {
    const filter = this.activeFilter();
    const all = this.gameRegistry.games();
    if (filter === 'all') return all;
    return all.filter((g) => g.badge === filter);
  });

  scrollY = 0;

  // Starfield animation (3D warp forward flight, decoupled from mouse)
  private starAnimationFrameId: number | null = null;
  private stars: Star3D[] = [];

  ngAfterViewInit(): void {
    this.initStarfield();
  }

  ngOnDestroy(): void {
    if (this.starAnimationFrameId !== null) {
      cancelAnimationFrame(this.starAnimationFrameId);
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrollY = window.scrollY;
  }

  toggleSound(): void {
    this.audioService.toggleSound();
  }

  setFilter(filterValue: string): void {
    this.activeFilter.set(filterValue);
    this.audioService.playChime(3, 0.15);
  }

  scrollToHub(): void {
    const hubElement = document.getElementById('bubble-hub');
    if (hubElement) {
      hubElement.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // ----------------------------------------------------
  // Starfield 3D Warp Flight Animation (Forward spaceship)
  // ----------------------------------------------------
  private initStarfield(): void {
    const canvas = this.starCanvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const maxZ = 1200;
    const fov = 320;
    const starCount = Math.min(window.innerWidth > 768 ? 180 : 90, 220);
    const cruiseSpeed = 0.9;

    this.stars = Array.from({ length: starCount }, () => ({
      x: (Math.random() - 0.5) * window.innerWidth * 2,
      y: (Math.random() - 0.5) * window.innerHeight * 2,
      z: Math.random() * maxZ + 1,
      baseSize: Math.random() * 1.8 + 0.6,
      alpha: Math.random() * 0.6 + 0.4,
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      for (const star of this.stars) {
        star.z -= cruiseSpeed;

        if (star.z <= 2) {
          star.z = maxZ;
          star.x = (Math.random() - 0.5) * canvas.width * 2;
          star.y = (Math.random() - 0.5) * canvas.height * 2;
        }

        const k = fov / star.z;
        const px = centerX + star.x * k;
        const py = centerY + star.y * k;

        if (px < -20 || px > canvas.width + 20 || py < -20 || py > canvas.height + 20) {
          star.z = maxZ;
          star.x = (Math.random() - 0.5) * canvas.width * 2;
          star.y = (Math.random() - 0.5) * canvas.height * 2;
          continue;
        }

        const depthRatio = 1 - star.z / maxZ;
        const size = Math.max(0.6, depthRatio * star.baseSize * 1.6);
        const alpha = Math.min(1, Math.max(0.1, depthRatio * star.alpha * 1.4));

        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(224, 242, 254, ${alpha})`;
        ctx.shadowBlur = size * 2.5;
        ctx.shadowColor = 'rgba(186, 230, 253, 0.45)';
        ctx.fill();
      }

      this.starAnimationFrameId = requestAnimationFrame(render);
    };

    render();
  }
}
