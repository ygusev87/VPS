// Every sound is synthesised with WebAudio — no audio files to load.
type Ctx = AudioContext;

export class Sfx {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private fanNoise: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private buzz: { osc: OscillatorNode; gain: GainNode } | null = null;
  muted = false;
  /** Called once the audio graph exists, e.g. to route the voice through it. */
  onReady?: (ctx: AudioContext, out: AudioNode) => void;

  /** Must be called from a user gesture (iOS). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      // A gentle limiter, so a whole band playing at once never distorts.
      const limit = this.ctx.createDynamicsCompressor();
      limit.threshold.value = -10;
      limit.knee.value = 8;
      limit.ratio.value = 6;
      limit.attack.value = 0.005;
      limit.release.value = 0.2;
      this.master.connect(limit).connect(this.ctx.destination);
      this.onReady?.(this.ctx, this.master);
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

  /**
   * The band: one shared clock for every musical part. The music box plays the
   * tune; the other instruments follow the chords worked out from that tune
   * (see `SONG_CHORDS`), so together they make music instead of noise. Call
   * every frame with who is playing.
   */
  private bandClock = { t0: 0, grid: 0, mel: 0, step: 0, song: -1, melody: false, running: false };
  /** Called on time for each note a band part plays, to animate it. */
  onBand?: (who: BandVoice, note: number) => void;
  tickBand(on: BandParts, song = 0) {
    const ctx = this.ctx;
    const s = this.bandClock;
    if (!ctx || !this.master) return;
    const running = on.melody || on.tuba || on.maracas || on.bells;
    if (!running) {
      s.running = false;
      return;
    }
    const now = ctx.currentTime;
    const n = song % SONGS.length;
    // A new song, the music box starting, or a long pause: begin from the top.
    if (!s.running || n !== s.song || (on.melody && !s.melody) || s.t0 + s.grid * BEAT < now - 0.5) {
      Object.assign(s, { t0: now + 0.05, grid: 0, mel: 0, step: 0, song: n });
    }
    s.running = true;
    s.melody = on.melody;
    const tune = SONGS[n];
    const ahead = now + 0.25;
    if (on.melody) {
      while (s.t0 + s.mel * BEAT < ahead) {
        const [note, beats] = tune[s.step % tune.length];
        if (note) this.bell(note, s.t0 + s.mel * BEAT - now);
        s.mel += beats;
        s.step++;
      }
    }
    const chords = SONG_CHORDS[n];
    const win = SONG_WINDOW[n];
    const len = SONG_BEATS[n];
    const cue = (who: BandVoice, note: number, at: number) => {
      if (this.onBand) setTimeout(() => this.onBand?.(who, note), Math.max(0, at * 1000));
    };
    while (s.t0 + s.grid * BEAT < ahead) {
      const at = s.t0 + s.grid * BEAT - now;
      const pos = s.grid % len;
      const w = Math.floor(pos / win);
      const inWin = pos - w * win;
      const chord = CHORDS[chords[w % chords.length]];
      const onBeat = Number.isInteger(s.grid);
      const half = Math.round(s.grid * 2);
      if (on.drum && onBeat) {
        if (inWin === 0) this.kick(at);
        else this.snareSoft(at);
        cue('drum', 0, at);
      }
      if (on.tuba && (inWin === 0 || inWin === win - 1)) {
        const pc = inWin === 0 ? chord.tones[0] : chord.tones[2];
        const note = bassNote(pc);
        this.tubaNote(note, at, BEAT * 0.9);
        cue('tuba', note, at);
      }
      if (on.piano && onBeat) {
        const first = inWin === 0;
        for (const pc of chord.tones) {
          this.pianoNote(chordNote(pc), at, first ? 0.55 : 0.32, first ? BEAT * win : BEAT);
          cue('piano', chordNote(pc), at);
        }
      }
      if (on.maracas) {
        this.shaker(at, !onBeat);
        cue('maracas', onBeat ? 0 : 1, at);
      }
      // Bells sparkle on the off-beats; without the music box they also take the beats.
      if (on.bells && (!onBeat || !on.melody)) {
        const k = half % 4;
        const note = bellNote(chord.tones[[0, 1, 2, 1][k]]);
        this.glock(note, at, onBeat ? 0.7 : 1);
        cue('bells', note, at);
      }
      s.grid += 0.5;
    }
  }

