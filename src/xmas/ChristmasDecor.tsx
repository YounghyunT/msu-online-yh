import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import { useStore } from '../store';
import { env } from '../world/Environment';
import { globalUniforms } from '../world/materials';
import { paint, merge, stripUV, xform } from '../world/geo';
import { FIELD, PLATEAU_Y, GATE_Z, GOLF, SPOTS } from '../world/layout';
import { BUILDING_EAVES } from '../world/MainBuilding';
import { GATE_ARM_TIPS, PILLARS } from '../world/Gate';

// 크리스마스 장식 (지연 로딩). env.t(0..1)에 맞춰 서서히 나타나고 사라진다.

const TREE = { x: FIELD.cx, z: FIELD.cz, y: PLATEAU_Y, h: 13 };
const BULB_COLORS = ['#ff3b3b', '#ffd23f', '#3fa7ff', '#5cff7a', '#ff7ad9', '#ffffff', '#ff9d2e'];

function useAppear(group: React.RefObject<THREE.Group | null>) {
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const k = Math.min(1, env.t * 1.4);
    g.visible = k > 0.01;
    g.scale.setScalar(0.6 + 0.4 * k);
  });
}

/** 운동장 한가운데 큰 크리스마스 트리 (+전구, 별) */
function Tree() {
  const group = useRef<THREE.Group>(null);
  const bulbs = useRef<THREE.InstancedMesh>(null!);
  const { treeGeo, bulbPos, starGeo } = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const trunk = new THREE.CylinderGeometry(0.45, 0.6, 2, 10);
    trunk.translate(0, 1, 0);
    parts.push(paint(stripUV(trunk), '#5b3a22'));
    const tiers = 6;
    for (let i = 0; i < tiers; i++) {
      const r = 4.6 - i * 0.68;
      const h = 3.4 - i * 0.25;
      const y = 1.6 + i * 1.75;
      parts.push(paint(stripUV(xform(new THREE.ConeGeometry(r, h, 16, 1), [0, y + h / 2, 0], [0, i * 0.4, 0])), i % 2 ? '#1f6b37' : '#24783e', 0.12));
    }
    // 둥근 장식볼
    const balls: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 36; i++) {
      const t = i / 36;
      const y = 2.2 + t * 9.5;
      const r = (4.4 - t * 4.0) * 0.95;
      const a = i * 2.4;
      balls.push(paint(stripUV(xform(new THREE.SphereGeometry(0.22, 8, 6), [Math.cos(a) * r, y, Math.sin(a) * r])), ['#d62828', '#f4c430', '#c0c0c0', '#2f6fd6'][i % 4]));
    }
    const treeGeo = merge([...parts, ...balls].map((g) => (g.index ? g.toNonIndexed() : g)));
    // 나선형 전구
    const bulbPos: THREE.Vector3[] = [];
    const n = 160;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const y = 1.9 + t * 10.6;
      const r = 4.7 - t * 4.3;
      const a = t * Math.PI * 2 * 6.5;
      bulbPos.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    // 꼭대기 별
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? 0.45 : 1.05;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const starGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false });
    starGeo.translate(0, 0, -0.125);
    return { treeGeo, bulbPos, starGeo };
  }, []);
  const mats = useMemo(
    () => ({
      tree: new THREE.MeshLambertMaterial({ vertexColors: true }),
      bulb: new THREE.MeshBasicMaterial({ toneMapped: false }),
      star: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 0.6), toneMapped: false }),
    }),
    [],
  );
  const base = useMemo(() => bulbPos.map((_, i) => new THREE.Color(BULB_COLORS[i % BULB_COLORS.length])), [bulbPos]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    bulbPos.forEach((p, i) => {
      bulbs.current.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
      bulbs.current.setColorAt(i, base[i]);
    });
    bulbs.current.instanceMatrix.needsUpdate = true;
  }, [bulbPos, base]);
  const star = useRef<THREE.Mesh>(null!);
  const acc = useRef(0);
  const c = useMemo(() => new THREE.Color(), []);
  useFrame((state, dt) => {
    star.current.rotation.y += dt * 0.8;
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < base.length; i++) {
      const on = Math.sin(t * 3 + i * 1.7) > -0.3 ? 2.2 : 0.35;
      bulbs.current.setColorAt(i, c.copy(base[i]).multiplyScalar(on));
    }
    bulbs.current.instanceColor!.needsUpdate = true;
  });
  useAppear(group);
  return (
    <group ref={group} position={[TREE.x, TREE.y, TREE.z]} visible={false}>
      <mesh geometry={treeGeo} material={mats.tree} castShadow />
      <instancedMesh ref={bulbs} args={[undefined, mats.bulb, bulbPos.length]}>
        <sphereGeometry args={[0.1, 6, 4]} />
      </instancedMesh>
      <mesh ref={star} geometry={starGeo} material={mats.star} position={[0, TREE.h + 0.3, 0]} />
    </group>
  );
}

