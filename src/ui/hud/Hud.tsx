import { useGame } from '@/store/gameStore';
import { useSettings } from '@/store/settingsStore';
import { useProfile } from '@/store/profileStore';
import { POWERUPS, HOVERBOARD, LIVES } from '@/config/tuning';
import { togglePause, triggerHoverboard } from '@/game/input/useInput';
import { QuestionBanner } from './QuestionBanner';
import { HintOverlay } from './HintOverlay';

function Hearts({ n, learning }: { n: number; learning: boolean }) {
  if (learning) return <span className="text-lg text-white/80" aria-label="Learning mode">🌱 Learning</span>;
  return (
    <span aria-label={`${n} hearts`} className="text-2xl tracking-tight">
      {Array.from({ length: LIVES.max }, (_, i) => (
        <span key={i} className={i < n ? '' : 'opacity-25 grayscale'}>❤️</span>
      ))}
    </span>
  );
}

export function Hud() {
  const hud = useGame((s) => s.hud);
  const phase = useGame((s) => s.phase);
  const countdown = useGame((s) => s.countdown);
  const flashFx = useGame((s) => s.flashFx);
  const leftHand = useSettings((s) => s.leftHand);
  const learning = useProfile((s) => s.profile?.learningMode ?? false);
  const boards = useProfile((s) => s.inventory?.hoverboards ?? 0);
  const streakDots = hud.streak >= 10 ? 10 : hud.streak;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
      {flashFx && <div key={flashFx.id} className={`absolute inset-0 ${flashFx.kind === 'correct' ? 'flash-good' : 'flash-bad'}`} />}
      {flashFx?.kind === 'correct' && flashFx.text && (
        <div key={`t${flashFx.id}`} className="absolute left-1/2 top-[38%] -translate-x-1/2 text-5xl font-bold text-good text-outline anim-rise">
          {flashFx.text}
        </div>
      )}

      {/* top bar */}
      <div className="safe-top flex items-start justify-between gap-2 px-3">
        <div className="rounded-2xl bg-ink/70 px-3 py-1.5 backdrop-blur">
          <Hearts n={hud.hearts} learning={learning} />
          <div className="text-2xl font-bold leading-tight text-outline">{hud.score.toLocaleString()}</div>
          <div className="text-sm text-white/75">{hud.distance.toLocaleString()} m</div>
        </div>
        <div className={`mt-1 rounded-2xl px-4 py-1 text-3xl font-bold text-outline transition-all ${hud.mult > 1 ? 'bg-brand scale-110' : 'bg-ink/60'}`} aria-label={`multiplier ${hud.mult}`}>
          ×{hud.mult}
        </div>
        <div className="flex items-start gap-2">
          <div className="rounded-2xl bg-ink/70 px-3 py-2 text-xl font-bold text-gold backdrop-blur">🪙 {hud.coins}</div>
          <button
            className="pointer-events-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink/70 text-xl backdrop-blur"
            onClick={togglePause}
            aria-label="Pause"
          >
            ❚❚
          </button>
        </div>
      </div>

      <QuestionBanner />

      {/* power-up timers */}
      <div className={`absolute bottom-24 flex w-40 flex-col-reverse gap-2 ${leftHand ? 'left-3' : 'right-3'}`}>
        {hud.powerups.map((p) => (
          <div key={p.type} className="rounded-xl bg-ink/70 px-2 py-1 backdrop-blur">
            <div className="text-sm">{POWERUPS[p.type].icon} {POWERUPS[p.type].label}</div>
            <div className="mt-1 h-2 overflow-hidden rounded bg-white/20">
              <div className="h-full rounded" style={{ width: `${(100 * p.remaining) / p.total}%`, background: POWERUPS[p.type].color }} />
            </div>
          </div>
        ))}
        {hud.hoverboard > 0 && (
          <div className="rounded-xl bg-ink/70 px-2 py-1">
            <div className="text-sm">🛹 Hoverboard</div>
            <div className="mt-1 h-2 overflow-hidden rounded bg-white/20">
              <div className="h-full rounded bg-brand" style={{ width: `${(100 * hud.hoverboard) / HOVERBOARD.duration}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* bottom: streak + hoverboard button */}
      <div className={`safe-bottom absolute bottom-0 flex w-full items-end justify-between px-3 ${leftHand ? 'flex-row-reverse' : ''}`}>
        <div className="rounded-2xl bg-ink/70 px-3 py-2 backdrop-blur" aria-label={`streak ${hud.streak}`}>
          <span className="mr-2 text-sm text-white/70">streak</span>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={`mx-0.5 inline-block h-3 w-3 rounded-full ${i < streakDots ? 'bg-gold' : 'bg-white/25'}`} />
          ))}
        </div>
        {hud.hoverboardReady && boards > 0 && hud.hoverboard <= 0 && (
          <button
            className="pointer-events-auto rounded-2xl bg-brand px-4 py-3 text-lg font-bold shadow-lg"
            onClick={() => void triggerHoverboard()}
            aria-label="Use hoverboard"
          >
            🛹 ×{boards}
          </button>
        )}
      </div>

      <HintOverlay />

      {phase === 'COUNTDOWN' && countdown > 0 && (
        <div key={countdown} className="absolute inset-0 grid place-items-center text-[9rem] font-bold text-white text-outline anim-pop">
          {countdown}
        </div>
      )}
    </div>
  );
}
