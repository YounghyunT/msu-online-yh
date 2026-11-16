export interface AvatarConfig {
  skin: number;
  hair: number;
  hairColor: number;
  top: number;
  bottom: number;
  hat: number;
  glasses: boolean;
}

export const SKIN_TONES = ['#ffe3cf', '#f5c9a0', '#d89f72', '#8f5a3a'];
export const HAIR_STYLES = ['숏컷', '단발', '뽀글머리', '포니테일'];
export const HAIR_COLORS = ['#2a211d', '#6b4226', '#e2b85c', '#b4452f', '#f09ab6', '#4b78cf'];
export const TOP_COLORS = ['#e94b4b', '#f39a2e', '#f5d33f', '#4cb86b', '#4fb3e8', '#2c4a8c', '#8e5cd1', '#f6f4ee'];
export const BOTTOM_COLORS = ['#3b5b8c', '#2d2d34', '#b9a27a', '#8a8f98'];
export const HATS = ['없음', '야구모자', '학사모', '산타모자'];

export const DEFAULT_AVATAR: AvatarConfig = { skin: 0, hair: 0, hairColor: 0, top: 4, bottom: 0, hat: 0, glasses: false };

const clampInt = (v: unknown, max: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < max ? (v as number) : 0);

export function sanitizeAvatar(a: Partial<AvatarConfig> | null | undefined): AvatarConfig {
  return {
    skin: clampInt(a?.skin, SKIN_TONES.length),
    hair: clampInt(a?.hair, HAIR_STYLES.length),
    hairColor: clampInt(a?.hairColor, HAIR_COLORS.length),
    top: clampInt(a?.top, TOP_COLORS.length),
    bottom: clampInt(a?.bottom, BOTTOM_COLORS.length),
    hat: clampInt(a?.hat, HATS.length),
    glasses: !!a?.glasses,
  };
}

/** 네트워크 전송용 짧은 문자열 (예: "0102340") */
export function encodeAvatar(a: AvatarConfig): string {
  return `${a.skin}${a.hair}${a.hairColor}${a.top}${a.bottom}${a.hat}${a.glasses ? 1 : 0}`;
}

export function decodeAvatar(s: string | undefined): AvatarConfig {
  if (!s || s.length < 7) return DEFAULT_AVATAR;
  const d = [...s].map((c) => parseInt(c, 10));
  return sanitizeAvatar({ skin: d[0], hair: d[1], hairColor: d[2], top: d[3], bottom: d[4], hat: d[5], glasses: d[6] === 1 });
}

export function randomAvatar(): AvatarConfig {
  const r = (n: number) => Math.floor(Math.random() * n);
  return { skin: r(4), hair: r(4), hairColor: r(6), top: r(8), bottom: r(4), hat: r(4), glasses: Math.random() < 0.3 };
}

export function loadAvatar(): AvatarConfig | null {
  try {
    const raw = localStorage.getItem('mstc.avatar');
    return raw ? sanitizeAvatar(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveAvatar(a: AvatarConfig) {
  try {
    localStorage.setItem('mstc.avatar', JSON.stringify(a));
  } catch {
    /* ignore */
  }
}

export function loadNickname(): string {
  try {
    return localStorage.getItem('mstc.nickname') ?? '';
  } catch {
    return '';
  }
}

export function saveNickname(n: string) {
  try {
    localStorage.setItem('mstc.nickname', n);
  } catch {
    /* ignore */
  }
}
