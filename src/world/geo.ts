import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface BoxOpts {
  /** 텍스처 1장이 덮는 실제 크기 (m). 지정하면 면 크기에 맞춰 UV를 늘린다 */
  uv?: number;
  rot?: [number, number, number];
  color?: THREE.ColorRepresentation;
}

/** 위치가 적용된 박스 지오메트리 (월드 스케일 UV) */
export function box(w: number, h: number, d: number, pos: [number, number, number], opts: BoxOpts = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (opts.uv) {
    const uv = g.attributes.uv as THREE.BufferAttribute;
    // 면 순서: +x, -x, +y, -y, +z, -z (각 4정점)
    const dims: [number, number][] = [
      [d, h],
      [d, h],
      [w, d],
      [w, d],
      [w, h],
      [w, h],
    ];
    for (let f = 0; f < 6; f++)
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        uv.setXY(i, (uv.getX(i) * dims[f][0]) / opts.uv, (uv.getY(i) * dims[f][1]) / opts.uv);
      }
  }
  if (opts.rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...opts.rot)));
  g.translate(...pos);
  if (opts.color !== undefined) paint(g, opts.color);
  return g;
}

/** 정점 색 속성 추가 */
export function paint<T extends THREE.BufferGeometry>(g: T, color: THREE.ColorRepresentation, jitter = 0): T {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const j = jitter ? 1 + (Math.random() - 0.5) * jitter : 1;
    arr[i * 3] = c.r * j;
    arr[i * 3 + 1] = c.g * j;
    arr[i * 3 + 2] = c.b * j;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** 여러 지오메트리를 하나로 병합 (드로우콜 절약). index 유무를 맞춘다 */
export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const allIndexed = geos.every((g) => g.index);
  const final = allIndexed ? geos : geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(final, false);
  if (!merged) throw new Error('merge failed: attribute mismatch');
  merged.computeBoundingSphere();
  return merged;
}

export function xform(g: THREE.BufferGeometry, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
  g.applyMatrix4(m);
  return g;
}

/** UV를 지우고 위치/노멀(+색)만 남긴다 – 정점색 모델 병합용 */
export function stripUV<T extends THREE.BufferGeometry>(g: T): T {
  g.deleteAttribute('uv');
  return g;
}
