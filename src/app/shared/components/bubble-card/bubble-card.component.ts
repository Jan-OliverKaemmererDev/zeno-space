import {
  Component,
  Input,
  inject,
  ElementRef,
  HostListener,
  output,
  computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { Minigame } from '../../../core/models/minigame.model';
import { AudioService } from '../../../core/services/audio.service';
import { GameRegistryService } from '../../../core/services/game-registry.service';

@Component({
  selector: 'app-bubble-card',
  templateUrl: './bubble-card.component.html',
  styleUrl: './bubble-card.component.scss',
})
export class BubbleCardComponent {
  @Input({ required: true }) game!: Minigame;

  readonly categorySelect = output<string>();

  private readonly router = inject(Router);
  private readonly audioService = inject(AudioService);
  private readonly gameRegistry = inject(GameRegistryService);
  private readonly el = inject(ElementRef);

  readonly activeCategory = computed(() => this.gameRegistry.selectedCategory());

  isHovered = false;
  isPopping = false;
  tiltX = 0;
  tiltY = 0;

  @HostListener('mouseenter')
  onMouseEnter(): void {
    this.isHovered = true;
    this.audioService.playBubbleHover();
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.isHovered = false;
    this.tiltX = 0;
    this.tiltY = 0;
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    const rect = this.el.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    
    // Ultra-subtle micro-tilt (max 2 degrees instead of 10)
    this.tiltX = (-y / (rect.height / 2)) * 2;
    this.tiltY = (x / (rect.width / 2)) * 2;
  }

  normalizeTagToCategory(tag: string): string {
    const lower = tag.trim().toLowerCase();
    const map: Record<string, string> = {
      mathematik: 'mathematik',
      astronomie: 'astronomie',
      natur: 'natur',
      geräusche: 'geraeusche',
      geraeusche: 'geraeusche',
      relax: 'relax',
      abenteuer: 'abenteuer',
    };
    return map[lower] ?? lower;
  }

  isTagActive(tag: string): boolean {
    const active = this.activeCategory();
    if (!active || active === 'all') return false;
    return this.normalizeTagToCategory(tag) === active.toLowerCase();
  }

  onTagClick(tag: string, event: MouseEvent): void {
    event.stopPropagation();
    const cat = this.normalizeTagToCategory(tag);
    this.gameRegistry.setSelectedCategory(cat);
    this.audioService.playChime(3, 0.15);
    this.categorySelect.emit(cat);
  }

  openGame(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.isPopping) return;
    this.isPopping = true;
    this.audioService.playBubblePop();

    // Short pop animation before navigation
    setTimeout(() => {
      this.router.navigateByUrl(this.game.route);
    }, 350);
  }
}
