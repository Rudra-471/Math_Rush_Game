import { useEffect } from 'react';
import { game } from '../runtime';
import { useGame } from '@/store/gameStore';
import { useSettings } from '@/store/settingsStore';
import { activateHoverboard } from '../systems/PowerUpSystem';
import { useProfile } from '@/store/profileStore';

type Action = 'left' | 'right' | 'up' | 'down';

function push(a: Action) {
  if (useGame.getState().phase !== 'RUNNING') return;
  game.rt.inputQueue.push(a);
}

export async function triggerHoverboard() {
  const inv = useProfile.getState().inventory;
  if (!inv || inv.hoverboards <= 0 || useGame.getState().phase !== 'RUNNING') return;
  if (activateHoverboard(game.rt)) {
    await useProfile.getState().updateInventory((i) => ({ ...i, hoverboards: i.hoverboards - 1 }));
  }
}

export function togglePause() {
  const g = useGame.getState();
  if (g.phase === 'RUNNING') g.setPhase('PAUSED');
  else if (g.phase === 'PAUSED') g.setPhase('RUNNING');
}

/** Keyboard (arrows/WASD/space/escape) + touch swipe (min 30 px within 300 ms). */
export function useInput() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key;
      if (k === '`') {
        const s = useSettings.getState();
        s.set({ debug: !s.debug });
        return;
      }
      if (k === 'Escape' || k === 'p' || k === 'P') {
        togglePause();
        return;
      }
      if (useGame.getState().phase !== 'RUNNING') return;
      const map: Record<string, Action> = {
        ArrowLeft: 'left', a: 'left', A: 'left',
        ArrowRight: 'right', d: 'right', D: 'right',
        ArrowUp: 'up', w: 'up', W: 'up', ' ': 'up',
        ArrowDown: 'down', s: 'down', S: 'down',
      };
      if (map[k]) {
        e.preventDefault();
        if (!e.repeat) push(map[k]);
      } else if (k === 'h' || k === 'H' || k === 'b' || k === 'B') {
        void triggerHoverboard();
      }
    };

    let sx = 0, sy = 0, st = 0, active = false, fired = false;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if ((e.target as HTMLElement)?.closest('button, input, a, [data-noswipe]')) return;
      sx = e.clientX; sy = e.clientY; st = performance.now(); active = true; fired = false;
    };
    const onMove = (e: PointerEvent) => {
      if (!active || fired) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (performance.now() - st > 300) { active = false; return; }
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
      fired = true;
      if (Math.abs(dx) > Math.abs(dy)) push(dx < 0 ? 'left' : 'right');
      else push(dy < 0 ? 'up' : 'down');
    };
    const onUp = () => { active = false; };
    const onVis = () => {
      if (document.hidden && useGame.getState().phase === 'RUNNING') useGame.getState().setPhase('PAUSED');
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
}
