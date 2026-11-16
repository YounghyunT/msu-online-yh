import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { useStore, live, Peer, AnimState, EmoteId, LeaderEntry } from '../store';
import { encodeAvatar, decodeAvatar } from '../avatar/avatarConfig';

// ─────────────────────────────────────────────────────────────
// Supabase Realtime (Broadcast + Presence 만 사용, DB 미사용)
//  - Presence: 입장/퇴장, 닉네임·아바타 외형 (바뀔 때만 갱신)
//  - Broadcast: 위치(움직일 때만 초당 최대 5회), 이모트, 골프 결과, 리더보드 동기화
//  - 환경변수가 없으면 혼자 둘러보기(오프라인) 모드
// ─────────────────────────────────────────────────────────────

export const MAX_ROOM = 30;
const ANIM_CODES: AnimState[] = ['idle', 'walk', 'run', 'jump'];

let client: SupabaseClient | null = null;
let channel: RealtimeChannel | null = null;
let started = false;
let attempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let sendTimer: ReturnType<typeof setInterval> | null = null;
let closingOnPurpose = false;
let joinedAt = Date.now();
let lastSent = { x: NaN, y: NaN, z: NaN, r: NaN, s: -1 };
let lastSendAt = 0;

export const roomCode = (() => {
  const r = new URLSearchParams(location.search).get('room') ?? '';
  return r.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'main';
})();

const r2 = (v: number) => Math.round(v * 100) / 100;

function online() {
  return useStore.getState().conn === 'online' && channel !== null;
}

function send(event: string, payload: Record<string, unknown>) {
  if (!online()) return;
  void channel!.send({ type: 'broadcast', event, payload });
}

/** 위치 전송 (움직일 때만, 멈추면 마지막 한 번) */
function maybeSendPosition(force = false) {
  const st = useStore.getState();
  if (!online() || st.spectator || document.hidden) return;
  const me = live.me;
  const s = ANIM_CODES.indexOf(me.anim);
  const p = { x: r2(me.x), y: r2(me.y), z: r2(me.z), r: r2(me.yaw), s };
  const changed = p.x !== lastSent.x || p.y !== lastSent.y || p.z !== lastSent.z || Math.abs(p.r - lastSent.r) > 0.05 || p.s !== lastSent.s;
  // 접속자가 많으면 전송 간격을 늘려 무료 플랜 한도(초당 100 메시지)를 지킨다
  const n = Object.keys(st.peers).length;
  const minGap = n <= 10 ? 200 : n <= 20 ? 300 : 400;
  const now = performance.now();
  if (!force) {
    if (!changed) {
      return;
    }
    if (now - lastSendAt < minGap - 5) return;
  }
  lastSendAt = now;
  lastSent = p;
  send('p', { i: st.myId, p: [p.x, p.y, p.z], r: p.r, s: p.s });
}

function presencePayload() {
  const st = useStore.getState();
  return { n: st.nickname || '손님', a: encodeAvatar(st.avatar), t: joinedAt };
}

async function track() {
  if (!channel || useStore.getState().spectator) return;
  try {
    await channel.track(presencePayload());
  } catch {
    /* 재연결 시 다시 시도됨 */
  }
}

function onPresenceSync() {
  if (!channel) return;
  const st = useStore.getState();
  const state = channel.presenceState<{ n: string; a: string; t: number }>();
  const peers: Record<string, Peer> = {};
  for (const [key, metas] of Object.entries(state)) {
    const m = metas[0];
    if (!m) continue;
    peers[key] = { id: key, name: String(m.n ?? '손님').slice(0, 12), avatar: decodeAvatar(m.a), joinedAt: Number(m.t) || 0 };
  }
  // 떠난 사람 정리
  for (const id of live.remotes.keys()) if (!peers[id]) live.remotes.delete(id);
  // 인원 제한: 먼저 들어온 30명만 참여, 나머지는 관전 모드
  const ordered = Object.values(peers).sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
  const myIndex = ordered.findIndex((p) => p.id === st.myId);
  if (!st.spectator && myIndex >= MAX_ROOM) {
    st.setSpectator(true);
    void channel.untrack();
  } else if (st.spectator && ordered.length < MAX_ROOM) {
    st.setSpectator(false);
    joinedAt = Date.now();
    void track();
  }
  st.setPeers(peers);
}

function onPosition(payload: { i: string; p: [number, number, number]; r: number; s: number }) {
  const { i, p, r, s } = payload ?? {};
  if (!i || i === useStore.getState().myId || !Array.isArray(p)) return;
  const cur = live.remotes.get(i);
  const anim = ANIM_CODES[s] ?? 'idle';
  if (cur) {
    cur.x = p[0];
    cur.y = p[1];
    cur.z = p[2];
    cur.yaw = r;
    cur.anim = anim;
    cur.t = performance.now();
  } else live.remotes.set(i, { x: p[0], y: p[1], z: p[2], yaw: r, anim, t: performance.now() });
}