  /** Piano key pressed by the child. */
  piano(note: number) {
    this.pianoNote(note, 0, 1, 1.2);
  }

  /** A bell of the bell tree, tapped. */
  bellTap(note: number) {
    this.glock(note, 0, 1.2);
  }

  /** Maracas shaken by hand. */
  shake() {
    this.shaker(0, true);
    this.shaker(0.09, false);
  }

  /** Tuba blown by a tap. */
  tuba(note: number) {
    this.tubaNote(note, 0, 0.5);
  }

  private pianoNote(note: number, at: number, vol: number, dur: number) {
    const f = 440 * 2 ** ((note - 69) / 12);
    this.tone(f, Math.max(0.5, dur), 'triangle', 0.07 * vol, at);
    this.tone(f * 2, 0.3, 'sine', 0.025 * vol, at);
    this.tone(f * 3, 0.12, 'sine', 0.01 * vol, at);
  }

  private glock(note: number, at: number, vol: number) {
    const f = 440 * 2 ** ((note - 69) / 12);
    this.tone(f, 1.3, 'sine', 0.05 * vol, at);
    this.tone(f * 2.76, 0.4, 'sine', 0.018 * vol, at);
    this.tone(f * 5.4, 0.12, 'sine', 0.008 * vol, at);
  }

