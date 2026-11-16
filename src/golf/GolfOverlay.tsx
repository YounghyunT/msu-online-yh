import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { useGolf } from './golfStore';
import { HOLES } from '../world/golfCourse';
import { shareGolfResult } from '../net/realtime';
import { Leaderboard } from '../ui/Leaderboard';
import { sfx } from '../audio/sound';

/** 파크골프 미니게임 화면 UI (지연 로딩) */
export default function GolfOverlay() {
  const setPhase = useStore((s) => s.setPhase);
  const conn = useStore((s) => s.conn);
  const { hole, strokes, power, aiming, resting, message, finished, restart } = useGolf();
  const total = strokes.reduce((a, b) => a + b, 0);
  const par = HOLES.reduce((a, h) => a + h.par, 0);
  const shared = useRef(false);

  useEffect(() => {
    if (finished && !shared.current) {
      shared.current = true;
      shareGolfResult(total);
      sfx.fanfare();
    }
    if (!finished) shared.current = false;
  }, [finished, total]);

  return (
    <>
      <div className="golf-top panel">
        <div className="golf-title">⛳ 파크골프 · {HOLES[hole].name}</div>
        <div className="golf-score">
          {HOLES.map((h, i) => (
            <span key={h.name} className={i === hole && !finished ? 'cur' : ''}>
              {i + 1}H <b>{strokes[i]}</b>
            </span>
          ))}
          <span>
            합계 <b>{total}</b>
          </span>
        </div>
      </div>

      <button className="icon-btn golf-exit" onClick={() => setPhase('play')}>
        ✕ 나가기 <span className="lbl">(ESC)</span>
      </button>

      {!finished && (
        <div className="golf-hint">{resting ? (aiming ? '놓으면 발사!' : '공 주변을 드래그해서 당겼다 놓으세요 (새총처럼)') : '굴러가는 중…'}</div>
      )}

      <div className={`power ${aiming ? 'show' : ''}`}>
        <div className="power-label">파워</div>
        <div className="power-bar">
          <i style={{ height: `${Math.round(power * 100)}%`, background: `hsl(${120 - power * 120} 80% 50%)` }} />
        </div>
        <div className="power-val">{Math.round(power * 100)}%</div>
      </div>

      {message && <div className="toast golf-msg">{message}</div>}

      {finished && (
        <div className="overlay center dim">
          <div className="panel modal golf-result">
            <h2>🏁 파크골프 결과</h2>
            <div className="result-big">
              총 <b>{total}</b>타 <small>(기준 {par}타, {total - par >= 0 ? `+${total - par}` : total - par})</small>
            </div>
            <table className="result-table">
              <tbody>
                <tr>
                  {HOLES.map((h) => (
                    <th key={h.name}>{h.name}</th>
                  ))}
                </tr>
                <tr>
                  {strokes.map((s, i) => (
                    <td key={i}>{s}타</td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="muted">{conn === 'online' ? '기록이 접속자 모두의 리더보드에 공유되었어요!' : '혼자 모드에서는 내 화면에만 기록돼요.'}</p>
            <Leaderboard />
            <div className="result-actions">
              <button className="btn warm" onClick={restart}>
                🔁 다시 하기
              </button>
              <button className="btn primary" onClick={() => setPhase('play')}>
                캠퍼스로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
