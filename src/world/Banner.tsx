import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createPortal, useFrame } from '@react-three/fiber';
import { Text, useFBO } from '@react-three/drei';
import { FONT_SANS } from '../loading';
import { globalUniforms } from './materials';

interface Props {
  width: number;
  height: number;
  position: [number, number, number];
  text: string;
}

/**
 * 현수막: 글자(drei Text + 한글 서브셋 폰트)를 렌더 타깃에 한 번 그려서 텍스처로 쓰고,
 * 버텍스 셰이더로 바람에 흔들리게 한다. (글자와 천이 함께 흔들림)
 */
export function Banner({ width, height, position, text }: Props) {
  const fbo = useFBO(2048, Math.round((2048 * height) / width), { samples: 0, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const scene = useMemo(() => new THREE.Scene(), []);
  const cam = useMemo(() => new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, -10, 10), [width, height]);
  const frames = useRef(6);

  const bg = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, c.width, 0);
    g.addColorStop(0, '#2f3fbf');
    g.addColorStop(0.5, '#5b46c8');
    g.addColorStop(1, '#7b3fb8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(0, 3, c.width, 2);
    ctx.fillRect(0, c.height - 5, c.width, 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  const mat = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ map: fbo.texture, side: THREE.DoubleSide });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = globalUniforms.uTime;
      shader.uniforms.uHalfW = { value: width / 2 };
      shader.vertexShader = 'uniform float uTime;\nuniform float uHalfW;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        float pin = 1.0 - pow(abs(position.x) / uHalfW, 4.0);
        float w = sin(position.x * 1.1 + uTime * 2.3) * 0.07 + sin(position.x * 2.9 - uTime * 3.4 + position.y * 2.0) * 0.03;
        transformed.z += w * pin;
        transformed.y += sin(position.x * 0.8 + uTime * 1.7) * 0.03 * pin;`,
      );
    };
    m.customProgramCacheKey = () => 'banner';
    return m;
  }, [fbo, width]);

  useFrame(({ gl }) => {
    if (frames.current <= 0) return;
    frames.current--;
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(fbo);
    gl.render(scene, cam);
    gl.setRenderTarget(prev);
  });

  const h = height;
  return (
    <>
      {createPortal(
        <>
          <mesh>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial map={bg} toneMapped={false} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * (width / 2 - h * 0.55), 0, 0.5]}>
              <mesh>
                <circleGeometry args={[h * 0.36, 32]} />
                <meshBasicMaterial color="#e0218a" toneMapped={false} />
              </mesh>
              <Text font={FONT_SANS} fontSize={h * 0.42} color="#ffffff" anchorX="center" anchorY="middle" position={[0, h * 0.02, 0.1]} onSync={() => (frames.current = 4)}>
                {s < 0 ? '경' : '축'}
              </Text>
            </group>
          ))}
          <Text
            font={FONT_SANS}
            fontSize={h * 0.4}
            whiteSpace="nowrap"
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            position={[0, h * 0.02, 1]}
            outlineWidth={h * 0.012}
            outlineColor="#1f1a6b"
            onSync={() => (frames.current = 4)}
          >
            {text}
          </Text>
        </>,
        scene,
      )}
      <mesh position={position} material={mat} castShadow>
        <planeGeometry args={[width, height, 40, 4]} />
      </mesh>
    </>
  );
}
