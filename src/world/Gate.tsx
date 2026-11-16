import { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { tex } from './textures';
import { box, merge } from './geo';
import { withSnow } from './materials';
import { FONT_SERIF } from '../loading';
import { Banner } from './Banner';
import texts from '../config/signTexts.json';
import { GATE_Z, SLOPE, FLOWER_STAIRS, WORLD } from './layout';

// ── 정문 치수 (사진 비율 기준) ──
const SHAFT_W = 1.5;
const SHAFT_H = 7.6;
const PLINTH_H = 0.45;
const ARM_L = 4.4;
const ARM_W = 1.35;
const ARM_ANGLE = (37 * Math.PI) / 180;
const BAND_W = 0.5;

/** 기둥 3개: 왼쪽부터 ① 보조기둥 ② 정문 왼쪽 ③ 정문 오른쪽. dir: 팔이 뻗는 방향(+1 오른쪽) */
export const PILLARS = [
  { x: -12.2, dir: -1, text: texts.serif[0] },
  { x: -5.4, dir: 1, text: texts.serif[1] },
  { x: 5.4, dir: -1, text: texts.serif[2] },
];

export const GATE_ARM_TIPS = PILLARS.map((p) => {
  const top = PLINTH_H + SHAFT_H;
  return { x: p.x + p.dir * Math.sin(ARM_ANGLE) * (ARM_L + 0.4), y: top + Math.cos(ARM_ANGLE) * (ARM_L + 0.4), base: [p.x, top] as [number, number], dir: p.dir };
});

const ARCH = { x0: PILLARS[0].x + SHAFT_W / 2, x1: PILLARS[1].x - SHAFT_W / 2, open: 3.0, openH: 2.3, h: 4.6, depth: 1.0 };

function armMatrix(x: number, dir: number) {
  const top = PLINTH_H + SHAFT_H - 0.45;
  return new THREE.Matrix4().compose(new THREE.Vector3(x, top, GATE_Z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -dir * ARM_ANGLE)), new THREE.Vector3(1, 1, 1));
}

