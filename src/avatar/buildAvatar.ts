import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { AvatarConfig, SKIN_TONES, HAIR_COLORS, TOP_COLORS, BOTTOM_COLORS, encodeAvatar } from './avatarConfig';
import type { AnimState, EmoteId } from '../store';

// 2~3등신 아바타: 기본 도형을 정점색으로 칠해 하나의 지오메트리로 합치고
// 뼈 7개짜리 SkinnedMesh 로 만든다 → 아바타 1명 = 드로우콜 1개.
export const B = { root: 0, body: 1, head: 2, armL: 3, armR: 4, legL: 5, legR: 6 } as const;
const HIP_Y = 0.34;
const NECK_Y = 0.68;
const SHOULDER: [number, number] = [0.22, 0.63];
export const AVATAR_HEIGHT = 1.32;

type V3 = [number, number, number];

function part(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, bone: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
  g.applyMatrix4(m);
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (!g.index) {
    const idx = Array.from({ length: g.attributes.position.count }, (_, i) => i);
    g.setIndex(idx);
  }
  const n = g.attributes.position.count;
  const c = new THREE.Color(color);
  const col = new Float32Array(n * 3);
  const si = new Uint16Array(n * 4);
  const sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    si[i * 4] = bone;
    sw[i * 4] = 1;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return g;
}

const geoCache = new Map<string, THREE.BufferGeometry>();

