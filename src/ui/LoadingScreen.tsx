import { useStore } from '../store';

export function LoadingScreen() {
  const p = useStore((s) => s.loadProgress);
  return (
    <div className="loading">
      <div className="loading-card">
        <div className="loading-logo">🏫</div>
        <h1>온라인 목포과학대학교</h1>
        <p>캠퍼스를 짓는 중이에요… {Math.round(p * 100)}%</p>
        <div className="progress">
          <i style={{ width: `${Math.max(6, p * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
