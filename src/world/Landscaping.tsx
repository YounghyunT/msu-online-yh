import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { tex } from './textures';
import { box, merge } from './geo';
import { withSnow, cachedMat } from './materials';
import { pineGeometry, shrubGeometry, gardenTreeGeometry, forestTreeGeometry, rockGeometry, Placement } from './vegetation';
import { TERRACE1, TERRACE2, BRICK_STAIRS, PLATEAU_Y, WORLD, GATE_Z, SLOPE, FLOWER_STAIRS, RAMP_ROAD, BUILDING, FIELD, GOLF } from './layout';

const vegMat = () => cachedMat('veg', () => withSnow(new THREE.MeshLambertMaterial({ vertexColors: true })));

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export function InstancedPlants({ geo, items, castShadow = true }: { geo: THREE.BufferGeometry; items: Placement[]; castShadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    items.forEach((p, i) => {
      const s = p.s ?? 1;
      m.compose(new THREE.Vector3(p.x, p.y, p.z), q.setFromEuler(new THREE.Euler(0, p.ry ?? 0, 0)), new THREE.Vector3(s, s, s));
      ref.current.setMatrixAt(i, m);
      ref.current.setColorAt(i, c.set(p.color ?? '#ffffff'));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geo, vegMat(), items.length]} castShadow={castShadow} receiveShadow />;
}

const W0 = WORLD.minX;
const W1 = WORLD.maxX;
const sx0 = BRICK_STAIRS.x0;
const sx1 = BRICK_STAIRS.x1;

export function Landscaping() {
  const terr = useMemo(() => {
    const wall: THREE.BufferGeometry[] = [];
    const top: THREE.BufferGeometry[] = [];
    const t1d = TERRACE1.zFront - TERRACE1.zBack;
    const t2d = TERRACE2.zFront - TERRACE2.zBack;
    const t1h = TERRACE1.top - PLATEAU_Y;
    const t2h = TERRACE2.top - PLATEAU_Y;
    const t1z = (TERRACE1.zFront + TERRACE1.zBack) / 2;
    const t2z = (TERRACE2.zFront + TERRACE2.zBack) / 2;
    for (const [a, b] of [
      [W0, sx0],
      [sx1, W1],
    ]) {
      const cx = (a + b) / 2;
      const w = b - a;
      wall.push(box(w, t1h, t1d, [cx, PLATEAU_Y + t1h / 2, t1z], { uv: 3 }));
      wall.push(box(w, t2h, t2d, [cx, PLATEAU_Y + t2h / 2, t2z], { uv: 3 }));
      top.push(box(w, 0.06, t1d - 0.3, [cx, TERRACE1.top + 0.03, t1z - 0.15], { uv: 3 }));
    }
    // 2단 화단 윗면: 각 동의 앞면까지 (오른쪽 동이 뒤로 들어가 있어 화단이 더 깊다)
    for (const wing of BUILDING.wings) {
      const a = wing.side < 0 ? W0 : sx1;
      const b = wing.side < 0 ? sx0 : W1;
      const d = TERRACE2.zFront - wing.front - 0.3;
      top.push(box(b - a, 0.06, d, [(a + b) / 2, TERRACE2.top + 0.03, TERRACE2.zFront - 0.15 - d / 2], { uv: 3 }));
      // 건물 바깥쪽 끝 너머
      const oa = wing.side < 0 ? W0 : wing.x1;
      const ob = wing.side < 0 ? wing.x0 : W1;
      top.push(box(ob - oa, 0.06, wing.front - TERRACE2.zBack, [(oa + ob) / 2, TERRACE2.top + 0.03, (wing.front + TERRACE2.zBack) / 2], { uv: 3 }));
    }
    // 입구 앞 계단참 (계단 끝 ~ 건물)
    const landD = BRICK_STAIRS.zHigh - TERRACE2.zBack;
    wall.push(box(sx1 - sx0, t2h, landD, [0, PLATEAU_Y + t2h / 2, (BRICK_STAIRS.zHigh + TERRACE2.zBack) / 2], { uv: 3 }));

    // 붉은 벽돌 계단
    const steps: THREE.BufferGeometry[] = [];
    const n = 25;
    const run = (BRICK_STAIRS.zLow - BRICK_STAIRS.zHigh) / n;
    const rise = (TERRACE2.top - PLATEAU_Y) / n;
    for (let i = 0; i < n; i++) {
      const h = (i + 1) * rise;
      const zf = BRICK_STAIRS.zLow - i * run;
      steps.push(box(sx1 - sx0, h, run, [0, PLATEAU_Y + h / 2, zf - run / 2], { uv: 1.2 }));
    }
    steps.push(box(sx1 - sx0, 0.05, landD, [0, TERRACE2.top + 0.025, (BRICK_STAIRS.zHigh + TERRACE2.zBack) / 2], { uv: 1.2 }));
    return { wall: merge(wall), top: merge(top), steps: merge(steps), run, rise, n };
  }, []);

  const mats = useMemo(
    () => ({
      wall: withSnow(new THREE.MeshLambertMaterial({ map: tex.rubble() })),
      top: withSnow(new THREE.MeshLambertMaterial({ map: tex.soil() })),
      brick: withSnow(new THREE.MeshLambertMaterial({ map: tex.brick() })),
    }),
    [],
  );

  const plants = usePlants();
  const stairLen = Math.hypot(BRICK_STAIRS.zLow - BRICK_STAIRS.zHigh, TERRACE2.top - PLATEAU_Y);
  const stairAng = Math.atan2(TERRACE2.top - PLATEAU_Y, BRICK_STAIRS.zLow - BRICK_STAIRS.zHigh);
  const nrm = new THREE.Vector3(0, Math.cos(stairAng), Math.sin(stairAng));
  const sc = new THREE.Vector3(0, (PLATEAU_Y + TERRACE2.top) / 2, (BRICK_STAIRS.zLow + BRICK_STAIRS.zHigh) / 2).addScaledVector(nrm, terr.rise / 2 - 0.3);

  return (
    <group>
      <mesh geometry={terr.wall} material={mats.wall} castShadow receiveShadow />
      <mesh geometry={terr.top} material={mats.top} receiveShadow />
      <mesh geometry={terr.steps} material={mats.brick} castShadow receiveShadow />
      <InstancedPlants geo={plants.pineGeo} items={plants.pines} />
      <InstancedPlants geo={plants.shrubGeo} items={plants.shrubs} />
      <InstancedPlants geo={plants.treeGeo} items={plants.trees} />
      <InstancedPlants geo={plants.mapleGeo} items={plants.maples} />
      <InstancedPlants geo={plants.rockGeo} items={plants.rocks} />
      <InstancedPlants geo={plants.forestGeo} items={plants.forest} castShadow={false} />
      <mesh geometry={plants.hillGeo} material={vegMat()} receiveShadow />

      <RigidBody type="fixed" colliders={false}>
        {[
          [W0, sx0],
          [sx1, W1],
        ].map(([a, b]) => (
          <group key={a}>
            <CuboidCollider args={[(b - a) / 2, (TERRACE1.top - PLATEAU_Y) / 2, (TERRACE1.zFront - TERRACE1.zBack) / 2]} position={[(a + b) / 2, (TERRACE1.top + PLATEAU_Y) / 2, (TERRACE1.zFront + TERRACE1.zBack) / 2]} />
            <CuboidCollider args={[(b - a) / 2, (TERRACE2.top - PLATEAU_Y) / 2, (TERRACE2.zFront - TERRACE2.zBack) / 2]} position={[(a + b) / 2, (TERRACE2.top + PLATEAU_Y) / 2, (TERRACE2.zFront + TERRACE2.zBack) / 2]} />
          </group>
        ))}
        <CuboidCollider args={[(sx1 - sx0) / 2, (TERRACE2.top - PLATEAU_Y) / 2, (BRICK_STAIRS.zHigh - TERRACE2.zBack) / 2]} position={[0, (TERRACE2.top + PLATEAU_Y) / 2, (BRICK_STAIRS.zHigh + TERRACE2.zBack) / 2]} />
        <CuboidCollider args={[(sx1 - sx0) / 2, 0.3, stairLen / 2 + 0.3]} position={[sc.x, sc.y, sc.z]} rotation={[stairAng, 0, 0]} />
        {plants.colliders.map((p, i) => (
          <CylinderCollider key={i} args={[2, p.r]} position={[p.x, p.y + 2, p.z]} />
        ))}
      </RigidBody>
    </group>
  );
}

function usePlants() {
  return useMemo(() => {
    const r = rng(17);
    const pines: Placement[] = [];
    const shrubs: Placement[] = [];
    const trees: Placement[] = [];
    const forest: Placement[] = [];
    const maples: Placement[] = [];
    const rocks: Placement[] = [];
    const colliders: { x: number; y: number; z: number; r: number }[] = [];
    const greens = ['#3f7d34', '#4f8f3c', '#5d9a45', '#2f6a2c', '#6aa04c', '#8a9c3a'];
    const pick = () => greens[Math.floor(r() * greens.length)];
    const offStairs = (x: number, m = 1.2) => x < sx0 - m || x > sx1 + m;

    // 석축 화단 (계단식)
    for (let x = -46; x <= 46; x += 1.7) {
      if (!offStairs(x)) continue;
      shrubs.push({ x, y: TERRACE1.top, z: TERRACE1.zFront - 0.9, s: 0.55 + r() * 0.25, color: pick() });
      shrubs.push({ x: x + 0.8, y: TERRACE2.top, z: TERRACE2.zFront - 0.9, s: 0.5 + r() * 0.25, color: pick() });
    }
    for (let x = -42; x <= 42; x += 7.5) {
      if (!offStairs(x, 2.5)) continue;
      pines.push({ x: x + r() * 2, y: TERRACE1.top, z: (TERRACE1.zFront + TERRACE1.zBack) / 2 - 0.5, s: 0.8 + r() * 0.35, ry: r() * 6 });
      if (Math.abs(x) > 8) pines.push({ x: x + 3 + r() * 2, y: TERRACE2.top, z: TERRACE2.zFront - 4, s: 0.75 + r() * 0.3, ry: r() * 6 });
      shrubs.push({ x: x + 3.5, y: TERRACE1.top, z: TERRACE1.zBack + 1.6, s: 0.9 + r() * 0.4, color: pick() });
    }
    // 입구 양옆 큰 소나무 (사진 속 계단 옆)
    pines.push({ x: -4.6, y: TERRACE1.top, z: -25, s: 1.35, ry: 1 }, { x: 4.8, y: TERRACE2.top, z: -33, s: 1.2, ry: 2 });
    // 석축 아래 낮은 관목 줄
    for (let x = -50; x <= 50; x += 1.4) if (offStairs(x)) shrubs.push({ x, y: PLATEAU_Y, z: TERRACE1.zFront + 0.6, s: 0.38 + r() * 0.12, color: pick() });
    // 본관 양 끝 정원수
    for (const x of [-54, -57, 37, 41, 46]) trees.push({ x, y: TERRACE2.top, z: -36 - r() * 8, s: 1 + r() * 0.3, ry: r() * 6 });
    // 오른쪽 동 앞 넓은 정원: 붉은 단풍나무, 정원석, 둥근 관목 (사진 참고)
    const right = BUILDING.wings.find((w) => w.side > 0)!;
    const left = BUILDING.wings.find((w) => w.side < 0)!;
    for (const [x, z, s] of [
      [12, -38.5, 1.1],
      [22, -39.5, 1.25],
      [30, -38, 1.0],
      [-14, -35.3, 0.9],
      [-34, -35.6, 0.95],
    ])
      maples.push({ x, y: TERRACE2.top, z, s, ry: r() * 6 });
    for (let x = 8; x < right.x1 + 4; x += 1.6) {
      rocks.push({ x: x + r() * 0.6, y: TERRACE2.top, z: TERRACE2.zFront - 0.9 - r() * 0.6, s: 0.45 + r() * 0.35, ry: r() * 6, color: ['#a9a49c', '#8f8b84', '#bdb8ae'][Math.floor(r() * 3)] });
      if (r() < 0.55) shrubs.push({ x: x + 0.8, y: TERRACE2.top, z: right.front + 1.3 + r() * 1.5, s: 0.55 + r() * 0.35, color: pick() });
    }
    for (let x = left.x0 + 2; x < -8; x += 2.2) shrubs.push({ x, y: TERRACE2.top, z: left.front + 1.0, s: 0.5 + r() * 0.25, color: pick() });

    // 정문 주변 광장 나무
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side > 0 ? 14 + r() * 52 : -16 - r() * 40;
      const z = GATE_Z + 6 + r() * 42;
      if (Math.abs(x) < 8) continue;
      trees.push({ x, y: 0, z, s: 0.9 + r() * 0.5, ry: r() * 6 });
      colliders.push({ x, y: 0, z, r: 0.35 });
    }
    // 정문 바로 안쪽 소나무
    pines.push({ x: -9.5, y: 0, z: GATE_Z - 6, s: 1.1, ry: 0.4 }, { x: 9.5, y: 0, z: GATE_Z - 5, s: 1.0, ry: 2.2 });
    colliders.push({ x: -9.5, y: 0, z: GATE_Z - 6, r: 0.35 }, { x: 9.5, y: 0, z: GATE_Z - 5, r: 0.35 });

    // 경사 둔덕 (도로와 계단 사이, 계단 오른쪽)
    const slopeY = (z: number) => ((SLOPE.zLow - z) / (SLOPE.zLow - SLOPE.zHigh)) * SLOPE.rise;
    for (let i = 0; i < 70; i++) {
      const z = SLOPE.zHigh + 1 + r() * (SLOPE.zLow - SLOPE.zHigh - 2);
      const x = W0 + 2 + r() * (W1 - W0 - 4);
      if ((x > RAMP_ROAD.x0 - 1 && x < RAMP_ROAD.x1 + 1) || (x > FLOWER_STAIRS.x0 - 1.5 && x < FLOWER_STAIRS.x1 + 1.5)) continue;
      const y = slopeY(z);
      if (r() < 0.28) {
        trees.push({ x, y, z, s: 0.8 + r() * 0.5, ry: r() * 6 });
        colliders.push({ x, y, z, r: 0.35 });
      } else shrubs.push({ x, y: y - 0.1, z, s: 0.6 + r() * 0.7, color: pick() });
    }
    // 평지 가장자리 나무
    for (let i = 0; i < 18; i++) {
      const left = i % 2 === 0;
      const x = left ? W0 + 3 + r() * 18 : GOLF.x1 + 1.5 + r() * 4;
      const z = -18 + r() * 48;
      if (left && x > FIELD.cx - FIELD.w / 2 - 6) continue;
      trees.push({ x, y: PLATEAU_Y, z, s: 0.9 + r() * 0.5, ry: r() * 6 });
      colliders.push({ x, y: PLATEAU_Y, z, r: 0.35 });
    }

    // 뒤편 숲 언덕
    const hills: [number, number, number, number, number][] = [
      [-95, -10, -150, 95, 0.52],
      [10, -10, -165, 105, 0.55],
      [110, -10, -150, 90, 0.5],
      [-150, -15, 10, 80, 0.45],
      [170, -15, 20, 85, 0.45],
      [-140, -15, 150, 70, 0.4],
      [150, -15, 160, 70, 0.4],
    ];
    const hillParts: THREE.BufferGeometry[] = [];
    const fc = ['#2f6b2a', '#3c7a32', '#467f36', '#2a5e27', '#567f34'];
    for (const [hx, hy, hz, hr, sy] of hills) {
      const g = new THREE.SphereGeometry(hr, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(1, sy, 1);
      g.translate(hx, hy, hz);
      g.deleteAttribute('uv');
      const col = new Float32Array(g.attributes.position.count * 3);
      const c = new THREE.Color('#4a8a3a');
      for (let i = 0; i < col.length; i += 3) {
        const j = 0.85 + r() * 0.2;
        col[i] = c.r * j;
        col[i + 1] = c.g * j;
        col[i + 2] = c.b * j;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      hillParts.push(g);
      // 언덕 위 숲
      const count = Math.round(hr * 1.4);
      for (let k = 0; k < count; k++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * hr * 0.92;
        const x = hx + Math.cos(a) * d;
        const z = hz + Math.sin(a) * d;
        if (x > W0 && x < W1 && z > WORLD.minZ && z < WORLD.maxZ) continue;
        const y = hy + Math.sqrt(Math.max(0, hr * hr - d * d)) * sy - 0.5;
        if (y < 0) continue;
        forest.push({ x, y, z, s: 1.2 + r() * 1.2, ry: r() * 6, color: fc[Math.floor(r() * fc.length)] });
      }
    }
    return {
      pineGeo: pineGeometry(),
      shrubGeo: shrubGeometry(),
      treeGeo: gardenTreeGeometry(),
      mapleGeo: gardenTreeGeometry('#8e2438'),
      rockGeo: rockGeometry(),
      forestGeo: forestTreeGeometry(),
      maples,
      rocks,
      hillGeo: merge(hillParts),
      pines,
      shrubs,
      trees,
      forest,
      colliders,
    };
  }, []);
}
