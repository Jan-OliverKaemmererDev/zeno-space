import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PiSpiralControlsComponent } from './pi-spiral-controls.component';

describe('PiSpiralControlsComponent', () => {
  let component: PiSpiralControlsComponent;
  let fixture: ComponentFixture<PiSpiralControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PiSpiralControlsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PiSpiralControlsComponent);
    component = fixture.componentInstance;
    component.isAutoFlowActive = false;
    component.isSoundEnabled = true;
    fixture.detectChanges();
  });

  it('should create the controls component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit addDigits when primary button is clicked', () => {
    const addSpy = vi.fn();
    component.addDigits.subscribe(addSpy);

    const primaryBtn = fixture.nativeElement.querySelector('.dock-btn--primary');
    primaryBtn.click();

    expect(addSpy).toHaveBeenCalled();
  });

  it('should emit toggleAutoFlow when autoflow button is clicked', () => {
    const autoFlowSpy = vi.fn();
    component.toggleAutoFlow.subscribe(autoFlowSpy);

    const autoflowBtn = fixture.nativeElement.querySelector('.dock-btn--autoflow');
    autoflowBtn.click();

    expect(autoFlowSpy).toHaveBeenCalled();
  });

  it('should emit resetSpiral when reset button is clicked', () => {
    const resetSpy = vi.fn();
    component.resetSpiral.subscribe(resetSpy);

    const resetBtn = fixture.nativeElement.querySelector('.dock-btn--ghost');
    resetBtn.click();

    expect(resetSpy).toHaveBeenCalled();
  });
});
