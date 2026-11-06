import { useGame } from '@/store/gameStore';

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="rounded-2xl bg-ink/90 px-4 py-2 text-lg font-semibold shadow-xl ring-2 ring-gold anim-pop">
          {t.icon} {t.text}
        </div>
      ))}
    </div>
  );
}
