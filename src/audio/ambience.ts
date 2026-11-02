// 서점 소리(SPEC 3-10): 외부 음원 없이 Web Audio로 직접 합성한다.
// 날씨(비·눈·맑음)에 따라 창밖 레이어만 바뀌고, 본 줄기는 잔잔한 패드·멜로디.
// 기본 꺼짐, 켜고 끌 때 1.5초 페이드. AudioContext는 사용자가 처음 누른 뒤에만 만든다.
import type { WeatherKind } from '../weather/bucheon';

const FADE = 1.5;
const LEVEL = 0.8;
const WEATHER_FADE = 1.2;
/** 패드 한 마디 길이(초). 4마디 ≈ 22초 루프 */
const BAR = 5.5;
/**
 * 따뜻한 서점 코드(Hz): Fmaj9 → Am7 → Dm9 → Cmaj7.
 * 낮은 음역 + 9th로 잔잔하게.
 */
const CHORDS: number[][] = [
  [174.61, 220.0, 261.63, 329.63, 392.0],
  [220.0, 261.63, 329.63, 392.0],
  [146.83, 174.61, 220.0, 261.63, 329.63],
  [130.81, 164.81, 196.0, 246.94, 329.63],
];
/** 코드 위 느린 멜로디(상대 Hz). 마디마다 2~3음만 띄운다. */
const MELODY: number[][] = [
  [523.25, 587.33, 659.25],
  [659.25, 587.33, 523.25],
  [440.0, 523.25, 587.33],
  [523.25, 493.88, 392.0],
];

export class Ambience {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** 효과음 버스(소리를 켠 상태에서만 들린다) */
  sfxBus: GainNode | null = null;
  private weatherBus: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private snowGain: GainNode | null = null;
  private clearGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private padTimer = 0;
  private nextBar = 0;
  private bar = 0;
  private suspendTimer = 0;
  private weather: WeatherKind = 'rain';
  enabled = false;

