// 포털: 나무 문틀 + 바닥 문턱(경계) + 빛나는 문 패널(펄스) + 공간 이름 간판.
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
  // 긴 이름은 조금 작게
  if (label.length >= 6) g.font = '700 42px "Noto Serif KR", "Apple SD Gothic Neo", serif';
  g.fillText(label, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 머지드 문틀·문턱(이름 간판은 glow 쪽에서 텍스처로). */
export function buildPortals(bucket: MergeBucket): void {
  for (const p of PORTALS) {
    const base = trs(p.x, 0, p.z, 0, p.ry);
    const at = (m: THREE.Matrix4) => base.clone().multiply(m);
    const h = 2.2, frame = 0.09, depth = 0.14;
    const wood = (g: THREE.BufferGeometry, grain: 'x' | 'y', m: THREE.Matrix4) => {
      projectUV(g, grain, { offset: [0.2, 0.1] });
      bucket.add('walnut', g, m);
    };
    wood(bevelBox(frame, h, depth, 0.006), 'y', at(trs(-p.w / 2 - frame / 2, h / 2, 0)));
    wood(bevelBox(frame, h, depth, 0.006), 'y', at(trs(p.w / 2 + frame / 2, h / 2, 0)));
    wood(bevelBox(p.w + frame * 2, frame, depth + 0.02, 0.006), 'x', at(trs(0, h + frame / 2, 0)));
    wood(bevelBox(p.w + frame * 2 + 0.08, 0.04, 0.28, 0.008), 'x', at(trs(0, 0.02, 0.06)));
    wood(bevelBox(p.w + frame * 2 + 0.16, 0.01, 0.42, 0.004), 'x', at(trs(0, 0.005, 0.1)));
    const boardW = Math.min(1.45, p.w + 0.5);
    wood(bevelBox(boardW, 0.28, 0.05, 0.006), 'x', at(trs(0, 2.48, 0.04)));
  }
}

/** 빛나는 문 패널(공간 그룹에 붙이고 매 프레임 update). */
export function buildPortalGlow(portals: readonly PortalDef[] = PORTALS): PortalGlow {
  const group = new THREE.Group();
  group.name = 'portal-glow';
  const mats: THREE.MeshStandardMaterial[] = [];
  const rimMats: THREE.MeshBasicMaterial[] = [];

  for (const p of portals) {
    const root = new THREE.Group();
    root.position.set(p.x, 0, p.z);
    root.rotation.y = p.ry;
    root.userData.portal = p;

    const h = 2.05;
    const glow = new THREE.MeshStandardMaterial({
      color: 0xffe6b8,
      emissive: 0xffc56a,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.72,
      roughness: 0.35,
      metalness: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    mats.push(glow);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(p.w - 0.06, h - 0.08), glow);
    panel.position.set(0, h / 2, 0.01);
    panel.renderOrder = 3;
    root.add(panel);

    // 문 안쪽 어둠(깊이감)
    const voidMat = new THREE.MeshBasicMaterial({
      color: 0x1a1610, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false,
    });
    const voidPanel = new THREE.Mesh(new THREE.PlaneGeometry(p.w - 0.1, h - 0.12), voidMat);
    voidPanel.position.set(0, h / 2, -0.02);
    root.add(voidPanel);

    // 테두리 하이라이트
    const rim = new THREE.MeshBasicMaterial({
      color: 0xffe2a8, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false,
    });
    rimMats.push(rim);
    const mkRim = (w: number, hh: number, x: number, y: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), rim);
      m.position.set(x, y, 0.03);
      m.renderOrder = 4;
      root.add(m);
    };
    mkRim(0.035, h - 0.06, -p.w / 2 + 0.02, h / 2);
    mkRim(0.035, h - 0.06, p.w / 2 - 0.02, h / 2);
    mkRim(p.w - 0.04, 0.035, 0, h - 0.05);
    mkRim(p.w - 0.04, 0.035, 0, 0.08);

    // 바닥 빛 문턱
    const sillGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(p.w + 0.2, 0.38),
      new THREE.MeshBasicMaterial({
        color: 0xffd9a0, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    sillGlow.rotation.x = -Math.PI / 2;
    sillGlow.position.set(0, 0.02, 0.12);
    sillGlow.renderOrder = 2;
    root.add(sillGlow);
    rimMats.push(sillGlow.material as THREE.MeshBasicMaterial);

    // 상단 공간 이름
    const name = spaceLabel(p.to);
    const boardW = Math.min(1.35, p.w + 0.45);
    const nameMat = new THREE.MeshBasicMaterial({
      map: makeNameTexture(name),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const namePlate = new THREE.Mesh(new THREE.PlaneGeometry(boardW - 0.06, 0.2), nameMat);
    namePlate.position.set(0, 2.48, 0.075);
    namePlate.renderOrder = 5;
    root.add(namePlate);

    group.add(root);
  }

  return {
    group,
    update: (t: number, viewer?: PortalViewer) => {
      const pulse = 1.35 + Math.sin(t * 2.2) * 0.45;
      const a = 0.55 + Math.sin(t * 2.2) * 0.18;
      for (const m of mats) m.emissiveIntensity = pulse;
      for (const m of rimMats) m.opacity = a;
      // 1인실: 시선이 문 쪽이거나 문 앞이면 표시(카메라 시선·모바일 드래그 대응)
      for (const root of group.children) {
        const portal = root.userData.portal as PortalDef | undefined;
        if (!portal) continue;
        if (viewer?.space === 'solo') {
          const near = Math.hypot(viewer.x - portal.x, viewer.z - portal.z) < 0.85;
          root.visible = near || facingPortal(portal, viewer, 0.15);
        } else {
          root.visible = true;
        }
      }
    },
  };
}
