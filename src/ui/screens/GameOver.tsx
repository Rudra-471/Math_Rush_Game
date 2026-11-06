import { useState } from 'react';
import { useGame } from '@/store/gameStore';
import { useProfile } from '@/store/profileStore';
import { commitRun, quitRun, restartRun, revive, startRun } from '@/game/runController';
import { resetMenuRuntime } from '@/game/GameCanvas';
import { getSkill } from '@/math/skills';
import { SESSION } from '@/config/tuning';
import { Button, Coins, Panel, Stat } from '../components/ui';

export function Pause() {
  const hud = useGame((s) => s.hud);
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4 anim-fade">
      <Panel className="w-full max-w-md p-6 text-center">
        <h2 className="mb-4 text-4xl font-bold">Paused</h2>
        <div className="mb-5 grid grid-cols-3 gap-2">
          <Stat label="Score" value={hud.score.toLocaleString()} />
          <Stat label="Metres" value={hud.distance} />
          <Stat label="Coins" value={hud.coins} />
        </div>
        <div className="flex flex-col gap-3">
          <Button size="lg" onClick={() => useGame.getState().setPhase('RUNNING')}>▶ Resume</Button>
          <Button variant="secondary" onClick={() => useGame.getState().setOverlay('settings')}>⚙️ Settings</Button>
          <Button variant="secondary" onClick={() => void restartRun()}>↻ Restart</Button>
          <Button variant="ghost" onClick={quitRun}>End run</Button>
        </div>
      </Panel>
    </div>
  );
}

export function GameOver() {
  const s = useGame((x) => x.summary);
  const keys = useProfile((x) => x.inventory?.reviveKeys ?? 0);
  const [busy, setBusy] = useState(false);
  if (!s) return null;
  const acc = s.stats.questions ? Math.round((100 * s.stats.correct) / s.stats.questions) : 0;
  const skills = Object.entries(s.stats.bySkill);
  const cont = async () => {
    setBusy(true);
    await commitRun();
  };
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/55 p-4 anim-fade">
      <Panel className="w-full max-w-xl p-6 text-center">
        <h2 className="text-4xl font-bold">{s.newBest ? '🏅 New best!' : 'Run over!'}</h2>
        <div className="my-3 text-6xl font-bold text-gold text-outline anim-pop">{s.score.toLocaleString()}</div>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Metres" value={s.distance.toLocaleString()} />
          <Stat label="Coins" value={s.coins} />
          <Stat label="Accuracy" value={`${acc}%`} />
          <Stat label="Best streak" value={s.stats.maxStreak} />
        </div>
        {skills.length > 0 && (
          <div className="mb-4 rounded-2xl bg-white/5 p-3 text-left">
            <div className="mb-1 font-semibold text-white/70">Skills you practised</div>
            <div className="flex flex-wrap gap-2">
              {skills.map(([id, v]) => (
                <span key={id} className="rounded-full bg-white/10 px-3 py-1 text-sm">
                  {getSkill(id).name} · {v.correct}/{v.asked}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {s.canRevive && keys > 0 && (
            <Button variant="good" size="lg" disabled={busy} onClick={() => { setBusy(true); void revive(); }}>
              🗝️ Use a Revive Key ({keys}) and keep running
            </Button>
          )}
          <Button size="lg" disabled={busy} onClick={cont}>Continue →</Button>
        </div>
      </Panel>
    </div>
  );
}

export function Rewards() {
  const s = useGame((x) => x.summary);
  const startedAt = useProfile((x) => x.sessionStartedAt);
  if (!s) return null;
  const leveled = s.levelAfter > s.levelBefore;
  const breakTime = Date.now() - startedAt > SESSION.breakReminderMin * 60_000;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/55 p-4 anim-fade">
      <Panel className="w-full max-w-xl p-6 text-center">
        <div className="text-7xl anim-chest" aria-hidden>🎁</div>
        <h2 className="text-3xl font-bold">Rewards</h2>
        <div className="my-3 flex items-center justify-center gap-6 text-2xl">
          <Coins n={s.coins} />
          <span className="font-bold text-sky">+{s.xpGained} XP</span>
        </div>
        <div className="mx-auto mb-1 h-4 w-full max-w-sm overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-gold transition-[width] duration-1000" style={{ width: `${(leveled ? s.xpFracAfter : s.xpFracAfter) * 100}%` }} />
        </div>
        <div className="mb-3 text-white/75">{leveled ? `⭐ Level up! You are now level ${s.levelAfter}` : `Level ${s.levelAfter}`}</div>
        {s.missionsCompleted.length > 0 && (
          <div className="mb-3 rounded-2xl bg-good/20 p-3 text-left">
            {s.missionsCompleted.map((m) => <div key={m}>✅ {m}</div>)}
          </div>
        )}
        {s.achievements.length > 0 && (
          <div className="mb-3 rounded-2xl bg-violet/25 p-3">
            <div className="font-semibold">New trophies!</div>
            {s.achievements.map((a) => <div key={a} className="text-xl anim-pop">{a}</div>)}
          </div>
        )}
        {breakTime && <div className="mb-3 rounded-2xl bg-sky/20 p-3">🌟 Great practice! Time for a little break?</div>}
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={() => { resetMenuRuntime(); useGame.getState().setPhase('MENU'); }}>Menu</Button>
          <Button size="lg" onClick={() => void startRun()}>▶ Play again</Button>
        </div>
      </Panel>
    </div>
  );
}
