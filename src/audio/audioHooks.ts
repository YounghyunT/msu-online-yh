import { useStore } from '../store';
import { unlockAudio, playMusic, sfx, isMusicWanted } from './sound';

let installed = false;

/** 앱 전역 이벤트 → 효과음/배경음악 연결 (한 번만 호출) */
export function installAudioHooks() {
  if (installed) return;
  installed = true;

  // 브라우저 자동재생 정책: 사용자 입력이 있어야 소리가 난다
  const unlock = () => {
    unlockAudio();
    if (isMusicWanted()) playMusic(useStore.getState().christmas ? 'xmas' : 'day');
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);

  // 버튼 클릭음
  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as HTMLElement | null)?.closest('button');
      if (el && !el.dataset.nosfx) sfx.click();
    },
    true,
  );

  useStore.subscribe((s, p) => {
    if (s.phase !== p.phase) {
      if (s.phase === 'intro') {
        unlockAudio();
        sfx.enter();
        playMusic(s.christmas ? 'xmas' : 'day');
      }
    }
    if (s.emote && s.emote !== p.emote) sfx.emote(s.emote.id);
    if (s.teleport && s.teleport !== p.teleport) sfx.teleport();
    if (s.christmas !== p.christmas) {
      if (s.christmas) sfx.xmasOn();
      else sfx.xmasOff();
      if (isMusicWanted()) playMusic(s.christmas ? 'xmas' : 'day');
    }
    const n = Object.keys(s.peers).length;
    const pn = Object.keys(p.peers).length;
    if (pn > 0 && n > pn && s.phase !== 'loading' && s.phase !== 'lobby') sfx.pop();
  });
}
