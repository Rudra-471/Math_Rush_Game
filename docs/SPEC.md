# Math Rush 3D: design summary (from Build Guide v2.0)

The full guide is `Math_Rush_3D_Build_Guide.pdf` (33 pages). This file maps each section to the code.

| Guide section | Where it lives |
|---|---|
| 5 Architecture (two worlds, state machine) | `src/game/runtime.ts`, `src/game/loop/*`, `src/store/gameStore.ts` |
| 6.1–6.2 World, speed curve | `src/config/tuning.ts`, `src/game/systems/timing.ts` |
| 6.3 Player controller | `src/game/systems/PlayerSystem.ts` |
| 6.4 Collision (AABB) | `src/game/systems/CollisionSystem.ts` |
| 6.5 Chunks + fairness | `src/game/world/chunks.ts`, `fairness.ts`, `systems/SpawnSystem.ts` |
| 6.7 Camera | `src/game/loop/GameLoop.tsx` |
| 6.8 Lives & run end | `CollisionSystem.ts`, `GateSystem.ts`, `step.ts` |
| 7.1 Skill graph | `src/math/skills.ts` |
| 7.2 Question model | `src/math/types.ts` |
| 7.3 Generators | `src/math/generators/*` |
| 7.4 Distractors | `src/math/distractors.ts`, `src/math/build.ts` |
| 7.5 Hints | `src/math/explain.ts`, `src/ui/components/HintVisual.tsx` |
| 7.6 Question timing | `src/game/systems/timing.ts`, `GateSystem.ts` |
| 7.7–7.8 Adaptive (Elo, Leitner, selector) | `src/math/adaptive/*` |
| 7.9 Rhythm | `RHYTHM` in tuning + `SpawnSystem.ts` |
| 8 Gameplay mechanics (gates, orbs, tunnels) | `GateSystem.ts`, `SpawnSystem.ts` |
| 9 Power-ups, obstacles, scoring, economy | `PowerUpSystem.ts`, `tuning.ts`, `src/meta/shop.ts` |
| 10 XP, missions, achievements, characters | `src/meta/*`, `src/game/runController.ts` |
| 11 Parent dashboard | `src/ui/screens/Parent*.tsx`, `src/meta/insights.ts` |
| 12 Persistence | `src/data/*` |
| 13 Screens & HUD | `src/ui/**` |
| 14 Visuals & audio | `src/game/entities/*`, `src/game/world/Biomes.ts`, `src/audio/*` |
| 15 Performance tiers | `QUALITY` in tuning, `GameCanvas.tsx`, auto-tier in `GameLoop.tsx` |
| 16 Testing | `src/**/__tests__/*` |

## Deviations (deliberate, for a zero-asset, offline-first v1)
- **CC0 assets (guide Phase 6, partial)**: the Poly Haven HDRI skies, PBR scans and three props in `public/assets/` are listed in
  `public/assets/CREDITS.md`, and `src/game/assets/assets.ts` loads them.
  - Core assets load behind the loading screen (with real progress); biome extras stream in afterwards. First load is about 15 MB.
  - Anything missing falls back to the procedural art below.
  - The trains, runner, trees and buildings are still procedural; Poly Haven has no realistic trains or rigged people.
- **Procedural art** (used as the base and as the fallback) aims at a realistic look:
  - physically based sky (`three/examples` Sky) with image-based lighting baked from it via PMREM
  - ACES filmic tone mapping and a soft-shadowed sun that follows the runner
  - canvas-generated textures (`src/game/materials/textures.ts`): ballast, concrete, brick, glass facades, ribbed steel, fabric, bark
  - metro cars with cab, glass and bogies; construction barriers; overhead line masts; a jointed human runner (`src/game/entities/models.ts`, `Player.tsx`)
  - Swapping in CC0 GLBs later only touches the entity components.
- **Post-processing** uses three's own EffectComposer (`PostFX.tsx`): GTAO on high, bloom on medium and high, SMAA. drei and @react-three/postprocessing are not used.
- **Answer gates**: options are written on glass gradient boards as soon as the question exists.
  They start blurred and sharpen to fully readable at the 60% reveal point. The top banner shows only the question.
- **Audio** is layered Web Audio synthesis (`src/audio/synth.ts`) instead of Howler sprites:
  - ambience: wind and rail rumble that follow speed, tunnel reverb, rumble from passing trains
  - footsteps synced to the run cadence
  - modal-synthesis coins and bells, impacts, a two-tone train horn, and a scheduled music loop
- **Animations** use CSS keyframes instead of GSAP.
- **PWA** uses a small hand-written service worker plus a manifest instead of vite-plugin-pwa.
- **Hindi (i18n)**, Boss Train, ghost race, cloud sync and teacher mode are stretch goals and not built yet.
- **Tests** use seeded loops instead of fast-check. The E2E smoke test is a headless Vitest
  simulation that drives the real game loop with a scripted bot, not Playwright.
- The electric barrier, track gaps and signal arms are not built.
- **Biomes**: City Rail, Heritage Line, Snow Pass and Neon Night switch every 2 km. Each has its own sky, sun, fog, facades and decor.
