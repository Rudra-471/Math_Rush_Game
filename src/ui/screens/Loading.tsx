import { useEffect, useState } from 'react';
import { useGame } from '@/store/gameStore';
import { useProfile } from '@/store/profileStore';
import { audio } from '@/audio/AudioManager';
import { initSpeech } from '@/audio/speech';
import { Button } from '../components/ui';
import { loadAssets, useAssets } from '@/game/assets/assets';
import { playIntro } from '@/game/intro/flow';
import { useSettings } from '@/store/settingsStore';

const TIPS = [
  'Run through the gate with the right answer!',
  'Three right in a row doubles your points.',
  'Wrong answers show a trick — watch it!',
  'Challenge Tunnels give treasure chests.',
  'Grab a purple coin for a Maths Orb!',
];

/** Loading + tap-to-start (unlocks audio on mobile). */
export function Loading() {
  const load = useProfile((s) => s.load);
  const loaded = useProfile((s) => s.loaded);
  const assetProgress = useAssets((s) => s.progress);
  const coreReady = useAssets((s) => s.coreReady);
  const [tip, setTip] = useState(0);
  const progress = Math.round(assetProgress * 100);

  useEffect(() => {
    void load();
    loadAssets();
    const tt = setInterval(() => setTip((x) => (x + 1) % TIPS.length), 2200);
    return () => clearInterval(tt);
  }, [load]);

  const ready = loaded && coreReady;
  const start = () => {
    audio.unlock();
    initSpeech();
    if (useSettings.getState().playIntro && !useSettings.getState().reduceMotion) playIntro();
    else useGame.getState().setPhase('PROFILE');
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-ink/80 to-ink/95 p-6 text-center">
      <h1 className="text-6xl font-bold tracking-wide text-outline sm:text-7xl">
        MATH <span className="text-brand">RUSH</span> 3D
      </h1>
      <p className="text-xl font-semibold text-brand-2">Run • Solve • Learn • Survive</p>
      <div className="h-4 w-72 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={progress}>
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="h-6 text-white/75">💡 {TIPS[tip]}</p>
      <Button size="lg" onClick={start} disabled={!ready} className="anim-pop">
        {ready ? 'Tap to start' : 'Loading…'}
      </Button>
    </div>
  );
}
