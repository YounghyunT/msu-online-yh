import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore, live } from '../store';
import { globalUniforms } from './materials';
import { merge } from './geo';

/** 크리스마스 전환 진행도 (0 = 화창한 낮, 1 = 크리스마스 저녁) */
export const env = { t: 0 };

const DAY = {
  skyTop: new THREE.Color('#2f7fe0'),
  skyBottom: new THREE.Color('#cfe6ff'),
  fog: new THREE.Color('#d6e8ff'),
  fogNear: 140,
  fogFar: 520,
  sun: new THREE.Color('#fff0d6'),
  sunI: 2.7,
  hemiSky: new THREE.Color('#d7ebff'),
  hemiGround: new THREE.Color('#6f8b4c'),
  hemiI: 1.15,
  cloud: new THREE.Color('#8f9db8'),
};
const XMAS = {
  skyTop: new THREE.Color('#0a1233'),
  skyBottom: new THREE.Color('#33406f'),
  fog: new THREE.Color('#222c52'),
  fogNear: 30,
  fogFar: 210,
  sun: new THREE.Color('#9fb2ff'),
  sunI: 0.55,
  hemiSky: new THREE.Color('#5265a8'),
  hemiGround: new THREE.Color('#2a2f3c'),
  hemiI: 0.6,
  cloud: new THREE.Color('#151a30'),
};

const SUN_OFFSET = new THREE.Vector3(32, 60, 42);

export function Environment() {
  const christmas = useStore((s) => s.christmas);
  const quality = useStore((s) => s.quality);
  const scene = useThree((s) => s.scene);
  const sun = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const skyRef = useRef<THREE.Mesh>(null!);
  const { cloudGeo, cloudMat } = useClouds();

  const fog = useMemo(() => new THREE.Fog(DAY.fog.clone(), DAY.fogNear, DAY.fogFar), []);
  useEffect(() => {
    scene.fog = fog;
    scene.background = fog.color;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { top: { value: DAY.skyTop.clone() }, bottom: { value: DAY.skyBottom.clone() }, stars: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top; uniform vec3 bottom; uniform float stars;
          varying vec3 vDir;
          float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
          void main() {
            float y = clamp(vDir.y, 0.0, 1.0);
            vec3 c = mix(bottom, top, pow(y, 0.55));
            vec3 cell = floor(vDir * 180.0);
            float s = step(0.9975, h(cell)) * stars * smoothstep(0.05, 0.4, vDir.y);
            c += vec3(s);
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );

  const shadowSize = quality === 'high' ? 2048 : quality === 'mid' ? 1024 : 0;

  useEffect(() => {
    const l = sun.current;
    if (!l) return;
    l.shadow.mapSize.set(shadowSize || 512, shadowSize || 512);
    l.shadow.map?.dispose();
    (l.shadow as { map: THREE.WebGLRenderTarget | null }).map = null;
    l.shadow.needsUpdate = true;
  }, [shadowSize]);

  useFrame((state, dt) => {
    globalUniforms.uTime.value = state.clock.elapsedTime;
    const target = christmas ? 1 : 0;
    const speed = dt / 1.6;
    env.t = env.t < target ? Math.min(target, env.t + speed) : Math.max(target, env.t - speed);
    const k = env.t * env.t * (3 - 2 * env.t);
    globalUniforms.uSnow.value = k;

    skyMat.uniforms.top.value.lerpColors(DAY.skyTop, XMAS.skyTop, k);
    skyMat.uniforms.bottom.value.lerpColors(DAY.skyBottom, XMAS.skyBottom, k);
    skyMat.uniforms.stars.value = k;
    fog.color.lerpColors(DAY.fog, XMAS.fog, k);
    fog.near = THREE.MathUtils.lerp(DAY.fogNear, XMAS.fogNear, k);
    fog.far = THREE.MathUtils.lerp(DAY.fogFar, XMAS.fogFar, k);

    const l = sun.current;
    l.color.lerpColors(DAY.sun, XMAS.sun, k);
    l.intensity = THREE.MathUtils.lerp(DAY.sunI, XMAS.sunI, k);
    hemi.current.color.lerpColors(DAY.hemiSky, XMAS.hemiSky, k);
    hemi.current.groundColor.lerpColors(DAY.hemiGround, XMAS.hemiGround, k);
    hemi.current.intensity = THREE.MathUtils.lerp(DAY.hemiI, XMAS.hemiI, k);
    cloudMat.emissive.lerpColors(DAY.cloud, XMAS.cloud, k);

    // 그림자는 플레이어 주변만 (텍셀 단위로 스냅해서 흔들림 방지)
    const snap = 0.5;
    const px = Math.round(live.me.x / snap) * snap;
    const py = Math.round(live.me.y / snap) * snap;
    const pz = Math.round(live.me.z / snap) * snap;
    l.target.position.set(px, py, pz);
    l.position.set(px + SUN_OFFSET.x, py + SUN_OFFSET.y, pz + SUN_OFFSET.z);
    l.target.updateMatrixWorld();
    skyRef.current.position.copy(state.camera.position);
  });

  return (
    <>
      <mesh ref={skyRef} material={skyMat} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[450, 24, 12]} />
      </mesh>
      <mesh geometry={cloudGeo} material={cloudMat} />
      <hemisphereLight ref={hemi} args={[DAY.hemiSky, DAY.hemiGround, DAY.hemiI]} />
      <directionalLight
        ref={sun}
        intensity={DAY.sunI}
        color={DAY.sun}
        castShadow={shadowSize > 0}
        shadow-mapSize={[shadowSize || 512, shadowSize || 512]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-camera-near={1}
        shadow-camera-far={180}
      />
    </>
  );
}

function useClouds() {
  return useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const spots = [
      [-120, 95, -160],
      [-20, 110, -220],
      [90, 100, -170],
      [180, 85, -60],
      [-190, 80, 20],
      [60, 120, 160],
      [-80, 105, 210],
      [200, 95, 150],
    ];
    let seed = 3;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [x, y, z] of spots) {
      const n = 6 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const s = 9 + r() * 12;
        const g = new THREE.IcosahedronGeometry(1, 2);
        g.scale(s * 1.4, s * 0.8, s);
        g.translate(x + (r() - 0.5) * 50, y + (r() - 0.3) * 8, z + (r() - 0.5) * 22);
        parts.push(g);
      }
    }
    const cloudGeo = merge(parts);
    const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: DAY.cloud.clone(), fog: false });
    return { cloudGeo, cloudMat };
  }, []);
}
