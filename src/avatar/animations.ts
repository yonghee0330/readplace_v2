// 뼈 없는 트랜스폼 애니메이션: 숨쉬기, 걷기, 앉기 전환, 읽기(책 들고 고개 숙임, 가끔 페이지 넘김), 눈인사, 깜빡임.
import type { AvatarState } from '../net/presence';
import type { Avatar } from './avatar';

const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export class AvatarAnimator {
  state: AvatarState = 'stand';
  /** 앉아 있는지(읽기 상태에서도 앉아 있을 수 있다) */
  seated = false;
  /** 걷는 속도(m/s). 다리 흔들기 빠르기에 쓴다. */
  speed = 0;

  private walkW = 0;
  private sitW = 0;
  private readW = 0;
  private phase = 0;
  private bowT = -1;
  private blinkT = -1;
  private nextBlink = 2 + Math.random() * 3;
  private pageT = -1;
  private nextPage = 4 + Math.random() * 4;
  private time = 0;

  constructor(private a: Avatar) {}

  setState(s: AvatarState, seated: boolean): void {
    this.state = s;
    this.seated = seated || s === 'sit';
  }

  /** 눈인사: 0.8초 고개 숙임 */
  bow(): void {
    this.bowT = 0;
  }

  get bowing(): boolean {
    return this.bowT >= 0;
  }

  update(dt: number, _t: number): void {
    const a = this.a;
    this.time += dt;
    const walking = this.state === 'walk';
    const reading = this.state === 'read';
    this.walkW = damp(this.walkW, walking ? 1 : 0, 10, dt);
    this.sitW = damp(this.sitW, this.seated ? 1 : 0, 7, dt);
    this.readW = damp(this.readW, reading ? 1 : 0, 6, dt);
    this.phase += dt * (6 + this.speed * 5) * (walking ? 1 : 0.3);

    const swing = Math.sin(this.phase) * this.walkW;
    const breath = Math.sin(this.time * 2.1);

    // 몸통: 숨쉬기 + 걸을 때 위아래 + 앉을 때 살짝 뒤로
    a.body.position.y = 0.2 + Math.abs(Math.sin(this.phase)) * 0.022 * this.walkW;
    a.body.scale.set(1 - breath * 0.006, 1 + breath * 0.012, 1 - breath * 0.006);
    a.body.rotation.x = -0.06 * this.sitW + 0.05 * this.walkW;
    a.body.rotation.z = Math.sin(this.phase) * 0.04 * this.walkW;

    // 다리: 걷기 흔들기, 앉으면 앞으로
    a.legL.rotation.x = swing * 0.55 - 1.45 * this.sitW;
    a.legR.rotation.x = -swing * 0.55 - 1.45 * this.sitW;

    // 팔: 걷기(다리와 반대), 읽기(앞으로 모아 책을 듦)
    const readArmX = -1.05, readArmZ = 0.38;
    a.armL.rotation.x = -swing * 0.45 * (1 - this.readW) + readArmX * this.readW;
    a.armR.rotation.x = swing * 0.45 * (1 - this.readW) + readArmX * this.readW;
    a.armL.rotation.z = 0.12 * (1 - this.readW) - readArmZ * this.readW;
    a.armR.rotation.z = -0.12 * (1 - this.readW) + readArmZ * this.readW;

    // 머리: 읽을 때 숙임, 평소엔 아주 살짝 끄덕임
    let headX = 0.28 * this.readW + Math.sin(this.time * 0.9) * 0.02 * (1 - this.walkW);
    let headZ = Math.sin(this.time * 0.6) * 0.03 * (1 - this.walkW) * (1 - this.readW);

    // 가끔 페이지 넘기는 손짓
    if (this.readW > 0.8) {
      this.nextPage -= dt;
      if (this.nextPage <= 0 && this.pageT < 0) {
        this.pageT = 0;
        this.nextPage = 5 + Math.random() * 6;
      }
    }
    if (this.pageT >= 0) {
      this.pageT += dt;
      const k = Math.sin(Math.min(1, this.pageT / 0.7) * Math.PI);
      a.armR.rotation.z += 0.5 * k;
      a.armR.rotation.x -= 0.25 * k;
      headZ += 0.04 * k;
      if (this.pageT > 0.7) this.pageT = -1;
    }

    // 눈인사
    if (this.bowT >= 0) {
      this.bowT += dt;
      const k = Math.sin(Math.min(1, this.bowT / 0.8) * Math.PI);
      headX += 0.42 * k;
      a.body.rotation.x += 0.2 * k;
      if (this.bowT > 0.8) this.bowT = -1;
    }
    a.head.rotation.x = headX;
    a.head.rotation.z = headZ;

    // 깜빡임
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blinkT = 0;
      this.nextBlink = 2.5 + Math.random() * 3.5;
    }
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      a.eyes.scale.y = this.blinkT < 0.13 ? 0.12 : 1;
      if (this.blinkT >= 0.13) this.blinkT = -1;
    }

    a.book.visible = this.readW > 0.45;
    a.book.scale.setScalar(Math.min(1, this.readW * 1.3));
  }
}
