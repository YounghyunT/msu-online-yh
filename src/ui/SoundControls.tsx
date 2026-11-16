import { useSyncExternalStore } from 'react';
import { getAudioSettings, onAudioSettings, setAudioSettings, unlockAudio } from '../audio/sound';

export function useAudioSettings() {
  return useSyncExternalStore(
    (cb) => {
      const off = onAudioSettings(cb);
      return () => {
        off();
      };
    },
    getAudioSettings,
  );
}

/** 우측 상단 음소거 토글 */
export function MuteButton({ compact }: { compact?: boolean }) {
  const s = useAudioSettings();
  return (
    <button
      className="icon-btn"
      data-nosfx="1"
      onClick={() => {
        unlockAudio();
        setAudioSettings({ muted: !s.muted });
      }}
      title={s.muted ? '소리 켜기' : '소리 끄기'}
    >
      {s.muted ? '🔇' : '🔊'}
      {!compact && <span className="lbl">{s.muted ? '소리 꺼짐' : '소리'}</span>}
    </button>
  );
}

/** 설정 패널의 볼륨 조절 */
export function VolumeSliders() {
  const s = useAudioSettings();
  return (
    <div className="volume">
      <label>
        <span>🎵 배경음악</span>
        <input type="range" min={0} max={1} step={0.05} value={s.music} onChange={(e) => setAudioSettings({ music: Number(e.target.value), muted: false })} />
        <b>{Math.round(s.music * 100)}</b>
      </label>
      <label>
        <span>🔔 효과음</span>
        <input type="range" min={0} max={1} step={0.05} value={s.sfx} onChange={(e) => setAudioSettings({ sfx: Number(e.target.value), muted: false })} />
        <b>{Math.round(s.sfx * 100)}</b>
      </label>
      <label className="check">
        <input type="checkbox" checked={s.muted} onChange={(e) => setAudioSettings({ muted: e.target.checked })} /> 모든 소리 끄기
      </label>
    </div>
  );
}
