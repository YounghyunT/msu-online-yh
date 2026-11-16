import { useEffect, useState } from 'react';
import { useStore, live } from '../store';
import { WORLD, FIELD, GOLF, BUILDING, GATE_Z, SLOPE, SPOTS, SpotId } from '../world/layout';

const W = 118;
const H = Math.round((W * (WORLD.maxZ - WORLD.minZ)) / (WORLD.maxX - WORLD.minX));
const sx = (x: number) => ((x - WORLD.minX) / (WORLD.maxX - WORLD.minX)) * W;
const sz = (z: number) => ((z - WORLD.minZ) / (WORLD.maxZ - WORLD.minZ)) * H;

export function Minimap() {
  const [, tick] = useState(0);
  const [open, setOpen] = useState(() => window.innerWidth > 720);
  const requestTeleport = useStore((s) => s.requestTeleport);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [open]);

  if (!open)
    return (
      <button className="status-chip" onClick={() => setOpen(true)}>
        🗺️ 지도
      </button>
    );

  const me = live.me;
  return (
    <div className="panel minimap-wrap">
      <div className="minimap" onClick={() => setOpen(false)} title="지도 접기">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <rect width={W} height={H} rx={10} fill="#7fb35f" />
          <rect x={0} y={sz(SLOPE.zLow)} width={W} height={H - sz(SLOPE.zLow)} fill="#c9bfb6" />
          <rect x={0} y={sz(SLOPE.zHigh)} width={W} height={sz(SLOPE.zLow) - sz(SLOPE.zHigh)} fill="#6aa04c" />
          <rect x={sx(-4.5)} y={sz(SLOPE.zLow)} width={sx(4.5) - sx(-4.5)} height={H - sz(SLOPE.zLow)} fill="#5a5c60" />
          <rect x={sx(-3)} y={sz(SLOPE.zHigh)} width={sx(3) - sx(-3)} height={sz(SLOPE.zLow) - sz(SLOPE.zHigh)} fill="#f2a7c4" />
          <rect x={sx(FIELD.cx - FIELD.w / 2)} y={sz(FIELD.cz - FIELD.d / 2)} width={(FIELD.w / (WORLD.maxX - WORLD.minX)) * W} height={(FIELD.d / (WORLD.maxZ - WORLD.minZ)) * H} fill="#2f8f3a" stroke="#fff" strokeWidth={0.6} />
          <rect x={sx(GOLF.x0)} y={sz(GOLF.z0)} width={sx(GOLF.x1) - sx(GOLF.x0)} height={sz(GOLF.z1) - sz(GOLF.z0)} fill="#9ad27a" stroke="#6b4a2a" strokeWidth={0.6} />
          {[...BUILDING.wings, BUILDING.tower].map((w) => (
            <rect key={w.x0} x={sx(w.x0)} y={sz(w.back)} width={sx(w.x1) - sx(w.x0)} height={sz(w.front) - sz(w.back)} fill="#efe6d2" stroke="#c9a995" strokeWidth={0.6} />
          ))}
          <line x1={sx(-13)} x2={sx(6)} y1={sz(GATE_Z)} y2={sz(GATE_Z)} stroke="#e5730c" strokeWidth={2} />
          {[...live.remotes.values()].map((r, i) => (
            <circle key={i} cx={sx(r.x)} cy={sz(r.z)} r={2.2} fill="#ffcf3f" stroke="#7a5a00" strokeWidth={0.5} />
          ))}
          <g transform={`translate(${sx(me.x)} ${sz(me.z)}) rotate(${(-me.yaw * 180) / Math.PI})`}>
            <path d="M0 -5 L3.5 3.5 L0 1.8 L-3.5 3.5 Z" fill="#3b6fd8" stroke="#fff" strokeWidth={1} />
          </g>
        </svg>
      </div>
      <div className="teleports">
        {(Object.keys(SPOTS) as SpotId[]).map((k) => (
          <button key={k} onClick={() => requestTeleport(k)}>
            {SPOTS[k].label}
          </button>
        ))}
      </div>
    </div>
  );
}
