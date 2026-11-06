import { useState } from 'react';
import { useProfile } from '@/store/profileStore';
import { useGame } from '@/store/gameStore';
import * as repo from '@/data/repositories';
import type { AttemptRow, Profile } from '@/data/db';
import { BANDS, BAND_INFO, SKILLS, TOPIC_LABEL, type Topic } from '@/math/skills';
import { toCsv } from '@/meta/insights';
import { Button, Toggle } from '../components/ui';

/** Parent controls: band, Learning Mode, focus topics, daily limit, export CSV / PDF, reset / delete. */
export function ParentControls({ profile, attempts, onChanged }: { profile: Profile; attempts: AttemptRow[]; onChanged: () => Promise<void> }) {
  const [confirm, setConfirm] = useState<'' | 'reset' | 'delete'>('');
  const topics = [...new Set(SKILLS.map((s) => s.topic))] as Topic[];

  const save = async (patch: Partial<Profile>) => {
    const next = { ...profile, ...patch };
    await repo.saveProfile(next);
    const ps = useProfile.getState();
    useProfile.setState({
      profiles: ps.profiles.map((p) => (p.id === next.id ? next : p)),
      ...(ps.profile?.id === next.id ? { profile: next } : {}),
    });
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(attempts)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `math-rush-${profile.name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const toggleTopic = (t: Topic) =>
    save({ focusTopics: profile.focusTopics.includes(t) ? profile.focusTopics.filter((x) => x !== t) : [...profile.focusTopics, t] });

  return (
    <section className="no-print rounded-2xl bg-white/5 p-4">
      <h4 className="mb-3 text-lg font-bold">⚙️ Parent controls</h4>
      <div className="mb-3">
        <div className="mb-1 text-white/70">Difficulty band (starting point — the game adapts per skill)</div>
        <div className="flex flex-wrap gap-2">
          {BANDS.map((b) => (
            <Button key={b} size="sm" variant={profile.band === b ? 'primary' : 'ghost'} onClick={() => void save({ band: b })}>
              {BAND_INFO[b].emoji} {BAND_INFO[b].label} ({BAND_INFO[b].ages})
            </Button>
          ))}
        </div>
      </div>
      <Toggle label="Learning Mode" hint="Slower runs, slow-motion before gates, no hearts lost" checked={profile.learningMode} onChange={(v) => void save({ learningMode: v })} />
      <div className="my-3">
        <div className="mb-1 text-white/70">Focus topics (asked more often)</div>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <button key={t} onClick={() => void toggleTopic(t)} className={`rounded-full px-3 py-1.5 text-sm ${profile.focusTopics.includes(t) ? 'bg-violet' : 'bg-white/10'}`}>
              {TOPIC_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-white/70">Daily time limit (soft stop after the current run):</span>
        {[0, 15, 30, 45, 60].map((m) => (
          <Button key={m} size="sm" variant={profile.dailyLimitMin === m ? 'primary' : 'ghost'} onClick={() => void save({ dailyLimitMin: m })}>
            {m === 0 ? 'No limit' : `${m} min`}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={exportCsv}>⬇️ Export CSV</Button>
        <Button size="sm" variant="secondary" onClick={() => window.print()}>🖨️ Print / save as PDF</Button>
        <Button size="sm" variant="secondary" onClick={async () => {
          const p = prompt('New 4-digit PIN')?.trim() ?? '';
          if (/^\d{4}$/.test(p)) { await repo.setPin(p); alert('PIN changed'); } else if (p) alert('PIN must be exactly 4 digits');
        }}>🔑 Change PIN</Button>
        {confirm === '' && <Button size="sm" variant="danger" onClick={() => setConfirm('reset')}>Reset {profile.name}’s progress</Button>}
        {confirm === '' && <Button size="sm" variant="danger" onClick={() => setConfirm('delete')}>Delete {profile.name}</Button>}
        {confirm && (
          <span className="flex items-center gap-2 rounded-xl bg-bad/20 px-3 py-1">
            {confirm === 'reset' ? 'Erase all progress for' : 'Delete the profile of'} {profile.name}? This can’t be undone.
            <Button size="sm" variant="danger" onClick={async () => {
              if (confirm === 'reset') await useProfile.getState().resetData(profile.id);
              else {
                await useProfile.getState().remove(profile.id);
                useGame.getState().setOverlay(null);
                if (!useProfile.getState().profile) useGame.getState().setPhase('PROFILE');
              }
              setConfirm('');
              await onChanged();
            }}>Yes</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm('')}>No</Button>
          </span>
        )}
      </div>
    </section>
  );
}
