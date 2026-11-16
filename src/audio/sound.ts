// ─────────────────────────────────────────────────────────────
// 배경음악 + 효과음: 오디오 파일 없이 Web Audio API 로 실시간 합성
//  - 저작권 걱정 없음, 추가 다운로드 0KB
//  - 브라우저 정책상 첫 클릭(입장하기) 이후에만 소리가 납니다.
//  - 낮: 경쾌한 오리지널 칩튠 루프 / 크리스마스: 징글벨(퍼블릭 도메인) 편곡
// ─────────────────────────────────────────────────────────────

export interface AudioSettings {
  muted: boolean;
  music: number; // 0..1
  sfx: number; // 0..1
}

const KEY = 'mstc.audio';
const listeners = new Set<(s: AudioSettings) => void>();

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { muted: !!s.muted, music: clamp01(s.music ?? 0.55), sfx: clamp01(s.sfx ?? 0.8) };
    }
  } catch {
    /* ignore */
  }
  return { muted: false, music: 0.55, sfx: 0.8 };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number(v) || 0));
let settings = loadSettings();

let ctx: AudioContext | null = null;
let master: GainNode;
let musicBus: GainNode;
let sfxBus: GainNode;
let noiseBuf: AudioBuffer;
let song: 'day' | 'xmas' | null = null;
let songBus: GainNode | null = null;
let nextLoopAt = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let musicWanted = false;

export function getAudioSettings() {
  return settings;
}

export function onAudioSettings(fn: (s: AudioSettings) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setAudioSettings(patch: Partial<AudioSettings>) {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
  applyVolumes();
  listeners.forEach((f) => f(settings));
}

function applyVolumes() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.muted ? 0 : 1, t, 0.05);
  musicBus.gain.setTargetAtTime(settings.music * 0.55, t, 0.05);
  sfxBus.gain.setTargetAtTime(settings.sfx * 0.9, t, 0.05);
}

/** 사용자 클릭 안에서 호출해야 함 */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    // 살짝 압축해서 소리 크기를 고르게
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.connect(master);
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.connect(comp);
    sfxBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

// ── 악기 ──
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function env(g: GainNode, t: number, peak: number, attack: number, dur: number, release = 0.06) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setTargetAtTime(peak * 0.55, t + attack, dur * 0.4);
  g.gain.setTargetAtTime(0.0001, t + dur, release);
}

function tone(out: AudioNode, type: OscillatorType, freq: number, t: number, dur: number, vol: number, opts: { attack?: number; release?: number; slideTo?: number; detune?: number; lp?: number } = {}) {
  const c = ctx!;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur);
  if (opts.detune) o.detune.value = opts.detune;
  const g = c.createGain();
  env(g, t, vol, opts.attack ?? 0.005, dur, opts.release ?? 0.05);
  let node: AudioNode = o;
  if (opts.lp) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = opts.lp;
    o.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + dur + (opts.release ?? 0.05) * 6);
}

