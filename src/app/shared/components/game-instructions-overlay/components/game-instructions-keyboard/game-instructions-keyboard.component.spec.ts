import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameInstructionsKeyboardComponent } from './game-instructions-keyboard.component';
import { KeyboardControlDef } from '../../../../../core/models/minigame.model';

describe('GameInstructionsKeyboardComponent', () => {
  let component: GameInstructionsKeyboardComponent;
  let fixture: ComponentFixture<GameInstructionsKeyboardComponent>;

  const mockControls: KeyboardControlDef[] = [
    {
      type: 'wasd',
      keys: ['W', 'A', 'S', 'D'],
      label: 'Kamera bewegen',
    },
    {
      type: 'space',
      keys: ['SPACE'],
      label: 'Springen',
    },
    {
      type: 'arrows',
      keys: ['↑', '←', '↓', '→'],
      label: '3D-Ansicht bewegen',
    },
    {
      type: 'inline',
      keys: ['1', '2', '3'],
      label: 'Werkzeug wählen',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameInstructionsKeyboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GameInstructionsKeyboardComponent);
    component = fixture.componentInstance;
    component.controls = mockControls;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render WASD keycaps correctly', () => {
    const el = fixture.nativeElement;
    const wasdKeys = el.querySelectorAll('.wasd-layout .keycap');
    expect(wasdKeys.length).toBe(4);
    expect(wasdKeys[0].textContent.trim()).toBe('W');
    expect(wasdKeys[1].textContent.trim()).toBe('A');
    expect(wasdKeys[2].textContent.trim()).toBe('S');
    expect(wasdKeys[3].textContent.trim()).toBe('D');
  });

  it('should render arrow keycaps correctly', () => {
    const el = fixture.nativeElement;
    const arrowKeys = el.querySelectorAll('.arrows-layout .keycap');
    expect(arrowKeys.length).toBe(4);
    expect(arrowKeys[0].textContent.trim()).toBe('↑');
    expect(arrowKeys[1].textContent.trim()).toBe('←');
    expect(arrowKeys[2].textContent.trim()).toBe('↓');
    expect(arrowKeys[3].textContent.trim()).toBe('→');
  });

  it('should render spacebar keycap correctly', () => {
    const el = fixture.nativeElement;
    const spaceKey = el.querySelector('.space-layout .keycap--space');
    expect(spaceKey).toBeTruthy();
    expect(spaceKey?.textContent.trim()).toBe('SPACE');
  });

  it('should render inline keycaps correctly', () => {
    const el = fixture.nativeElement;
    const inlineKeys = el.querySelectorAll('.inline-keys-layout .keycap--inline');
    expect(inlineKeys.length).toBe(3);
  });
});
