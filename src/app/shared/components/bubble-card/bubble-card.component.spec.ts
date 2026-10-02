import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { BubbleCardComponent } from './bubble-card.component';
import { AudioService } from '../../../core/services/audio.service';
import { GameRegistryService } from '../../../core/services/game-registry.service';
import { Minigame } from '../../../core/models/minigame.model';

describe('BubbleCardComponent', () => {
  let component: BubbleCardComponent;
  let fixture: ComponentFixture<BubbleCardComponent>;

  const mockGame: Minigame = {
    id: 'cosmic-sculptor',
    title: 'Cosmic Zen Sculptor',
    subtitle: 'Gravitative Himmelskörper formen',
    description: 'Erschaffe schwebende Himmelskörper in einem meditativen 3D-Gravitationsfeld.',
    badge: '3D WebGL',
    category: 'astronomie',
    route: '/games/cosmic-sculptor',
    icon: 'planet-outline',
    tags: ['Astronomie', 'Mathematik'],
    primaryColor: '#c084fc',
    glowColor: 'rgba(192, 132, 252, 0.45)',
    floatDuration: '8.5s',
    floatDelay: '0s',
    sizeClass: 'bubble--lg',
  };

  const mockAudioService = {
    playBubbleHover: vi.fn(),
    playChime: vi.fn(),
  };

  const mockGameRegistry = {
    selectedCategory: signal<string | null>(null),
    setSelectedCategory: vi.fn(),
  };

  const mockRouter = {
    navigate: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BubbleCardComponent],
      providers: [
        { provide: AudioService, useValue: mockAudioService },
        { provide: GameRegistryService, useValue: mockGameRegistry },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BubbleCardComponent);
    component = fixture.componentInstance;
    component.game = mockGame;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should NOT emit launchRequested when clicking on the card surface or title', () => {
    let launched = false;
    component.launchRequested.subscribe(() => (launched = true));

    const card = fixture.nativeElement.querySelector('.glass-bubble-card') as HTMLElement;
    card.click();

    const title = fixture.nativeElement.querySelector('.card-title') as HTMLElement;
    title.click();

    expect(launched).toBe(false);
  });

  it('should emit launchRequested when clicking directly on the Eintauchen button', () => {
    let emittedGame: Minigame | null = null;
    component.launchRequested.subscribe((g) => (emittedGame = g));

    const ctaButton = fixture.nativeElement.querySelector('.card-cta') as HTMLButtonElement;
    expect(ctaButton).toBeTruthy();
    expect(ctaButton.textContent).toContain('Eintauchen');

    ctaButton.click();

    expect(emittedGame).toEqual(mockGame);
    expect(mockAudioService.playBubbleHover).toHaveBeenCalled();
  });

  it('should emit categorySelect and update registry when clicking on a tag pill', () => {
    let emittedCategory = '';
    component.categorySelect.subscribe((cat) => (emittedCategory = cat));

    const tagButton = fixture.nativeElement.querySelector('.tag-pill') as HTMLButtonElement;
    expect(tagButton).toBeTruthy();

    tagButton.click();

    expect(emittedCategory).toBe('astronomie');
    expect(mockGameRegistry.setSelectedCategory).toHaveBeenCalledWith('astronomie');
    expect(mockAudioService.playChime).toHaveBeenCalled();
  });
});
