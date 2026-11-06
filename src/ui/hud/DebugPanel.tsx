import { useState } from 'react';
import { useGame } from '@/store/gameStore';
import { game } from '@/game/runtime';
import { useSettings } from '@/store/settingsStore';

/** Hidden tuning panel (toggle with the ` key): FPS, speed, chunk, next question, god mode, jump to next gate. */
export function DebugPanel() {
  const d = useGame((s) => s.debug);
  const tier = useSettings((s) => (s.quality === 'auto' ? `auto:${s.autoTier}` : s.quality));
  const [god, setGod] = useState(game.rt.godMode);
  const skipToGate = () => {
    const rt = game.rt;
    const g = rt.gates.find((x) => x.state === 'queued' || x.state === 'pending');
    if (g) rt.distance = Math.max(rt.distance, (g.state === 'queued' ? g.showAt : g.s - 240) - 1);
  };
  return (
    <div className="fixed left-2 top-40 z-50 w-72 rounded-xl bg-black/80 p-3 font-mono text-xs text-green-300" data-noswipe>
      <div>FPS {d.fps} · tier {tier}</div>
      <div>speed {d.speed} m/s · chunk {d.chunk}</div>
      <div className="break-words">next: {d.next}</div>
      <div className="mt-2 flex gap-2">
        <button className="rounded bg-white/15 px-2 py-1" onClick={() => { game.rt.godMode = !god; setGod(!god); }}>
          god {god ? 'ON' : 'off'}
        </button>
        <button className="rounded bg-white/15 px-2 py-1" onClick={skipToGate}>skip→gate</button>
      </div>
    </div>
  );
}
