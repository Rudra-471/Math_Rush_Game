import type { Hint } from '@/math/types';

/** SVG visual models: number line jumps, dot arrays, sharing groups, fraction bars, 10×10 grid, balance steps. */
export function HintVisual({ hint }: { hint: Hint }) {
  switch (hint.type) {
    case 'numberLine': {
      const pts = [hint.start];
      for (const j of hint.jumps) pts.push(pts[pts.length - 1] + j);
      const lo = Math.min(...pts), hi = Math.max(...pts);
      const span = Math.max(1, hi - lo);
      const W = 420, pad = 30;
      const X = (v: number) => pad + ((v - lo) / span) * (W - 2 * pad);
      return (
        <svg viewBox={`0 0 ${W} 90`} className="h-24 w-full max-w-md" aria-hidden>
          <line x1={10} y1={70} x2={W - 10} y2={70} stroke="#1c2333" strokeWidth={3} />
          {pts.map((p, i) => (
            <g key={i}>
              <line x1={X(p)} y1={62} x2={X(p)} y2={78} stroke="#1c2333" strokeWidth={3} />
              <text x={X(p)} y={90} textAnchor="middle" fontSize={14} fontWeight={700} fill="#1c2333">{Math.round(p * 100) / 100}</text>
            </g>
          ))}
          {pts.slice(1).map((p, i) => {
            const a = X(pts[i]), b = X(p);
            const mid = (a + b) / 2;
            return (
              <g key={`j${i}`}>
                <path d={`M ${a} 66 Q ${mid} ${10} ${b} 66`} fill="none" stroke="#f26b1d" strokeWidth={3} markerEnd="url(#arr)" />
                <text x={mid} y={28} textAnchor="middle" fontSize={15} fontWeight={700} fill="#f26b1d">
                  {hint.jumps[i] > 0 ? '+' : '−'}{Math.abs(Math.round(hint.jumps[i] * 100) / 100)}
                </text>
              </g>
            );
          })}
          <defs>
            <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="#f26b1d" />
            </marker>
          </defs>
        </svg>
      );
    }
    case 'dotArray': {
      const r = Math.min(hint.rows, 12), c = Math.min(hint.cols, 12);
      const s = 14;
      return (
        <svg viewBox={`0 0 ${c * s + 4} ${r * s + 4}`} className="max-h-36 w-auto" style={{ height: Math.min(144, r * 14 + 4) }} aria-hidden>
          {Array.from({ length: r * c }, (_, i) => (
            <circle key={i} cx={2 + (i % c) * s + s / 2} cy={2 + Math.floor(i / c) * s + s / 2} r={5} fill={Math.floor(i / c) % 2 ? '#f26b1d' : '#2563eb'} />
          ))}
        </svg>
      );
    }
    case 'groups': {
      const g = Math.min(hint.groups, 12);
      const per = Math.floor(hint.total / Math.max(1, hint.groups));
      return (
        <div className="flex flex-wrap justify-center gap-2" aria-hidden>
          {Array.from({ length: g }, (_, i) => (
            <div key={i} className="flex max-w-20 flex-wrap justify-center gap-0.5 rounded-xl border-2 border-sky p-1">
              {Array.from({ length: Math.min(per, 15) }, (_, k) => <span key={k} className="h-2.5 w-2.5 rounded-full bg-brand" />)}
            </div>
          ))}
        </div>
      );
    }
    case 'fractionBars':
      return (
        <div className="flex w-full max-w-sm flex-col gap-1.5" aria-hidden>
          {hint.fractions.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex h-6 flex-1 overflow-hidden rounded border-2 border-ink">
                {Array.from({ length: Math.min(f.d, 24) }, (_, k) => (
                  <div key={k} className={`flex-1 border-r border-ink/40 last:border-r-0 ${k < f.n ? 'bg-brand' : 'bg-white'}`} />
                ))}
              </div>
              <span className="w-12 text-right font-bold">{f.n}/{f.d}</span>
            </div>
          ))}
        </div>
      );
    case 'percentGrid':
      return (
        <svg viewBox="0 0 102 102" className="h-28 w-28" aria-hidden>
          {Array.from({ length: 100 }, (_, i) => (
            <rect key={i} x={1 + (i % 10) * 10} y={1 + Math.floor(i / 10) * 10} width={9} height={9} fill={i < hint.percent ? '#f26b1d' : '#e2e8f0'} />
          ))}
        </svg>
      );
    case 'balance':
      return (
        <div className="flex flex-col items-center gap-1 font-bold" aria-hidden>
          <div className="text-3xl">⚖️</div>
          {hint.steps.map((s, i) => (
            <div key={i} className="rounded-lg bg-sky/20 px-3 py-0.5">{s}</div>
          ))}
        </div>
      );
    default:
      return null;
  }
}