function onEmote(payload: { i: string; e: EmoteId }) {
  const cur = live.remotes.get(payload?.i);
  if (cur && ['wave', 'jump', 'dance'].includes(payload.e)) cur.emote = { id: payload.e, at: performance.now() };
}

function sanitizeEntry(e: Partial<LeaderEntry>): LeaderEntry | null {
  const strokes = Number(e?.strokes);
  if (!Number.isFinite(strokes) || strokes < 3 || strokes > 99) return null;
  return { id: String(e.id ?? '').slice(0, 16), name: String(e.name ?? '손님').slice(0, 12), strokes, at: Number(e.at) || Date.now() };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  useStore.getState().setConn('reconnecting');
  const delay = Math.min(15000, 1000 * 2 ** attempt) + Math.random() * 500;
  attempt++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function connect() {
  if (!client) return;
  if (channel) {
    closingOnPurpose = true;
    void client.removeChannel(channel);
    channel = null;
  }
  closingOnPurpose = false;
  const st = useStore.getState();
  st.setConn(attempt === 0 ? 'connecting' : 'reconnecting');
  const ch = client.channel(`campus-room:${roomCode}`, {
    config: { broadcast: { self: false, ack: false }, presence: { key: st.myId } },
  });
  ch.on('presence', { event: 'sync' }, onPresenceSync)
    .on('broadcast', { event: 'p' }, ({ payload }) => onPosition(payload))
    .on('broadcast', { event: 'e' }, ({ payload }) => onEmote(payload))
    .on('broadcast', { event: 'hi' }, () => {
      // 새로 들어온 사람에게 내 현재 위치를 한 번 알려줌 (부하 분산을 위해 지연)
      setTimeout(() => maybeSendPosition(true), 200 + Math.random() * 1200);
    })
    .on('broadcast', { event: 'g' }, ({ payload }) => {
      const e = sanitizeEntry(payload);
      if (e) useStore.getState().addLeader(e);
    })
    .on('broadcast', { event: 'lbq' }, ({ payload }) => {
      // 가장 먼저 들어온 사람이 리더보드를 대표로 응답
      const s = useStore.getState();
      const others = Object.values(s.peers).filter((p) => p.id !== payload?.i);
      const oldest = others.sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))[0];
      if (oldest?.id === s.myId && s.leaderboard.length) send('lb', { l: s.leaderboard.slice(0, 10) });
    })
    .on('broadcast', { event: 'lb' }, ({ payload }) => {
      const list = Array.isArray(payload?.l) ? (payload.l as Partial<LeaderEntry>[]).map(sanitizeEntry).filter((e): e is LeaderEntry => !!e) : [];
      useStore.getState().mergeLeaders(list);
    });
  channel = ch;
  ch.subscribe((status) => {
    if (ch !== channel) return;
    if (status === 'SUBSCRIBED') {
      attempt = 0;
      useStore.getState().setConn('online');
      void track();
      lastSent = { x: NaN, y: NaN, z: NaN, r: NaN, s: -1 };
      setTimeout(() => {
        maybeSendPosition(true);
        send('hi', { i: useStore.getState().myId });
        send('lbq', { i: useStore.getState().myId });
      }, 300);
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || (status === 'CLOSED' && !closingOnPurpose)) {
      scheduleReconnect();
    }
  });
}

/** 입장할 때 한 번 호출 */
export async function startNetwork() {
  if (started) return;
  started = true;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key || url.includes('xxxx')) {
    useStore.getState().setConn('offline');
    return;
  }
  try {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  } catch (e) {
    console.warn('Supabase 초기화 실패 → 혼자 모드', e);
    useStore.getState().setConn('offline');
    return;
  }
  joinedAt = Date.now();
  connect();

  sendTimer = setInterval(() => maybeSendPosition(false), 100);

  // 외형/닉네임이 바뀔 때만 Presence 갱신
  useStore.subscribe((s, p) => {
    if (s.avatar !== p.avatar || s.nickname !== p.nickname) void track();
    if (s.emote && s.emote !== p.emote) send('e', { i: s.myId, e: s.emote.id });
  });

  // 탭이 백그라운드면 전송 중단, 돌아오면 재동기화
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (useStore.getState().conn !== 'online') {
      scheduleReconnect();
      return;
    }
    void track();
    maybeSendPosition(true);
  });
  window.addEventListener('offline', () => useStore.getState().conn !== 'offline' && useStore.getState().setConn('reconnecting'));
  window.addEventListener('online', () => {
    attempt = 0;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    connect();
  });
  window.addEventListener('beforeunload', () => {
    if (sendTimer) clearInterval(sendTimer);
    if (channel) void channel.untrack();
  });
}

/** 파크골프 결과 공유 */
export function shareGolfResult(strokes: number) {
  const st = useStore.getState();
  const entry: LeaderEntry = { id: st.myId, name: st.nickname || '손님', strokes, at: Date.now() };
  st.addLeader(entry);
  send('g', { ...entry });
}
