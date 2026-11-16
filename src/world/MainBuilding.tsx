import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { tex } from './textures';
import { box, merge } from './geo';
import { withSnow } from './materials';
import { env } from './Environment';
import { BUILDING, Wing } from './layout';

// ── 본관: 크림색 유럽풍 건물 (왼쪽 동은 길고 앞으로, 오른쪽 동은 짧고 뒤로) ──
const { baseY, floorH, tower: T, wings: WINGS } = BUILDING;
const GROUND_H = 3.6;
const ARCADE_Y = baseY + GROUND_H + floorH * 3; // 최상층(아케이드) 바닥
const ARCADE_H = 3.9;
const WING_TOP = ARCADE_Y + ARCADE_H;
const TOWER_TOP = WING_TOP + 4.2;
const TOWER_CX = (T.x0 + T.x1) / 2;
const TOWER_W = T.x1 - T.x0;
const TOWER_MID_Z = (T.front + T.back) / 2;

const floorY = (i: number) => (i === 0 ? baseY : baseY + GROUND_H + floorH * (i - 1));
const bayW = (w: Wing) => (w.x1 - w.x0) / w.bays;
const bayCenter = (w: Wing, b: number) => w.x0 + bayW(w) * (b + 0.5);

/** 크리스마스 전구용 처마 위치 */
export const BUILDING_EAVES = {
  segments: WINGS.map((w) => ({ x0: w.x0, x1: w.x1, y: WING_TOP + 0.55, z: w.front + 0.55 })),
  towerTop: TOWER_TOP,
  towerFront: T.front,
  tower: T,
};

const M = (x: number, y: number, z: number, ry = 0, sy = 1, sx = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, 1));

function windowMatrices() {
  const list: THREE.Matrix4[] = [];
  for (const w of WINGS) {
    const half = bayW(w) * 0.22;
    for (let b = 0; b < w.bays; b++) {
      const cx = bayCenter(w, b);
      for (let f = 0; f < 4; f++) {
        const y = floorY(f) + (f === 0 ? 1.0 : 0.85) + 0.95;
        for (const dx of [-half, half]) list.push(M(cx + dx, y, w.front + 0.02));
      }
    }
    // 바깥쪽 끝 측면 창
    const endX = w.side < 0 ? w.x0 - 0.02 : w.x1 + 0.02;
    const depth = w.front - w.back;
    for (let f = 0; f < 4; f++) for (let k = 1; k <= 3; k++) list.push(M(endX, floorY(f) + 1.85, w.front - (depth * k) / 4, (w.side * Math.PI) / 2));
  }
  return list;
}

function arcadeMatrices() {
  const list: THREE.Matrix4[] = [];
  for (const w of WINGS) {
    const half = bayW(w) * 0.23;
    const sx = Math.min(1, bayW(w) / 4.4);
    for (let b = 0; b < w.bays; b++) for (const dx of [-half, half]) list.push(M(bayCenter(w, b) + dx, ARCADE_Y + 1.85, w.front + 0.02, 0, 1, sx));
  }
  return list;
}

function towerMatrices() {
  const list: THREE.Matrix4[] = [];
  const xs = [-3.3, -1.1, 1.1, 3.3].map((x) => x + TOWER_CX);
  for (const x of xs) {
    list.push(M(x, floorY(1) + 2.6, T.front + 0.02));
    list.push(M(x, floorY(3) + 2.4, T.front + 0.02, 0, 0.92));
    list.push(M(x, WING_TOP + 1.3, T.front + 0.02, 0, 0.55, 0.9));
  }
  // 오른쪽 동이 뒤로 들어가 드러난 탑의 오른쪽 옆면
  const right = WINGS.find((w) => w.side > 0)!;
  const exposed = right.front - T.front;
  if (exposed < -1.5) {
    const z = (T.front + right.front) / 2;
    list.push(M(T.x1 + 0.02, floorY(1) + 2.6, z, Math.PI / 2), M(T.x1 + 0.02, floorY(3) + 2.4, z, Math.PI / 2, 0.92));
  }
  // 탑 양옆 위쪽 (날개보다 높은 부분)
  for (const s of [-1, 1]) list.push(M(s < 0 ? T.x0 - 0.02 : T.x1 + 0.02, WING_TOP + 1.3, TOWER_MID_Z, (s * Math.PI) / 2, 0.55, 0.9));
  return list;
}

function Instanced({ geo, mat, matrices, castShadow }: { geo: THREE.BufferGeometry; mat: THREE.Material; matrices: THREE.Matrix4[]; castShadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    matrices.forEach((m, i) => ref.current.setMatrixAt(i, m));
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [matrices]);
  return <instancedMesh ref={ref} args={[geo, mat, matrices.length]} castShadow={castShadow} />;
}

