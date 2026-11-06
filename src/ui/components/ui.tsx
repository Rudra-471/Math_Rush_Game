import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'good' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand hover:bg-brand-2 text-white shadow-[0_6px_0_#b44a0f] active:shadow-[0_2px_0_#b44a0f] active:translate-y-1',
  secondary: 'bg-ink-3 hover:bg-[#4a5b82] text-white shadow-[0_6px_0_#232c42] active:shadow-[0_2px_0_#232c42] active:translate-y-1',
  ghost: 'bg-white/10 hover:bg-white/20 text-white',
  good: 'bg-good hover:brightness-110 text-white shadow-[0_6px_0_#15803d] active:shadow-[0_2px_0_#15803d] active:translate-y-1',
  danger: 'bg-bad hover:brightness-110 text-white shadow-[0_6px_0_#991b1b] active:shadow-[0_2px_0_#991b1b] active:translate-y-1',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'text-2xl px-8 py-4 rounded-3xl' : size === 'sm' ? 'text-sm px-3 py-2 rounded-xl' : 'text-lg px-5 py-3 rounded-2xl';
  return (
    <button
      className={`min-h-11 font-semibold transition-all duration-100 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-4 focus-visible:outline-sky ${VARIANTS[variant]} ${sz} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-ink/90 backdrop-blur-md ring-1 ring-white/10 shadow-2xl ${className}`}>{children}</div>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-3 anim-fade" role="dialog" aria-modal="true" aria-label={title}>
      <Panel className={`relative flex max-h-[94vh] w-full flex-col ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl hover:bg-white/20">
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </Panel>
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-2xl bg-white/5 px-4 py-2">
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-sm text-white/60">{hint}</span>}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? 'bg-good' : 'bg-white/25'}`}
      >
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${checked ? 'left-7' : 'left-1'}`} />
      </button>
    </label>
  );
}

export function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-4 rounded-2xl bg-white/5 px-4 py-2">
      <span className="font-medium">{label}</span>
      <input
        type="range" min={0} max={1} step={0.05} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-40 accent-brand"
        aria-label={label}
      />
    </label>
  );
}

export function Stat({ label, value, icon }: { label: string; value: ReactNode; icon?: string }) {
  return (
    <div className="rounded-2xl bg-white/5 px-4 py-3 text-center">
      <div className="text-sm text-white/60">{icon} {label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

export function Coins({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-bold text-gold ${className}`}>
      <span aria-hidden>🪙</span>
      {n.toLocaleString()}
    </span>
  );
}
