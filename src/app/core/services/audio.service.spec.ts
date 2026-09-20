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
});
