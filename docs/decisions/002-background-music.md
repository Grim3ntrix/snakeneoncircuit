# 002 — Background music

**Status:** Accepted
**Date:** 2026-09-30
**Task:** [006 — Background music](../tasks/006-background-music.md)

---

## Context

Task 005 added four synthesised voices and deliberately declined a bed:

> **Music, ambience, or a looping bed.** Four event voices. There is no bed and no loop.

and it fixed the stored settings at a single boolean:

> **A volume control, or any audio setting beyond muted.** One boolean.

Both were reasonable when written. 005's whole argument was that sound should be *additive* —
that a deaf player loses emphasis and never information — and the four voices were chosen
against a rule ("a sound belongs to a moment that changes what happens next") that admits
almost nothing. A bed fails that rule by construction: it changes nothing and reports nothing.

The owner then played it and reported that the game *"feels boring"* without one, and that
the voices alone were *"acceptable"*. That is the missing evidence. A bed is not justified by
the rule that governs events — it is justified by the twenty seconds of quiet board between
them, which the rule has nothing to say about.

This record exists because reversing a written deferral is an architectural decision, and 005
already set that precedent when it reversed 002's renderer boundary.

---

## Decision

**A generative bed of three layers over one clock, synthesised from the same `AudioContext`
as the voices, scheduled by a lookahead driven from the existing frame loop.**

1. **Generative, not a loop.** Three patterns of 4, 16, and 11 steps. The figures are coprime,
   so they realign only every 176 steps — longer than most runs. A fixed loop was rejected:
   the board is never the same twice and the bed should not be the one static thing in it.
2. **Grown from the snake's length.** Tempo interpolates 300 ms → 150 ms and a third layer
   enters at length 12, so the music has a shape that tracks the player's progress.
3. **Scheduled ahead from the existing frame loop.** No second timer.
4. **Ducked under the voices.** The bed yields to the event sounds rather than competing.
5. **Its own toggle**, with the master mute left intact on top of it.

---

## Why this, and not the alternatives

**Not a looping track, in any form.** A synthesised loop, a generated `.wav`, or a bundled
`.mp3` all share the failure: a run is twenty seconds and a loop is heard three times inside
it. The asset versions additionally cost a build step, which the project does not have.

**Not a bed over the whole session.** Considered and rejected: the game-over screen is the
one moment the music must get out of the way, because the verdict voice and the death effect
are the acknowledgement and a bed underneath them says the run did not really end. Starting
it with the run and stopping it with the run is also the simplest rule to state.

**Not one toggle for everything.** It was the smaller change — no schema widening, no second
key, no overlay control — and it was rejected because "music off, sound effects on" is the
setting most players actually want, and because a master mute that leaves music playing is
not a mute.

**Not `requestAnimationFrame`-free scheduling with `setInterval`.** A second timer is a second
clock to keep in step with the first, and it would keep firing when the frame loop has stopped.
`tick` costs one branch when there is nothing to schedule.

---

## What was given up, honestly

- **005's "one boolean".** The settings record is now `{ muted, music }`. The schema is
  *redefined at v1* rather than bumped to v2, which is defensible only because `v1` has never
  been written by a real browser — `main` has no audio and this branch is uncommitted. If that
  were not true, the key would have to change.
- **A key from a small keyboard.** `N` is now taken. It is adjacent to `M`, which is the
  argument for it, but it is a key the game can no longer use for anything else.
- **Simplicity.** `audio.js` roughly doubles. It gains a scheduler, a second bus, and a state
  machine over four inputs (`playing`, `music`, `muted`, `hidden`). That is the real cost, and
  it is why the bed lives behind `tick` and `setPlaying` rather than leaking its clock into
  `main.js`.
- **The one thing that cannot be checked from here.** Whether it sounds good. Every other
  claim about it is measurable; this one needs an ear.

## What was kept

- **Sound stays additive.** The bed carries no information, so a deaf player loses nothing
  that the board does not already say. 005's accessibility criterion survives the reversal
  intact — this is why the bed is allowed at all.
- **No assets, no dependency, no build step.** Notes are oscillators, as the voices are.
- **The run is still deterministic.** The bed is built from fixed tables and draws no
  randomness, so there is not even a seed to keep out of the simulation.
- **The master mute still means silence.** `M` silences the bed too; `N` is the narrower
  control, not a replacement for it.

---

## Consequences

- `main.js` gains one call in the frame loop and two at the existing phase seams — the same
  seams the effects timeline already hangs off, so the wiring stays in one place.
- `src/audio.js` is the only module that knows what a step is, when the next one falls, or how
  long a bar is. `main.js` hands it a length and never a clock.
- The ready, paused, and over overlays each gain a Music button, carrying `data-music` so a
  single `querySelectorAll` wires all three — the pad's own pattern, for the pad's own reason.
- The touch row is unchanged, because there was no room in it. 005's measurement stands and
  this task does not relitigate it.