export function Gate() {
  const geos = useMemo(() => {
    const stone: THREE.BufferGeometry[] = [];
    const dark: THREE.BufferGeometry[] = [];
    const orange: THREE.BufferGeometry[] = [];
    for (const p of PILLARS) {
      dark.push(box(SHAFT_W + 0.4, PLINTH_H, SHAFT_W + 0.4, [p.x, PLINTH_H / 2, GATE_Z], { uv: 1.5 }));
      stone.push(box(SHAFT_W, SHAFT_H, SHAFT_W, [p.x, PLINTH_H + SHAFT_H / 2, GATE_Z], { uv: 2 }));
      orange.push(box(BAND_W, SHAFT_H - 0.5, 0.06, [p.x, PLINTH_H + SHAFT_H / 2 + 0.05, GATE_Z + SHAFT_W / 2 + 0.03]));
      orange.push(box(BAND_W, SHAFT_H - 0.5, 0.06, [p.x, PLINTH_H + SHAFT_H / 2 + 0.05, GATE_Z - SHAFT_W / 2 - 0.03]));
      const m = armMatrix(p.x, p.dir);
      stone.push(box(ARM_W, ARM_L, ARM_W, [0, ARM_L / 2, 0], { uv: 2 }).applyMatrix4(m));
      stone.push(box(1.8, 0.95, 1.8, [0, ARM_L + 0.35, 0], { uv: 2 }).applyMatrix4(m));
      // 팔 위쪽 가장자리를 따라 이어지는 주황 띠 (앞/뒤/윗면)
      const edge = -p.dir * (ARM_W / 2 - 0.22);
      orange.push(box(0.42, ARM_L - 0.2, 0.06, [edge, ARM_L / 2 + 0.1, ARM_W / 2 + 0.03]).applyMatrix4(m));
      orange.push(box(0.42, ARM_L - 0.2, 0.06, [edge, ARM_L / 2 + 0.1, -ARM_W / 2 - 0.03]).applyMatrix4(m));
      orange.push(box(0.06, ARM_L - 0.2, ARM_W * 0.7, [-p.dir * (ARM_W / 2 + 0.03), ARM_L / 2 + 0.1, 0]).applyMatrix4(m));
    }
    // ①-② 사이 아치형 보행자 통로
    const w = ARCH.x1 - ARCH.x0;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(-ARCH.open / 2, 0);
    shape.lineTo(-ARCH.open / 2, ARCH.openH);
    shape.absarc(0, ARCH.openH, ARCH.open / 2, Math.PI, 0, true);
    shape.lineTo(ARCH.open / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(w / 2, ARCH.h);
    shape.lineTo(-w / 2, ARCH.h);
    shape.closePath();
    const arch = new THREE.ExtrudeGeometry(shape, { depth: ARCH.depth, bevelEnabled: false, curveSegments: 16 });
    const uv = arch.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
    arch.translate((ARCH.x0 + ARCH.x1) / 2, 0, GATE_Z - ARCH.depth / 2 - 0.15);
    const archGeo = merge([
      arch.toNonIndexed(),
      box(w + 0.3, 0.35, ARCH.depth + 0.3, [(ARCH.x0 + ARCH.x1) / 2, ARCH.h + 0.17, GATE_Z - 0.15], { uv: 2 }).toNonIndexed(),
    ]);

    // 정문 양옆 낮은 돌담 + 생울타리
    const wallH = 1.1;
    const wallL = [WORLD.minX, PILLARS[0].x - SHAFT_W / 2 - 0.2];
    const wallR = [PILLARS[2].x + SHAFT_W / 2 + 0.2, WORLD.maxX];
    for (const [a, b] of [wallL, wallR]) dark.push(box(b - a, wallH, 0.8, [(a + b) / 2, wallH / 2, GATE_Z - 0.2], { uv: 1.5 }));
    const hedge = merge([wallL, wallR].map(([a, b]) => box(b - a, 0.9, 1.0, [(a + b) / 2, wallH + 0.45, GATE_Z - 0.2])));

    return {
      stone: merge(stone),
      dark: merge(dark),
      orange: merge(orange),
      arch: archGeo,
      hedge,
      wallL,
      wallR,
      wallH,
    };
  }, []);

  const mats = useMemo(() => {
    const g = tex.granite();
    return {
      stone: withSnow(new THREE.MeshStandardMaterial({ map: g, bumpMap: g, bumpScale: 2.5, roughness: 0.92, color: '#e8e6e1' })),
      dark: withSnow(new THREE.MeshStandardMaterial({ map: g, roughness: 0.85, color: '#5d5c5a' })),
      orange: new THREE.MeshStandardMaterial({ color: '#e5730c', roughness: 0.5, emissive: '#3a1a00' }),
      arch: withSnow(new THREE.MeshStandardMaterial({ map: g, roughness: 0.9, color: '#d9d8d4' })),
      hedge: withSnow(new THREE.MeshLambertMaterial({ color: '#3f7a35' })),
      gold: new THREE.MeshStandardMaterial({ color: '#ffe9a6', metalness: 0.3, roughness: 0.3, emissive: '#e0b13a', emissiveIntensity: 0.55 }),
    };
  }, []);

  const sideW = (ARCH.x1 - ARCH.x0 - ARCH.open) / 2;

  return (
    <group>
      <mesh geometry={geos.stone} material={mats.stone} castShadow receiveShadow />
      <mesh geometry={geos.dark} material={mats.dark} castShadow receiveShadow />
      <mesh geometry={geos.orange} material={mats.orange} />
      <mesh geometry={geos.arch} material={mats.arch} castShadow receiveShadow />
      <mesh geometry={geos.hedge} material={mats.hedge} castShadow receiveShadow />

      {/* 금색 세로쓰기 학교 이름 (정면) */}
      {PILLARS.map((p) => (
        <Text
          key={p.x}
          font={FONT_SERIF}
          fontSize={0.36}
          lineHeight={1.08}
          anchorX="center"
          anchorY="middle"
          textAlign="center"
          position={[p.x, PLINTH_H + SHAFT_H / 2 + 0.05, GATE_Z + SHAFT_W / 2 + 0.065]}
          material={mats.gold}
          outlineWidth={0.022}
          outlineColor="#5a2e00"
        >
          {[...p.text].map((c) => (c === ' ' ? '' : c)).join('\n')}
        </Text>
      ))}

      <Banner width={PILLARS[2].x - PILLARS[1].x - SHAFT_W + 0.1} height={1.15} position={[0, 6.9, GATE_Z + 0.2]} text={texts.sans[0]} />

      <FlowerStairs />

      <RigidBody type="fixed" colliders={false}>
        {PILLARS.map((p) => (
          <CuboidCollider key={p.x} args={[SHAFT_W / 2 + 0.2, 6, SHAFT_W / 2 + 0.2]} position={[p.x, 6, GATE_Z]} />
        ))}
        <CuboidCollider args={[sideW / 2, 3, ARCH.depth / 2]} position={[ARCH.x0 + sideW / 2, 3, GATE_Z - 0.65]} />
        <CuboidCollider args={[sideW / 2, 3, ARCH.depth / 2]} position={[ARCH.x1 - sideW / 2, 3, GATE_Z - 0.65]} />
        {[geos.wallL, geos.wallR].map(([a, b]) => (
          <CuboidCollider key={a} args={[(b - a) / 2, 1.5, 0.5]} position={[(a + b) / 2, 1.5, GATE_Z - 0.2]} />
        ))}
      </RigidBody>
    </group>
  );
}

// ── 꽃 그림 계단 ──
const STEPS = 40;
const RISE = SLOPE.rise / STEPS;
const RUN = (SLOPE.zLow - SLOPE.zHigh) / STEPS;

function FlowerStairs() {
  const { stepsGeo, sideGeo, railGeo } = useMemo(() => {
    const { x0, x1 } = FLOWER_STAIRS;
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    const T = STEPS * (RISE + RUN);
    const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], v0: number, v1: number) => {
      const verts = [a, b, c, a, c, d];
      const uvs = [
        [0, v0],
        [1, v0],
        [1, v1],
        [0, v0],
        [1, v1],
        [0, v1],
      ];
      verts.forEach((p, i) => {
        pos.push(...p);
        nor.push(...n);
        uv.push(...uvs[i]);
      });
    };
    for (let i = 0; i < STEPS; i++) {
      const zf = SLOPE.zLow - i * RUN;
      const yb = i * RISE;
      const yt = (i + 1) * RISE;
      const va = (i * (RISE + RUN)) / T;
      const vb = (i * (RISE + RUN) + RISE) / T;
      const vc = ((i + 1) * (RISE + RUN)) / T;
      quad([x0, yb, zf], [x1, yb, zf], [x1, yt, zf], [x0, yt, zf], [0, 0, 1], va, vb);
      quad([x0, yt, zf], [x1, yt, zf], [x1, yt, zf - RUN], [x0, yt, zf - RUN], [0, 1, 0], vb, vc);
    }
    const stepsGeo = new THREE.BufferGeometry();
    stepsGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    stepsGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    stepsGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));

    // 양옆 낮은 돌 경계 + 난간
    const ang = Math.atan2(SLOPE.rise, SLOPE.zLow - SLOPE.zHigh);
    const len = Math.hypot(SLOPE.rise, SLOPE.zLow - SLOPE.zHigh);
    const midZ = (SLOPE.zLow + SLOPE.zHigh) / 2;
    const side: THREE.BufferGeometry[] = [];
    const rail: THREE.BufferGeometry[] = [];
    for (const x of [x0 - 0.2, x1 + 0.2]) {
      side.push(box(0.4, 0.7, len + 0.4, [x, SLOPE.rise / 2 + 0.15, midZ], { uv: 2, rot: [ang, 0, 0] }));
    }
    for (const x of [x0 - 0.2, 0, x1 + 0.2]) {
      const r = new THREE.CylinderGeometry(0.035, 0.035, len, 6);
      r.rotateX(Math.PI / 2 + ang);
      r.translate(x, SLOPE.rise / 2 + 0.95, midZ);
      rail.push(r);
      for (let k = 0; k <= 8; k++) {
        const z = SLOPE.zLow - (k / 8) * (SLOPE.zLow - SLOPE.zHigh);
        const y = ((SLOPE.zLow - z) / (SLOPE.zLow - SLOPE.zHigh)) * SLOPE.rise;
        const post = new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6);
        post.translate(x, y + 0.5, z);
        rail.push(post);
      }
    }
    return { stepsGeo, sideGeo: merge(side), railGeo: merge(rail) };
  }, []);

  const mats = useMemo(
    () => ({
      steps: withSnow(new THREE.MeshLambertMaterial({ map: tex.flowerStairs() })),
      side: withSnow(new THREE.MeshLambertMaterial({ map: tex.granite(), color: '#bdbab4' })),
      rail: new THREE.MeshStandardMaterial({ color: '#c9ccd2', metalness: 0.6, roughness: 0.35 }),
    }),
    [],
  );

  const ang = Math.atan2(SLOPE.rise, SLOPE.zLow - SLOPE.zHigh);
  const len = Math.hypot(SLOPE.rise, SLOPE.zLow - SLOPE.zHigh);
  const n = new THREE.Vector3(0, Math.cos(ang), Math.sin(ang));
  const c = new THREE.Vector3(0, SLOPE.rise / 2, (SLOPE.zLow + SLOPE.zHigh) / 2).addScaledVector(n, RISE / 2 - 0.25);

  return (
    <group>
      <mesh geometry={stepsGeo} material={mats.steps} receiveShadow />
      <mesh geometry={sideGeo} material={mats.side} receiveShadow castShadow />
      <mesh geometry={railGeo} material={mats.rail} />
      <RigidBody type="fixed" colliders={false}>
        {/* 계단 위를 자연스럽게 오르도록 계단 높이 평균에 맞춘 경사 충돌체 */}
        <CuboidCollider args={[(FLOWER_STAIRS.x1 - FLOWER_STAIRS.x0) / 2, 0.25, len / 2]} position={[c.x, c.y, c.z]} rotation={[ang, 0, 0]} />
      </RigidBody>
    </group>
  );
}
