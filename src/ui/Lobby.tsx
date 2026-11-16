import { useState } from 'react';
import { useStore } from '../store';
import { AvatarEditor } from './AvatarEditor';
import { MuteButton } from './SoundControls';

export const cleanName = (n: string) => n.replace(/\s+/g, ' ').trim().slice(0, 12);

export function Lobby() {
  const store = useStore();
  const [name, setName] = useState(store.nickname);
  const [avatar, setAvatar] = useState(store.avatar);
  const valid = cleanName(name).length > 0;

  const enter = () => {
    if (!valid) return;
    store.setNickname(cleanName(name));
    store.setAvatar(avatar);
    store.setPhase('intro');
  };

  return (
    <div className="overlay center dim">
      <div className="panel lobby">
        <div className="lobby-head">
          <div className="lobby-top">
            <div className="lobby-badge">🏫 MOKPO SCIENCE UNIV.</div>
            <MuteButton />
          </div>
          <h1>온라인 목포과학대학교</h1>
          <p>닉네임을 정하고 아바타를 꾸민 뒤 캠퍼스로 입장하세요.</p>
        </div>
        <div className="name-row">
          <input
            className="name-input"
            value={name}
            maxLength={12}
            placeholder="닉네임 (최대 12자)"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enter()}
            autoFocus
          />
          <button className="btn primary big" disabled={!valid} onClick={enter}>
            입장하기 →
          </button>
        </div>
        <AvatarEditor config={avatar} onChange={setAvatar} />
      </div>
    </div>
  );
}

/** 입장 후 메뉴에서 다시 꾸미기 */
export function AvatarPanel() {
  const store = useStore();
  const [name, setName] = useState(store.nickname);
  const [avatar, setAvatar] = useState(store.avatar);
  const valid = cleanName(name).length > 0;
  const save = () => {
    if (!valid) return;
    store.setNickname(cleanName(name));
    store.setAvatar(avatar);
    store.setPanel(null);
  };
  return (
    <div className="overlay center dim" onPointerDown={(e) => e.target === e.currentTarget && store.setPanel(null)}>
      <div className="panel lobby">
        <button className="btn ghost close" onClick={() => store.setPanel(null)} aria-label="닫기">
          ✕
        </button>
        <h2 style={{ margin: '0 0 12px' }}>👕 아바타 꾸미기</h2>
        <div className="name-row">
          <input className="name-input" value={name} maxLength={12} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
          <button className="btn primary big" disabled={!valid} onClick={save}>
            저장
          </button>
        </div>
        <AvatarEditor config={avatar} onChange={setAvatar} />
      </div>
    </div>
  );
}
