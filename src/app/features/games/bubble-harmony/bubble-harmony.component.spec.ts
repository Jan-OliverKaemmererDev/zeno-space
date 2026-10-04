import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BubbleHarmonyComponent } from './bubble-harmony.component';
import { AudioService } from '../../../core/services/audio.service';
import { By } from '@angular/platform-browser';

describe('BubbleHarmonyComponent', () => {
  let component: BubbleHarmonyComponent;
  let fixture: ComponentFixture<BubbleHarmonyComponent>;
  let mockAudioService: Record<string, any>;
  let router: Router;

  beforeEach(async () => {
    mockAudioService = {
      playWaterdropToneOn: vi.fn(),
      playChime: vi.fn(),
      playBubbleHover: vi.fn(),
      playBubblePop: vi.fn(),
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
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      createConicGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
    } as any);

    await TestBed.configureTestingModule({
      imports: [BubbleHarmonyComponent],
      providers: [
        provideRouter([]),
        { provide: AudioService, useValue: mockAudioService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BubbleHarmonyComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create the bubble harmony component', () => {
    expect(component).toBeTruthy();
  });

  it('should display "Zurück" in the back link button', () => {
    const backLink = fixture.debugElement.query(By.css('.back-link'));
    expect(backLink).toBeTruthy();
    expect(backLink.nativeElement.textContent).toContain('Zurück');
  });

  it('should toggle chain reaction mode when toggleChain is called', () => {
    const initial = component.chainReaction();
    component.toggleChain();
    expect(component.chainReaction()).toBe(!initial);
  });

  it('should spawn bubble cluster stream and increase bubbleCount with audio feedback', () => {
    vi.useFakeTimers();
    const initialCount = component.bubbleCount();
    component.spawnBubbleCluster();
    expect(mockAudioService['playBubbleHover']).toHaveBeenCalled();
    vi.advanceTimersByTime(1200);
    expect(component.bubbleCount()).toBeGreaterThan(initialCount);
    vi.useRealTimers();
  });

  it('should navigate back to home on escape key if tool bubble is closed', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    component.onEscape();
    expect(navigateSpy).toHaveBeenCalledWith(['/'], { fragment: 'bubble-hub' });
  });

  it('should default to no tool active', () => {
    expect(component.activeTool()).toBeNull();
    expect(component.activeToolLabel()).toBe('');
  });

  it('should toggle tool bubble open and closed', () => {
    vi.useFakeTimers();
    expect(component.showToolBubble()).toBe(false);

    component.toggleToolBubble();
    expect(component.showToolBubble()).toBe(true);
    expect(mockAudioService['playWaterdropToneOn']).toHaveBeenCalledWith(0.4);

    component.toggleToolBubble();
    expect(component.closingToolBubble()).toBe(true);
    vi.advanceTimersByTime(350);
    expect(component.showToolBubble()).toBe(false);
    vi.useRealTimers();
  });

  it('should close tool bubble when a tool is selected', () => {
    vi.useFakeTimers();
    component.openToolBubble();
    expect(component.showToolBubble()).toBe(true);

    component.onSelectTool('magnet');
    expect(component.activeTool()).toBe('magnet');
    expect(component.activeToolLabel()).toBe('Magnet');
    expect(mockAudioService['playWaterdropToneOn']).toHaveBeenCalledWith(0.5);

    vi.advanceTimersByTime(350);
    expect(component.showToolBubble()).toBe(false);
    vi.useRealTimers();
  });

  it('should allow deactivating the tool with null', () => {
    component.onSelectTool('fan');
    expect(component.activeTool()).toBe('fan');

    component.onSelectTool(null);
    expect(component.activeTool()).toBeNull();
    expect(component.activeToolLabel()).toBe('');
  });

  it('should close tool bubble on escape instead of navigating home if bubble was open', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    component.openToolBubble();
    expect(component.showToolBubble()).toBe(true);

    component.onEscape();
    expect(component.closingToolBubble()).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('should close tool bubble on document pointerdown outside the tool pill wrapper', () => {
    component.openToolBubble();
    expect(component.showToolBubble()).toBe(true);

    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);
    const pointerEvent = new PointerEvent('pointerdown', { bubbles: true });
    Object.defineProperty(pointerEvent, 'target', { value: outsideElement });

    component.onDocumentPointerDown(pointerEvent);
    expect(component.closingToolBubble()).toBe(true);
    document.body.removeChild(outsideElement);
  });
});
