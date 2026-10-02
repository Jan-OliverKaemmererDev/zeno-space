import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameInstructionsMouseComponent } from './game-instructions-mouse.component';
import { MouseControlDef } from '../../../../../core/models/minigame.model';

describe('GameInstructionsMouseComponent', () => {
  let component: GameInstructionsMouseComponent;
  let fixture: ComponentFixture<GameInstructionsMouseComponent>;

  const mockMouse: MouseControlDef = {
    leftClick: true,
    rightClick: false,
    drag: true,
    wheel: true,
    label: 'Maus ziehen zum Rotieren',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameInstructionsMouseComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GameInstructionsMouseComponent);
    component = fixture.componentInstance;
    component.mouse = mockMouse;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should highlight left mouse button when leftClick is active', () => {
    const el = fixture.nativeElement;
    const leftBtn = el.querySelector('.mouse-left');
    expect(leftBtn?.classList.contains('is-active')).toBe(true);

    const rightBtn = el.querySelector('.mouse-right');
    expect(rightBtn?.classList.contains('is-active')).toBe(false);
  });

  it('should indicate wheel scrolling and drag hint when configured', () => {
    const el = fixture.nativeElement;
    expect(el.querySelector('.mouse-wheel-carrier.is-scrolling')).toBeTruthy();
    expect(el.querySelector('.drag-motion-hint')).toBeTruthy();
  });

  it('should display the action label', () => {
    const el = fixture.nativeElement;
    expect(el.querySelector('.control-action-label')?.textContent).toContain('Maus ziehen zum Rotieren');
  });
});