/** 본관 처마와 정문 기둥 팔을 따라 다는 전구 줄 */
function StringLights() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const line = (a: THREE.Vector3, b: THREE.Vector3, step: number, sag = 0) => {
      const n = Math.max(2, Math.round(a.distanceTo(b) / step));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p = a.clone().lerp(b, t);
        p.y -= Math.sin(t * Math.PI) * sag;
        pts.push(p);
      }
    };
    const { segments, towerTop, towerFront, tower } = BUILDING_EAVES;
    // 처마: 4m 마다 살짝 처지는 전구 줄 (동마다 앞면 위치가 다름)
    for (const { x0: a, x1: b, y, z } of segments) {
      for (let x = a; x < b - 0.1; x += 4) line(new THREE.Vector3(x, y - 0.1, z), new THREE.Vector3(Math.min(b, x + 4), y - 0.1, z), 0.55, 0.45);
    }
    line(new THREE.Vector3(tower.x0 - 0.6, towerTop + 0.15, towerFront + 0.65), new THREE.Vector3(tower.x1 + 0.6, towerTop + 0.15, towerFront + 0.65), 0.5, 0.2);
    // 정문 기둥 팔
    for (const tip of GATE_ARM_TIPS) {
      line(new THREE.Vector3(tip.base[0] - tip.dir * 0.9, 0.6, GATE_Z + 0.85), new THREE.Vector3(tip.base[0] - tip.dir * 0.9, tip.base[1], GATE_Z + 0.85), 0.45);
      line(new THREE.Vector3(tip.base[0] - tip.dir * 0.9, tip.base[1], GATE_Z + 0.85), new THREE.Vector3(tip.x - tip.dir * 0.6, tip.y + 0.2, GATE_Z + 0.85), 0.45);
    }
    return pts;
  }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    points.forEach((p, i) => {
      ref.current.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
      ref.current.setColorAt(i, c.set(BULB_COLORS[i % 4 === 3 ? 5 : i % 3]).multiplyScalar(1.8));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [points]);
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (group.current) group.current.visible = env.t > 0.05;
  });
  return (
    <group ref={group} visible={false}>
      <instancedMesh ref={ref} args={[undefined, undefined, points.length]}>
        <sphereGeometry args={[0.09, 6, 4]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** 리스, 눈사람, 선물상자 */
function Props() {
  const group = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, color: string, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], s: [number, number, number] = [1, 1, 1]) =>
      parts.push(paint(stripUV(xform(g, pos, rot, s)), color).toNonIndexed());
    // 정문 기둥 리스
    for (const p of PILLARS) {
      add(new THREE.TorusGeometry(0.42, 0.14, 8, 18), '#1f6b37', [p.x, 6.9, GATE_Z + 0.85]);
      add(new THREE.SphereGeometry(0.12, 8, 6), '#d62828', [p.x - 0.18, 6.6, GATE_Z + 1.0]);
      add(new THREE.SphereGeometry(0.12, 8, 6), '#d62828', [p.x + 0.18, 6.6, GATE_Z + 1.0]);
      add(new THREE.ConeGeometry(0.14, 0.32, 4), '#d62828', [p.x, 6.48, GATE_Z + 1.0], [Math.PI, 0, 0]);
    }
    // 눈사람
    const snowmen: [number, number, number, number][] = [
      [-7, 0, GATE_Z - 4, 0.3],
      [8, 0, GATE_Z + 6, -0.4],
      [-12, PLATEAU_Y, 30, 0.6],
      [16, PLATEAU_Y, 29, -0.2],
      [SPOTS.golf.pos[0] - 1, PLATEAU_Y, GOLF.entrance[2] + 4, -1.2],
      [-8, PLATEAU_Y, -17, 0.1],
    ];
    for (const [x, y, z, ry] of snowmen) {
      add(new THREE.SphereGeometry(0.6, 14, 10), '#f4f8ff', [x, y + 0.55, z]);
      add(new THREE.SphereGeometry(0.42, 14, 10), '#f4f8ff', [x, y + 1.35, z]);
      add(new THREE.SphereGeometry(0.3, 14, 10), '#f4f8ff', [x, y + 1.95, z]);
      const fx = Math.sin(ry);
      const fz = Math.cos(ry);
      add(new THREE.ConeGeometry(0.06, 0.32, 8), '#ff7a1a', [x + fx * 0.36, y + 1.95, z + fz * 0.36], [Math.PI / 2, ry, 0]);
      for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.04, 6, 4), '#222', [x + fx * 0.26 + fz * 0.1 * s, y + 2.05, z + fz * 0.26 - fx * 0.1 * s]);
      add(new THREE.CylinderGeometry(0.2, 0.22, 0.32, 12), '#222', [x, y + 2.3, z]);
      add(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 12), '#222', [x, y + 2.15, z]);
      add(new THREE.TorusGeometry(0.3, 0.07, 6, 14), '#d62828', [x, y + 1.66, z], [Math.PI / 2, 0, 0]);
    }
    // 선물상자 (트리 아래와 곳곳)
    const gifts: [number, number, number, string, number][] = [];
    const cols = ['#d62828', '#2f6fd6', '#f4c430', '#2a9d55', '#a14fd6'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      gifts.push([TREE.x + Math.cos(a) * 5.3, PLATEAU_Y, TREE.z + Math.sin(a) * 5.3, cols[i % cols.length], 0.5 + (i % 3) * 0.2]);
    }
    gifts.push([-6, 0, GATE_Z - 3, '#d62828', 0.6], [-5.2, 0, GATE_Z - 3.6, '#f4c430', 0.45], [6.5, 0, GATE_Z + 5, '#2f6fd6', 0.55]);
    for (const [x, y, z, c, s] of gifts) {
      add(new THREE.BoxGeometry(s, s, s), c, [x, y + s / 2, z], [0, x * 0.7, 0]);
      add(new THREE.BoxGeometry(s + 0.02, s + 0.02, s * 0.18), '#fff3c4', [x, y + s / 2, z], [0, x * 0.7, 0]);
      add(new THREE.BoxGeometry(s * 0.18, s + 0.02, s + 0.02), '#fff3c4', [x, y + s / 2, z], [0, x * 0.7, 0]);
    }
    return merge(parts);
  }, []);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), []);
  useAppear(group);
  return (
    <group ref={group} visible={false}>
      <mesh geometry={geo} material={mat} castShadow />
    </group>
  );
}

