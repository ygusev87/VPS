// Every sound is synthesised with WebAudio — no audio files to load.
type Ctx = AudioContext;

export class Sfx {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private fanNoise: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private buzz: { osc: OscillatorNode; gain: GainNode } | null = null;
  muted = false;

  /** Must be called from a user gesture (iOS). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, at = 0, slideTo?: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, at = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private nb: AudioBuffer | null = null;
  private noiseBuffer(ctx: Ctx) {
    if (!this.nb) {
      this.nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = this.nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.nb;
  }

  pickup() {
    this.tone(420, 0.12, 'sine', 0.18, 0, 640);
  }
  drop() {
    this.tone(180, 0.14, 'sine', 0.25, 0, 110);
    this.noise(0.06, 0.08, 900);
  }
  wireStart() {
    this.tone(660, 0.08, 'triangle', 0.12);
  }
  snap() {
    this.noise(0.04, 0.35, 3800);
    this.tone(1320, 0.07, 'square', 0.06);
    this.tone(990, 0.1, 'triangle', 0.15, 0.03);
  }
  unsnap() {
    this.tone(520, 0.12, 'triangle', 0.15, 0, 260);
  }
  click() {
    this.noise(0.03, 0.4, 2500);
    this.tone(1800, 0.03, 'square', 0.05);
  }
  ting() {
    this.tone(1568, 0.5, 'sine', 0.12);
    this.tone(2093, 0.6, 'sine', 0.06, 0.05);
  }
  whir() {
    this.tone(200, 0.4, 'sawtooth', 0.05, 0, 520);
  }
  alarm() {
    for (let i = 0; i < 3; i++) this.tone(300, 0.14, 'sawtooth', 0.12, i * 0.18, 220);
  }
  pop() {
    this.tone(880, 0.1, 'sine', 0.2, 0, 1400);
  }
  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.22, i * 0.11));
    this.tone(1318.5, 0.8, 'sine', 0.12, 0.48);
    this.tone(1568, 0.9, 'sine', 0.1, 0.52);
  }
  star() {
    this.tone(1046.5, 0.25, 'sine', 0.15);
    this.tone(1568, 0.4, 'sine', 0.12, 0.08);
  }

  /** Continuous fan whoosh, 0..1. */
  setFan(level: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (!this.fanNoise) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(ctx);
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.master);
      src.start();
      this.fanNoise = { src, gain, filter };
    }
    const l = Math.min(1, level);
    this.fanNoise.gain.gain.setTargetAtTime(l * 0.09, ctx.currentTime, 0.15);
    this.fanNoise.filter.frequency.setTargetAtTime(300 + l * 900, ctx.currentTime, 0.2);
  }

  /** Buzzer part: beep-beep while on. */
  setBuzzer(on: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (!this.buzz) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 1760;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(this.master);
      osc.start();
      this.buzz = { osc, gain };
    }
    const g = this.buzz.gain.gain;
    g.cancelScheduledValues(ctx.currentTime);
    if (on) {
      // Schedule a few seconds of beeps; refreshed while the buzzer stays on.
      const t0 = ctx.currentTime;
      g.setValueAtTime(0, t0);
      for (let i = 0; i < 20; i++) {
        const t = t0 + i * 0.3;
        g.setValueAtTime(0.05, t);
        g.setValueAtTime(0, t + 0.16);
      }
    } else {
      g.setValueAtTime(0, ctx.currentTime);
    }
  }
}