export function MainBuilding() {
  const data = useMemo(() => {
    const walls: THREE.BufferGeometry[] = [];
    const trim: THREE.BufferGeometry[] = [];
    const pink: THREE.BufferGeometry[] = [];
    const roof: THREE.BufferGeometry[] = [];
    const H = WING_TOP - baseY;

    for (const w of WINGS) {
      const cx = (w.x0 + w.x1) / 2;
      const len = w.x1 - w.x0;
      const depth = w.front - w.back;
      const mz = (w.front + w.back) / 2;
      // 몸체
      walls.push(box(len, H, depth, [cx, baseY + H / 2, mz], { uv: 3 }));
      // 벽기둥(필라스터)
      for (let b = 0; b <= w.bays; b++) trim.push(box(0.6, ARCADE_Y - baseY, 0.32, [w.x0 + bayW(w) * b, (ARCADE_Y + baseY) / 2, w.front + 0.16], { uv: 3 }));
      // 아케이드 층 가는 기둥
      for (let b = 0; b < w.bays; b++) trim.push(box(0.32, ARCADE_H - 0.3, 0.25, [bayCenter(w, b), ARCADE_Y + ARCADE_H / 2 - 0.1, w.front + 0.12], { uv: 3 }));
      // 바깥쪽 모서리 기둥 (측면)
      const endX = w.side < 0 ? w.x0 : w.x1;
      trim.push(box(0.4, ARCADE_Y - baseY, 0.6, [endX + w.side * 0.15, (ARCADE_Y + baseY) / 2, w.front - 0.3], { uv: 3 }));
      // 층 구분 띠
      for (let f = 1; f <= 4; f++) trim.push(box(len, 0.22, 0.42, [cx, f === 4 ? ARCADE_Y : floorY(f), w.front + 0.21], { uv: 3 }));
      trim.push(box(len + 0.4, 0.5, depth + 0.4, [cx, baseY + 0.25, mz], { uv: 3 }));
      // 처마(분홍빛 베이지) + 아케이드 아래 띠 + 지붕
      pink.push(box(len + 1.0, 0.55, depth + 1.1, [cx, WING_TOP + 0.27, mz], { uv: 3 }));
      pink.push(box(len, 0.3, 0.3, [cx, ARCADE_Y + 0.15, w.front + 0.15], { uv: 3 }));
      roof.push(box(len + 0.4, 0.5, depth + 0.2, [cx, WING_TOP + 0.8, mz], { uv: 4 }));
      roof.push(box(len + 0.4, 0.7, 0.25, [cx, WING_TOP + 1.3, w.front + 0.3], { uv: 4 }));
    }

    // 중앙 탑
    const tDepth = T.front - T.back;
    walls.push(box(TOWER_W, TOWER_TOP - baseY, tDepth, [TOWER_CX, (TOWER_TOP + baseY) / 2, TOWER_MID_Z], { uv: 3 }));
    for (const x of [T.x0, T.x1]) trim.push(box(0.8, TOWER_TOP - baseY, 0.4, [x, (TOWER_TOP + baseY) / 2, T.front + 0.2], { uv: 3 }));
    for (let f = 1; f <= 4; f++) trim.push(box(TOWER_W, 0.22, 0.42, [TOWER_CX, f === 4 ? ARCADE_Y : floorY(f), T.front + 0.21], { uv: 3 }));
    pink.push(box(TOWER_W + 1.2, 0.6, tDepth + 1.2, [TOWER_CX, TOWER_TOP + 0.3, TOWER_MID_Z], { uv: 3 }));
    pink.push(box(TOWER_W + 0.4, 0.3, 0.5, [TOWER_CX, WING_TOP + 0.2, T.front + 0.25], { uv: 3 }));
    // 탑 꼭대기 장식 (계단식 블록 + 모서리 첨탑)
    const cz = TOWER_MID_Z + 2;
    walls.push(box(8, 1.5, 8, [TOWER_CX, TOWER_TOP + 1.35, cz], { uv: 3 }));
    pink.push(box(8.6, 0.35, 8.6, [TOWER_CX, TOWER_TOP + 2.2, cz], { uv: 3 }));
    walls.push(box(4.2, 1.6, 4.2, [TOWER_CX, TOWER_TOP + 3.15, cz], { uv: 3 }));
    pink.push(box(4.8, 0.3, 4.8, [TOWER_CX, TOWER_TOP + 4.05, cz], { uv: 3 }));
    for (const [dx, dz] of [
      [-3.8, -3.8],
      [3.8, -3.8],
      [-3.8, 3.8],
      [3.8, 3.8],
    ])
      walls.push(box(0.5, 1.4, 0.5, [TOWER_CX + dx, TOWER_TOP + 1.3, cz + dz], { uv: 3 }));

    // 입구 + 발코니
    const door = box(3.4, 3.2, 0.3, [TOWER_CX, baseY + 1.6, T.front + 0.05]);
    const balcony = box(5.6, 0.25, 1.8, [TOWER_CX, floorY(1) + 0.1, T.front + 0.9], { uv: 2 });
    const rails: THREE.BufferGeometry[] = [box(5.6, 0.06, 0.06, [TOWER_CX, floorY(1) + 1.1, T.front + 1.78])];
    for (let i = 0; i <= 14; i++) rails.push(box(0.04, 1.0, 0.04, [TOWER_CX - 2.8 + i * 0.4, floorY(1) + 0.65, T.front + 1.78]));
    for (const s of [-1, 1]) rails.push(box(0.06, 0.06, 1.8, [TOWER_CX + s * 2.8, floorY(1) + 1.1, T.front + 0.9]));

    const wins = windowMatrices();
    const towers = towerMatrices();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const off = new THREE.Matrix4().makeTranslation(0, 0, 0.015);
    return {
      walls: merge(walls),
      trim: merge(trim),
      pink: merge(pink),
      roof: merge(roof),
      door,
      balcony,
      rails: merge(rails),
      winGeo: new THREE.PlaneGeometry(1.35, 1.9),
      arcGeo: new THREE.PlaneGeometry(1.7, 2.9),
      tallGeo: new THREE.PlaneGeometry(1.05, 4.2),
      wins,
      arcs: arcadeMatrices(),
      towers,
      // 크리스마스 모드에서 불 켜지는 창 (약 35%)
      lit: wins.filter(() => rnd() < 0.35).map((m) => m.clone().multiply(off)),
      litTower: towers.map((m) => m.clone().multiply(off)),
    };
  }, []);

  const mats = useMemo(() => {
    const cream = tex.cream();
    return {
      walls: withSnow(new THREE.MeshLambertMaterial({ map: cream })),
      trim: withSnow(new THREE.MeshLambertMaterial({ map: cream, color: '#fffaf0' })),
      pink: withSnow(new THREE.MeshLambertMaterial({ map: cream, color: '#e8c3b0' })),
      roof: withSnow(new THREE.MeshLambertMaterial({ color: '#9b8f86' })),
      door: new THREE.MeshLambertMaterial({ color: '#3b3330' }),
      balcony: new THREE.MeshLambertMaterial({ map: cream, color: '#f4ece0' }),
      rails: new THREE.MeshLambertMaterial({ color: '#222226' }),
      win: new THREE.MeshLambertMaterial({ map: tex.window() }),
      arc: new THREE.MeshLambertMaterial({ map: tex.archWindow() }),
      tall: new THREE.MeshLambertMaterial({ map: tex.tallArch() }),
      lit: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.05, 0.5), transparent: true, opacity: 0, toneMapped: false, depthWrite: false }),
    };
  }, []);

  const litGroup = useRef<THREE.Group>(null!);
  useFrame(() => {
    mats.lit.opacity = env.t * 0.95;
    litGroup.current.visible = env.t > 0.01;
  });

  return (
    <group>
      <mesh geometry={data.walls} material={mats.walls} castShadow receiveShadow />
      <mesh geometry={data.trim} material={mats.trim} castShadow receiveShadow />
      <mesh geometry={data.pink} material={mats.pink} castShadow receiveShadow />
      <mesh geometry={data.roof} material={mats.roof} castShadow receiveShadow />
      <mesh geometry={data.door} material={mats.door} />
      <mesh geometry={data.balcony} material={mats.balcony} castShadow />
      <mesh geometry={data.rails} material={mats.rails} />
      <Instanced geo={data.winGeo} mat={mats.win} matrices={data.wins} />
      <Instanced geo={data.arcGeo} mat={mats.arc} matrices={data.arcs} />
      <Instanced geo={data.tallGeo} mat={mats.tall} matrices={data.towers} />
      <group ref={litGroup} visible={false}>
        <Instanced geo={data.winGeo} mat={mats.lit} matrices={data.lit} />
        <Instanced geo={data.tallGeo} mat={mats.lit} matrices={data.litTower} />
      </group>
      <RigidBody type="fixed" colliders={false}>
        {WINGS.map((w) => (
          <CuboidCollider
            key={w.x0}
            args={[(w.x1 - w.x0) / 2, (WING_TOP - baseY) / 2 + 1, (w.front - w.back) / 2]}
            position={[(w.x0 + w.x1) / 2, (WING_TOP + baseY) / 2, (w.front + w.back) / 2]}
          />
        ))}
        <CuboidCollider args={[TOWER_W / 2, (TOWER_TOP - baseY) / 2, (T.front - T.back) / 2]} position={[TOWER_CX, (TOWER_TOP + baseY) / 2, TOWER_MID_Z]} />
      </RigidBody>
    </group>
  );
}
