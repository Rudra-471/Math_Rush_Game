import { useGame } from '@/store/gameStore';
import { useProfile } from '@/store/profileStore';
import { resetMenuRuntime } from '../GameCanvas';
import { startIntro } from './director';

/** Start the intro film (after the tap that unlocks audio, or from the menu). */
export function playIntro() {
  startIntro();
  useGame.getState().setOverlay(null);
  useGame.getState().setPhase('INTRO');
}

/** End (or skip) the film: back to the attract-mode world and the next screen. */
export function finishIntro() {
  const g = useGame.getState();
  if (g.phase !== 'INTRO') return;
  resetMenuRuntime();
  g.setPhase(useProfile.getState().profile ? 'MENU' : 'PROFILE');
}
