import { useEffect, useMemo, useState } from 'react';
import { useGame } from '@/store/gameStore';
import { checkPin, hasPin, setPin } from '@/data/repositories';
import { Button, Modal } from '../components/ui';

/**
 * Parent Gate: 4-digit PIN (salted SHA-256). First launch: answer a grown-up maths question,
 * then set the PIN.
 */
export function ParentGate() {
  const close = () => useGame.getState().setOverlay(null);
  const [mode, setMode] = useState<'loading' | 'question' | 'set' | 'enter'>('loading');
  const [pin, setPinText] = useState('');
  const [answer, setAnswer] = useState('');
  const [err, setErr] = useState('');
  const q = useMemo(() => {
    const a = 12 + Math.floor(Math.random() * 8);
    const b = 6 + Math.floor(Math.random() * 4);
    return { a, b, ans: a * b };
  }, []);

  useEffect(() => {
    void hasPin().then((h) => setMode(h ? 'enter' : 'question'));
  }, []);

  const submit = async () => {
    setErr('');
    if (mode === 'question') {
      if (Number(answer) === q.ans) setMode('set');
      else setErr('Not quite — this check is for grown-ups.');
    } else if (mode === 'set') {
      if (!/^\d{4}$/.test(pin)) return setErr('Please choose 4 digits.');
      await setPin(pin);
      useGame.getState().setOverlay('parent');
    } else if (mode === 'enter') {
      if (await checkPin(pin)) useGame.getState().setOverlay('parent');
      else { setErr('Wrong PIN'); setPinText(''); }
    }
  };

  return (
    <Modal title="Parents only" onClose={close}>
      <div className="flex flex-col items-center gap-4 text-center">
        {mode === 'question' && (
          <>
            <p>To set up the parent area, please answer:</p>
            <p className="text-4xl font-bold">What is {q.a} × {q.b}?</p>
            <input inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ''))}
              className="w-40 rounded-2xl bg-white/10 px-4 py-3 text-center text-3xl outline-none focus:ring-4 focus:ring-brand" autoFocus aria-label="Answer" />
          </>
        )}
        {(mode === 'set' || mode === 'enter') && (
          <>
            <p>{mode === 'set' ? 'Choose a 4-digit parent PIN' : 'Enter your parent PIN'}</p>
            <input inputMode="numeric" type="password" maxLength={4} value={pin}
              onChange={(e) => setPinText(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              className="w-44 rounded-2xl bg-white/10 px-4 py-3 text-center text-4xl tracking-[0.5em] outline-none focus:ring-4 focus:ring-brand" autoFocus aria-label="PIN" />
          </>
        )}
        {err && <p className="text-bad">{err}</p>}
        {mode !== 'loading' && <Button onClick={() => void submit()}>Continue</Button>}
      </div>
    </Modal>
  );
}
