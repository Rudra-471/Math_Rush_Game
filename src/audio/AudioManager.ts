import { bus } from '@/events/bus';
import { useSettings } from '@/store/settingsStore';
import { useGame } from '@/store/gameStore';
import { game } from '@/game/runtime';
import { inTunnel } from '@/game/loop/step';
import { horn, impulse, mallet, modal, noiseBuffer, noiseHit, thump, type Buses } from './synth';

const SCALE = [0, 2, 3, 5, 7, 9, 10]; // dorian
const n2f = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/**
 * Layered, realistic procedural audio:
 *  - ambience: wind that rises with speed, rail rumble, tunnel resonance, passing-train rumble
 *  - footsteps on ballast / metal roofs synced to the run cadence
 *  - physical SFX (coin bells, impacts, horn, gravel slide) through a reverb space
 *  - a scheduled lo-fi music loop (drums, bass, chords) ducked while questions are read
 */
class AudioManager {
  private b: Buses | null = null;
  private wind?: { f: BiquadFilterNode; g: GainNode };
  private rumble?: { f: BiquadFilterNode; g: GainNode };
  private trainNear?: { f: BiquadFilterNode; g: GainNode };
  private reverbWet!: GainNode;
  private nextNote = 0;
  private step16 = 0;
  private stepPhase = 0;
  private lastTick = 0;
  private wired = false;
  private introBus: GainNode | null = null;
  private introBeat = false;

