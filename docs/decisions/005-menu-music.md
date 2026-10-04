# 005 — The bed under the menu, and the first press

**Status:** Accepted
**Date:** 2026-10-03
**Task:** [006 — Background music](../tasks/006-background-music.md), [009 — Final polish](../tasks/009-final-polish.md)
**Supersedes:** [002](002-background-music.md), in part

---

## Context

002 tied the bed to the run: `setPlaying(phase === PLAYING || PAUSED)`. Its reasoning was
written down and was sound as far as it went — *"the game-over screen is the one moment the
music must get out of the way"*, and *"starting it with the run and stopping it with the run
is also the simplest rule to state."*

The owner played it and reported two things:

> The music background should start when the page was visited

and, separately, that the **Music** button on the ready screen did nothing audible.

The second is a genuine defect, and it was measured rather than reasoned about. Instrumenting
`AudioContext` construction and then pressing the Music button three times on the ready screen
gave **zero contexts built**. The cause is structural: the context is built inside
`unlock()`, `unlock()` is called from `start()` and nowhere else, and `toggleMusic` writes a
preference without ever reaching `start()`. So the one control in the game whose entire
purpose is sound was the one control that could not make any. It set a flag that nothing
would read until the player did something else entirely.

The first is partly a defect and partly a platform rule, and the two need separating:

- **What cannot be fixed.** No browser will let a page make sound before the player has
  interacted with it. This is the autoplay policy, it is the platform's decision, and the only
  switch that disables it is a Chrome flag a visitor would have to set themselves. Music
  beginning the instant the page loads is not reachable from JavaScript, and pretending
  otherwise by creating the context at load time would buy a console warning — which this
  project treats as a failure — in exchange for nothing.
- **What can be fixed.** Everything after that. The *first* press of any kind is the earliest
  moment the rule allows, and the game was not taking it: it waited for a press that starts a
  run, when any press at all would have done.

---

## Decision

**The bed belongs to the screen rather than to the run, and the audio graph is built on the
first press of any kind.**

1. **`syncBed()` becomes `audio.setPlaying(state.phase !== PHASE.OVER)`.** Ready, playing, and
   paused want the bed; over does not.
2. **It is called once at startup**, before the first frame. Without that the initial READY
   phase would never reach the audio layer, and the menu would stay silent until the first
   phase *change* — which is a run starting, the exact behaviour this reverses.
3. **A one-shot first-press listener** on `window`, for both `pointerdown` and `keydown`,
   calls `unlock()`. Whichever arrives first removes both.
4. **`audio.js`'s `runInProgress` is renamed `bedWanted`**, because after this the two are no
   longer the same question and a name that says "run" would be a lie in the menu.

---

## Why this, and not the alternatives

**Not a "click to play" gate.** A full-screen prompt would guarantee a gesture, and it was
rejected because it puts a modal between the player and a game that already explains itself.
The ready screen says *press ↑ or tap the pad*; a player who reads it and presses has already
made the gesture. A gate would interrupt everyone to solve a problem only the player who
never presses has — and that player is not going to hear anything anyway.

**Not a per-control `unlock()` call.** Attaching one to each of Music, Sound, Pause, and the
pad would work, and it is four places to remember. The listener on `window` is one place, it
covers controls that do not exist yet, and it fires on presses the game does not otherwise
act on — a click on the background, a scroll key — which is strictly more opportunities to
unlock.

**Not left as it was, with the README explaining it.** Documenting that the Music button does
not work until you start a run is not a fix. It also fails 004's own reasoning: a control
must not be the one thing in its category that cannot do its job.

**Not the bed on the game-over screen too.** The half of 002's reasoning that survives intact,
and the reason this record says *supersedes in part* rather than *reverses*. A run has ended,
and a bed still playing over the settled board says it had not really ended. Over is the one
phase that stops it.

---

## What was given up, honestly

- **002's "simplest rule to state".** `bedWanted` is now derived from a phase comparison with
  a negation in it rather than from a phase list, which is the same size and less obvious. The
  comment above it carries the reason.
- **Silence as a signal that the run has ended**, in the menu. There is now no quiet screen
  before the first run, so the first sound a player hears is the bed rather than an eat blip.
  That is the intent, not a cost — but it does mean the transition into a run is no longer
  marked by the music starting, only by its tempo and its third layer.
- **The claim in the README** that *"the menus stay quiet"*. Amended rather than deleted, with
  a pointer here.
- **Still unreachable: music on arrival, before any interaction.** Stated plainly in the
  README and on the task, so the next report of it is answered rather than re-investigated.

## What was kept

- **The bed is still additive.** It carries no information, so a deaf player loses nothing the
  board does not already say — 002's accessibility criterion, and 005's before it.
- **The run is still deterministic.** No new randomness; `bedWanted` is a boolean.
- **`M` still means silence, `N` still means the bed alone.** Neither control changed.
- **No console output.** `unlock()` is still called only from inside a real gesture, so the
  context is never constructed early enough to trip the autoplay warning.

---

## Consequences

- `main.js` gains one `syncBed()` at startup. The three existing call sites — start, the pause
  toggle, and the single terminal branch — are unchanged.
- `input.js` gains an `unlock` handler and a two-event one-shot listener. It remains the only
  module that listens for input.
- The unlock is now attempted on presses the game does not act on, which is the point: the
  earliest gesture wins regardless of what it was for.
