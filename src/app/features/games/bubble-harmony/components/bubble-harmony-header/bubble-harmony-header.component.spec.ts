import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BubbleHarmonyHeaderComponent } from './bubble-harmony-header.component';
import { By } from '@angular/platform-browser';

describe('BubbleHarmonyHeaderComponent', () => {
  let component: BubbleHarmonyHeaderComponent;
  let fixture: ComponentFixture<BubbleHarmonyHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BubbleHarmonyHeaderComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(BubbleHarmonyHeaderComponent);
    component = fixture.componentInstance;
    component.bubbleCount = 12;
    component.poppedTotal = 5;
    fixture.detectChanges();
  });

  it('should create the bubble harmony header component', () => {
    expect(component).toBeTruthy();
  });

  it('should display the back link with correct text', () => {
    const backLink = fixture.debugElement.query(By.css('.back-link'));
    expect(backLink).toBeTruthy();
    expect(backLink.nativeElement.textContent).toContain('Zurück');
  });

  it('should render bubble count and popped total stats', () => {
    const statNums = fixture.debugElement.queryAll(By.css('.stat-num'));
    expect(statNums.length).toBe(2);
    expect(statNums[0].nativeElement.textContent).toContain('12');
    expect(statNums[1].nativeElement.textContent).toContain('5');
  });
});
