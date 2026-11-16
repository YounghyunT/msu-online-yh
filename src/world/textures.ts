import * as THREE from 'three';

// 절차적 텍스처: 캔버스로 한 번만 생성하고 캐시해서 재사용한다.
const cache = new Map<string, THREE.Texture>();

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(key: string, w: number, h: number, draw: Draw, opts: { repeat?: boolean; srgb?: boolean; aniso?: number } = {}) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = opts.aniso ?? 4;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed = 1) {
  const r = rng(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, colors: string[], count: number, size: [number, number], seed = 2) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    const s = size[0] + r() * (size[1] - size[0]);
    ctx.fillRect(r() * w, r() * h, s, s * (0.5 + r()));
  }
}

export const tex = {
  grass: () =>
    canvasTex('grass', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#5d9a3f';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, ['#4f8a35', '#6aa94a', '#78b356', '#46802f'], 2200, [1, 3]);
      noise(ctx, w, h, 18);
    }),

  /** 인조잔디 운동장: 줄무늬 + 흰색 라인 (60m x 38m) */
  turf: () =>
    canvasTex(
      'turf',
      2048,
      1296,
      (ctx, w, h) => {
        const sx = w / 60;
        const sz = h / 38;
        const stripes = 12;
        for (let i = 0; i < stripes; i++) {
          ctx.fillStyle = i % 2 ? '#2f8f3a' : '#3a9c44';
          ctx.fillRect((i * w) / stripes, 0, w / stripes + 1, h);
        }
        speckle(ctx, w, h, ['#2a8434', '#43a64d', '#338f3c'], 26000, [1, 2], 7);
        // 라인 (필드 안쪽 1m 여백)
        ctx.strokeStyle = '#f4f7f2';
        ctx.lineWidth = 0.14 * sx;
        const m = 1.2;
        const L = m * sx;
        const R = w - m * sx;
        const T = m * sz;
        const B = h - m * sz;
        ctx.strokeRect(L, T, R - L, B - T);
        // 하프라인
        ctx.beginPath();
        ctx.moveTo(w / 2, T);
        ctx.lineTo(w / 2, B);
        ctx.stroke();
        // 센터서클
        ctx.beginPath();
        ctx.ellipse(w / 2, h / 2, 6 * sx, 6 * sz, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#f4f7f2';
        ctx.beginPath();
        ctx.ellipse(w / 2, h / 2, 0.3 * sx, 0.3 * sz, 0, 0, Math.PI * 2);
        ctx.fill();
        // 페널티박스, 골에어리어
        for (const side of [0, 1]) {
          const x0 = side ? R : L;
          const dir = side ? -1 : 1;
          const pbD = 10 * sx;
          const pbW = 20 * sz;
          ctx.strokeRect(side ? x0 - pbD : x0, h / 2 - pbW / 2, pbD, pbW);
          const gaD = 3.5 * sx;
          const gaW = 9 * sz;
          ctx.strokeRect(side ? x0 - gaD : x0, h / 2 - gaW / 2, gaD, gaW);
          // 페널티 아크
          ctx.beginPath();
          ctx.ellipse(x0 + dir * 7.5 * sx, h / 2, 5 * sx, 5 * sz, 0, side ? Math.PI * 0.62 : -Math.PI * 0.38, side ? Math.PI * 1.38 : Math.PI * 0.38);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(x0 + dir * 7.5 * sx, h / 2, 0.25 * sx, 0.25 * sz, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      { repeat: false, aniso: 8 },
    ),

  /** 화강암 블록 (2m x 2m 타일) */
  granite: () =>
    canvasTex('granite', 512, 512, (ctx, w, h) => {
      const r = rng(11);
      ctx.fillStyle = '#6f6f6c';
      ctx.fillRect(0, 0, w, h);
      const rows = 5;
      const rh = h / rows;
      for (let y = 0; y < rows; y++) {
        const cols = 2;
        const cw = w / cols;
        const off = y % 2 ? cw / 2 : 0;
        for (let x = -1; x < cols; x++) {
          const g = 150 + r() * 40;
          ctx.fillStyle = `rgb(${g},${g - 2},${g - 6})`;
          const px = x * cw + off + 3;
          ctx.fillRect(px, y * rh + 3, cw - 6, rh - 6);
          // 거친 표면
          for (let k = 0; k < 220; k++) {
            const v = g + (r() - 0.5) * 60;
            ctx.fillStyle = `rgb(${v},${v},${v - 4})`;
            ctx.fillRect(px + r() * (cw - 8), y * rh + 4 + r() * (rh - 10), 2 + r() * 5, 2 + r() * 4);
          }
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(px, y * rh + 3, cw - 6, 3);
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(px, y * rh + rh - 6, cw - 6, 3);
        }
      }
      noise(ctx, w, h, 26, 12);
    }),

  /** 회색 막돌 석축 (3m x 3m 타일) */
  rubble: () =>
    canvasTex('rubble', 512, 512, (ctx, w, h) => {
      const r = rng(21);
      ctx.fillStyle = '#4a4744';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {
        const x = r() * w;
        const y = r() * h;
        const rx = 14 + r() * 26;
        const ry = 10 + r() * 16;
        const g = 120 + r() * 70;
        const tint = r() * 14;
        for (const [ox, oy] of [
          [0, 0],
          [w, 0],
          [-w, 0],
          [0, h],
          [0, -h],
        ]) {
          ctx.fillStyle = `rgb(${g + tint},${g + tint * 0.6},${g - 4})`;
          ctx.beginPath();
          const sides = 6 + Math.floor(r() * 3);
          for (let s = 0; s < sides; s++) {
            const a = (s / sides) * Math.PI * 2;
            const rr = 0.75 + ((s * 7919 + i) % 10) / 40;
            ctx.lineTo(x + ox + Math.cos(a) * rx * rr, y + oy + Math.sin(a) * ry * rr);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
      noise(ctx, w, h, 30, 22);
    }),

  brick: () =>
    canvasTex('brick', 256, 256, (ctx, w, h) => {
      const r = rng(31);
      ctx.fillStyle = '#8c6f62';
      ctx.fillRect(0, 0, w, h);
      const rows = 8;
      const rh = h / rows;
      for (let y = 0; y < rows; y++) {
        const cw = w / 4;
        const off = y % 2 ? cw / 2 : 0;
        for (let x = -1; x < 4; x++) {
          const v = r() * 30;
          ctx.fillStyle = `rgb(${150 + v},${62 + v * 0.4},${50 + v * 0.3})`;
          ctx.fillRect(x * cw + off + 2, y * rh + 2, cw - 4, rh - 4);
        }
      }
      noise(ctx, w, h, 22, 32);
    }),

  asphalt: () =>
    canvasTex('asphalt', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#55575a';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, ['#4a4c4f', '#64666a', '#6e7073'], 3000, [1, 2], 41);
      noise(ctx, w, h, 16, 42);
    }),

  paving: () =>
    canvasTex('paving', 256, 256, (ctx, w, h) => {
      const r = rng(51);
      ctx.fillStyle = '#8f8a86';
      ctx.fillRect(0, 0, w, h);
      const n = 8;
      const s = w / n;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const v = r() * 26;
          const pink = (x + y) % 5 === 0;
          ctx.fillStyle = pink ? `rgb(${170 + v},${120 + v},${110 + v})` : `rgb(${165 + v},${160 + v},${154 + v})`;
          ctx.fillRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3);
        }
      noise(ctx, w, h, 14, 52);
    }),

  cream: () =>
    canvasTex('cream', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#efe6d2';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, ['#e7dcc5', '#f4ecdc', '#e2d6bd'], 1400, [1, 4], 61);
      noise(ctx, w, h, 8, 62);
    }),

  /** 사각 창문 (흰 창틀 + 유리) */
  window: () =>
    canvasTex(
      'window',
      128,
      160,
      (ctx, w, h) => {
        ctx.fillStyle = '#f2efe8';
        ctx.fillRect(0, 0, w, h);
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#8fb3cf');
        g.addColorStop(0.45, '#4e6f8c');
        g.addColorStop(1, '#2f4a63');
        ctx.fillStyle = g;
        const f = 9;
        ctx.fillRect(f, f, w - 2 * f, h - 2 * f);
        ctx.fillStyle = '#f2efe8';
        ctx.fillRect(w / 2 - 3, f, 6, h - 2 * f);
        ctx.fillRect(f, h * 0.33, w - 2 * f, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.moveTo(f, h * 0.7);
        ctx.lineTo(w * 0.45, f);
        ctx.lineTo(w * 0.62, f);
        ctx.lineTo(f, h * 0.9);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(0, h - 6, w, 6);
      },
      { repeat: false },
    ),

  /** 최상층 아케이드 아치 창 (크림 바탕 + 분홍빛 베이지 아치 테두리) */
  archWindow: () =>
    canvasTex(
      'archWindow',
      128,
      160,
      (ctx, w, h) => {
        ctx.fillStyle = '#efe6d2';
        ctx.fillRect(0, 0, w, h);
        const cx = w / 2;
        const rOuter = w / 2 - 4;
        const top = rOuter + 6;
        const path = (r: number, inset: number) => {
          ctx.beginPath();
          ctx.moveTo(cx - r, h - inset);
          ctx.lineTo(cx - r, top);
          ctx.arc(cx, top, r, Math.PI, 0);
          ctx.lineTo(cx + r, h - inset);
          ctx.closePath();
        };
        ctx.fillStyle = '#d9ad98';
        path(rOuter, 0);
        ctx.fill();
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#9bb8cf');
        g.addColorStop(1, '#3c5670');
        ctx.fillStyle = g;
        path(rOuter - 12, 10);
        ctx.fill();
        ctx.fillStyle = '#f2efe8';
        ctx.fillRect(cx - 2, top - 30, 4, h);
        ctx.fillRect(cx - rOuter + 12, top + 26, (rOuter - 12) * 2, 4);
      },
      { repeat: false },
    ),

  /** 중앙 탑의 세로로 긴 아치 창 */
  tallArch: () =>
    canvasTex(
      'tallArch',
      64,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = '#efe6d2';
        ctx.fillRect(0, 0, w, h);
        const cx = w / 2;
        const r = w / 2 - 6;
        ctx.fillStyle = '#d9b9a6';
        ctx.beginPath();
        ctx.moveTo(cx - r - 3, h);
        ctx.lineTo(cx - r - 3, r + 8);
        ctx.arc(cx, r + 8, r + 3, Math.PI, 0);
        ctx.lineTo(cx + r + 3, h);
        ctx.fill();
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#a8c3d8');
        g.addColorStop(1, '#3a536b');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx - r + 3, h - 4);
        ctx.lineTo(cx - r + 3, r + 8);
        ctx.arc(cx, r + 8, r - 3, Math.PI, 0);
        ctx.lineTo(cx + r - 3, h - 4);
        ctx.fill();
        ctx.fillStyle = '#f2efe8';
        for (let y = r + 40; y < h; y += 46) ctx.fillRect(cx - r + 3, y, 2 * r - 6, 3);
        ctx.fillRect(cx - 1.5, r, 3, h);
      },
      { repeat: false },
    ),

  /** 꽃 그림 계단 */
  flowerStairs: () =>
    canvasTex(
      'flowerStairs',
      512,
      1024,
      (ctx, w, h) => {
        ctx.fillStyle = '#b9b6b1';
        ctx.fillRect(0, 0, w, h);
        noise(ctx, w, h, 14, 71);
        const r = rng(72);
        const flower = (x: number, y: number, s: number, petal: string, center: string, n: number) => {
          ctx.fillStyle = petal;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            ctx.beginPath();
            ctx.ellipse(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.5, s * 0.25, a, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = center;
          ctx.beginPath();
          ctx.arc(x, y, s * 0.22, 0, Math.PI * 2);
          ctx.fill();
        };
        // 줄기와 잎
        ctx.strokeStyle = '#5e9a54';
        ctx.lineWidth = 6;
        for (let i = 0; i < 9; i++) {
          ctx.beginPath();
          ctx.moveTo(r() * w, h);
          ctx.quadraticCurveTo(r() * w, h * 0.6, r() * w, r() * h * 0.7);
          ctx.stroke();
        }
        const palette: [string, string][] = [
          ['#f07fb0', '#ffe066'],
          ['#3fa3d9', '#ffffff'],
          ['#f6f2ea', '#f2c14e'],
          ['#e9547b', '#ffd34d'],
          ['#9b7ad8', '#fff3a0'],
          ['#ffb347', '#d9534f'],
        ];
        for (let i = 0; i < 22; i++) {
          const [p, c] = palette[i % palette.length];
          flower(40 + r() * (w - 80), 40 + r() * (h - 80), 50 + r() * 70, p, c, 6 + Math.floor(r() * 4));
        }
      },
      { repeat: false },
    ),

  /** 운동장 왼쪽 낮은 벽의 벽화 */
  mural: () =>
    canvasTex('mural', 1024, 128, (ctx, w, h) => {
      ctx.fillStyle = '#e9eef2';
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#9fd3f5');
      g.addColorStop(1, '#e9f6ff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h * 0.55);
      ctx.fillStyle = '#2f7fc1';
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * 0.62 + Math.sin(x * 0.03) * 8);
      ctx.lineTo(w, h);
      ctx.fill();
      ctx.fillStyle = '#1d5d99';
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * 0.78 + Math.sin(x * 0.05 + 1) * 6);
      ctx.lineTo(w, h);
      ctx.fill();
      // 배와 물고기
      const r = rng(81);
      for (let i = 0; i < 6; i++) {
        const x = 60 + i * 170 + r() * 40;
        ctx.fillStyle = ['#ffffff', '#f6d54a', '#ef6b6b'][i % 3];
        ctx.beginPath();
        ctx.moveTo(x - 40, h * 0.58);
        ctx.lineTo(x + 40, h * 0.58);
        ctx.lineTo(x + 28, h * 0.7);
        ctx.lineTo(x - 28, h * 0.7);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x, h * 0.58);
        ctx.lineTo(x, h * 0.2);
        ctx.lineTo(x + 26, h * 0.52);
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, 6);
    }),

  chainLink: () =>
    canvasTex('chainLink', 64, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#3f8f4e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, h);
      ctx.moveTo(w, 0);
      ctx.lineTo(0, h);
      ctx.stroke();
    }),

  net: () =>
    canvasTex('net', 64, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, w, h);
    }),

  wood: () =>
    canvasTex('wood', 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#8a5a34';
      ctx.fillRect(0, 0, w, h);
      const r = rng(91);
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = `rgba(${60 + r() * 40},${35 + r() * 20},20,0.5)`;
        ctx.lineWidth = 1 + r() * 2;
        ctx.beginPath();
        const y = r() * h;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(w * 0.3, y + r() * 8 - 4, w * 0.6, y + r() * 8 - 4, w, y);
        ctx.stroke();
      }
      noise(ctx, w, h, 14, 92);
    }),

  fairway: () =>
    canvasTex('fairway', 256, 256, (ctx, w, h) => {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? '#79bf55' : '#86c962';
        ctx.fillRect(0, (i * h) / 8, w, h / 8 + 1);
      }
      speckle(ctx, w, h, ['#6fb24c', '#8fd06b'], 1800, [1, 2], 95);
    }),

  soil: () =>
    canvasTex('soil', 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#6b5a45';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, ['#5c4c3a', '#7a6852', '#4f6b36'], 900, [1, 3], 97);
      noise(ctx, w, h, 16, 98);
    }),
};
