// 포털: 나무 문틀·문짝 + 문턱 + 공간 이름 간판(발광 없음).
import * as THREE from 'three';
import { MergeBucket, bevelBox, projectUV, trs } from '../geom';
import { PORTALS, spaceLabel, type PortalDef, type SpaceId } from '../layout';

export interface PortalViewer {
  x: number;
  z: number;
  ry: number;
  space: SpaceId;
}

export interface PortalGlow {
  group: THREE.Group;
  update: (t: number, viewer?: PortalViewer) => void;
}

/** 아바타가 포털 쪽을 보고 있는지(앞으로 나갈 때). 1인실은 등 뒤면 숨김. */
export function facingPortal(portal: PortalDef, viewer: { x: number; z: number; ry: number }, minDot = 0.35): boolean {
  const dx = portal.x - viewer.x;
  const dz = portal.z - viewer.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-3) return true;
  const fx = Math.sin(viewer.ry);
  const fz = Math.cos(viewer.ry);
  return (fx * dx + fz * dz) / len >= minDot;
}

function makeNameTexture(label: string): THREE.CanvasTexture {
  const w = 512, h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#f3ead8';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(90, 70, 40, 0.28)';
  g.lineWidth = 4;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = '#2c2a24';
  g.font = '700 52px "Noto Serif KR", "Apple SD Gothic Neo", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (label.length >= 6) g.font = '700 42px "Noto Serif KR", "Apple SD Gothic Neo", serif';
  g.fillText(label, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 머지드 문틀·문턱·나무 문짝. */
export function buildPortals(bucket: MergeBucket): void {
  for (const p of PORTALS) {
    const base = trs(p.x, 0, p.z, 0, p.ry);
    const at = (m: THREE.Matrix4) => base.clone().multiply(m);
    const h = 2.2;
    const frame = 0.09;
    const depth = 0.14;
    const wood = (mat: 'walnut' | 'honey', g: THREE.BufferGeometry, grain: 'x' | 'y' | 'z', m: THREE.Matrix4) => {
      projectUV(g, grain === 'z' ? 'x' : grain, { offset: [0.2, 0.1] });
      bucket.add(mat, g, m);
    };

    // 문틀
    wood('walnut', bevelBox(frame, h, depth, 0.006), 'y', at(trs(-p.w / 2 - frame / 2, h / 2, 0)));
    wood('walnut', bevelBox(frame, h, depth, 0.006), 'y', at(trs(p.w / 2 + frame / 2, h / 2, 0)));
    wood('walnut', bevelBox(p.w + frame * 2, frame, depth + 0.02, 0.006), 'x', at(trs(0, h + frame / 2, 0)));
    // 문턱
    wood('walnut', bevelBox(p.w + frame * 2 + 0.08, 0.04, 0.28, 0.008), 'x', at(trs(0, 0.02, 0.06)));
    wood('walnut', bevelBox(p.w + frame * 2 + 0.16, 0.01, 0.42, 0.004), 'x', at(trs(0, 0.005, 0.1)));
    // 간판 받침 나무판
    const boardW = Math.min(1.45, p.w + 0.5);
    wood('walnut', bevelBox(boardW, 0.28, 0.05, 0.006), 'x', at(trs(0, 2.48, 0.04)));

    // 열린 문(1인실 등): 문짝 없이 문틀만 — 등 뒤로 밖이 보임
    if (p.open) continue;

    // ——— 나무 문짝 ———
    const doorH = 2.05;
    const doorT = 0.045;
    const z = 0.02;
    const leafW = p.w - 0.04;
    const stile = 0.07;
    const rail = 0.08;
    // 바탕 판
    wood('honey', bevelBox(leafW, doorH, doorT, 0.004), 'y', at(trs(0, doorH / 2, z)));
    // 외곽 문틀(문짝 위 덧대)
    wood('walnut', bevelBox(stile, doorH, doorT + 0.012, 0.003), 'y', at(trs(-leafW / 2 + stile / 2, doorH / 2, z + 0.008)));
    wood('walnut', bevelBox(stile, doorH, doorT + 0.012, 0.003), 'y', at(trs(leafW / 2 - stile / 2, doorH / 2, z + 0.008)));
    wood('walnut', bevelBox(leafW, rail, doorT + 0.012, 0.003), 'x', at(trs(0, doorH - rail / 2, z + 0.008)));
    wood('walnut', bevelBox(leafW, rail, doorT + 0.012, 0.003), 'x', at(trs(0, rail / 2 + 0.02, z + 0.008)));
    // 가운데 가로대 + 세로대 (2단 패널)
    const midY = doorH * 0.48;
    wood('walnut', bevelBox(leafW - stile * 2, rail * 0.85, doorT + 0.01, 0.003), 'x', at(trs(0, midY, z + 0.01)));
    wood('walnut', bevelBox(stile * 0.7, doorH - rail * 2 - 0.04, doorT + 0.01, 0.003), 'y', at(trs(0, doorH / 2, z + 0.01)));
    // 안쪽 패널(살짝 들어간 느낌으로 얇게)
    const panelInset = 0.012;
    const panelW = (leafW - stile * 2 - stile * 0.7) / 2 - 0.02;
    const upperH = doorH - midY - rail * 1.5;
    const lowerH = midY - rail * 1.6;
    for (const sx of [-1, 1]) {
      const px = sx * (panelW / 2 + stile * 0.45);
      wood('honey', bevelBox(panelW, upperH, doorT - panelInset, 0.003), 'y', at(trs(px, midY + rail * 0.5 + upperH / 2, z - 0.004)));
      wood('honey', bevelBox(panelW, lowerH, doorT - panelInset, 0.003), 'y', at(trs(px, rail + 0.04 + lowerH / 2, z - 0.004)));
    }
    // 손잡이
    const hx = leafW / 2 - stile - 0.04;
    wood('walnut', bevelBox(0.018, 0.12, 0.028, 0.004), 'y', at(trs(hx, doorH * 0.48, z + 0.028)));
    wood('walnut', bevelBox(0.04, 0.018, 0.018, 0.003), 'x', at(trs(hx - 0.012, doorH * 0.48, z + 0.038)));
  }
}

/** 공간 이름 간판만(발광·펄스 없음). */
export function buildPortalGlow(portals: readonly PortalDef[] = PORTALS): PortalGlow {
  const group = new THREE.Group();
  group.name = 'portal-signs';

  for (const p of portals) {
    const root = new THREE.Group();
    root.position.set(p.x, 0, p.z);
    root.rotation.y = p.ry;
    root.userData.portal = p;

    const name = spaceLabel(p.to);
    const boardW = Math.min(1.35, p.w + 0.45);
    const nameMat = new THREE.MeshStandardMaterial({
      map: makeNameTexture(name),
      roughness: 0.85,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const namePlate = new THREE.Mesh(new THREE.PlaneGeometry(boardW - 0.06, 0.2), nameMat);
    namePlate.position.set(0, 2.48, 0.075);
    root.add(namePlate);

    group.add(root);
  }

  return {
    group,
    update: () => {
      /* 나무 문은 항상 보이므로 발광 갱신 없음 */
    },
  };
}
