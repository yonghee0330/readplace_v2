// 뼈 없는 트랜스폼 애니메이션: 숨쉬기, 걷기, 앉기 전환, 읽기(책 들고 고개 숙임, 가끔 페이지 넘김), 눈인사, 마시기, 깜빡임.
import { DRINK_OPTIONS, DRINK_TIMING, drinkAnimDuration, type DrinkKind } from '../net/drink';
import type { AvatarState } from '../net/presence';
import * as THREE from 'three';
import type { Avatar } from './avatar';

const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

const T = DRINK_TIMING;

// 오른쪽 팔 기본 어깨 위치(avatar.ts의 arm.position과 같다)와, 입에 잔을 댈 때의 팔 각도
const ARM_R_X = -0.15;
const ARM_R_Y = 0.24;
const MOUTH_ARM_X = -1.87;
const MOUTH_ARM_Z = 0.49;

function easeInOut(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function pulse(t: number, period: number): number {
  return 0.5 - 0.5 * Math.cos((t / period) * Math.PI * 2);
}

/** 커피·차 한 모금 구간의 입·기울기 가중치. */
function sipStroke(local: number): { toMouth: number; tip: number } {
  const { sipUp, sipTip, sipDown } = T;
  if (local < sipUp) {
    return { toMouth: easeInOut(local / sipUp), tip: 0 };
  }
  if (local < sipUp + sipTip) {
    const u = (local - sipUp) / sipTip;
    const tip = u < 0.55 ? easeInOut(u / 0.55) : easeInOut(1 - (u - 0.55) / 0.45);
    return { toMouth: 1, tip };
  }
  if (local < sipUp + sipTip + sipDown) {
    const u = (local - sipUp - sipTip) / sipDown;
    return { toMouth: 1 - easeInOut(u) * 0.55, tip: 0 };
  }
  return { toMouth: 0.45, tip: 0 };
}

interface DrinkPose {
  /** 0=내림, 1=입에 댐 */
  mouth: number;
  /** 잔 기울임(마시기) */
  tip: number;
  /** 손에 들고 있는 정도(모금 사이) */
  hold: number;
  done: boolean;
}

function waterPose(t: number): DrinkPose {
  const end = T.waterRaise + T.waterGulp + T.waterLower;
  if (t >= end) return { mouth: 0, tip: 0, hold: 0, done: true };
  if (t < T.waterRaise) {
    const u = easeInOut(t / T.waterRaise);
    return { mouth: u, tip: u * 0.35, hold: 0, done: false };
  }
  if (t < T.waterRaise + T.waterGulp) {
    const g = t - T.waterRaise;
    // 벌컥벌컥: 잔을 입에 붙인 채 빠르게 기울였다 세움
    const gulp = pulse(g, 0.34);
    return { mouth: 1, tip: 0.55 + 0.45 * gulp, hold: 0, done: false };
  }
  const u = easeInOut((t - T.waterRaise - T.waterGulp) / T.waterLower);
  return { mouth: 1 - u, tip: (1 - u) * 0.25, hold: 0, done: false };
}

function multiSipPose(t: number, sips: number, pause: number): DrinkPose {
  const cycle = T.sipUp + T.sipTip + T.sipDown + pause;
  const active = T.raise + sips * cycle - pause; // 마지막 모금 뒤 휴식 생략
  const end = active + T.lower;
  if (t >= end) return { mouth: 0, tip: 0, hold: 0, done: true };

  if (t < T.raise) {
    const u = easeInOut(t / T.raise);
    return { mouth: 0, tip: 0, hold: u, done: false };
  }

  const afterRaise = t - T.raise;
  if (afterRaise < active - T.raise) {
    const i = Math.min(sips - 1, Math.floor(afterRaise / cycle));
    const local = afterRaise - i * cycle;
    const stroke = T.sipUp + T.sipTip + T.sipDown;
    if (local >= stroke) {
      return { mouth: 0.42, tip: 0, hold: 1, done: false };
    }
    const { toMouth, tip } = sipStroke(local);
    const hold = 1 - toMouth * 0.85;
    return { mouth: toMouth, tip, hold, done: false };
  }

  const u = easeInOut((t - active) / T.lower);
  return { mouth: 0, tip: 0, hold: 1 - u, done: false };
}

function drinkPose(kind: DrinkKind, t: number): DrinkPose {
  if (kind === 'water') return waterPose(t);
  if (kind === 'coffee') return multiSipPose(t, T.coffeeSips, T.coffeePause);
  return multiSipPose(t, T.teaSips, T.teaPause);
}

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
  private sipT = -1;
  private sipKind: DrinkKind = 'water';
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

  /** 음료 마시기: 종류별 모션(물=벌컥, 커피=5모금, 차=10모금) */
  sip(kind: DrinkKind): void {
    this.sipT = 0;
    this.sipKind = kind;
    const hex = DRINK_OPTIONS.find((d) => d.id === kind)?.color ?? '#9ec9e0';
    this.a.setCupLiquid(hex);
    this.a.cup.visible = true;
  }

  get sipping(): boolean {
    return this.sipT >= 0;
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

    // 마시기 포즈
    let drinkMouth = 0;
    let drinkTip = 0;
    let drinkHold = 0;
    if (this.sipT >= 0) {
      this.sipT += dt;
      const pose = drinkPose(this.sipKind, this.sipT);
      drinkMouth = pose.mouth;
      drinkTip = pose.tip;
      drinkHold = pose.hold;
      if (pose.done || this.sipT > drinkAnimDuration(this.sipKind) + 0.05) {
        this.sipT = -1;
        a.cup.visible = false;
        a.cup.rotation.set(0.35, 0.2, -0.4);
        a.cup.scale.setScalar(1);
        a.armR.rotation.y = 0;
        drinkMouth = 0;
        drinkTip = 0;
        drinkHold = 0;
      }
    }

    // 마시는 시늉: 입안에 넣지 않고, 손·잔을 앞으로 내밀어 잘 보이게
    const present = Math.max(drinkHold, drinkMouth * 0.85);
    const sipLift = drinkMouth;
    const drinkW = Math.max(present, sipLift * 0.5);
    const sipMute = 1 - Math.min(1, drinkW * 1.1);

    // 팔: 걷기(다리와 반대), 읽기, 마시기(가슴 앞으로 내밀기)
    const readArmX = -1.05, readArmZ = 0.38;
    // 너무 높이 올리지 않고(~-1.2), 옆으로 벌려 잔이 몸 앞에 보이게
    const armRaise = -0.92 * present - 0.28 * sipLift;
    const armZ = 0.52 * present + 0.1 * sipLift;
    const armY = -0.12 * present - 0.1 * sipLift;
    a.armL.rotation.x = -swing * 0.45 * (1 - this.readW) * sipMute + readArmX * this.readW * sipMute;
    a.armR.rotation.x = swing * 0.45 * (1 - this.readW) * sipMute + readArmX * this.readW * sipMute
      + armRaise;
    a.armL.rotation.z = 0.12 * (1 - this.readW) - readArmZ * this.readW;
    a.armR.rotation.z = -0.12 * (1 - this.readW) * sipMute + readArmZ * this.readW * sipMute
      + armZ;
    a.armR.rotation.y = armY;
    // 어깨를 살짝 앞으로 — 잔이 카메라에 잘 잡히게
    a.armR.position.z = 0.055 * present;
    // 입(얼굴 한가운데 아래쪽)으로: 입이 가까워질수록(mouth→1) 팔을 앞·위로 들어 잔을 입 앞에 둔다.
    // 아바타 팔이 짧아서 어깨를 앞·위로 조금 옮겨 손이 닿게 한다.
    const m = drinkMouth;
    a.armR.rotation.x += (MOUTH_ARM_X - a.armR.rotation.x) * m;
    a.armR.rotation.z += (MOUTH_ARM_Z - a.armR.rotation.z) * m;
    a.armR.rotation.y *= 1 - m;
    a.armR.position.set(ARM_R_X + 0.06 * m, ARM_R_Y + 0.04 * m, a.armR.position.z * (1 - m) + 0.06 * m);

    // 머리: 읽을 때 숙임. 마실 때는 살짝만 끄덕(입에 대지 않음).
    let headX = 0.28 * this.readW * sipMute + Math.sin(this.time * 0.9) * 0.02 * (1 - this.walkW)
      + 0.12 * sipLift - 0.1 * drinkTip; // 입으로 갈 땐 살짝 숙이고, 잔을 기울일 땐 고개를 젖힌다
    let headZ = Math.sin(this.time * 0.6) * 0.03 * (1 - this.walkW) * (1 - this.readW) * sipMute;

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
      a.armR.rotation.z += 0.5 * k * sipMute;
      a.armR.rotation.x -= 0.25 * k * sipMute;
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

    // 잔: 크게·앞에 두고 기울이는 시늉만. 몸도 살짝만 따라감.
    if (this.sipT >= 0) {
      a.cup.visible = true;
      const size = 1.4 + 0.25 * present + 0.1 * drinkTip;
      a.cup.scale.setScalar(size);
      a.cup.position.set(0.02, -0.17 + 0.015 * sipLift, 0.04 + 0.05 * present);
      a.cup.rotation.x = 0.25 + 0.55 * drinkTip + 0.12 * sipLift;
      a.cup.rotation.y = 0.15;
      a.cup.rotation.z = -0.35;
      // 입 쪽으로 갈수록 잔을 세워서(팔이 올라간 만큼 되돌려) 입에 가져가고, 마실 땐 입술 쪽으로 기울인다
      if (m > 0.001) {
        const armQ = new THREE.Quaternion().setFromEuler(a.armR.rotation);
        const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -(0.12 + 0.75 * drinkTip));
        const target = armQ.clone().invert().multiply(tilt);
        const cur = new THREE.Quaternion().setFromEuler(a.cup.rotation);
        a.cup.quaternion.copy(cur.slerp(target, m));
      }
      a.body.rotation.x += -0.02 * drinkTip;
      if (this.sipKind === 'water' && sipLift > 0.85) {
        a.body.position.y += 0.008 * drinkTip;
      }
    } else {
      a.cup.visible = false;
      a.cup.position.set(0.01, -0.175, 0.02);
      a.cup.rotation.set(0.35, 0.2, -0.4);
      a.armR.rotation.y = 0;
      a.armR.position.set(ARM_R_X, ARM_R_Y, 0);
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

    a.book.visible = this.readW > 0.45 && this.sipT < 0;
    a.book.scale.setScalar(Math.min(1, this.readW * 1.3));
  }
}