  private shaker(at: number, accent: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 5200;
    const g = ctx.createGain();
    const v = accent ? 0.16 : 0.07;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (accent ? 0.09 : 0.05));
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.12);
  }

  /** Round brassy bass: a filtered saw with a soft attack. */
  private tubaNote(note: number, at: number, dur: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + at;
    const freq = 440 * 2 ** ((note - 69) / 12);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq * 0.97, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(350, t);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.06);
    f.frequency.exponentialRampToValueAtTime(450, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.04);
    g.gain.setTargetAtTime(0.1, t + 0.05, 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
    this.tone(freq, dur, 'sine', 0.12, at);
  }

  private bell(note: number, at = 0, vol = 1) {
    const f = 440 * 2 ** ((note - 69) / 12);
    this.tone(f, 0.9, 'sine', 0.13 * vol, at);
    this.tone(f * 2, 0.35, 'sine', 0.04 * vol, at);
    this.tone(f * 3.01, 0.12, 'triangle', 0.015 * vol, at);
  }

  /** Xylophone bar: a woody "tok" with a bright ring. */
  xylophone(note: number) {
    const f = 440 * 2 ** ((note - 69) / 12);
    this.tone(f, 1.1, 'sine', 0.22);
    this.tone(f * 4, 0.18, 'sine', 0.05);
    this.tone(f * 10.1, 0.05, 'sine', 0.02);
    this.noise(0.02, 0.12, f * 2);
  }

  /** Snare drum hit: a thump plus a rattle. */
  drum() {
    this.tone(190, 0.18, 'sine', 0.4, 0, 90);
    this.tone(330, 0.07, 'triangle', 0.12, 0, 180);
    this.noise(0.22, 0.35, 2600);
    this.noise(0.08, 0.25, 900);
  }

  private kick(at: number) {
    this.tone(150, 0.16, 'sine', 0.3, at, 70);
    this.noise(0.05, 0.12, 700, at);
  }

  private snareSoft(at: number) {
    this.noise(0.12, 0.18, 2800, at);
    this.tone(300, 0.05, 'triangle', 0.06, at, 200);
  }

  /** Toy car horn: "beep-beep". */
  honk() {
    for (const at of [0, 0.18]) {
      this.tone(520, 0.12, 'square', 0.07, at);
      this.tone(660, 0.12, 'square', 0.05, at);
    }
  }

  /** A lap done: a bright ding. */
  lap() {
    this.tone(1318.5, 0.25, 'sine', 0.1);
    this.tone(1760, 0.35, 'sine', 0.08, 0.08);
  }

  /** Steel ball snapping onto the magnet (or hitting the plate). */
  clank() {
    this.tone(1900, 0.08, 'triangle', 0.08);
    this.tone(2850, 0.05, 'sine', 0.05);
    this.noise(0.03, 0.15, 4200);
  }

  /** A marble rolling into the funnel or past the paddle wheel. */
  marble() {
    const f = 2600 + Math.random() * 900;
    this.tone(f, 0.05, 'sine', 0.05);
    this.tone(f * 1.5, 0.03, 'sine', 0.025, 0.02);
  }

  /** The conveyor press coming down on a box. */
  stamp() {
    this.tone(120, 0.12, 'sine', 0.25, 0, 70);
    this.noise(0.05, 0.2, 900);
    this.noise(0.03, 0.12, 3000, 0.02);
  }

  /** Fresh paint: a little sparkle. */
  paint() {
    this.tone(1760, 0.18, 'sine', 0.06, 0, 2640);
    this.noise(0.12, 0.05, 6000);
  }

  private waterNode: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  /** Pouring water from the mill, 0..~1. */
  setWater(level: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (!this.waterNode) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(ctx);
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1400;
      filter.Q.value = 0.8;
      // A slow wobble makes noise sound like running water.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 6.5;
      const depth = ctx.createGain();
      depth.gain.value = 500;
      lfo.connect(depth).connect(filter.frequency);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.master);
      src.start();
      lfo.start();
      this.waterNode = { gain, filter };
    }
    this.waterNode.gain.gain.setTargetAtTime(Math.min(1, level) * 0.1, ctx.currentTime, 0.2);
  }

  /** Traffic light relay click. */
  tick() {
    this.noise(0.015, 0.2, 1800);
  }

  private engine: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  /** Race car engine, 0..~1.6. */
  setEngine(speed: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (!this.engine) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter).connect(gain).connect(this.master);
      osc.start();
      this.engine = { osc, gain, filter };
    }
    const v = Math.min(1.6, speed);
    this.engine.osc.frequency.setTargetAtTime(55 + v * 70, ctx.currentTime, 0.1);
    this.engine.filter.frequency.setTargetAtTime(300 + v * 500, ctx.currentTime, 0.1);
    this.engine.gain.gain.setTargetAtTime(v > 0.05 ? 0.035 + v * 0.02 : 0, ctx.currentTime, 0.15);
  }

  private sirenNode: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null;
  /** Fire truck siren: a wailing two-tone while on. */
  setSiren(on: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (!this.sirenNode) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 750;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 1.4;
      const depth = ctx.createGain();
      depth.gain.value = 160;
      lfo.connect(depth).connect(osc.frequency);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(this.master);
      osc.start();
      lfo.start();
      this.sirenNode = { osc, lfo, gain };
    }
    this.sirenNode.gain.gain.setTargetAtTime(on ? 0.06 : 0, ctx.currentTime, 0.08);
  }

  /** A dull tap: the instrument has no power. */
  noPower() {
    this.tone(140, 0.09, 'sine', 0.2, 0, 110);
    this.noise(0.03, 0.08, 500);
  }

  /** A cable clip snapping onto the table. */
  clipOn() {
    this.noise(0.02, 0.22, 3200);
    this.tone(2400, 0.025, 'triangle', 0.05);
  }

  /** Soft clack of a push button. */
  press(down: boolean) {
    this.noise(0.025, 0.3, down ? 1800 : 2600);
    this.tone(down ? 900 : 1300, 0.03, 'square', 0.04);
  }
}