  /** 사용자 동작(클릭·키) 안에서만 부른다. 처음이면 AudioContext와 소리 그래프를 만든다. */
  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // 아주 약한 압축으로 물방울·효과음이 튀지 않게
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);
    // 날씨 버스는 작게, 음악은 또렷하게
    this.weatherBus = ctx.createGain();
    this.weatherBus.gain.value = 0.32;
    this.weatherBus.connect(this.master);
    this.rainGain = ctx.createGain();
    this.snowGain = ctx.createGain();
    this.clearGain = ctx.createGain();
    this.rainGain.connect(this.weatherBus);
    this.snowGain.connect(this.weatherBus);
    this.clearGain.connect(this.weatherBus);
    this.rainGain.gain.value = this.weather === 'rain' ? 1 : 0;
    this.snowGain.gain.value = this.weather === 'snow' ? 1 : 0;
    this.clearGain.gain.value = this.weather === 'clear' ? 1 : 0;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 1;
    this.musicBus.connect(this.master);
    this.buildRain(ctx, this.rainGain);
    this.buildSnow(ctx, this.snowGain);
    this.buildClear(ctx, this.clearGain);
    this.buildPad(ctx, this.musicBus);
    return ctx;
  }

  /** 부천 날씨에 맞춰 창밖 소리만 바꾼다(비 / 눈 / 맑음·새소리). */
  setWeather(kind: WeatherKind): void {
    this.weather = kind;
    if (!this.ctx || !this.rainGain || !this.snowGain || !this.clearGain) return;
    const now = this.ctx.currentTime;
    const targets: Record<WeatherKind, [GainNode, number]> = {
      rain: [this.rainGain, 1],
      snow: [this.snowGain, 1],
      clear: [this.clearGain, 1],
    };
    for (const k of ['rain', 'snow', 'clear'] as WeatherKind[]) {
      const g = k === 'rain' ? this.rainGain : k === 'snow' ? this.snowGain : this.clearGain;
      const to = targets[kind][0] === g ? 1 : 0;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(to, now + WEATHER_FADE);
    }
  }

  /** 소리를 켜거나 끈다. 켤 때는 반드시 사용자 동작 안에서 불러야 한다. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on && !this.ctx) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    clearTimeout(this.suspendTimer);
    if (on && ctx.state !== 'running') void ctx.resume();
    const g = this.master.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(on ? LEVEL : 0, now + FADE);
    if (on) this.startScheduler();
    else {
      // 페이드가 끝나면 멈춰서 CPU를 쓰지 않게 한다
      this.suspendTimer = window.setTimeout(() => {
        if (!this.enabled) {
          this.stopScheduler();
          void ctx.suspend();
        }
      }, FADE * 1000 + 200);
    }
  }

  /** 테스트·디버그용 상태 */
  status(): { enabled: boolean; state: string; gain: number; weather: WeatherKind } {
    return {
      enabled: this.enabled,
      state: this.ctx?.state ?? 'none',
      gain: this.master?.gain.value ?? 0,
      weather: this.weather,
    };
  }

  // ---------- 빗소리(창밖, 작게) ----------
  private buildRain(ctx: AudioContext, out: AudioNode): void {
    const noise = loopSource(ctx, whiteNoise(ctx, 3));
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1400;
    band.Q.value = 0.5;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 4800;
    const body = ctx.createGain();
    body.gain.value = 0.07;
    noise.connect(band).connect(low).connect(body).connect(out);
    const rumbleLp = ctx.createBiquadFilter();
    rumbleLp.type = 'lowpass';
    rumbleLp.frequency.value = 340;
    const rumble = ctx.createGain();
    rumble.gain.value = 0.035;
    noise.connect(rumbleLp).connect(rumble).connect(out);
    // 실내 공기음도 비 레이어에 살짝
    const air = loopSource(ctx, pinkNoise(ctx, 4));
    const airLp = ctx.createBiquadFilter();
    airLp.type = 'lowpass';
    airLp.frequency.value = 240;
    const airG = ctx.createGain();
    airG.gain.value = 0.05;
    air.connect(airLp).connect(airG).connect(out);
    noise.start();
    air.start();

    const sway = () => {
      if (!this.enabled || this.weather !== 'rain') return;
      const t = ctx.currentTime;
      body.gain.cancelScheduledValues(t);
      body.gain.setValueAtTime(body.gain.value, t);
      body.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.045, t + 2.5);
      band.frequency.setTargetAtTime(1100 + Math.random() * 700, t, 1.5);
    };
    window.setInterval(sway, 2500);

    const drop = () => {
      if (this.enabled && this.weather === 'rain') {
        const t = ctx.currentTime + 0.02;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const f = 1400 + Math.random() * 2200;
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.07);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.012 + Math.random() * 0.014, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        const pan = ctx.createStereoPanner();
        pan.pan.value = Math.random() * 1.6 - 0.8;
        o.connect(g).connect(pan).connect(out);
        o.start(t);
        o.stop(t + 0.12);
      }
      window.setTimeout(drop, 450 + Math.random() * 1800);
    };
    drop();
  }

  // ---------- 눈 오는 날: 부드러운 바람·얇은 화이트노이즈 ----------
  private buildSnow(ctx: AudioContext, out: AudioNode): void {
    const noise = loopSource(ctx, whiteNoise(ctx, 4));
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 0.35;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 2200;
    const body = ctx.createGain();
    body.gain.value = 0.045;
    noise.connect(band).connect(low).connect(body).connect(out);
    const wind = loopSource(ctx, pinkNoise(ctx, 5));
    const windLp = ctx.createBiquadFilter();
    windLp.type = 'lowpass';
    windLp.frequency.value = 180;
    const windG = ctx.createGain();
    windG.gain.value = 0.055;
    wind.connect(windLp).connect(windG).connect(out);
    noise.start();
    wind.start();
    window.setInterval(() => {
      if (!this.enabled || this.weather !== 'snow') return;
      const t = ctx.currentTime;
      body.gain.setTargetAtTime(0.03 + Math.random() * 0.03, t, 1.2);
      windG.gain.setTargetAtTime(0.04 + Math.random() * 0.03, t, 1.8);
    }, 3200);
  }

  // ---------- 맑은 날: 화이트노이즈 + 가끔 새소리 ----------
  private buildClear(ctx: AudioContext, out: AudioNode): void {
    const hush = loopSource(ctx, whiteNoise(ctx, 3));
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 400;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const g = ctx.createGain();
    g.gain.value = 0.028;
    hush.connect(hp).connect(lp).connect(g).connect(out);
    const air = loopSource(ctx, pinkNoise(ctx, 4));
    const airLp = ctx.createBiquadFilter();
    airLp.type = 'lowpass';
    airLp.frequency.value = 280;
    const airG = ctx.createGain();
    airG.gain.value = 0.035;
    air.connect(airLp).connect(airG).connect(out);
    hush.start();
    air.start();

    const chirp = () => {
      if (this.enabled && this.weather === 'clear') {
        const t = ctx.currentTime + 0.02;
        const pan = ctx.createStereoPanner();
        pan.pan.value = Math.random() * 1.4 - 0.7;
        const notes = 2 + Math.floor(Math.random() * 3);
        let f0 = 1800 + Math.random() * 1400;
        for (let i = 0; i < notes; i++) {
          const o = ctx.createOscillator();
          const eg = ctx.createGain();
          const start = t + i * (0.07 + Math.random() * 0.05);
          const f = f0 * (0.92 + Math.random() * 0.2);
          o.type = 'sine';
          o.frequency.setValueAtTime(f, start);
          o.frequency.exponentialRampToValueAtTime(f * (1.15 + Math.random() * 0.2), start + 0.06);
          eg.gain.setValueAtTime(0.0001, start);
          eg.gain.exponentialRampToValueAtTime(0.018 + Math.random() * 0.012, start + 0.012);
          eg.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
          o.connect(eg).connect(pan).connect(out);
          o.start(start);
          o.stop(start + 0.12);
          f0 = f;
        }
      }
      window.setTimeout(chirp, 2800 + Math.random() * 6500);
    };
    window.setTimeout(chirp, 1500 + Math.random() * 2000);
  }

  // ---------- 잔잔한 서점 음악(패드 + 느린 멜로디) ----------
  private padOut: GainNode | null = null;
  private melodyOut: GainNode | null = null;

  private buildPad(ctx: AudioContext, out: AudioNode): void {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    lp.Q.value = 0.25;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.04;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 180;
    lfo.connect(lfoAmt).connect(lp.frequency);
    lfo.start();
    this.padOut = ctx.createGain();
    this.padOut.gain.value = 0.085;
    this.padOut.connect(lp).connect(out);

    // 멜로디는 조금 더 밝게, 짧은 리버브 느낌의 딜레이
    const melLp = ctx.createBiquadFilter();
    melLp.type = 'lowpass';
    melLp.frequency.value = 2400;
    this.melodyOut = ctx.createGain();
    this.melodyOut.gain.value = 0.055;
    const delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    this.melodyOut.connect(melLp);
    melLp.connect(out);
    melLp.connect(delay).connect(fb).connect(delay);
    delay.connect(out);
  }

  /** 마디가 시작되기 1.5초 전에 미리 예약한다(타이머가 늦어도 끊기지 않게). */
  private startScheduler(): void {
    if (!this.ctx || this.padTimer) return;
    const ctx = this.ctx;
    this.nextBar = Math.max(this.nextBar, ctx.currentTime + 0.1);
    const schedule = () => {
      while (this.nextBar < ctx.currentTime + 1.5) {
        const i = this.bar % CHORDS.length;
        this.playChord(CHORDS[i], this.nextBar);
        this.playMelody(MELODY[i], this.nextBar);
        this.bar++;
        this.nextBar += BAR;
      }
    };
    schedule();
    this.padTimer = window.setInterval(schedule, 500);
  }

  private stopScheduler(): void {
    clearInterval(this.padTimer);
    this.padTimer = 0;
  }

  /** 한 마디: 음마다 사인 + 디튠된 삼각파, 느린 어택·릴리스로 다음 마디와 겹쳐 이어진다. */
  private playChord(freqs: number[], t: number): void {
    const ctx = this.ctx!;
    const end = t + BAR + 1.8;
    for (const [i, f] of freqs.entries()) {
      const g = ctx.createGain();
      const peak = 0.28 / freqs.length;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 1.9);
      g.gain.setValueAtTime(peak, t + BAR - 0.5);
      g.gain.linearRampToValueAtTime(0.0001, end);
      g.connect(this.padOut!);
      const voices: [OscillatorType, number, number][] = [
        ['sine', 0, 1],
        ['triangle', 5 + i, 0.38],
        ['triangle', -6 - i, 0.38],
        ['sine', 12, 0.22],
      ];
      for (const [type, cents, amp] of voices) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = cents;
        const vg = ctx.createGain();
        vg.gain.value = amp;
        o.connect(vg).connect(g);
        o.start(t);
        o.stop(end + 0.05);
      }
    }
  }

  /** 마디 안 느린 멜로디: 부드러운 사인, 읽기를 방해하지 않게 띄엄띄엄. */
  private playMelody(notes: number[], t0: number): void {
    if (!this.melodyOut) return;
    const ctx = this.ctx!;
    const steps = [0.35, 0.48, 0.72];
    for (const [i, f] of notes.entries()) {
      const t = t0 + BAR * (steps[i] ?? 0.5);
      const g = ctx.createGain();
      const peak = 0.11;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.35);
      g.gain.linearRampToValueAtTime(peak * 0.55, t + 1.1);
      g.gain.linearRampToValueAtTime(0.0001, t + 2.2);
      g.connect(this.melodyOut);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const soft = ctx.createOscillator();
      soft.type = 'triangle';
      soft.frequency.value = f;
      soft.detune.value = 4;
      const sg = ctx.createGain();
      sg.gain.value = 0.35;
      o.connect(g);
      soft.connect(sg).connect(g);
      o.start(t);
      soft.start(t);
      o.stop(t + 2.3);
      soft.stop(t + 2.3);
    }
  }
}

export function whiteNoise(ctx: AudioContext, sec: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * sec);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

/** Paul Kellet 방식 핑크 노이즈 */
function pinkNoise(ctx: AudioContext, sec: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * sec);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return buf;
}

function loopSource(ctx: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  return s;
}
