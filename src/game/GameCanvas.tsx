import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { QUALITY } from '@/config/tuning';
import { useSettings } from '@/store/settingsStore';
import { useProfile } from '@/store/profileStore';
import { useGame } from '@/store/gameStore';
import { BOARDS, SHOES, characterById } from '@/meta/shop';
import { GameLoop } from './loop/GameLoop';
import { SkyLighting } from './entities/SkyLighting';
import { Track } from './entities/Track';
import { Scenery } from './entities/Scenery';
import { Tunnel } from './entities/Tunnel';
import { Props } from './entities/Props';
import { Obstacles } from './entities/Obstacles';
import { Collectibles } from './entities/Collectibles';
import { Gates } from './entities/Gates';
import { Player } from './entities/Player';
import { PostFX } from './entities/PostFX';
import { createRuntime, game } from './runtime';
import { initSpawner } from './systems/SpawnSystem';

/** Fresh hazard-free runtime used behind the menus (attract mode). */
export function resetMenuRuntime() {
  const rt = createRuntime(Date.now() % 100000, 'intermediate');
  initSpawner(rt);
  rt.speed = 5;
  game.rt = rt;
}
resetMenuRuntime();

export function GameCanvas() {
  const quality = useSettings((s) => s.quality);
  const autoTier = useSettings((s) => s.autoTier);
  const tier = quality === 'auto' ? autoTier : quality;
  const q = QUALITY[tier];
  const inv = useProfile((s) => s.inventory);
  const phase = useGame((s) => s.phase);
  const character = characterById(inv?.equipped.character ?? 'aarav');
  const board = BOARDS.find((b) => b.id === inv?.equipped.board)?.color ?? BOARDS[0].color;
  const trail = SHOES.find((b) => b.id === inv?.equipped.shoes)?.color ?? 'transparent';

  return (
    <Canvas
      shadows={q.shadows ? { type: THREE.PCFSoftShadowMap } : false}
      dpr={[1, Math.min(q.dpr, typeof window !== 'undefined' ? window.devicePixelRatio : 1)]}
      camera={{ fov: 60, near: 0.1, far: 1200, position: [0, 3.2, 6.5] }}
      gl={{ antialias: tier === 'low', powerPreference: 'high-performance', stencil: false }}
      frameloop={phase === 'PAUSED' ? 'demand' : 'always'}
      style={{ position: 'fixed', inset: 0, touchAction: 'none' }}
    >
      <GameLoop />
      <SkyLighting shadows={q.shadows} shadowMap={q.shadowMap} />
      <Track shadows={q.shadows} />
      <Scenery shadows={q.shadows && tier === 'high'} />
      <Tunnel shadows={q.shadows} />
      <Props shadows={q.shadows && tier === 'high'} />
      <Obstacles shadows={q.shadows} />
      <Collectibles />
      <Gates />
      <Player key={character.id} character={character} boardColor={board} trailColor={trail} shadows={q.shadows} />
      {tier !== 'low' && <PostFX key={tier} ao={tier === 'high'} bloom />}
    </Canvas>
  );
}
