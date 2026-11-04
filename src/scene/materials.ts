// 재질 모음. 텍스처는 한 번만 만들고 소품들이 이름으로 공유한다.
import * as THREE from 'three';
import { Rng } from '../core/rng';
import * as tex from './textures';

export type Materials = Record<string, THREE.Material>;

export function createMaterials(rng: Rng): Materials {
  const honey = tex.woodTexture('honey', rng.fork('honey'));
  const medium = tex.woodTexture('medium', rng.fork('medium'));
  const walnut = tex.woodTexture('walnut', rng.fork('walnut'));
  const floor = tex.woodTexture('oak', rng.fork('floor'), 1024);
  const plaster = tex.plasterTexture(rng.fork('plaster'));
  plaster.repeat.set(1, 1);

  const wood = (t: { map: THREE.Texture; rough: THREE.Texture }, roughness: number) =>
    new THREE.MeshStandardMaterial({ map: t.map, roughnessMap: t.rough, roughness, metalness: 0, vertexColors: true });

  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ vertexColors: true, ...p });

  const sofaFabric = tex.fabricTexture(rng.fork('sofa'), '#5d6b4e');
  const blanket = tex.fabricTexture(rng.fork('blanket'), '#d8c7a4');
  const chairCushion = tex.fabricTexture(rng.fork('cushion'), '#a4553a');
  const benchCushion = tex.fabricTexture(rng.fork('bench'), '#c7b38c');
  const wingbackFabric = tex.fabricTexture(rng.fork('wingback'), '#8a8e93');

  return {
    honey: wood(honey, 0.95),
    medium: wood(medium, 1.0),
    walnut: wood(walnut, 0.95),
    floor: new THREE.MeshStandardMaterial({ map: floor.map, roughnessMap: floor.rough, roughness: 1.0, vertexColors: true }),
    subfloor: new THREE.MeshStandardMaterial({ color: 0x1e140c, roughness: 1 }),
    plaster: new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.92, vertexColors: true }),
    ceiling: new THREE.MeshStandardMaterial({ map: plaster, color: 0xf3ead9, roughness: 0.95 }),
    paint: std({ color: 0xece2cc, roughness: 0.55 }),
    brass: std({ color: 0x9a7440, metalness: 0.85, roughness: 0.38 }),
    iron: std({ color: 0x2b2a26, metalness: 0.6, roughness: 0.5 }),
    pendantShade: std({ color: 0x2f3b30, metalness: 0.35, roughness: 0.45, side: THREE.DoubleSide }),
    terracotta: std({ color: 0xb9683f, roughness: 0.85 }),
    ceramic: std({ color: 0xe8e0d0, roughness: 0.35 }),
    soil: std({ color: 0x3a2a1c, roughness: 1 }),
    leaf: std({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide }),
    sofa: new THREE.MeshStandardMaterial({ map: sofaFabric, roughness: 0.95, vertexColors: true }),
    wingback: new THREE.MeshStandardMaterial({ map: wingbackFabric, roughness: 0.92, vertexColors: true }),
    blanket: new THREE.MeshStandardMaterial({ map: blanket, roughness: 0.95, vertexColors: true, side: THREE.DoubleSide }),
    cushion: new THREE.MeshStandardMaterial({ map: chairCushion, roughness: 0.95, vertexColors: true }),
    benchCushion: new THREE.MeshStandardMaterial({ map: benchCushion, roughness: 0.95, vertexColors: true }),
    rug: new THREE.MeshStandardMaterial({ map: tex.rugTexture(rng.fork('rug')), roughness: 1 }),
    paper: std({ color: 0xf2eadb, roughness: 0.9, side: THREE.DoubleSide }),
    kraft: std({ color: 0xb48b5c, roughness: 0.92, side: THREE.DoubleSide }),
    sign: new THREE.MeshStandardMaterial({ map: tex.signTexture(), roughness: 0.8 }),
    painting1: new THREE.MeshStandardMaterial({ map: tex.paintingTexture(rng.fork('p1'), ['#d8c8a8', '#9fb0a6', '#6d8076', '#3e4a43']), roughness: 0.85 }),
    painting2: new THREE.MeshStandardMaterial({ map: tex.paintingTexture(rng.fork('p2'), ['#e9d6b4', '#d39a6a', '#a8603f', '#5a3a2a']), roughness: 0.85 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfdbe0, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.12, depthWrite: false }),
    bulb: new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffc773, emissiveIntensity: 7, roughness: 0.3 }),
    lampShade: new THREE.MeshStandardMaterial({ color: 0xf1e2c3, emissive: 0xffb866, emissiveIntensity: 0.5, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.94 }),
    bookCover: new THREE.MeshStandardMaterial({ map: tex.spineAtlas(rng.fork('spine')), roughness: 0.7 }),
    bookPages: new THREE.MeshStandardMaterial({ map: tex.pageEdgeTexture(), roughness: 0.95 }),
    bookend: std({ color: 0x3a3a36, metalness: 0.7, roughness: 0.45 }),
    // 가구 밑 접지 그림자(알파 텍스처)
    contactShadow: new THREE.MeshBasicMaterial({
      color: 0x1a120b, alphaMap: tex.contactShadowTexture(), transparent: true, opacity: 0.8,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    }),
  };
}
