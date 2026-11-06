import { useGame } from '@/store/gameStore';
import { speak } from '@/audio/speech';

const KIND_HINT: Record<string, string> = {
  compare: 'Pick the sign: <  =  >',
  numberLine: 'Which part of the number line?',
  estimate: 'Roughly how big?',
  missing: 'Find the missing number',
};

/** Large, high-contrast question banner (min 36 px), speaker replays the voice. */
export function QuestionBanner() {
  const b = useGame((s) => s.banner);
  if (!b) return null;
  const orb = b.mode === 'orb';
  return (
    <div className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+92px)] w-[min(94vw,760px)] -translate-x-1/2 anim-slide" aria-live="polite">
      <div className={`rounded-3xl px-5 py-3 text-center shadow-2xl ring-4 ${orb ? 'bg-violet/80 ring-white/40' : 'bg-slate-900/70 ring-white/25'} backdrop-blur-md`}>
        {b.tunnel && (
          <div className="mb-1 flex items-center justify-center gap-2 text-sm font-semibold text-fuchsia-300">
            🌀 Challenge Tunnel
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-3 w-3 rounded-full ${i < b.tunnel!.answered ? 'bg-gold' : 'bg-white/25'}`} />
            ))}
          </div>
        )}
        {orb && <div className="text-sm font-semibold text-white/80">✨ Maths Orb — grab the right one!</div>}
        <div className="flex items-center justify-center gap-3">
          <div className="text-[clamp(2.25rem,6vw,3.5rem)] font-bold leading-tight tracking-wide" style={{ wordBreak: 'break-word' }}>
            {b.prompt}
          </div>
          <button
            className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 text-xl"
            onClick={() => speak(b.speech)}
            aria-label="Read question aloud"
          >
            🔊
          </button>
        </div>
        {KIND_HINT[b.kind] && !orb && <div className="text-sm text-white/65">{KIND_HINT[b.kind]}</div>}
        {!orb && <div className="mt-0.5 text-sm text-white/55">Answers are on the gates ahead ↓</div>}
      </div>
    </div>
  );
}
