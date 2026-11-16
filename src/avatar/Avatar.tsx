import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { AvatarConfig } from './avatarConfig';
import { avatarGeometry, animateRig, createRig, AVATAR_HEIGHT } from './buildAvatar';
import { makeNameTag, disposeNameTag } from './nameTag';
import type { AnimState, EmoteId } from '../store';

export interface AvatarDriver {
  anim: AnimState;
  emote?: { id: EmoteId; at: number } | null;
}

interface Props {
  config: AvatarConfig;
  driver: React.MutableRefObject<AvatarDriver>;
  name?: string;
  isMe?: boolean;
  /** 원격 아바타: 거리 기반 LOD/이름표 숨김 */
  lod?: boolean;
}

const tmp = new THREE.Vector3();

export function Avatar({ config, driver, name, isMe, lod }: Props) {
  const rig = useMemo(() => createRig(config, 0), [config]);
  const group = useRef<THREE.Group>(null!);
  const tag = useMemo(() => (name !== undefined ? makeNameTag(name, isMe) : null), [name, isMe]);
  const lodLevel = useRef<0 | 1>(0);

  useEffect(() => () => rig.mesh.skeleton.dispose(), [rig]);
  useEffect(() => {
    if (!tag) return;
    tag.position.set(0, AVATAR_HEIGHT + 0.32, 0);
    return () => disposeNameTag(tag);
  }, [tag]);

  useFrame((state) => {
    const d = driver.current;
    animateRig(rig, d.anim, state.clock.elapsedTime, d.emote);
    if (lod) {
      group.current.getWorldPosition(tmp);
      const dist = tmp.distanceTo(state.camera.position);
      const want: 0 | 1 = dist > 22 ? 1 : 0;
      if (want !== lodLevel.current) {
        lodLevel.current = want;
        rig.mesh.geometry = avatarGeometry(config, want);
        rig.mesh.computeBoundingSphere();
      }
      rig.mesh.visible = dist < 110;
      if (tag) tag.visible = dist < 28;
    }
  });

  return (
    <group ref={group}>
      <primitive object={rig.mesh} />
      {tag && <primitive object={tag} />}
    </group>
  );
}
