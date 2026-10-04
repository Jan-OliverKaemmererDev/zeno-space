import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BubbleInstructionHintComponent } from './bubble-instruction-hint.component';
import { By } from '@angular/platform-browser';

describe('BubbleInstructionHintComponent', () => {
  let component: BubbleInstructionHintComponent;
  let fixture: ComponentFixture<BubbleInstructionHintComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BubbleInstructionHintComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BubbleInstructionHintComponent);
    component = fixture.componentInstance;
    component.activeToolHint = 'Klicke eine Blase zum Platzen & Hören';
    fixture.detectChanges();
  });

  it('should create the hint component', () => {
    expect(component).toBeTruthy();
  });

  it('should display the active tool hint text', () => {
    const hintItem = fixture.debugElement.query(By.css('.hint-item span'));
    expect(hintItem.nativeElement.textContent).toContain('Klicke eine Blase zum Platzen & Hören');
  });
});
