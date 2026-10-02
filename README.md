# Snake Neon Circuit

A polished, framework-free take on retro Snake — built to feel finished, not just to work.

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
![Dependencies: none](https://img.shields.io/badge/dependencies-none-black.svg)
![Vanilla JS](https://img.shields.io/badge/vanilla-HTML%20%2F%20CSS%20%2F%20JS-black.svg)

## About

Snake is a solved problem, so the interesting part is everything around it: input that feels immediate, timing that stays honest across refresh rates, a deliberate visual identity, and an interface that works as well on a phone as on a desktop.

The guiding standard for this project is that functional does not mean finished. Every user-facing change gets a dedicated refinement pass before it counts as done.

## Status

**Playable, and finished to a deliberate visual identity.** The core game is implemented and verified: start, eat, grow, die, and restart, all without a page reload.

The board is drawn as a printed circuit — substrate, a two-tier grid, corner fiducials. The snake is a single trace carrying a signal that attenuates from the head to the tail, which is both the identity and a gameplay aid: it tells you which way you are travelling without your having to find the head. The head is the pad at the front of that trace: a rounded square carrying two dark eyes set across the direction of travel, so it looks where it is going. The pair swings to the new leading edge on every turn, widens when the snake eats, and closes to two slits when it dies; the body is drawn from rounded segments to match, so the head and the trace read as one family. Food is the only lit element on the board. The reasoning behind the palette and the form is in [the identity spec](docs/tasks/002-neon-circuit-identity.md), and the face — which revises it, and explains why the eyes are dark rather than white — in [its own record](docs/decisions/003-snake-head.md).

It is playable on a phone with no keyboard at all. A four-way pad, a pause control, and a sound control appear whenever the device's primary pointer is coarse, and the overlay copy swaps with them — naming the pad rather than a key the device does not have. The two controls stack beside the pad rather than sitting on its row, 32px clear of it, so a thumb that overshoots the pad cannot reach one by accident. Nothing is detected at runtime and there is nothing to configure: the capability question is one CSS already answers, so the controls are shown by `@media (pointer: coarse)` and by nothing else.

Your best score is kept on the device and reported on the start screen, so there is something to beat the moment you arrive — and the game-over screen tells you how the run you just finished stands against it. The record lives under a single versioned `localStorage` key and is validated in full on read: a key that is absent, unreadable, or written by some future version reads as a first visit rather than as a partly-correct screen, and the game plays identically whether or not storage works at all.

The game-over screen also counts your attempts. Those deliberately are not part of the record: they count the session you are in, so closing the tab loses them and the next session starts again at one.

It makes a noise, and it moves. The four moments that matter — eating, dying, clearing the board, and beating your record — each get a synthesised sound and an effect on the board drawn from the circuit's own vocabulary: the eaten node's glow leaving it, and a wavefront that runs the trace when the run ends. There are no audio files. Four oscillators are smaller than one `.mp3`, and an asset pipeline is a build step wearing a different hat.

Under a run there is music as well, and it is neither a loop nor a file. Three short figures are synthesised over one shared clock at lengths of **4, 16, and 11 steps**; the last two are coprime, so the bed takes 176 steps — about half a minute — to return to where it started, which is longer than most runs, and it can therefore be heard as music rather than as a loop. It opens as a low pulse and a figure, gains a counter-figure an octave up once the snake passes **length 12**, and accelerates from a step every 300 ms at the starting length to one every 150 ms by length 40. The player hears their own progress, which is the whole point of tying it to the snake. It starts with the run and stops with it — the menus stay quiet — and it ducks under the four voices, because an eat blip fires up to 8⅓ times a second and has to stay the loudest thing in the game.

Both sound and music are on until you say otherwise, and both stay that way. <kbd>M</kbd> is the master switch and silences everything; a **Sound** button does the same on a phone. <kbd>N</kbd> toggles the bed alone, and so does a **Music** button on each overlay. Both choices are remembered along with your record, and both controls report their own state, because silence is the one thing that cannot also be the acknowledgement that it happened.

The music control sits on the overlays rather than in the touch row, and that is a measurement rather than a preference: at 320px that row is 296px, and the pad, the two controls stacked beside it, and the 32px between them already account for 236 of it. The 60px left over is short of the 72px a third control would need beside the stack, and a third *in* the stack would make it taller than the pad — after which the pad is no longer what sizes the row, and the board starts paying for a button.

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

| Action | Keys | Touch |
| --- | --- | --- |
| Move | <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | The direction pad |
| Start | <kbd>Enter</kbd>, <kbd>Space</kbd>, or any direction key | Tap any direction on the pad |
| Pause / resume | <kbd>P</kbd> or <kbd>Escape</kbd> | Tap **Pause** |
| Mute / unmute | <kbd>M</kbd> | Tap **Sound** |
| Music on / off | <kbd>N</kbd> | Tap **Music** on an overlay |
| Play again | <kbd>Enter</kbd>, <kbd>Space</kbd>, or any direction key | Tap any direction on the pad |

Pressing a direction key to start also steers — press <kbd>↑</kbd> on the start screen and the snake sets off upward. The pad behaves identically: it sits below the board in portrait and beside it in landscape, and tapping a direction starts the game in that direction.

### The rules, exactly

- The board is **24 × 24** cells and the snake moves **one cell every 120 ms** — a steady 8⅓ cells per second, at every refresh rate.
- You start at **length 3**, centred, moving right.
- Food is **+1 point** and grows the snake by exactly one cell. Food only ever appears on a free cell.
- **Reversing into your own neck is impossible.** Two inputs arriving within the same tick are queued and applied on consecutive ticks, so a fast <kbd>↑</kbd> then <kbd>←</kbd> works exactly as intended rather than killing you. At most two turns are buffered at once.
- **Following your own tail is legal.** Moving into the cell your tail is vacating this tick is allowed — unless you are growing that tick, in which case the tail does not vacate and the move is fatal. This is the rule most Snake clones get wrong, in both directions.
- Filling the entire board ends the game as a **win**, not a crash.
- Pausing freezes the snake exactly where it is, between ticks. Resuming continues from the same cell with no half-applied move, and turns queued before the pause still apply afterwards.
- Switching tabs auto-pauses. You never come back to a snake that moved — or died — while you were away.
- Your best score is stored in this browser. Nothing is sent anywhere and there is no account, so clearing site data clears the record with it. Your attempt count is not stored at all — it counts the session you are in and resets when you close the tab.
- Your sound and music settings are stored the same way and under their own key, so a corrupt record cannot take them down with it — and a stored setting that does not validate is discarded whole for the default rather than read back as a half-correct one.

## Project structure

```
index.html          Entry point — shell, HUD, canvas, overlays
css/main.css        Design tokens, layout, overlays
src/config.js       Every tunable value, defined once
src/rng.js          Seeded random number generator
src/state.js        Phases and the initial game state
src/simulation.js   Game rules — no DOM, no canvas, no timers
src/effects.js      The event timeline — what just happened, and how far through
src/input.js        Keyboard and touch input
src/renderer.js     Canvas sizing, DPR, drawing
src/audio.js        The synthesised voices, and the bed under a run
src/storage.js      The saved record and settings — read, validated, written
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
- **`input.js`** is the only place that listens for input, from any device. A keypress and a tap on the pad become the same intent by the same path, so touch cannot quietly lose a guarantee the keyboard has; whether a turn is *legal* is decided against the simulation's queue, not here.
- **`renderer.js`** knows the board is 24 cells square and nothing else about the game. It never reads the score or the phase. It is *told* which events happened, through the same preallocated timeline the rest of the frame uses, because an effect the player can see is the one thing here that involves time. Replacing it wholesale is still the intended way to redesign the visuals.
- **`effects.js`** holds what just happened and how far through being shown it is. It is arithmetic over a fixed array of slots allocated at construction, with no DOM, no canvas, and no Web Audio — so like the rules, it runs headlessly and is exercised without a browser in the loop. Nothing in it is ever read back by the simulation, which is what keeps the run deterministic.
- **`audio.js`** owns one `AudioContext`, four oscillator voices, and the generative bed that runs underneath a game. It builds that context lazily, inside the gesture that starts a game, because a context created anywhere else is created outside a user gesture — which leaves it suspended and puts a warning in the console. The bed is scheduled from the frame loop's own tick, a lookahead ahead of the audio clock rather than on it, so there is no second timer to keep in step with the first. A step that has fallen behind that clock is moved up to it rather than caught up, which is the same rule the frame loop's delta clamp follows and for the same reason: a stall should cost one late note, not a burst of them.
- **`storage.js`** is the only module that touches `localStorage`, and it guards every access to it — including the property read itself, because Safari's private mode throws on `window.localStorage` rather than on its methods. The record is read once at startup and replaced wholesale thereafter, and a record that fails validation is discarded whole for the defaults rather than salvaged field by field, so a half-readable record can never become a half-correct screen.

The game is deterministic: the same seed and the same input sequence reproduce the same run, exactly. The arena and grid are drawn once into an offscreen canvas and reused, so the per-frame path allocates nothing.

The palette is declared once, in `css/main.css`, and read into the renderer at startup, so the canvas and the interface chrome cannot drift apart. Contrast is measured rather than eyeballed, and where two board elements sit close in luminance — the head against the body, the food against the body — shape and size carry the distinction, so the game stays readable without colour.

## Tech

- HTML, CSS, and JavaScript (ES modules)
- Canvas 2D for rendering
- No frameworks, no bundler, no build step, no dependencies

Browser-native capability is preferred over adding a library. Dependencies are treated as a cost that has to be justified. Any current evergreen browser works — the game uses ES modules, Canvas 2D, `ResizeObserver`, `localStorage`, Web Audio, CSS custom properties, and `env()` safe-area insets. Where a browser does not have one of these, it is a branch rather than an error: without Web Audio the game is simply silent, and without `localStorage` it simply forgets.

The canvas is sized to whole device pixels and matches the display's device pixel ratio, so the board stays sharp at 1×, 2×, and 3× rather than being resampled.

## Development

Engineering, gameplay, UI/UX, and visual standards live in [CLAUDE.md](CLAUDE.md). It is written as instructions for Claude Code, but it doubles as the contribution guide — the expectations are the same for humans.

The short version: keep it vanilla, keep it simple, separate simulation from rendering, verify in a real browser, and refine before declaring anything complete.

## Roadmap

Indicative, not a specification.

- [x] Core gameplay: fixed-timestep simulation, deterministic movement, exact collision
- [x] Accessibility floor: keyboard operation, WCAG AA contrast, reduced motion, 44px touch targets
- [x] Responsive layout from 320px to large desktop, sharp at any device pixel ratio
- [x] Visual identity and interface
- [x] Touch controls: a four-way pad and a pause control, gated by pointer capability
- [x] Score persistence: your best score, kept on the device
- [x] Audio and richer feedback
- [x] Background music: a generative bed that grows with the snake
- [ ] Final polish

## License

[MIT](LICENSE) © 2026 Richard Samberi
