import { create } from 'zustand';
import type { GateKind, Hint } from '@/math/types';
import type { PowerUpType } from '@/config/tuning';
import type { RunStats } from '@/game/runtime';

export type Phase =
  | 'BOOT'
  | 'INTRO'
  | 'PROFILE'
  | 'MENU'
  | 'SETUP'
  | 'COUNTDOWN'
  | 'RUNNING'
  | 'PAUSED'
  | 'GAME_OVER'
  | 'REWARDS';

export type Overlay = null | 'shop' | 'missions' | 'settings' | 'howto' | 'parentGate' | 'parent' | 'achievements';

export interface Banner {
  mode: 'gate' | 'orb';
  prompt: string;
  speech: string;
  revealed: boolean;
  labels: string[];
  kind: GateKind;
  tunnel?: { answered: number; correct: number };
}

export interface HintState {
  hint: Hint;
  answer: string;
  message: string;
  duration: number;
  lostHeart: boolean;
}

export interface Hud {
  score: number;
  coins: number;
  distance: number;
  hearts: number;
  streak: number;
  mult: number;
  powerups: Array<{ type: PowerUpType; remaining: number; total: number }>;
  hoverboard: number;
  hoverboardReady: boolean;
  inTunnel: boolean;
}

export interface RunSummary {
  score: number;
  distance: number;
  coins: number;
  stats: RunStats;
  best: number;
  newBest: boolean;
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  xpFracBefore: number;
  xpFracAfter: number;
  missionsCompleted: string[];
  achievements: string[];
  canRevive: boolean;
  durationSec: number;
}

export interface DebugInfo {
  fps: number;
  speed: number;
  chunk: string;
  next: string;
}

interface GameStore {
  phase: Phase;
  overlay: Overlay;
  hud: Hud;
  banner: Banner | null;
  hint: HintState | null;
  flashFx: { kind: 'correct' | 'wrong'; text: string; id: number } | null;
  toasts: Array<{ id: number; text: string; icon?: string }>;
  summary: RunSummary | null;
  countdown: number;
  debug: DebugInfo;
  runId: number;
  setPhase: (p: Phase) => void;
  setOverlay: (o: Overlay) => void;
  setHud: (h: Hud) => void;
  setBanner: (b: Banner | null) => void;
  showHint: (h: HintState | null) => void;
  flash: (f: { kind: 'correct' | 'wrong'; text: string }) => void;
  toast: (t: { text: string; icon?: string }) => void;
  setSummary: (s: RunSummary | null) => void;
  setCountdown: (n: number) => void;
  setDebug: (d: DebugInfo) => void;
  newRun: () => void;
}

let fxId = 0;

export const EMPTY_HUD: Hud = {
  score: 0, coins: 0, distance: 0, hearts: 3, streak: 0, mult: 1, powerups: [], hoverboard: 0,
  hoverboardReady: false, inTunnel: false,
};

export const useGame = create<GameStore>((set) => ({
  phase: 'BOOT',
  overlay: null,
  hud: EMPTY_HUD,
  banner: null,
  hint: null,
  flashFx: null,
  toasts: [],
  summary: null,
  countdown: 0,
  debug: { fps: 0, speed: 0, chunk: '', next: '' },
  runId: 0,
  setPhase: (phase) => set({ phase }),
  setOverlay: (overlay) => set({ overlay }),
  setHud: (hud) => set({ hud }),
  setBanner: (banner) => set({ banner }),
  showHint: (hint) => set({ hint }),
  flash: (f) => set({ flashFx: { ...f, id: ++fxId } }),
  toast: (t) => {
    const id = ++fxId;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 2200);
  },
  setSummary: (summary) => set({ summary }),
  setCountdown: (countdown) => set({ countdown }),
  setDebug: (debug) => set({ debug }),
  newRun: () => set((s) => ({ runId: s.runId + 1, banner: null, hint: null, hud: EMPTY_HUD, summary: null })),
}));
