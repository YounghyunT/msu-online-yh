import { useMemo } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { tex } from './textures';
import { box, merge } from './geo';
import { withSnow } from './materials';
import { FIELD, PLATEAU_Y } from './layout';

const GOAL_W = 7.32;
const GOAL_H = 2.44;
const GOAL_D = 2.0;
const LINE_X = FIELD.w / 2 - 1.2; // 골라인 (텍스처 여백 1.2m)
const FENCE_X = FIELD.cx - FIELD.w / 2 - 2.5;
const FENCE_H = 4.5;

export function Field() {
  const g = useMemo(() => {
    const turf = new THREE.PlaneGeometry(FIELD.w, FIELD.d);
    turf.rotateX(-Math.PI / 2);
    turf.translate(FIELD.cx, PLATEAU_Y + 0.025, FIELD.cz);

    // 골대 (흰 프레임 + 그물)
    const frame: THREE.BufferGeometry[] = [];
    const net: THREE.BufferGeometry[] = [];
    const r = 0.06;
    for (const s of [-1, 1]) {
      const x = FIELD.cx + s * LINE_X;
      const bx = x + s * GOAL_D;
      for (const dz of [-GOAL_W / 2, GOAL_W / 2]) {
        frame.push(box(r * 2, GOAL_H, r * 2, [x, PLATEAU_Y + GOAL_H / 2, FIELD.cz + dz]));
        frame.push(box(r, GOAL_H * 0.6, r, [bx, PLATEAU_Y + GOAL_H * 0.3, FIELD.cz + dz]));
        // 위쪽 사선 지지대
        const len = Math.hypot(GOAL_D, GOAL_H * 0.4);
        frame.push(box(len, r, r, [(x + bx) / 2, PLATEAU_Y + GOAL_H * 0.8, FIELD.cz + dz], { rot: [0, 0, s * -Math.atan2(GOAL_H * 0.4, GOAL_D)] }));
        frame.push(box(GOAL_D, r, r, [(x + bx) / 2, PLATEAU_Y + 0.03, FIELD.cz + dz]));
      }
      frame.push(box(r * 2, r * 2, GOAL_W + r * 2, [x, PLATEAU_Y + GOAL_H, FIELD.cz]));
      frame.push(box(r, r, GOAL_W, [bx, PLATEAU_Y + GOAL_H * 0.6, FIELD.cz]));
      frame.push(box(r, r, GOAL_W, [bx, PLATEAU_Y + 0.03, FIELD.cz]));
      // 그물 판: 뒤, 양옆, 위
      const back = new THREE.PlaneGeometry(GOAL_W, GOAL_H * 0.6);
      back.rotateY(Math.PI / 2);
      back.translate(bx, PLATEAU_Y + GOAL_H * 0.3, FIELD.cz);
      net.push(back);
      for (const dz of [-GOAL_W / 2, GOAL_W / 2]) {
        const side = new THREE.PlaneGeometry(GOAL_D, GOAL_H * 0.8);
        side.translate((x + bx) / 2, PLATEAU_Y + GOAL_H * 0.4, FIELD.cz + dz);
        net.push(side);
      }
      const topLen = Math.hypot(GOAL_D, GOAL_H * 0.4);
      const top = new THREE.PlaneGeometry(topLen, GOAL_W);
      top.rotateX(-Math.PI / 2);
      top.rotateZ(s * -Math.atan2(GOAL_H * 0.4, GOAL_D));
      top.translate((x + bx) / 2, PLATEAU_Y + GOAL_H * 0.8, FIELD.cz);
      net.push(top);
    }
    const netGeo = merge(net);
    const uv = netGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 12, uv.getY(i) * 8);

    // 왼쪽 가장자리: 초록 펜스 + 벽화 낮은 벽
    const posts: THREE.BufferGeometry[] = [];
    const z0 = FIELD.cz - FIELD.d / 2 - 2;
    const z1 = FIELD.cz + FIELD.d / 2 + 2;
    for (let z = z0; z <= z1 + 0.01; z += 3) posts.push(box(0.12, FENCE_H, 0.12, [FENCE_X, PLATEAU_Y + FENCE_H / 2, z]));
    posts.push(box(0.1, 0.1, z1 - z0, [FENCE_X, PLATEAU_Y + FENCE_H, (z0 + z1) / 2]));
    const fence = new THREE.PlaneGeometry(z1 - z0, FENCE_H - 1.3);
    fence.rotateY(Math.PI / 2);
    fence.translate(FENCE_X, PLATEAU_Y + 1.3 + (FENCE_H - 1.3) / 2, (z0 + z1) / 2);
    const fuv = fence.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < fuv.count; i++) fuv.setXY(i, (fuv.getX(i) * (z1 - z0)) / 0.25, (fuv.getY(i) * (FENCE_H - 1.3)) / 0.25);
    const mural = box(0.3, 1.3, z1 - z0, [FENCE_X + 0.15, PLATEAU_Y + 0.65, (z0 + z1) / 2]);
    const muv = mural.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < muv.count; i++) muv.setXY(i, muv.getX(i) * 4, muv.getY(i));

    return { turf, frame: merge(frame), net: netGeo, posts: merge(posts), fence, mural, z0, z1 };
  }, []);

  const m = useMemo(() => {
    const chain = tex.chainLink();
    const net = tex.net();
    return {
      turf: withSnow(new THREE.MeshLambertMaterial({ map: tex.turf() })),
      frame: new THREE.MeshLambertMaterial({ color: '#f6f6f6' }),
      net: new THREE.MeshLambertMaterial({ map: net, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, depthWrite: false }),
      posts: new THREE.MeshLambertMaterial({ color: '#2f7a40' }),
      fence: new THREE.MeshLambertMaterial({ map: chain, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }),
      mural: new THREE.MeshLambertMaterial({ map: tex.mural() }),
    };
  }, []);

  return (
    <group>
      <mesh geometry={g.turf} material={m.turf} receiveShadow />
      <mesh geometry={g.frame} material={m.frame} castShadow />
      <mesh geometry={g.net} material={m.net} />
      <mesh geometry={g.posts} material={m.posts} castShadow />
      <mesh geometry={g.fence} material={m.fence} />
      <mesh geometry={g.mural} material={m.mural} castShadow receiveShadow />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.2, FENCE_H / 2, (g.z1 - g.z0) / 2]} position={[FENCE_X, PLATEAU_Y + FENCE_H / 2, (g.z0 + g.z1) / 2]} />
        {[-1, 1].flatMap((s) =>
          [-GOAL_W / 2, GOAL_W / 2].map((dz) => (
            <CuboidCollider key={`${s}${dz}`} args={[GOAL_D / 2 + 0.05, GOAL_H / 2, 0.08]} position={[FIELD.cx + s * (LINE_X + GOAL_D / 2), PLATEAU_Y + GOAL_H / 2, FIELD.cz + dz]} />
          )),
        )}
        {[-1, 1].map((s) => (
          <CuboidCollider key={s} args={[0.08, GOAL_H * 0.3, GOAL_W / 2]} position={[FIELD.cx + s * (LINE_X + GOAL_D), PLATEAU_Y + GOAL_H * 0.3, FIELD.cz]} />
        ))}
      </RigidBody>
    </group>
  );
}
