import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameInstructionsFooterComponent } from './game-instructions-footer.component';

describe('GameInstructionsFooterComponent', () => {
  let component: GameInstructionsFooterComponent;
  let fixture: ComponentFixture<GameInstructionsFooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameInstructionsFooterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GameInstructionsFooterComponent);
    component = fixture.componentInstance;
    component.gameTitle = 'Cosmic Zen Sculptor';
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render the start game button with accessible label', () => {
    const startBtn = fixture.nativeElement.querySelector('.btn-start-game') as HTMLButtonElement;
    expect(startBtn).toBeTruthy();
    expect(startBtn.getAttribute('aria-label')).toBe('Cosmic Zen Sculptor jetzt starten');
  });

  it('should emit startGame when start button is clicked', () => {
    let started = false;
    component.startGame.subscribe(() => (started = true));

    const startBtn = fixture.nativeElement.querySelector('.btn-start-game') as HTMLButtonElement;
    startBtn.click();

    expect(started).toBe(true);
  });
});
