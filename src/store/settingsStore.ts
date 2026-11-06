import { create } from 'zustand';
import type { QualityTier } from '@/config/tuning';

/** Small device settings in localStorage for instant load (SPEC 12). */
export interface Settings {
  music: number;
  sfx: number;
  voice: boolean;
  quality: QualityTier | 'auto';
  reduceMotion: boolean;
  colorBlind: boolean;
  dyslexiaFont: boolean;
  leftHand: boolean;
  debug: boolean;
  playIntro: boolean;
}

const KEY = 'mathrush.settings.v1';
const DEFAULTS: Settings = {
  music: 0.5, sfx: 0.8, voice: true, quality: 'auto', reduceMotion: false, colorBlind: false,
  dyslexiaFont: false, leftHand: false, debug: false, playIntro: true,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* storage blocked */
  }
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return { ...DEFAULTS, reduceMotion: true };
  }
  return DEFAULTS;
}

interface SettingsStore extends Settings {
  autoTier: QualityTier;
  set: (p: Partial<Settings>) => void;
  setAutoTier: (t: QualityTier) => void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...load(),
  autoTier: 'medium',
  set: (p) => {
    set(p);
    const { set: _s, setAutoTier: _a, autoTier: _t, ...rest } = { ...get(), ...p };
    void _s; void _a; void _t;
    try {
      localStorage.setItem(KEY, JSON.stringify(rest));
    } catch {
      /* ignore */
    }
  },
  setAutoTier: (autoTier) => set({ autoTier }),
}));

export function effectiveTier(): QualityTier {
  const s = useSettings.getState();
  return s.quality === 'auto' ? s.autoTier : s.quality;
}