  unlock() {
    if (!this.b) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      comp.connect(ctx.destination);
      const mk = () => { const g = ctx.createGain(); g.connect(comp); return g; };
      const sfx = mk(), music = mk(), amb = mk();
      const conv = ctx.createConvolver();
      conv.buffer = impulse(ctx, 2.2, 3);
      this.reverbWet = ctx.createGain();
      this.reverbWet.gain.value = 0.5;
      const send = ctx.createGain();
      send.connect(conv).connect(this.reverbWet).connect(comp);
      this.b = { ctx, sfx, send, music, amb };
      this.applyVolumes();
      useSettings.subscribe(() => this.applyVolumes());
      this.startAmbience();
      this.wire();
      this.nextNote = ctx.currentTime + 0.1;
      setInterval(() => this.tick(), 25);
    }
    void this.b.ctx.resume();
  }

  applyVolumes() {
    if (!this.b) return;
    const s = useSettings.getState();
    this.b.music.gain.value = s.music * 0.5;
    this.b.sfx.gain.value = s.sfx * 0.9;
    this.b.amb.gain.value = s.sfx * 0.7;
  }

  duck(on: boolean) {
    if (!this.b) return;
    const s = useSettings.getState();
    this.b.music.gain.setTargetAtTime(s.music * 0.5 * (on ? 0.6 : 1), this.b.ctx.currentTime, 0.12);
  }

  private loop(kind: 'pink' | 'brown', type: BiquadFilterType, freq: number) {
    const { ctx, amb } = this.b!;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, kind, 4);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(amb);
    src.start();
    return { f, g };
  }

  private startAmbience() {
    this.wind = this.loop('pink', 'bandpass', 500);
    this.wind.f.Q.value = 0.6;
    this.rumble = this.loop('brown', 'lowpass', 140);
    this.trainNear = this.loop('brown', 'lowpass', 220);
  }

  /** 25 ms tick: ambience follows the game, footsteps, music scheduling. */
  private tick() {
    const b = this.b;
    if (!b || b.ctx.state !== 'running') return;
    const now = b.ctx.currentTime;
    const dt = Math.min(0.1, now - (this.lastTick || now));
    this.lastTick = now;
    const phase = useGame.getState().phase;
    const rt = game.rt;
    const running = phase === 'RUNNING';
    const speed = running ? rt.speed : phase === 'PAUSED' || phase === 'GAME_OVER' ? 0 : 3;
    const tun = inTunnel(rt);
    const k = 0.08;
    this.wind!.g.gain.setTargetAtTime(0.02 + speed * 0.006, now, k);
    this.wind!.f.frequency.setTargetAtTime(300 + speed * 45, now, k);
    this.rumble!.g.gain.setTargetAtTime(running ? 0.05 + speed * 0.004 + (tun ? 0.12 : 0) : 0.02, now, k);
    this.reverbWet.gain.setTargetAtTime(tun ? 1.4 : 0.5, now, 0.3);
    // nearby trains rumble (louder when an oncoming train closes in)
    let near = 0;
    for (const o of rt.obstacles) {
      if (o.kind !== 'train' && o.kind !== 'movingTrain') continue;
      const dz = Math.max(0, o.s - rt.distance, rt.distance - (o.s + o.len));
      const w = Math.max(0, 1 - dz / (o.kind === 'movingTrain' ? 90 : 25));
      near = Math.max(near, w * (o.kind === 'movingTrain' ? 1 : 0.35));
    }
    this.trainNear!.g.gain.setTargetAtTime(running ? near * 0.35 : 0, now, 0.15);
    this.trainNear!.f.frequency.setTargetAtTime(160 + near * 260, now, 0.15);

    // footsteps synced to the runner's cadence
    if (running && rt.grounded && rt.sliding <= 0) {
      const prev = this.stepPhase;
      this.stepPhase += dt * 8.5 * Math.max(0.45, rt.speed / 12) * rt.timeScale;
      if (Math.floor(prev / Math.PI) !== Math.floor(this.stepPhase / Math.PI)) this.footstep(rt.groundY > 0.5);
    }
    this.scheduleMusic(phase);
  }

  private footstep(metal: boolean) {
    const b = this.b!;
    const pan = (Math.random() - 0.5) * 0.2;
    if (metal) {
      modal(b, { freq: 380 + Math.random() * 60, ratios: [1, 2.32, 4.25], decays: [0.12, 0.08, 0.05], vol: 0.08, wet: 0.1, pan });
      thump(b, { from: 120, to: 60, dur: 0.08, vol: 0.18 });
    } else {
      thump(b, { from: 95, to: 50, dur: 0.07, vol: 0.2 });
      for (let i = 0; i < 3; i++) noiseHit(b, { freq: 1800 + Math.random() * 2400, q: 1.5, dur: 0.04 + Math.random() * 0.04, vol: 0.05, delay: i * 0.012, pan, wet: 0.03 });
    }
  }

  // ---------------- one-shot SFX ----------------
  coin() {
    const f = 2100 + Math.random() * 500;
    modal(this.b!, { freq: f, ratios: [1, 2.76, 5.4, 8.93], decays: [0.45, 0.25, 0.12, 0.06], vol: 0.12, wet: 0.2, pan: (Math.random() - 0.5) * 0.4 });
    modal(this.b!, { freq: f * 1.5, ratios: [1, 2.76], decays: [0.3, 0.1], vol: 0.06, delay: 0.06 });
  }
  correct(streak: number) {
    const root = 72 + Math.min(streak, 12);
    [0, 4, 7, 12].forEach((s, i) => mallet(this.b!, n2f(root + s), 0.18, i * 0.075, 1));
    modal(this.b!, { freq: n2f(root + 24), ratios: [1, 2.01], decays: [1.2, 0.6], vol: 0.05, delay: 0.3, wet: 0.5 });
  }
  wrong() {
    mallet(this.b!, n2f(50), 0.22, 0, 0.6);
    mallet(this.b!, n2f(47), 0.16, 0.14, 0.6);
  }
  jump() {
    noiseHit(this.b!, { freq: 500, sweepTo: 2200, q: 0.8, dur: 0.22, vol: 0.12, attack: 0.03, kind: 'pink' });
    noiseHit(this.b!, { freq: 2600, q: 2, dur: 0.05, vol: 0.06 });
  }
  land() {
    const metal = game.rt.groundY > 0.5;
    thump(this.b!, { from: metal ? 160 : 110, to: 45, dur: 0.16, vol: 0.4 });
    if (metal) modal(this.b!, { freq: 210, ratios: [1, 2.32, 3.9, 5.1], decays: [0.5, 0.3, 0.2, 0.1], vol: 0.12, wet: 0.3 });
    else for (let i = 0; i < 6; i++) noiseHit(this.b!, { freq: 1200 + Math.random() * 3000, q: 1.2, dur: 0.05 + Math.random() * 0.08, vol: 0.06, delay: i * 0.015, wet: 0.05 });
  }
  slide() {
    noiseHit(this.b!, { freq: 1400, sweepTo: 700, q: 0.7, dur: 0.6, vol: 0.18, attack: 0.02, kind: 'white', wet: 0.05 });
    for (let i = 0; i < 10; i++) noiseHit(this.b!, { freq: 2500 + Math.random() * 2500, q: 2, dur: 0.03, vol: 0.04, delay: i * 0.05 });
  }
  whoosh() { noiseHit(this.b!, { freq: 700, sweepTo: 1800, q: 1.2, dur: 0.18, vol: 0.09, attack: 0.04, kind: 'pink' }); }
  crash() {
    const b = this.b!;
    thump(b, { from: 90, to: 30, dur: 0.6, vol: 0.9 });
    noiseHit(b, { type: 'lowpass', freq: 1800, sweepTo: 200, dur: 0.7, vol: 0.6, kind: 'brown', wet: 0.35 });
    modal(b, { freq: 160, ratios: [1, 2.32, 3.9, 5.1, 7.3], decays: [1.4, 0.9, 0.6, 0.4, 0.3], vol: 0.25, wet: 0.5 });
    for (let i = 0; i < 12; i++) noiseHit(b, { freq: 2000 + Math.random() * 4000, q: 3, dur: 0.04, vol: 0.05, delay: 0.15 + Math.random() * 0.5 });
  }
  stumble() {
    thump(this.b!, { from: 130, to: 50, dur: 0.18, vol: 0.45 });
    modal(this.b!, { freq: 320, ratios: [1, 2.4, 4.1], decays: [0.3, 0.2, 0.1], vol: 0.1, wet: 0.2 });
  }
  trainHorn() { horn(this.b!, [311, 370], 1.3, 0.12); }
  power(on: boolean) {
    if (on) {
      noiseHit(this.b!, { freq: 400, sweepTo: 6000, q: 3, dur: 0.5, vol: 0.08, attack: 0.1, kind: 'pink', wet: 0.4 });
      [0, 7, 12, 19].forEach((s, i) => mallet(this.b!, n2f(79 + s), 0.08, 0.05 + i * 0.05, 1.2));
    } else noiseHit(this.b!, { freq: 3000, sweepTo: 400, q: 2, dur: 0.4, vol: 0.06, kind: 'pink', wet: 0.3 });
  }
  ping() { modal(this.b!, { freq: 1568, ratios: [1, 2.4, 5.2], decays: [0.9, 0.3, 0.1], vol: 0.09, wet: 0.45 }); }
  chest() { [0, 4, 7, 11, 12, 16, 19, 24].forEach((s, i) => mallet(this.b!, n2f(72 + s), 0.12, i * 0.06, 1.1)); }
  gameOver() { [0, -3, -7, -12].forEach((s, i) => mallet(this.b!, n2f(67 + s), 0.16, i * 0.18, 0.7)); }

  // ---------------- music: lookahead scheduler, 16th grid ----------------
  private scheduleMusic(phase: string) {
    const b = this.b!;
    const bpm = 112;
    const sixteenth = 60 / bpm / 4;
    while (this.nextNote < b.ctx.currentTime + 0.12) {
      if (phase === 'INTRO') { if (this.introBeat) this.playStep(this.step16, this.nextNote, true); }
      else if (phase !== 'PAUSED') this.playStep(this.step16, this.nextNote, phase === 'RUNNING');
      this.nextNote += sixteenth;
      this.step16 = (this.step16 + 1) % 64;
    }
  }

  private playStep(st: number, t: number, running: boolean) {
    const b = this.b!;
    const { ctx, music } = b;
    const bar = Math.floor(st / 16);
    const roots = [45, 41, 43, 40]; // A F G E
    const root = roots[bar];
    const s = st % 16;
    const voice = (freq: number, type: OscillatorType, dur: number, vol: number, cutoff: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f).connect(g).connect(music);
      o.start(t);
      o.stop(t + dur + 0.05);
    };
    // pad chord every bar
    if (s === 0) for (const iv of [0, 7, 10, 15]) for (const det of [-0.003, 0.003]) voice(n2f(root + 12 + iv) * (1 + det), 'sawtooth', 2.1, 0.022, 900);
    if (!running && s % 8 !== 0) return;
    // bass
    if ([0, 3, 6, 10, 12].includes(s)) voice(n2f(root - 12 + (s === 12 ? 7 : 0)), 'sawtooth', 0.22, 0.12, 420);
    // drums
    if (s === 0 || s === 8 || (running && s === 10)) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(music);
      o.start(t);
      o.stop(t + 0.2);
    }
    const hit = (freq: number, dur: number, vol: number, type: BiquadFilterType) => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, 'white');
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(music);
      src.start(t, Math.random());
      src.stop(t + dur + 0.02);
    };
    if (running && (s === 4 || s === 12)) hit(1800, 0.16, 0.22, 'bandpass');
    if (running && s % 2 === 0) hit(8000, 0.04, s % 4 === 2 ? 0.09 : 0.05, 'highpass');
    // sparse arp lead
    if (running && s % 3 === 0 && Math.random() < 0.6) {
      const n = SCALE[(st * 5) % SCALE.length];
      voice(n2f(root + 24 + n), 'triangle', 0.18, 0.035, 3000);
    }
  }

  private wire() {
    if (this.wired) return;
    this.wired = true;
    bus.on('COIN', () => this.coin());
    bus.on('GATE_SHOWN', () => this.ping());
    bus.on('GATE_PASSED', (e) => (e.correct ? this.correct(e.streak) : this.wrong()));
    bus.on('JUMP', () => this.jump());
    bus.on('LAND', () => this.land());
    bus.on('SLIDE', () => this.slide());
    bus.on('LANE', () => this.whoosh());
    bus.on('HORN', () => this.trainHorn());
    bus.on('HIT', (e) => (e.kind === 'crash' ? this.crash() : this.stumble()));
    bus.on('POWERUP', (e) => this.power(e.on));
    bus.on('TUNNEL', (e) => {
      if (e.phase === 'enter') noiseHit(this.b!, { freq: 300, sweepTo: 120, q: 0.7, dur: 1.2, vol: 0.2, attack: 0.3, kind: 'brown', wet: 0.8 });
      if (e.phase === 'exit' && (e.correct ?? 0) >= 2) this.chest();
    });
    bus.on('RUN_END', () => this.gameOver());
    bus.on('INTRO', (e) => this.introCue(e.cue));
    // skipping / ending the film fades out anything still sounding
    useGame.subscribe((st, prev) => {
      if (prev.phase === 'INTRO' && st.phase !== 'INTRO') this.stopIntro();
    });
  }

  // ---------------- intro film score ----------------
  private pad(notes: number[], start: number, dur: number, vol: number, cutoffFrom: number, cutoffTo: number) {
    const b = this.b!;
    if (!this.introBus) return;
    const t = b.ctx.currentTime + start;
    const f = b.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoffFrom, t);
    f.frequency.exponentialRampToValueAtTime(cutoffTo, t + dur * 0.8);
    f.Q.value = 0.7;
    const g = b.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(3, dur * 0.4));
    g.gain.setValueAtTime(vol, t + dur - 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(g).connect(this.introBus);
    const send = b.ctx.createGain();
    send.gain.value = 0.35;
    g.connect(send).connect(b.send);
    for (const n of notes) for (const det of [-9, 0, 8]) {
      const o = b.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = n2f(n);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  private introCue(cue: string) {
    const b = this.b;
    if (!b) return;
    if (!this.introBus) {
      this.introBus = b.ctx.createGain();
      this.introBus.connect(b.music);
    }
    this.introBus.gain.cancelScheduledValues(b.ctx.currentTime);
    this.introBus.gain.setValueAtTime(1.6, b.ctx.currentTime);
    switch (cue) {
      case 'drone': // dawn: A-minor pad slowly opening + soft sub
        this.introBeat = false;
        this.pad([45, 52, 57, 60], 0, 9.5, 0.035, 300, 1600);
        thump(b, { from: 55, to: 45, dur: 4, vol: 0.15, wet: 0.2 });
        break;
      case 'horn':
        this.trainHorn();
        noiseHit(b, { type: 'lowpass', freq: 120, sweepTo: 600, dur: 2.4, vol: 0.5, attack: 1.4, kind: 'brown', wet: 0.2 });
        break;
      case 'pass': // the express rushes past: doppler whoosh + rail clatter
        noiseHit(b, { freq: 400, sweepTo: 2600, q: 0.6, dur: 0.45, vol: 0.55, attack: 0.25, kind: 'pink', wet: 0.3 });
        noiseHit(b, { freq: 2600, sweepTo: 300, q: 0.6, dur: 1.4, vol: 0.45, delay: 0.5, kind: 'pink', wet: 0.4 });
        for (let i = 0; i < 10; i++) thump(b, { from: 160, to: 70, dur: 0.06, vol: 0.25, delay: 0.15 + i * 0.11 });
        break;
      case 'boom': // hero reveal: cinematic boom + chord change to F
        thump(b, { from: 70, to: 26, dur: 1.8, vol: 0.9, wet: 0.5 });
        noiseHit(b, { type: 'lowpass', freq: 900, sweepTo: 80, dur: 1.6, vol: 0.4, kind: 'brown', wet: 0.7 });
        this.pad([41, 48, 53, 57, 60], 0, 4.4, 0.04, 500, 2400);
        break;
      case 'question':
        [0, 7, 12, 16, 19].forEach((sx, i) => mallet(b, n2f(76 + sx), 0.09, i * 0.07, 1.3));
        break;
      case 'riser':
        noiseHit(b, { freq: 300, sweepTo: 7000, q: 1.5, dur: 0.95, vol: 0.3, attack: 0.85, kind: 'pink', wet: 0.4 });
        this.pad([57, 64], 0, 1.0, 0.03, 600, 6000);
        break;
      case 'go': // drop: hit + the beat comes in
        thump(b, { from: 120, to: 40, dur: 0.5, vol: 0.9 });
        noiseHit(b, { freq: 1800, q: 0.8, dur: 0.4, vol: 0.35, wet: 0.4 });
        this.introBeat = true;
        this.step16 = 0;
        break;
      case 'title': // title card: huge hit, bell chord, long tail
        this.introBeat = false;
        thump(b, { from: 60, to: 22, dur: 2.6, vol: 1, wet: 0.6 });
        noiseHit(b, { type: 'lowpass', freq: 3000, sweepTo: 100, dur: 2.2, vol: 0.5, kind: 'brown', wet: 0.9 });
        [0, 4, 7, 12, 16].forEach((sx) => mallet(b, n2f(72 + sx), 0.12, 0, 1));
        this.pad([48, 55, 60, 64, 67], 0.05, 4.5, 0.045, 2500, 900);
        break;
    }
  }

  private stopIntro() {
    this.introBeat = false;
    const b = this.b;
    if (!b || !this.introBus) return;
    this.introBus.gain.cancelScheduledValues(b.ctx.currentTime);
    this.introBus.gain.setTargetAtTime(0, b.ctx.currentTime, 0.25);
    const old = this.introBus;
    this.introBus = null;
    setTimeout(() => old.disconnect(), 2000);
  }
}

export const audio = new AudioManager();
