import * as THREE from 'three';
import { paint, merge, stripUV, xform } from './geo';

// 정점색으로 칠한 식물 지오메트리 (인스턴싱용)
function rnd(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** 다듬은 소나무: 굽은 줄기 + 납작한 잎 구름 */
export function pineGeometry() {
  const r = rnd(5);
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.13, 0.22, 2.6, 7);
  trunk.translate(0, 1.3, 0);
  parts.push(paint(stripUV(xform(trunk, [0, 0, 0], [0, 0, 0.12])), '#6b4a32'));
  const pads: [number, number, number, number][] = [
    [0.3, 2.3, 0, 1.25],
    [-0.5, 2.9, 0.2, 1.05],
    [0.45, 3.5, -0.2, 0.9],
    [0, 4.0, 0.1, 0.7],
  ];
  for (const [x, y, z, s] of pads) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    parts.push(paint(stripUV(xform(g, [x, y, z], [0, r() * 3, 0], [s * 1.3, s * 0.42, s * 1.15])), '#2e5e2b', 0.25));
  }
  return merge(parts.map((g) => g.toNonIndexed()));
}

export function shrubGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 1);
  g.scale(1, 0.75, 1);
  g.translate(0, 0.55, 0);
  return paint(stripUV(g), '#ffffff', 0.18);
}

/** 정원석 (인스턴스 색으로 회색 톤 변화) */
export function rockGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 0);
  g.scale(1.2, 0.6, 0.9);
  g.translate(0, 0.25, 0);
  return paint(stripUV(g), '#ffffff', 0.12);
}

export function gardenTreeGeometry(crown = '#4c8c3c') {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.15, 0.24, 2.4, 7);
  trunk.translate(0, 1.2, 0);
  parts.push(paint(stripUV(trunk), '#6e5038'));
  const crowns: [number, number, number, number][] = [
    [0, 3.3, 0, 1.6],
    [0.8, 2.9, 0.3, 1.1],
    [-0.7, 3.0, -0.3, 1.15],
    [0.1, 4.1, -0.2, 1.05],
  ];
  for (const [x, y, z, s] of crowns) parts.push(paint(stripUV(xform(new THREE.IcosahedronGeometry(1, 1), [x, y, z], [0, 0, 0], [s, s * 0.9, s])), crown, 0.2));
  return merge(parts.map((g) => g.toNonIndexed()));
}

export function forestTreeGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.2, 0.3, 2, 5);
  trunk.translate(0, 1, 0);
  parts.push(paint(stripUV(trunk), '#5a4030'));
  const c = new THREE.IcosahedronGeometry(1, 0);
  c.scale(2.2, 3.4, 2.2);
  c.translate(0, 4.2, 0);
  parts.push(paint(stripUV(c), '#ffffff', 0.15));
  return merge(parts.map((g) => g.toNonIndexed()));
}

export interface Placement {
  x: number;
  y: number;
  z: number;
  s?: number;
  ry?: number;
  color?: THREE.ColorRepresentation;
}
