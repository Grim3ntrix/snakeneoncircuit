# Task 001 — Playable Core

**Status:** Ready for implementation
**Depends on:** `docs/tasks/scaffolding.md` (complete)
**Followed by:** 002 visual identity, 003 HUD/screens, 004 game feel & audio, 005 advanced collectibles, 006 circuit events, 007 mobile, 008 accessibility, 009 persistence & statistics, 010 final polish

---

## Objective

Build the technically sound, playable foundation of **SNAKE // NEON CIRCUIT**: open the project in a browser, play a complete game of Snake from start through game over to restart.

This is a **vertical foundation slice**, not the finished game. It delivers correct simulation, a trustworthy game loop, and a restrained visual foundation — deliberately not the Neon Circuit art direction.

The measure of success is not "the snake moves." It is that the architecture is a solid foundation a polished game can be built on without rewriting movement, collision, or the game loop.

---

## Deliverables

Only these files are created by this task. No others.

```
index.html              Entry point — DOM structure, module bootstrap
css/main.css            Design tokens + layout + HUD/overlay styling
src/config.js           Logical grid, timing, scoring, key map
src/rng.js              Seeded PRNG
src/state.js            State shape, phases, createInitialState()
src/simulation.js       Pure step logic — movement, collision, eating, scoring
src/input.js            Keyboard → validated direction queue
src/renderer.js         Canvas sizing (DPR/resize) + all drawing
src/main.js             Bootstrap + fixed-timestep loop + wiring
```

Seven JS modules. Each has one responsibility. This is the smallest structure that keeps simulation, presentation, and input genuinely separate — the property later phases depend on. Do not add further modules in this task; do not merge these into a single script.

Zero dependencies. Zero build step. Native ES modules via `<script type="module">`.

---

## Architecture

### Responsibilities

| Module | Owns | Must never |
| --- | --- | --- |
| `config.js` | Constants: grid size, tick rate, scoring, start conditions, key map | Hold mutable state |
| `rng.js` | `createRng(seed)` → deterministic `() => [0,1)` | Touch the DOM |
| `state.js` | Phase constants, state shape, `createInitialState({seed})` | Contain game rules |
| `simulation.js` | `step(state)`, mutation of state for one tick: move, collide, eat, score, die | Touch the DOM, canvas, or `requestAnimationFrame` |
| `input.js` | Key listeners, direction queue, queue validation | Know about rendering or timing |
| `renderer.js` | Canvas sizing, DPR, resize handling, all drawing | Contain or infer game rules; read mutable game state it was not handed |
| `main.js` | Bootstrap, the rAF loop, fixed-step accumulator, wiring modules together | Contain game rules or drawing code |

### The one architectural invariant

> **The simulation must not depend on the rendering.**

`simulation.js` operates exclusively on grid cells. It must never see a pixel, a canvas, a CSS value, or a device pixel ratio. A future visual redesign — glow, particles, CRT, circuit traces — must be able to replace `renderer.js` entirely without touching a line of movement or collision logic.

The second invariant follows from it: **statistics persistence must be addable without coupling into the simulation.** `step()` returns what happened (did the snake eat, did it die, and why); whoever calls it decides what to do with that fact. No storage or analytics calls inside simulation code.

### Data flow

```
keydown ──> input.js ──> direction queue (validated)
                              │
main.js rAF loop ─────────────┤
   │                          │
   │ accumulates fixed ticks  │
   ▼                          ▼
simulation.step(state) ◄──── consumes one queued direction
   │
   │ mutates state (grid cells, score, phase)
   ▼
renderer.draw(ctx, state, view)   ← reads state, writes pixels only
```

One direction of dependency: `main` → `simulation` → `state`; `main` → `renderer` → `state` (read-only). `input` → `state` (read phase only). No cycles.

---

## Core data model

The entire game state is plain data. No classes, no methods on entities.

```js
// state.js — shape only; exact construction is the implementer's choice
{
  phase: 'ready' | 'playing' | 'paused' | 'over',
  cells: [{ x, y }, ...],   // index 0 is the HEAD; last element is the tail
  direction: { x, y },      // direction the snake last moved
  pending: [{ x, y }, ...], // validated direction queue, max 2
  food: { x, y } | null,
  score: 0,
  seed: 123456789,          // RNG seed for this run
  rng: () => number,        // bound to seed
  over: null | { reason: 'wall' | 'self' | 'win' }
}
```

