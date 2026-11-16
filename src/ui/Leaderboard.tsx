import { useState } from 'react';
import { useStore } from '../store';

const MEDAL = ['🥇', '🥈', '🥉', '4', '5'];

export function Leaderboard({ compact }: { compact?: boolean }) {
  const list = useStore((s) => s.leaderboard);
  const [open, setOpen] = useState(!compact || window.innerWidth > 720);
  const top = list.slice(0, 5);
  if (compact && !open)
    return (
      <button className="icon-btn" onClick={() => setOpen(true)} title="오늘의 리더보드">
        🏆<span className="lbl">리더보드</span>
      </button>
    );
  return (
    <div className="panel leaderboard" onClick={() => compact && setOpen(false)}>
      <h3>🏆 오늘의 리더보드 · 파크골프</h3>
      {top.length === 0 ? (
        <div className="empty">아직 기록이 없어요. 첫 기록에 도전!</div>
      ) : (
        <ol className="lb-list">
          {top.map((e, i) => (
            <li key={`${e.id}${e.at}`}>
              <span className="medal">{MEDAL[i]}</span>
              <span className="lb-name">{e.name}</span>
              <b>{e.strokes}타</b>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
