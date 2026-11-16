// 캠퍼스 배치 상수 (단위: 미터). +Y 위, -Z 방향이 오르막(본관 쪽)
// 정문(낮은 곳, z≈72) → 경사 구간(z 56→34) → 운동장 평지(y=8) → 석축 → 본관(y=12.5)

export const WORLD = {
  minX: -60,
  maxX: 70,
  minZ: -58,
  maxZ: 122,
};

export const PLAZA_Y = 0;
export const PLATEAU_Y = 8;

/** 정문 앞 광장 (낮은 곳) */
export const PLAZA = { z0: 56, z1: WORLD.maxZ };
/** 경사 구간: z=56(y=0) → z=34(y=8) */
export const SLOPE = { zLow: 56, zHigh: 34, rise: PLATEAU_Y - PLAZA_Y };
/** 평지(운동장, 파크골프장) */
export const PLATEAU = { z0: WORLD.minZ, z1: SLOPE.zHigh };

export const GATE_Z = 72;

/** 꽃 그림 계단 (경사 구간 중앙) */
export const FLOWER_STAIRS = { x0: -3, x1: 3 };
/** 오르막 도로 (경사 구간 왼쪽) */
export const RAMP_ROAD = { x0: -15, x1: -7 };

/** 인조잔디 운동장 */
export const FIELD = { cx: 0, cz: 7, w: 60, d: 38 };

/** 석축 테라스 */
export const TERRACE1 = { zFront: -22, zBack: -30, top: 10 };
export const TERRACE2 = { zFront: -30, zBack: -56, top: 12.5 };
export const BRICK_STAIRS = { x0: -2.6, x1: 2.6, zLow: -22, zHigh: -34 };

/**
 * 본관: 좌우 비대칭.
 * 입구(중앙 탑)를 기준으로 왼쪽 동은 더 길고 앞으로 나와 있고,
 * 오른쪽 동은 더 짧고 뒤로 들어가 있다.
 */
export interface Wing {
  x0: number;
  x1: number;
  front: number;
  back: number;
  bays: number;
  /** 바깥쪽 끝 방향 (-1 왼쪽, +1 오른쪽) */
  side: -1 | 1;
}
export const BUILDING = {
  baseY: TERRACE2.top,
  floorH: 3.5,
  floors: 4, // 일반 창 4개 층 + 최상층 아케이드
  tower: { x0: -6, x1: 6, front: -37.3, back: -52 },
  wings: [
    { x0: -51, x1: -6, front: -37.9, back: -51.5, bays: 10, side: -1 },
    { x0: 6, x1: 33.5, front: -42.6, back: -55.2, bays: 7, side: 1 },
  ] as Wing[],
  /** 건물 전체 범위 (미니맵 등) */
  minX: -51,
  maxX: 33.5,
};

/** 파크골프장 */
export const GOLF = { x0: 38, x1: 64, z0: -14, z1: 28, entrance: [36, PLATEAU_Y, 8] as [number, number, number] };

/** 지면 높이 (충돌체와 같은 기준) */
export function groundHeight(x: number, z: number): number {
  if (z >= SLOPE.zLow) return PLAZA_Y;
  if (z > SLOPE.zHigh) return PLAZA_Y + ((SLOPE.zLow - z) / (SLOPE.zLow - SLOPE.zHigh)) * SLOPE.rise;
  if (z > TERRACE1.zFront) return PLATEAU_Y;
  const inStairs = x > BRICK_STAIRS.x0 && x < BRICK_STAIRS.x1;
  if (inStairs) {
    if (z > BRICK_STAIRS.zHigh) return PLATEAU_Y + ((BRICK_STAIRS.zLow - z) / (BRICK_STAIRS.zLow - BRICK_STAIRS.zHigh)) * (TERRACE2.top - PLATEAU_Y);
    return TERRACE2.top;
  }
  if (z > TERRACE1.zBack) return TERRACE1.top;
  return TERRACE2.top;
}

export type SpotId = 'gate' | 'building' | 'field' | 'golf';
export const SPOTS: Record<SpotId, { label: string; pos: [number, number, number]; yaw: number }> = {
  gate: { label: '정문', pos: [0, 0.2, 90], yaw: 0 },
  building: { label: '본관', pos: [0, 8.2, -16], yaw: 0 },
  field: { label: '운동장', pos: [0, 8.2, 22], yaw: 0 },
  golf: { label: '파크골프장', pos: [33, 8.2, 8], yaw: -Math.PI / 2 },
};
