import { useState } from 'react';
import { useGame } from '@/store/gameStore';
import { useProfile } from '@/store/profileStore';
import { startRun } from '@/game/runController';
import { playIntro } from '@/game/intro/flow';
import { levelFromXp } from '@/meta/progression';
import { BAND_INFO } from '@/math/skills';
import { Button, Coins, Panel } from '../components/ui';
import { Avatar } from './ProfileSelect';

export function MainMenu() {
  const profile = useProfile((s) => s.profile)!;
  const inv = useProfile((s) => s.inventory);
  const missions = useProfile((s) => s.missions);
  const logout = useProfile((s) => s.logout);
  const setOverlay = useGame((s) => s.setOverlay);
  const [msg, setMsg] = useState('');
  const lv = levelFromXp(profile.xp);
  const done = missions?.missions.filter((m) => m.done).length ?? 0;

  const play = async () => {
    const r = await startRun();
    if (r === 'limit') setMsg('That’s all the playing time for today — great practice! See you tomorrow 🌙');
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between p-4">
      <div className="safe-top flex items-start justify-between gap-3">
        <Panel className="flex items-center gap-3 px-4 py-2">
          <Avatar id={profile.character} size={52} />
          <div>
            <div className="text-xl font-bold">{profile.name}</div>
            <div className="flex items-center gap-2 text-sm text-white/70">
              Lv {lv.level}
              <span className="inline-block h-2 w-24 overflow-hidden rounded bg-white/20">
                <span className="block h-full bg-gold" style={{ width: `${lv.frac * 100}%` }} />
              </span>
              {BAND_INFO[profile.band].emoji}{profile.learningMode ? ' 🌱' : ''}
            </div>
          </div>
        </Panel>
        <Panel className="flex items-center gap-4 px-4 py-3 text-lg">
          {inv && <Coins n={inv.coins} />}
          <span title="Revive Keys">🗝️ {inv?.reviveKeys ?? 0}</span>
          <span title="Hoverboards">🛹 {inv?.hoverboards ?? 0}</span>
        </Panel>
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-6xl font-bold text-outline sm:text-7xl">
          MATH <span className="text-brand">RUSH</span> 3D
        </h1>
        {profile.bestScore > 0 && <div className="text-lg text-white/80 text-outline">Best: {profile.bestScore.toLocaleString()}</div>}
        <Button size="lg" onClick={play} className="px-14 text-3xl">▶ PLAY</Button>
        {msg && <Panel className="max-w-md px-4 py-3">{msg}</Panel>}
      </div>

      <div className="safe-bottom flex flex-wrap justify-center gap-2">
        <Button variant="secondary" onClick={() => setOverlay('missions')}>🎯 Missions {done}/3</Button>
        <Button variant="secondary" onClick={() => setOverlay('shop')}>🛍️ Shop</Button>
        <Button variant="secondary" onClick={() => setOverlay('achievements')}>🏆 Trophies</Button>
        <Button variant="secondary" onClick={() => setOverlay('howto')}>❓ How to play</Button>
        <Button variant="secondary" onClick={playIntro}>🎬 Intro</Button>
        <Button variant="secondary" onClick={() => setOverlay('settings')}>⚙️ Settings</Button>
        <Button variant="secondary" onClick={() => setOverlay('parentGate')}>👪 Parents</Button>
        <Button variant="ghost" onClick={() => { logout(); useGame.getState().setPhase('PROFILE'); }}>⇄ Switch player</Button>
      </div>
    </div>
  );
}