Snake body as a plain array of grid cells, head first. Food as a single cell. Score as a number. This shape is what makes the simulation trivially testable later — `step()` is a pure-ish function from state to state.

`createInitialState({ seed })` is the **only** way a game begins. Restart calls it again. See "Restart" below for why that matters.

---

## Constants

All in `config.js`. No magic numbers duplicated across files.

| Constant | Value | Notes |
| --- | --- | --- |
| `COLS`, `ROWS` | `24`, `24` | Square board; fits portrait and landscape |
| `START_LENGTH` | `3` | Head plus two body cells |
| `START_DIRECTION` | `{x: 1, y: 0}` | Rightward |
| `START_HEAD` | `{x: floor(COLS/2), y: floor(ROWS/2)}` | Body extends left of head |
| `TICK_MS` | `120` | ~8.3 cells/sec. Constant in 001 |
| `SCORE_PER_FOOD` | `1` | Tunable |
| `MAX_QUEUED_INPUTS` | `2` | Bounds the queue |
| `MAX_FRAME_MS` | `250` | Accumulator clamp |

Speed progression is deliberately **not** in 001 — `TICK_MS` is constant for the whole run.

---

## Simulation rules

These rules are normative. The edge cases are the ones that produce classic Snake bugs; implement them exactly.

### Movement (per tick)

1. If `pending` is non-empty, shift the first direction into `direction`.
2. `next = { x: head.x + direction.x, y: head.y + direction.y }`.

### Death by wall

If `next` lies outside `0..COLS-1` / `0..ROWS-1`: phase → `over`, `reason: 'wall'`. Do not move the snake. Stop simulating.

### Death by self-collision — the subtle rule

Determine the cells the snake still occupies after the move, **excluding the new head**:

- If `next` equals `food` (**growing**): the tail does **not** vacate this tick. Occupied set = all of `cells`.
- Otherwise: the tail **does** vacate this tick. Occupied set = `cells` minus the last element.

If `next` is in that set → phase → `over`, `reason: 'self'`.

This is the rule that is most often got wrong. Moving into the cell the tail is vacating is **legal** when not growing, and **illegal** when growing. Getting this backwards produces a game that kills the player for a legitimate move, or lets them pass through their own body.

### Eating and growth

If `next` equals `food`:

1. `score += SCORE_PER_FOOD`
2. Unshift `next` onto `cells`. Do **not** pop the tail.
3. Spawn new food (below).

Otherwise: unshift `next`, pop the tail. Length stays constant.

### Food spawning

Order matters: spawn **after** the snake has been updated, never before.

1. Build `free` = every cell in the grid not occupied by `cells`.
2. If `free.length === 0` → the board is full: phase → `over`, `reason: 'win'`. No food is placed.
3. Otherwise `food = free[Math.floor(state.rng() * free.length)]`.

Building the free list rather than retrying random cells until one misses the snake is deliberate: it cannot loop forever, it cannot fail on a nearly-full board, and it costs one pass over 576 cells.

Determinism: `state.rng` is the seeded PRNG from `rng.js`. The default seed is time-derived at new-game time so ordinary play varies, but because the seed is stored in state, any run is reproducible from `(seed, input sequence)`. This satisfies the project's determinism rule without making every game identical — and leaves the door open for fixed-seed or daily-seed modes later.

### Scoring

- Starts at `0`. Reset only by `createInitialState()`.
- `+SCORE_PER_FOOD` per food consumed.
- In memory only. Nothing is written to `localStorage` in this task.

---

## Game loop

`main.js` owns one `requestAnimationFrame` loop using a **fixed-timestep accumulator**. This is what makes gameplay independent of monitor refresh rate.

```
last = performance.now(), acc = 0

frame(now):
  dt = now - last; last = now
  if dt > MAX_FRAME_MS: dt = MAX_FRAME_MS     // clamp — no catch-up burst
  acc += dt
  while acc >= TICK_MS:
    acc -= TICK_MS                            // ALWAYS drain, unconditionally
    if phase === 'playing': step(state)       // but only simulate when playing
  renderer.draw(ctx, state, view)
  requestAnimationFrame(frame)
```

Two details that matter:

