import mitt from 'mitt';
import type { Question } from '@/math/types';
import type { PowerUpType } from '@/config/tuning';

export type GameEvents = {
  GATE_SHOWN: { question: Question };
  GATE_REVEALED: { question: Question };
  GATE_PASSED: {
    question: Question;
    chosen: number;
    correct: boolean;
    responseMs: number;
    context: 'gate' | 'orb' | 'challenge';
    streak: number;
  };
  COIN: { value: number };
  HIT: { kind: 'stumble' | 'crash' | 'absorbed' };
  POWERUP: { type: PowerUpType | 'hoverboard'; on: boolean };
  JUMP: undefined;
  LAND: undefined;
  SLIDE: undefined;
  LANE: undefined;
  HORN: undefined;
  TUNNEL: { phase: 'enter' | 'exit'; correct?: number };
  RUN_END: undefined;
  TOAST: { text: string; icon?: string };
  INTRO: { cue: string };
};

export const bus = mitt<GameEvents>();
