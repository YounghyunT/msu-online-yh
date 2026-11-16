import { useEffect } from 'react';
import { World } from './world/World';
import { useStore, live } from './store';
import { preloadFonts } from './loading';
import { installKeyboard, orbit } from './player/input';
import { LoadingScreen } from './ui/LoadingScreen';
import { Lobby } from './ui/Lobby';
import { HUD } from './ui/HUD';
import { startNetwork } from './net/realtime';
import { installAudioHooks } from './audio/audioHooks';

export default function App() {
  const phase = useStore((s) => s.phase);

  useEffect(() => {
    if (phase === 'intro') void startNetwork();
  }, [phase]);

  useEffect(() => {
    preloadFonts();
    installAudioHooks();
    if (import.meta.env.DEV) Object.assign(window, { __dbg: { useStore, orbit, live } });
    return installKeyboard((a) => {
      const s = useStore.getState();
      if (a === 'escape') {
        if (s.panel) s.setPanel(null);
        else if (s.phase === 'golf') s.setPhase('play');
      }
      if (a === 'golf' && s.phase === 'play' && s.nearGolf) s.setPhase('golf');
    });
  }, []);

  return (
    <>
      <World />
      {phase === 'loading' && <LoadingScreen />}
      {phase === 'lobby' && <Lobby />}
      {(phase === 'play' || phase === 'golf' || phase === 'intro') && <HUD />}
    </>
  );
}