- **The accumulator always drains, even when not playing.** If it only drained while `playing`, time would pile up during `ready` and `over` and discharge as a burst of ticks the instant play resumes — the snake would lurch forward several cells on the first frame. Draining unconditionally prevents this.
- **The `dt` clamp** guards against any large `dt` reaching the accumulator. Auto-pause covers the ordinary tab-away case; the clamp is the backstop for a single huge frame arriving by any other route — a stall, a long task, a resumed tab — which would otherwise discharge dozens of ticks at once and drive the snake into a wall.

### Rendering interpolation: deliberately omitted

The renderer draws the snake at its current grid cell, with no interpolation between ticks. This is a deliberate decision, not an omission:

- Grid-snapped movement is the correct feel for classic Snake. Smooth interpolation changes how collision reads to the player and makes near-misses ambiguous.
- It keeps `renderer.js` a pure function of state, with no previous-state tracking.

Whether to interpolate is a **visual decision belonging to the identity phase**, and the architecture above does not preclude adding it later.

### Pause

`paused` is a first-class phase, not a later addition. `CLAUDE.md` names it in the project's state machine, and the loop above already gates simulation on the phase — so it costs one phase constant and a key binding, and no new machinery.

- `P` or `Escape` toggles between `playing` and `paused`. Ignored in `ready` and `over`.
- While `paused`, `step()` does not run. The accumulator still drains, so resuming is instant and cannot burst.
- Resuming never leaves a half-applied tick: pause is only ever entered between ticks.
- Hiding the tab (`visibilitychange` → hidden) auto-pauses when `playing`. This is the explicit, player-friendly form of the tab-away case — the player does not return to a snake already in motion. The `dt` clamp stays as defence in depth against the same class of bug arriving by another route.
- A `paused` overlay is shown, DOM-based like the others.

One edge case: **pausing must not consume or clear the direction queue.** Direction keys are ignored while paused, and any turns queued before the pause still apply on resume.

---

## Input

### Key map

| Action | Keys |
| --- | --- |
| Up | `ArrowUp`, `w`, `W` |
| Down | `ArrowDown`, `s`, `S` |
| Left | `ArrowLeft`, `a`, `A` |
| Right | `ArrowRight`, `d`, `D` |
| Start / Restart | `Enter`, `Space`, and any direction key |
| Pause / Resume | `p`, `P`, `Escape` |

`preventDefault()` on the four arrow keys and on `Space` — they scroll the page otherwise. WASD needs no `preventDefault`.

### Validation — where reversal is actually prevented

The rule: **a new direction is validated against the last direction already in the queue; if the queue is empty, against `state.direction`.**

Validating against `state.direction` alone is the classic bug. Two inputs arriving inside one tick — say the snake is moving right and the player presses Up then Left — are validated against the *stale* current direction, so Left passes as "not a reversal of right," and the snake reverses into itself on the following tick. Validating against the queue's tail closes this: Left is checked against the queued Up, correctly passes, and the two turns apply on consecutive ticks exactly as the player intended.

This is the specific failure described in the acceptance criteria as *"rapid conflicting inputs cannot produce illegal reversal."*

### Queue behavior

- Capped at `MAX_QUEUED_INPUTS` (2). When full, new inputs are dropped.
- No auto-repeat handling needed: repeats merely re-queue a direction already at the queue tail, which validation rejects as a no-op.
- Consumed one per tick, at the start of `step()`.

### Phase-dependent behavior

| Phase | Direction key | Enter / Space | P / Escape |
| --- | --- | --- | --- |
| `ready` | Set initial direction if legal, start playing | Start playing, direction `START_DIRECTION` | Ignored |
| `playing` | Queue direction change | Ignored | → `paused` |
| `paused` | Ignored | Ignored | → `playing` |
| `over` | Start a fresh game | Start a fresh game | Ignored |

Input must never be read outside these paths — no stray `keydown` listeners in `renderer.js` or `main.js`.

---

## Canvas, responsive behavior, and DPR

### Logical vs physical coordinates

**The simulation knows only grid cells.** Rendering is the only place a cell becomes a pixel, via a `cellSize` the renderer computes. Canvas backing-store pixels and CSS pixels are both renderer concerns.

### Sizing

The canvas element is sized **exactly to the board** — `COLS * cellSize` by `ROWS * cellSize` CSS pixels — and centred by CSS. This keeps the renderer's origin at `(0,0)` and avoids all offset math.

