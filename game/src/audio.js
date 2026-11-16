// audio.js — all sound is synthesised with WebAudio: no audio files, so the
// game stays self-contained. Short oscillator and noise envelopes give each
// action its own blip; a very quiet two-note pad hums under play. The bank
// stays silent until the first user gesture, as browsers require.

const MUTE_KEY = 'bloomward_muted';

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.padNodes = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  // Call from any pointer or key handler; safe to call again and again.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // storage is a nicety, never a requirement
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  tone({ freq = 440, end = null, type = 'square', seconds = 0.12, volume = 0.2, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (end !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(30, end), t0 + seconds);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  noise({ seconds = 0.1, volume = 0.15, delay = 0, low = 400, high = 2400 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (low + high) / 2;
    filter.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  shoot() { this.tone({ freq: 720, end: 240, type: 'square', seconds: 0.07, volume: 0.07 }); }
  hit() { this.noise({ seconds: 0.05, volume: 0.08, low: 900, high: 2600 }); }
  pop() {
    this.tone({ freq: 320, end: 90, type: 'triangle', seconds: 0.14, volume: 0.22 });
    this.noise({ seconds: 0.09, volume: 0.1, low: 300, high: 1200 });
  }
  hurt() { this.tone({ freq: 200, end: 70, type: 'sawtooth', seconds: 0.22, volume: 0.22 }); }
  bloomHurt() { this.tone({ freq: 140, end: 60, type: 'sawtooth', seconds: 0.3, volume: 0.25 }); }
  pickup() { this.tone({ freq: 880, end: 1320, type: 'sine', seconds: 0.1, volume: 0.16 }); }
  spit() { this.tone({ freq: 300, end: 520, type: 'sine', seconds: 0.09, volume: 0.08 }); }
  click() { this.tone({ freq: 540, type: 'sine', seconds: 0.05, volume: 0.12 }); }
  upgrade() {
    this.tone({ freq: 523, type: 'sine', seconds: 0.12, volume: 0.18 });
    this.tone({ freq: 659, type: 'sine', seconds: 0.12, volume: 0.18, delay: 0.09 });
    this.tone({ freq: 784, type: 'sine', seconds: 0.2, volume: 0.2, delay: 0.18 });
  }
  waveStart() {
    this.tone({ freq: 392, type: 'triangle', seconds: 0.14, volume: 0.2 });
    this.tone({ freq: 587, type: 'triangle', seconds: 0.22, volume: 0.2, delay: 0.11 });
  }
  gameOver() {
    this.tone({ freq: 392, end: 380, type: 'triangle', seconds: 0.25, volume: 0.2 });
    this.tone({ freq: 330, end: 320, type: 'triangle', seconds: 0.25, volume: 0.2, delay: 0.22 });
    this.tone({ freq: 262, end: 196, type: 'triangle', seconds: 0.5, volume: 0.22, delay: 0.44 });
  }

  startPad() {
    if (!this.ctx || this.padNodes) return;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 1.2);
    const oscA = this.ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 196;
    const oscB = this.ctx.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = 294;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain).connect(gain.gain);
    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(this.master);
    oscA.start();
    oscB.start();
    lfo.start();
    this.padNodes = { gain, oscA, oscB, lfo };
  }

  stopPad() {
    if (!this.ctx || !this.padNodes) return;
    const { gain, oscA, oscB, lfo } = this.padNodes;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    const stopAt = this.ctx.currentTime + 1.5;
    oscA.stop(stopAt);
    oscB.stop(stopAt);
    lfo.stop(stopAt);
    this.padNodes = null;
  }
}
