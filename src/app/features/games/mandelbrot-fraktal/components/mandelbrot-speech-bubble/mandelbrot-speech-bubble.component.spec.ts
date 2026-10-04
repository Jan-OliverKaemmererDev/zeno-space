import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MandelbrotSpeechBubbleComponent } from './mandelbrot-speech-bubble.component';

describe('MandelbrotSpeechBubbleComponent', () => {
  let component: MandelbrotSpeechBubbleComponent;
  let fixture: ComponentFixture<MandelbrotSpeechBubbleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MandelbrotSpeechBubbleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MandelbrotSpeechBubbleComponent);
    component = fixture.componentInstance;
    component.currentWaypointName = 'Wikipedia Scepter-Spirale';
    component.coordSnippet = 'c = -0,7436 + 0,1318i';
    component.zoomFormatted = '250×';
    component.iterations = 180;
    component.centerX = -0.7436;
    component.centerY = 0.1318;
    component.rawZoom = 250;
    component.isClosing = false;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should create the speech bubble component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit close when handleClose is called', () => {
    const closeSpy = vi.fn();
    component.close.subscribe(closeSpy);

    const event = new MouseEvent('click');
    component.handleClose(event);
    expect(closeSpy).toHaveBeenCalled();
  });

  it('should copy coordinates to clipboard and update isCopied signal', async () => {
    vi.useFakeTimers();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const event = new MouseEvent('click');
    component.copyCoordinates(event);
    await Promise.resolve();

    expect(writeTextMock).toHaveBeenCalled();
    expect(component.isCopied()).toBe(true);

    vi.advanceTimersByTime(2300);
    expect(component.isCopied()).toBe(false);
  });
});