On resize:

1. Measure the space available to the board (its container).
2. `cellSize = Math.floor(Math.min(availW / COLS, availH / ROWS))`.
3. Apply a floor (e.g. never below 8px) so the board stays usable.
4. Set CSS size to the board size, set `canvas.width/height` to that × `devicePixelRatio`, and `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` once.

Integer `cellSize` keeps cell edges on pixel boundaries — important for crispness now and for grid-aligned effects later.

### Requirements

- **The logical grid never changes on resize.** Only `cellSize` does. `COLS`/`ROWS` are constants; the board never becomes 20×18 because the window narrowed.
- **`devicePixelRatio` is honoured** on every resize, and re-read on resize so dragging between monitors of different density stays sharp.
- **Resize is observed, not guessed.** Use a `ResizeObserver` on the board container (or a debounced `resize` listener). Re-run the sizing routine; do not re-create the canvas.
- **`visibilitychange` auto-pauses when playing** (see Pause). This must be confirmed working, since it is easy to regress.
- **`blur` does not pause.** Losing window focus without hiding the tab — clicking DevTools, for instance — is not a reason to interrupt play. The `dt` clamp covers it.
- The `dt` clamp stays regardless: it is the backstop for any large `dt` reaching the accumulator, whatever its cause.
- Layout must not shift or scroll horizontally from 320px to large desktop. Use `100dvh` rather than `100vh` for mobile browser chrome.
- The board stays square and centred in both portrait and landscape; on landscape phones it should size to available height.

---

## Rendering

Restrained foundation only. The Neon Circuit identity is a later task; do not attempt it here.

### Layer order

`renderer.draw()` composes in this fixed order. Later tasks insert new layers between these without disturbing them:

```
1. clear
2. arena background
3. grid lines            (subtle; may be omitted if it reads as noise)
4. food
5. snake body
6. snake head
   ── future effects layers insert here ──
```

`draw()` takes `(ctx, state, view)` and returns nothing. It must not mutate `state`. HUD and overlays are DOM, not canvas — see below.

### Legibility requirements

The player must be able to tell these apart at a glance: **arena, snake head, snake body, food, game over, score.**

One requirement beyond simple colour difference: **the head must be distinguishable from the body by more than hue.** Fill the head cell fully and inset the body cells slightly, or equivalent. Colour alone fails for colour-blind players, and this is cheap to do correctly now rather than retrofitting later.

### Performance

`CLAUDE.md` requires frame cost to stay flat across a long session.

- **No per-frame allocation in the draw path.** No objects or arrays built inside `draw()`, no gradients or `Path2D` constructed per cell per frame, no `map`/`filter` producing garbage 60 times a second. Hoist what can be hoisted.
- The context transform is applied on resize, not every frame.
- **No listener growth.** Key, resize, and visibility listeners are registered once at bootstrap and never re-added. Re-adding on every resize is the common way this regresses.
- Bootstrap validates the DOM lookups it depends on (canvas, HUD elements) once, at startup, rather than re-querying or defensively checking them per frame — boundary validation per `CLAUDE.md`, not scattered defensive checks.

### Palette — single source of truth

Palette tokens are declared **once** as CSS custom properties in `:root`, and `renderer.js` reads them at init via `getComputedStyle(document.documentElement).getPropertyValue(...)` into a frozen object.

This is deliberate: it prevents the canvas palette and the CSS chrome palette from drifting apart, which is exactly the duplication `CLAUDE.md` forbids. Because the stylesheet is a `<link>` in `<head>` and the script is a deferred module, CSS is guaranteed parsed before the JS runs — the read is safe at init.

A future theming task re-reads these tokens on theme change. Do not build that now.

---

## HUD and overlays

**The score lives in the DOM, not on the canvas.** This is an architectural decision, not a styling preference:

- It is real text — selectable, scalable, and readable by assistive technology, which canvas text is not.
- HUD polish becomes CSS work in later phases rather than canvas drawing code.
- It keeps `renderer.js` focused on the play field.

Structure: a board wrapper with the canvas, and absolutely-positioned overlays for `ready`, `paused`, and `over`. All overlays are minimal text — explicitly **not** the final design:

- `ready`: the project name and a start prompt.
- `paused`: a paused indicator and a resume prompt.
- `over`: final score and a restart prompt. On `reason: 'win'`, say so rather than showing a bare score — the board being full is a different event from dying.

