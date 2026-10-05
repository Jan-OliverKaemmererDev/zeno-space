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

  it('should scroll list when onListWheel is triggered', () => {
    const mockElement = { scrollTop: 10 };
    const mockEvent = {
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      deltaY: 50,
      currentTarget: mockElement,
    } as any;

    component.onListWheel(mockEvent);

    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockElement.scrollTop).toBe(60);
  });

  it('should drag-to-scroll list on pointer down, move, and up', () => {
    const mockElement = { scrollTop: 0 };

    component.onListPointerDown({
      button: 0,
      clientY: 100,
      pointerId: 1,
      currentTarget: mockElement,
    } as any);

    component.onListPointerMove({
      clientY: 50,
      currentTarget: mockElement,
    } as any);

    expect(mockElement.scrollTop).toBe(50);

    component.onListPointerUp();
    expect((component as any).isListDragging).toBe(false);
  });

  it('should close waypoint menu when pointerdown occurs outside', () => {
    component.showWaypointMenu.set(true);
    const outsideElement = document.createElement('div');
    component.onDocumentPointerDown({ target: outsideElement } as any);
    expect(component.showWaypointMenu()).toBe(false);
  });

  it('should keep waypoint menu open when pointerdown occurs inside flyout or toggle btn', () => {
    component.showWaypointMenu.set(true);
    const flyout = document.createElement('div');
    flyout.className = 'waypoints-flyout';
    const childOfFlyout = document.createElement('span');
    flyout.appendChild(childOfFlyout);
    document.body.appendChild(flyout);

    component.onDocumentPointerDown({ target: childOfFlyout } as any);
    expect(component.showWaypointMenu()).toBe(true);

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'waypoints-toggle-btn';
    document.body.appendChild(toggleBtn);
    component.onDocumentPointerDown({ target: toggleBtn } as any);
    expect(component.showWaypointMenu()).toBe(true);

    document.body.removeChild(flyout);
    document.body.removeChild(toggleBtn);
  });
});
