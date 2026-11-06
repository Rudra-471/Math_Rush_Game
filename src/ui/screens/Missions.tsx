import { useGame } from '@/store/gameStore';
import { useProfile } from '@/store/profileStore';
import { ACHIEVEMENTS } from '@/meta/achievements';
import { Modal } from '../components/ui';

/** 3 daily missions with progress + 7-day streak calendar. */
export function Missions() {
  const missions = useProfile((s) => s.missions);
  const profile = useProfile((s) => s.profile);
  const close = () => useGame.getState().setOverlay(null);
  const streak = profile?.dailyStreak.count ?? 0;
  return (
    <Modal title="Daily missions" onClose={close}>
      <div className="flex flex-col gap-3">
        {missions?.missions.map((m) => (
          <div key={m.id} className={`rounded-2xl p-4 ${m.done ? 'bg-good/25' : 'bg-white/5'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-lg font-semibold">{m.done ? '✅' : '🎯'} {m.text}</span>
              <span className="text-white/70">{m.progress}/{m.target}</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-gold" style={{ width: `${(100 * m.progress) / m.target}%` }} />
            </div>
          </div>
        ))}
        <div className="rounded-2xl bg-white/5 p-4 text-center">
          <div className="mb-1 font-semibold">Finish all 3 → daily chest 🎁 (+250 coins & a Revive Key)</div>
          {missions?.chestClaimed && <div className="text-good">Today’s chest is claimed!</div>}
        </div>
        <div className="rounded-2xl bg-white/5 p-4">
          <div className="mb-2 font-semibold">🔥 Daily streak: {streak} day{streak === 1 ? '' : 's'}</div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className={`rounded-xl py-2 text-center text-sm ${i < streak % 8 ? 'bg-brand' : 'bg-white/10'}`}>
                <div>Day {i + 1}</div>
                <div>{i === 6 ? '🎁' : '🪙'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function Achievements() {
  const have = useProfile((s) => s.achievements);
  const close = () => useGame.getState().setOverlay(null);
  return (
    <Modal title="Trophies" onClose={close}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const got = have.has(a.id);
          return (
            <div key={a.id} className={`rounded-2xl p-3 text-center ${got ? 'bg-gold/25 ring-2 ring-gold' : 'bg-white/5 opacity-70'}`}>
              <div className={`text-4xl ${got ? '' : 'grayscale'}`}>{a.icon}</div>
              <div className="font-bold">{a.name}</div>
              <div className="text-sm text-white/70">{a.desc}</div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
