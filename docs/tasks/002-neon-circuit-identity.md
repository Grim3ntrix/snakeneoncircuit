# Task 002 — Neon Circuit Identity

Task 001 delivered the playable core and an interface *floor*: correct, legible, and deliberately plain. It says so itself — "Restrained foundation only. The Neon Circuit identity is a later task; do not attempt it here."

This is that task. It replaces the floor with a deliberate identity and designs the screens 001 left as plain text.

---

## Prerequisite

Task 001 is complete and its invariants must survive this task unchanged. Read it first — in particular the layer order, the palette single-sourcing rule, and the "Extension points for later tasks" table, which names this task specifically.

---

## The concept

**The board is a printed circuit. The snake is a trace carrying a signal. The food is a node the signal is being routed to.**

This is not a theme applied on top of a game. It comes out of the simulation's own constraints:

- The grid already forces orthogonal, right-angled routing at a fixed pitch. That is exactly how a PCB trace is laid out. The aesthetic is *derived from* the constraint rather than painted over it.
- It gives every element a job. The substrate recedes, the trace conducts, the node attracts. Nothing is present for decoration.
- It turns the grid from graph paper — which is what an unstyled 24×24 lattice reads as, a testing artifact — into the board's actual material.

The identity lives in **form**, not in colour: continuity, gradient, and hierarchy. A palette swap alone would not produce it, and a palette swap plus glow would produce the generic result this project explicitly forbids.

### Anti-goals

Each of these would make the game read as a stock cyberpunk template. Do not do any of them.

- Glow on everything. There is exactly **one** lit element on the board, and it is the food.
- Scanlines, CRT curvature, chromatic aberration, screen noise, purple-and-cyan synthwave, neon sunsets.
- Animated backgrounds, parallax, or ambient motion of any kind.
- Gradients used as decoration. The only gradient is the signal ramp, and it carries information.
- Particles, trails, or motion blur.

---

## Scope

### In scope

- The palette, as tokens in `:root` — refined, not replaced wholesale.
- The board: substrate, grid hierarchy, edge treatment.
- The snake: trace continuity and the signal ramp.
- The food: the node treatment.
- The HUD: refined, staying quiet.
- The ready / paused / over overlays: designed, replacing the plain-text placeholders.
- The motion vocabulary: shared durations and easings, applied only where this task needs them.

### Out of scope

- **Touch controls.** Responsive layout exists; responsive input does not. Separate task.
- **Audio and event feedback** — screen shake, particles, death effects, sounds. Task 001 assigns these to 004.
- **Persistence, statistics, scores across sessions.** Task 001 defers these absolutely.
- **Gameplay changes.** No new collectibles, no difficulty progression, no rules changes.
- **A settings menu, theme switching, or a light mode.** The tokens must not *preclude* a future theme, but building one is not this task.

---

## Palette

Tokens stay declared once in `:root` and read into `renderer.js` at init, exactly as task 001 established. No token may be duplicated into JS.

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#0a0d12` | Page |
| `--arena` | `#0e141b` | Substrate |
| `--grid` | `#171e29` | Minor grid |
| `--grid-major` | `#26313f` | Major grid, every 6 cells |
| `--frame` | `#2a3446` | Board edge |
| `--edge-mark` | `#3d4d66` | Corner fiducials |
| `--snake-head` | `#a8ffd8` | The pad |
| `--snake-body` | `#2fe0a0` | The trace |
| `--food` | `#ff4d70` | The node |
| `--ink` | `#e8eef7` | Primary text |
| `--ink-dim` | `#93a1b5` | Secondary text |

### Measured contrast

These are computed values, not estimates. Recompute them after any change and update the table; the acceptance criteria require it.

| Pair | Ratio | Requirement |
| --- | --- | --- |
| head vs arena | 15.83:1 | ≥ 3:1 graphical object |
| body vs arena | 10.83:1 | ≥ 3:1 |
| food vs arena | 5.77:1 | ≥ 3:1 |
| ink vs bg | 16.68:1 | ≥ 4.5:1 text |
| ink-dim vs bg | 7.42:1 | ≥ 4.5:1 text |
| grid vs arena | 1.11:1 | decorative — must recede |
| grid-major vs arena | 1.40:1 | decorative — must recede, but read as major |

### The favicon

