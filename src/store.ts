import { create } from 'zustand';
import { AvatarConfig, DEFAULT_AVATAR, loadAvatar, saveAvatar, loadNickname, saveNickname } from './avatar/avatarConfig';
import type { SpotId } from './world/layout';

export type Phase = 'loading' | 'lobby' | 'intro' | 'play' | 'golf';
export type Quality = 'high' | 'mid' | 'low';
export type ConnStatus = 'offline' | 'connecting' | 'online' | 'reconnecting';
export type AnimState = 'idle' | 'walk' | 'run' | 'jump';
export type EmoteId = 'wave' | 'jump' | 'dance';

export interface Peer {
  id: string;
  name: string;
  avatar: AvatarConfig;
  joinedAt: number;
}

export interface LeaderEntry {
  name: string;
  strokes: number;
  at: number;
  id: string;
}

interface State {
  phase: Phase;
  loadProgress: number;
  myId: string;
  nickname: string;
  avatar: AvatarConfig;
  christmas: boolean;
  quality: Quality;
  autoQuality: boolean;
  panel: null | 'avatar' | 'quality' | 'help';
  conn: ConnStatus;
  spectator: boolean;
  peers: Record<string, Peer>;
  leaderboard: LeaderEntry[];
  nearGolf: boolean;
  teleport: { spot: SpotId; n: number } | null;
  emote: { id: EmoteId; n: number } | null;
  golfOpen: boolean;

  setPhase: (p: Phase) => void;
  setLoadProgress: (v: number) => void;
  setNickname: (n: string) => void;
  setAvatar: (a: AvatarConfig) => void;
  toggleChristmas: () => void;
  setQuality: (q: Quality, auto?: boolean) => void;
  setPanel: (p: State['panel']) => void;
  setConn: (c: ConnStatus) => void;
  setSpectator: (v: boolean) => void;
  setPeers: (p: Record<string, Peer>) => void;
  addLeader: (e: LeaderEntry) => void;
  mergeLeaders: (list: LeaderEntry[]) => void;
  setNearGolf: (v: boolean) => void;
  requestTeleport: (spot: SpotId) => void;
  playEmote: (id: EmoteId) => void;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function initialQuality(): Quality {
  try {
    const q = localStorage.getItem('mstc.quality') as Quality | null;
    if (q === 'high' || q === 'mid' || q === 'low') return q;
  } catch {
    /* ignore */
  }
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);
  return mobile ? 'mid' : 'high';
}

function sortLeaders(list: LeaderEntry[]) {
  const seen = new Set<string>();
  return [...list]
    .sort((a, b) => a.strokes - b.strokes || a.at - b.at)
    .filter((e) => {
      const k = `${e.id}:${e.at}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 20);
}

export const useStore = create<State>((set) => ({
  phase: 'loading',
  loadProgress: 0,
  myId: randomId(),
  nickname: loadNickname(),
  avatar: loadAvatar() ?? DEFAULT_AVATAR,
  christmas: false,
  quality: initialQuality(),
  autoQuality: true,
  panel: null,
  conn: 'offline',
  spectator: false,
  peers: {},
  leaderboard: [],
  nearGolf: false,
  teleport: null,
  emote: null,
  golfOpen: false,

  setPhase: (phase) => set({ phase, golfOpen: phase === 'golf' }),
  setLoadProgress: (v) => set((s) => ({ loadProgress: Math.max(s.loadProgress, v) })),
  setNickname: (nickname) => {
    saveNickname(nickname);
    set({ nickname });
  },
  setAvatar: (avatar) => {
    saveAvatar(avatar);
    set({ avatar });
  },
  toggleChristmas: () => set((s) => ({ christmas: !s.christmas })),
  setQuality: (quality, auto = false) => {
    try {
      localStorage.setItem('mstc.quality', quality);
    } catch {
      /* ignore */
    }
    set({ quality, autoQuality: auto });
  },
  setPanel: (panel) => set({ panel }),
  setConn: (conn) => set({ conn }),
  setSpectator: (spectator) => set({ spectator }),
  setPeers: (peers) => set({ peers }),
  addLeader: (e) => set((s) => ({ leaderboard: sortLeaders([...s.leaderboard, e]) })),
  mergeLeaders: (list) => set((s) => ({ leaderboard: sortLeaders([...s.leaderboard, ...list]) })),
  setNearGolf: (nearGolf) => set({ nearGolf }),
  requestTeleport: (spot) => set((s) => ({ teleport: { spot, n: (s.teleport?.n ?? 0) + 1 } })),
  playEmote: (id) => set((s) => ({ emote: { id, n: (s.emote?.n ?? 0) + 1 } })),
}));

/** 매 프레임 바뀌는 값은 React 상태가 아닌 가변 객체로 공유 (리렌더 방지) */
export const live = {
  /** 내 아바타 위치/방향/애니 상태 */
  me: { x: 0, y: 0, z: 0, yaw: 0, anim: 'idle' as AnimState, moving: false },
  /** 원격 플레이어 목표 상태 (네트워크 수신) */
  remotes: new Map<string, { x: number; y: number; z: number; yaw: number; anim: AnimState; t: number; emote?: { id: EmoteId; at: number } }>(),
};
