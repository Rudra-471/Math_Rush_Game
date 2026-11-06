import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { useProfile } from '@/store/profileStore';
import { useGame } from '@/store/gameStore';
import { BOARDS, CHARACTERS, HOVERBOARD_PRICE, SHOES, upgradePrice, characterById, type CharacterDef } from '@/meta/shop';
import { POWERUPS, type PowerUpType } from '@/config/tuning';
import { Player } from '@/game/entities/Player';
import { Button, Coins, Modal } from '../components/ui';

function Turntable({ character }: { character: CharacterDef }) {
  const g = useRef<THREE.Group>(null);
  const drag = useRef({ on: false, x: 0, vel: 0.6 });
  useFrame((_, dt) => {
    if (!g.current) return;
    if (!drag.current.on) g.current.rotation.y += drag.current.vel * dt;
  });
  return (
    <group
      ref={g}
      onPointerDown={(e) => { drag.current.on = true; drag.current.x = e.clientX; }}
      onPointerUp={() => { drag.current.on = false; }}
      onPointerLeave={() => { drag.current.on = false; }}
      onPointerMove={(e) => {
        if (!drag.current.on || !g.current) return;
        g.current.rotation.y += (e.clientX - drag.current.x) * 0.02;
        drag.current.x = e.clientX;
      }}
    >
      <Player key={character.id} character={character} boardColor="#f26b1d" trailColor="transparent" shadows={false} preview />
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.2, 32]} />
        <meshStandardMaterial color="#3b4a6b" />
      </mesh>
    </group>
  );
}

type Tab = 'characters' | 'shoes' | 'boards' | 'upgrades';

export function Shop() {
  const inv = useProfile((s) => s.inventory);
  const update = useProfile((s) => s.updateInventory);
  const close = () => useGame.getState().setOverlay(null);
  const [tab, setTab] = useState<Tab>('characters');
  const [preview, setPreview] = useState(inv?.equipped.character ?? 'aarav');
  if (!inv) return null;

  const buy = (id: string, price: number, slot?: 'character' | 'shoes' | 'board') =>
    update((i) => {
      if (i.coins < price || i.owned.includes(id)) return i;
      i.coins -= price;
      i.owned.push(id);
      if (slot) i.equipped[slot] = id;
      return i;
    });
  const equip = (id: string, slot: 'character' | 'shoes' | 'board') => update((i) => ({ ...i, equipped: { ...i.equipped, [slot]: id } }));

  const tabs: Array<[Tab, string]> = [['characters', '🧍 Characters'], ['shoes', '👟 Shoes'], ['boards', '🛹 Boards'], ['upgrades', '⬆️ Upgrades']];

  return (
    <Modal title="Shop" onClose={close} wide>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map(([t, label]) => (
            <Button key={t} size="sm" variant={tab === t ? 'primary' : 'ghost'} onClick={() => setTab(t)}>{label}</Button>
          ))}
        </div>
        <Coins n={inv.coins} className="text-2xl" />
      </div>
      <p className="mb-3 text-sm text-white/60">Everything here is bought with coins you earn by playing — never real money. Looks only, no extra powers.</p>

      {tab === 'characters' && (
        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          <div className="h-72 overflow-hidden rounded-3xl bg-gradient-to-b from-sky/30 to-ink-2">
            <Canvas camera={{ position: [0, 1.6, 4.2], fov: 40 }} dpr={[1, 2]}>
              <hemisphereLight args={['#ffffff', '#445', 1.4]} />
              <directionalLight position={[3, 5, 4]} intensity={2} />
              <group position={[0, -0.9, 0]}>
                <Turntable character={characterById(preview)} />
              </group>
            </Canvas>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CHARACTERS.map((c) => {
              const owned = inv.owned.includes(c.id);
              const equipped = inv.equipped.character === c.id;
              return (
                <div key={c.id} className={`rounded-2xl p-3 text-center ${preview === c.id ? 'bg-white/15 ring-2 ring-brand' : 'bg-white/5'}`}>
                  <button className="w-full" onClick={() => setPreview(c.id)}>
                    <div className="mx-auto h-12 w-12 rounded-full" style={{ background: `linear-gradient(${c.shirt} 50%, ${c.pants} 50%)` }} />
                    <div className="mt-1 font-bold">{c.name}</div>
                  </button>
                  {equipped ? (
                    <div className="mt-1 text-sm text-good">✓ Running</div>
                  ) : owned ? (
                    <Button size="sm" variant="secondary" className="mt-1" onClick={() => void equip(c.id, 'character')}>Use</Button>
                  ) : (
                    <Button size="sm" className="mt-1" disabled={inv.coins < c.price} onClick={() => void buy(c.id, c.price, 'character')}>🪙 {c.price.toLocaleString()}</Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(tab === 'shoes' || tab === 'boards') && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(tab === 'shoes' ? SHOES : BOARDS).map((it) => {
            const slot = tab === 'shoes' ? 'shoes' : 'board';
            const owned = inv.owned.includes(it.id);
            const equipped = inv.equipped[slot] === it.id;
            return (
              <div key={it.id} className="rounded-2xl bg-white/5 p-3 text-center">
                <div className="mx-auto h-10 w-20 rounded-full ring-2 ring-white/30" style={{ background: it.color === 'transparent' ? 'repeating-linear-gradient(45deg,#334,#334 6px,#445 6px,#445 12px)' : it.color }} />
                <div className="mt-2 font-bold">{it.name}</div>
                {equipped ? <div className="text-sm text-good">✓ Equipped</div> : owned ? (
                  <Button size="sm" variant="secondary" onClick={() => void equip(it.id, slot)}>Use</Button>
                ) : (
                  <Button size="sm" disabled={inv.coins < it.price} onClick={() => void buy(it.id, it.price, slot)}>🪙 {it.price.toLocaleString()}</Button>
                )}
              </div>
            );
          })}
          {tab === 'boards' && (
            <div className="col-span-2 rounded-2xl bg-brand/20 p-3 text-center sm:col-span-4">
              <div className="font-bold">🛹 Hoverboard (one use: absorbs one crash for 30 s)</div>
              <div className="my-1 text-white/70">You have {inv.hoverboards}</div>
              <Button size="sm" disabled={inv.coins < HOVERBOARD_PRICE} onClick={() => void update((i) => ({ ...i, coins: i.coins - HOVERBOARD_PRICE, hoverboards: i.hoverboards + 1 }))}>
                Buy one · 🪙 {HOVERBOARD_PRICE}
              </Button>
            </div>
          )}
        </div>
      )}

      {tab === 'upgrades' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(POWERUPS) as PowerUpType[]).map((t) => {
            const lvl = inv.upgrades[t] ?? 0;
            const price = upgradePrice(lvl);
            const p = POWERUPS[t];
            return (
              <div key={t} className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-3">
                <div>
                  <div className="font-bold">{p.icon} {p.label}</div>
                  <div className="text-sm text-white/60">{p.base + p.perLevel * lvl}s → {p.base + p.perLevel * Math.min(5, lvl + 1)}s</div>
                  <div className="mt-1 flex gap-1">{Array.from({ length: 5 }, (_, i) => <span key={i} className={`h-2 w-6 rounded ${i < lvl ? 'bg-gold' : 'bg-white/20'}`} />)}</div>
                </div>
                {lvl >= 5 ? <span className="text-good">MAX</span> : (
                  <Button size="sm" disabled={inv.coins < price} onClick={() => void update((i) => ({ ...i, coins: i.coins - price, upgrades: { ...i.upgrades, [t]: lvl + 1 } }))}>
                    🪙 {price.toLocaleString()}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
