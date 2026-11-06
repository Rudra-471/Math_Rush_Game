import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useGame } from '@/store/gameStore';
import { useProfile } from '@/store/profileStore';
import * as repo from '@/data/repositories';
import type { AttemptRow, Profile, RunRow } from '@/data/db';
import type { SkillStates } from '@/math/adaptive/selector';
import { mastery } from '@/math/adaptive/rating';
import { SKILLS, TOPIC_LABEL, getSkill, type Topic, BAND_INFO } from '@/math/skills';
import { TAG_TEXT } from '@/math/distractors';
import { accuracy, between, dailySeries, insights, topMisconception, topicOf } from '@/meta/insights';
import { Modal, Stat } from '../components/ui';
import { ParentControls } from './ParentControls';

const DAY = 86_400_000;

function masteryColor(m: number, tried: boolean) {
  if (!tried) return 'bg-white/10 text-white/50';
  if (m >= 0.8) return 'bg-good text-white';
  if (m >= 0.5) return 'bg-sky text-ink';
  return 'bg-brand text-white';
}

export function ParentDashboard() {
  const profiles = useProfile((s) => s.profiles);
  const active = useProfile((s) => s.profile);
  const [pid, setPid] = useState(active?.id ?? profiles[0]?.id ?? '');
  const [data, setData] = useState<{ attempts: AttemptRow[]; runs: RunRow[]; skills: SkillStates } | null>(null);
  const [range, setRange] = useState<1 | 7 | 30>(7);
  const now = useMemo(() => Date.now(), []);
  const profile = profiles.find((p) => p.id === pid) ?? null;
  const close = () => useGame.getState().setOverlay(null);

  const reload = useCallback(async () => {
    if (!pid) return;
    await repo.flushAttempts();
    const since = now - 60 * DAY;
    const [attempts, runs, skills] = await Promise.all([repo.attemptsSince(pid, since), repo.runsSince(pid, since), repo.loadSkills(pid)]);
    setData({ attempts, runs, skills });
  }, [pid, now]);

  useEffect(() => { void reload(); }, [reload]);

  if (!profiles.length) {
    return <Modal title="Parent dashboard" onClose={close}><p>No children yet — add a player first.</p></Modal>;
  }

  return (
    <Modal title="Parent dashboard" onClose={close} wide>
      <div className="print-area">
        <div className="no-print mb-4 flex flex-wrap items-center gap-2">
          {profiles.map((p) => (
            <button key={p.id} onClick={() => setPid(p.id)} className={`rounded-full px-4 py-2 font-semibold ${p.id === pid ? 'bg-brand' : 'bg-white/10'}`}>
              {p.name}
            </button>
          ))}
        </div>
        {!data || !profile ? <p>Loading…</p> : <Body profile={profile} data={data} now={now} range={range} setRange={setRange} reload={reload} />}
      </div>
    </Modal>
  );
}

