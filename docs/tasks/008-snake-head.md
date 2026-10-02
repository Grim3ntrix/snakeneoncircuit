# Task 008 — The Snake's Head

The snake is a conductor carrying a signal, and 002 designed it that way: a bright pad at the
front, a trace attenuating behind it. The pad is a filled square. It has no face.

Task 002 made that choice deliberately, and wrote the rejection down:

> **The head** — The head stays a **full cell at full brightness**, as in 001. Do not add a via
> hole, a core, or an inner square: at the minimum cell size of 8px any such detail is 2–3px
> and reads as either noise or damage. This was considered and rejected — size and brightness
> already separate the head from the body, and the silhouette requirement above depends on the
> head staying a clean, filled square.

The owner has now played it and asked for the opposite:

> the snake head should be like smiling or what emotion should it be or like opening a mouth.
> The goal here is not to use a box or pixel snake but a skin like how some snake game render
> their snake character.

and then supplied the mark they actually meant — a reference image of a snake built from rounded
green squares, whose head carries two round dark eyes set across the travel axis:

> sample snake character but something neon concept

So this task reverses a written rejection, which is why it carries
[decision 003](../decisions/003-snake-head.md). It is not a matter of taste: 002's reasoning was
sound and this task has to answer it rather than overrule it.

The owner chose the scope explicitly: **the head and the rounded trace**, not the head alone.

---

## What 002 was actually right about

002's objection has a **size** in it, and the size is the whole argument. At an 8px cell, a
3px detail is 37% of the head and there is no room for the margin that makes a mark read as
*placed* rather than as damage.

