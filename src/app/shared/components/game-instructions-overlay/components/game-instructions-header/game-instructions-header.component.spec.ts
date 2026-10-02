import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameInstructionsHeaderComponent } from './game-instructions-header.component';

describe('GameInstructionsHeaderComponent', () => {
  let component: GameInstructionsHeaderComponent;
  let fixture: ComponentFixture<GameInstructionsHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameInstructionsHeaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GameInstructionsHeaderComponent);
    component = fixture.componentInstance;
    component.title = 'Cosmic Zen Sculptor';
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render the game title', () => {
    const titleEl = fixture.nativeElement.querySelector('.game-title');
    expect(titleEl?.textContent).toContain('Cosmic Zen Sculptor');
  });

  it('should emit close when close button is clicked', () => {
    let closed = false;
    component.close.subscribe(() => (closed = true));

    const closeBtn = fixture.nativeElement.querySelector('.btn-close') as HTMLButtonElement;
    closeBtn.click();

    expect(closed).toBe(true);
  });
});
