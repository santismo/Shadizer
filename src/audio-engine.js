import { prepareAudioFile } from './wav-utils.js';

export class AudioEngine extends EventTarget {
  constructor(audioElement) {
    super();
    this.audio = audioElement;
    this.context = null;
    this.mediaSource = null;
    this.analysisGain = null;
    this.analyser = null;
    this.outputGain = null;
    this.fileUrl = null;
    this.frequencyData = null;
    this.timeData = null;
    this.smoothedEnergy = { bass: 0, mid: 0, high: 0, level: 0 };
    this.runningBass = 0.01;
    this.lastBeatAt = 0;
    this.reactivity = 1;
    this._wireElementEvents();
  }

  _wireElementEvents() {
    ['play', 'pause', 'ended', 'durationchange', 'timeupdate', 'error'].forEach((type) => {
      this.audio.addEventListener(type, () => this.dispatchEvent(new CustomEvent(type)));
    });
  }

  async ensureContext() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Web Audio is not supported by this browser.');

      this.context = new AudioContextClass({ latencyHint: 'playback' });
      this.mediaSource = this.context.createMediaElementSource(this.audio);
      this.analysisGain = this.context.createGain();
      this.outputGain = this.context.createGain();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.72;

      this.mediaSource.connect(this.outputGain);
      this.outputGain.connect(this.context.destination);
      this.mediaSource.connect(this.analysisGain);
      this.analysisGain.connect(this.analyser);

      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.fftSize);
      this.setReactivity(this.reactivity);
      this.dispatchEvent(new CustomEvent('ready'));
    }

    if (this.context.state === 'suspended') await this.context.resume();
    return this.context;
  }

  async loadFile(file) {
    if (!file) return;
    await this.ensureContext();
    this.audio.pause();
    if (this.fileUrl) URL.revokeObjectURL(this.fileUrl);
    let prepared = { blob: file, normalized: false, sourceBits: null };
    try {
      prepared = await prepareAudioFile(file);
    } catch (error) {
      console.warn('WAV normalization was skipped.', error);
    }
    this.fileUrl = URL.createObjectURL(prepared.blob);
    this.audio.src = this.fileUrl;
    this.audio.load();
    this.dispatchEvent(new CustomEvent('trackchange', {
      detail: { file, name: file.name, normalized: prepared.normalized, sourceBits: prepared.sourceBits },
    }));

    try {
      await this.play();
      return { playing: true, needsGesture: false, ...prepared };
    } catch (error) {
      if (error?.name === 'NotAllowedError') {
        return { playing: false, needsGesture: true, ...prepared };
      }
      throw error;
    }
  }

  async play() {
    await this.ensureContext();
    await this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  async toggle() {
    if (!this.audio.src) return false;
    if (this.audio.paused) await this.play();
    else this.pause();
    return !this.audio.paused;
  }

  seek(fraction) {
    if (!Number.isFinite(this.audio.duration)) return;
    this.audio.currentTime = Math.max(0, Math.min(1, fraction)) * this.audio.duration;
  }

  setReactivity(value) {
    this.reactivity = Number(value);
    if (this.analysisGain) {
      const mapped = Math.pow(this.reactivity, 1.35);
      this.analysisGain.gain.setTargetAtTime(mapped, this.context.currentTime, 0.04);
    }
  }

  getAnalysisNode() {
    return this.analysisGain;
  }

  sample() {
    if (!this.analyser || !this.frequencyData) {
      return { bass: 0, mid: 0, high: 0, level: 0, beat: false };
    }

    this.analyser.getByteFrequencyData(this.frequencyData);
    const nyquist = this.context.sampleRate / 2;
    const binHz = nyquist / this.frequencyData.length;
    const averageBand = (minHz, maxHz) => {
      const start = Math.max(0, Math.floor(minHz / binHz));
      const end = Math.min(this.frequencyData.length, Math.ceil(maxHz / binHz));
      let total = 0;
      for (let index = start; index < end; index += 1) total += this.frequencyData[index];
      return end > start ? total / (end - start) / 255 : 0;
    };

    const next = {
      bass: averageBand(35, 180),
      mid: averageBand(180, 2400),
      high: averageBand(2400, 11000),
    };
    next.level = next.bass * 0.48 + next.mid * 0.34 + next.high * 0.18;

    const smoothing = 0.28;
    for (const key of ['bass', 'mid', 'high', 'level']) {
      this.smoothedEnergy[key] += (next[key] - this.smoothedEnergy[key]) * smoothing;
    }

    this.runningBass = this.runningBass * 0.965 + next.bass * 0.035;
    const now = performance.now();
    const beat = next.bass > Math.max(0.18, this.runningBass * 1.38) && now - this.lastBeatAt > 280;
    if (beat) this.lastBeatAt = now;
    return { ...this.smoothedEnergy, beat };
  }

  destroy() {
    if (this.fileUrl) URL.revokeObjectURL(this.fileUrl);
    this.audio.pause();
    this.context?.close();
  }
}
