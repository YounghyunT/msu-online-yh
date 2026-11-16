import { useStore, Quality } from '../store';
import { VolumeSliders } from './SoundControls';

const Q: { id: Quality; label: string; desc: string }[] = [
  { id: 'high', label: '고화질', desc: '그림자·빛번짐 최대' },
  { id: 'mid', label: '중화질', desc: '균형 (모바일 권장)' },
  { id: 'low', label: '저화질', desc: '그림자 끔, 가장 빠름' },
];

function Modal({ title, children }: { title: string; children: React.ReactNode }) {
  const setPanel = useStore((s) => s.setPanel);
  return (
    <div className="overlay center dim" onPointerDown={(e) => e.target === e.currentTarget && setPanel(null)}>
      <div className="panel modal">
        <button className="btn ghost close" onClick={() => setPanel(null)} aria-label="닫기">
          ✕
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function QualityPanel() {
  const quality = useStore((s) => s.quality);
  const auto = useStore((s) => s.autoQuality);
  const setQuality = useStore((s) => s.setQuality);
  return (
    <Modal title="⚙️ 설정">
      <h3 className="sub-h">화질</h3>
      <div className="seg">
        {Q.map((q) => (
          <button key={q.id} className={quality === q.id ? 'sel' : ''} onClick={() => setQuality(q.id, false)}>
            {q.label}
            <small>{q.desc}</small>
          </button>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={auto} onChange={(e) => setQuality(quality, e.target.checked)} /> 프레임이 떨어지면 자동으로 화질 낮추기
      </label>
      <h3 className="sub-h">소리</h3>
      <VolumeSliders />
    </Modal>
  );
}

export function HelpPanel() {
  return (
    <Modal title="❓ 조작법">
      <div className="help-grid">
        <span>
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> / 방향키
        </span>
        <span>이동</span>
        <span>
          <kbd>Shift</kbd>
        </span>
        <span>달리기</span>
        <span>
          <kbd>Space</kbd>
        </span>
        <span>점프</span>
        <span>마우스 드래그 / 휠</span>
        <span>카메라 회전 / 줌</span>
        <span>
          <kbd>1</kbd>
          <kbd>2</kbd>
          <kbd>3</kbd>
        </span>
        <span>이모트 (👋 손 흔들기 · 🎉 점프 · 💃 춤)</span>
        <span>
          <kbd>E</kbd>
        </span>
        <span>파크골프장 입구에서 미니게임 시작</span>
        <span>
          <kbd>Esc</kbd>
        </span>
        <span>창 닫기 / 파크골프 나가기</span>
        <span>📱 모바일</span>
        <span>왼쪽 아래 조이스틱으로 이동, 화면 드래그로 시점 회전, 두 손가락으로 줌</span>
      </div>
      <p className="muted">왼쪽 위 미니맵의 버튼으로 정문 · 본관 · 운동장 · 파크골프장으로 순간이동할 수 있어요.</p>
    </Modal>
  );
}
