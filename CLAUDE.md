# Math Rush 3D – project rules for Claude Code

## What this is
A browser 3D endless runner for kids 5–14 where answering maths questions by choosing a lane is
part of the core gameplay. Full design: docs/SPEC.md (summary of the v2.0 build guide PDF).
Game first, learning second. Never build a quiz app with a runner attached.

## Stack
TypeScript (strict), Vite, React 19, three.js, @react-three/fiber, zustand, mitt, Dexie, Recharts,
Tailwind 4, Vitest, fake-indexeddb, @fontsource/fredoka.
Not used yet (see docs/SPEC.md "Deviations"): drei, postprocessing, GSAP, Howler, react-i18next,
vite-plugin-pwa, Playwright.

## Architecture rules
- src/math/** is PURE TypeScript: no three.js, no React, no DOM. Seeded RNG only.
- Per-frame game logic lives in systems ticked by ONE useFrame in src/game/loop/GameLoop.tsx
  (via `stepGame` in src/game/loop/step.ts). Render components only copy runtime state into meshes.
- NEVER call React setState inside useFrame. Mutate `game.rt`; publish coarse values to zustand
  at most every 100 ms or on change.
- No allocations inside useFrame (reuse Object3D/Vector3/Color).
- Systems communicate via the typed event bus in src/events/bus.ts.
- All tunable numbers go in src/config/tuning.ts (speed, timings, rewards).
- Collision is custom lane-based AABB. Do not add Rapier unless asked.
- Use InstancedMesh for coins, obstacles and repeated props.
- Placeholder art = procedural meshes with the same names/scales as future GLBs.

## Coding standards
- Small files (< 300 lines). Named exports. No `any`.
- Every math generator has property tests (exactly one correct choice, unique choices, ranges).
  Every chunk pattern must pass the fairness validator. Run `npm test` before saying a task is done.
- `npm run typecheck` and `npm run lint` must pass.
- Kid-safe: no ads, no external network calls, no personal data beyond a first name.

## Workflow
- Before coding a phase, write a short plan and list files you will create.
- After coding, run tests + typecheck, then summarise what changed and how to try it.
- Ask before adding a new dependency not listed above.
- Dev builds expose `window.__mr = { game, useGame }` for debugging; press ` for the debug panel.
