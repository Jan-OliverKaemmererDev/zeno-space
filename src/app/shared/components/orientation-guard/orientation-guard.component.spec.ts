import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrientationGuardComponent } from './orientation-guard.component';

describe('OrientationGuardComponent', () => {
  let component: OrientationGuardComponent;
  let fixture: ComponentFixture<OrientationGuardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrientationGuardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OrientationGuardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the orientation guard component', () => {
    expect(component).toBeTruthy();
  });

  it('should start with isDismissed as false', () => {
    expect(component.isDismissed()).toBe(false);
  });

  it('should set isDismissed to true when dismiss() is called', () => {
    component.dismiss();
    expect(component.isDismissed()).toBe(true);
  });
});
