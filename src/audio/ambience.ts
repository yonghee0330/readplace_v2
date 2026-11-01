// 서점 소리(SPEC 3-10): 외부 음원 없이 Web Audio로 직접 합성한다.
// 빗소리(노이즈 → 밴드패스·로우패스, 느린 랜덤 진폭 + 가끔 물방울), 실내 공기음(아주 낮은 핑크 노이즈),
// 패드(디튠된 사인·삼각파, 로우패스, 4마디 코드 루프). 기본 꺼짐, 켜고 끌 때 1.5초 페이드.
// AudioContext는 사용자가 처음 누른 뒤에만 만든다(자동 재생 정책).

const FADE = 1.5;
const LEVEL = 0.8;
/** 패드 한 마디 길이(초). 4마디 = 19.2초 루프 */
const BAR = 4.8;
/** 4마디 코드 진행(Hz): Fmaj9 → Em7 → Dm9 → Cmaj7, 낮은 음역에서 부드럽게 */
const CHORDS: number[][] = [
  [174.61, 220.0, 261.63, 329.63, 392.0],
  [164.81, 196.0, 246.94, 293.66],
  [146.83, 174.61, 220.0, 261.63, 329.63],
  [130.81, 196.0, 246.94, 329.63],
];

export class Ambience {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** 효과음 버스(소리를 켠 상태에서만 들린다) */
  sfxBus: GainNode | null = null;
  private padTimer = 0;
  private nextBar = 0;
  private bar = 0;
  private suspendTimer = 0;
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
    this.buildRain(ctx, this.master);
    this.buildAir(ctx, this.master);
    this.buildPad(ctx, this.master);
    return ctx;
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
  status(): { enabled: boolean; state: string; gain: number } {
    return { enabled: this.enabled, state: this.ctx?.state ?? 'none', gain: this.master?.gain.value ?? 0 };
  }

  // ---------- 빗소리 ----------
  private buildRain(ctx: AudioContext, out: AudioNode): void {
    const noise = loopSource(ctx, whiteNoise(ctx, 3));
    // 쏴아 하는 몸통: 밴드패스 + 로우패스
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1400;
    band.Q.value = 0.5;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 5200;
    const body = ctx.createGain();
    body.gain.value = 0.16;
    noise.connect(band).connect(low).connect(body).connect(out);
    // 처마·유리에 닿는 낮은 웅웅거림
    const rumbleLp = ctx.createBiquadFilter();
    rumbleLp.type = 'lowpass';
    rumbleLp.frequency.value = 380;
    const rumble = ctx.createGain();
    rumble.gain.value = 0.1;
    noise.connect(rumbleLp).connect(rumble).connect(out);
    noise.start();

    // 진폭에 느린 랜덤 변조(빗발이 세졌다 약해졌다)
    const sway = () => {
      const t = ctx.currentTime;
      body.gain.cancelScheduledValues(t);
      body.gain.setValueAtTime(body.gain.value, t);
      body.gain.linearRampToValueAtTime(0.1 + Math.random() * 0.1, t + 2.5);
      band.frequency.setTargetAtTime(1100 + Math.random() * 700, t, 1.5);
    };
    window.setInterval(() => this.enabled && sway(), 2500);

    // 가끔 물방울: 짧은 사인 + 빠른 감쇠, 높이가 아래로 살짝 미끄러짐
    const drop = () => {
      if (this.enabled) {
        const t = ctx.currentTime + 0.02;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const f = 1400 + Math.random() * 2200;
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.07);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.03 + Math.random() * 0.04, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        const pan = ctx.createStereoPanner();
        pan.pan.value = Math.random() * 1.6 - 0.8;
        o.connect(g).connect(pan).connect(out);
        o.start(t);
        o.stop(t + 0.12);
      }
      window.setTimeout(drop, 250 + Math.random() * 1400);
    };
    drop();
  }

  // ---------- 실내 공기음 ----------
  private buildAir(ctx: AudioContext, out: AudioNode): void {
    const src = loopSource(ctx, pinkNoise(ctx, 4));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const g = ctx.createGain();
    g.gain.value = 0.09;
    src.connect(lp).connect(g).connect(out);
    src.start();
  }

  // ---------- 패드 ----------
  private padOut: GainNode | null = null;

  private buildPad(ctx: AudioContext, out: AudioNode): void {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.3;
    // 아주 느린 필터 흔들림
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 220;
    lfo.connect(lfoAmt).connect(lp.frequency);
    lfo.start();
    this.padOut = ctx.createGain();
    this.padOut.gain.value = 0.05;
    this.padOut.connect(lp).connect(out);
  }

  /** 마디가 시작되기 1.5초 전에 미리 예약한다(타이머가 늦어도 끊기지 않게). */
  private startScheduler(): void {
    if (!this.ctx || this.padTimer) return;
    const ctx = this.ctx;
    this.nextBar = Math.max(this.nextBar, ctx.currentTime + 0.1);
    const schedule = () => {
      while (this.nextBar < ctx.currentTime + 1.5) {
        this.playChord(CHORDS[this.bar % CHORDS.length], this.nextBar);
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
    const end = t + BAR + 1.6;
    for (const [i, f] of freqs.entries()) {
      const g = ctx.createGain();
      const peak = 0.22 / freqs.length;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 1.6);
      g.gain.setValueAtTime(peak, t + BAR - 0.4);
      g.gain.linearRampToValueAtTime(0.0001, end);
      g.connect(this.padOut!);
      const voices: [OscillatorType, number, number][] = [
        ['sine', 0, 1],
        ['triangle', 6 + i, 0.45],
        ['triangle', -7 - i, 0.45],
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
