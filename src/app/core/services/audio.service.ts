import { Injectable, signal } from '@angular/core';

/**
 * Service responsible for managing all audio context, ambient music, and sound effects within the application.
 * Handles Web Audio API initialization, preloading, and responsive playback with volume fading.
 */
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
  private lastActivationTime = 0;
  private readonly targetVolume = 0.45;
  private readonly fadeInDuration = 2.5; // seconds to fade in
  private readonly fadeOutDuration = 4.0; // seconds to fade out at end of track

  // Signals for state - defaults to false (unmuted) so it plays on landing page load
  readonly isMuted = signal<boolean>(false);
  readonly isAmbientPlaying = signal<boolean>(false);
  readonly isAwaitingUserGesture = signal<boolean>(false);

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

  // Waterdrop scroll-down sound buffer & preloading
  private waterdropBuffer: AudioBuffer | null = null;
  private waterdropArrayBuffer: ArrayBuffer | null = null;
  private waterdropLoadingPromise: Promise<ArrayBuffer | null> | null = null;

  // Particle orb scroll sound buffer & preloading (particle-orb-scroll.mp3)
  private particleOrbBuffer: AudioBuffer | null = null;
  private particleOrbArrayBuffer: ArrayBuffer | null = null;
  private particleOrbLoadingPromise: Promise<ArrayBuffer | null> | null = null;

  // Waterdrop tone-on sound buffer & preloading (waterdrop-tone-on.mp3)
  private waterdropToneOnBuffer: AudioBuffer | null = null;
  private waterdropToneOnArrayBuffer: ArrayBuffer | null = null;
  private waterdropToneOnLoadingPromise: Promise<ArrayBuffer | null> | null = null;

  // Crane folding sound buffer & preloading (crane-folding.mp3)
  private craneFoldingBuffer: AudioBuffer | null = null;
  private craneFoldingArrayBuffer: ArrayBuffer | null = null;
  private craneFoldingLoadingPromise: Promise<ArrayBuffer | null> | null = null;

  // Cozy Sanctuary Whale Ambience (/sounds/wale1.mp3 & /sounds/wale2.mp3)
  private whale1Buffer: AudioBuffer | null = null;
  private whale1ArrayBuffer: ArrayBuffer | null = null;
  private whale1LoadingPromise: Promise<ArrayBuffer | null> | null = null;

  private whale2Buffer: AudioBuffer | null = null;
  private whale2ArrayBuffer: ArrayBuffer | null = null;
  private whale2LoadingPromise: Promise<ArrayBuffer | null> | null = null;

  private whale1Audio: HTMLAudioElement | null = null;
  private whale2Audio: HTMLAudioElement | null = null;

  private activeWhaleSource: AudioBufferSourceNode | null = null;
  private activeWhaleGain: GainNode | null = null;
  private activeWhaleAudio: HTMLAudioElement | null = null;
  private whaleFadeIntervalId: number | null = null;

  private whaleScheduleTimeoutId: number | null = null;
  private isInSanctuary = false;
  private lastWhaleIndex = 0;
  private readonly whaleTargetVolume = 0.65;

  constructor() {
    if (typeof window !== 'undefined') {
      this.preloadWaterdropSound();
      this.preloadParticleOrbSound();
      this.preloadWaterdropToneOnSound();
      this.preloadCraneFoldingSound();
      this.preloadWhaleSounds();
    }
  }

  private preloadWaterdropSound(): void {
    const isTestEnv = !!(globalThis as unknown as { process?: { env?: Record<string, string> } })
      ?.process?.env?.['VITEST'];

    if (
      typeof window === 'undefined' ||
      !window.location ||
      window.location.protocol.startsWith('about:') ||
      isTestEnv ||
      this.waterdropLoadingPromise
    ) {
      return;
    }

    const soundUrl =
      window.location.origin &&
      window.location.origin !== 'null' &&
      !window.location.origin.startsWith('about:')
        ? `${window.location.origin}/sounds/waterdrop-scroll-down.mp3`
        : '/sounds/waterdrop-scroll-down.mp3';

    this.waterdropLoadingPromise = fetch(soundUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        this.waterdropArrayBuffer = buf;
        if (this.ctx) {
          this.decodeWaterdropBuffer(buf);
        }
        return buf;
      })
      .catch((err) => {
        console.warn('Could not preload waterdrop-scroll-down.mp3:', err);
        return null;
      });
  }

  private decodeWaterdropBuffer(arrayBuf: ArrayBuffer): void {
    if (!this.ctx || this.waterdropBuffer) return;
    this.ctx
      .decodeAudioData(arrayBuf.slice(0))
      .then((decoded) => {
        this.waterdropBuffer = decoded;
      })
      .catch((err) => {
        console.warn('decodeAudioData for waterdrop sound failed:', err);
      });
  }

  private preloadParticleOrbSound(): void {
    const isTestEnv = !!(globalThis as unknown as { process?: { env?: Record<string, string> } })
      ?.process?.env?.['VITEST'];

    if (
      typeof window === 'undefined' ||
      !window.location ||
      window.location.protocol.startsWith('about:') ||
      isTestEnv ||
      this.particleOrbLoadingPromise
    ) {
      return;
    }

    const soundUrl =
      window.location.origin &&
      window.location.origin !== 'null' &&
      !window.location.origin.startsWith('about:')
        ? `${window.location.origin}/sounds/particle-orb-scroll.mp3`
        : '/sounds/particle-orb-scroll.mp3';

    this.particleOrbLoadingPromise = fetch(soundUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        this.particleOrbArrayBuffer = buf;
        if (this.ctx) {
          this.decodeParticleOrbBuffer(buf);
        }
        return buf;
      })
      .catch((err) => {
        console.warn('Could not preload particle-orb-scroll.mp3:', err);
        return null;
      });
  }

  private decodeParticleOrbBuffer(arrayBuf: ArrayBuffer): void {
    if (!this.ctx || this.particleOrbBuffer) return;
    this.ctx
      .decodeAudioData(arrayBuf.slice(0))
      .then((decoded) => {
        this.particleOrbBuffer = decoded;
      })
      .catch((err) => {
        console.warn('decodeAudioData for particle orb sound failed:', err);
      });
  }

  private preloadWaterdropToneOnSound(): void {
    const isTestEnv = !!(globalThis as unknown as { process?: { env?: Record<string, string> } })
      ?.process?.env?.['VITEST'];

    if (
      typeof window === 'undefined' ||
      !window.location ||
      window.location.protocol.startsWith('about:') ||
      isTestEnv ||
      this.waterdropToneOnLoadingPromise
    ) {
      return;
    }

    const soundUrl =
      window.location.origin &&
      window.location.origin !== 'null' &&
      !window.location.origin.startsWith('about:')
        ? `${window.location.origin}/sounds/waterdrop-tone-on.mp3`
        : '/sounds/waterdrop-tone-on.mp3';

    try {
      const preAudio = new Audio(soundUrl);
      preAudio.preload = 'auto';
    } catch {
      // Audio element creation may not be supported in certain test environments
    }

    this.waterdropToneOnLoadingPromise = fetch(soundUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        this.waterdropToneOnArrayBuffer = buf;
        if (this.ctx) {
          this.decodeWaterdropToneOnBuffer(buf);
        }
        return buf;
      })
      .catch((err) => {
        console.warn('Could not preload waterdrop-tone-on.mp3:', err);
        return null;
      });
  }

  private decodeWaterdropToneOnBuffer(arrayBuf: ArrayBuffer): void {
    if (!this.ctx || this.waterdropToneOnBuffer) return;
    this.ctx
      .decodeAudioData(arrayBuf.slice(0))
      .then((decoded) => {
        this.waterdropToneOnBuffer = decoded;
      })
      .catch((err) => {
        console.warn('decodeAudioData for waterdrop tone on sound failed:', err);
      });
  }

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

      if (this.waterdropArrayBuffer && !this.waterdropBuffer) {
        this.decodeWaterdropBuffer(this.waterdropArrayBuffer);
      }
      if (this.particleOrbArrayBuffer && !this.particleOrbBuffer) {
        this.decodeParticleOrbBuffer(this.particleOrbArrayBuffer);
      }
      if (this.waterdropToneOnArrayBuffer && !this.waterdropToneOnBuffer) {
        this.decodeWaterdropToneOnBuffer(this.waterdropToneOnArrayBuffer);
      }
      if (this.craneFoldingArrayBuffer && !this.craneFoldingBuffer) {
        this.decodeCraneFoldingBuffer(this.craneFoldingArrayBuffer);
      }
      if (this.whale1ArrayBuffer && !this.whale1Buffer) {
        this.decodeWhale1Buffer(this.whale1ArrayBuffer);
      }
      if (this.whale2ArrayBuffer && !this.whale2Buffer) {
        this.decodeWhale2Buffer(this.whale2ArrayBuffer);
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Pre-warm AudioContext for instantaneous 0ms playback on interaction.
   *
   * @returns {void}
   */
  warmupAudio(): void {
    if (typeof window === 'undefined') return;
    this.initContext();
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
   * Play or resume ambient music (space-ambient.mp3) with smooth fade-in.
   *
   * @returns {void}
   */
  playAmbientMusic(): void {
    if (this.isMuted()) return;
    this.initBgAudio();
    if (!this.bgAudio) return;

    this.isFadingToPause = false;

    const playPromise = this.bgAudio.play();
    if (playPromise !== undefined) {
      if (!this.isAmbientPlaying()) {
        this.setupAutoplayFallback();
      }
      playPromise
        .then(() => {
          this.isAmbientPlaying.set(true);
          this.isAwaitingUserGesture.set(false);
          this.cleanupAutoplayFallback();
          this.startFadeMonitoring();
        })
        .catch((err) => {
          // Autoplay policy prevented playback without prior user interaction
          this.isAmbientPlaying.set(false);
          if (!this.isMuted()) {
            this.isAwaitingUserGesture.set(true);
          }
          this.setupAutoplayFallback();
        });
    }
  }

  /**
   * Pause ambient music with a quick gentle micro-fade (150ms) to prevent audio clicks.
   *
   * @param {boolean} immediate - If true, pauses instantly without fading.
   * @returns {void}
   */
  pauseAmbientMusic(immediate = false): void {
    this.isAwaitingUserGesture.set(false);
    this.cleanupAutoplayFallback();

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
   * When muted, the ambient song is also paused/stopped as requested.
   *
   * @returns {void}
   */
  toggleSound(): void {
    if (this.isAwaitingUserGesture()) {
      // First click on sound button activates sound and plays waterdrop-tone-on.mp3
      this.activateSoundFromUserGesture();
      return;
    }

    // Debounce to prevent race condition when pointerdown/click on window just activated sound
    if (Date.now() - this.lastActivationTime < 600) {
      return;
    }

    const nextMuted = !this.isMuted();
    this.isMuted.set(nextMuted);
    this.isAwaitingUserGesture.set(false);
    this.cleanupAutoplayFallback();

    if (nextMuted) {
      this.pauseAmbientMusic();
      this.pauseSanctuaryWhales();
    } else {
      this.playWaterdropToneOn(1.0);
      this.playAmbientMusic();
      this.resumeSanctuaryWhales();
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

  private autoplayFallbackHandler: (() => void) | null = null;

  /**
   * Activates audio on first user gesture (click / touch / key anywhere on page or sound button).
   * Plays waterdrop-tone-on.mp3 immediately and starts ambient music with smooth fade-in.
   *
   * @returns {void}
   */
  activateSoundFromUserGesture(): void {
    if (this.isMuted()) return;
    this.lastActivationTime = Date.now();
    this.isAwaitingUserGesture.set(false);
    this.cleanupAutoplayFallback();
    this.initContext();
    this.playWaterdropToneOn(1.0);
    this.playAmbientMusic();
    if (this.isInSanctuary) {
      this.resumeSanctuaryWhales();
    }
  }

  /**
   * Safely detach any pending autoplay fallback gesture listeners
   */
  private cleanupAutoplayFallback(): void {
    if (this.autoplayFallbackHandler && typeof window !== 'undefined') {
      const opts = { capture: true };
      window.removeEventListener('click', this.autoplayFallbackHandler, opts);
      window.removeEventListener('pointerdown', this.autoplayFallbackHandler, opts);
      window.removeEventListener('keydown', this.autoplayFallbackHandler, opts);
      window.removeEventListener('touchstart', this.autoplayFallbackHandler, opts);
      window.removeEventListener('click', this.autoplayFallbackHandler);
      window.removeEventListener('pointerdown', this.autoplayFallbackHandler);
      window.removeEventListener('keydown', this.autoplayFallbackHandler);
      window.removeEventListener('touchstart', this.autoplayFallbackHandler);
      this.autoplayFallbackHandler = null;
    }
    this.hasAutoplayFallbackListener = false;
  }

  /**
   * If autoplay is blocked by browser policy on initial page load,
   * attach a one-time gesture listener on any interaction (click, pointerdown, keydown, touchstart)
   * to immediately play waterdrop-tone-on.mp3 and start ambient music.
   */
  private setupAutoplayFallback(): void {
    if (this.hasAutoplayFallbackListener || typeof window === 'undefined') return;
    this.hasAutoplayFallbackListener = true;

    this.autoplayFallbackHandler = () => {
      this.activateSoundFromUserGesture();
    };

    const opts = { capture: true, once: true, passive: true };
    window.addEventListener('click', this.autoplayFallbackHandler, opts);
    window.addEventListener('pointerdown', this.autoplayFallbackHandler, opts);
    window.addEventListener('keydown', this.autoplayFallbackHandler, opts);
    window.addEventListener('touchstart', this.autoplayFallbackHandler, opts);
  }

  /**
   * Play a satisfying soap-bubble pop sound with droplet resonance.
   *
   * @param {number} pitchShift - Multiplier for the base frequency of the bubble sound.
   * @returns {void}
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
   * Play a gentle bell / chime note.
   *
   * @param {number} scaleIndex - The index in the pentatonic scale array.
   * @param {number} volume - Target volume for the chime.
   * @returns {void}
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
   * Play a soft hover whisper sound effect for UI interaction.
   *
   * @returns {void}
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

  /**
   * Plays the waterdrop scroll-down sound (waterdrop-scroll-down.mp3).
   * Gently fades out at the end for a peaceful, calming sensation.
   *
   * @param {number} volume - Target volume for the sound.
   * @returns {void}
   */
  playWaterdropScrollDown(volume = 0.75): void {
    if (this.isMuted()) return;
    this.initContext();

    if (this.ctx && this.waterdropBuffer) {
      this.playWaterdropBuffer(this.waterdropBuffer, volume);
      return;
    }

    if (this.ctx && this.waterdropArrayBuffer) {
      this.ctx
        .decodeAudioData(this.waterdropArrayBuffer.slice(0))
        .then((decoded) => {
          this.waterdropBuffer = decoded;
          this.playWaterdropBuffer(decoded, volume);
        })
        .catch(() => {
          this.playWaterdropFallback(volume);
        });
      return;
    }

    if (this.waterdropLoadingPromise) {
      this.waterdropLoadingPromise
        .then((buf) => {
          if (buf && this.ctx) {
            this.ctx.decodeAudioData(buf.slice(0)).then((decoded) => {
              this.waterdropBuffer = decoded;
              this.playWaterdropBuffer(decoded, volume);
            });
          } else {
            this.playWaterdropFallback(volume);
          }
        })
        .catch(() => {
          this.playWaterdropFallback(volume);
        });
      return;
    }

    this.playWaterdropFallback(volume);
  }

  /**
   * Play waterdrop sound via Web Audio API with peaceful exponential fade-out at the end
   */
  private playWaterdropBuffer(buffer: AudioBuffer, targetVolume = 0.75): void {
    if (!this.ctx || this.isMuted()) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const duration = buffer.duration;
    // Peaceful fade-out over the final ~0.85 seconds of the sound
    const fadeDuration = Math.min(0.85, duration * 0.5);
    const fadeStart = now + Math.max(0.01, duration - fadeDuration);
    const stopTime = now + duration;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(targetVolume, now);
    gain.gain.setValueAtTime(targetVolume, fadeStart);
    // Smooth exponential ramp down into silence
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    gain.gain.setValueAtTime(0, stopTime);

    source.connect(gain);
    gain.connect(this.sfxGain || this.ctx.destination);

    source.start(now);
    source.stop(stopTime + 0.05);
  }

  /**
   * Fallback using HTMLAudioElement with smooth end fade-out
   */
  private playWaterdropFallback(targetVolume = 0.5): void {
    if (this.isMuted() || typeof window === 'undefined') return;
    const audio = new Audio('/sounds/waterdrop-scroll-down.mp3');
    audio.volume = targetVolume;

    const fadeDuration = 0.85;
    let fadeStarted = false;

    const onTimeUpdate = () => {
      if (!fadeStarted && audio.duration && audio.duration - audio.currentTime <= fadeDuration) {
        fadeStarted = true;
        const startVol = audio.volume;
        const startTime = performance.now();
        const fadeMs = fadeDuration * 1000;

        const fadeStep = () => {
          const elapsed = performance.now() - startTime;
          const progress = Math.min(1, elapsed / fadeMs);
          const factor = Math.pow(1 - progress, 1.8);
          audio.volume = Math.max(0, startVol * factor);

          if (progress < 1 && !audio.paused) {
            requestAnimationFrame(fadeStep);
          }
        };
        requestAnimationFrame(fadeStep);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
    });

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }
  }

  /**
   * Plays the particle orb scroll sound (particle-orb-scroll.mp3) directly and without delay.
   * Leverages pre-decoded Web Audio API AudioBuffer for true 0ms latency playback.
   *
   * @param {number} volume - Target volume for the sound.
   * @returns {void}
   */
  playParticleOrbScroll(volume = 1.0): void {
    if (this.isMuted()) return;
    this.initContext();

    if (this.ctx && this.particleOrbBuffer) {
      this.playParticleOrbBuffer(this.particleOrbBuffer, volume);
      return;
    }

    if (this.ctx && this.particleOrbArrayBuffer) {
      this.ctx
        .decodeAudioData(this.particleOrbArrayBuffer.slice(0))
        .then((decoded) => {
          this.particleOrbBuffer = decoded;
          this.playParticleOrbBuffer(decoded, volume);
        })
        .catch(() => {
          this.playParticleOrbFallback(volume);
        });
      return;
    }

    if (this.particleOrbLoadingPromise) {
      this.particleOrbLoadingPromise
        .then((buf) => {
          if (buf && this.ctx) {
            this.ctx
              .decodeAudioData(buf.slice(0))
              .then((decoded) => {
                this.particleOrbBuffer = decoded;
                this.playParticleOrbBuffer(decoded, volume);
              })
              .catch(() => {
                this.playParticleOrbFallback(volume);
              });
          } else {
            this.playParticleOrbFallback(volume);
          }
        })
        .catch(() => {
          this.playParticleOrbFallback(volume);
        });
      return;
    }

    this.playParticleOrbFallback(volume);
  }

  /**
   * Play pre-decoded particle orb AudioBuffer via Web Audio API with zero latency
   * Connected directly to destination at full fidelity (not dampened by sfxGain)
   */
  private playParticleOrbBuffer(buffer: AudioBuffer, targetVolume = 1.0): void {
    if (!this.ctx || this.isMuted()) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const duration = buffer.duration;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(targetVolume, now);

    source.connect(gain);
    // Connect directly to master destination for clear, loud, crisp presence
    gain.connect(this.ctx.destination);

    source.start(now);
    source.stop(now + duration + 0.05);
  }

  /**
   * Immediate fallback playback using HTMLAudioElement if Web Audio is unavailable
   */
  private playParticleOrbFallback(targetVolume = 1.0): void {
    if (this.isMuted() || typeof window === 'undefined') return;
    const audio = new Audio('/sounds/particle-orb-scroll.mp3');
    audio.volume = Math.min(1.0, Math.max(0, targetVolume));
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }
  }

  /**
   * Plays the waterdrop tone-on sound (waterdrop-tone-on.mp3) directly without delay.
   * Plays at full clarity and fades out calmly at the end.
   *
   * @param {number} volume - Target volume for the sound.
   * @returns {void}
   */
  playWaterdropToneOn(volume = 1.0): void {
    if (this.isMuted()) return;
    this.initContext();

    if (this.ctx && this.waterdropToneOnBuffer) {
      this.playWaterdropToneOnBuffer(this.waterdropToneOnBuffer, volume);
      return;
    }

    // Pre-decode buffer in background for subsequent zero-latency plays
    if (this.waterdropToneOnArrayBuffer && this.ctx && !this.waterdropToneOnBuffer) {
      this.decodeWaterdropToneOnBuffer(this.waterdropToneOnArrayBuffer);
    }

    // Play immediately via HTML5 Audio fallback right now without waiting for async decode
    this.playWaterdropToneOnFallback(volume);
  }

  /**
   * Play pre-decoded waterdrop tone-on AudioBuffer via Web Audio API with 0ms latency.
   * Connected directly to master destination for clear, crisp volume (not dampened by sfxGain),
   * with a peaceful linear ramp decay over the sound tail.
   */
  private playWaterdropToneOnBuffer(buffer: AudioBuffer, targetVolume = 1.0): void {
    if (!this.ctx || this.isMuted()) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const duration = buffer.duration;
    // Calm fade-out across the final 30% of the sound to preserve the full droplet tone
    const fadeDuration = Math.min(0.3, duration * 0.3);
    const fadeStart = now + Math.max(0.01, duration - fadeDuration);
    const stopTime = now + duration;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(targetVolume, now);
    gain.gain.setValueAtTime(targetVolume, fadeStart);
    // Smooth linear ramp down into silence
    gain.gain.linearRampToValueAtTime(0, stopTime);

    source.connect(gain);
    // Direct connection to destination gives full, rich, audible presence
    gain.connect(this.ctx.destination);

    source.start(now);
    source.stop(stopTime + 0.05);
  }

  /**
   * Fallback using HTMLAudioElement with smooth end fade-out
   */
  private playWaterdropToneOnFallback(targetVolume = 1.0): void {
    if (this.isMuted() || typeof window === 'undefined') return;
    const soundUrl =
      window.location.origin &&
      window.location.origin !== 'null' &&
      !window.location.origin.startsWith('about:')
        ? `${window.location.origin}/sounds/waterdrop-tone-on.mp3`
        : '/sounds/waterdrop-tone-on.mp3';

    try {
      const audio = new Audio(soundUrl);
      audio.volume = Math.min(1.0, Math.max(0, targetVolume));
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Fallback playWaterdropToneOn failed:', err);
        });
      }
    } catch (err) {
      console.warn('Could not instantiate Audio for waterdrop-tone-on:', err);
    }
  }

  /**
   * Preload crane folding sound (crane-folding.mp3)
   */
  private preloadCraneFoldingSound(): void {
    const isTestEnv = !!(globalThis as unknown as { process?: { env?: Record<string, string> } })
      ?.process?.env?.['VITEST'];

    if (
      typeof window === 'undefined' ||
      !window.location ||
      window.location.protocol.startsWith('about:') ||
      isTestEnv ||
      this.craneFoldingLoadingPromise
    ) {
      return;
    }

    const soundUrl =
      window.location.origin &&
      window.location.origin !== 'null' &&
      !window.location.origin.startsWith('about:')
        ? `${window.location.origin}/sounds/crane-folding.mp3`
        : '/sounds/crane-folding.mp3';

    try {
      const preAudio = new Audio(soundUrl);
      preAudio.preload = 'auto';
    } catch {
      // Audio element creation may fail in headless test environments
    }

    this.craneFoldingLoadingPromise = fetch(soundUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        this.craneFoldingArrayBuffer = buf;
        if (this.ctx) {
          this.decodeCraneFoldingBuffer(buf);
        }
        return buf;
      })
      .catch((err) => {
        console.warn('Could not preload crane-folding.mp3:', err);
        return null;
      });
  }

  private decodeCraneFoldingBuffer(arrayBuf: ArrayBuffer): void {
    if (!this.ctx || this.craneFoldingBuffer) return;
    this.ctx
      .decodeAudioData(arrayBuf.slice(0))
      .then((decoded) => {
        this.craneFoldingBuffer = decoded;
      })
      .catch((err) => {
        console.warn('decodeAudioData for crane folding sound failed:', err);
      });
  }

  /**
   * Plays the origami crane folding sound (crane-folding.mp3) with an organic, gentle fade-out at the end.
   *
   * @param {number} volume - Target volume for the sound.
   * @returns {void}
   */
  playCraneFolding(volume = 0.85): void {
    if (this.isMuted()) return;
    this.initContext();

    if (this.ctx && this.craneFoldingBuffer) {
      this.playCraneFoldingBuffer(this.craneFoldingBuffer, volume);
      return;
    }

    if (this.craneFoldingArrayBuffer && this.ctx) {
      this.ctx
        .decodeAudioData(this.craneFoldingArrayBuffer.slice(0))
        .then((decoded) => {
          this.craneFoldingBuffer = decoded;
          this.playCraneFoldingBuffer(decoded, volume);
        })
        .catch(() => {
          this.playCraneFoldingFallback(volume);
        });
      return;
    }

    if (this.craneFoldingLoadingPromise) {
      this.craneFoldingLoadingPromise
        .then((buf) => {
          if (buf && this.ctx) {
            this.ctx.decodeAudioData(buf.slice(0)).then((decoded) => {
              this.craneFoldingBuffer = decoded;
              this.playCraneFoldingBuffer(decoded, volume);
            });
          } else {
            this.playCraneFoldingFallback(volume);
          }
        })
        .catch(() => {
          this.playCraneFoldingFallback(volume);
        });
      return;
    }

    this.playCraneFoldingFallback(volume);
  }

  /**
   * Play pre-decoded crane folding AudioBuffer via Web Audio API with a gentle fade-out curve.
   */
  private playCraneFoldingBuffer(buffer: AudioBuffer, targetVolume = 0.85): void {
    if (!this.ctx || this.isMuted()) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const duration = buffer.duration;
    // Smoothly fade out across the final 0.6 seconds (or up to 40% of duration)
    const fadeDuration = Math.min(0.65, duration * 0.45);
    const fadeStart = now + Math.max(0.01, duration - fadeDuration);
    const stopTime = now + duration;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(targetVolume, now);
    gain.gain.setValueAtTime(targetVolume, fadeStart);
    // Smooth exponential ramp down into silence for a soft, natural acoustic fade
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    gain.gain.setValueAtTime(0, stopTime);

    source.connect(gain);
    // Direct connection to master destination for clear, crisp audible presence
    gain.connect(this.ctx.destination);

    source.start(now);
    source.stop(stopTime + 0.05);
  }

  /**
   * Fallback using HTMLAudioElement with smooth end fade-out
   */
  private playCraneFoldingFallback(targetVolume = 0.85): void {
    if (this.isMuted() || typeof window === 'undefined') return;
    const soundUrl =
      window.location.origin &&
      window.location.origin !== 'null' &&
      !window.location.origin.startsWith('about:')
        ? `${window.location.origin}/sounds/crane-folding.mp3`
        : '/sounds/crane-folding.mp3';

    try {
      const audio = new Audio(soundUrl);
      audio.volume = Math.min(1.0, Math.max(0, targetVolume));

      const fadeDuration = 0.65;
      let fadeStarted = false;

      const onTimeUpdate = () => {
        if (!fadeStarted && audio.duration && audio.duration - audio.currentTime <= fadeDuration) {
          fadeStarted = true;
          const startVol = audio.volume;
          const startTime = performance.now();
          const fadeMs = fadeDuration * 1000;

          const fadeStep = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(1, elapsed / fadeMs);
            const factor = Math.pow(1 - progress, 1.8);
            audio.volume = Math.max(0, startVol * factor);

            if (progress < 1 && !audio.paused) {
              requestAnimationFrame(fadeStep);
            }
          };
          requestAnimationFrame(fadeStep);
        }
      };

      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('ended', () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
      });

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Fallback playCraneFolding failed:', err);
        });
      }
    } catch (err) {
      console.warn('Could not instantiate Audio for crane-folding:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Cozy Sanctuary Whale Ambience (/sounds/wale1.mp3 & /sounds/wale2.mp3)
  // ---------------------------------------------------------------------------

  private preloadWhaleSounds(): void {
    const isTestEnv = !!(globalThis as unknown as { process?: { env?: Record<string, string> } })
      ?.process?.env?.['VITEST'];

    if (
      typeof window === 'undefined' ||
      !window.location ||
      window.location.protocol.startsWith('about:') ||
      isTestEnv
    ) {
      return;
    }

    const base =
      window.location.origin &&
      window.location.origin !== 'null' &&
      !window.location.origin.startsWith('about:')
        ? window.location.origin
        : '';

    // Whale 1
    if (!this.whale1LoadingPromise) {
      this.whale1LoadingPromise = fetch(`${base}/sounds/wale1.mp3`)
        .then((res) => (res.ok ? res.arrayBuffer() : null))
        .then((buf) => {
          if (!buf) return null;
          this.whale1ArrayBuffer = buf;
          if (this.ctx) this.decodeWhale1Buffer(buf);
          return buf;
        })
        .catch((err) => {
          console.warn('Could not preload wale1.mp3:', err);
          return null;
        });
    }

    // Whale 2
    if (!this.whale2LoadingPromise) {
      this.whale2LoadingPromise = fetch(`${base}/sounds/wale2.mp3`)
        .then((res) => (res.ok ? res.arrayBuffer() : null))
        .then((buf) => {
          if (!buf) return null;
          this.whale2ArrayBuffer = buf;
          if (this.ctx) this.decodeWhale2Buffer(buf);
          return buf;
        })
        .catch((err) => {
          console.warn('Could not preload wale2.mp3:', err);
          return null;
        });
    }

    // HTMLAudioElement fallbacks
    try {
      this.whale1Audio = new Audio('/sounds/wale1.mp3');
      this.whale1Audio.preload = 'auto';
      this.whale1Audio.volume = 0;

      this.whale2Audio = new Audio('/sounds/wale2.mp3');
      this.whale2Audio.preload = 'auto';
      this.whale2Audio.volume = 0;
    } catch {
      // Audio element creation may be restricted in non-browser env
    }
  }

  private decodeWhale1Buffer(arrayBuf: ArrayBuffer): void {
    if (!this.ctx || this.whale1Buffer) return;
    this.ctx
      .decodeAudioData(arrayBuf.slice(0))
      .then((decoded) => {
        this.whale1Buffer = decoded;
      })
      .catch((err) => {
        console.warn('decodeAudioData for wale1.mp3 failed:', err);
      });
  }

  private decodeWhale2Buffer(arrayBuf: ArrayBuffer): void {
    if (!this.ctx || this.whale2Buffer) return;
    this.ctx
      .decodeAudioData(arrayBuf.slice(0))
      .then((decoded) => {
        this.whale2Buffer = decoded;
      })
      .catch((err) => {
        console.warn('decodeAudioData for wale2.mp3 failed:', err);
      });
  }

  /**
   * Starts the randomized atmospheric whale singing scheduler when the user enters the cozy sanctuary section.
   *
   * @returns {void}
   */
  startSanctuaryWhales(): void {
    if (this.isInSanctuary) return;
    this.isInSanctuary = true;

    if (this.isMuted()) return;
    this.initContext();

    this.clearWhaleTimeout();

    // Natural brief pause before first whale sings (0.4s - 0.8s) so user hears it promptly
    const initialDelay = 400 + Math.random() * 400;
    this.whaleScheduleTimeoutId = window.setTimeout(() => {
      this.triggerNextWhaleSound();
    }, initialDelay);
  }

  /**
   * Stops the sanctuary whale scheduler and smoothly fades out any currently playing whale sound.
   *
   * @returns {void}
   */
  stopSanctuaryWhales(): void {
    this.isInSanctuary = false;
    this.clearWhaleTimeout();
    this.fadeCurrentWhaleOut(1.2);
  }

  /**
   * Pauses whale sounds when audio is globally muted.
   *
   * @returns {void}
   */
  pauseSanctuaryWhales(): void {
    this.clearWhaleTimeout();
    this.fadeCurrentWhaleOut(0.8);
  }

  /**
   * Resumes whale sounds when audio is unmuted and the user is still inside the sanctuary.
   *
   * @returns {void}
   */
  resumeSanctuaryWhales(): void {
    if (!this.isInSanctuary || this.isMuted()) return;
    this.initContext();
    this.clearWhaleTimeout();
    this.whaleScheduleTimeoutId = window.setTimeout(() => {
      this.triggerNextWhaleSound();
    }, 400 + Math.random() * 400);
  }

  private clearWhaleTimeout(): void {
    if (this.whaleScheduleTimeoutId !== null) {
      clearTimeout(this.whaleScheduleTimeoutId);
      this.whaleScheduleTimeoutId = null;
    }
  }

  /**
   * Triggers the playback of a randomly chosen whale sound with organic fade-in and gentle fade-out.
   */
  private triggerNextWhaleSound(): void {
    this.whaleScheduleTimeoutId = null;
    if (!this.isInSanctuary || this.isMuted()) return;

    // Pick between whale 1 and whale 2 (with alternate bias to avoid repetitive loops)
    const pick = Math.random() < (this.lastWhaleIndex === 1 ? 0.75 : 0.25) ? 2 : 1;
    this.lastWhaleIndex = pick;

    const soundUrl = pick === 1 ? '/sounds/wale1.mp3' : '/sounds/wale2.mp3';
    let soundDuration = pick === 1 ? 6.7 : 5.04;

    // 1. Try Web Audio buffer playback (sample-perfect linear ramps)
    const buffer = pick === 1 ? this.whale1Buffer : this.whale2Buffer;
    if (this.ctx && buffer) {
      this.playWhaleWebAudio(buffer);
      soundDuration = buffer.duration;
    } else {
      // 2. Fallback to HTMLAudioElement
      this.playWhaleFallback(soundUrl);
    }

    // Schedule next sound after this one finishes, plus a random ambient pause between 8 and 16 seconds
    const pauseInterval = 8000 + Math.random() * 8000;
    const nextDelay = soundDuration * 1000 + pauseInterval;

    this.whaleScheduleTimeoutId = window.setTimeout(() => {
      if (this.isInSanctuary && !this.isMuted()) {
        this.triggerNextWhaleSound();
      }
    }, nextDelay);
  }

  private playWhaleWebAudio(buffer: AudioBuffer): void {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    // Fade out any currently playing sound cleanly first
    this.fadeCurrentWhaleOut(0.3);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const duration = buffer.duration;

    const fadeInDuration = 1.2;
    const fadeOutDuration = 2.0;
    const targetVol = this.whaleTargetVolume;

    // Envelope: 0 -> targetVol (fadeIn) -> sustain -> 0 (fadeOut)
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(targetVol, now + fadeInDuration);
    const fadeOutStart = Math.max(now + fadeInDuration + 0.1, now + duration - fadeOutDuration);
    gain.gain.setValueAtTime(targetVol, fadeOutStart);
    gain.gain.linearRampToValueAtTime(0.0001, now + duration);

    source.connect(gain);
    gain.connect(this.ctx.destination);

    source.start(now);
    source.stop(now + duration + 0.05);

    this.activeWhaleSource = source;
    this.activeWhaleGain = gain;

    source.onended = () => {
      if (this.activeWhaleSource === source) {
        this.activeWhaleSource = null;
        this.activeWhaleGain = null;
      }
    };
  }

  private playWhaleFallback(soundUrl: string): void {
    this.fadeCurrentWhaleOut(0.3);

    try {
      const audio = new Audio(soundUrl);
      this.activeWhaleAudio = audio;
      audio.volume = 0;

      const playPromise = audio.play();
      if (!playPromise) return;

      playPromise
        .then(() => {
          const fadeInDuration = 1.2;
          const fadeOutDuration = 2.0;
          const targetVol = this.whaleTargetVolume;

          const step = () => {
            if (!this.activeWhaleAudio || this.activeWhaleAudio !== audio) {
              return;
            }

            const curTime = audio.currentTime;
            const dur = audio.duration || (soundUrl.includes('wale1') ? 6.7 : 5.04);
            const timeLeft = Math.max(0, dur - curTime);

            if (timeLeft <= fadeOutDuration) {
              const factor = Math.max(0, timeLeft / fadeOutDuration);
              audio.volume = targetVol * factor;
            } else if (curTime < fadeInDuration) {
              const factor = Math.min(1, curTime / fadeInDuration);
              audio.volume = targetVol * factor;
            } else {
              audio.volume = targetVol;
            }

            if (timeLeft > 0.05 && !audio.ended && !audio.paused) {
              requestAnimationFrame(step);
            } else if (audio.ended || timeLeft <= 0.05) {
              audio.volume = 0;
              audio.pause();
            }
          };
          requestAnimationFrame(step);
        })
        .catch((err) => {
          console.warn('Fallback playWhaleFallback failed:', err);
        });
    } catch (err) {
      console.warn('Could not instantiate Audio for whale sound:', err);
    }
  }

  private fadeCurrentWhaleOut(fadeDurationSeconds = 1.2): void {
    if (this.whaleFadeIntervalId !== null) {
      clearInterval(this.whaleFadeIntervalId);
      this.whaleFadeIntervalId = null;
    }

    // 1. Web Audio ramp-down
    if (this.ctx && this.activeWhaleGain && this.activeWhaleSource) {
      const gainToFade = this.activeWhaleGain;
      const sourceToStop = this.activeWhaleSource;
      this.activeWhaleSource = null;
      this.activeWhaleGain = null;
      try {
        const now = this.ctx.currentTime;
        gainToFade.gain.cancelScheduledValues(now);
        gainToFade.gain.setValueAtTime(Math.max(0.0001, gainToFade.gain.value), now);
        gainToFade.gain.linearRampToValueAtTime(0.0001, now + fadeDurationSeconds);
        sourceToStop.stop(now + fadeDurationSeconds + 0.05);
      } catch {}
    }

    // 2. HTMLAudioElement ramp-down
    if (this.activeWhaleAudio && !this.activeWhaleAudio.paused) {
      const audio = this.activeWhaleAudio;
      this.activeWhaleAudio = null;
      const startVol = audio.volume;
      const steps = 15;
      const stepMs = (fadeDurationSeconds * 1000) / steps;
      let s = 0;

      const fadeTimer = window.setInterval(() => {
        s++;
        const factor = Math.max(0, 1 - s / steps);
        audio.volume = startVol * factor;
        if (s >= steps) {
          clearInterval(fadeTimer);
          audio.pause();
          audio.volume = 0;
          audio.currentTime = 0;
        }
      }, stepMs);
    }
  }
}

