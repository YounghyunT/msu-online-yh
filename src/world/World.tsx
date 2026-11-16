import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { PerformanceMonitor } from '@react-three/drei';
import { useStore, Quality } from '../store';
import { markLoaded } from '../loading';
import { installOrbitControls } from '../player/input';
import { Environment } from './Environment';
import { Terrain } from './Terrain';
import { Gate } from './Gate';
import { MainBuilding } from './MainBuilding';
import { Landscaping } from './Landscaping';
import { Field } from './Field';
import { ParkGolf } from './ParkGolf';

const GolfGame = lazy(() => import('../golf/GolfGame'));
const ChristmasDecor = lazy(() => import('../xmas/ChristmasDecor'));
import { Player } from '../player/Player';
import { RemotePlayers } from '../net/RemotePlayers';

const DPR: Record<Quality, [number, number]> = { high: [1, 1.5], mid: [1, 1.25], low: [0.85, 1] };

function Ready() {
  const frames = useRef(0);
  useEffect(() => {
    markLoaded('physics');
    const t = setTimeout(() => markLoaded('world'), 6000);
    return () => clearTimeout(t);
  }, []);
  useFrame(() => {
    if (++frames.current === 3) markLoaded('world');
  });
  return null;
}

function OrbitInput() {
  const gl = useThree((s) => s.gl);
  const el = gl.domElement;
  useEffect(() => installOrbitControls(el), [el]);
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __gl: gl });
  }, [gl]);
  return null;
}

function AutoQuality() {
  const setQuality = useStore((s) => s.setQuality);
  return (
    <PerformanceMonitor
      bounds={() => [28, 55]}
      flipflops={2}
      onDecline={() => {
        const { quality, autoQuality } = useStore.getState();
        if (!autoQuality) return;
        if (quality === 'high') setQuality('mid', true);
        else if (quality === 'mid') setQuality('low', true);
      }}
    />
  );
}

export function World() {
  const quality = useStore((s) => s.quality);
  const phase = useStore((s) => s.phase);
  const christmas = useStore((s) => s.christmas);
  const [xmasLoaded, setXmasLoaded] = useState(false);
  useEffect(() => {
    if (christmas) setXmasLoaded(true);
  }, [christmas]);
  const [hidden, setHidden] = useState(document.hidden);
  useEffect(() => {
    const f = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);

  return (
    <Canvas
      shadows
      dpr={DPR[quality]}
      frameloop={hidden ? 'never' : 'always'}
      camera={{ fov: 55, near: 0.1, far: 1000, position: [0, 24, 132] }}
      gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', stencil: false }}
      style={{ position: 'fixed', inset: 0, touchAction: 'none' }}
    >
      <AutoQuality />
      <OrbitInput />
      <Suspense fallback={null}>
        <Physics timeStep="vary" gravity={[0, -9.81, 0]}>
          <Environment />
          <Terrain />
          <Gate />
          <MainBuilding />
          <Landscaping />
          <Field />
          <ParkGolf />
          {phase === 'golf' && (
            <Suspense fallback={null}>
              <GolfGame />
            </Suspense>
          )}
          {xmasLoaded && (
            <Suspense fallback={null}>
              <ChristmasDecor />
            </Suspense>
          )}
          <Player />
          <RemotePlayers />
          <Ready />
        </Physics>
      </Suspense>
    </Canvas>
  );
}