Fix the low-cost accessibility basics now:

- Score and overlays are DOM text.
- Text meets **WCAG AA contrast** against the board and page background — `CLAUDE.md` requires it, and it is trivial to get right before the palette grows.
- The game-over and pause overlays carry `aria-live="polite"` so state changes are announced.
- Any focusable element has a visible `:focus-visible` style.
- Overlays must not trap pointer events on the canvas when not shown (`pointer-events: none` when hidden).
- Any CSS transition added respects `prefers-reduced-motion`. There is little motion in 001, but the media query and the pattern belong here rather than being retrofitted later.

The full accessibility system is deferred — this is the floor, not the target.

### Feedback

`CLAUDE.md` requires that nothing the player does goes unacknowledged. In 001 the acknowledgement is restrained and non-decorative:

- Score changes are immediately visible.
- Death is unmistakable — the overlay plus the snake stopping.
- Start, pause, and restart each produce an immediate visible change of state.

Richer feedback (screen shake, particles, flashes, audio) belongs to task 004. Do not build it here, but do not leave an action silent either.

---

## State machine

Three phases plus pause, explicit transitions, no boolean soup:

```
                    start input
     ready ────────────────────► playing ◄──────► paused
                                    │           (P / Escape)
                                    │  wall | self | win
                                    ▼
                                  over
                                    │
                                    └── start input ──► playing (fresh state)
```

| From | Event | To | Side effects |
| --- | --- | --- | --- |
| `ready` | direction key | `playing` | Apply direction if legal; reset loop accumulator |
| `ready` | `Enter` / `Space` | `playing` | Direction `START_DIRECTION` |
| `playing` | wall / self collision | `over` | `over.reason` set; stop simulating |
| `playing` | board full | `over` | `over.reason = 'win'` |
| `playing` | `P` / `Escape` | `paused` | Show pause overlay; queue preserved |
| `playing` | tab hidden | `paused` | Auto-pause |
| `paused` | `P` / `Escape` | `playing` | Hide overlay; queued turns still apply |
| `over` | any start input | `playing` | `createInitialState()` — a brand-new state object |

Simulation only runs in `playing`. Rendering runs in all phases.

---

## Restart

Restarting must not require a page reload, and **old state must not leak into the new game**.

The mechanism that guarantees this: restart **replaces the state object wholesale** with `createInitialState({ seed: <new time-derived seed> })`. It does not reset fields on the existing object.

This is the whole point of keeping `createInitialState()` as the single entry point. Field-by-field resetting is where leakage bugs live — a forgotten `pending` queue carries a stale turn into the new run; a forgotten `over` object leaves a death reason set. Whole-object replacement makes leakage structurally impossible rather than a thing to remember.

Confirm on restart: score is `0`, snake is at its start position and length, `pending` is empty, `over` is `null`, food is placed, and a **new** seed is in use.

---

## Deliberately deferred

Not part of 001. Do not build, stub, or scaffold any of these.

### Persistence and global statistics

This is the most important deferral, and it is absolute:

- **`TOTAL PLAYS` — a global "how many have played" counter. Explicitly out of scope.**
- Any global play counter or aggregate statistic
- Server API or API endpoints
- SQLite
- Serverless or hosted database
- Remote persistence of any kind
- Analytics
- Player accounts / authentication / cross-device identity

The only persistence-adjacent thing 001 has is an in-memory score that dies with the page. That is correct for this task. A global counter requires shared server state, which conflicts with the project's no-dependency, no-build-step constraint and would need its own `docs/decisions/` entry when it is eventually considered.

### Advanced gameplay

DATA CELL variations, POWER CORE, DATA FRAGMENT, score multipliers, POWER SURGE, GLITCH ZONE, SYSTEM OVERDRIVE, arena events, difficulty progression beyond the constant `TICK_MS`.

### Final presentation

Polished title screen, animated attract/demo mode, final HUD design, elaborate game-over screen, settings menu, CRT controls, audio settings, full accessibility system, final mobile control system, onboarding/tutorial. **No touch controls in 001** — keyboard only, with responsive *layout* but not responsive *input*.

### Advanced visual effects

Sophisticated glow systems, particles, energy trails, scanlines, CRT distortion, screen noise, chromatic aberration, elaborate circuit animation.

