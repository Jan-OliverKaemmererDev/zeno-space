import { Component, Input, inject, ElementRef, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { Minigame } from '../../../core/models/minigame.model';
import { AudioService } from '../../../core/services/audio.service';

@Component({
  selector: 'app-bubble-card',
  templateUrl: './bubble-card.component.html',
  styleUrl: './bubble-card.component.scss',
})
export class BubbleCardComponent {
  @Input({ required: true }) game!: Minigame;

  private readonly router = inject(Router);
  private readonly audioService = inject(AudioService);
  private readonly el = inject(ElementRef);

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

  openGame(): void {
    if (this.isPopping) return;
    this.isPopping = true;
    this.audioService.playBubblePop();

    // Short pop animation before navigation
    setTimeout(() => {
      this.router.navigateByUrl(this.game.route);
    }, 350);
  }
}
