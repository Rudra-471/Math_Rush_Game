/**
 * Physical-ish sound synthesis on Web Audio: noise sources, modal (inharmonic) bells, impacts,
 * a generated stereo reverb impulse. No sample files needed.
 */

export interface Buses {
  ctx: AudioContext;
  sfx: GainNode; // dry SFX
  send: GainNode; // reverb send
  music: GainNode;
  amb: GainNode;
}

const noiseCache = new Map<string, AudioBuffer>();

/** White / pink / brown noise buffers (looping-capable). */
export function noiseBuffer(ctx: AudioContext, kind: 'white' | 'pink' | 'brown', seconds = 2): AudioBuffer {
  const key = `${kind}${seconds}`;
  const hit = noiseCache.get(key);
  if (hit) return hit;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
  }
  noiseCache.set(key, buf);
  return buf;
}

/** Stereo impulse response: early reflections + exponential tail. */
export function impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < ctx.sampleRate * 0.012 ? 0.2 : 1);
    }
    for (let k = 0; k < 6; k++) {
      const at = Math.floor(ctx.sampleRate * (0.012 + Math.random() * 0.06));
      d[at] += (Math.random() < 0.5 ? -1 : 1) * 0.6;
    }
  }
  return buf;
}

function env(g: GainNode, t: number, a: number, peak: number, d: number) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function route(b: Buses, node: AudioNode, wet = 0.15, pan = 0) {
  let out: AudioNode = node;
  if (pan) {
    const p = b.ctx.createStereoPanner();
    p.pan.value = pan;
    node.connect(p);
    out = p;
  }
  out.connect(b.sfx);
  if (wet > 0) {
    const s = b.ctx.createGain();
    s.gain.value = wet;
    out.connect(s).connect(b.send);
  }
}

/** Filtered noise burst. */
export function noiseHit(b: Buses, o: { type?: BiquadFilterType; freq: number; q?: number; dur: number; vol: number; attack?: number; sweepTo?: number; kind?: 'white' | 'pink' | 'brown'; wet?: number; pan?: number; delay?: number }) {
  const { ctx } = b;
  const t = ctx.currentTime + (o.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, o.kind ?? 'white');
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq, t);
  if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t + o.dur);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  env(g, t, o.attack ?? 0.004, o.vol, o.dur);
  src.connect(f).connect(g);
  route(b, g, o.wet ?? 0.1, o.pan ?? 0);
  src.start(t, Math.random() * 1.5);
  src.stop(t + (o.attack ?? 0.004) + o.dur + 0.05);
}

/** Modal synthesis: inharmonic partials with individual decays (bells, metal, glass, coins). */
export function modal(b: Buses, o: { freq: number; ratios: number[]; decays: number[]; vol: number; wet?: number; delay?: number; pan?: number; type?: OscillatorType }) {
  const { ctx } = b;
  const t = ctx.currentTime + (o.delay ?? 0);
  const g = ctx.createGain();
  g.gain.value = 1;
  route(b, g, o.wet ?? 0.25, o.pan ?? 0);
  o.ratios.forEach((r, i) => {
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.value = o.freq * r;
    const pg = ctx.createGain();
    env(pg, t, 0.002, o.vol / (1 + i * 0.7), o.decays[i] ?? o.decays[o.decays.length - 1]);
    osc.connect(pg).connect(g);
    osc.start(t);
    osc.stop(t + (o.decays[i] ?? 1) + 0.1);
  });
}

/** Pitched body thump (kick-like) for impacts and landings. */
export function thump(b: Buses, o: { from: number; to: number; dur: number; vol: number; delay?: number; wet?: number }) {
  const { ctx } = b;
  const t = ctx.currentTime + (o.delay ?? 0);
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(o.from, t);
  osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  const g = ctx.createGain();
  env(g, t, 0.003, o.vol, o.dur);
  osc.connect(g);
  route(b, g, o.wet ?? 0.05);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

/** Rich horn tone: detuned saws through a resonant low-pass with vibrato (train horn). */
export function horn(b: Buses, freqs: number[], dur: number, vol: number) {
  const { ctx } = b;
  const t = ctx.currentTime;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  lp.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.06);
  g.gain.setValueAtTime(vol, t + dur - 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lp.connect(g);
  route(b, g, 0.45);
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.5;
  const vibG = ctx.createGain();
  vibG.gain.value = 2.5;
  vib.connect(vibG);
  vib.start(t);
  vib.stop(t + dur);
  for (const f of freqs) {
    for (const det of [-6, 0, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * 0.97, t + dur); // slight doppler drop
      o.detune.value = det;
      vibG.connect(o.frequency);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
}

/** Soft mallet note (marimba/glockenspiel-like) for musical feedback. */
export function mallet(b: Buses, freq: number, vol: number, delay = 0, bright = 1) {
  modal(b, { freq, ratios: [1, 3.9, 9.2 * bright], decays: [0.9, 0.25, 0.08], vol, wet: 0.3, delay });
}
