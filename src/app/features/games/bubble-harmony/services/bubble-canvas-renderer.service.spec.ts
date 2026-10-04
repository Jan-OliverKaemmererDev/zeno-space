import { TestBed } from '@angular/core/testing';
import { BubbleCanvasRendererService } from './bubble-canvas-renderer.service';
import { Bubble, Particle } from '../models/bubble.model';

describe('BubbleCanvasRendererService', () => {
  let service: BubbleCanvasRendererService;
  let mockCtx: any;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BubbleCanvasRendererService],
    });
    service = TestBed.inject(BubbleCanvasRendererService);

    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
    };
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should draw a soap bubble with radial gradient and highlight', () => {
    const bubble: Bubble = {
      x: 100,
      y: 100,
      radius: 30,
      vx: 0,
      vy: 0,
      color: 'hsla(200, 85%, 65%, 0.45)',
      hue: 200,
      wobbleSpeed: 0.03,
      wobblePhase: 0,
      alpha: 0.8,
    };

    service.drawSoapBubble(mockCtx, bubble);

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.createRadialGradient).toHaveBeenCalled();
    expect(mockCtx.arc).toHaveBeenCalledWith(100, 100, 30, 0, Math.PI * 2);
    expect(mockCtx.ellipse).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it('should draw breeze ripples', () => {
    service.drawBreezeRipples(mockCtx, 150, 150, 0.5);

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.arc).toHaveBeenCalledTimes(3);
    expect(mockCtx.stroke).toHaveBeenCalledTimes(3);
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it('should draw magnet aura pulses', () => {
    service.drawMagnetAura(mockCtx, 200, 200, 0.5);

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.arc).toHaveBeenCalledTimes(2);
    expect(mockCtx.stroke).toHaveBeenCalledTimes(2);
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it('should draw burst particles and rainbow sparks', () => {
    const particle: Particle = {
      x: 50,
      y: 50,
      vx: 1,
      vy: 1,
      radius: 2,
      alpha: 0.8,
      color: '#ffffff',
    };

    service.drawBurstParticle(mockCtx, particle);
    expect(mockCtx.arc).toHaveBeenCalledWith(50, 50, 2, 0, Math.PI * 2);
    expect(mockCtx.fill).toHaveBeenCalled();

    service.drawRainbowSpark(mockCtx, particle, 2.5, 0.9);
    expect(mockCtx.arc).toHaveBeenCalledWith(50, 50, 2.5, 0, Math.PI * 2);
  });
});
