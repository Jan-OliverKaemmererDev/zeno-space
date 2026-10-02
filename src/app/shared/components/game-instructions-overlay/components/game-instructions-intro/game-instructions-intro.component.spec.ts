import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameInstructionsIntroComponent } from './game-instructions-intro.component';

describe('GameInstructionsIntroComponent', () => {
  let component: GameInstructionsIntroComponent;
  let fixture: ComponentFixture<GameInstructionsIntroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameInstructionsIntroComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GameInstructionsIntroComponent);
    component = fixture.componentInstance;
    component.subtitle = '3D Gravitations-Kosmos';
    component.description = 'Erschaffe leuchtende Himmelskörper in einem interaktiven 3D-Universum.';
    component.objective = 'Erschaffe Planetenbahnen im All.';
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render subtitle and description', () => {
    const el = fixture.nativeElement;
    expect(el.querySelector('.game-subtitle')?.textContent).toContain('3D Gravitations-Kosmos');
    expect(el.querySelector('.game-description')?.textContent).toContain('Erschaffe leuchtende Himmelskörper');
  });

  it('should render objective when provided', () => {
    const el = fixture.nativeElement;
    expect(el.querySelector('.objective-text')?.textContent).toContain('Erschaffe Planetenbahnen im All.');
  });
});