`index.html` carries an inline SVG favicon whose hex values are copied from the palette — currently `#0a0d12`, `#7cffc4`, and `#3ddc97`.

A data URI cannot read a CSS custom property, so this duplication is unavoidable. It is also exactly the drift `CLAUDE.md` forbids everywhere else, which makes it something to handle deliberately rather than leave to be discovered: **when a palette token changes, update the favicon in the same change.** Add a comment at the favicon saying so. Three hex values silently drifting away from the tokens they were copied from is the kind of thing that survives to a portfolio review.

### The uncomfortable number

**head vs body is 1.46:1. food vs body is 1.88:1.**

Both are far below 3:1. Hue is doing almost none of the work in those two pairs, which means **shape is carrying the distinction** — the head is a full cell where the body is inset, and the food is a diamond where the snake is square. For a colour-blind player those silhouettes are the entire mechanism.

This is why task 001's "head must differ from body by more than hue" is not a nicety. Do not remove, reduce, or soften either shape difference, and do not replace one with a glow, an outline, or a colour shift. If a proposed visual change makes the head and body the same silhouette, it is a regression regardless of how it looks.

---

## The board

### Grid hierarchy

Replace the uniform 24-line lattice with a two-tier grid:

- **Minor** lines on every cell boundary, in `--grid`.
- **Major** lines every **6 cells** — at 6, 12, and 18 — in `--grid-major`.

24 divides by 6 into four, so the board reads as a 4×4 arrangement of 6×6 blocks. This is a real circuit-board idiom, it cuts visual noise, and it gives the player a spatial reference they can actually use — "the food is in the second block down" is a faster thought than an unmarked field allows.

A uniform lattice reads as graph paper. Hierarchy is what makes it read as a board.

### Edge

- Keep a 2px `--frame` border.
- Add **corner fiducials**: a small L-shaped mark inset at each of the four corners, in `--edge-mark`. Fiducials are how a real board is aligned during assembly; they give the board a manufactured read for four short strokes.

Both are drawn into the offscreen arena cache and cost nothing per frame.

---

## The snake

### One trace, not a row of tiles

Task 001 insets every body segment by `BODY_INSET_PX` on all four sides. That draws a chain of separate squares with gaps at every joint — it reads as a row of tiles, and tiles are not a circuit.

Draw the body as a **continuous conductor**. Segments connect along the axis of travel; the trace only shows a break where it turns, which is where a real trace has a corner anyway.

The renderer can derive adjacency from consecutive cells' coordinates. **This must not require `draw()` to receive anything new** — see the invariants below.

### The signal ramp

Brightness falls from the head to the tail, so the snake reads as a signal attenuating along a conductor.

- The neck is at full `--snake-body`.
- Alpha falls linearly to a **floor of 0.50** at the tail.

**The floor is a hard limit, not a taste call.** Composited over the substrate, `--snake-body` hits 3:1 at alpha 0.45 and drops to 2.70:1 at 0.40. Below 3:1 the tail stops being a legible graphical object under WCAG 1.4.11, and the player cannot see where their own tail is — which is the cell the whole tail-vacate rule turns on. Do not fade below 0.50.

The ramp does real work beyond looks: at speed it tells the player which way they are travelling without them having to look at the head.

Implement it with per-segment `globalAlpha`. That is a number assignment, not an allocation.

### The head

The head stays a **full cell at full brightness**, as in 001. Do not add a via hole, a core, or an inner square: at the minimum cell size of 8px any such detail is 2–3px and reads as either noise or damage. This was considered and rejected — size and brightness already separate the head from the body, and the silhouette requirement above depends on the head staying a clean, filled square.

---

## The food

- Keep the **diamond** silhouette and `FOOD_INSET_PX`. Its shape is load-bearing (see the uncomfortable number above).
- Give it a **halo**: the diamond drawn twice, once at a larger radius at low alpha and once solid. It is the only lit element on the board.
- **No pulse, no animation.** The board is still except for the snake. Stillness is what makes the snake's movement legible, and a pulsing element would require the renderer to know the time — see the invariants.

### Do not use `shadowBlur`

`ctx.shadowBlur` is the obvious way to draw a glow and it is the wrong one. It allocates a blur surface per draw call, its cost scales with the blur radius, and the result cannot be cached. Two filled paths cost two filled paths. The prohibition is absolute for this task.

