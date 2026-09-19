# Snake Neon Circuit

A polished, framework-free take on retro Snake — built to feel finished, not just to work.

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
![Dependencies: none](https://img.shields.io/badge/dependencies-none-black.svg)
![Vanilla JS](https://img.shields.io/badge/vanilla-HTML%20%2F%20CSS%20%2F%20JS-black.svg)

## About

Snake is a solved problem, so the interesting part is everything around it: input that feels immediate, timing that stays honest across refresh rates, a deliberate visual identity, and an interface that works as well on a phone as on a desktop.

The guiding standard for this project is that functional does not mean finished. Every user-facing change gets a dedicated refinement pass before it counts as done.

## Status

**Playable.** The core game is implemented and verified: start, eat, grow, die, and restart, all without a page reload.

What exists is the core and its interface floor — not the finished presentation. The Neon Circuit visual identity, touch controls, audio, and score persistence are deliberately deferred to later work, and nothing here is stubbed or half-built in anticipation of them.

## Play it locally

There is nothing to install — no dependencies, no bundler, no build step. You need a browser and any way to serve a folder over HTTP.

**You cannot open `index.html` by double-clicking it.** The game is built from ES modules, and browsers block module loading over `file://` for security reasons. Opened directly, the page renders its shell but the game never starts, and the console reports a module/CORS error. It has to be served.

```bash
git clone https://github.com/Grim3ntrix/snakeneoncircuit.git
cd snakeneoncircuit
```

Now serve that folder over HTTP, using whatever you already have. For example, with Python:

```bash
python -m http.server 8000
```

Then open **http://localhost:8000**.

No particular tool is required — Python is not a dependency of the game, it is just one convenient way to serve files. Pick whichever you already have, and note that the port depends on the tool:

| Tool | Command | Then open |
| --- | --- | --- |
| Python 3 | `python -m http.server 8000` | http://localhost:8000 |
| Node | `npx serve .` | http://localhost:3000 |
| PHP | `php -S localhost:8000` | http://localhost:8000 |
| VS Code | _Live Server_ extension → "Open with Live Server" | http://127.0.0.1:5500 |

Run the command from the repository root, then stop it with `Ctrl+C` when you are done.

## How to play

Eat the food. Do not hit a wall or yourself.

| Action | Keys |
| --- | --- |
| Move | <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> |
| Start | <kbd>Enter</kbd>, <kbd>Space</kbd>, or any direction key |
| Pause / resume | <kbd>P</kbd> or <kbd>Escape</kbd> |
| Play again | <kbd>Enter</kbd>, <kbd>Space</kbd>, or any direction key |

Pressing a direction key to start also steers — press <kbd>↑</kbd> on the start screen and the snake sets off upward.

### The rules, exactly

- The board is **24 × 24** cells and the snake moves **one cell every 120 ms** — a steady 8⅓ cells per second, at every refresh rate.
- You start at **length 3**, centred, moving right.
- Food is **+1 point** and grows the snake by exactly one cell. Food only ever appears on a free cell.
- **Reversing into your own neck is impossible.** Two inputs arriving within the same tick are queued and applied on consecutive ticks, so a fast <kbd>↑</kbd> then <kbd>←</kbd> works exactly as intended rather than killing you. At most two turns are buffered at once.
- **Following your own tail is legal.** Moving into the cell your tail is vacating this tick is allowed — unless you are growing that tick, in which case the tail does not vacate and the move is fatal. This is the rule most Snake clones get wrong, in both directions.
- Filling the entire board ends the game as a **win**, not a crash.
- Pausing freezes the snake exactly where it is, between ticks. Resuming continues from the same cell with no half-applied move, and turns queued before the pause still apply afterwards.
- Switching tabs auto-pauses. You never come back to a snake that moved — or died — while you were away.

## Project structure

```
index.html          Entry point — shell, HUD, canvas, overlays
css/main.css        Design tokens, layout, overlays
src/config.js       Every tunable value, defined once
src/rng.js          Seeded random number generator
src/state.js        Phases and the initial game state
src/simulation.js   Game rules — no DOM, no canvas, no timers
src/input.js        Keyboard handling
src/renderer.js     Canvas sizing, DPR, drawing
src/main.js         Bootstrap and the frame loop
CLAUDE.md           Engineering, UX, and polish standards for this repo
.claude/            Claude Code workflows (refinement pass skill + /polish command)
docs/tasks/         Specifications for individual pieces of work
LICENSE             MIT
```

## How it works

The modules are split by responsibility, and the boundaries hold rather than being merely intended:

- **`simulation.js`** holds the rules and nothing else. It contains no DOM, canvas, or timing reference at all, so the same module runs headlessly under Node as well as in the browser — which is how the collision rules can be exercised exhaustively, without a browser in the loop.
- **`main.js`** owns a fixed-timestep accumulator over `requestAnimationFrame`. Gameplay advances in exact 120 ms steps regardless of frame rate, with a delta clamp so a stall or a resumed tab cannot discharge a burst of ticks and drive the snake into a wall.
- **`input.js`** is the only place that listens for keys. It translates a key into an intent and hands it on; whether a turn is *legal* is decided against the simulation's queue, not here.
- **`renderer.js`** knows the board is 24 cells square and nothing else about the game. It never reads the score or the phase. Replacing it wholesale is the intended way to redesign the visuals.

The game is deterministic: the same seed and the same input sequence reproduce the same run, exactly. The arena and grid are drawn once into an offscreen canvas and reused, so the per-frame path allocates nothing.

## Tech

- HTML, CSS, and JavaScript (ES modules)
- Canvas 2D for rendering
- No frameworks, no bundler, no build step, no dependencies

Browser-native capability is preferred over adding a library. Dependencies are treated as a cost that has to be justified. Any current evergreen browser works — the game uses ES modules, Canvas 2D, `ResizeObserver`, and CSS custom properties.

The canvas is sized to whole device pixels and matches the display's device pixel ratio, so the board stays sharp at 1×, 2×, and 3× rather than being resampled.

## Development

Engineering, gameplay, UI/UX, and visual standards live in [CLAUDE.md](CLAUDE.md). It is written as instructions for Claude Code, but it doubles as the contribution guide — the expectations are the same for humans.

The short version: keep it vanilla, keep it simple, separate simulation from rendering, verify in a real browser, and refine before declaring anything complete.

## Roadmap

Indicative, not a specification.

- [x] Core gameplay: fixed-timestep simulation, deterministic movement, exact collision
- [x] Accessibility floor: keyboard operation, WCAG AA contrast, reduced motion
- [x] Responsive layout from 320px to large desktop, sharp at any device pixel ratio
- [ ] Visual identity and interface
- [ ] Touch controls
- [ ] Score persistence and statistics
- [ ] Audio and richer feedback

## License

[MIT](LICENSE) © 2026 Richard Samberi
