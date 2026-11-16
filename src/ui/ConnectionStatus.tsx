import { useState } from 'react';
import { useStore } from '../store';

export function ConnectionStatus() {
  const conn = useStore((s) => s.conn);
  const peers = useStore((s) => s.peers);
  const myId = useStore((s) => s.myId);
  const nickname = useStore((s) => s.nickname);
  const [open, setOpen] = useState(false);
  const others = Object.values(peers).filter((p) => p.id !== myId);
  const count = others.length + 1;

  const label =
    conn === 'online' ? `🟢 ${count}명 접속 중` : conn === 'reconnecting' || conn === 'connecting' ? '🟡 재연결 중…' : '⚪ 혼자 모드';

  return (
    <>
      <button className="status-chip" onClick={() => setOpen((o) => !o)} title="접속자 목록">
        {label}
        <span style={{ opacity: 0.5 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="panel peer-list">
          <div className="me">🙋 {nickname || '나'} (나)</div>
          {others.length === 0 && <div style={{ color: 'var(--sub)' }}>{conn === 'offline' ? '오프라인 둘러보기 모드예요' : '아직 다른 접속자가 없어요'}</div>}
          {others
            .sort((a, b) => a.joinedAt - b.joinedAt)
            .map((p) => (
              <div key={p.id}>🧑 {p.name}</div>
            ))}
        </div>
      )}
    </>
  );
}