---

## HUD

The HUD is already DOM, so this is CSS work. It stays quiet: `CLAUDE.md` requires the eye to land on the play field first, then score, then everything else.

- The score value stays `--ink`, not the trace colour. It is the number the player reads; maximum legibility outranks thematic consistency.
- Keep tabular figures so the score cannot jitter as it counts.
- Add a thin rule in `--frame` between the HUD and the board, reading as the silkscreen label area of a board.
- The title's `//` mark keeps the trace colour — the one place chrome and field share a hue.

Do not add a `HIGH` score, a length readout, a timer, or a level. Those need state that does not exist and belong to later tasks.

---

## Overlays

Task 001 explicitly left these as placeholders. Design them — and fix a defect while doing it.

### The defect

Task 001 raised the scrim to 94% because the board and the overlay copy are both centred, so the snake sat directly behind the prompt and bled through. The fix worked, but it has a cost: at 94% the board is effectively invisible, **and on game over that is exactly the wrong thing to hide.** The player has just died and cannot see where, or what they hit.

### The fix

Stop veiling the board, and move the opacity to where it is actually needed:

- **Light scrim** (around 55%) so the board stays readable behind the panel.
- **The overlay content sits on an opaque panel** — its own background, border in `--frame`, and the standard radius. Text legibility no longer depends on the scrim at all, which is a stronger guarantee than the 94% veil ever was. The original tinting defect cannot recur, because nothing translucent sits behind the type.

This also means the `<kbd>` chips no longer need their own opaque background as a workaround, though keeping it is harmless.

### Screens

- **Ready** — title and start prompt. Compact.
- **Paused** — title and resume prompt.
- **Over** — the result. `state.over.reason` already distinguishes `WIN`, `WALL`, and `SELF`, and `main.js` currently surfaces only `WIN`. **Distinguishing wall from self is out of scope for this task** — it is content, not identity, and belongs with 004's feedback work. The panel must simply be able to accommodate a longer line without reflowing the layout.

Keep every overlay's copy to what fits at 320px without wrapping to a third line.

---

## Motion vocabulary

One easing and one duration set, already partly established. Extend it rather than inventing per-element values.

