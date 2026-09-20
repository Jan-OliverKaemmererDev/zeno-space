import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;

  // Background Ambient Music (space-ambient.mp3)
  private bgAudio: HTMLAudioElement | null = null;
  private fadeIntervalId: number | null = null;
  private isFadingToPause = false;
  private hasAutoplayFallbackListener = false;
  private readonly targetVolume = 0.45;
  private readonly fadeInDuration = 2.5; // seconds to fade in
  private readonly fadeOutDuration = 4.0; // seconds to fade out at end of track

  // Signals for state - defaults to false (unmuted) so it plays on landing page load
  readonly isMuted = signal<boolean>(false);
  readonly isAmbientPlaying = signal<boolean>(false);

  // Pentatonic Celestial Scale (Hz)
  private readonly pentatonicScale = [
    261.63, // C4
    293.66, // D4
    329.63, // E4
    392.00, // G4
    440.00, // A4
    523.25, // C5
    587.33, // D5
    659.25, // E5
    783.99, // G5
    880.00, // A5
  ];

  private initContext(): void {
    if (!this.ctx) {
      const AudioCtx =
        typeof window !== 'undefined'
          ? window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          : null;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // SFX gain node
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.sfxGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Lazily initialize the HTMLAudioElement for space-ambient.mp3
   */
  private initBgAudio(): void {
    if (this.bgAudio || typeof window === 'undefined') return;

    this.bgAudio = new Audio('/sounds/music/space-ambient.mp3');
    this.bgAudio.preload = 'auto';
    this.bgAudio.loop = false; // We handle the loop to execute the smooth end-fade and restart
    this.bgAudio.volume = 0;

    // When the song ends naturally, restart from beginning with smooth fade-in
    this.bgAudio.addEventListener('ended', () => {
      if (!this.isMuted() && this.bgAudio) {
        this.bgAudio.currentTime = 0;
        this.bgAudio.volume = 0;
        this.bgAudio.play().catch(() => {});
      }
    });
  }

  /**
   * Play or resume ambient music (space-ambient.mp3) with smooth fade-in
   */
  playAmbientMusic(): void {
    if (this.isMuted()) return;
    this.initBgAudio();
    if (!this.bgAudio) return;

    this.isFadingToPause = false;

    const playPromise = this.bgAudio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.isAmbientPlaying.set(true);
          this.startFadeMonitoring();
        })
        .catch((err) => {
          // Autoplay policy prevented playback without prior user interaction
          this.isAmbientPlaying.set(false);
          this.setupAutoplayFallback();
        });
    }
  }

  /**
   * Pause ambient music with a quick gentle micro-fade (150ms) to prevent audio clicks
   */
  pauseAmbientMusic(immediate = false): void {
    if (!this.bgAudio) {
      this.isAmbientPlaying.set(false);
      return;
    }

    if (immediate) {
      this.stopFadeMonitoring();
      this.bgAudio.pause();
      this.bgAudio.volume = 0;
      this.isAmbientPlaying.set(false);
      return;
    }

    this.isFadingToPause = true;
    const startVol = this.bgAudio.volume;
    const totalSteps = 10;
    const stepDurationMs = 15; // 150ms total
    let currentStep = 0;

    const fadeTimer = window.setInterval(() => {
      currentStep++;
      if (!this.bgAudio) {
        clearInterval(fadeTimer);
        return;
      }

      const progress = Math.max(0, 1 - currentStep / totalSteps);
      this.bgAudio.volume = startVol * progress;

      if (currentStep >= totalSteps) {
        clearInterval(fadeTimer);
        this.stopFadeMonitoring();
        this.bgAudio.pause();
        this.isAmbientPlaying.set(false);
        this.isFadingToPause = false;
      }
    }, stepDurationMs);
  }

  /**
   * Toggle mute state.
   * When muted, the song is also paused/stopped as requested.
   */
  toggleSound(): void {
    const nextMuted = !this.isMuted();
    this.isMuted.set(nextMuted);

    if (nextMuted) {
      this.pauseAmbientMusic();
    } else {
      this.playAmbientMusic();
      this.playChime(4, 0.18);
    }
  }

  /**
   * Start 50ms interval loop to manage volume fade-in at start and smooth fade-out before loop restart
   */
  private startFadeMonitoring(): void {
    if (this.fadeIntervalId !== null) return;

    this.fadeIntervalId = window.setInterval(() => {
      this.updateVolumeFade();
    }, 50);
  }

  private stopFadeMonitoring(): void {
    if (this.fadeIntervalId !== null) {
      clearInterval(this.fadeIntervalId);
      this.fadeIntervalId = null;
    }
  }

  /**
   * Evaluates current playback position and smoothly adjusts volume
   */
  private updateVolumeFade(): void {
    if (!this.bgAudio || this.isMuted() || this.isFadingToPause) return;

    const currentTime = this.bgAudio.currentTime;
    const duration = this.bgAudio.duration;

    // If metadata is still loading
    if (!duration || isNaN(duration) || duration <= 0) {
      if (currentTime < this.fadeInDuration) {
        const factor = Math.max(0, currentTime / this.fadeInDuration);
        this.bgAudio.volume = this.targetVolume * factor;
      } else {
        this.bgAudio.volume = this.targetVolume;
      }
      return;
    }

    const timeLeft = duration - currentTime;

    // Track ending boundary: reset to 0 and loop seamlessly
    if (timeLeft <= 0.1) {
      this.bgAudio.currentTime = 0;
      this.bgAudio.volume = 0;
      this.bgAudio.play().catch(() => {});
      return;
    }

    // 1. Smooth fade-out in the last 4 seconds of the track
    if (timeLeft <= this.fadeOutDuration) {
      const progress = Math.max(0, timeLeft / this.fadeOutDuration);
      this.bgAudio.volume = this.targetVolume * progress;
    }
    // 2. Smooth fade-in during the first 2.5 seconds of the track
    else if (currentTime < this.fadeInDuration) {
      const progress = Math.max(0, currentTime / this.fadeInDuration);
      this.bgAudio.volume = this.targetVolume * progress;
    }
    // 3. Normal steady target volume
    else {
      this.bgAudio.volume = this.targetVolume;
    }
  }

  /**
   * If autoplay is blocked by browser policy on initial page load,
   * attach a one-time gesture listener on any interaction (click, touch, key, scroll)
   * to immediately and smoothly start playback.
   */
  private setupAutoplayFallback(): void {
    if (this.hasAutoplayFallbackListener || typeof window === 'undefined') return;
    this.hasAutoplayFallbackListener = true;

    const onUserInteract = () => {
      window.removeEventListener('click', onUserInteract);
      window.removeEventListener('pointerdown', onUserInteract);
      window.removeEventListener('keydown', onUserInteract);
      window.removeEventListener('touchstart', onUserInteract);
      window.removeEventListener('scroll', onUserInteract);
      this.hasAutoplayFallbackListener = false;

      if (!this.isMuted()) {
        this.playAmbientMusic();
      }
    };

    window.addEventListener('click', onUserInteract, { once: true, passive: true });
    window.addEventListener('pointerdown', onUserInteract, { once: true, passive: true });
    window.addEventListener('keydown', onUserInteract, { once: true, passive: true });
    window.addEventListener('touchstart', onUserInteract, { once: true, passive: true });
    window.addEventListener('scroll', onUserInteract, { once: true, passive: true });
  }

  /**
   * Play a satisfying soap-bubble pop sound with droplet resonance
   */
  playBubblePop(pitchShift = 1): void {
    if (this.isMuted()) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    
    // Bubble chirp oscillator
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 380 * pitchShift;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.4, now + 0.08);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.13);

    // Harmonic bell ring accompaniment
    this.playChime(Math.floor(Math.random() * this.pentatonicScale.length), 0.12);
  }

  /**
   * Play a gentle bell / chime note
   */
  playChime(scaleIndex = 0, volume = 0.25): void {
    if (this.isMuted()) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const freq = this.pentatonicScale[scaleIndex % this.pentatonicScale.length];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    // Bell envelope: instant attack, exponential decay
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 1.7);
  }

  /**
   * Soft hover whisper
   */
  playBubbleHover(): void {
    if (this.isMuted()) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.09);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.11);
  }
}
