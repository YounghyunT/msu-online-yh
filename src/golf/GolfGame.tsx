import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, BallCollider, RapierRigidBody } from '@react-three/rapier';
import { HOLES, COURSE_Y, BALL_R, CUP_R } from '../world/golfCourse';
import { useGolf, MAX_STROKES } from './golfStore';
import { sfx } from '../audio/sound';

const MAX_SPEED = 15;
const DRAG_FULL = 5; // 이만큼(m) 당기면 최대 파워

const ndc = new THREE.Vector2();
const hit = new THREE.Vector3();
const tmp = new THREE.Vector3();
const camGoal = new THREE.Vector3();
const lookGoal = new THREE.Vector3();

/** 파크골프 미니게임 (3D 부분, 지연 로딩) */
export default function GolfGame() {
  const ball = useRef<RapierRigidBody>(null);
  const ballMesh = useRef<THREE.Mesh>(null!);
  const aim = useRef<THREE.Group>(null!);
  const aimBar = useRef<THREE.Mesh>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const { camera, gl, size } = useThree();
  const hole = useGolf((s) => s.hole);
  const resetN = useGolf((s) => s.resetN);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -(COURSE_Y + BALL_R)), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const lookAt = useRef(new THREE.Vector3(HOLES[0].tee[0], COURSE_Y, HOLES[0].tee[1]));
  const st = useRef({
    aimStart: null as THREE.Vector3 | null,
    dir: new THREE.Vector3(),
    power: 0,
    pointer: -1,
    restT: 0,
    lastRest: new THREE.Vector3(),
    sinking: false,
    sinkT: 0,
    capped: false,
    capT: 0,
    prevVel: new THREE.Vector3(),
    bumpAt: 0,
  });
  const burst = useBurst();

  useEffect(() => {
    useGolf.getState().restart();
  }, []);

  // 홀 시작: 공을 티에 놓기
  useEffect(() => {
    const b = ball.current;
    if (!b) return;
    const h = HOLES[hole];
    const p = { x: h.tee[0], y: COURSE_Y + BALL_R + 0.02, z: h.tee[1] };
    b.setTranslation(p, true);
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    b.setGravityScale(1, true);
    st.current.lastRest.set(p.x, p.y, p.z);
    st.current.sinking = false;
    st.current.capped = false;
    ballMesh.current.scale.setScalar(1);
    useGolf.getState().setResting(true);
  }, [hole, resetN]);

  // 드래그해서 당겼다 놓기 (새총 방식)
  useEffect(() => {
    const el = gl.domElement;
    const toWorld = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectPlane(plane, hit) ? hit.clone() : null;
    };
    const down = (e: PointerEvent) => {
      const g = useGolf.getState();
      if (!g.resting || g.finished || st.current.sinking || st.current.capped) return;
      const p = toWorld(e);
      if (!p) return;
      st.current.aimStart = p;
      st.current.pointer = e.pointerId;
      st.current.power = 0;
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch {
        /* 합성 이벤트 등 */
      }
    };
    const move = (e: PointerEvent) => {
      const s = st.current;
      if (!s.aimStart || e.pointerId !== s.pointer) return;
      const p = toWorld(e);
      if (!p) return;
      s.dir.subVectors(s.aimStart, p).setY(0);
      const len = s.dir.length();
      s.power = Math.min(1, len / DRAG_FULL);
      if (len > 0.001) s.dir.divideScalar(len);
      const g = useGolf.getState();
      if (Math.abs(g.power - s.power) > 0.01 || !g.aiming) g.setAim(true, s.power);
    };
    const up = (e: PointerEvent) => {
      const s = st.current;
      if (!s.aimStart || e.pointerId !== s.pointer) return;
      s.aimStart = null;
      const g = useGolf.getState();
      g.setAim(false, 0);
      const b = ball.current;
      if (!b || s.power < 0.06) return;
      const v = s.power * MAX_SPEED;
      b.setLinvel({ x: s.dir.x * v, y: 0, z: s.dir.z * v }, true);
      sfx.golfHit(s.power);
      g.addStroke();
      g.setResting(false);
      s.restT = 0;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [gl, camera, plane, raycaster]);

  useFrame((state, dt) => {
    const b = ball.current;
    if (!b) return;
    const s = st.current;
    const g = useGolf.getState();
    const h = HOLES[g.hole];
    const p = b.translation();
    const v = b.linvel();
    const speed = Math.hypot(v.x, v.z);

    // 홀컵
    const dCup = Math.hypot(p.x - h.cup[0], p.z - h.cup[1]);
    if (!s.sinking && dCup < CUP_R && speed < 4.5 && !g.resting) {
      s.sinking = true;
      s.sinkT = 0;
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.setGravityScale(0, true);
      b.setTranslation({ x: h.cup[0], y: COURSE_Y + BALL_R, z: h.cup[1] }, true);
      const n = g.strokes[g.hole];
      g.flash(n === 1 ? '🎉 홀인원!!' : n < h.par ? `🎉 버디! ${n}타` : n === h.par ? `⛳ 파! ${n}타` : `⛳ 홀인! ${n}타`);
      burst.fire(h.cup[0], COURSE_Y + 0.2, h.cup[1]);
      sfx.cup();
    }
    // 테두리/장애물에 튕기면 '톡' (속도 방향이 크게 바뀔 때)
    if (!s.sinking && !g.resting) {
      const pv = s.prevVel;
      const ps = Math.hypot(pv.x, pv.z);
      if (ps > 1.2 && speed > 0.3 && (pv.x * v.x + pv.z * v.z) / (ps * speed) < 0.5 && state.clock.elapsedTime - s.bumpAt > 0.12) {
        s.bumpAt = state.clock.elapsedTime;
        sfx.bump();
      }
    }
    s.prevVel.set(v.x, 0, v.z);
    if (s.sinking) {
      s.sinkT += dt;
      ballMesh.current.scale.setScalar(Math.max(0.01, 1 - s.sinkT * 1.5));
      if (s.sinkT > 1.8) {
        s.sinking = false;
        g.nextHole();
      }
    } else if (!g.resting) {
      // 코스 밖으로 나가면 마지막 위치로
      const out = p.y < COURSE_Y - 1 || p.x < h.x0 - 0.5 || p.x > h.x1 + 0.5 || p.z < h.z0 - 0.5 || p.z > h.z1 + 0.5;
      if (out) {
        b.setTranslation({ x: s.lastRest.x, y: s.lastRest.y, z: s.lastRest.z }, true);
        b.setLinvel({ x: 0, y: 0, z: 0 }, true);
        g.flash('코스 밖! 이전 위치로 돌아가요');
        sfx.error();
        setTimeout(() => useGolf.getState().message?.startsWith('코스') && useGolf.getState().flash(null), 1400);
      }
      s.restT = speed < 0.15 && Math.abs(v.y) < 0.2 ? s.restT + dt : 0;
      if (s.restT > 0.35) {
        b.setLinvel({ x: 0, y: 0, z: 0 }, true);
        b.setAngvel({ x: 0, y: 0, z: 0 }, true);
        s.lastRest.set(p.x, p.y, p.z);
        g.setResting(true);
        if (g.strokes[g.hole] >= MAX_STROKES) {
          s.capped = true;
          s.capT = 0;
          g.flash(`최대 ${MAX_STROKES}타! 다음 홀로 넘어가요`);
        }
      }
    }
    if (s.capped) {
      s.capT += dt;
      if (s.capT > 1.6) {
        s.capped = false;
        g.nextHole();
      }
    }

    // 조준선
    const showAim = !!s.aimStart && s.power > 0.02;
    aim.current.visible = showAim;
    if (showAim) {
      aim.current.position.set(p.x, COURSE_Y + 0.06, p.z);
      aim.current.rotation.y = Math.atan2(s.dir.x, s.dir.z);
      const len = 0.6 + s.power * 5;
      aimBar.current.scale.set(1, 1, len);
      aimBar.current.position.z = len / 2;
      (aimBar.current.material as THREE.MeshBasicMaterial).color.setHSL(0.33 - s.power * 0.33, 0.9, 0.55);
    }
    ring.current.visible = g.resting && !s.aimStart && !g.finished && !s.sinking;
    ring.current.position.set(p.x, COURSE_Y + 0.05, p.z);
    ring.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 5) * 0.15);

    // 카메라: 코스를 내려다보는 시점 (가로 화면은 옆에서, 세로 화면은 위에서)
    const hc = tmp.set((h.x0 + h.x1) / 2, COURSE_Y, (h.z0 + h.z1) / 2);
    lookGoal.lerpVectors(hc, new THREE.Vector3(p.x, COURSE_Y, p.z), 0.45);
    const wide = size.width / size.height >= 1;
    camGoal.copy(lookGoal).add(wide ? new THREE.Vector3(-11, 21, 0) : new THREE.Vector3(0, 30, 9));
    const k = 1 - Math.exp(-dt * 3);
    state.camera.position.lerp(camGoal, k);
    lookAt.current.lerp(lookGoal, k);
    state.camera.lookAt(lookAt.current);
  });

  const h0 = HOLES[0];
  return (
    <>
      <RigidBody ref={ball} type="dynamic" colliders={false} ccd position={[h0.tee[0], COURSE_Y + BALL_R + 0.02, h0.tee[1]]} linearDamping={0.7} angularDamping={1.6} canSleep={false}>
        <BallCollider args={[BALL_R]} restitution={0.55} friction={0.9} density={40} />
        <mesh ref={ballMesh} castShadow>
          <sphereGeometry args={[BALL_R, 20, 14]} />
          <meshStandardMaterial color="#ffffff" roughness={0.35} emissive="#444444" />
        </mesh>
      </RigidBody>
      <group ref={aim} visible={false}>
        <mesh ref={aimBar}>
          <boxGeometry args={[0.09, 0.02, 1]} />
          <meshBasicMaterial color="#58d36b" toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[BALL_R + 0.1, BALL_R + 0.18, 28]} />
        <meshBasicMaterial color="#ffe14d" transparent opacity={0.9} toneMapped={false} />
      </mesh>
      {burst.element}
    </>
  );
}

