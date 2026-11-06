import { lazy, Suspense } from 'react';
import { GameCanvas } from '@/game/GameCanvas';
import { useInput } from '@/game/input/useInput';
import { useGame } from '@/store/gameStore';
import { useSettings } from '@/store/settingsStore';
import { useProfile } from '@/store/profileStore';
import { Hud } from '@/ui/hud/Hud';
import { Loading } from '@/ui/screens/Loading';
import { ProfileSelect } from '@/ui/screens/ProfileSelect';
import { MainMenu } from '@/ui/screens/MainMenu';
import { GameOver, Pause, Rewards } from '@/ui/screens/GameOver';
import { Shop } from '@/ui/screens/Shop';
import { Achievements, Missions } from '@/ui/screens/Missions';
import { HowToPlay, Settings } from '@/ui/screens/Settings';
import { ParentGate } from '@/ui/screens/ParentGate';
import { Toasts } from '@/ui/hud/Toasts';
import { DebugPanel } from '@/ui/hud/DebugPanel';
import { IntroOverlay } from '@/ui/screens/IntroOverlay';

const ParentDashboard = lazy(() => import('@/ui/screens/ParentDashboard').then((m) => ({ default: m.ParentDashboard })));

export default function App() {
  useInput();
  const phase = useGame((s) => s.phase);
  const overlay = useGame((s) => s.overlay);
  const profile = useProfile((s) => s.profile);
  const dyslexia = useSettings((s) => s.dyslexiaFont);
  const reduce = useSettings((s) => s.reduceMotion);
  const debug = useSettings((s) => s.debug);
  const inRun = phase === 'RUNNING' || phase === 'COUNTDOWN' || phase === 'PAUSED';

  return (
    <div className={`${dyslexia ? 'dyslexia' : ''} ${reduce ? 'reduce-motion' : ''}`}>
      <GameCanvas />
      {phase === 'BOOT' && <Loading />}
      {phase === 'INTRO' && <IntroOverlay />}
      {phase === 'PROFILE' && <ProfileSelect />}
      {phase === 'MENU' && profile && <MainMenu />}
      {inRun && <Hud />}
      {phase === 'PAUSED' && <Pause />}
      {phase === 'GAME_OVER' && <GameOver />}
      {phase === 'REWARDS' && <Rewards />}
      <Toasts />
      {overlay === 'shop' && <Shop />}
      {overlay === 'missions' && <Missions />}
      {overlay === 'achievements' && <Achievements />}
      {overlay === 'settings' && <Settings />}
      {overlay === 'howto' && <HowToPlay />}
      {overlay === 'parentGate' && <ParentGate />}
      {overlay === 'parent' && (
        <Suspense fallback={null}>
          <ParentDashboard />
        </Suspense>
      )}
      {debug && <DebugPanel />}
    </div>
  );
}
