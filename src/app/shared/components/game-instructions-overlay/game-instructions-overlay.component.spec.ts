import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameInstructionsOverlayComponent } from './game-instructions-overlay.component';
import { Minigame } from '../../../core/models/minigame.model';

describe('GameInstructionsOverlayComponent', () => {
  let component: GameInstructionsOverlayComponent;
  let fixture: ComponentFixture<GameInstructionsOverlayComponent>;

  const mockGame: Minigame = {
    id: 'cosmic-sculptor',
    title: 'Cosmic Zen Sculptor',
    subtitle: '3D Gravitations-Kosmos',
    description: 'Erschaffe leuchtende Himmelskörper in einem interaktiven 3D-Universum.',
    badge: '3D WebGL',
    route: '/game/cosmic-sculptor',
    icon: 'cosmos',
    primaryColor: '#c4b5fd',
    glowColor: 'rgba(196, 181, 253, 0.28)',
    tags: ['Astronomie'],
    floatDelay: '0s',
    floatDuration: '9s',
    sizeClass: 'bubble--lg',
    controls: {
      keyboard: [
        {
          type: 'wasd',
          keys: ['W', 'A', 'S', 'D'],
          label: 'Kamera im 3D-Raum drehen',
        },
      ],
      mouse: {
        leftClick: true,
        drag: true,
        wheel: true,
        label: 'Maus ziehen zum Rotieren & Mausrad zum Zoomen',
      },
      objective: 'Erschaffe Planetenbahnen im All.',
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameInstructionsOverlayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GameInstructionsOverlayComponent);
    component = fixture.componentInstance;
    component.game = mockGame;
    fixture.detectChanges();
  });

  it('should create the overlay component', () => {
    expect(component).toBeTruthy();
  });

  it('should render the game title and description', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.game-title')?.textContent).toContain('Cosmic Zen Sculptor');
    expect(el.querySelector('.game-description')?.textContent).toContain('Erschaffe leuchtende Himmelskörper');
  });

  it('should render WASD keys when configured', () => {
    const el: HTMLElement = fixture.nativeElement;
    const wasdKeys = el.querySelectorAll('.wasd-layout .keycap');
    expect(wasdKeys.length).toBe(4);
  });

  it('should emit startGame event with the minigame on click', () => {
    vi.useFakeTimers();
    let startedGame: Minigame | undefined;
    component.startGame.subscribe((g) => (startedGame = g));

    const startBtn = fixture.nativeElement.querySelector('.btn-start-game') as HTMLButtonElement;
    startBtn.click();

    expect(component.isClosing()).toBe(true);

    vi.advanceTimersByTime(300);
    expect(startedGame).toEqual(mockGame);
    vi.useRealTimers();
  });


  it('should close on escape key', () => {
    let closed = false;
    component.close.subscribe(() => (closed = true));

    component.onEscape();
    expect(component.isClosing()).toBe(true);
  });

  it('should close when clicking the backdrop', () => {
    const backdrop = fixture.nativeElement.querySelector('.game-instructions-backdrop') as HTMLElement;
    backdrop.click();
    expect(component.isClosing()).toBe(true);
  });

  it('should lock document body scroll on init and unlock on destroy', () => {
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    fixture.destroy();

    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });
});
