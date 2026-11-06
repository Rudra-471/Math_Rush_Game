import { bus } from '@/events/bus';
import { useSettings } from '@/store/settingsStore';
import { audio } from './AudioManager';

/** Reads questions aloud with the Web Speech API (rate 0.9, en-IN voice if available). */
let voice: SpeechSynthesisVoice | null = null;

function pickVoice() {
  if (typeof speechSynthesis === 'undefined') return;
  const voices = speechSynthesis.getVoices();
  voice = voices.find((v) => v.lang === 'en-IN') ?? voices.find((v) => v.lang.startsWith('en')) ?? null;
}

export function speak(text: string) {
  if (typeof speechSynthesis === 'undefined' || !useSettings.getState().voice) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  if (voice) u.voice = voice;
  u.onstart = () => audio.duck(true);
  u.onend = () => audio.duck(false);
  u.onerror = () => audio.duck(false);
  speechSynthesis.speak(u);
}

let wired = false;
export function initSpeech() {
  if (wired || typeof speechSynthesis === 'undefined') return;
  wired = true;
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
  bus.on('GATE_SHOWN', (e) => speak(e.question.speech));
  bus.on('RUN_END', () => speechSynthesis.cancel());
}
