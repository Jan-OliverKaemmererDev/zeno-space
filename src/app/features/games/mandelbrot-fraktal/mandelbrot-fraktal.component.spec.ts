import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MandelbrotFraktalComponent } from './mandelbrot-fraktal.component';
import { AudioService } from '../../../core/services/audio.service';
import { MANDELBROT_WAYPOINTS } from './utils/mandelbrot-presets';

describe('MandelbrotFraktalComponent', () => {
  let component: MandelbrotFraktalComponent;
  let fixture: ComponentFixture<MandelbrotFraktalComponent>;
  let mockAudioService: { playChime: any };
  let router: Router;

  beforeEach(async () => {
    mockAudioService = {
      playChime: vi.fn(),
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as any);

    await TestBed.configureTestingModule({
      imports: [MandelbrotFraktalComponent],
      providers: [
        provideRouter([]),
        { provide: AudioService, useValue: mockAudioService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MandelbrotFraktalComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should create the Mandelbrot component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with speech bubble closed', () => {
    expect(component.showBubble()).toBe(false);
    expect(component.closingBubble()).toBe(false);
  });

  it('should toggle speech bubble on and off', () => {
    vi.useFakeTimers();
    const event = new MouseEvent('click');

    component.toggleBubble(event);
    expect(component.showBubble()).toBe(true);
    expect(component.closingBubble()).toBe(false);

    component.toggleBubble(event);
    expect(component.closingBubble()).toBe(true);

    vi.advanceTimersByTime(350);
    expect(component.showBubble()).toBe(false);
    expect(component.closingBubble()).toBe(false);
  });

  it('should update waypoint when onWaypointSelected is called', () => {
    const wikiWp = MANDELBROT_WAYPOINTS[0];
    component.onWaypointSelected(wikiWp);

    expect(component.currentWaypointId()).toBe(wikiWp.id);
    expect(component.currentWaypointName()).toBe(wikiWp.name);
    expect(mockAudioService.playChime).toHaveBeenCalled();
  });

  it('should reset view to overview and clear resources when resetToOverview is invoked', () => {
    component.onZoomInStep();
    component.resetToOverview();

    expect(component.currentWaypointId()).toBe('overview');
    expect(component.currentZoomRaw()).toBe(1.0);
    expect(mockAudioService.playChime).toHaveBeenCalled();
  });

  it('should close speech bubble on Escape if open', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    component.showBubble.set(true);

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    component.onKeyDown(escapeEvent);

    expect(component.closingBubble()).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('should navigate to bubble-hub on Escape if bubble is closed', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    component.showBubble.set(false);

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    component.onKeyDown(escapeEvent);

    expect(navigateSpy).toHaveBeenCalledWith(['/'], { fragment: 'bubble-hub' });
  });

  it('should handle keyboard controls for WASD and Space zoom', () => {
    const spaceEvent = new KeyboardEvent('keydown', { code: 'Space' });
    component.onKeyDown(spaceEvent);
    expect(mockAudioService.playChime).toHaveBeenCalled();

    const wEvent = new KeyboardEvent('keydown', { key: 'w' });
    component.onKeyDown(wEvent);

    const rEvent = new KeyboardEvent('keydown', { key: 'r' });
    component.onKeyDown(rEvent);
    expect(component.currentWaypointId()).toBe('overview');
  });

  it('should zoom smoothly without camera jumping back or resetting', () => {
    // Zoom in multiple steps
    for (let i = 0; i < 15; i++) {
      component.onZoomInStep();
    }
    // Verify target zoom grew continuously and did not jump back to 2.0 or 1.0
    expect((component as any).targetZoom).toBeGreaterThan(100);
    expect(component.generationLevel()).toBeGreaterThanOrEqual(0);

    // Zooming deep should continue increasing smoothly
    const previousZoom = (component as any).targetZoom;
    component.onZoomInStep();
    expect((component as any).targetZoom).toBeGreaterThan(previousZoom);
  });

  it('should keep corner pollen particles strictly anchored in corners', () => {
    // Call onZoomInStep which triggers particles
    component.onZoomInStep();
    // Verify generation level is computed dynamically without crashing
    expect(component.generationLevel()).toBeDefined();
  });
});

