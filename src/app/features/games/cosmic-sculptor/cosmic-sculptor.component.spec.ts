import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import * as THREE from 'three';
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

  it('should spawn a black hole and increment count', () => {
    expect(component.blackHoleCount()).toBe(0);
    component.onSpawnBlackHole();
    expect(component.blackHoleCount()).toBe(1);
    expect(component.isPlacingBlackHole()).toBe(false);
  });

  it('should enter black hole placement mode and cancel on escape', () => {
    expect(component.isPlacingBlackHole()).toBe(false);
    component.onStartPlacingBlackHole();
    expect(component.isPlacingBlackHole()).toBe(true);
    expect(mockAudioService.playWaterdropToneOn).toHaveBeenCalled();

    component.onEscape();
    expect(component.isPlacingBlackHole()).toBe(false);
  });

  it('should place black hole at custom position and reset placing state', () => {
    component.onStartPlacingBlackHole();
    expect(component.isPlacingBlackHole()).toBe(true);

    const customPos = new THREE.Vector3(25, 0, 15);
    component.onSpawnBlackHole(customPos);

    expect(component.isPlacingBlackHole()).toBe(false);
    expect(component.blackHoleCount()).toBe(1);
  });

  it('should close info bubble when clicking outside .stat-pill-wrapper', () => {
    component.openInfoBubble();
    expect(component.showInfoBubble()).toBe(true);

    const outsideEl = document.createElement('div');
    const pointerEvent = new PointerEvent('pointerdown');
    Object.defineProperty(pointerEvent, 'target', { value: outsideEl });
    component.onDocumentPointerDown(pointerEvent);

    expect(component.closingInfoBubble()).toBe(true);
  });

  it('should reset cosmic system to starter planets', () => {
    component.onSpawnPlanet();
    component.onSpawnBlackHole();
    component.resetCosmos();
    expect(component.blackHoleCount()).toBe(0);
    expect(component.planetCount()).toBe(3);
  });

  it('should toggle orbit strings and prevent chime sound on pointer move when disabled', () => {
    expect(component.orbitStringsVisible()).toBe(true);
    component.toggleOrbitStrings();
    expect(component.orbitStringsVisible()).toBe(false);

    mockAudioService.playChime.mockClear();

    // Trigger pointer move event
    const event = new PointerEvent('pointermove', { clientX: 200, clientY: 200 });
    component.onPointerMove(event);

    expect(mockAudioService.playChime).not.toHaveBeenCalled();
  });

  it('should clamp zoom-in to 18.0 near the sun and allow infinite zoom-out', () => {
    // Zoom in heavily
    const zoomInEvent = new WheelEvent('wheel', { deltaY: -5000 });
    component.onWheel(zoomInEvent);
    expect((component as any).targetSpherical.radius).toBe(18.0);

    // Zoom out deeply into space
    const zoomOutEvent = new WheelEvent('wheel', { deltaY: 2000 });
    component.onWheel(zoomOutEvent);
    expect((component as any).targetSpherical.radius).toBeGreaterThan(160.0);

    const zoomOutMore = new WheelEvent('wheel', { deltaY: 3000 });
    component.onWheel(zoomOutMore);
    expect((component as any).targetSpherical.radius).toBeGreaterThan(1000.0);
  });
});
