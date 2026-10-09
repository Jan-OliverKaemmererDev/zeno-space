import { Injectable, inject, signal } from '@angular/core';
import { AudioService } from '../../../../core/services/audio.service';

/**
 * Audio synthesis service for the "Gras-Harmonie" experience.
 * Synthesizes organic wind rustle via Web Audio API noise buffers and
 * triggers melodic pentatonic chimes through AudioService when the wind strokes the grass.
 */
@Injectable()
export class GrasAudioService {
  private readonly coreAudio = inject(AudioService);

  readonly isMuted = signal<boolean>(false);

  private audioCtx: AudioContext | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private lastChimeTime = 0;
  private lastChimeCol = -1;

  /**
   * Initializes Web Audio nodes for real-time wind sound synthesis.
   */
  init(): void {
    if (this.audioCtx) return;
    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      this.audioCtx = new AudioCtxClass();
      this.setupWindSynthesizer();
    } catch (e) {
      console.warn('GrasAudioService Web Audio init skipped:', e);
    }
  }

  /**
   * Creates an organic filtered noise loop for wind rushing sounds.
   */
  private setupWindSynthesizer(): void {
    if (!this.audioCtx) return;

    // Generate 3 seconds of soft pink-style noise
    const bufferSize = this.audioCtx.sampleRate * 3;
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2) * 0.11;
    }

    const noiseSource = this.audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // Resonant bandpass / lowpass filter simulating wind whistling through grass
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, this.audioCtx.currentTime);
    filter.Q.setValueAtTime(1.8, this.audioCtx.currentTime);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    noiseSource.start();

    this.noiseNode = noiseSource;
    this.windFilter = filter;
    this.windGain = gain;
  }

  /**
   * Updates wind audio parameters dynamically based on cursor speed.
   *
   * @param speed - Current cursor velocity magnitude (0.0 to ~5.0)
   */
  updateWindIntensity(speed: number): void {
    if (this.isMuted() || !this.audioCtx || !this.windGain || !this.windFilter) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;
    const normalizedSpeed = Math.min(speed, 4.0);

    // Filter cutoff opens up as wind strengthens
    const targetFreq = 260 + normalizedSpeed * 380;
    // Volume swells with wind
    const targetGain = 0.035 + normalizedSpeed * 0.08;

    this.windFilter.frequency.setTargetAtTime(targetFreq, now, 0.08);
    this.windGain.gain.setTargetAtTime(targetGain, now, 0.08);
  }

  /**
   * Triggers a resonant pentatonic chime note as the wind passes across meadow zones.
   *
   * @param normalizedX - Normalized horizontal field position (-1.0 to 1.0)
   * @param intensity - Intensity of the wind gust (0.0 to 1.0)
   */
  triggerGrassChime(normalizedX: number, intensity: number): void {
    if (this.isMuted()) return;

    const now = performance.now();
    // Throttle chimes to maintain a calming zen pace (min 130ms between notes)
    if (now - this.lastChimeTime < 130) return;

    // Map horizontal field position to 7 pentatonic scale steps (0 to 6)
    const colIndex = Math.min(6, Math.max(0, Math.floor(((normalizedX + 1.0) / 2.0) * 7)));

    // Prevent immediate re-trigger on the same blade sector unless swept fast
    if (colIndex === this.lastChimeCol && now - this.lastChimeTime < 240) return;

    this.lastChimeTime = now;
    this.lastChimeCol = colIndex;

    const chimeVolume = Math.min(0.24, 0.06 + intensity * 0.14);
    this.coreAudio.playChime(colIndex, chimeVolume);
  }

  /**
   * Triggers a circular wind chord when a shockwave or wind pulse is created.
   */
  triggerPulseChord(): void {
    if (this.isMuted()) return;
    this.coreAudio.playChime(0, 0.18);
    setTimeout(() => this.coreAudio.playChime(2, 0.15), 60);
    setTimeout(() => this.coreAudio.playChime(4, 0.16), 130);
  }

  /**
   * Toggles audio mute state.
   */
  toggleMute(): boolean {
    const newState = !this.isMuted();
    this.isMuted.set(newState);

    if (this.windGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.windGain.gain.setTargetAtTime(newState ? 0 : 0.04, now, 0.05);
    }
    return newState;
  }

  /**
   * Cleans up audio nodes on component destruction.
   */
  destroy(): void {
    try {
      if (this.noiseNode) {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
        this.noiseNode = null;
      }
      if (this.audioCtx) {
        this.audioCtx.close();
        this.audioCtx = null;
      }
    } catch {
      // AudioContext already closed or unsupported
    }
  }
}
