# 004 — The bed's mix

**Status:** Accepted
**Date:** 2026-10-02
**Task:** [006 — Background music](../tasks/006-background-music.md)
**Supersedes:** part of 006's verification, item 1

---

## Context

006 shipped the bed mixed at `MUSIC.gain: 0.5`, and verified it this way:

> 1. **The bed is audible.** Rendered through an `OfflineAudioContext` with a stubbed clock and
>    asserted non-silent, with a peak inside a sane range — the same method 005 used for the
>    voices, for the same reason: I cannot hear it.

That test passed, and it was the right test for what it could reach: an `OfflineAudioContext`
render says a graph produces samples, and it cannot say whether a phone speaker will reproduce
them. The owner then played it on a phone and reported the run *"was only starts when eating at
first"* — that the music appeared to begin at the first eat, and that it was not loud enough at
full volume.

Both statements are true at once, and that is the finding. The bed was never failing to start.
It starts with the run, it was scheduling correctly, and it was inaudible.

Metered at the destination on a run held **paused** — the bed plays on, no voice fires, so this
is the bed alone — in 100 ms windows over four seconds:

| | peak | loudest 100 ms | median 100 ms | mean |
| --- | --- | --- | --- | --- |
| at 0.5 | 0.121 | 0.0438 (−27.2 dBFS) | 0.00506 (**−45.9 dBFS**) | 0.00867 (−41.2) |
| at 1.5 | 0.184 | 0.0487 (−26.3 dBFS) | 0.0134 (**−37.5 dBFS**) | 0.01346 (−37.4) |

The median window is the number that matters. A bed whose *typical* moment is −46 dBFS is not
quiet music; it is a bed with no audible floor. The eat voice peaks at 0.110, so the first eat
of a run was roughly thirty times the level of everything preceding it — which is exactly the
experience reported.

## Decision

**`MUSIC.gain` goes from 0.5 to 1.5, and `BED_VOICES.pulse` from 0.85 to 0.28 — a pair, chosen
so the pulse's absolute level is unchanged.**

`0.85 × 0.5 = 0.28 × 1.5 = 0.425` before the master. The bus triples, and the one layer that
cannot benefit from the tripling is held exactly where it was.

The pulse is held because of what it is: 110 Hz, which is **below what a phone speaker
reproduces at all**. Tripling the bus with the pulse still on it would spend the new headroom
on a frequency the target device cannot play, while on a device that *can* play it — headphones,
a laptop — the pulse is already the loudest layer in the bed and would come to dominate it. The
figure (220–880 Hz) and the counter-figure (659–1046 Hz) sit squarely in the band a phone
reproduces efficiently, and they are what should carry the bed on a phone. They absorb the whole
increase.

The effect, measured the same way: the median window moves −45.9 → −37.5 dBFS, **+8.4 dB**.

## Why this, and not the alternatives

- **Raise `MASTER_GAIN` instead.** Rejected because it is shared. The four voices were measured
  correct in 005 and were not part of the complaint; raising the master would make the eat, the
  death, the win and the new-best figures louder along with the bed, and would answer a
  complaint about one bus by turning up two.
- **Raise all three bed layers together.** Rejected on the phone-speaker argument above. This is
  the alternative that looks simplest and is the one that would have produced no audible change
  on the device the complaint came from: the low third of the bed's level would go into a
  frequency the speaker discards.
- **Give the figure and the counter-figure their own higher gains and leave the bus alone.**
  Arithmetically identical, rejected as the wrong seam. `MUSIC.gain` is the one place that means
  "the bed as a whole"; splitting the same increase across two layers would leave the next
  reader to re-derive why those two numbers are large and the third is not.
- **Keep the bed under the eat and fix the complaint some other way.** Rejected as a
  contradiction. An acknowledgement that fires up to 8⅓ times a second cannot also be the
  ceiling above a bed that has to be continuously audible. The two requirements cannot both be
  satisfied by level, and only one of them was ever load-bearing.

## What was given up, honestly

**The eat is no longer the highest level on the board, and 006 said it would be.** The composite
bed peaks at 0.184 against the eat's 0.110, because the pulse and a figure note can land on the
same instant and sum. What keeps the acknowledgement on top is now the **duck** alone: at 0.35
it brings that same peak down to 0.064 at the moment the two are heard together. 006's own text
always named the duck as the mechanism — *"without the dip the eat stops being the loudest thing
in the game at exactly the moment it matters most"* — so this is the duck being asked to do the
whole job rather than half of it. **If `duckGain` is ever raised toward 1, the eat stops being
distinguishable over the bed**, and that is a consequence of this decision rather than a
pre-existing property.

The ceiling on the bus is now set by the figure, which shares a band with the eat. At
`0.30 × 1.5 × 0.22 = 0.0990` it is still under the eat's 0.110; much past about 1.67 the two are
level and the dip has to do all of the work unaided. 1.5 is the top of the range that keeps any
arithmetic on its side.

Nothing about the bed's own character changed. The tempo ramp, the three figures, the coprime
16 and 11, the entry point at length 12, and the duck's shape and timing are all untouched —
only two constants moved, and no code path was altered.

## Consequences

- **The acceptance criterion for a bed is not "non-silent".** It is a measured level at the
  destination, in the band the target device reproduces, compared against the voice it must not
  mask. 006's item 1 was honestly written and honestly passed, and it was a weaker test than the
  feature needed — an `OfflineAudioContext` render cannot fail the way this feature failed. Any
  future audio work should be metered at the destination on a real page.
- **The measurement is reproducible and the harness is worth keeping.** A run held paused is the
  clean way to isolate the bed: `syncBed` treats a pause as a run, so the bed keeps playing while
  the snake never moves, never eats and never dies. An `AnalyserNode` spliced in before
  `destination` then meters the finished mix.
- `MUSIC.gain` in `src/config.js` and `BED_VOICES.pulse` in `src/audio.js` are now a **pair**.
  Changing one without the other moves the pulse's absolute level, which is the thing this
  decision exists to hold. Both comments say so at the point of edit.
- `docs/tasks/006-background-music.md` item 1 is superseded here rather than rewritten. It is a
  task record of what was decided at the time, the same relationship 003 has to 006's reversal
  of 005, and to 002's reversal of 001's renderer boundary.