/** 홀인 성공 이펙트: 색종이 파티클 */
function useBurst() {
  const COUNT = 60;
  const ref = useRef<THREE.InstancedMesh>(null!);
  const data = useMemo(() => ({ t: -1, origin: new THREE.Vector3(), vel: Array.from({ length: COUNT }, () => new THREE.Vector3()) }), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useEffect(() => {
    const c = new THREE.Color();
    const palette = ['#ff5a5a', '#ffd43b', '#4dabf7', '#69db7c', '#f783ac', '#ffffff'];
    for (let i = 0; i < COUNT; i++) ref.current.setColorAt(i, c.set(palette[i % palette.length]));
    ref.current.instanceColor!.needsUpdate = true;
  }, []);

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (data.t < 0) {
      mesh.visible = false;
      return;
    }
    data.t += dt;
    mesh.visible = true;
    for (let i = 0; i < COUNT; i++) {
      const v = data.vel[i];
      pos.copy(data.origin).addScaledVector(v, data.t);
      pos.y -= 4.9 * data.t * data.t;
      e.set(data.t * 7 + i, data.t * 5 + i * 0.3, 0);
      m.compose(pos, q.setFromEuler(e), one);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (data.t > 1.8) data.t = -1;
  });

  return {
    fire: (x: number, y: number, z: number) => {
      data.origin.set(x, y, z);
      data.t = 0;
      for (const v of data.vel) v.set((Math.random() - 0.5) * 5, 4 + Math.random() * 4, (Math.random() - 0.5) * 5);
    },
    element: (
      <instancedMesh ref={ref} args={[undefined, undefined, COUNT]} frustumCulled={false} visible={false}>
        <boxGeometry args={[0.12, 0.02, 0.08]} />
        <meshBasicMaterial toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
    ),
  };
}
