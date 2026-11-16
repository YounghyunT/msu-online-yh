import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, useRapier, RapierRigidBody, RapierCollider } from '@react-three/rapier';
import { useStore, live } from '../store';
import { input, orbit, clamp } from './input';
import { Avatar, AvatarDriver } from '../avatar/Avatar';
import { SPOTS, GOLF, GATE_Z } from '../world/layout';
import { sfx } from '../audio/sound';

const WALK = 4.2;
const RUN = 7.8;
const GRAVITY = 24;
const JUMP_V = 7.2;
const CAP_HALF = 0.36;
const CAP_R = 0.3;
const HEAD = 1.25;

const INTRO_FROM = new THREE.Vector3(0, 24, 132);
const INTRO_LOOK = new THREE.Vector3(0, 5, GATE_Z);
const INTRO_SEC = 2.8;

const v3 = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const desired = new THREE.Vector3();
const lookAt = new THREE.Vector3();

export function Player() {
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);
  const visual = useRef<THREE.Group>(null!);
  const { world, rapier } = useRapier();
  const avatar = useStore((s) => s.avatar);
  const nickname = useStore((s) => s.nickname);
  const driver = useRef<AvatarDriver>({ anim: 'idle', emote: null });
  const st = useRef({ vy: 0, yaw: 0, grounded: true, camDist: orbit.dist, introStart: -1, pendingEmote: null as null | AvatarDriver['emote'], wantEmote: false, nearGolf: false, stepDist: 0 });

  const controller = useMemo(() => {
    const c = world.createCharacterController(0.03);
    c.enableAutostep(0.42, 0.25, true);
    c.enableSnapToGround(0.45);
    c.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    c.setMinSlopeSlideAngle((60 * Math.PI) / 180);
    c.setSlideEnabled(true);
    c.setApplyImpulsesToDynamicBodies(true);
    return c;
  }, [world]);
  useEffect(() => () => world.removeCharacterController(controller), [world, controller]);
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __player: body });
  }, []);

  // 이모트
  useEffect(
    () =>
      useStore.subscribe((s, p) => {
        if (s.emote && s.emote !== p.emote) st.current.wantEmote = true;
      }),
    [],
  );
  // 순간이동
  useEffect(
    () =>
      useStore.subscribe((s, p) => {
        if (s.teleport && s.teleport !== p.teleport && body.current) {
          const spot = SPOTS[s.teleport.spot];
          body.current.setTranslation({ x: spot.pos[0], y: spot.pos[1], z: spot.pos[2] }, true);
          body.current.setNextKinematicTranslation({ x: spot.pos[0], y: spot.pos[1], z: spot.pos[2] });
          st.current.vy = 0;
          st.current.yaw = spot.yaw;
          orbit.yaw = spot.yaw;
        }
      }),
    [],
  );

  useFrame((state, rawDt) => {
    const rb = body.current;
    const col = collider.current;
    if (!rb || !col) return;
    const dt = Math.min(rawDt, 1 / 20);
    const s = st.current;
    const phase = useStore.getState().phase;
    const canMove = phase === 'play';
    const t = state.clock.elapsedTime;

    if (s.wantEmote) {
      s.wantEmote = false;
      const e = useStore.getState().emote;
      if (e) driver.current.emote = { id: e.id, at: t };
    }

    // 이동 방향 (카메라 기준)
    let mx = 0;
    let mz = 0;
    if (canMove) {
      const fwd = input.f - input.b + input.joyY;
      const side = input.r - input.l + input.joyX;
      const sy = Math.sin(orbit.yaw);
      const cy = Math.cos(orbit.yaw);
      mx = -sy * fwd + cy * side;
      mz = -cy * fwd - sy * side;
      const len = Math.hypot(mx, mz);
      if (len > 1) {
        mx /= len;
        mz /= len;
      }
    }
    const mag = Math.hypot(mx, mz);
    const joyMag = Math.hypot(input.joyX, input.joyY);
    const running = input.run || joyMag > 0.92;
    const speed = running ? RUN : WALK;

    if (canMove && input.jump && s.grounded) {
      s.vy = JUMP_V;
      s.grounded = false;
      sfx.jump();
    }
    const fallSpeed = s.vy;
    s.vy -= GRAVITY * dt;
    if (s.vy < -30) s.vy = -30;

    const p = rb.translation();
    controller.computeColliderMovement(col, { x: mx * speed * dt, y: s.vy * dt, z: mz * speed * dt }, rapier.QueryFilterFlags.EXCLUDE_SENSORS);
    const m = controller.computedMovement();
    const grounded = controller.computedGrounded();
    if (grounded && s.vy < 0) s.vy = -1;
    if (!grounded && s.vy > 0 && m.y < s.vy * dt * 0.5) s.vy = 0; // 머리 부딪힘
    if (grounded && !s.grounded && fallSpeed < -7) sfx.land();
    // 발소리: 땅 위에서 일정 거리마다
    if (grounded && mag > 0.05) {
      s.stepDist += Math.hypot(m.x, m.z);
      if (s.stepDist > (running ? 1.75 : 1.45)) {
        s.stepDist = 0;
        sfx.step();
      }
    }
    s.grounded = grounded;
    let nx = p.x + m.x;
    let ny = p.y + m.y;
    let nz = p.z + m.z;
    if (ny < -25) {
      const g = SPOTS.gate.pos;
      [nx, ny, nz] = g;
      s.vy = 0;
      rb.setTranslation({ x: nx, y: ny, z: nz }, true);
    }
    rb.setNextKinematicTranslation({ x: nx, y: ny, z: nz });

    // 방향 & 애니메이션 상태
    if (mag > 0.05) {
      const target = Math.atan2(-mx, -mz);
      let d = target - s.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      s.yaw += d * Math.min(1, dt * 12);
    }
    const anim = !grounded && Math.abs(s.vy) > 1.5 ? 'jump' : mag > 0.05 ? (running ? 'run' : 'walk') : 'idle';
    driver.current.anim = anim;
    if (anim !== 'idle' && driver.current.emote && t - driver.current.emote.at > 0.3) driver.current.emote = null;

    visual.current.position.set(nx, ny, nz);
    visual.current.rotation.y = s.yaw + Math.PI;
    live.me.x = nx;
    live.me.y = ny;
    live.me.z = nz;
    live.me.yaw = s.yaw;
    live.me.anim = anim;
    live.me.moving = mag > 0.05 || !grounded;

    // 파크골프장 입구 근접
    const near = canMove && Math.hypot(nx - GOLF.entrance[0], nz - GOLF.entrance[2]) < 4.5 && Math.abs(ny - GOLF.entrance[1]) < 2;
    if (near !== s.nearGolf) {
      s.nearGolf = near;
      useStore.getState().setNearGolf(near);
    }

    // ---- 카메라 ----
    if (phase === 'golf') return;
    const cam = state.camera;
    camTarget.set(nx, ny + HEAD, nz);
    const cp = Math.cos(orbit.pitch);
    v3.set(Math.sin(orbit.yaw) * cp, Math.sin(orbit.pitch), Math.cos(orbit.yaw) * cp);
    // 벽에 부딪히면 카메라를 앞으로 당김
    let maxD = orbit.dist;
    const ray = new rapier.Ray(camTarget, v3);
    const hit = world.castRay(ray, orbit.dist + 0.3, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, rb);
    if (hit) {
      const toi = (hit as unknown as { timeOfImpact?: number; toi?: number }).timeOfImpact ?? (hit as unknown as { toi: number }).toi;
      maxD = clamp(toi - 0.3, 0.8, orbit.dist);
    }
    s.camDist = maxD < s.camDist ? maxD : s.camDist + (maxD - s.camDist) * Math.min(1, dt * 3);
    desired.copy(camTarget).addScaledVector(v3, s.camDist);

    if (phase === 'lobby' || phase === 'loading') {
      const a = t * 0.05;
      cam.position.set(Math.sin(a) * 30, 20 + Math.sin(t * 0.2) * 2, GATE_Z + 50 + Math.cos(a) * 10);
      cam.lookAt(INTRO_LOOK);
      s.introStart = -1;
      return;
    }
    if (phase === 'intro') {
      if (s.introStart < 0) s.introStart = t;
      const k = clamp((t - s.introStart) / INTRO_SEC, 0, 1);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      cam.position.lerpVectors(INTRO_FROM, desired, e);
      lookAt.lerpVectors(INTRO_LOOK, camTarget, e);
      cam.lookAt(lookAt);
      if (k >= 1) useStore.getState().setPhase('play');
      return;
    }
    cam.position.lerp(desired, Math.min(1, dt * 14));
    cam.lookAt(camTarget);
  });

  const g = SPOTS.gate.pos;
  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={g} enabledRotations={[false, false, false]} userData={{ player: true }}>
        <CapsuleCollider ref={collider} args={[CAP_HALF, CAP_R]} position={[0, CAP_HALF + CAP_R, 0]} />
      </RigidBody>
      <group ref={visual} position={g}>
        <Avatar config={avatar} driver={driver} name={nickname} isMe />
      </group>
    </>
  );
}
