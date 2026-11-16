import { useMemo } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { tex } from './textures';
import { box, merge } from './geo';
import { withSnow } from './materials';
import { WORLD, PLAZA, SLOPE, PLATEAU, PLATEAU_Y, RAMP_ROAD, FIELD } from './layout';

const W = WORLD.maxX - WORLD.minX;
const CX = (WORLD.maxX + WORLD.minX) / 2;
const SLOPE_RUN = SLOPE.zLow - SLOPE.zHigh;
const SLOPE_LEN = Math.hypot(SLOPE_RUN, SLOPE.rise);
const SLOPE_ANGLE = Math.atan2(SLOPE.rise, SLOPE_RUN);
const SLOPE_MID_Z = (SLOPE.zLow + SLOPE.zHigh) / 2;

/** 경사면 위 한 점의 높이 */
export const slopeY = (z: number) => ((SLOPE.zLow - z) / SLOPE_RUN) * SLOPE.rise;

/** 경사를 따라 놓이는 얇은 판 (도로, 잔디 등) */
function slopeSlab(x0: number, x1: number, thick: number, lift: number, uv: number) {
  const n = new THREE.Vector3(0, Math.cos(SLOPE_ANGLE), Math.sin(SLOPE_ANGLE));
  const c = new THREE.Vector3((x0 + x1) / 2, SLOPE.rise / 2, SLOPE_MID_Z).addScaledVector(n, lift - thick / 2);
  return box(x1 - x0, thick, SLOPE_LEN, [c.x, c.y, c.z], { uv, rot: [SLOPE_ANGLE, 0, 0] });
}

export function Terrain() {
  const { grassGeo, pavingGeo, roadGeo, lineGeo, groundMat, pavingMat, roadMat, lineMat, farGeo, farMat } = useMemo(() => {
    const plazaD = PLAZA.z1 - PLAZA.z0;
    const plateauD = PLATEAU.z1 - PLATEAU.z0;
    // 잔디: 경사면 + 평지 (운동장 자리는 운동장 메시가 덮음)
    const grassGeo = merge([
      slopeSlab(WORLD.minX, WORLD.maxX, 0.6, 0, 3),
      box(W, 1, plateauD, [CX, PLATEAU_Y - 0.5, (PLATEAU.z0 + PLATEAU.z1) / 2], { uv: 3 }),
    ]);
    const pavingGeo = box(W, 1, plazaD, [CX, -0.5, (PLAZA.z0 + PLAZA.z1) / 2], { uv: 4 });
    // 도로: 정문 통과 직선 + 경사 앞 앞마당 + 왼쪽 오르막
    const roadGeo = merge([
      box(9, 0.04, PLAZA.z1 - 62, [0, 0.02, (62 + PLAZA.z1) / 2], { uv: 4 }),
      box(RAMP_ROAD.x1 - RAMP_ROAD.x0 + 11.5, 0.04, 8, [(RAMP_ROAD.x0 + 4.5) / 2, 0.021, PLAZA.z0 + 4], { uv: 4 }),
      slopeSlab(RAMP_ROAD.x0, RAMP_ROAD.x1, 0.3, 0.05, 4),
      box(RAMP_ROAD.x1 - RAMP_ROAD.x0, 0.04, 8, [(RAMP_ROAD.x0 + RAMP_ROAD.x1) / 2, PLATEAU_Y + 0.02, SLOPE.zHigh - 4], { uv: 4 }),
    ]);
    // 노란 중앙선 (이중선)
    const n = new THREE.Vector3(0, Math.cos(SLOPE_ANGLE), Math.sin(SLOPE_ANGLE));
    const rc = (RAMP_ROAD.x0 + RAMP_ROAD.x1) / 2;
    const lineGeo = merge([
      box(0.12, 0.02, PLAZA.z1 - 66, [-0.12, 0.05, (66 + PLAZA.z1) / 2]),
      box(0.12, 0.02, PLAZA.z1 - 66, [0.12, 0.05, (66 + PLAZA.z1) / 2]),
      ...[-0.12, 0.12].map((dx) => {
        const c = new THREE.Vector3(rc + dx, SLOPE.rise / 2, SLOPE_MID_Z).addScaledVector(n, 0.07);
        return box(0.12, 0.02, SLOPE_LEN, [c.x, c.y, c.z], { rot: [SLOPE_ANGLE, 0, 0] });
      }),
    ]);
    const farGeo = new THREE.CircleGeometry(700, 32).rotateX(-Math.PI / 2).translate(0, -0.3, 0);

    const grassMap = tex.grass();
    const groundMat = withSnow(new THREE.MeshLambertMaterial({ map: grassMap }));
    const pavingMat = new THREE.MeshLambertMaterial({ map: tex.paving() });
    const roadMat = new THREE.MeshLambertMaterial({ map: tex.asphalt() });
    const lineMat = new THREE.MeshLambertMaterial({ color: '#f2c230' });
    const farMat = withSnow(new THREE.MeshLambertMaterial({ color: '#4f8a3a' }));
    return { grassGeo, pavingGeo, roadGeo, lineGeo, groundMat, pavingMat, roadMat, lineMat, farGeo, farMat };
  }, []);

  return (
    <group>
      <mesh geometry={grassGeo} material={groundMat} receiveShadow />
      <mesh geometry={pavingGeo} material={pavingMat} receiveShadow />
      <mesh geometry={roadGeo} material={roadMat} receiveShadow />
      <mesh geometry={lineGeo} material={lineMat} />
      <mesh geometry={farGeo} material={farMat} />
      <TerrainColliders />
    </group>
  );
}

function TerrainColliders() {
  const plazaD = PLAZA.z1 - PLAZA.z0;
  const plateauD = PLATEAU.z1 - PLATEAU.z0;
  const n = new THREE.Vector3(0, Math.cos(SLOPE_ANGLE), Math.sin(SLOPE_ANGLE));
  const sc = new THREE.Vector3(CX, SLOPE.rise / 2, SLOPE_MID_Z).addScaledVector(n, -1);
  const H = 40;
  return (
    <RigidBody type="fixed" colliders={false}>
      {/* 광장 */}
      <CuboidCollider args={[W / 2, 1, plazaD / 2 + 1]} position={[CX, -1, (PLAZA.z0 + PLAZA.z1) / 2 + 1]} />
      {/* 경사 */}
      <CuboidCollider args={[W / 2, 1, SLOPE_LEN / 2 + 0.6]} position={[sc.x, sc.y, sc.z]} rotation={[SLOPE_ANGLE, 0, 0]} />
      {/* 평지 */}
      <CuboidCollider args={[W / 2, 1, plateauD / 2]} position={[CX, PLATEAU_Y - 1, (PLATEAU.z0 + PLATEAU.z1) / 2]} />
      {/* 월드 경계 벽 */}
      <CuboidCollider args={[1, H, (WORLD.maxZ - WORLD.minZ) / 2]} position={[WORLD.minX - 1, H / 2, (WORLD.maxZ + WORLD.minZ) / 2]} />
      <CuboidCollider args={[1, H, (WORLD.maxZ - WORLD.minZ) / 2]} position={[WORLD.maxX + 1, H / 2, (WORLD.maxZ + WORLD.minZ) / 2]} />
      <CuboidCollider args={[W / 2, H, 1]} position={[CX, H / 2, WORLD.maxZ + 1]} />
      <CuboidCollider args={[W / 2, H, 1]} position={[CX, H / 2, WORLD.minZ - 1]} />
    </RigidBody>
  );
}

export const TERRAIN_INFO = { SLOPE_ANGLE, SLOPE_LEN, FIELD };
