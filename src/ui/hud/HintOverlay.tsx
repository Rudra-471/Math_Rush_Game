import { useGame } from '@/store/gameStore';
import type { Hint } from '@/math/types';
import { HintVisual } from '../components/HintVisual';

/** Teaching overlay on a wrong answer (1.5–2.5 s, game in 0.3× slow-mo). Encouraging, never shaming. */
export function HintOverlay() {
  const h = useGame((s) => s.hint);
  if (!h) return null;
  return (
    <div className="absolute inset-x-0 bottom-20 flex justify-center px-3 anim-pop">
      <div className="w-[min(94vw,560px)] rounded-3xl bg-white px-5 py-4 text-ink shadow-2xl ring-4 ring-sky">
        <div className="text-lg font-semibold text-sky-700">{h.message}</div>
        <div className="text-3xl font-bold">{h.answer}</div>
        <div className="my-2 flex justify-center">
          <HintVisual hint={h.hint as Hint} />
        </div>
        <div className="text-base">{h.hint.text}</div>
        {h.lostHeart && <div className="mt-1 text-sm text-ink/60">−1 ❤️ — you’ve got this!</div>}
      </div>
    </div>
  );
}