export function avatarGeometry(cfg: AvatarConfig, lod: 0 | 1): THREE.BufferGeometry {
  const key = encodeAvatar(cfg) + ':' + lod;
  const hit = geoCache.get(key);
  if (hit) return hit;
  const s = lod === 0 ? 14 : 7;
  const skin = SKIN_TONES[cfg.skin];
  const hairC = HAIR_COLORS[cfg.hairColor];
  const topC = TOP_COLORS[cfg.top];
  const botC = BOTTOM_COLORS[cfg.bottom];
  const P: THREE.BufferGeometry[] = [];
  const sph = (r: number, ws = s, hs = Math.max(5, Math.round(s * 0.75)), ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) =>
    new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl);
  const cyl = (rt: number, rb: number, h: number, seg = s) => new THREE.CylinderGeometry(rt, rb, h, seg);

  // 다리 + 신발
  for (const [side, bone] of [
    [1, B.legL],
    [-1, B.legR],
  ] as const) {
    P.push(part(cyl(0.072, 0.066, 0.26), botC, bone, [0.1 * side, 0.21, 0]));
    P.push(part(sph(0.085), '#3b3b44', bone, [0.1 * side, 0.065, 0.03], [0, 0, 0], [1, 0.62, 1.35]));
  }
  // 몸통
  P.push(part(cyl(0.17, 0.2, 0.3), topC, B.body, [0, 0.53, 0]));
  P.push(part(sph(0.175), topC, B.body, [0, 0.665, 0], [0, 0, 0], [1, 0.45, 0.92]));
  P.push(part(cyl(0.2, 0.195, 0.1), botC, B.body, [0, 0.37, 0]));
  // 팔
  for (const [side, bone] of [
    [1, B.armL],
    [-1, B.armR],
  ] as const) {
    P.push(part(cyl(0.066, 0.058, 0.17), topC, bone, [0.245 * side, 0.555, 0], [0, 0, 0.12 * side]));
    P.push(part(cyl(0.05, 0.047, 0.12), skin, bone, [0.262 * side, 0.43, 0], [0, 0, 0.1 * side]));
    P.push(part(sph(0.058), skin, bone, [0.27 * side, 0.355, 0]));
  }
  // 머리
  const H = 0.97;
  P.push(part(sph(0.3, Math.round(s * 1.3), s), skin, B.head, [0, H, 0], [0, 0, 0], [1, 0.94, 0.95]));
  for (const side of [1, -1]) {
    P.push(part(sph(0.055), skin, B.head, [0.29 * side, 0.95, 0]));
    P.push(part(sph(0.04), '#1d1d26', B.head, [0.1 * side, 0.96, 0.262], [0, 0, 0], [1, 1.3, 0.6]));
    P.push(part(sph(0.013, 6, 4), '#ffffff', B.head, [0.088 * side, 0.985, 0.287]));
    P.push(part(sph(0.046), '#f59c9c', B.head, [0.17 * side, 0.885, 0.235], [0, 0, 0], [1, 0.6, 0.4]));
  }
  P.push(part(new THREE.BoxGeometry(0.07, 0.016, 0.02), '#b0504a', B.head, [0, 0.86, 0.278]));

  // 머리카락
  const cap = (r = 0.318) => part(sph(r, Math.round(s * 1.3), s, 0, Math.PI * 2, 0, Math.PI * 0.5), hairC, B.head, [0, H + 0.005, -0.012], [-0.32, 0, 0], [1, 0.97, 1]);
  const back = (r: number, tl: number, open = 0) =>
    part(sph(r, Math.round(s * 1.3), s, Math.PI - open, Math.PI + open * 2, 0, tl), hairC, B.head, [0, H, -0.01]);
  switch (cfg.hair) {
    case 0: // 숏컷
      P.push(cap(), back(0.316, Math.PI * 0.68));
      break;
    case 1: // 단발
      P.push(cap(0.33), back(0.338, Math.PI * 0.86, 0.62));
      break;
    case 2: {
      // 뽀글머리
      P.push(cap(0.315), back(0.315, Math.PI * 0.62));
      const n = lod === 0 ? 22 : 10;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const phi = i * 2.399;
        const theta = Math.acos(1 - t * 1.15);
        const x = Math.sin(theta) * Math.cos(phi);
        const z = Math.sin(theta) * Math.sin(phi);
        const y = Math.cos(theta);
        if (z > 0.55 && y < 0.6) continue;
        P.push(part(sph(0.095, Math.max(6, s - 4), Math.max(4, s - 8)), hairC, B.head, [x * 0.31, H + y * 0.3, z * 0.31]));
      }
      break;
    }
    case 3: // 포니테일
      P.push(cap(), back(0.316, Math.PI * 0.66));
      P.push(part(sph(0.06), hairC, B.head, [0, 1.06, -0.3]));
      P.push(part(sph(0.1), hairC, B.head, [0, 0.9, -0.37], [0.3, 0, 0], [1, 2.1, 1]));
      break;
  }

  // 모자
  switch (cfg.hat) {
    case 1: // 야구모자
      P.push(part(sph(0.335, Math.round(s * 1.3), s, 0, Math.PI * 2, 0, Math.PI * 0.5), '#2a4d8f', B.head, [0, H + 0.03, -0.01], [-0.1, 0, 0], [1, 0.88, 1.02]));
      P.push(part(cyl(0.2, 0.2, 0.025), '#2a4d8f', B.head, [0, H + 0.06, 0.3], [0.12, 0, 0], [1, 1, 0.75]));
      P.push(part(sph(0.03, 6, 4), '#f5f5f5', B.head, [0, H + 0.33, -0.01]));
      break;
    case 2: // 학사모
      P.push(part(cyl(0.27, 0.3, 0.16), '#1f1f26', B.head, [0, H + 0.24, -0.01]));
      P.push(part(new THREE.BoxGeometry(0.66, 0.035, 0.66), '#1f1f26', B.head, [0, H + 0.33, -0.01], [0, Math.PI / 4, 0]));
      P.push(part(sph(0.03, 6, 4), '#e8c14b', B.head, [0, H + 0.355, -0.01]));
      P.push(part(new THREE.BoxGeometry(0.018, 0.2, 0.018), '#e8c14b', B.head, [0.3, H + 0.24, 0.12]));
      break;
    case 3: // 산타모자
      P.push(part(new THREE.TorusGeometry(0.29, 0.06, 7, s + 4), '#f7f7f7', B.head, [0, H + 0.13, -0.01], [Math.PI / 2 - 0.25, 0, 0]));
      P.push(part(new THREE.ConeGeometry(0.29, 0.5, s), '#d62e36', B.head, [0.05, H + 0.37, -0.08], [-0.25, 0, -0.35]));
      P.push(part(sph(0.075), '#f7f7f7', B.head, [0.15, H + 0.58, -0.14]));
      break;
  }

  // 안경
  if (cfg.glasses) {
    for (const side of [1, -1]) P.push(part(new THREE.TorusGeometry(0.066, 0.012, 5, lod === 0 ? 16 : 8), '#262630', B.head, [0.1 * side, 0.96, 0.29]));
    P.push(part(new THREE.BoxGeometry(0.07, 0.014, 0.014), '#262630', B.head, [0, 0.975, 0.3]));
  }

  const g = mergeGeometries(P, false)!;
  g.computeBoundingSphere();
  g.computeBoundingBox();
  P.forEach((p) => p.dispose());
  geoCache.set(key, g);
  return g;
}

let sharedMat: THREE.MeshLambertMaterial | null = null;
export function avatarMaterial() {
  return (sharedMat ??= new THREE.MeshLambertMaterial({ vertexColors: true }));
}

