import { preloadFont } from 'troika-three-text';
import { useStore } from './store';

// 로딩 진행률: 실제로 기다려야 하는 단계별 가중치
const steps: Record<string, { w: number; done: boolean }> = {
  physics: { w: 0.45, done: false },
  fonts: { w: 0.25, done: false },
  world: { w: 0.3, done: false },
};

export function markLoaded(step: keyof typeof steps) {
  if (!steps[step] || steps[step].done) return;
  steps[step].done = true;
  const p = Object.values(steps).reduce((a, s) => a + (s.done ? s.w : 0), 0);
  const st = useStore.getState();
  st.setLoadProgress(p);
  if (p >= 0.999 && st.phase === 'loading') setTimeout(() => useStore.getState().setPhase('lobby'), 250);
}

/** 3D 간판용 한글 서브셋 폰트 */
export const FONT_SANS = '/fonts/sans-kr.woff';
export const FONT_SERIF = '/fonts/serif-kr.woff';

export function preloadFonts() {
  let left = 2;
  const done = () => {
    left -= 1;
    if (left === 0) markLoaded('fonts');
  };
  preloadFont({ font: FONT_SANS }, done);
  preloadFont({ font: FONT_SERIF }, done);
  // 네트워크 문제로 콜백이 안 오더라도 진행되도록
  setTimeout(() => markLoaded('fonts'), 8000);
}
