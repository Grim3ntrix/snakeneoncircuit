# 001 — The renderer receives events

**Status:** Accepted
**Date:** 2026-09-29
**Task:** [005 — Audio and richer feedback](../tasks/005-audio-and-feedback.md)

---

## Context

Task 002 drew a boundary around the renderer and wrote it down as an invariant:

> **`renderer.draw(state)` keeps its signature.** The renderer derives everything it needs
> — trace direction, ramp position — from `state.cells` and `state.food`. It must not need
> a time value, a frame counter, or a delta.
>
> **The renderer still never reads `phase`, `score`, or `over`.** This is why the game-over
> screen cannot dim the board or burn out the trace. That was considered and rejected: the
> boundary is worth more than the effect.
>
> **Nothing on the canvas animates.** The only animated things in this task are the
> overlays entering and leaving.

Task 001 had already left the opposite intent in its extension-point table — *"Effects
layers | Fixed layer order in `draw()`, with a marked insertion point"* — so the two tasks
disagree, and 002's version is the one that shipped. 002 was also the task that gave the
renderer its identity: the board as substrate, the snake as a trace carrying a signal.

Task 005 exists to add event feedback, which 002 deferred to it by name. Dying and eating
are the two moments the game never acknowledges at the point where they happen, and the
`polish-pass` standard asks for exactly that: *"eating, scoring, and dying each get
distinct feedback proportionate to the event; death reads clearly."*

So the choice 002 made deliberately is now reversed deliberately. This records why, and
what was actually given up.

---

## Decision

**`draw(state, effects)` — the renderer gains one parameter, and it carries events, not
game state.**

`effects` is a timeline of things that just happened, owned by `src/effects.js`: a fixed
array of slots, each `{ active, kind, x, y, t }`, where `t` runs 0 → 1 over a duration
declared in `config.js`. `main.js` spawns into it where it already branches on the
`OUTCOME` token that `step()` returns, and advances it once per frame.

The renderer reads it. It still does not read `phase`, `score`, or `over`, and it still
cannot ask what happened — it can only be told.

---

## Why this, and not the alternatives

**Not `renderer.die()`, `renderer.eat(cell)`.** The obvious smaller change is to give the
renderer methods and let it own the animation clock. It keeps `draw`'s signature and adds
no module. It was rejected because it makes `draw` impure with respect to time — the
renderer would have to call `performance.now()` itself — and because it teaches the
renderer the *game's* concepts by name. `die` and `eat` are rules. The renderer is
documented as knowing the board is 24 cells square and nothing else, and it should stay
replaceable wholesale.

**Not deriving events by diffing state between frames.** It would need the renderer to keep
the previous frame's `cells` and `food`, which is both per-frame retention and a fragile
inference: a snake that ate and a snake that moved can look alike.

**Not a separate effects layer drawn after the renderer.** The death effect is not a layer
over the board — it changes how the trace itself is drawn. A compositing layer cannot
express it, and a translucent overlay on top would *reduce* the legibility the effect is
supposed to preserve.

---

## What was given up, honestly

- **`draw`'s signature is no longer stable.** Anything that calls it must pass effects.
  There is exactly one caller.
- **The renderer is no longer a pure function of the game state.** It is now a pure
  function of (game state, event timeline). This is the real cost, and it is why the
  timeline is a separate module rather than state on the renderer: the renderer stays
  stateless, and all the new state is testable without a canvas.
- **The canvas animates now.** 002's stillness is gone as a blanket rule. It is replaced by
  a narrower one, below.

## What was kept

- **The renderer still never reads `phase`, `score`, or `over`.** 002's second invariant is
  intact, and it is the one that mattered: the renderer cannot change what it draws based
  on how the game is going.
- **No per-frame allocation.** The slots are allocated once, in the factory. `advance` is
  arithmetic over them; drawing iterates them by index. The ban 002 wrote is a rule about
  the draw path, and the draw path still allocates nothing.
- **Motion is bounded by legibility, not by taste.** The death effect's floor is
  `TRACE_TAIL_ALPHA`, the constant 002 introduced because `--snake-body` stops being a
  legible graphical object below it. The burnout settles *at* that floor and no further, so
  "the signal stops" cannot cost the player the ability to see where the run ended. The
  head keeps its full cell and the food keeps its diamond: neither silhouette is touched.

---

## Consequences

- `src/simulation.js` is still untouched. Events flow outward from `step`'s return value
  exactly as task 001 designed that seam to allow; the simulation does not know the
  timeline exists.
- `src/effects.js` has no DOM, canvas, or Web Audio reference, so it is exercised headlessly
  under Node like `simulation.js`.
- `prefers-reduced-motion` cannot be honoured from CSS for anything drawn on canvas, so the
  timeline takes the preference at construction and resolves effects instantly when it is
  set. Feedback survives; travel does not.
- The README's claim that the renderer "never reads the score or the phase" stays true; its
  claim that replacing the renderer is the way to redesign the visuals now also requires
  the effects timeline to be understood. Both are amended there.
