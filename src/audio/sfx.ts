// 효과음(Web Audio 합성): 페이지 넘김(노이즈 버스트 + 하이패스 스윕), 눈인사(부드러운 종소리), 버튼(작은 똑).
// 서점 소리가 켜져 있을 때만 난다.
import { whiteNoise, type Ambience } from './ambience';

export type SfxName = 'page' | 'nod' | 'tap' | 'meow';

export class Sfx {
  private noise: AudioBuffer | null = null;

  constructor(private amb: Ambience) {}

  play(name: SfxName): void {
    const ctx = this.amb.ctx, bus = this.amb.sfxBus;
    if (!ctx || !bus || !this.amb.enabled || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.01;
    if (name === 'page') this.page(ctx, bus, t);
    else if (name === 'nod') this.chime(ctx, bus, t);
    else if (name === 'meow') this.meow(ctx, bus, t);
    else this.tap(ctx, bus, t);
  }

  /** 종이가 스치는 소리: 짧은 노이즈 두 번 + 하이패스가 위로 쓸려 올라감 */
  private page(ctx: AudioContext, out: AudioNode, t: number): void {
    this.noise ??= whiteNoise(ctx, 1);
    for (const [dt, len, gain] of [[0, 0.22, 0.3], [0.16, 0.14, 0.18]] as const) {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.Q.value = 0.7;
      hp.frequency.setValueAtTime(700, t + dt);
      hp.frequency.exponentialRampToValueAtTime(5200, t + dt + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(gain, t + dt + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + len);
      s.connect(hp).connect(g).connect(out);
      s.start(t + dt, Math.random() * 0.7);
      s.stop(t + dt + len + 0.02);
    }
  }

  /** 눈인사: 5도 위로 이어지는 맑은 두 음 */
  private chime(ctx: AudioContext, out: AudioNode, t: number): void {
    for (const [dt, f] of [[0, 784], [0.12, 1175]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(0.09, t + dt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 1.1);
      o.connect(g).connect(out);
      o.start(t + dt);
      o.stop(t + dt + 1.2);
    }
  }

  /** 고양이 야옹: 톱니파를 대역통과로 깎고 음높이를 올렸다 내린다 */
  private meow(ctx: AudioContext, out: AudioNode, t: number): void {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.16);
    o.frequency.exponentialRampToValueAtTime(560, t + 0.52);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3.2;
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(1900, t + 0.18);
    bp.frequency.exponentialRampToValueAtTime(1100, t + 0.52);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.56);
    o.connect(bp).connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.6);
  }

  /** 버튼: 나무를 살짝 두드린 듯한 짧은 소리 */
  private tap(ctx: AudioContext, out: AudioNode, t: number): void {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(260, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.1);
  }
}
