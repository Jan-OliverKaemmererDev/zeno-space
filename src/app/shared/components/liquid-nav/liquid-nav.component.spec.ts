import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LiquidNavComponent } from './liquid-nav.component';

describe('LiquidNavComponent', () => {
  let component: LiquidNavComponent;
  let fixture: ComponentFixture<LiquidNavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiquidNavComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LiquidNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default sections', () => {
    expect(component.sections().length).toBe(3);
    expect(component.sections()[0].label).toBe('Kosmos');
  });

  it('should emit sectionSelect on onSelect', () => {
    let selected: number | null = null;
    component.sectionSelect.subscribe((idx) => (selected = idx));
    component.onSelect(1);
    expect(selected).toBe(1);
  });
});