/** 눈 내리는 파티클 – 정점 셰이더에서 낙하/순환시켜 CPU 비용 0 */
function Snow() {
  const quality = useStore((s) => s.quality);
  const count = quality === 'high' ? 3500 : quality === 'mid' ? 1800 : 700;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = Math.random() * 80 - 40;
      p[i * 3 + 1] = Math.random() * 40;
      p[i * 3 + 2] = Math.random() * 80 - 40;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, [count]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: globalUniforms.uTime, uCam: { value: new THREE.Vector3() }, uOpacity: { value: 0 }, uScale: { value: 1 } },
        vertexShader: /* glsl */ `
          uniform float uTime; uniform vec3 uCam; uniform float uScale;
          void main() {
            vec3 p = position;
            p.y = mod(p.y - uTime * (1.2 + fract(position.x * 7.13) * 0.8), 40.0);
            p.x += sin(uTime * 0.7 + position.z) * 0.8;
            p.z += cos(uTime * 0.5 + position.x) * 0.6;
            // 카메라 주변 80m 박스 안에서 순환
            vec3 w = vec3(mod(p.x - uCam.x + 40.0, 80.0) - 40.0 + uCam.x, p.y + uCam.y - 12.0, mod(p.z - uCam.z + 40.0, 80.0) - 40.0 + uCam.z);
            vec4 mv = modelViewMatrix * vec4(w, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = uScale * min(9.0, (2.0 + fract(position.z * 3.7) * 2.5) * (28.0 / -mv.z));
          }`,
        fragmentShader: /* glsl */ `
          uniform float uOpacity;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float a = smoothstep(0.5, 0.15, length(c));
            gl_FragColor = vec4(vec3(1.0), a * uOpacity);
          }`,
      }),
    [],
  );
  const pts = useRef<THREE.Points>(null!);
  useFrame((state) => {
    mat.uniforms.uCam.value.copy(state.camera.position);
    mat.uniforms.uOpacity.value = env.t * 0.9;
    mat.uniforms.uScale.value = state.gl.getPixelRatio();
    pts.current.visible = env.t > 0.01;
  });
  return <points ref={pts} geometry={geo} material={mat} frustumCulled={false} />;
}

/** 따뜻한 주황빛 포인트 조명 (정문, 본관 입구) */
function WarmLights() {
  const a = useRef<THREE.PointLight>(null!);
  const b = useRef<THREE.PointLight>(null!);
  const c = useRef<THREE.PointLight>(null!);
  useFrame(() => {
    a.current.intensity = env.t * 45;
    b.current.intensity = env.t * 55;
    c.current.intensity = env.t * 70;
  });
  return (
    <>
      <pointLight ref={c} position={[TREE.x, TREE.y + 6, TREE.z]} color="#ffb35c" distance={28} decay={2} intensity={0} />
      <pointLight ref={a} position={[0, 6, GATE_Z + 4]} color="#ffa04a" distance={24} decay={2} intensity={0} />
      <pointLight ref={b} position={[0, 15, BUILDING_EAVES.towerFront + 6]} color="#ffb060" distance={30} decay={2} intensity={0} />
    </>
  );
}

function PostFX() {
  const quality = useStore((s) => s.quality);
  if (quality === 'low') return null;
  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.2} intensity={quality === 'high' ? 1.1 : 0.8} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

export default function ChristmasDecor() {
  const christmas = useStore((s) => s.christmas);
  return (
    <>
      <Tree />
      <StringLights />
      <Props />
      <Snow />
      <WarmLights />
      {christmas && <PostFX />}
      {christmas && (
        <RigidBody type="fixed" colliders={false}>
          <CylinderCollider args={[6, 1.6]} position={[TREE.x, TREE.y + 6, TREE.z]} />
        </RigidBody>
      )}
    </>
  );
}
