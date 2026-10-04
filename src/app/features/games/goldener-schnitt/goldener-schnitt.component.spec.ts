import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { GoldenerSchnittComponent } from './goldener-schnitt.component';
import { AudioService } from '../../../core/services/audio.service';
import { PHI_DECIMAL_DIGITS_AFTER_618 } from './phi-digits.data';

describe('GoldenerSchnittComponent', () => {
  let component: GoldenerSchnittComponent;
  let fixture: ComponentFixture<GoldenerSchnittComponent>;
  let mockAudioService: { playWaterdropToneOn: any; playChime: any; playBubbleHover: any };
  let router: Router;

  beforeEach(async () => {
    mockAudioService = {
      playWaterdropToneOn: vi.fn(),
      playChime: vi.fn(),
      playBubbleHover: vi.fn(),
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as any);

    await TestBed.configureTestingModule({
      imports: [GoldenerSchnittComponent],
      providers: [
        provideRouter([]),
        { provide: AudioService, useValue: mockAudioService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GoldenerSchnittComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should initialize with speech bubble closed', () => {
    expect(component.showPhiBubble()).toBe(false);
    expect(component.closingPhiBubble()).toBe(false);
  });

  it('should open speech bubble when togglePhiBubble is called', () => {
    component.togglePhiBubble();
    expect(component.showPhiBubble()).toBe(true);
    expect(component.closingPhiBubble()).toBe(false);
    expect(mockAudioService.playWaterdropToneOn).toHaveBeenCalledWith(0.4);
  });

  it('should close speech bubble with deflate animation after 350ms timeout', () => {
    vi.useFakeTimers();
    component.openPhiBubble();
    expect(component.showPhiBubble()).toBe(true);

    component.closePhiBubble();
    expect(component.closingPhiBubble()).toBe(true);
    expect(component.showPhiBubble()).toBe(true);

    vi.advanceTimersByTime(350);
    expect(component.showPhiBubble()).toBe(false);
    expect(component.closingPhiBubble()).toBe(false);
  });

  it('should toggle off if togglePhiBubble is called while open', () => {
    component.openPhiBubble();
    expect(component.showPhiBubble()).toBe(true);

    component.togglePhiBubble();
    expect(component.closingPhiBubble()).toBe(true);
  });

  it('should compute generated Phi digits based on seedCount', () => {
    component.seedCount.set(0);
    expect(component.generatedPhiDecimalsAfter618()).toBe('');

    component.seedCount.set(5);
    const expectedFive = PHI_DECIMAL_DIGITS_AFTER_618.slice(0, 5); // "03398"
    expect(component.generatedPhiDecimalsAfter618()).toBe(expectedFive);

    component.seedCount.set(10);
    const expectedTen = PHI_DECIMAL_DIGITS_AFTER_618.slice(0, 10);
    expect(component.generatedPhiDecimalsAfter618()).toBe(expectedTen);
  });

  it('should close speech bubble when Escape is pressed while bubble is open', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    component.openPhiBubble();
    expect(component.showPhiBubble()).toBe(true);

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    component.onKeyDown(escapeEvent);

    expect(component.closingPhiBubble()).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('should navigate away on Escape when bubble is closed', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    expect(component.showPhiBubble()).toBe(false);

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    component.onKeyDown(escapeEvent);

    expect(navigateSpy).toHaveBeenCalledWith(['/'], { fragment: 'bubble-hub' });
  });

  it('should close speech bubble on document pointerdown outside stat-pill-wrapper', () => {
    component.openPhiBubble();
    expect(component.showPhiBubble()).toBe(true);

    const outsideTarget = document.createElement('div');
    const pointerEvent = new PointerEvent('pointerdown', { bubbles: true });
    Object.defineProperty(pointerEvent, 'target', { value: outsideTarget });

    component.onDocumentPointerDown(pointerEvent);
    expect(component.closingPhiBubble()).toBe(true);
  });

  it('should track and release arrow keys for 3D navigation', () => {
    const arrowUpEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
    const preventDefaultSpy = vi.spyOn(arrowUpEvent, 'preventDefault');

    component.onKeyDown(arrowUpEvent);
    expect(preventDefaultSpy).toHaveBeenCalled();
    expect((component as any).activeArrowKeys.has('ArrowUp')).toBe(true);

    const arrowUpRelease = new KeyboardEvent('keyup', { key: 'ArrowUp' });
    component.onKeyUp(arrowUpRelease);
    expect((component as any).activeArrowKeys.has('ArrowUp')).toBe(false);

    component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect((component as any).activeArrowKeys.has('ArrowLeft')).toBe(true);

    component.onWindowBlur();
    expect((component as any).activeArrowKeys.size).toBe(0);
  });

  it('should allow zooming far out beyond previous 46 limit up to 500', () => {
    const wheelEvent = new WheelEvent('wheel', { deltaY: 200 });
    vi.spyOn(wheelEvent, 'preventDefault');

    // Simulate several zoom-out wheel actions
    for (let i = 0; i < 40; i++) {
      component.onWheel(wheelEvent);
    }

    expect((component as any).targetCameraZ).toBeGreaterThan(46.0);
    expect((component as any).targetCameraZ).toBeLessThanOrEqual(500.0);
  });
});
