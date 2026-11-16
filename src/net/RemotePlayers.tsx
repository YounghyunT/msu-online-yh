import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useStore, live, Peer } from '../store';
import { Avatar, AvatarDriver } from '../avatar/Avatar';

const STALE_MS = 1500;

function RemotePlayer({ peer }: { peer: Peer }) {
  const group = useRef<THREE.Group>(null!);
  const driver = useRef<AvatarDriver>({ anim: 'idle', emote: null });
  const st = useRef({ init: false, yaw: 0, emoteAt: 0 });

  useFrame((state, dt) => {
    const r = live.remotes.get(peer.id);
    const g = group.current;
    if (!r) {
      g.visible = false;
      return;
    }
    const s = st.current;
    if (!s.init || Math.hypot(g.position.x - r.x, g.position.z - r.z) > 25) {
      g.position.set(r.x, r.y, r.z);
      s.yaw = r.yaw;
      s.init = true;
    }
    g.visible = true;
    // 보간: 5Hz 수신값을 부드럽게
    const k = 1 - Math.exp(-dt * 10);
    g.position.x += (r.x - g.position.x) * k;
    g.position.y += (r.y - g.position.y) * k;
    g.position.z += (r.z - g.position.z) * k;
    let d = r.yaw - s.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    s.yaw += d * Math.min(1, dt * 10);
    g.rotation.y = s.yaw + Math.PI;
    // 업데이트가 끊기면 마지막 위치에 서 있게
    const stale = performance.now() - r.t > STALE_MS;
    driver.current.anim = stale && r.anim !== 'idle' ? 'idle' : r.anim;
    if (r.emote && r.emote.at !== s.emoteAt) {
      s.emoteAt = r.emote.at;
      driver.current.emote = { id: r.emote.id, at: state.clock.elapsedTime };
    }
  });

  return (
    <group ref={group} visible={false}>
      <Avatar config={peer.avatar} driver={driver} name={peer.name} lod />
    </group>
  );
}

export function RemotePlayers() {
  const peers = useStore((s) => s.peers);
  const myId = useStore((s) => s.myId);
  return (
    <>
      {Object.values(peers)
        .filter((p) => p.id !== myId)
        .map((p) => (
          <RemotePlayer key={p.id} peer={p} />
        ))}
    </>
  );
}
