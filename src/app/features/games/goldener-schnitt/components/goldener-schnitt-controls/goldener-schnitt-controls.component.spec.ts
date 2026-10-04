import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GoldenerSchnittControlsComponent } from './goldener-schnitt-controls.component';

describe('GoldenerSchnittControlsComponent', () => {
  let component: GoldenerSchnittControlsComponent;
  let fixture: ComponentFixture<GoldenerSchnittControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoldenerSchnittControlsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GoldenerSchnittControlsComponent);
    component = fixture.componentInstance;
    component.isAutoFlowActive = false;
    component.isSoundEnabled = true;
    fixture.detectChanges();
  });

  it('should create the controls component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit addSeeds when primary button is clicked', () => {
    const addSpy = vi.fn();
    component.addSeeds.subscribe(addSpy);

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

  it('should emit resetBloom when reset button is clicked', () => {
    const resetSpy = vi.fn();
    component.resetBloom.subscribe(resetSpy);

    const resetBtn = fixture.nativeElement.querySelector('.dock-btn--ghost');
    resetBtn.click();

    expect(resetSpy).toHaveBeenCalled();
  });
});
