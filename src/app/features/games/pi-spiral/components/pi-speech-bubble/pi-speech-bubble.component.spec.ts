import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PiSpeechBubbleComponent } from './pi-speech-bubble.component';

describe('PiSpeechBubbleComponent', () => {
  let component: PiSpeechBubbleComponent;
  let fixture: ComponentFixture<PiSpeechBubbleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PiSpeechBubbleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PiSpeechBubbleComponent);
    component = fixture.componentInstance;
    component.generatedPiDecimals = '15926';
    component.totalDecimalsFormatted = '7';
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

    component.handleClose();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('should copy Pi sequence and update isPiCopied signal', async () => {
    vi.useFakeTimers();
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
