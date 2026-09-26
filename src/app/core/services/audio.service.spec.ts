import { TestBed } from '@angular/core/testing';
import { AudioService } from './audio.service';

describe('AudioService', () => {
  let service: AudioService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AudioService],
    });
    service = TestBed.inject(AudioService);
  });

  it('should be created and default to unmuted for direct landing page playback', () => {
    expect(service).toBeTruthy();
    expect(service.isMuted()).toBe(false);
  });

  it('should toggle mute state and pause/resume music', () => {
    expect(service.isMuted()).toBe(false);
    service.toggleSound();
    expect(service.isMuted()).toBe(true);

    service.toggleSound();
    expect(service.isMuted()).toBe(false);
  });

  it('should not throw on playAmbientMusic or pauseAmbientMusic in browser environment', () => {
    expect(() => {
      service.playAmbientMusic();
      service.pauseAmbientMusic(true);
    }).not.toThrow();
  });

  it('should not throw when calling playWaterdropScrollDown', () => {
    expect(() => {
      service.playWaterdropScrollDown();
    }).not.toThrow();

    service.isMuted.set(true);
    expect(() => {
      service.playWaterdropScrollDown();
    }).not.toThrow();
  });

  it('should not throw when calling playParticleOrbScroll', () => {
    service.isMuted.set(false);
    expect(() => {
      service.playParticleOrbScroll();
    }).not.toThrow();

    service.isMuted.set(true);
    expect(() => {
      service.playParticleOrbScroll();
    }).not.toThrow();
  });

  it('should not throw when calling playWaterdropToneOn', () => {
    service.isMuted.set(false);
    expect(() => {
      service.playWaterdropToneOn();
    }).not.toThrow();

    service.isMuted.set(true);
    expect(() => {
      service.playWaterdropToneOn();
    }).not.toThrow();
  });

  it('should not throw when calling playCraneFolding', () => {
    service.isMuted.set(false);
    expect(() => {
      service.playCraneFolding();
    }).not.toThrow();

    service.isMuted.set(true);
    expect(() => {
      service.playCraneFolding();
    }).not.toThrow();
  });

  it('should initialize isAwaitingUserGesture to false and activate sound with waterdrop-tone-on upon first toggleSound', () => {
    expect(service.isAwaitingUserGesture()).toBe(false);
    service.isAwaitingUserGesture.set(true);
    expect(service.isAwaitingUserGesture()).toBe(true);

    const playWaterdropSpy = vi.spyOn(service, 'playWaterdropToneOn');
    service.toggleSound();
    expect(service.isAwaitingUserGesture()).toBe(false);
    expect(service.isMuted()).toBe(false);
    expect(playWaterdropSpy).toHaveBeenCalledWith(1.0);
  });

  it('should activate sound, unmute, and play waterdrop-tone-on via activateSoundFromUserGesture', () => {
    service.isAwaitingUserGesture.set(true);
    const playWaterdropSpy = vi.spyOn(service, 'playWaterdropToneOn');
    const playAmbientSpy = vi.spyOn(service, 'playAmbientMusic');

    service.activateSoundFromUserGesture();

    expect(service.isAwaitingUserGesture()).toBe(false);
    expect(service.isMuted()).toBe(false);
    expect(playWaterdropSpy).toHaveBeenCalledWith(1.0);
    expect(playAmbientSpy).toHaveBeenCalled();
  });

  it('should prevent muting if toggleSound is triggered immediately after first gesture activation', () => {
    service.isAwaitingUserGesture.set(true);
    service.activateSoundFromUserGesture();
    expect(service.isMuted()).toBe(false);

    // Immediate button click right after pointerdown activation (<600ms)
    service.toggleSound();
    expect(service.isMuted()).toBe(false);
  });

  it('should start and stop sanctuary whales safely without throwing', () => {
    expect(() => {
      service.startSanctuaryWhales();
    }).not.toThrow();

    expect(() => {
      service.stopSanctuaryWhales();
    }).not.toThrow();
  });

  it('should handle pauseSanctuaryWhales and resumeSanctuaryWhales correctly', () => {
    service.startSanctuaryWhales();
    expect(() => {
      service.pauseSanctuaryWhales();
    }).not.toThrow();

    expect(() => {
      service.resumeSanctuaryWhales();
    }).not.toThrow();

    service.stopSanctuaryWhales();
  });
});