The measurement that matters: `cellSize = Math.max(MIN_CELL_PX, Math.floor(available))` at
[renderer.js:465](../src/renderer.js#L465), and `MIN_CELL_PX` is 8. But the reference viewports
render **12, 14, 16, 19, and 12** — the 8px floor is reachable in principle and is not what any
real device shows.

And 002's second point stands untouched: **the head must keep filling its whole cell.** Head and
body are only 1.46:1 apart in luminance, so the full-cell-versus-inset silhouette is load-bearing
for a colour-blind player. Anything that shrinks or breaks the head's fill is a regression.

**Both objections are answerable, and neither is answered by ignoring it.** The detail goes
inside the head without shrinking it, and it is drawn only where there is room for it.

---

## The design

### Two eyes, across the travel

The head gains a pair of round eyes in `--arena`, one either side of the travel axis, both at the
leading edge.

The count is the load-bearing part of this design, and the first attempt at it got the count wrong.
That attempt drew **one** eye, and rendered it did not read as a face — it read as damage. Once
seen, the reason is not subtle:

> 002 rejected *"a via hole, a core, or an inner square"*, and 002 was right about what it was
> looking at. A **single** mark on a filled square is a hole, in any shape and at any position.
> Moving it off-centre changes the reading far less than either 002's rejection or this task's
> first attempt assumed.

So 002 and the owner were never in conflict — they were describing different marks. The first
attempt took 002's count and the owner's request at once and produced the worst of both.

A pair fixes it because the reading is carried by the **count**, not by the shape, the size, or the
position. Two marks with a gap between them, on the leading edge of a square, is a face at every
size above the threshold. The verification therefore asserts **two separated blobs** in all four
directions, because one blob is precisely the failure being corrected and a "there is a mark"
assertion would pass silently.

Direction is `head - neck`. `cells[0]` and `cells[1]` are always orthogonally adjacent — the head
moved into its cell from the neck's — so the travel direction is already in the data and needs no
new state, no new parameter, and no change to `draw(state, effects)`.

**The gap is the token and each eye's size is derived from what is left.** A fixed eye size would
eat the gap as the board shrinks, and at the moment the pair merges it has silently reverted to the
single mark this exists to avoid. Spending the token on the separation makes the separation the
guaranteed quantity. Below the threshold nothing is drawn at all, which is 002's design kept
exactly where 002's reasoning applies.

### Round, not square

`EYE_EXTRA_PX` and `EYE_SHUT_PX` aside, the resting eye is a filled circle drawn with `ctx.arc`,
not a square. A square mark on a square face is a dead pixel — the owner's own words for the first
attempt: *"the said eye was like a pixel tho"*. Roundness is what separates a drawn eye from a
damaged one.

### The mood, and where it comes from

The eyes' **position** is the personality. Their **aperture** is the mood, and the aperture only
moves at events:

| Event | The eyes |
| --- | --- |
| Resting | Two filled circles, `max(2, floor((cellSize − 2·BODY_INSET_PX − gap) / 2))` across |
| **Eat** | Both widen by `EYE_EXTRA_PX` — one mechanic, two readings |
| **Death** | Both close to a horizontal slit `EYE_SHUT_PX` tall, and stay shut |
| **Win** | Nothing |

Both readings come from the effects timeline, never from game state:

- **Eat** is the newest active `EFFECT.EAT` slot's `t`, which the flare already uses. The widen is
  `round(t × EYE_EXTRA_PX)`, retired with the effect, so the aperture needs no state of its own.
- **Death** is `outcomeOf(effects)`, which `paintFrame` already calls. It is called once and passed
  to both the body and the head instead of twice.

**002's invariant survives.** The renderer is told that an event occurred; it still never reads
`phase`, `score`, or `over`. This is the seam 001 designed and 005 used, used again.

### Why it does not need its own reduced-motion code

Reduced motion already resolves a spawned effect to `t = 1` — finished on arrival. So the eat
widen is automatically zero and the eyes rest, while the death slit still lands, because it is a
**state** rather than a motion. The existing policy produces the right answer here without a
branch, which is the test of whether this feature was designed into the system or bolted onto it.

### Contrast, and why the sclera is dark

The reference image draws white eyes with dark pupils. **That figure-ground cannot be reproduced
here, and the measurement says so.** `--snake-head` is #a8ffd8, at relative luminance 0.848, so the
interface ink #e8eef7 measures **1.00:1** against it and pure white only **1.17:1**. There is no
light colour that separates from the head.

The reference's reading is therefore inverted rather than copied — a **dark** eye on a **lit** pad,
the same figure-ground with the values swapped, which measures **15.83:1**. It is a luminance hole,
not a hue difference, so it reads in greyscale and for every form of colour blindness. Copying the
reference literally would have produced an invisible eye.

The head is still drawn as a full cell first, and the eyes are drawn **on top of it**. The head's
fill is never reduced, so the full-cell-versus-inset silhouette is exactly as 002 left it, and the
eyes are a strictly additional cue rather than a replacement for one.

### The rounded trace

Every shape in the snake is drawn with `cornerRadius(size) = min(round(size × CORNER_RATIO),
floor(size / 2))`, each at its **own** size — the head at a full cell, the body segments at their
inset size. That keeps the head visibly larger than the body while making the two the same kind of
thing, which is what the reference does.

A rounded pad on square beads would be two shapes pretending to be one family, and the junction
between them would be the only place in the game where the grammar changes.

Rounding costs the head a little coverage at its extremes — one device pixel per corner at a 12px
cell — but the fill still reaches every edge, and the eight-point probe below confirms it.

---

## What is ruled out

**A mouth.** Considered, because the owner asked for one by name. Rejected at these sizes: a mouth
is a *third* mark, and at a 12px cell it takes the space the gap between the eyes needs.
`CLAUDE.md` — gameplay legibility outranks decoration. The pair carries the whole character.

**One eye.** Tried, rendered, and rejected on sight. Recorded here rather than in the decision
record alone because it is the single most likely thing for a future reader to "simplify" back.

**A light sclera with a dark pupil.** The reference's own reading, and impossible here; see above.

**Any per-frame animation of the eyes' position.** The eyes move when the head turns, which is a
discrete state change, not motion. A continuously wandering eye would be motion that blocks
nothing but means nothing.

**A new palette token for the eyes.** `--arena` is already read into the palette and is already the
substance the head is drawn on top of. The eyes are the substrate showing through, which is what
they should be, and they need no new colour.

---

## Files

| File | Change |
| --- | --- |
| `src/config.js` | `EYE_GAP_RATIO`, `EYE_MIN_CELL_PX`, `EYE_EXTRA_PX`, `EYE_SHUT_PX`, `CORNER_RATIO` |
| `src/renderer.js` | `cornerRadius`; the rounded trace in `paintBody`; the rounded head; the eyes; `outcomeOf` called once and passed to both |
| `docs/decisions/003-snake-head.md` | **New.** Why 002's rejection is lifted, and where it is kept |
| `README.md` | One line, since the identity paragraph described the head's face |

Expected **not** to change: `src/simulation.js` (byte-identical), `src/state.js`, `src/rng.js`,
`src/effects.js`, `src/audio.js`, `src/main.js`, `src/input.js`, `index.html`, `css/main.css`.
This is a rendering change; the game does not learn about it.

---

## Verification

Ran against a served copy of the working tree, driven over CDP. `face-check.mjs` drives
`createRenderer` with synthetic states, which is the only way to pin direction, mood and cell size
exactly; `face-session-check.mjs` is the complement on the real canvas in the real loop; the
screenshots were read directly by eye.

1. **Two eyes, in all four directions.** At a 12px cell, separated mark blobs measured in the
   head's cell: **2 across the travel axis and 2 along it** for each of right, left, down, up —
   and the centroid is on the leading side in all four (right 7.19 > 5.5, left 4.38 < 5.5, down
   6.63 > 5.5, up 3.81 < 5.5). A sign error would look plausible in one direction and wrong in the
   others, which is why it is asserted per direction.
2. **The silhouette survives.** All eight edge probes of the head's cell return `#a8ffd8`: the fill
   still reaches every edge with the eyes present.
3. **The threshold works.** Forced by cell size, not assumed: at 8, 10 and 11px no eye is drawn;
   at 12px and above the pair is present.
4. **Death shuts them and they stay shut.** The head's marked pixels fall 32 → 20 on the death and
   hold at 20 through 4.6 s.
5. **Eat widens them and they return.** 32 → 56 at the moment of the eat, back to 32 once the
   effect retires.
6. **Reduced motion.** With the preference set, an eat leaves the pair at 32 (no widen) while a
   death still collapses it to 20 — the information lands, the motion does not.
7. **Greyscale.** Measured rather than eyeballed: the eye pair is a luminance difference of
   **15.83:1**, so it survives desaturation by construction. The same measurement shows why a light
   sclera could not: ink against the head is **1.00:1**.
8. **On the real canvas, in the real loop.** At 320×568 (DPR 2) and 1440×900, dark pixels are
   present inside the head's cell in the live game, so the face survives the trip from the renderer
   to the screen.
9. **No board regression.** Cell size unchanged at every reference viewport from `main` —
   12 / 14 / 16 / 19 / 12 at 320×568, 375×667, 412×915, 480×720, 844×390 — with no horizontal
   scroll and no layout shift.
10. **Console clean.** Every entry at **every level**, not errors alone, across a full session —
    start, eat, pause, resume, mute, music, die, restart — on the real canvas at both viewports:
    **empty**. Attributed rather than assumed: `src/` contains no `console.*` and no `getImageData`,
    so the `willReadFrequently` warnings an earlier probe run produced were the harness's own, and
    the session harness creates its readback context with the attribute set.
11. **`simulation.js` is byte-identical** to `HEAD`.

Read directly as screenshots: the pair reads as a face at a 12px cell and at a 40px one; on a turn
it swings to the new leading edge; the death pair reads as closed eyes. This is the check the
probes cannot make, and it is the check that caught the first attempt's error.

### Checked and deliberately left alone

The body segment behind the head draws its bridge from a different origin than the rest of the
trace — every other bridge joins two inset cells, but the head is a **full** cell, so the bridge
runs two to four pixels underneath it and can show through where the head's rounding cuts a corner.
It is real, and it was measured: **0 body pixels at cells 12, 14, 16 and 19**, then 2 at 24 and 12
at 40. The largest cell any reference viewport produces is 19. No fix is applied, and
[003](../decisions/003-snake-head.md) records the table so a future task that enlarges the board
finds the measurement rather than rediscovering the artifact.

### Not verifiable here

- **Whether it reads as charming rather than as a defect.** A pair of holes in a moving square
  either looks like a face or looks like dead pixels, and that is a judgement made by an eye on a
  real screen at real speed. The owner has since smoke-tested it and reported it reads as intended,
  which is the evidence a probe could not produce.
- Whether the eat widen is perceptible at a 12px cell. It is one pixel of change and it narrows the
  gap between the eyes to that same single pixel at its peak. The flare carries most of the eat.

---

## Acceptance criteria

- [x] Two eyes draw at 12px and above, and neither draws below the threshold
- [x] The pair is on the leading side of the head's centre, for all four directions
- [x] The pair reads as two **separated** marks, not one, in all four directions
- [x] The head still fills its whole cell — the edge probes are all head-coloured
- [x] The death eyes are two slits and stay that way
- [x] The eyes rest under reduced motion, and the death slit still lands
- [x] The eyes survive desaturation — measured as a 15.83:1 luminance difference
- [x] The board's cell size is unchanged at every reference viewport from `main`
- [x] No console output at any level across a full session
- [x] `simulation.js` is byte-identical
