import { GOLF, PLATEAU_Y } from './layout';

// 파크골프장 코스 정의 (월드 시각화와 미니게임이 공유)
export interface Wall {
  x: number;
  z: number;
  w: number; // x 방향 길이
  d: number; // z 방향 길이
}
export interface Hole {
  name: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  tee: [number, number];
  cup: [number, number];
  par: number;
  obstacles: Wall[];
}

const Y = PLATEAU_Y;
export const COURSE_Y = Y;
export const BORDER_H = 0.28;
export const BORDER_T = 0.22;
export const BALL_R = 0.14;
export const CUP_R = 0.24;

const Z0 = GOLF.z0 + 1;
const Z1 = GOLF.z1 - 1;

export const HOLES: Hole[] = [
  { name: '1번 홀', x0: 39, x1: 45.5, z0: Z0, z1: Z1, tee: [42.25, Z1 - 2.5], cup: [42.25, Z0 + 3], par: 3, obstacles: [{ x: 42.25, z: 6, w: 2.2, d: 0.6 }] },
  {
    name: '2번 홀',
    x0: 47.5,
    x1: 54,
    z0: Z0,
    z1: Z1,
    tee: [50.75, Z0 + 2.5],
    cup: [50.75, Z1 - 3],
    par: 3,
    obstacles: [
      { x: 49.2, z: 4, w: 3.2, d: 0.5 },
      { x: 52.3, z: 12, w: 3.2, d: 0.5 },
    ],
  },
  {
    name: '3번 홀',
    x0: 56,
    x1: 62.5,
    z0: Z0,
    z1: Z1,
    tee: [59.25, Z1 - 2.5],
    cup: [60.6, Z0 + 3],
    par: 4,
    obstacles: [
      { x: 57.8, z: 14, w: 3.6, d: 0.5 },
      { x: 60.7, z: 5, w: 3.6, d: 0.5 },
      { x: 58.2, z: -4, w: 3.2, d: 0.5 },
    ],
  },
];

/** 각 홀의 테두리 벽 (바깥 사각형) */
export function borderWalls(h: Hole): Wall[] {
  const w = h.x1 - h.x0;
  const d = h.z1 - h.z0;
  const t = BORDER_T;
  return [
    { x: (h.x0 + h.x1) / 2, z: h.z0 - t / 2, w: w + t * 2, d: t },
    { x: (h.x0 + h.x1) / 2, z: h.z1 + t / 2, w: w + t * 2, d: t },
    { x: h.x0 - t / 2, z: (h.z0 + h.z1) / 2, w: t, d },
    { x: h.x1 + t / 2, z: (h.z0 + h.z1) / 2, w: t, d },
  ];
}
