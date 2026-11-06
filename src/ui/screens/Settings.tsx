import { useGame } from '@/store/gameStore';
import { useSettings } from '@/store/settingsStore';
import type { QualityTier } from '@/config/tuning';
import { Button, Modal, Slider, Toggle } from '../components/ui';

export function Settings() {
  const s = useSettings();
  const close = () => useGame.getState().setOverlay(null);
  const tiers: Array<QualityTier | 'auto'> = ['auto', 'low', 'medium', 'high'];
  return (
    <Modal title="Settings" onClose={close}>
      <div className="flex flex-col gap-2">
        <Slider label="🎵 Music" value={s.music} onChange={(v) => s.set({ music: v })} />
        <Slider label="🔊 Sound effects" value={s.sfx} onChange={(v) => s.set({ sfx: v })} />
        <Toggle label="🗣️ Read questions aloud" checked={s.voice} onChange={(v) => s.set({ voice: v })} />
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/5 px-4 py-2">
          <span className="font-medium">🖥️ Graphics quality</span>
          <div className="flex gap-1">
            {tiers.map((t) => (
              <Button key={t} size="sm" variant={s.quality === t ? 'primary' : 'ghost'} onClick={() => s.set({ quality: t })}>
                {t === 'auto' ? `Auto (${s.autoTier})` : t}
              </Button>
            ))}
          </div>
        </div>
        <Toggle label="🌀 Reduce motion" hint="No camera shake, zoom or flashing effects" checked={s.reduceMotion} onChange={(v) => s.set({ reduceMotion: v })} />
        <Toggle label="🎨 Colour-blind friendly colours" hint="Blue / orange instead of green / red" checked={s.colorBlind} onChange={(v) => s.set({ colorBlind: v })} />
        <Toggle label="🔤 Easy-read font" hint="Wider letters and spacing (dyslexia-friendly)" checked={s.dyslexiaFont} onChange={(v) => s.set({ dyslexiaFont: v })} />
        <Toggle label="🎬 Play the intro film on start" hint="You can always watch it from the menu" checked={s.playIntro} onChange={(v) => s.set({ playIntro: v })} />
        <Toggle label="🤚 Left-hand mode" hint="Moves the hoverboard button and timers to the left" checked={s.leftHand} onChange={(v) => s.set({ leftHand: v })} />
        <p className="mt-2 text-sm text-white/50">Language: English (Hindi coming later). Difficulty and Learning Mode are in the Parent area.</p>
      </div>
    </Modal>
  );
}

export function HowToPlay() {
  const close = () => useGame.getState().setOverlay(null);
  const rows: Array<[string, string, string]> = [
    ['⬅️ ➡️', 'Change lane', 'Arrow keys / A D · swipe left or right'],
    ['⬆️', 'Jump over low barriers', 'Up / W / Space · swipe up'],
    ['⬇️', 'Slide under high barriers', 'Down / S · swipe down (in the air: fast-fall)'],
    ['🚪', 'Answer gates', 'A question appears at the top — run through the gate with the right answer!'],
    ['❤️', 'Hearts', 'A wrong gate or a side bump costs a heart. 5 right in a row gives one back.'],
    ['✖️', 'Streak multiplier', '3 right = ×2, 6 = ×3, 10 = ×4'],
    ['🟣', 'Maths Orbs', 'Grab a purple coin, then collect the orb with the right answer.'],
    ['🌀', 'Challenge Tunnel', 'Every 500 m: 3 questions in a row for a chest.'],
    ['🚂', 'Trains', 'Change lanes — or run up a ramp onto the roof! Red trains are coming at you.'],
    ['🛹', 'Hoverboard', 'Press H or tap the board button: saves you from one crash.'],
    ['⏸️', 'Pause', 'Esc / P or the pause button'],
  ];
  return (
    <Modal title="How to play" onClose={close}>
      <div className="flex flex-col gap-2">
        {rows.map(([icon, title, desc]) => (
          <div key={title} className="flex items-center gap-4 rounded-2xl bg-white/5 px-4 py-3">
            <span className="w-14 shrink-0 text-center text-3xl">{icon}</span>
            <span>
              <span className="block text-lg font-bold">{title}</span>
              <span className="text-white/70">{desc}</span>
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
