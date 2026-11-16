import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Avatar, AvatarDriver } from '../avatar/Avatar';
import { AvatarConfig, SKIN_TONES, HAIR_STYLES, HAIR_COLORS, TOP_COLORS, BOTTOM_COLORS, HATS, randomAvatar } from '../avatar/avatarConfig';

function Swatches({ colors, value, onChange }: { colors: string[]; value: number; onChange: (i: number) => void }) {
  return (
    <div className="swatches">
      {colors.map((c, i) => (
        <button key={c} className={`swatch ${value === i ? 'sel' : ''}`} style={{ background: c }} onClick={() => onChange(i)} aria-label={`색 ${i + 1}`} />
      ))}
    </div>
  );
}

function Chips({ labels, value, onChange }: { labels: string[]; value: number; onChange: (i: number) => void }) {
  return (
    <div className="chips">
      {labels.map((l, i) => (
        <button key={l} className={`chip ${value === i ? 'sel' : ''}`} onClick={() => onChange(i)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Preview({ config }: { config: AvatarConfig }) {
  const driver = useRef<AvatarDriver>({ anim: 'idle', emote: null });
  const first = useRef(true);
  const startRef = useRef(performance.now() / 1000);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // 바꿀 때마다 살짝 손 흔들기
    driver.current.emote = { id: 'wave', at: performance.now() / 1000 - startRef.current };
  }, [config]);
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.95, 2.7], fov: 35 }} gl={{ antialias: true }} onCreated={() => (startRef.current = performance.now() / 1000)}>
      <hemisphereLight args={['#ffffff', '#8aa2c8', 1.6]} />
      <directionalLight position={[2, 4, 3]} intensity={2.2} />
      <Avatar config={config} driver={driver} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.001, 0]}>
        <circleGeometry args={[0.7, 40]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.12} />
      </mesh>
      <OrbitControls target={[0, 0.68, 0]} enablePan={false} enableZoom={false} minPolarAngle={0.6} maxPolarAngle={1.75} autoRotate autoRotateSpeed={1.2} />
    </Canvas>
  );
}

export function AvatarEditor({ config, onChange }: { config: AvatarConfig; onChange: (c: AvatarConfig) => void }) {
  const set = useMemo(() => <K extends keyof AvatarConfig>(k: K) => (v: AvatarConfig[K]) => onChange({ ...config, [k]: v }), [config, onChange]);
  return (
    <div className="editor">
      <div className="editor-preview">
        <Preview config={config} />
        <span className="hint">드래그해서 돌려보기</span>
      </div>
      <div className="editor-options">
        <label>피부톤</label>
        <Swatches colors={SKIN_TONES} value={config.skin} onChange={set('skin')} />
        <label>헤어스타일</label>
        <Chips labels={HAIR_STYLES} value={config.hair} onChange={set('hair')} />
        <label>머리 색</label>
        <Swatches colors={HAIR_COLORS} value={config.hairColor} onChange={set('hairColor')} />
        <label>상의 색</label>
        <Swatches colors={TOP_COLORS} value={config.top} onChange={set('top')} />
        <label>하의 색</label>
        <Swatches colors={BOTTOM_COLORS} value={config.bottom} onChange={set('bottom')} />
        <label>모자</label>
        <Chips labels={HATS} value={config.hat} onChange={set('hat')} />
        <label>안경</label>
        <Chips labels={['없음', '있음']} value={config.glasses ? 1 : 0} onChange={(i) => set('glasses')(i === 1)} />
        <button className="btn ghost small" onClick={() => onChange(randomAvatar())}>
          🎲 랜덤으로 꾸미기
        </button>
      </div>
    </div>
  );
}
