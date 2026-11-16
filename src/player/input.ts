import { useStore, EmoteId } from '../store';

/** 키보드·조이스틱 입력 (가변 객체 – 리렌더 없음) */
export const input = {
  f: 0,
  b: 0,
  l: 0,
  r: 0,
  run: false,
  jump: false,
  joyX: 0,
  joyY: 0,
};

/** 3인칭 카메라 궤도 상태 */
export const orbit = {
  yaw: 0,
  pitch: 0.32,
  dist: 7,
  minDist: 2.5,
  maxDist: 16,
};

const KEYMAP: Record<string, keyof typeof input> = {
  KeyW: 'f',
  ArrowUp: 'f',
  KeyS: 'b',
  ArrowDown: 'b',
  KeyA: 'l',
  ArrowLeft: 'l',
  KeyD: 'r',
  ArrowRight: 'r',
};

const EMOTE_KEYS: Record<string, EmoteId> = { Digit1: 'wave', Digit2: 'jump', Digit3: 'dance' };

let installed = false;
export function installKeyboard(onAction: (a: 'golf' | 'escape') => void) {
  if (installed) return () => {};
  installed = true;
  const isTyping = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  };
  const down = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      onAction('escape');
      return;
    }
    if (isTyping(e)) return;
    const k = KEYMAP[e.code];
    if (k) {
      (input[k] as number) = 1;
      e.preventDefault();
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = true;
    if (e.code === 'Space') {
      input.jump = true;
      e.preventDefault();
    }
    if (!e.repeat && EMOTE_KEYS[e.code] && useStore.getState().phase === 'play') useStore.getState().playEmote(EMOTE_KEYS[e.code]);
    if (!e.repeat && e.code === 'KeyE') onAction('golf');
  };
  const up = (e: KeyboardEvent) => {
    const k = KEYMAP[e.code];
    if (k) (input[k] as number) = 0;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = false;
    if (e.code === 'Space') input.jump = false;
  };
  const blur = () => {
    input.f = input.b = input.l = input.r = 0;
    input.run = input.jump = false;
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => {
    installed = false;
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
  };
}

/** 캔버스 드래그로 카메라 회전, 휠/핀치로 줌 */
export function installOrbitControls(el: HTMLElement) {
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const enabled = () => {
    const p = useStore.getState().phase;
    return p === 'play' || p === 'intro';
  };
  const down = (e: PointerEvent) => {
    if (!enabled()) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const move = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) orbit.dist = clamp(orbit.dist * (pinch / d), orbit.minDist, orbit.maxDist);
      pinch = d;
      return;
    }
    const k = e.pointerType === 'touch' ? 0.007 : 0.005;
    orbit.yaw -= dx * k;
    orbit.pitch = clamp(orbit.pitch + dy * k * 0.8, -0.15, 1.25);
  };
  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
  };
  const wheel = (e: WheelEvent) => {
    if (!enabled()) return;
    orbit.dist = clamp(orbit.dist * (1 + Math.sign(e.deltaY) * 0.1), orbit.minDist, orbit.maxDist);
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', wheel, { passive: true });
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.removeEventListener('wheel', wheel);
  };
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
