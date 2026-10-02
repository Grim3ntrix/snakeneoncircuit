# 003 — The snake's head has a face

**Status:** Accepted
**Date:** 2026-10-01
**Task:** [008 — The snake's head](../tasks/008-snake-head.md)

---

## Context

Task 002 designed the snake as a conductor carrying a signal and specified the head as a filled
square, rejecting detail on it in writing:

> The head stays a **full cell at full brightness**, as in 001. Do not add a via hole, a core, or
> an inner square: at the minimum cell size of 8px any such detail is 2–3px and reads as either
> noise or damage.

Two separate things were being protected by that sentence, and they are not the same thing:

1. **A size argument.** At an 8px cell there is no room for a mark plus the margin that makes it
   read as placed rather than as damage.
2. **A legibility argument.** Head and body are 1.46:1 apart in luminance, so the head's full-cell
   fill against the body's inset fill is what separates them for a colour-blind player. Anything
   that reduces the head's fill is a regression.

The owner played the game and asked for the opposite:

> the snake head should be like smiling or what emotion should it be or like opening a mouth. The
> goal here is not to use a box or pixel snake but a skin like how some snake game render their
> snake character.

That is the missing evidence. 002 decided on legibility grounds, correctly, but legibility was
never the only thing at stake and nobody had played it yet.

This record exists because reversing a written rejection is an architectural decision. 005 set the
precedent when it reversed 002's renderer boundary, and 006 set it again when it reversed 005's
deferral of music.

---

## Decision

**The head gains two eyes, drawn inside its existing full-cell fill, set across the direction of
travel and present only at cell sizes where they can read. The body's segments are rounded.**

1. **Two eyes, not one, and no mouth.** A single mark on a filled square is a hole. A pair is a
   face. The count is the reading, and nothing else about the mark matters as much.
2. **Round, not square.** A square mark on a square face is a dead pixel — which is the owner's
   own words for the first attempt: *"the said eye was like a pixel tho"*.
3. **Set across the travel axis, both on the leading edge.** Where a single mark has nowhere to sit
   that is not the centre, a pair occupies the two positions either side of it.
4. **Drawn in `--arena`**, so they are the substrate showing through the pad. No new token.
5. **Mood only at events.** Resting, they are filled circles; an eat widens them; a death closes
   them to two slit marks and leaves them shut.
6. **Absent below `EYE_MIN_CELL_PX`.** Where the pair does not fit, the head is a plain filled
   square — 002's design, unchanged.
7. **`CORNER_RATIO` on every shape**, the head at a full cell and the body segments at their inset
   size, so the silhouette is one family rather than a rounded head on square beads.

---

## The finding this record turns on

**The first attempt at this task got the count wrong, and the count is the whole thing.**

That attempt drew one square eye. Rendered, it did not read as a face at all; it read as damage.
The reason is not subtle once seen:

> 002 rejected *"a via hole, a core, or an inner square"*. 002 was right about what it was looking
> at. A **single** mark on a filled square is a hole, whatever shape it is drawn in and wherever it
> is placed. Moving it off-centre changes the reading far less than 002's rejection and this task's
> first attempt both assumed — a hole near an edge is still a hole.

002 and the owner were therefore not in conflict. They were describing different marks, and the
task's first attempt satisfied neither: it took 002's count and the owner's request at once, and
produced the worst of both.

Two eyes fix it because the reading is carried by the **count**, not by the shape, the size, or the
position. Two marks with a gap between them, on the leading edge of a square, is a face at any size
above the threshold. This is measured, not asserted: the verification probes the head cell for
separated blobs and requires **two** in all four directions, because one blob is precisely the
failure being corrected and a single blob count would pass silently.

The owner then supplied the mark they had meant all along — a reference image of a snake built from
rounded green squares whose head carries two round dark eyes:

> sample snake character but something neon concept

That image confirms the count and the shape, and it is where the second decision below comes from.

---

## Why this, and not the alternatives

**Not a reversal of 002 in full.** The two objections are answered separately rather than
overruled together. The size argument is answered by the threshold: above the size where it bites
there is room, and below it nothing is drawn. The legibility argument is answered by geometry: the
head is still painted as a full cell first and the eyes are drawn on top of it, so the fill — and
therefore the silhouette that carries the colour-blind distinction — is bit-for-bit what it was.
The eyes are a strictly *additional* cue.

**Not a light sclera, though the reference image has one.** The reference draws white eyes with
dark pupils on a mid-green head. That figure-ground cannot be reproduced here, and the measurement
says so: `--snake-head` is #a8ffd8, which sits at relative luminance 0.848, so the interface ink
#e8eef7 measures **1.00:1** against it and pure white only **1.17:1**. There is no light colour
that separates from the head. The reference's reading is therefore inverted rather than copied: a
**dark** eye on a **lit** pad, which is the same figure-ground with the values swapped, and which
measures **15.83:1**. Copying the reference literally would have produced an invisible eye.

**Not a mouth, though the owner asked for one.** A mouth is a third mark, and at a 12px cell a
third mark takes the space the gap between the eyes needs. `CLAUDE.md` puts gameplay legibility
above decoration. Recorded because declining a thing the owner asked for by name deserves to be on
the record rather than quietly dropped.

**Not a new colour for the eyes.** `--arena` is already in the renderer's `TOKENS` and is already
the surface the head is drawn on. The eye as substrate-through-the-pad is the honest description of
what it is, it needs no new token, and it inherits the 15.83:1 that pair already measures.

**Not a fixed eye size.** The gap is the token and each eye's size is derived from what is left
over. A fixed eye size would eat the gap as the board shrinks, and at the moment the pair merges
into one mark the design has silently reverted to the hole it exists to avoid. Spending the token
on the separation makes the separation the guaranteed quantity.

**Not drive the mood from game state.** The obvious implementation reads `phase` or `state.over` to
decide whether the snake is dead. That would break the invariant 002 set and 005 deliberately kept
— *the renderer is told that an event occurred; it never reads game state.* Both moods come from
the effects timeline instead: the eat widen from the newest `EFFECT.EAT` slot's `t`, which the
flare already uses, and the death slit from `outcomeOf(effects)`, which `paintFrame` already calls.

**Not round the head alone.** The reference's snake is built entirely from rounded squares. A
rounded pad on square beads would be two shapes pretending to be one family, and the junction
between them would be the only place in the game where the grammar changes. One ratio, applied to
each shape at its own size, keeps the head larger than the body and the two visibly the same kind
of thing.

---

## What was given up, honestly

- **002's sentence, as written.** It says "do not add … an inner square", and this adds marks inside
  the head. The constraint is not softened or reinterpreted; it is lifted above a cell size, and the
  decision is recorded rather than assumed.
- **A clean, empty head.** The pad now has marks on it, and a mark can read as a defect. That risk
  is real and is listed in the task's *Not verifiable here* — it needs an eye on a real screen at
  real speed, which is exactly what a pixel probe cannot supply. The owner has since smoke-tested it
  and reported it reads as intended, which is the evidence the probe could not produce.
- **Two pixels of face rather than one.** At a 12px cell the pair costs 18 pixels of the head's 144,
  against 9 for a single eye. The head's silhouette is untouched either way, so this is spent from
  the mark budget and not from the legibility budget.
- **The one-pixel budget on the eat widen.** At a 12px cell it is one pixel of change and it narrows
  the gap between the eyes to that same single pixel at its peak. The flare is what actually carries
  the eat acknowledgement; the eyes' contribution is secondary, and the task says so rather than
  claiming a legible effect it may not have.
- **Round corners cost the head a little coverage at its extremes.** At a 12px cell, one device
  pixel per corner is cut. The fill still reaches every edge and the eight-point probe in the
  verification confirms it, but the head is no longer literally a rectangle.

## What was kept

- **The head fills its whole cell at full brightness.** Painted first, unmodified, with the eyes on
  top. The colour-blind silhouette 002 called load-bearing is untouched.
- **Colour is still not doing the work.** The eyes are a luminance hole, so they read in greyscale
  and for every form of colour blindness, exactly as the head-versus-body distinction does.
- **The renderer still never reads `phase`, `score`, or `over`.** Both moods arrive through the
  effects timeline.
- **`draw(state, effects)` keeps its signature.** The direction is `head - neck`, which is already
  in `state.cells`; nothing new is passed in.
- **No per-frame allocation.** The eyes are loop iterations over two `ctx.arc` calls and two number
  assignments; no array, object, or closure is created per frame.
- **Reduced motion needs no new code.** A spawned effect already resolves to `t = 1`, so the widen
  is automatically zero while the death slit — a state, not a motion — still lands. Verified: the
  pair measures identical before and after an eat with the preference set, and still collapses on a
  death.

---

## Checked, and deliberately left alone

The body segment adjacent to the head draws its connecting bridge from a different origin than the
rest of the trace: every other bridge spans two cells that are both inset, but the head is a **full**
cell, so the bridge runs two to four pixels underneath it. Where the head's rounding cuts its own
corner away, that bridge is behind the cut and can show through.

It is real, and it was measured rather than reasoned about. It is also unreachable in play:

| Cell size | 12 | 14 | 16 | 19 | 24 | 40 |
| --- | --- | --- | --- | --- | --- | --- |
| Body pixels showing at the head's corners | 0 | 0 | 0 | 0 | 2 | 12 |

The bridge occupies the rows the body's inset leaves it, and the head's corner cut reaches outside
its arc only at the extremes — at cells 12, 14 and 16 the two regions do not overlap at all, and at
19 they overlap only inside the head's own anti-aliasing fringe. The first true pixel of bleed
appears at cell 24. **The largest cell any reference viewport produces is 19** (12 / 14 / 16 / 19 /
12 at 320×568, 375×667, 412×915, 480×720, 844×390), so there is no viewport at which a player can
see it.

The clamp is recorded here so that a future task that enlarges the board finds the measurement
rather than rediscovering the artifact, and so that nobody re-derives a fix for a defect that does
not exist where the game is played.

---

## Consequences

- `src/config.js` gains `EYE_GAP_RATIO`, `EYE_MIN_CELL_PX`, `EYE_EXTRA_PX`, `EYE_SHUT_PX` and
  `CORNER_RATIO`, and remains the single source of truth for all of them.
- `cornerRadius(size)` clamps its result at `Math.floor(size / 2)`. This is not defensive
  programming: `ctx.roundRect` silently degrades to an ellipse past half the size rather than
  throwing, so past that point the radius stops being a radius at all. The clamp is what makes
  `CORNER_RATIO` a ceiling that can be raised without the failure being invisible.
- `paintBody` draws each segment as its rounded rect plus its bridge **into one path, filled once**,
  so the overlap where they meet composites at full alpha instead of compounding. A bridge stopped
  at the shared cell boundary would leave every rounded corner showing as a notch; extending it one
  radius into both neighbours buries them. The visible rounding is therefore only where it is
  wanted — the outer side of a turn, and the tail tip.
- `paintFrame` computes `outcomeOf(effects)` **once** and passes it to both the body and the head,
  where it was previously called inline for the body alone. The change removes a duplicate call
  rather than adding one.
- The head's face is the second thing in the renderer that depends on the effects timeline, and the
  first that depends on it for something other than a wavefront. If a third arrives, the shape of
  that dependency is worth extracting; two does not justify it.
- `docs/tasks/002-neon-circuit-identity.md` now contains rules that are no longer true as written.
  It is a task record of what was decided at the time, not a living specification, and this decision
  supersedes it — the same relationship 002's task record has to 003's reversal in
  [decision 001](001-render-events.md).
