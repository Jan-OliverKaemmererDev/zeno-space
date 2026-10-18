import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AmeisenhuegelComponent } from './ameisenhuegel.component';
import { AudioService } from '../../../core/services/audio.service';

describe('AmeisenhuegelComponent', () => {
  let component: AmeisenhuegelComponent;
  let fixture: ComponentFixture<AmeisenhuegelComponent>;
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
      imports: [AmeisenhuegelComponent],
      providers: [provideRouter([]), { provide: AudioService, useValue: mockAudioService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AmeisenhuegelComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should initialize with info bubble closed and default ant population', () => {
    expect(component.showInfoBubble()).toBe(false);
    expect(component.closingInfoBubble()).toBe(false);
    expect(component.antCount()).toBeGreaterThanOrEqual(20);
    expect(component.foodStock()).toBe(0);
    expect(component.hillLevel()).toBe(1);
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

  it('should spawn a new fruit when onSpawnFruit is called', () => {
    component.onSpawnFruit();
    expect(mockAudioService.playChime).toHaveBeenCalled();
  });

  it('should sound alarm and mobilize swarm when onAlarmSwarm is called', () => {
    component.onAlarmSwarm();
    expect(mockAudioService.playChime).toHaveBeenCalled();
  });

  it('should reset camera view to default spherical coordinates', () => {
    (component as any).targetSpherical.radius = 70.0;
    component.resetCameraView();
    expect((component as any).targetSpherical.radius).toBe(52.0);
  });

  it('should reset colony to initial starter state', () => {
    component.resetColony();
    expect(component.antCount()).toBe(20);
    expect(component.foodStock()).toBe(0);
    expect(component.hillLevel()).toBe(1);
    expect(mockAudioService.playChime).toHaveBeenCalled();
  });

  it('should handle keyboard WASD keys in keydown and keyup', () => {
    const downEvent = new KeyboardEvent('keydown', { key: 'w' });
    component.onKeyDown(downEvent);
    expect((component as any).activeKeys['w']).toBe(true);

    const upEvent = new KeyboardEvent('keyup', { key: 'w' });
    component.onKeyUp(upEvent);
    expect((component as any).activeKeys['w']).toBe(false);
  });

  it('should clamp zoom wheel events within valid bounds', () => {
    const zoomInEvent = new WheelEvent('wheel', { deltaY: -5000 });
    component.onWheel(zoomInEvent);
    expect((component as any).targetSpherical.radius).toBe(38.0);

    const zoomOutEvent = new WheelEvent('wheel', { deltaY: 5000 });
    component.onWheel(zoomOutEvent);
    expect((component as any).targetSpherical.radius).toBe(110.0);
  });
});