/** Seconds per beat for every song. */
const BEAT = 0.3;

export interface BandParts {
  /** A music box plays the tune. */
  melody: boolean;
  drum: boolean;
  piano: boolean;
  tuba: boolean;
  maracas: boolean;
  bells: boolean;
}
export type BandVoice = 'drum' | 'piano' | 'tuba' | 'maracas' | 'bells';

// Music box songs, all traditional / public domain, as [MIDI note, beats]
// (0 is a rest). Order matches SONG_ICONS in parts/extra.ts.
type Tune = [number, number][];
const r = (n: Tune, times: number): Tune => Array.from({ length: times }, () => n).flat();

const TWINKLE: Tune = [
  [72, 1], [72, 1], [79, 1], [79, 1], [81, 1], [81, 1], [79, 2],
  [77, 1], [77, 1], [76, 1], [76, 1], [74, 1], [74, 1], [72, 2],
  ...r([[79, 1], [79, 1], [77, 1], [77, 1], [76, 1], [76, 1], [74, 2]], 2),
  [72, 1], [72, 1], [79, 1], [79, 1], [81, 1], [81, 1], [79, 2],
  [77, 1], [77, 1], [76, 1], [76, 1], [74, 1], [74, 1], [72, 2],
  [0, 2],
];

const MARY: Tune = [
  [76, 1], [74, 1], [72, 1], [74, 1], [76, 1], [76, 1], [76, 2],
  [74, 1], [74, 1], [74, 2], [76, 1], [79, 1], [79, 2],
  [76, 1], [74, 1], [72, 1], [74, 1], [76, 1], [76, 1], [76, 1], [76, 1],
  [74, 1], [74, 1], [76, 1], [74, 1], [72, 4],
  [0, 2],
];

const MACDONALD_LINE: Tune = [[72, 1], [72, 1], [72, 1], [67, 1], [69, 1], [69, 1], [67, 2], [76, 1], [76, 1], [74, 1], [74, 1], [72, 3]];
const MACDONALD: Tune = [...MACDONALD_LINE, [67, 1], ...MACDONALD_LINE, [0, 1], [67, 0.5], [67, 0.5], [72, 1], [72, 1], [72, 1], [67, 0.5], [67, 0.5], [72, 1], [72, 1], [72, 2], [0, 2]];

const ROW: Tune = [
  [72, 1.5], [72, 1.5], [72, 1], [74, 0.5], [76, 1.5],
  [76, 1], [74, 0.5], [76, 1], [77, 0.5], [79, 3],
  ...r([[84, 0.5]], 3), ...r([[79, 0.5]], 3), ...r([[76, 0.5]], 3), ...r([[72, 0.5]], 3),
  [79, 1], [77, 0.5], [76, 1], [74, 0.5], [72, 3],
  [0, 1.5],
];

const LONDON: Tune = [
  [79, 1.5], [81, 0.5], [79, 1], [77, 1], [76, 1], [77, 1], [79, 2],
  [74, 1], [76, 1], [77, 2], [76, 1], [77, 1], [79, 2],
  [79, 1.5], [81, 0.5], [79, 1], [77, 1], [76, 1], [77, 1], [79, 2],
  [74, 2], [79, 2], [76, 1], [72, 3],
  [0, 2],
];

const SPIDER: Tune = [
  [67, 0.5], [72, 1], [72, 0.5], [72, 1], [74, 0.5], [76, 1.5],
  [76, 1], [74, 0.5], [72, 1], [74, 0.5], [76, 1], [72, 2],
  [76, 1.5], [76, 0.5], [77, 1], [79, 2],
  [79, 1], [77, 0.5], [76, 1], [77, 0.5], [79, 1], [76, 2],
  [72, 1.5], [72, 0.5], [74, 1], [76, 2],
  [76, 1], [74, 0.5], [72, 1], [74, 0.5], [76, 1], [72, 2],
  [0, 2],
];