| Token | Value | Use |
| --- | --- | --- |
| `--duration-fast` | 140ms | Overlay enter |
| `--duration-base` | 220ms | Panel and scrim transitions |
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.3, 1)` | Everything |

Rules:

- Motion is short, purposeful, and never blocks input.
- **Nothing on the canvas animates.** The only animated things in this task are the overlays entering and leaving.
- Every animation must be neutralised under `prefers-reduced-motion`. The existing blanket rule covers this; do not add an animation that escapes it.

---

## Invariants

These are task 001's boundaries. Breaking any of them is an architectural change requiring a `docs/decisions/` entry, and none of them should be necessary.

1. **`renderer.draw(state)` keeps its signature.** The renderer derives everything it needs — trace direction, ramp position — from `state.cells` and `state.food`. It must not need a time value, a frame counter, or a delta.
2. **The renderer still never reads `phase`, `score`, or `over`.** This is why the game-over screen cannot dim the board or burn out the trace. That was considered and rejected: the boundary is worth more than the effect.
3. **No per-frame allocation.** No objects, arrays, gradients, or `Path2D` constructed in the draw path. The signal ramp is a number computed per segment, not a precomputed array of colours.
4. **`simulation.js` is untouched.** Visuals cannot affect gameplay, determinism, or timing. If a visual change requires a simulation change, the design is wrong.
5. **No new dependency, no build step, no `package.json`.**
6. **Frame cost stays flat** across a long session, and no listener is added per resize or per frame.

---

## Acceptance criteria

### Identity

- [ ] The board reads as a substrate, not as graph paper — the grid has visible major/minor hierarchy
- [ ] The snake reads as one continuous conductor, not a row of separate tiles
- [ ] Brightness visibly falls from head to tail
- [ ] The food is the only lit element on the board
- [ ] Nothing on the canvas animates

### Legibility

- [ ] Arena, head, body, food, and score are distinguishable at a glance
- [ ] Head and body differ by **shape** and not only by hue — the silhouette test passes in greyscale
- [ ] Food differs from the snake by shape, not only by hue
- [ ] The tail at minimum alpha is at least 3:1 against the arena
- [ ] The snake stays readable against the moving grid lines behind it

### Accessibility

- [ ] Every text pair meets WCAG AA (4.5:1); every graphical object meets 3:1
- [ ] Contrast figures in this spec are recomputed and match the shipped tokens
- [ ] The favicon's copied hex values match the palette tokens
- [ ] `prefers-reduced-motion` neutralises every animation
- [ ] Keyboard operation and `:focus-visible` are unaffected
- [ ] Everything still works at 320px wide with no horizontal scroll and no layout shift

### Interface

- [ ] The game-over screen leaves the board visible enough to see where the run ended
- [ ] Overlay text sits on an opaque panel and cannot be tinted by the board behind it
- [ ] The HUD stays visually subordinate to the play field

### Integrity

- [ ] `renderer.draw()` is still called with `state` alone
- [ ] The renderer still never reads `phase`, `score`, or `over`
- [ ] No per-frame allocation was introduced
- [ ] `simulation.js` is unchanged
- [ ] Zero console errors or warnings
- [ ] No dependency, build step, or `package.json` was added

---

## Verification

1. Read the diff critically before running anything.
2. Serve the game (`python -m http.server 8000`, or any equivalent) and check the console over a full session: start, play, eat, pause, resume, die on a wall, die on yourself, restart. Zero errors or warnings.
3. **Contrast:** recompute every pair in the palette table from the shipped tokens and confirm the table matches. Do not trust the numbers in this document — re-derive them.
4. **Greyscale:** screenshot the board and desaturate it. Head, body, and food must still be distinguishable. This is the colour-blind check and it is not optional.
5. **Signal ramp:** sample the tail's composited pixel and confirm ≥ 3:1 against the arena.
6. **Viewports:** 320×568, 375×667, 768×1024, 1920×1080, and a landscape phone. Check for clipping, horizontal scroll, and layout shift.
7. **DPR:** verify at device pixel ratios 1, 2, and 3. Grid lines must be equally crisp on both axes at every ratio — the half-pixel snapping from 001 must survive any change to how the grid is drawn.
8. **Reduced motion:** run with `prefers-reduced-motion: reduce` and confirm no animation survives.
9. **Keyboard only:** play a full round with no pointer input.
10. **Performance:** confirm the draw path allocates nothing, and that frame cost is flat over a long session.

Steps 3–8 are automatable and were automated for 001. Reuse that harness rather than eyeballing, and read the resulting screenshots directly — task 001's most valuable defect was found only by looking at a PNG, not by a pixel probe.

### Not verifiable here

Report these as unverified rather than claiming them: how the identity *feels* in motion, whether the trace reads clearly at speed on a real display, and true cross-monitor DPR changes. Provide a short checklist instead.

---

## Deliberately deferred

Do not build, stub, or scaffold any of these.

- Touch controls

  Concrete consequence, found while implementing: the overlays instruct the
  player to press Enter, and on a touch device there is no key to press, so the
  game cannot be started at all. Whatever task adds touch controls therefore has
  to replace that copy as part of the work, not just add controls beside it.
  Until then the game is keyboard-only, and on a phone it is unplayable rather
  than merely awkward.

- Audio of any kind
- Screen shake, particles, flashes, death effects, trails
- Score persistence, best scores, any statistic
- Difficulty progression or a variable tick rate
- New gameplay elements — collectibles, power-ups, obstacles, arena events
- A settings menu, theme switching, or light mode
- Wall-versus-self death messaging
- Any change to `simulation.js`

---

## Definition of Done

1. It works, including its edge cases.
2. The refinement pass (`polish-pass` skill, or `/polish`) has been run. This task **subtracts** as much as it adds; removing something generic counts as progress.
3. Verified in a browser at narrow and wide viewports, at DPR 1, 2, and 3, with reduced motion, and in greyscale.
4. Contrast figures are recomputed, not copied from this document.
5. No console errors, dead code, or placeholders remain.
6. Every invariant above holds.
7. You can answer yes to: *does this read as intentionally designed, or as a Snake clone with a neon filter?*

If the honest answer to 7 is the second one, the identity has not been achieved yet regardless of how many criteria are ticked.

Do not commit unless asked.
