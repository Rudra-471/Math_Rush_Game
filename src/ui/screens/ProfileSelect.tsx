import { useState } from 'react';
import { useGame } from '@/store/gameStore';
import { useProfile } from '@/store/profileStore';
import { MAX_PROFILES } from '@/data/repositories';
import { BANDS, BAND_INFO } from '@/math/skills';
import type { Band } from '@/math/types';
import { CHARACTERS, characterById } from '@/meta/shop';
import { Button, Panel, Toggle } from '../components/ui';

export function Avatar({ id, size = 64 }: { id: string; size?: number }) {
  const c = characterById(id);
  return (
    <div className="relative grid place-items-center overflow-hidden rounded-full ring-4 ring-white/20" style={{ width: size, height: size, background: c.shirt }} aria-hidden>
      <div className="absolute rounded-full" style={{ width: size * 0.5, height: size * 0.5, top: size * 0.18, background: c.skin }} />
      <div className="absolute rounded-t-full" style={{ width: size * 0.52, height: size * 0.22, top: size * 0.14, background: c.hair }} />
    </div>
  );
}

/** Difficulty select: 4 band cards + Learning Mode toggle (first time; later in Parent settings). */
function CreateProfile({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const create = useProfile((s) => s.create);
  const [name, setName] = useState('');
  const [character, setCharacter] = useState(CHARACTERS[0].id);
  const [band, setBand] = useState<Band>('intermediate');
  const [learning, setLearning] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    await create(name, character, band, learning);
    onDone();
  };
  return (
    <Panel className="w-full max-w-3xl p-5">
      <h2 className="mb-3 text-3xl font-bold">New player</h2>
      <label className="mb-4 block">
        <span className="text-white/70">First name or nickname</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
          placeholder="e.g. Riya"
          className="mt-1 block w-full rounded-2xl bg-white/10 px-4 py-3 text-2xl outline-none ring-brand focus:ring-4"
          autoFocus
        />
      </label>
      <div className="mb-2 text-white/70">Pick a runner</div>
      <div className="mb-4 flex flex-wrap gap-3">
        {CHARACTERS.filter((c) => c.price === 0).map((c) => (
          <button key={c.id} onClick={() => setCharacter(c.id)} className={`flex flex-col items-center rounded-2xl p-2 ${character === c.id ? 'bg-brand/40 ring-4 ring-brand' : 'bg-white/5'}`}>
            <Avatar id={c.id} />
            <span className="mt-1 font-semibold">{c.name}</span>
          </button>
        ))}
      </div>
      <div className="mb-2 text-white/70">How old are you? (you can change this later)</div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BANDS.map((b) => (
          <button key={b} onClick={() => setBand(b)} className={`rounded-2xl p-3 text-left ${band === b ? 'bg-brand ring-4 ring-white/50' : 'bg-white/10 hover:bg-white/15'}`}>
            <div className="text-3xl">{BAND_INFO[b].emoji}</div>
            <div className="text-xl font-bold">{BAND_INFO[b].ages}</div>
            <div className="text-sm text-white/80">{BAND_INFO[b].label}</div>
          </button>
        ))}
      </div>
      <Toggle label="Learning Mode" hint="Slower, slow-motion near gates, no hearts lost — great for 5–7 year olds" checked={learning} onChange={setLearning} />
      <div className="mt-5 flex justify-end gap-3">
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button onClick={submit} disabled={busy || !name.trim()}>Let’s run! →</Button>
      </div>
    </Panel>
  );
}

export function ProfileSelect() {
  const profiles = useProfile((s) => s.profiles);
  const select = useProfile((s) => s.select);
  const [creating, setCreating] = useState(profiles.length === 0);
  const go = () => useGame.getState().setPhase('MENU');

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-ink/60 p-4">
      {creating ? (
        <CreateProfile onDone={go} onCancel={profiles.length ? () => setCreating(false) : undefined} />
      ) : (
        <Panel className="w-full max-w-3xl p-6 text-center">
          <h2 className="mb-5 text-4xl font-bold">Who’s playing?</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={async () => { await select(p.id); go(); }}
                className="flex w-32 flex-col items-center rounded-3xl bg-white/5 p-3 hover:bg-white/15 focus-visible:ring-4"
              >
                <Avatar id={p.character} size={80} />
                <span className="mt-2 text-xl font-bold">{p.name}</span>
                <span className="text-sm text-white/60">{BAND_INFO[p.band].ages}</span>
              </button>
            ))}
            {profiles.length < MAX_PROFILES && (
              <button onClick={() => setCreating(true)} className="flex w-32 flex-col items-center justify-center rounded-3xl border-4 border-dashed border-white/25 p-3 hover:bg-white/10">
                <span className="text-5xl">＋</span>
                <span className="font-semibold">Add child</span>
              </button>
            )}
          </div>
          <Button variant="ghost" className="mt-6" onClick={() => useGame.getState().setOverlay('parentGate')}>👪 Parents</Button>
        </Panel>
      )}
    </div>
  );
}