const JINGLE_HALF: Tune = [[76, 1], [76, 1], [76, 2], [76, 1], [76, 1], [76, 2], [76, 1], [79, 1], [72, 1.5], [74, 0.5], [76, 4], [77, 1], [77, 1], [77, 1.5], [77, 0.5], [77, 1], [76, 1], [76, 1], [76, 0.5], [76, 0.5]];
const JINGLE: Tune = [
  ...JINGLE_HALF, [76, 1], [74, 1], [74, 1], [76, 1], [74, 2], [79, 2],
  ...JINGLE_HALF, [79, 1], [79, 1], [77, 1], [74, 1], [72, 4],
  [0, 2],
];

const JACQUES: Tune = [
  ...r([[72, 1], [74, 1], [76, 1], [72, 1]], 2),
  ...r([[76, 1], [77, 1], [79, 2]], 2),
  ...r([[79, 0.5], [81, 0.5], [79, 0.5], [77, 0.5], [76, 1], [72, 1]], 2),
  ...r([[72, 1], [67, 1], [72, 2]], 2),
  [0, 2],
];

/** Twinkle Twinkle, Mary Had a Little Lamb, Old MacDonald, Row Your Boat, London Bridge, Itsy Bitsy Spider, Jingle Bells, Frère Jacques. */
export const SONGS: Tune[] = [TWINKLE, MARY, MACDONALD, ROW, LONDON, SPIDER, JINGLE, JACQUES];

/** Beats per chord: two for most songs, three for the rocking Row Your Boat. */
export const SONG_WINDOW = SONGS.map((t) => (t === ROW ? 3 : 2));
export const SONG_BEATS = SONGS.map((t) => t.reduce((sum, [, b]) => sum + b, 0));

/** The chords every song uses: C, F, G and A minor (pitch classes, root first). */
export const CHORDS = [
  { name: 'C', tones: [0, 4, 7] },
  { name: 'F', tones: [5, 9, 0] },
  { name: 'G', tones: [7, 11, 2] },
  { name: 'Am', tones: [9, 0, 4] },
];

/**
 * A chord for every window of the tune: the one whose notes the melody spends
 * the most time on (the first note of a window counts double). Ties keep the
 * previous chord, else go to the first in CHORDS order.
 */
export function chordsOf(tune: Tune, win: number): number[] {
  const total = tune.reduce((sum, [, b]) => sum + b, 0);
  const windows = Math.ceil(total / win - 1e-6);
  const score = Array.from({ length: windows }, () => CHORDS.map(() => 0));
  let beat = 0;
  for (const [note, beats] of tune) {
    if (note) {
      // Spread the note over the windows it covers.
      for (let b = beat; b < beat + beats - 1e-6; b += 0.5) {
        const w = Math.floor(b / win + 1e-6);
        const first = Math.abs(b - w * win) < 1e-6 ? 2 : 1;
        CHORDS.forEach((c, i) => {
          if (c.tones.includes(note % 12)) score[w][i] += 0.5 * first;
        });
      }
    }
    beat += beats;
  }
  const out: number[] = [];
  let prev = 0;
  for (let w = 0; w < windows; w++) {
    const sc = score[w];
    let best = prev;
    for (let i = 0; i < CHORDS.length; i++) if (sc[i] > sc[best] + 1e-6) best = i;
    out.push(best);
    prev = best;
  }
  // Songs come home to C.
  out[out.length - 1] = 0;
  return out;
}

export const SONG_CHORDS = SONGS.map((t, i) => chordsOf(t, SONG_WINDOW[i]));

/** Bass range G2–F#3, piano C4–B4, bells C6–B6. */
const bassNote = (pc: number) => 43 + ((pc - 7 + 12) % 12);
const chordNote = (pc: number) => 60 + pc;
const bellNote = (pc: number) => 84 + pc;
