import * as THREE from 'three';

/** 닉네임 이름표 스프라이트 (임의의 한글 닉네임도 표시되도록 캔버스 + 시스템/웹폰트 사용) */
export function makeNameTag(name: string, isMe = false): THREE.Sprite {
  const font = '600 44px "Pretendard Variable", Pretendard, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = font;
  const label = name || '손님';
  const tw = Math.min(520, Math.ceil(ctx.measureText(label).width));
  const padX = 26;
  c.width = tw + padX * 2;
  c.height = 72;
  ctx.font = font;
  const r = 34;
  ctx.fillStyle = isMe ? 'rgba(59,111,216,0.88)' : 'rgba(20,26,40,0.66)';
  ctx.beginPath();
  ctx.roundRect(2, 2, c.width - 4, c.height - 4, r);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, c.width / 2, c.height / 2 + 2, 520);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, fog: false });
  const sprite = new THREE.Sprite(mat);
  const h = 0.26;
  sprite.scale.set((h * c.width) / c.height, h, 1);
  sprite.renderOrder = 5;
  return sprite;
}

export function disposeNameTag(s: THREE.Sprite) {
  s.material.map?.dispose();
  s.material.dispose();
}
