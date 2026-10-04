import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MandelbrotControlsComponent } from './mandelbrot-controls.component';
import { MANDELBROT_WAYPOINTS } from '../../utils/mandelbrot-presets';

describe('MandelbrotControlsComponent', () => {
  let component: MandelbrotControlsComponent;
  let fixture: ComponentFixture<MandelbrotControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MandelbrotControlsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MandelbrotControlsComponent);
    component = fixture.componentInstance;
    component.isSoundEnabled = true;
    component.currentWaypointId = 'overview';
    fixture.detectChanges();
  });

  it('should create the controls component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit zoomIn when primary button is clicked', () => {
    const zoomSpy = vi.fn();
    component.zoomIn.subscribe(zoomSpy);

    const primaryBtn = fixture.nativeElement.querySelector('.dock-btn--primary');
    primaryBtn.click();

    expect(zoomSpy).toHaveBeenCalled();
  });

  it('should toggle waypoint menu when Orte button is clicked', () => {
    expect(component.showWaypointMenu()).toBe(false);
    component.toggleWaypointMenu();
    expect(component.showWaypointMenu()).toBe(true);
  });

  it('should emit selectWaypoint when a waypoint is chosen', () => {
    const selectSpy = vi.fn();
    component.selectWaypoint.subscribe(selectSpy);

    const testWaypoint = MANDELBROT_WAYPOINTS[0];
    const event = new MouseEvent('click');
    component.onSelectWaypoint(testWaypoint, event);

    expect(selectSpy).toHaveBeenCalledWith(testWaypoint);
    expect(component.showWaypointMenu()).toBe(false);
  });

  it('should emit resetView when reset button is clicked', () => {
    const resetSpy = vi.fn();
    component.resetView.subscribe(resetSpy);

    const resetBtn = fixture.nativeElement.querySelector('.dock-btn--ghost');
    resetBtn.click();

    expect(resetSpy).toHaveBeenCalled();
  });
});
