import * as THREE from 'three';

/** 모든 셰이더가 공유하는 전역 유니폼 */
export const globalUniforms = {
  uTime: { value: 0 },
  /** 크리스마스 전환 정도 0..1 (눈 쌓임, 밤 분위기) */
  uSnow: { value: 0 },
};

const SNOW_VERT_HEAD = /* glsl */ `
uniform float uSnow;
varying float vSnowUp;
varying vec3 vSnowPos;
`;
const SNOW_VERT_BODY = /* glsl */ `
{
  vec3 sn = objectNormal;
  vec4 sp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    sn = mat3(instanceMatrix) * sn;
    sp = instanceMatrix * sp;
  #endif
  vSnowUp = normalize(mat3(modelMatrix) * sn).y;
  vSnowPos = (modelMatrix * sp).xyz;
}
#include <project_vertex>
`;
const SNOW_FRAG_HEAD = /* glsl */ `
uniform float uSnow;
varying float vSnowUp;
varying vec3 vSnowPos;
float snowHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float snowNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(snowHash(i), snowHash(i + vec2(1.0, 0.0)), f.x), mix(snowHash(i + vec2(0.0, 1.0)), snowHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;
const SNOW_FRAG_BODY = /* glsl */ `
#include <color_fragment>
{
  float n = snowNoise(vSnowPos.xz * 0.9) * 0.6 + snowNoise(vSnowPos.xz * 3.7) * 0.4;
  float cover = uSnow * smoothstep(0.55, 0.92, vSnowUp) * smoothstep(0.25, 0.6, n + uSnow * 0.25);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.98), cover * 0.75);
}
`;

/** 위를 향한 면에 눈이 살짝 쌓이도록 셰이더를 확장한다 */
export function withSnow<T extends THREE.Material>(mat: T): T {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.uSnow = globalUniforms.uSnow;
    shader.vertexShader = SNOW_VERT_HEAD + shader.vertexShader.replace('#include <project_vertex>', SNOW_VERT_BODY);
    shader.fragmentShader = SNOW_FRAG_HEAD + shader.fragmentShader.replace('#include <color_fragment>', SNOW_FRAG_BODY);
  };
  const prevKey = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|snow';
  return mat;
}

// 공용 머티리얼 캐시
const mats = new Map<string, THREE.Material>();
export function cachedMat<T extends THREE.Material>(key: string, make: () => T): T {
  let m = mats.get(key) as T | undefined;
  if (!m) {
    m = make();
    mats.set(key, m);
  }
  return m;
}
