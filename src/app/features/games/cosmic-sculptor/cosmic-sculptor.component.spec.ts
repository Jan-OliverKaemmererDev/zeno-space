import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CosmicSculptorComponent } from './cosmic-sculptor.component';
import { AudioService } from '../../../core/services/audio.service';

describe('CosmicSculptorComponent', () => {
  let component: CosmicSculptorComponent;
  let fixture: ComponentFixture<CosmicSculptorComponent>;
  let mockAudioService: { playWaterdropToneOn: any; playChime: any };
  let router: Router;

  beforeEach(async () => {
    mockAudioService = {
      playWaterdropToneOn: vi.fn(),
      playChime: vi.fn(),
    };

    const dummyGradient = { addColorStop: vi.fn() };
    const mockCtx = {
      createRadialGradient: vi.fn().mockReturnValue(dummyGradient),
      createLinearGradient: vi.fn().mockReturnValue(dummyGradient),
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(1024 * 512 * 4) }),
      putImageData: vi.fn(),
      createImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(1024 * 512 * 4) }),
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);

    await TestBed.configureTestingModule({
      imports: [CosmicSculptorComponent],
      providers: [
        provideRouter([]),
        { provide: AudioService, useValue: mockAudioService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CosmicSculptorComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should initialize with info bubble closed', () => {
    expect(component.showInfoBubble()).toBe(false);
    expect(component.closingInfoBubble()).toBe(false);
  });

  it('should open info bubble and play waterdrop tone on toggle', () => {
    component.toggleInfoBubble();
    expect(component.showInfoBubble()).toBe(true);
    expect(mockAudioService.playWaterdropToneOn).toHaveBeenCalledWith(0.35);
  });

  it('should close info bubble when Escape is pressed while open', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    component.openInfoBubble();
    expect(component.showInfoBubble()).toBe(true);

    component.onEscape();
    expect(component.closingInfoBubble()).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('should navigate away on Escape when info bubble is closed', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    expect(component.showInfoBubble()).toBe(false);

    component.onEscape();
    expect(navigateSpy).toHaveBeenCalledWith(['/'], { fragment: 'bubble-hub' });
  });

  it('should adjust time speed and play chime audio', () => {
    component.setTimeSpeed(2);
    expect(component.timeSpeed()).toBe(2);
    expect(mockAudioService.playChime).toHaveBeenCalled();
  });

  it('should spawn a new planet and increment count', () => {
    const prevCount = component.planetCount();
    component.onSpawnPlanet();
    expect(component.planetCount()).toBe(prevCount + 1);
    expect(mockAudioService.playChime).toHaveBeenCalled();
  });

  it('should spawn a black hole and update stability', () => {
    expect(component.blackHoleCount()).toBe(0);
    component.onSpawnBlackHole();
    expect(component.blackHoleCount()).toBe(1);
    expect(component.systemStability()).toBe('Singulär verzerrt');
  });

  it('should reset cosmic system to starter planets', () => {
    component.onSpawnPlanet();
    component.onSpawnBlackHole();
    component.resetCosmos();
    expect(component.blackHoleCount()).toBe(0);
    expect(component.planetCount()).toBe(3);
  });
});