### Audio

All final sound design, music, and Web Audio effects.

---

## Extension points for later tasks

Low-complexity seams 001 leaves open. Do not implement them.

| Future task | Seam already in place |
| --- | --- |
| Neon Circuit identity | Replace `renderer.js` internals; palette already single-sourced in CSS |
| Effects layers | Fixed layer order in `draw()`, with a marked insertion point |
| HUD and screens | HUD already DOM, so it is CSS work |
| Game feel & audio | `step()` reports what happened (ate / died / why) for a caller to react to |
| Advanced collectibles | `food` is one field of state; a collectibles array slots in beside it |
| Difficulty progression | `TICK_MS` is a single constant, currently read once per tick |
| Mobile input | `input.js` is the only module that turns events into direction intents |
| Accessibility | DOM HUD and `aria-live` already established |
| Persistence & statistics | `step()` returns outcomes instead of triggering side effects; nothing to unpick |
| Testing | Pure `step(state)` means logic can be tested without a DOM, whenever tooling is warranted |

---

## Acceptance criteria

Every item is objectively checkable. 001 is not complete until all pass.

### Gameplay

- [ ] Snake moves on a fixed grid, one cell per tick, at a steady rate
- [ ] Snake starts at length 3, centred, moving right
- [ ] Arrow keys change direction; WASD changes direction
- [ ] Immediate 180° reversal is impossible in every input ordering
- [ ] Food spawns only on free cells, never on the snake
- [ ] Eating food increments score by `SCORE_PER_FOOD` and grows the snake by exactly one cell
- [ ] Length is constant when not eating
- [ ] Wall collision ends the game with `reason: 'wall'`
- [ ] Self collision ends the game with `reason: 'self'`
- [ ] Moving into the cell the tail vacates this tick is **legal** when not growing
- [ ] Moving into that same cell **while growing** is **illegal**
- [ ] Game over stops simulation; the snake stops moving
- [ ] Filling the entire board ends the game with `reason: 'win'` rather than hanging or erroring
- [ ] Restart produces a clean game — score `0`, start position, empty queue, no `over` residue

### Timing

- [ ] Snake speed is identical at 60Hz and 144Hz displays
- [ ] Frame-rate drops do not slow or speed up gameplay
- [ ] Hiding the tab mid-game auto-pauses; returning does not advance the snake or kill it
- [ ] Coming back from a long tab-away does not produce a burst of ticks
- [ ] Starting a game from `ready` does not lurch several cells on the first frame

### Pause

- [ ] `P` and `Escape` both toggle pause during play
- [ ] Pause is ignored in `ready` and `over`
- [ ] The snake does not move at all while paused
- [ ] Resuming continues from the exact position, with no half-applied tick
- [ ] Turns queued before a pause still apply after resume
- [ ] Direction keys pressed while paused are ignored, not queued
- [ ] Switching tabs and returning leaves the game paused, not running

### Input

- [ ] Arrow keys and WASD both work
- [ ] Arrow keys and `Space` do not scroll the page
- [ ] Rapid alternating inputs cannot produce an illegal reversal
- [ ] Several inputs inside one tick are applied on consecutive ticks in order, capped at 2
- [ ] Extra inputs beyond the cap are dropped without error or queue growth

### Rendering

- [ ] Snake and food are always aligned to logical grid cells, never offset
- [ ] Canvas is usable and centred at 320px wide, at 1920px, and in phone landscape
- [ ] No horizontal scrolling and no layout shift at any viewport size
- [ ] High-DPI rendering is sharp — no blur, no incorrect scaling
- [ ] Dragging between monitors of different DPR keeps the board sharp
- [ ] Board remains square with the logical grid unchanged across resizes
- [ ] Head, body, food, and arena are each distinguishable, and head differs from body by more than colour
- [ ] Score is legible DOM text, and the game-over state announces its score
- [ ] HUD and overlay text meets WCAG AA contrast against its background
- [ ] CSS transitions are suppressed under `prefers-reduced-motion: reduce`
- [ ] Frame cost stays flat over a long session; no unbounded listener growth
- [ ] No object or array allocation inside the per-frame draw path

### Architecture