export interface AvatarRig {
  mesh: THREE.SkinnedMesh;
  bones: THREE.Bone[];
}

export function createRig(cfg: AvatarConfig, lod: 0 | 1 = 0): AvatarRig {
  const bones = Array.from({ length: 7 }, () => new THREE.Bone());
  const [root, body, head, armL, armR, legL, legR] = bones;
  body.position.set(0, HIP_Y, 0);
  head.position.set(0, NECK_Y - HIP_Y, 0);
  armL.position.set(SHOULDER[0], SHOULDER[1] - HIP_Y, 0);
  armR.position.set(-SHOULDER[0], SHOULDER[1] - HIP_Y, 0);
  legL.position.set(0.1, HIP_Y, 0);
  legR.position.set(-0.1, HIP_Y, 0);
  root.add(body, legL, legR);
  body.add(head, armL, armR);
  const mesh = new THREE.SkinnedMesh(avatarGeometry(cfg, lod), avatarMaterial());
  mesh.add(root);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = true;
  // 뼈의 지역 좌표 오프셋 (애니메이션 기준)
  bones.forEach((b) => b.userData.base = b.position.clone());
  return { mesh, bones };
}

/** 절차적 애니메이션 */
export function animateRig(rig: AvatarRig, anim: AnimState, time: number, emote: { id: EmoteId; at: number } | null | undefined) {
  const [root, body, head, armL, armR, legL, legR] = rig.bones;
  let swing = 0;
  let bob = 0;
  let lean = 0;
  const reset = () => {
    for (const b of rig.bones) b.rotation.set(0, 0, 0);
    root.position.set(0, 0, 0);
    body.position.copy(body.userData.base);
  };
  reset();

  if (emote && time - emote.at < 2.6) {
    const e = time - emote.at;
    if (emote.id === 'wave') {
      armR.rotation.z = -2.5;
      armR.rotation.x = Math.sin(e * 12) * 0.35;
      head.rotation.z = Math.sin(e * 6) * 0.12;
      body.rotation.z = Math.sin(e * 6) * 0.04;
      return;
    }
    if (emote.id === 'jump') {
      const p = (e * 2.2) % 1;
      root.position.y = Math.sin(p * Math.PI) * 0.55;
      armL.rotation.z = 2.6;
      armR.rotation.z = -2.6;
      legL.rotation.x = -Math.sin(p * Math.PI) * 0.5;
      legR.rotation.x = -Math.sin(p * Math.PI) * 0.5;
      return;
    }
    if (emote.id === 'dance') {
      const w = e * 9;
      root.position.y = Math.abs(Math.sin(w)) * 0.12;
      body.rotation.y = Math.sin(w * 0.5) * 0.6;
      body.rotation.z = Math.sin(w) * 0.12;
      armL.rotation.z = 1.6 + Math.sin(w) * 0.9;
      armR.rotation.z = -1.6 + Math.sin(w) * 0.9;
      head.rotation.z = -Math.sin(w) * 0.2;
      legL.rotation.z = Math.max(0, Math.sin(w)) * 0.4;
      legR.rotation.z = -Math.max(0, -Math.sin(w)) * 0.4;
      return;
    }
  }

  switch (anim) {
    case 'walk':
      swing = Math.sin(time * 9) * 0.65;
      bob = Math.abs(Math.cos(time * 9)) * 0.035;
      lean = 0.06;
      break;
    case 'run':
      swing = Math.sin(time * 14) * 1.0;
      bob = Math.abs(Math.cos(time * 14)) * 0.07;
      lean = 0.22;
      break;
    case 'jump':
      legL.rotation.x = -0.7;
      legR.rotation.x = 0.3;
      armL.rotation.z = 0.9;
      armR.rotation.z = -0.9;
      armL.rotation.x = -0.5;
      armR.rotation.x = 0.5;
      return;
    default: {
      const br = Math.sin(time * 2.2);
      body.position.y = body.userData.base.y + br * 0.008;
      head.rotation.z = Math.sin(time * 0.9) * 0.04;
      armL.rotation.z = 0.08 + br * 0.03;
      armR.rotation.z = -0.08 - br * 0.03;
      return;
    }
  }
  legL.rotation.x = swing;
  legR.rotation.x = -swing;
  armL.rotation.x = -swing * 0.8;
  armR.rotation.x = swing * 0.8;
  armL.rotation.z = 0.12;
  armR.rotation.z = -0.12;
  root.position.y = bob;
  body.rotation.x = lean;
  head.rotation.x = -lean * 0.6;
}
