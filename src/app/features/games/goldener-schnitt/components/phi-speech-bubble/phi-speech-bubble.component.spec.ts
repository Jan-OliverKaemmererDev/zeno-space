import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PhiSpeechBubbleComponent } from './phi-speech-bubble.component';

describe('PhiSpeechBubbleComponent', () => {
  let component: PhiSpeechBubbleComponent;
  let fixture: ComponentFixture<PhiSpeechBubbleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhiSpeechBubbleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PhiSpeechBubbleComponent);
    component = fixture.componentInstance;
    component.generatedPhiDecimals = '03398';
    component.totalSeedsFormatted = '7';
    component.seedCount = 5;
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

  it('should copy Phi sequence and update isPhiCopied signal', async () => {
    vi.useFakeTimers();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    component.copyPhiNumber();
    await Promise.resolve();

    expect(writeTextMock).toHaveBeenCalledWith('1,61803398');
    expect(component.isPhiCopied()).toBe(true);

    vi.advanceTimersByTime(1800);
    expect(component.isPhiCopied()).toBe(false);
  });
});
