// Procedural sound effects via WebAudio — no audio assets required.
export class AudioFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
  }

  // Must be called from a user gesture (click) so the context can start.
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    const len = this.ctx.sampleRate * 1.0;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  _noise({ dur = 0.2, gain = 0.4, freq = 2000, freqEnd = null, Q = 1, type = 'lowpass', delay = 0 }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = Q;
    filter.frequency.setValueAtTime(freq, t);
    if (freqEnd !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  _tone({ freq = 440, freqEnd = null, dur = 0.15, gain = 0.25, type = 'square', delay = 0 }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  shot(kind) {
    if (kind === 'pistol') {
      this._noise({ dur: 0.12, gain: 0.5, freq: 3200, freqEnd: 500 });
      this._tone({ freq: 300, freqEnd: 90, dur: 0.1, gain: 0.35, type: 'triangle' });
    } else if (kind === 'smg') {
      this._noise({ dur: 0.06, gain: 0.35, freq: 5000, freqEnd: 900 });
      this._tone({ freq: 320, freqEnd: 120, dur: 0.05, gain: 0.22, type: 'square' });
    } else if (kind === 'rifle') {
      this._noise({ dur: 0.09, gain: 0.45, freq: 4200, freqEnd: 700 });
      this._tone({ freq: 240, freqEnd: 80, dur: 0.08, gain: 0.3, type: 'sawtooth' });
    } else if (kind === 'dmr') {
      this._noise({ dur: 0.14, gain: 0.55, freq: 3600, freqEnd: 400 });
      this._tone({ freq: 210, freqEnd: 70, dur: 0.12, gain: 0.4, type: 'sawtooth' });
    } else if (kind === 'shotgun') {
      this._noise({ dur: 0.28, gain: 0.7, freq: 2400, freqEnd: 150 });
      this._tone({ freq: 160, freqEnd: 45, dur: 0.25, gain: 0.5, type: 'triangle' });
    } else if (kind === 'lmg') {
      this._noise({ dur: 0.1, gain: 0.5, freq: 3000, freqEnd: 500 });
      this._tone({ freq: 190, freqEnd: 70, dur: 0.09, gain: 0.38, type: 'sawtooth' });
    } else if (kind === 'sniper') {
      this._noise({ dur: 0.4, gain: 0.75, freq: 3200, freqEnd: 120 });
      this._tone({ freq: 140, freqEnd: 40, dur: 0.35, gain: 0.55, type: 'triangle' });
      this._tone({ freq: 1200, freqEnd: 300, dur: 0.08, gain: 0.2, type: 'square' });
    } else if (kind === 'rocket') {
      this._noise({ dur: 0.5, gain: 0.5, freq: 1200, freqEnd: 2600 });
      this._tone({ freq: 90, freqEnd: 50, dur: 0.4, gain: 0.4, type: 'sawtooth' });
    }
  }

  explosion() {
    this._noise({ dur: 0.7, gain: 0.85, freq: 1800, freqEnd: 60 });
    this._tone({ freq: 90, freqEnd: 28, dur: 0.6, gain: 0.6, type: 'triangle' });
    this._noise({ dur: 0.3, gain: 0.4, freq: 4000, freqEnd: 300, type: 'bandpass', Q: 0.7 });
  }

  grenadeThrow() {
    this._noise({ dur: 0.08, gain: 0.2, freq: 2000, type: 'highpass' });
    this._tone({ freq: 500, freqEnd: 300, dur: 0.08, gain: 0.1, type: 'sine' });
  }

  streak() {
    this._tone({ freq: 660, dur: 0.1, gain: 0.25, type: 'square' });
    this._tone({ freq: 880, dur: 0.1, gain: 0.25, type: 'square', delay: 0.1 });
    this._tone({ freq: 1320, dur: 0.2, gain: 0.3, type: 'square', delay: 0.2 });
  }

  empty() {
    this._tone({ freq: 900, dur: 0.05, gain: 0.15, type: 'square' });
  }

  reload(kind) {
    this._noise({ dur: 0.05, gain: 0.25, freq: 3000, type: 'highpass' });
    this._noise({ dur: 0.06, gain: 0.3, freq: 2600, type: 'highpass', delay: kind === 'shotgun' ? 0.25 : 0.35 });
    this._tone({ freq: 1200, freqEnd: 1600, dur: 0.05, gain: 0.12, type: 'square', delay: kind === 'shotgun' ? 0.3 : 0.45 });
  }

  weaponSwitch() {
    this._noise({ dur: 0.05, gain: 0.2, freq: 2500, type: 'highpass' });
    this._tone({ freq: 700, freqEnd: 1100, dur: 0.06, gain: 0.1, type: 'square' });
  }

  hit(headshot) {
    this._tone({ freq: headshot ? 1500 : 1000, freqEnd: headshot ? 2100 : 1300, dur: 0.06, gain: 0.22, type: 'square' });
  }

  kill() {
    this._tone({ freq: 500, freqEnd: 120, dur: 0.3, gain: 0.3, type: 'sawtooth' });
    this._noise({ dur: 0.25, gain: 0.3, freq: 1500, freqEnd: 200 });
  }

  hurt() {
    this._tone({ freq: 140, freqEnd: 60, dur: 0.25, gain: 0.5, type: 'triangle' });
    this._noise({ dur: 0.15, gain: 0.25, freq: 700, freqEnd: 150 });
  }

  jump() {
    this._tone({ freq: 220, freqEnd: 380, dur: 0.12, gain: 0.1, type: 'sine' });
  }

  land() {
    this._noise({ dur: 0.1, gain: 0.2, freq: 500, freqEnd: 120 });
  }

  pickup(kind) {
    const base = kind === 'health' ? 620 : 440;
    this._tone({ freq: base, dur: 0.08, gain: 0.2, type: 'square' });
    this._tone({ freq: base * 1.5, dur: 0.1, gain: 0.2, type: 'square', delay: 0.08 });
  }

  waveStart() {
    this._tone({ freq: 220, dur: 0.14, gain: 0.25, type: 'sawtooth' });
    this._tone({ freq: 330, dur: 0.14, gain: 0.25, type: 'sawtooth', delay: 0.15 });
    this._tone({ freq: 440, dur: 0.25, gain: 0.3, type: 'sawtooth', delay: 0.3 });
  }

  waveClear() {
    this._tone({ freq: 523, dur: 0.12, gain: 0.22, type: 'triangle' });
    this._tone({ freq: 659, dur: 0.12, gain: 0.22, type: 'triangle', delay: 0.12 });
    this._tone({ freq: 784, dur: 0.22, gain: 0.26, type: 'triangle', delay: 0.24 });
  }

  enemyShot() {
    this._tone({ freq: 800, freqEnd: 300, dur: 0.12, gain: 0.14, type: 'sawtooth' });
  }

  gameOver() {
    this._tone({ freq: 440, freqEnd: 80, dur: 1.2, gain: 0.35, type: 'sawtooth' });
    this._noise({ dur: 0.8, gain: 0.3, freq: 1200, freqEnd: 100 });
  }
}
