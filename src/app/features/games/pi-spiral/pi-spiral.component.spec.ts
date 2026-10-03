import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { PiSpiralComponent } from './pi-spiral.component';
import { AudioService } from '../../../core/services/audio.service';
import { PI_DECIMAL_DIGITS_AFTER_14 } from './pi-digits.data';

describe('PiSpiralComponent – Pi Speech Bubble', () => {
  let component: PiSpiralComponent;
  let fixture: ComponentFixture<PiSpiralComponent>;
  let mockAudioService: { playWaterdropToneOn: any; playChime: any };
  let router: Router;

  beforeEach(async () => {
    mockAudioService = {
      playWaterdropToneOn: vi.fn(),
      playChime: vi.fn(),
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as any);

    await TestBed.configureTestingModule({
      imports: [PiSpiralComponent],
      providers: [
        provideRouter([]),
        { provide: AudioService, useValue: mockAudioService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PiSpiralComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should initialize with speech bubble closed', () => {
    expect(component.showPiBubble()).toBe(false);
    expect(component.closingPiBubble()).toBe(false);
  });

  it('should open speech bubble when togglePiBubble is called', () => {
    component.togglePiBubble();
    expect(component.showPiBubble()).toBe(true);
    expect(component.closingPiBubble()).toBe(false);
    expect(mockAudioService.playWaterdropToneOn).toHaveBeenCalledWith(0.4);
  });

  it('should close speech bubble with deflate animation after 350ms timeout', () => {
    vi.useFakeTimers();
    component.openPiBubble();
    expect(component.showPiBubble()).toBe(true);

    component.closePiBubble();
    expect(component.closingPiBubble()).toBe(true);
    expect(component.showPiBubble()).toBe(true);

    vi.advanceTimersByTime(350);
    expect(component.showPiBubble()).toBe(false);
    expect(component.closingPiBubble()).toBe(false);
  });

  it('should toggle off if togglePiBubble is called while open', () => {
    component.openPiBubble();
    expect(component.showPiBubble()).toBe(true);

    component.togglePiBubble();
    expect(component.closingPiBubble()).toBe(true);
  });

  it('should compute generated Pi digits based on digitCount', () => {
    component.digitCount.set(0);
    expect(component.generatedPiDecimalsAfter14()).toBe('');

    component.digitCount.set(5);
    const expectedFive = PI_DECIMAL_DIGITS_AFTER_14.slice(0, 5); // "15926"
    expect(component.generatedPiDecimalsAfter14()).toBe(expectedFive);

    component.digitCount.set(10);
    const expectedTen = PI_DECIMAL_DIGITS_AFTER_14.slice(0, 10); // "1592653589"
    expect(component.generatedPiDecimalsAfter14()).toBe(expectedTen);
  });

  it('should close the speech bubble when Escape is pressed while bubble is open', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    component.openPiBubble();
    expect(component.showPiBubble()).toBe(true);

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    component.onKeyDown(escapeEvent);

    expect(component.closingPiBubble()).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('should navigate away on Escape when bubble is closed', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    expect(component.showPiBubble()).toBe(false);

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    component.onKeyDown(escapeEvent);

    expect(navigateSpy).toHaveBeenCalledWith(['/'], { fragment: 'bubble-hub' });
  });

  it('should close the speech bubble on document pointerdown outside stat-pill-wrapper', () => {
    component.openPiBubble();
    expect(component.showPiBubble()).toBe(true);

    const outsideTarget = document.createElement('div');
    const pointerEvent = new PointerEvent('pointerdown', { bubbles: true });
    Object.defineProperty(pointerEvent, 'target', { value: outsideTarget });

    component.onDocumentPointerDown(pointerEvent);
    expect(component.closingPiBubble()).toBe(true);
  });

  it('should copy Pi number to clipboard and trigger isPiCopied signal', async () => {
    vi.useFakeTimers();
    component.digitCount.set(5);
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    component.copyPiNumber();
    await Promise.resolve();

    expect(writeTextMock).toHaveBeenCalledWith('3,1415926');
    expect(component.isPiCopied()).toBe(true);

    vi.advanceTimersByTime(1800);
    expect(component.isPiCopied()).toBe(false);
  });
});
