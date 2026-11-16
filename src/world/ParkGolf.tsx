import { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { tex } from './textures';
import { box, merge } from './geo';
import { withSnow } from './materials';
import { FONT_SANS } from '../loading';
import { GOLF } from './layout';
import { HOLES, borderWalls, COURSE_Y, BORDER_H, CUP_R, Wall } from './golfCourse';

const Y = COURSE_Y;

export function ParkGolf() {
  const g = useMemo(() => {
    const fair: THREE.BufferGeometry[] = [];
    const wood: THREE.BufferGeometry[] = [];
    const dark: THREE.BufferGeometry[] = [];
    const white: THREE.BufferGeometry[] = [];
    const red: THREE.BufferGeometry[] = [];
    const walls: Wall[] = [];
    for (const h of HOLES) {
      const p = new THREE.PlaneGeometry(h.x1 - h.x0, h.z1 - h.z0);
      p.rotateX(-Math.PI / 2);
      const uv = p.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (h.x1 - h.x0)) / 6, (uv.getY(i) * (h.z1 - h.z0)) / 6);
      p.translate((h.x0 + h.x1) / 2, Y + 0.03, (h.z0 + h.z1) / 2);
      fair.push(p);
      walls.push(...borderWalls(h), ...h.obstacles);
      // 티 매트
      dark.push(box(1.4, 0.03, 1.4, [h.tee[0], Y + 0.045, h.tee[1]]));
      // 홀컵 + 깃발
      const cup = new THREE.CylinderGeometry(CUP_R, CUP_R, 0.03, 24);
      cup.translate(h.cup[0], Y + 0.05, h.cup[1]);
      dark.push(cup);
      const ring = new THREE.TorusGeometry(CUP_R + 0.03, 0.025, 6, 24);
      ring.rotateX(Math.PI / 2);
      ring.translate(h.cup[0], Y + 0.06, h.cup[1]);
      white.push(ring);
      const pole = new THREE.CylinderGeometry(0.025, 0.025, 2.2, 6);
      pole.translate(h.cup[0], Y + 1.1, h.cup[1]);
      white.push(pole);
      const flag = new THREE.BufferGeometry();
      const fx = h.cup[0];
      const fz = h.cup[1];
      flag.setAttribute('position', new THREE.Float32BufferAttribute([fx, Y + 2.2, fz, fx, Y + 1.7, fz, fx + 0.75, Y + 1.95, fz], 3));
      flag.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
      flag.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2));
      red.push(flag);
    }
    for (const w of walls) wood.push(box(w.w, BORDER_H, w.d, [w.x, Y + BORDER_H / 2, w.z], { uv: 1 }));
    // 입구 표지판
    const [ex, , ez] = GOLF.entrance;
    wood.push(box(0.15, 2.4, 0.15, [ex, Y + 1.2, ez - 1.2], { uv: 1 }));
    wood.push(box(0.15, 2.4, 0.15, [ex, Y + 1.2, ez + 1.2], { uv: 1 }));
    wood.push(box(0.12, 0.9, 3.0, [ex, Y + 2.1, ez], { uv: 1 }));
    // 코스 바깥 낮은 나무 울타리 (입구 쪽은 열려 있음)
    const fence: [number, number, number, number][] = [
      [GOLF.x0 - 0.6, GOLF.z0, GOLF.x0 - 0.6, ez - 2],
      [GOLF.x0 - 0.6, ez + 2, GOLF.x0 - 0.6, GOLF.z1],
      [GOLF.x0 - 0.6, GOLF.z1, GOLF.x1, GOLF.z1],
      [GOLF.x0 - 0.6, GOLF.z0, GOLF.x1, GOLF.z0],
      [GOLF.x1, GOLF.z0, GOLF.x1, GOLF.z1],
    ];
    for (const [ax, az, bx, bz] of fence) {
      const len = Math.hypot(bx - ax, bz - az);
      const horiz = Math.abs(bx - ax) > Math.abs(bz - az);
      wood.push(box(horiz ? len : 0.1, 0.08, horiz ? 0.1 : len, [(ax + bx) / 2, Y + 0.75, (az + bz) / 2], { uv: 1 }));
      const n = Math.max(1, Math.round(len / 2.5));
      for (let i = 0; i <= n; i++) wood.push(box(0.12, 0.9, 0.12, [ax + ((bx - ax) * i) / n, Y + 0.45, az + ((bz - az) * i) / n], { uv: 1 }));
    }
    return { fair: merge(fair), wood: merge(wood), dark: merge(dark), white: merge(white), red: merge(red), walls, fence };
  }, []);

  const m = useMemo(
    () => ({
      fair: withSnow(new THREE.MeshLambertMaterial({ map: tex.fairway() })),
      wood: withSnow(new THREE.MeshLambertMaterial({ map: tex.wood() })),
      dark: new THREE.MeshLambertMaterial({ color: '#1f3a22' }),
      white: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
      red: new THREE.MeshLambertMaterial({ color: '#e23b3b', side: THREE.DoubleSide }),
    }),
    [],
  );

  const [ex, , ez] = GOLF.entrance;
  return (
    <group>
      <mesh geometry={g.fair} material={m.fair} receiveShadow />
      <mesh geometry={g.wood} material={m.wood} castShadow receiveShadow />
      <mesh geometry={g.dark} material={m.dark} />
      <mesh geometry={g.white} material={m.white} />
      <mesh geometry={g.red} material={m.red} />
      <Text font={FONT_SANS} fontSize={0.48} color="#fff8e6" anchorX="center" anchorY="middle" position={[ex - 0.07, Y + 2.15, ez]} rotation={[0, -Math.PI / 2, 0]} outlineWidth={0.02} outlineColor="#5a3517">
        파크골프장
      </Text>
      {HOLES.map((h) => (
        <Text key={h.name} font={FONT_SANS} fontSize={0.7} color="#ffffff" anchorX="center" anchorY="middle" position={[h.tee[0], Y + 0.08, h.tee[1] + (h.tee[1] > h.cup[1] ? 1.6 : -1.6)]} rotation={[-Math.PI / 2, 0, h.tee[1] > h.cup[1] ? 0 : Math.PI]} outlineWidth={0.04} outlineColor="#2b5d2b">
          {h.name}
        </Text>
      ))}
      <RigidBody type="fixed" colliders={false} restitution={0.6} friction={0.2}>
        {g.walls.map((w, i) => (
          <CuboidCollider key={i} args={[w.w / 2, BORDER_H / 2 + 0.05, w.d / 2]} position={[w.x, Y + BORDER_H / 2 + 0.05, w.z]} />
        ))}
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        {g.fence.map(([ax, az, bx, bz], i) => (
          <CuboidCollider key={i} args={[Math.max(0.1, Math.abs(bx - ax) / 2), 0.6, Math.max(0.1, Math.abs(bz - az) / 2)]} position={[(ax + bx) / 2, Y + 0.6, (az + bz) / 2]} />
        ))}
      </RigidBody>
    </group>
  );
}
