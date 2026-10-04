import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BubbleCanvasComponent } from './bubble-canvas.component';
import { AudioService } from '../../../../../core/services/audio.service';
import { BubbleCanvasRendererService } from '../../services/bubble-canvas-renderer.service';

describe('BubbleCanvasComponent', () => {
  let component: BubbleCanvasComponent;
  let fixture: ComponentFixture<BubbleCanvasComponent>;
  let mockAudioService: Record<string, any>;
  let mockRendererService: Record<string, any>;

  beforeEach(async () => {
    mockAudioService = {
      playWaterdropToneOn: vi.fn(),
      playChime: vi.fn(),
      playBubbleHover: vi.fn(),
      playBubblePop: vi.fn(),
    };

    mockRendererService = {
      drawSoapBubble: vi.fn(),
      drawBreezeRipples: vi.fn(),
      drawMagnetAura: vi.fn(),
      drawBurstParticle: vi.fn(),
      drawRainbowSpark: vi.fn(),
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
    } as any);

    await TestBed.configureTestingModule({
      imports: [BubbleCanvasComponent],
      providers: [
        { provide: AudioService, useValue: mockAudioService },
        { provide: BubbleCanvasRendererService, useValue: mockRendererService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BubbleCanvasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create the canvas component and spawn initial bubbles', () => {
    expect(component).toBeTruthy();
    expect(component.bubbleCount).toBeGreaterThan(0);
  });

  it('should create a bubble and emit bubbleCountChange', () => {
    const countSpy = vi.fn();
    component.bubbleCountChange.subscribe(countSpy);

    const prevCount = component.bubbleCount;
    component.createBubble(50, 50, 25, 1, -1);

    expect(component.bubbleCount).toBe(prevCount + 1);
    expect(countSpy).toHaveBeenCalledWith(prevCount + 1);
  });

  it('should pop a bubble, emit bubblePopped, and play audio pop sound', () => {
    const popSpy = vi.fn();
    component.bubblePopped.subscribe(popSpy);

    component.createBubble(100, 100, 20);
    const lastIndex = component.bubbleCount - 1;

    component.popBubble(lastIndex);

    expect(popSpy).toHaveBeenCalled();
    expect(mockAudioService['playBubblePop']).toHaveBeenCalled();
    expect(mockAudioService['playChime']).toHaveBeenCalled();
  });

  it('should spawn bubble cluster stream and increase bubble count', () => {
    vi.useFakeTimers();
    const initialCount = component.bubbleCount;
    component.spawnBubbleCluster();
    expect(mockAudioService['playBubbleHover']).toHaveBeenCalled();

    vi.advanceTimersByTime(1200);
    expect(component.bubbleCount).toBeGreaterThan(initialCount);
    vi.useRealTimers();
  });

  it('should pop all bubbles sequentially in symphony mode', () => {
    vi.useFakeTimers();
    component.popAllSymphony();
    vi.advanceTimersByTime(3000);
    expect(component.bubbleCount).toBe(0);
    vi.useRealTimers();
  });

  it('should pop bubble on pointer down when clicking an existing bubble', () => {
    const bubble = component.createBubble(200, 200, 30);
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: bubble.x,
      clientY: bubble.y,
    });

    const popSpy = vi.fn();
    component.bubblePopped.subscribe(popSpy);

    component.onPointerDown(mouseEvent);
    expect(popSpy).toHaveBeenCalled();
  });
});