function noise(out: AudioNode, t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 1) {
  const c = ctx!;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(out);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

function kick(out: AudioNode, t: number, vol = 0.55) {
  tone(out, 'sine', 150, t, 0.14, vol, { slideTo: 42, release: 0.04 });
}
const snare = (out: AudioNode, t: number) => {
  noise(out, t, 0.14, 0.22, 'bandpass', 1900, 0.7);
  tone(out, 'triangle', 220, t, 0.06, 0.12, { slideTo: 160 });
};
const hat = (out: AudioNode, t: number, v = 0.07) => noise(out, t, 0.035, v, 'highpass', 7500);
const bell = (out: AudioNode, t: number, midi: number, vol: number) => {
  tone(out, 'sine', hz(midi), t, 0.5, vol, { release: 0.25 });
  tone(out, 'sine', hz(midi) * 2.76, t, 0.25, vol * 0.25, { release: 0.1 });
};

// ── 곡 데이터 ──
type Note = [beat: number, dur: number, midi: number];

/** 낮: 오리지널 경쾌한 루프 (C - G - Am - F, 128 BPM, 8마디) */
const DAY = (() => {
  const bpm = 128;
  const chords = [
    [48, 60, 64, 67],
    [43, 59, 62, 67],
    [45, 60, 64, 69],
    [41, 60, 65, 69],
  ];
  const melA: (number | null)[] = [76, 79, 84, 79, 81, 79, 76, 74, 74, 79, 83, 79, 81, 83, 86, 83, 84, 83, 81, 76, 81, 83, 84, 88, 86, 84, 81, 77, 79, 81, 83, 79];
  const melB: (number | null)[] = [76, null, 79, 76, 72, 74, 76, null, 74, null, 79, 74, 71, 72, 74, null, 72, 76, 81, 76, 72, 76, 81, 84, 81, 77, 74, 72, 74, null, null, null];
  const lead: Note[] = [];
  [melA, melB].forEach((mel, half) =>
    mel.forEach((m, i) => {
      if (m !== null) lead.push([half * 16 + i * 0.5, 0.42, m]);
    }),
  );
  const bass: Note[] = [];
  const pad: Note[] = [];
  for (let bar = 0; bar < 8; bar++) {
    const ch = chords[bar % 4];
    for (let e = 0; e < 8; e++) bass.push([bar * 4 + e * 0.5, 0.4, e % 2 ? ch[0] + 12 : ch[0]]);
    for (const off of [0.5, 1.5, 2.5, 3.5]) for (const n of ch.slice(1)) pad.push([bar * 4 + off, 0.22, n]);
  }
  return { bpm, beats: 32, lead, bass, pad, bells: false };
})();

/** 크리스마스: Jingle Bells 후렴 (퍼블릭 도메인, 1857) */
const XMAS = (() => {
  const bpm = 140;
  const E = 76;
  const G = 79;
  const C = 72;
  const D = 74;
  const F = 77;
  const mel: Note[] = [];
  let b = 0;
  const add = (m: number, d: number) => {
    mel.push([b, d * 0.9, m]);
    b += d;
  };
  for (let rep = 0; rep < 2; rep++) {
    add(E, 1); add(E, 1); add(E, 2);
    add(E, 1); add(E, 1); add(E, 2);
    add(E, 1); add(G, 1); add(C, 1.5); add(D, 0.5);
    add(E, 4);
    add(F, 1); add(F, 1); add(F, 1.5); add(F, 0.5);
    add(F, 1); add(E, 1); add(E, 1); add(E, 0.5); add(E, 0.5);
    if (rep === 0) {
      add(E, 1); add(D, 1); add(D, 1); add(E, 1);
      add(D, 2); add(G, 2);
    } else {
      add(G, 1); add(G, 1); add(F, 1); add(D, 1);
      add(C, 4);
    }
  }
  const chordFor = [48, 48, 48, 48, 53, 48, 43, 43, 48, 48, 48, 48, 53, 48, 43, 48];
  const tri: Record<number, number[]> = { 48: [64, 67, 72], 53: [65, 69, 72], 43: [62, 67, 71] };
  const bass: Note[] = [];
  const pad: Note[] = [];
  chordFor.forEach((r, bar) => {
    bass.push([bar * 4, 0.9, r], [bar * 4 + 1, 0.4, r + 7], [bar * 4 + 2, 0.9, r + 12], [bar * 4 + 3, 0.4, r + 7]);
    for (const off of [1, 3]) for (const n of tri[r]) pad.push([bar * 4 + off, 0.3, n]);
  });
  return { bpm, beats: 64, lead: mel, bass, pad, bells: true };
})();

function scheduleLoop(bus: GainNode, s: typeof DAY, t0: number) {
  const spb = 60 / s.bpm;
  for (const [b, d, m] of s.lead) {
    const t = t0 + b * spb;
    if (s.bells) {
      bell(bus, t, m + 12, 0.07);
      tone(bus, 'triangle', hz(m), t, d * spb, 0.12, { lp: 3000 });
    } else {
      tone(bus, 'square', hz(m), t, d * spb, 0.055, { lp: 2600 });
      tone(bus, 'triangle', hz(m + 12), t, d * spb * 0.6, 0.03);
    }
  }
  for (const [b, d, m] of s.bass) tone(bus, 'triangle', hz(m), t0 + b * spb, d * spb, 0.2);
  for (const [b, d, m] of s.pad) tone(bus, s.bells ? 'sine' : 'triangle', hz(m), t0 + b * spb, d * spb, 0.035);
  // 드럼
  const steps = s.beats * 2;
  for (let i = 0; i < steps; i++) {
    const t = t0 + i * 0.5 * spb;
    const beat = i / 2;
    if (i % 2 === 0) {
      if (beat % 2 === 0) kick(bus, t, s.bells ? 0.35 : 0.5);
      else snare(bus, t);
    }
    if (s.bells) noise(bus, t, 0.08, 0.05, 'highpass', 6500); // 썰매 방울
    else hat(bus, t, i % 2 ? 0.05 : 0.08);
  }
  return s.beats * spb;
}

function tick() {
  if (!ctx || !songBus || !song) return;
  const s = song === 'xmas' ? XMAS : DAY;
  while (nextLoopAt - ctx.currentTime < 1.5) {
    nextLoopAt += scheduleLoop(songBus, s, nextLoopAt);
  }
}

/** 배경음악 시작/전환 (같은 곡이면 그대로) */
export function playMusic(which: 'day' | 'xmas') {
  musicWanted = true;
  if (!ctx) return;
  if (song === which && songBus) return;
  const now = ctx.currentTime;
  if (songBus) {
    const old = songBus;
    old.gain.setTargetAtTime(0, now, 0.25);
    setTimeout(() => old.disconnect(), 8000);
  }
  song = which;
  songBus = ctx.createGain();
  songBus.gain.setValueAtTime(0, now);
  songBus.gain.setTargetAtTime(1, now + 0.1, 0.4);
  songBus.connect(musicBus);
  nextLoopAt = now + 0.15;
  tick();
  if (!timer) timer = setInterval(tick, 250);
}

export function isMusicWanted() {
  return musicWanted;
}

// ── 효과음 ──
function sfxOut() {
  if (!ctx || settings.muted || settings.sfx <= 0) return null;
  return { c: ctx, out: sfxBus as AudioNode, t: ctx.currentTime + 0.005 };
}

export const sfx = {
  click() {
    const s = sfxOut();
    if (s) tone(s.out, 'sine', 1100, s.t, 0.04, 0.12, { slideTo: 800 });
  },
  enter() {
    const s = sfxOut();
    if (!s) return;
    [72, 76, 79, 84].forEach((m, i) => tone(s.out, 'triangle', hz(m), s.t + i * 0.07, 0.18, 0.18));
    noise(s.out, s.t, 0.5, 0.08, 'bandpass', 3000, 0.5);
  },
  step() {
    const s = sfxOut();
    if (s) noise(s.out, s.t, 0.05, 0.12, 'lowpass', 500 + Math.random() * 250);
  },
  jump() {
    const s = sfxOut();
    if (s) tone(s.out, 'square', 280, s.t, 0.16, 0.07, { slideTo: 720, lp: 2500 });
  },
  land() {
    const s = sfxOut();
    if (s) noise(s.out, s.t, 0.08, 0.15, 'lowpass', 300);
  },
  emote(id: 'wave' | 'jump' | 'dance') {
    const s = sfxOut();
    if (!s) return;
    const seq = id === 'wave' ? [84, 88, 91] : id === 'jump' ? [72, 79, 84, 91, 96] : [67, 71, 74, 79, 74, 79];
    seq.forEach((m, i) => tone(s.out, 'triangle', hz(m), s.t + i * (id === 'dance' ? 0.11 : 0.07), 0.14, 0.14));
    if (id === 'jump') noise(s.out, s.t + 0.25, 0.35, 0.06, 'highpass', 6000);
  },
  teleport() {
    const s = sfxOut();
    if (!s) return;
    tone(s.out, 'sine', 220, s.t, 0.4, 0.15, { slideTo: 1400 });
    tone(s.out, 'triangle', 330, s.t + 0.05, 0.35, 0.08, { slideTo: 1760 });
    noise(s.out, s.t, 0.45, 0.07, 'bandpass', 2500, 0.6);
  },
  xmasOn() {
    const s = sfxOut();
    if (!s) return;
    [91, 88, 84, 88, 91, 96].forEach((m, i) => bell(s.out, s.t + i * 0.09, m, 0.12));
    for (let i = 0; i < 8; i++) noise(s.out, s.t + i * 0.06, 0.07, 0.06, 'highpass', 7000);
  },
  xmasOff() {
    const s = sfxOut();
    if (!s) return;
    [84, 88, 91].forEach((m, i) => tone(s.out, 'triangle', hz(m), s.t + i * 0.08, 0.2, 0.12));
  },
  golfHit(power: number) {
    const s = sfxOut();
    if (!s) return;
    noise(s.out, s.t, 0.06, 0.2 + power * 0.3, 'bandpass', 2600, 1.2);
    tone(s.out, 'sine', 700 + power * 300, s.t, 0.06, 0.25, { slideTo: 400 });
  },
  bump() {
    const s = sfxOut();
    if (s) tone(s.out, 'triangle', 320, s.t, 0.07, 0.14, { slideTo: 200 });
  },
  cup() {
    const s = sfxOut();
    if (!s) return;
    tone(s.out, 'sine', 500, s.t, 0.18, 0.25, { slideTo: 140 });
    [79, 84, 88, 91].forEach((m, i) => tone(s.out, 'square', hz(m), s.t + 0.2 + i * 0.09, 0.2, 0.06, { lp: 3000 }));
    noise(s.out, s.t + 0.2, 0.6, 0.06, 'highpass', 5000);
  },
  fanfare() {
    const s = sfxOut();
    if (!s) return;
    const seq: [number, number, number][] = [
      [0, 0.12, 72],
      [0.13, 0.12, 72],
      [0.26, 0.12, 72],
      [0.4, 0.45, 77],
      [0.9, 0.2, 76],
      [1.1, 0.7, 81],
    ];
    for (const [d, len, m] of seq) {
      tone(s.out, 'sawtooth', hz(m), s.t + d, len, 0.06, { lp: 2400 });
      tone(s.out, 'square', hz(m - 12), s.t + d, len, 0.04, { lp: 1500 });
    }
  },
  pop() {
    const s = sfxOut();
    if (s) tone(s.out, 'sine', 600, s.t, 0.1, 0.12, { slideTo: 1000 });
  },
  error() {
    const s = sfxOut();
    if (s) tone(s.out, 'square', 220, s.t, 0.18, 0.06, { slideTo: 150, lp: 1500 });
  },
};
