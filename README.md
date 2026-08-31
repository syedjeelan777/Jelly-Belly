# 🍮 STICKYVERSE

**A sticky, squishy grid-puzzle game for the browser.** Move a cute jelly hero, push and pull seven kinds of jellies, glue them to switches and machines, dodge fire, spikes, lasers and crushers — and solve 60 handcrafted puzzles across six worlds.

STICKYVERSE is an **original game**: original characters, art (procedurally drawn on Canvas), music and sound effects (synthesized live with Web Audio), and original level designs. It takes only broad inspiration from classic grid/jelly puzzle games.

![STICKYVERSE banner](public/favicon.svg)

---

## ✨ Features

- **60 handcrafted levels** across 6 worlds (tutorial → advanced), each validated as solvable by an automatic BFS solver (`npm run verify`)
- **7 jelly types** — Normal, Sticky, Bouncy, Heavy, Elastic, Slippery, Magnetic — with distinct movement rules
- **Sticking & deformation** — sticky jellies follow you, elastic jellies stretch, slippery jellies slide, bouncy jellies hop
- **Machines** — pressure plates, toggle switches, doors, magnets, moving crushers
- **Hazards** — fire, spikes, pulsing lasers, water
- **Flexible objectives** — reach the exit, fill jelly pads, or both
- **Deterministic grid physics** — no randomness; every move is reproducible
- **Undo (multi-step, configurable limit) & instant restart** (R) with optional confirmation
- **Star ratings** (level-specific par thresholds), best moves & best time per level
- **Level complete screen** with animated stars, replay, next-level and level select
- **Auto-save** — progress, stars, statistics, settings, custom levels (versioned, corruption-safe localStorage)
- **Settings** — master/music/SFX volumes, move counter, restart confirmation, screen shake, reduced motion, tutorial tips
- **Pause menu** (Esc), **fullscreen**, **gamepad support**
- **Touch controls** — big virtual D-pad, no page scrolling, one-handed friendly
- **In-game Level Editor** — paint, resize, test, save, export/import JSON
- **My Levels** — play, edit, duplicate, delete, export custom levels (no account needed)
- **Statistics screen** — levels, moves, stars, play time and more
- **Responsive** — desktop, tablet, mobile (iOS Safari / Android Chrome)
- **Accessible** — keyboard navigation, focus states, reduced-motion mode, audio controls, non-color-only info
- **Graceful error handling** — no crash if storage is unavailable, save data is corrupt, audio is blocked or fullscreen fails
- **Original synthesized audio** — menu/gameplay/victory music + 20+ SFX, zero copyrighted assets

## 🖼 Screenshots

| Main menu | Gameplay | Level editor |
| --- | --- | --- |
| _Add screenshot here_ | _Add screenshot here_ | _Add screenshot here_ |

Screenshots are not checked into the repository. Capture them in a browser while playing (e.g. `npm run dev`, then screenshot), and place them here with relative links.

## 🧰 Technology Stack

- **React 18 + TypeScript 5** — UI and screens
- **Vite 5** — build & dev server
- **Zustand 4** — global store (only state library; no extra deps)
- **Custom Canvas 2D engine** — deterministic grid simulation + squash/stretch rendering + particles
- **Web Audio API** — all music/SFX generated in code (no audio assets)
- **localStorage** — versioned save system (data layer isolated so a backend can be added later)

Why a custom engine instead of Phaser? The game is a deterministic sokoban-style grid puzzle — no free physics needed. A small, typed, pure-logic simulator gives perfect undo/replay, predictable mechanics and tiny bundle; Canvas 2D handles the visuals with full control over squash & stretch.

## 🚀 Getting Started

Requires **Node 18+**.

```bash
npm install
npm run dev          # dev server → http://localhost:5173
```

### Build & preview

```bash
npm run build        # type-check + production build → dist/
npm run preview      # serve the production build locally
```

### Level QA

```bash
npm run verify       # validates all 60 levels and BFS-solves each one
```

`verify` reports shape errors, unsolvable levels and optimal move counts — run it before shipping level changes.

## 🌐 Deployment

The production build is a static site and works anywhere:

- **Vercel** — import the repo; preset “Vite”. `vercel.json` is included for SPA rewrites.
- **Netlify** — build command `npm run build`, publish dir `dist`. `netlify.toml` is included.
- **GitHub Pages** — build with the repo-name base, then publish `dist/`:

  ```bash
  VITE_BASE=/jelly-belly/ npm run build
  # then: Settings → Pages → deploy from a branch, or use actions/upload-pages-artifact
  ```

