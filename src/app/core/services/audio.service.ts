import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private ctx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientOscillators: OscillatorNode[] = [];
  
  // Signals for state
  readonly isMuted = signal<boolean>(true);
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
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Ambient gain node
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.ambientGain.connect(this.ctx.destination);

      // SFX gain node
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.sfxGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound(): void {
    this.initContext();
    const nextMuted = !this.isMuted();
    this.isMuted.set(nextMuted);

    if (nextMuted) {
      this.stopAmbient();
    } else {
      this.startAmbient();
      this.playChime(4); // Play a pleasant welcome chime
    }
  }

  startAmbient(): void {
    if (this.isMuted()) return;
    this.initContext();
    if (!this.ctx || !this.ambientGain || this.isAmbientPlaying()) return;

    // Cozy celestial chord (Cmaj9 / Fmaj9 warm drone)
    const freqs = [130.81, 196.00, 246.94, 329.63]; // C3, G3, B3, E4
    this.ambientOscillators = [];

    // Filter for warm cozy muffled sound
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, this.ctx.currentTime);
    filter.connect(this.ambientGain);

    freqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      // Subtle detune for dreamy shimmer
      osc.detune.setValueAtTime((idx - 1.5) * 4, this.ctx.currentTime);

      oscGain.gain.setValueAtTime(0.04 / freqs.length, this.ctx.currentTime);
      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start();
      this.ambientOscillators.push(osc);
    });

    // Fade in
    this.ambientGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, this.ctx.currentTime);
    this.ambientGain.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 3);

    this.isAmbientPlaying.set(true);
  }

  stopAmbient(): void {
    if (!this.ctx || !this.ambientGain || !this.isAmbientPlaying()) return;

    // Fade out
    this.ambientGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, this.ctx.currentTime);
    this.ambientGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.2);

    setTimeout(() => {
      this.ambientOscillators.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // ignore already stopped
        }
      });
      this.ambientOscillators = [];
      this.isAmbientPlaying.set(false);
    }, 1300);
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
