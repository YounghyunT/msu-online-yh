import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore, EmoteId } from '../store';
import { input } from '../player/input';
import { Joystick } from './Joystick';
import { Minimap } from './Minimap';
import { AvatarPanel } from './Lobby';
import { QualityPanel, HelpPanel } from './Panels';
import { ConnectionStatus } from './ConnectionStatus';
import { Leaderboard } from './Leaderboard';
import { MuteButton } from './SoundControls';

const GolfOverlay = lazy(() => import('../golf/GolfOverlay'));

export const isTouch = () => typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);

const EMOTES: { id: EmoteId; icon: string; label: string; key: string }[] = [
  { id: 'wave', icon: '👋', label: '손 흔들기', key: '1' },
  { id: 'jump', icon: '🎉', label: '점프', key: '2' },
  { id: 'dance', icon: '💃', label: '춤', key: '3' },
];

export function HUD() {
  const phase = useStore((s) => s.phase);
  const panel = useStore((s) => s.panel);
  const christmas = useStore((s) => s.christmas);
  const nearGolf = useStore((s) => s.nearGolf);
  const spectator = useStore((s) => s.spectator);
  const { setPanel, toggleChristmas, playEmote, setPhase } = useStore.getState();
  const [touch] = useState(isTouch);
  const [showHint, setShowHint] = useState(true);
  const play = phase === 'play';
  const golf = phase === 'golf';

  useEffect(() => {
    if (!play) input.joyX = input.joyY = 0;
  }, [play]);
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 7000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="hud">
      <div className="hud-tl">
        <ConnectionStatus />
        {!golf && <Minimap />}
      </div>

      <div className="hud-tr">
        <button className={`icon-btn ${christmas ? 'on' : ''}`} onClick={toggleChristmas} title="크리스마스 버전">
          🎄<span className="lbl">크리스마스 버전</span>
        </button>
        <MuteButton />
        <button className="icon-btn" onClick={() => setPanel('quality')} title="화질·소리 설정">
          ⚙️<span className="lbl">설정</span>
        </button>
        {!golf && (
          <button className="icon-btn" onClick={() => setPanel('avatar')} title="아바타 꾸미기">
            👕<span className="lbl">꾸미기</span>
          </button>
        )}
        <button className="icon-btn" onClick={() => setPanel('help')} title="도움말">
          ❓<span className="lbl">도움말</span>
        </button>
        {!golf && <Leaderboard compact />}
      </div>

      {play && showHint && !touch && (
        <div className="toast hint-toast">WASD 이동 · Shift 달리기 · Space 점프 · 마우스 드래그로 시점 회전</div>
      )}
      {spectator && <div className="toast spectator">👀 방이 가득 찼어요 (최대 30명). 관전 모드로 둘러보는 중이에요.</div>}

      {play && nearGolf && (
        <button className="prompt" onClick={() => setPhase('golf')}>
          {touch ? '⛳ 터치해서 파크골프 시작' : (
            <>
              <kbd>E</kbd> 키 / 클릭으로 파크골프 시작
            </>
          )}
        </button>
      )}

      {play && (
        <div className={touch ? 'touch-emotes' : 'hud-bc'}>
          <div className="emote-bar">
            {EMOTES.map((e) => (
              <button key={e.id} onClick={() => playEmote(e.id)} title={`${e.label} (${e.key})`}>
                {e.icon}
              </button>
            ))}
          </div>
        </div>
      )}

      {play && touch && (
        <>
          <Joystick />
          <div className="touch-buttons">
            <button
              className="round-btn jump"
              onPointerDown={() => (input.jump = true)}
              onPointerUp={() => (input.jump = false)}
              onPointerLeave={() => (input.jump = false)}
              onPointerCancel={() => (input.jump = false)}
            >
              점프
            </button>
          </div>
        </>
      )}

      {golf && (
        <Suspense fallback={<div className="toast">⛳ 파크골프 준비 중…</div>}>
          <GolfOverlay />
        </Suspense>
      )}

      {panel === 'avatar' && <AvatarPanel />}
      {panel === 'quality' && <QualityPanel />}
      {panel === 'help' && <HelpPanel />}
    </div>
  );
}