function Body({ profile, data, now, range, setRange, reload }: {
  profile: Profile; data: { attempts: AttemptRow[]; runs: RunRow[]; skills: SkillStates }; now: number;
  range: 1 | 7 | 30; setRange: (r: 1 | 7 | 30) => void; reload: () => Promise<void>;
}) {
  const { attempts, runs, skills } = data;
  const start = range === 1 ? new Date(new Date(now).setHours(0, 0, 0, 0)).getTime() : now - range * DAY;
  const inRange = between(attempts, start, now + 1);
  const acc = accuracy(inRange);
  const avgMs = inRange.length ? inRange.reduce((a, b) => a + b.responseMs, 0) / inRange.length : 0;
  const minutes = runs.filter((r) => r.startedAt >= start).reduce((a, r) => a + r.durationSec / 60, 0);
  const series = dailySeries(attempts, now, 30);

  const topics = [...new Set(SKILLS.map((s) => s.topic))] as Topic[];
  const topicData = topics
    .map((t) => {
      const ta = between(attempts, now - 30 * DAY, now + 1).filter((a) => topicOf(a.skillId) === t);
      const sk = SKILLS.filter((s) => s.topic === t && skills[s.id]);
      return {
        topic: TOPIC_LABEL[t],
        accuracy: ta.length ? Math.round((100 * ta.filter((a) => a.correct).length) / ta.length) : 0,
        mastery: sk.length ? Math.round((100 * sk.reduce((x, s) => x + mastery(skills[s.id], s.id), 0)) / sk.length) : 0,
        n: ta.length,
      };
    })
    .filter((t) => t.n > 0);

  const tried = SKILLS.filter((s) => skills[s.id]?.attempts);
  const weak = [...tried].sort((a, b) => mastery(skills[a.id], a.id) - mastery(skills[b.id], b.id)).slice(0, 3);
  const notes = insights(attempts, runs, now, profile.name);
  const thisWeek = between(attempts, now - 7 * DAY, now + 1);
  const lastWeek = between(attempts, now - 14 * DAY, now - 7 * DAY);
  const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-2xl font-bold">{profile.name} · {BAND_INFO[profile.band].label} ({BAND_INFO[profile.band].ages}){profile.learningMode ? ' · Learning Mode' : ''}</h3>
        <div className="no-print flex gap-1">
          {([1, 7, 30] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded-full px-3 py-1 ${range === r ? 'bg-brand' : 'bg-white/10'}`}>{r === 1 ? 'Today' : `${r} days`}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Questions" value={inRange.length} />
        <Stat label="Correct" value={inRange.filter((a) => a.correct).length} />
        <Stat label="Accuracy" value={pct(acc)} />
        <Stat label="Avg answer time" value={avgMs ? `${(avgMs / 1000).toFixed(1)}s` : '—'} />
        <Stat label="Minutes played" value={Math.round(minutes)} />
      </div>

      <section className="rounded-2xl bg-white/5 p-4">
        <h4 className="mb-2 text-lg font-bold">💡 This week</h4>
        <p className="mb-2 text-white/80">
          {thisWeek.length} questions this week ({pct(accuracy(thisWeek))} correct) vs {lastWeek.length} last week ({pct(accuracy(lastWeek))}).
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white/5 p-4">
          <h4 className="mb-2 font-bold">Accuracy over time (%)</h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={series}>
              <CartesianGrid stroke="#ffffff18" />
              <XAxis dataKey="day" stroke="#ffffff88" fontSize={11} interval={4} />
              <YAxis domain={[0, 100]} stroke="#ffffff88" fontSize={11} width={30} />
              <Tooltip contentStyle={{ background: '#1c2333', border: 'none', borderRadius: 12 }} />
              <Line type="monotone" dataKey="accuracy" stroke="#22c55e" strokeWidth={3} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </section>
        <section className="rounded-2xl bg-white/5 p-4">
          <h4 className="mb-2 font-bold">Answer speed (median seconds)</h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={series}>
              <CartesianGrid stroke="#ffffff18" />
              <XAxis dataKey="day" stroke="#ffffff88" fontSize={11} interval={4} />
              <YAxis stroke="#ffffff88" fontSize={11} width={30} />
              <Tooltip contentStyle={{ background: '#1c2333', border: 'none', borderRadius: 12 }} />
              <Line type="monotone" dataKey="medianSec" stroke="#38bdf8" strokeWidth={3} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </section>
      </div>

      {topicData.length > 0 && (
        <section className="rounded-2xl bg-white/5 p-4">
          <h4 className="mb-2 font-bold">Topic performance (30 days)</h4>
          <ResponsiveContainer width="100%" height={Math.max(120, topicData.length * 42)}>
            <BarChart data={topicData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid stroke="#ffffff18" />
              <XAxis type="number" domain={[0, 100]} stroke="#ffffff88" fontSize={11} />
              <YAxis type="category" dataKey="topic" stroke="#ffffffcc" fontSize={12} width={110} />
              <Tooltip contentStyle={{ background: '#1c2333', border: 'none', borderRadius: 12 }} />
              <Bar dataKey="accuracy" name="Accuracy %" fill="#f26b1d" radius={6} />
              <Bar dataKey="mastery" name="Mastery %" fill="#8b5cf6" radius={6} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      <section className="rounded-2xl bg-white/5 p-4">
        <h4 className="mb-2 font-bold">Skill map</h4>
        <div className="mb-2 flex flex-wrap gap-3 text-sm">
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-white/10" />Not started</span>
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-brand" />Learning</span>
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-sky" />Secure</span>
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-good" />Mastered</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
          {SKILLS.map((s) => {
            const st = skills[s.id];
            const m = mastery(st, s.id);
            return (
              <div key={s.id} className={`rounded-lg px-2 py-1 text-xs ${masteryColor(m, !!st?.attempts)}`} title={`${s.id} · mastery ${(m * 100).toFixed(0)}%`}>
                <div className="font-semibold">{s.name}</div>
                <div className="opacity-80">{BAND_INFO[s.band].ages} · {st?.attempts ? `${Math.round(m * 100)}%` : '—'}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl bg-white/5 p-4">
        <h4 className="mb-2 font-bold">Weak spots</h4>
        {weak.length === 0 && <p className="text-white/60">Not enough play yet.</p>}
        {weak.map((s) => {
          const m = topMisconception(attempts.filter((a) => a.skillId === s.id));
          return (
            <div key={s.id} className="mb-2 rounded-xl bg-white/5 px-3 py-2">
              <div className="font-semibold">{getSkill(s.id).name} — mastery {Math.round(mastery(skills[s.id], s.id) * 100)}%</div>
              {m && <div className="text-sm text-white/70">Most common mistake: {profile.name} {TAG_TEXT[m.tag] ?? m.tag} ({Math.round(m.share * 100)}% of mistakes)</div>}
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl bg-white/5 p-4">
        <h4 className="mb-2 font-bold">Session log</h4>
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-white/60"><tr><th>Date</th><th>Minutes</th><th>Distance</th><th>Questions</th><th>Accuracy</th><th>Score</th></tr></thead>
            <tbody>
              {[...runs].reverse().map((r) => (
                <tr key={r.id} className="border-t border-white/10">
                  <td>{new Date(r.startedAt).toLocaleString()}</td>
                  <td>{(r.durationSec / 60).toFixed(1)}</td>
                  <td>{r.distance} m</td>
                  <td>{r.questions}</td>
                  <td>{r.questions ? `${Math.round((100 * r.correct) / r.questions)}%` : '—'}</td>
                  <td>{r.score.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ParentControls profile={profile} attempts={attempts} onChanged={reload} />
    </div>
  );
}