No paid services required.

## 🛠 Developer tools

- **`npm run verify`** — BFS-solves all 60 levels and validates every map (exits nonzero on failure).
- **`npm run smoke` / `npm run smoke:ui`** — headless controller + React UI smoke suites (happy-dom).
- **Dev overlay** — press `F3` in-game (dev builds or `?debug` in the URL) to show a grid/collision/id debug canvas, FPS meter, and shortcuts: skip level, reload, reset save.

## 🎮 Controls

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | `WASD` / `↑↓←→` | D-pad / left stick | D-pad |
| Undo | `Z` | X / Y buttons | Undo button |
| Restart | `R` | B button | Restart button |
| Pause | `Esc` | Start / Select | Pause button |
| Confirm | `Enter` (menus) | A button | tap |
| Back | `Esc` (menus) | B button | ← button |

Hold a direction to keep moving (repeat is rate-limited; key-repeat events are ignored).

## 🧩 Level Creation

Levels are plain data (`src/game/levels/index.ts`). Each level is:

```ts
{
  id: 'w1-01',            // unique id
  world: 1, index: 1,     // placement
  name: 'First Steps',
  map: [                  // ASCII rows (equal width)
    '#########',
    '#.P.....#',
    '#......G#',
    '#########',
  ],
  mechanics: ['movement'],
  par: 9,                 // 3-star move threshold
  tip: 'Use WASD or…',    // optional tutorial banner
}
```

Tile legend: `#` wall · `.` empty · `P` player · `G` exit · `g` jelly pad · `W` water · `F` fire · `^` spikes · `Z` laser emitter · `D` door · `O` pressure plate · `T` toggle switch · `X` magnet · `J/K/B/H/E/L/M` jelly types.

Timed objects (laser beams, crushers, big magnets) are configured in `objects:` with `axis`, `cells`, `period`, `phase` (see `src/game/engine/types.ts`).

Adding a level is just adding data — the engine, solver, UI and save system pick it up automatically. You can also build levels in-game (**Menu → My Levels → New Level**) and export them as JSON.

## 🗂 Architecture

```
src/
├── App.tsx · main.tsx · styles.css
├── components/        # UI primitives (buttons, modals, sliders, D-pad…)
├── screens/           # MainMenu, World/LevelSelect, Game, Settings, Editor…
├── store/             # zustand store + save wiring
├── data/              # localStorage save layer (backend-ready)
└── game/
    ├── engine/        # types · level parser · pure simulator (logic.ts)
    ├── levels/        # 60-level catalogue + world metadata + legend
    ├── controller.ts  # game loop, undo history, input queue, particles
    ├── render/        # Canvas renderer (squash & stretch, particles)
    ├── audio/         # WebAudio synthesis (music + SFX)
    └── input/         # keyboard/gamepad input manager
scripts/
├── verify-levels.ts   # validation + BFS solvability QA
├── smoke-controller.ts # headless gameplay smoke tests
└── smoke-ui.tsx       # headless UI smoke tests
```

The **engine is pure and deterministic** (no DOM, no timing). The controller adds timing/animation; the renderer only draws state; screens only drive the controller. Undo stores full snapshots (configurable, 300 steps) so wiring, doors, hazards and time all rewind correctly.

## 💾 Save System

Versioned JSON in `localStorage` (`stickyverse.save.v1`):

```json
{
  "version": 1,
  "progress": { "w1-01": { "completed": true, "stars": 3, "bestMoves": 7, "bestTime": 5231 } },
  "worlds": { "1": { "completed": true } },
  "settings": { "masterVolume": 0.8, "musicVolume": 0.55, "sfxVolume": 0.8 },
  "statistics": { "levelsCompleted": 1, "totalMoves": 7, "starsEarned": 3 },
  "customLevels": {},
  "lastLevelId": "w1-02",
  "unlockedWorlds": [1, 2]
}
```

- Corrupted / missing data falls back to defaults automatically.
- If `localStorage` is unavailable (private mode), the game still runs with session-only saves and shows a notice in Settings.

## 🧪 Testing

- `npm run verify` — shape-check + exhaustive solvability proof for all 60 levels
- `npm run smoke` (controller) — replay a solved level through the real game shell; verifies completion, undo, restart, death
- `npm run smoke:ui` — mounts the app headless and walks every screen

## 📄 License

MIT — see `LICENSE`. (Add your name below if you publish.)

## 👏 Credits

Built with React, TypeScript, Vite and a custom Canvas engine. All art, music and sounds are original and generated at runtime — no third-party assets.
