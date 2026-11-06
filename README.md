# Math Rush 3D

**Run • Solve • Learn • Survive.** A browser 3D endless runner for kids aged 5–14. Maths questions
are part of the steering: three answer gates span the lanes, and you answer by running through the
right one.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 105 tests: generators, adaptive engine, fairness, full-run simulations, persistence
npm run typecheck
npm run lint
npm run build      # static site in dist/ (deploy to Vercel/Netlify as-is)
```

## Controls
| Action | Keyboard | Touch |
|---|---|---|
| Change lane | ← → / A D | swipe left / right |
| Jump | ↑ / W / Space | swipe up |
| Slide / fast-fall | ↓ / S | swipe down |
| Hoverboard | H | 🛹 button |
| Pause | Esc / P | ❚❚ button |
| Debug panel | ` | — |

## What's in the box
- **Intro film**: a skippable ~22 s cinematic rendered live in the game engine.
  - Shots: a dawn crane over the city, an express thundering past, a hero orbit with the question,
    a chase with bullet-time through the right gate, and the title reveal.
  - Includes letterbox, film grain, captions and its own synthesised score.
  - It plays after "Tap to start" and can be replayed from the menu (🎬) or turned off in Settings.
- **Runner**: treadmill world, 3 lanes, jump/slide/fast-fall, buffered input, side-bump stumble vs. front
  crash, trains with walkable roofs + ramps, oncoming trains with horn and headlights, 16 hand-authored
  40 m chunk patterns, each checked by a fairness validator.
- **Maths engine** (`src/math`, pure TS): 44 micro-skills across 4 bands with prerequisites, a generator
  per skill (levels 1–10), misconception-based distractors (forgot-carry, borrow-reverse,
  table-neighbour, …), visual hints (number line, dot array, groups, fraction bars, % grid, balance), Elo
  rating per skill, Leitner spaced repetition for facts, and a weighted selector (due + weak + new + parent focus).
- **Question timing**: the banner appears `speed × (read + decide + lane change) + safety` metres before
  the gate, scaled by age and prompt length. Numbers show on the gates at 60% of the approach. Gate chunks are calm.
- **Gate types**: choice, compare (< = >), number line, estimation, missing number. There are also maths orbs
  (purple coins) and a Challenge Tunnel every 500 m (3 gates, slower, chest rewards).
- **Meta**: streak multiplier ×2/×3/×4, hearts with streak refills, 6 power-ups with shop upgrades,
  hoverboard and Revive Keys, XP and levels, 3 seeded daily missions with a daily chest and streak, 12 trophies,
  8 characters, shoe trails and board skins (coins only, cosmetic only).
- **Learning Mode**: 0.6× speed, slow motion before gates, no hearts lost, respawn on a crash.
- **Profiles and the parent area**: up to 4 children, PIN-protected (salted SHA-256) dashboard with stat tiles,
  accuracy and speed charts, topic bars, skill heatmap, weak spots with misconception text, weekly
  insights, session log, and controls for band, Learning Mode, focus topics, daily limit, CSV export,
  print-to-PDF, reset and delete.
- **Data**: IndexedDB via Dexie (profiles, skills, attempts, runs, inventory, missions, achievements).
  Attempts are written in a batched queue, and raw attempts older than 180 days are pruned.
- **Accessibility**: voice read-out (Web Speech), colour-blind palette, easy-read font, reduce motion,
  left-hand mode, ≥ 44 px touch targets, and safe-area insets.
- **Performance**: low/medium/high quality tiers with auto-downgrade, instanced meshes, a shadow map
  that follows the player, auto-pause when the tab is hidden, and an offline service worker in production.
- **CC0 photo assets** from Poly Haven (see `public/assets/CREDITS.md`):
  - HDRI skies per biome, used for both the background and the lighting
  - scanned gravel, concrete, paving, asphalt, snow, brick, sandstone, plaster and metal
  - glTF models of a concrete road barrier, street lamp and bench
  - First load is about 15 MB; anything that fails to load falls back to procedural art.
- **Realistic procedural base**:
  - physically based sky with image-based lighting and filmic tone mapping
  - procedural photo-style textures; metro cars with cabs, glass and bogies
  - a jointed human runner; ambient occlusion and bloom on capable devices
- **Answer boards**: options sit on glass gradient boards over each gate and sharpen from a blur as you approach.
- **Audio**: layered synthesis through a reverb space. It includes wind and rail rumble that follow your speed,
  footsteps on gravel or train roofs, coin bells, a train horn, impacts, and a music loop that ducks while questions are read.

See `docs/SPEC.md` for the design summary and the list of deviations from the build guide.