- [ ] `simulation.js` contains no DOM, canvas, or timing references
- [ ] `renderer.js` contains no game rules
- [ ] All `keydown` handling exists only in `input.js`
- [ ] `createInitialState()` is the only path to a new game
- [ ] All tunable constants live in `config.js`, duplicated nowhere
- [ ] No framework, no dependency, no build step, no `package.json`
- [ ] No module exceeds roughly 200 lines
- [ ] Replacing `renderer.js` wholesale would not require touching movement or collision

### Browser verification

- [ ] Zero console errors and zero console warnings during a full session
- [ ] No unhandled promise rejections
- [ ] No 404s for any asset

---

## Verification procedure

Zero-build project. ES modules require HTTP — `file://` will not work, and this is expected, not a bug.

```bash
cd <repo root>
python -m http.server 8000
# open http://localhost:8000
```

Then, in the browser:

1. **Console** — clear it, then play a full session. It must stay empty.
2. **Full round, desktop** — start, eat several food items, confirm growth and score.
3. **Death by wall** — run into each of the four walls. Confirm clean game-over each time.
4. **Death by self** — grow to at least length 6 and turn into yourself. Confirm game over.
5. **Tail rule** — with length ≥ 4, turn tightly so the head follows the tail's path. Confirm no false death.
6. **Reversal** — while moving right, rapidly mash Left and Up together. Confirm the snake never reverses and never dies spuriously.
7. **Restart** — restart several times. Confirm score resets, position resets, and no state from the previous run survives.
8. **Timing** — repeat the same manoeuvre on a 60Hz and a 144Hz display if available. Speed must match.
9. **Tab-away** — start playing, switch tabs for 30+ seconds, return. The game must be paused, not running, and the snake must not have moved or died.
10. **Pause** — press `P` mid-game, confirm the snake is frozen; press `Escape`, confirm it resumes from the same cell. Repeat with a turn queued just before pausing, and confirm the turn applies on resume.
11. **DPR** — in DevTools device toolbar, check DPR 1 and DPR 3. The board must be sharp at both, with no size change.
12. **Viewports** — 320×568, 375×667, 768×1024, 1920×1080, and 844×390 landscape. Board usable and centred; no horizontal scroll.
13. **Keyboard** — confirm arrow keys and `Space` do not scroll the page, and that focus is visible on any focusable element.
14. **Reduced motion** — enable `prefers-reduced-motion: reduce` in DevTools rendering emulation. Confirm any transition is suppressed and the game remains fully playable.
15. **Long session** — play continuously for several minutes, or leave the page open and playing. Confirm no console growth, no slowdown, and no listener warnings.
16. **Resize** — drag the window continuously through resizes. No errors, no flicker, no distortion.

Report which of these were actually run, and any that were not, rather than asserting success generally.

---

## Definition of done

001 is complete when:

1. A full game is playable in a browser — start, eat, grow, die, restart — with no page reload at any point.
2. Every acceptance criterion above passes and was verified in a real browser, at the stated viewports.
3. The simulation is independent of rendering and of frame rate, and the module boundaries hold.
4. The console is clean: no errors, no warnings, no 404s.
5. No dead code, placeholder stubs, `TODO`s, or commented-out blocks remain.
6. No dependency, framework, or build step was introduced.
7. Nothing in "Deliberately deferred" was implemented, stubbed, or half-built.
8. `CLAUDE.md`'s refinement requirement is satisfied: the `polish-pass` skill (or `/polish`) has been run against the result.

A careless prototype does not satisfy this. Neither does gold-plating — the visual identity is a later task, and building it now would be a failure of scope, not a bonus.

Then answer honestly:

> **Does this merely work, or does it feel like a solid foundation for a finished game?**

If the honest answer is "it merely works," refine before declaring done. If it is "it feels solid," stop — and leave the identity work to task 002.

---

## Notes for the implementing agent

- `CLAUDE.md` governs. This document adds task specifics; it does not override the project's engineering, gameplay, UI/UX, or verification standards.
- Where this document is silent on a detail that does not matter, use engineering judgment and proceed. Do not ask.
- Where this document **is** explicit — the tail-vs-growth collision rule, the queue validation rule, whole-object restart, no global statistics — treat it as a requirement, not a suggestion. Those are the parts that are expensive to get wrong later.
- If implementation reveals that a decision here is genuinely wrong, change it and record why in `docs/decisions/`. Do not silently diverge.
- Do not commit unless asked.
