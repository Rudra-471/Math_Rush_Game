import { useEffect, useState } from 'react';
import { intro } from '@/game/intro/director';
import { finishIntro } from '@/game/intro/flow';

interface Caption {
  from: number;
  to: number;
  text: string;
}

const CAPTIONS: Caption[] = [
  { from: 0.9, to: 4.6, text: 'Somewhere, a city is waking up…' },
  { from: 5.6, to: 8.6, text: 'The trains never wait.' },
  { from: 9.4, to: 12.4, text: 'But today, the city runs on maths.' },
];

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const fade = (t: number, a: number, b: number, edge = 0.5) => Math.max(0, Math.min(1, (t - a) / edge, (b - t) / edge));

/** Letterbox, film grain, vignette, captions, the equation reveal, title card and skip button. */
export function IntroOverlay() {
  const [t, setT] = useState(0);
  const [passedAt, setPassedAt] = useState(-1);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setT(intro.t);
      setPassedAt(intro.gatePassedAt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finishIntro();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const titleAt = passedAt > 0 ? passedAt + 1.4 : Infinity;
  const titleT = t - titleAt;
  const bars = Math.min(1, t / 1.2) * (titleT > 2.6 ? Math.max(0, 1 - (titleT - 2.6) / 0.8) : 1);
  const eqVisible = t > 11 && (passedAt < 0 || t < passedAt + 0.5);
  const eqScale = t < 11.5 ? 0.6 + (t - 11) * 0.8 : 1;
  const white = passedAt > 0 ? Math.max(0, 1 - Math.abs(t - titleAt) / 0.35) : 0;
  const goFlash = fade(t, 13, 13.8, 0.2);
  const fadeIn = Math.max(0, 1 - t / 1.2);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 select-none overflow-hidden" aria-label="Intro film">
      {/* vignette + grain */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />
      <div className="absolute -inset-20 opacity-[0.13] mix-blend-overlay" style={{ backgroundImage: GRAIN, animation: 'grain 0.4s steps(3) infinite' }} />
      {/* fade from black */}
      <div className="absolute inset-0 bg-black" style={{ opacity: fadeIn }} />
      {/* letterbox */}
      <div className="absolute inset-x-0 top-0 bg-black" style={{ height: `${11 * bars}vh` }} />
      <div className="absolute inset-x-0 bottom-0 bg-black" style={{ height: `${11 * bars}vh` }} />

      {/* captions (in the lower letterbox) */}
      {CAPTIONS.map((c) => {
        const o = fade(t, c.from, c.to, 0.6);
        return o > 0 ? (
          <div key={c.text} className="absolute inset-x-0 bottom-[3.2vh] text-center text-[clamp(1rem,2.6vw,1.6rem)] italic tracking-wide text-white/90" style={{ opacity: o, letterSpacing: '0.06em' }}>
            {c.text}
          </div>
        ) : null;
      })}

      {/* the question materialises */}
      {eqVisible && (
        <div className="absolute inset-x-0 top-[15vh] flex justify-center">
          <div
            className="rounded-3xl bg-slate-900/55 px-8 py-3 text-[clamp(2.5rem,7vw,4.5rem)] font-bold text-white backdrop-blur-md"
            style={{ transform: `scale(${eqScale})`, opacity: Math.min(1, (t - 11) * 2), boxShadow: '0 0 60px rgba(96,165,250,0.55)', textShadow: '0 0 24px rgba(147,197,253,0.9)' }}
          >
            7 × 8 = ?
          </div>
        </div>
      )}
      {goFlash > 0 && (
        <div className="absolute inset-0 grid place-items-center text-[clamp(4rem,14vw,9rem)] font-bold italic text-white" style={{ opacity: goFlash, textShadow: '0 0 40px #f26b1d' }}>
          GO!
        </div>
      )}

      {/* white flash + title card */}
      <div className="absolute inset-0 bg-white" style={{ opacity: white * 0.85 }} />
      {titleT > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <h1
            className="font-bold text-white"
            style={{
              fontSize: 'clamp(3rem, 11vw, 7.5rem)',
              letterSpacing: `${Math.max(0.02, 0.5 - titleT * 0.4)}em`,
              opacity: Math.min(1, titleT * 2),
              textShadow: '0 4px 0 rgba(0,0,0,0.35), 0 0 40px rgba(242,107,29,0.6)',
            }}
          >
            MATH <span className="text-brand">RUSH</span> 3D
          </h1>
          <p className="mt-2 text-xl font-semibold text-brand-2" style={{ opacity: Math.min(1, Math.max(0, (titleT - 0.8) * 2)), textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
            Run • Solve • Learn • Survive
          </p>
        </div>
      )}

      <button
        className="pointer-events-auto absolute right-4 top-[calc(11vh+12px)] rounded-full bg-black/45 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur hover:bg-black/65"
        onClick={finishIntro}
      >
        Skip ▸▸
      </button>
    </div>
  );
}
