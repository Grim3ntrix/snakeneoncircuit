# Task 004 — Score Persistence and Statistics

**Status:** Ready for implementation
**Depends on:** 001 (playable core), 002 (visual identity), 003 (touch controls) — all complete
**Followed by:** audio and richer feedback, then final polish

---

## Prerequisite

`simulation.js` and `renderer.js` are correct and must stay untouched. This task is the
first one that writes anything down, which makes it the first one that can be wrong in a
way the player only discovers later — a corrupt record, a record written twice, or a
record that quietly fails to save on the device they actually use.

---

## Note on numbering

Task 001 listed `004 game feel & audio` and `009 persistence & statistics`. That
numbering has not held: 003 became touch controls rather than HUD/screens, and the
README roadmap — the document a visitor reads — lists persistence before audio. This
task takes the README order. Audio is unaffected and remains next; nothing here
precludes it, and both hang off the same `step()` → `OUTCOME` seam.

---

## The problem

**The game has no memory.** Close the tab and everything is gone: the score, the length
you reached, the fact that you played at all. Every session starts from zero, so there is
nothing to beat and no reason to play one more round.

A run only becomes a *record* if something remembers the last one. That is the whole
task: two numbers, kept on the device, shown at the two moments they are worth
reading.

Everything else that the word "statistics" suggests — global play counts, analytics,
leaderboards — remains absolutely deferred. See *Out of scope*.

---

## Scope

### In scope

- **One figure, persisted on the device:** the best score.
- **A record line on the ready overlay**, so the player knows what they are chasing
  before they start.
- **A comparison on the game-over overlay**, so the run they just finished has a
  verdict: a new best, or how far short.
- **An attempt count on the game-over overlay**, so a session has a sense of progress
  even while the record sits still. Session-scoped by design — see *Attempts*.
- **A storage boundary** — one module that owns reading, validating, and writing, and
  that degrades to today's behaviour when storage is unavailable.

### Out of scope

- **Anything global.** `TOTAL PLAYS`, a server API, SQLite, a hosted database, remote
  persistence, analytics, accounts. Task 001 defers these *absolutely* and this task does
  not soften that: they require shared server state, which conflicts with the project's
  no-dependency, no-build-step constraint. It would need its own `docs/decisions/` entry.
- **Any reset or clear-stats affordance.** A control that erases the record is a
  settings-menu feature, and 002 deferred a settings menu deliberately. Clearing
  `localStorage` by hand remains possible and is enough.
- **Per-session or per-day history.** One record, not a log. There is no chart, no
  graph, and no date. The attempt count is a single running number for the page you
  are on, not a history of sessions.
- **Syncing between devices.** `localStorage` is per origin per device. Stated so it is
  not later mistaken for a bug.
- **Stats shown inside the board.** See *Where it is shown*.
- **Anything at all in `simulation.js`.**

---

## Where it lives

### One new module owns the record

`src/storage.js` owns three things, because they are one concern — *the player's saved
record* — and splitting them would put the interesting logic somewhere less obvious:

| Export | Responsibility |
| --- | --- |
| `loadStats()` | Read, parse, validate. Returns defaults if anything is wrong. Never throws. |
| `saveStats(stats)` | Best-effort write. Never throws. |
| `mergeResult(stats, result)` | Pure. Folds one finished run into the record and returns a new object. |

`mergeResult` is pure and takes the current record rather than reading storage itself, so
the folding rules can be exercised without a browser.

### The simulation never learns this exists

`main.js` is the only caller. It already observes the outcome token that `step()` returns
— `ATE`, `DIED_WALL`, `DIED_SELF`, `WON` — and this task adds a branch to that existing
observation. This is exactly the seam [001 specified][001-seam]: *"`step()` returns what
happened; whoever calls it decides what to do with that fact."*

No storage call is added to `simulation.js`, `state.js`, or `renderer.js`.

[001-seam]: 001-playable-core.md

---

## What is stored

### Shape

```json
{ "best": 42, "longest": 17 }
```

Under the key `snakeneoncircuit.stats.v1`, declared in `config.js` beside every other
constant rather than inlined at the call site.

| Field | Meaning |
| --- | --- |
| `best` | Highest score of any finished game |
| `longest` | Greatest snake length reached, in cells, of any finished game. Stored, but never displayed — see below. |

### `longest` is stored, but not shown

The record line reports one figure, `Best 42`. The longest snake is deliberately not
shown beside it, because it is not a second fact. Score and length move together — every
food is a point **and** a cell, from a start of 0 and 3 — so the longest snake is always
the snake from the best-scoring run, and a second figure could only ever be the first one
plus three. Printing it would be printing the same fact twice and inviting the reader to
look for a difference that cannot exist.

It is still stored, because it is the only thing that can say whether *any* game has been
finished. `best` cannot stand in for it: a run that ate nothing leaves it at zero, which
is exactly what a first visit looks like too, so a record line reading `Best 0` would be
indistinguishable from no record line at all. A finished game always leaves `longest` at
3 or more, so `longest > 0` is the test, and it is now the only thing `longest` is read
for.

### Attempts are counted, but not stored

The game-over screen also reports how many runs this session has ended. That is the one
number in this feature that deliberately does **not** go into storage.

**Semantics.** It starts at 1 when the first run of the session ends, and increments
with every run after it. A reload is a new session, so it starts at 1 again: quitting
loses the count, and the record is the only thing that survives.

**Why not persisted.** A career total is a different number with a different meaning.
It can only ever go up, so it says nothing about the sitting the player is in, and it
turns the screen that ends a run into a ledger. What is worth knowing at the moment of
dying is *how many times have I tried this session* — which is precisely the number a
stored total would destroy. Not storing it also keeps one promise intact: clearing site
data clears everything the game knows about you.

**Where it lives.** A plain counter in `main.js`, recreated by the reload that drops
it. It is never written anywhere, which is the point.

### The version lives in the key

`v1` is part of the key, not a field in the object. A future schema is therefore a
different key, and data written by this version can never be read back as though it were
the newer shape. That is the entire failure mode versioning exists to prevent, and this
costs nothing to get right the first time. No migration path is written, because there is
nothing to migrate.

### Validation is total, and rejection is all-or-nothing

Stored data is external input. It can be edited by hand, truncated by a quota error, or
written by an older build. So `loadStats()` treats **any** of the following as "no record
exists", silently returning the defaults:

- The key is absent.
- The value is not valid JSON.
- The value is not a JSON object — an array, a string, a number, `null`.
- Any of the two fields is missing, not a number, not an integer, negative, or
  `NaN`/`Infinity`.

A record with one bad field is rejected **whole**, not salvaged field by field. A
half-valid record means something wrote it wrongly, and guessing which half to trust is
how a wrong number becomes permanent. One rule, applied once.

Only the two known fields are ever read out, so extra properties in the stored JSON are
inert — including a count left behind by some other build.

---

## When it is written

**When a run finishes** — not per tick, not per food, not on a timer. Repeating the
write is harmless rather than merely tolerated, and that is what makes its placement
inside the frame loop safe.

"Finished" means the simulation reported a terminal outcome: `DIED_WALL`, `DIED_SELF`,
or `WON`. A game abandoned by closing the tab, or one still sitting on the ready screen,
is not finished and is not recorded. That is honest: the record describes runs that
reached an end.

A terminal outcome is produced at most once per run — the phase becomes `OVER` on it,
and the drain loop skips `step()` for any phase but `PLAYING` — so `finishRun()` runs
once. It is not *required* to, and that is the stronger property: every stored field is
the maximum of the old value and the new one, so folding the same run in twice changes
nothing. The harness asserts that idempotence directly rather than inferring it from the
loop, because the loop is a thing that changes and a maximum is a thing that does not.

A **win** is a finished game: it is recorded, and `longest` becomes the full board.

---

## Where it is shown

One figure in the record and one in the session, across two places, and **not the HUD**.
The reasoning is below each.

### The ready overlay — the record

One quiet line under the existing instruction:

```
Best 42
```

- **Why here.** The ready screen is the only moment the player is idle with nothing to
  read. It is precisely when a record is worth knowing, because it is what they are
  about to try to beat. Every other screen has something more important on it.
- **Hidden entirely until there is something to show.** With no record the line does not
  render at all. A first visit is byte-for-byte the experience it is today — no
  `Best 0`, no empty state, no placeholder. First-ever visit is a named edge case in the
  refinement pass and it does not get a worse screen for this feature existing.
- **One figure, not two or three.** The longest snake is not a second fact, and a count
  of games belongs on the screen that ends a game rather than the one that starts it;
  see *`longest` is stored, but not shown* and *Attempts*. It is also what keeps the
  line comfortably inside the narrowest panel the layout can produce, which the harness
  measures rather than assumes.

### The game-over overlay — the verdict

The existing detail line gains the comparison:

| Situation | Detail line |
| --- | --- |
| New record | `Score 42 ✦ New best` |
| Record intact | `Score 12 · Best 42` |
| Win, new record | `Perfect run — score 576 ✦ New best` |
| Win, record intact | `Perfect run — score 576 · Best 600` |

A tie is **not** a new best. Only strictly greater replaces the record, so the phrase
"New best" keeps meaning something.

A new best takes a star where every other comparison takes the `·` separator. Reusing
the separator that introduces a record the run *failed* to beat would say the opposite of
what the line means. The glyph is drawn by CSS on an empty, `aria-hidden` span, so it
adds no text: the string a screen reader is handed is still `Score 42 New best`, and the
two readings are told apart by shape rather than by colour.

This line sits inside the over overlay's existing `aria-live="polite"`, so it is
announced rather than being a visual-only change.

### The game-over overlay — the attempts

A second, quieter line under the verdict:

```
Attempts 3
```

- **Why here.** A run that did not beat the record still has something to say for
  itself, and at the moment of dying the number that answers "am I getting anywhere?"
  is how many times you have tried in this sitting. On the ready screen the same number
  would be a preview rather than a result — nothing has happened yet to count.
- **Quieter than the line above it.** A step down in size and dimmer, so the screen
  still reads score first and count second. It shares a class with the record line,
  because they are the same thing: a supplementary figure line supporting the line
  above it.
- **Never suppressed.** Unlike the record, this always renders — `Attempts 1` on the
  first loss is the number, not an empty state.
- **Not in the record.** See *Attempts are counted, but not stored*. It is a session
  figure and it says so by disappearing on reload.

### Not the HUD, and why

Putting `BEST` in the HUD row is the obvious move and is rejected on measurement, not
taste. Task 003 established that the HUD competes with the board for height, and that
anything added there is paid for by the board's cell size — the same reasoning that moved
the pause control out of the HUD row. A statistic is not worth a smaller play field.

It is also the wrong emphasis. Task 002 fixes the visual hierarchy as board first, then
score, then everything else. A career total sitting beside the live score would rank
itself above the thing the player is actually doing. The ready screen is where a record
belongs, and the over screen is where a verdict belongs.

---

## When storage is unavailable

`localStorage` is not reliably present. It throws on `setItem` in Safari's private mode,
it is absent entirely in some embedded and locked-down contexts, and it can be full.

**The rule: the game is identical, minus the memory.** No error, no toast, no degraded
layout, no missing element where the record line should be, and nothing in the console.

- `loadStats()` returns the defaults and the record line stays hidden.
- `saveStats()` does nothing at all, silently.

Both wrap every storage access, including the property access itself — reading
`window.localStorage` can throw, not just the methods on it.

This is the same posture as the rest of the project: a capability the browser may not
have is a branch, not an error. Task 003 handled `pointer: coarse` the same way.

---

## Accessibility

- The record line is **text**, not an image or a canvas overlay, so it is readable,
  selectable, and translatable by the browser.
- Every line on the over screen — the verdict and the attempt count — sits inside that
  overlay's existing `aria-live="polite"`, so both are announced. Nothing about the
  attempt count is carried by the visual treatment alone.
- The record line on the ready screen only ever changes between runs, while the overlay
  is hidden. It is not a live region and must not become one — announcing a record over
  the top of the ready instruction would talk over the thing the player needs to hear.
- Figures use the existing tabular-figures treatment, so a record does not jitter as it
  counts from 9 to 10.
- The line does not introduce a focusable element, so the tab order is unchanged and
  task 003's focus work is untouched.
- Nothing here relies on colour to be understood.

---

## Invariants this task must not break

- `simulation.js` is byte-identical. No rule, no timing, no state shape changes.
- `renderer.js` does not reference stats, storage, or the record. `draw(state)` still
  takes `state` alone.
- `step(state)` remains a pure-ish state mutation returning an outcome token. No I/O.
- The game is still deterministic: the same seed and inputs produce the same run. The
  record is *about* runs and never feeds into one.
- The board's cell size does not regress at any reference viewport — which the decision
  not to touch the HUD should make automatic, and which is measured anyway.
- With no record stored, the ready screen is unchanged from today.
- With storage unavailable, every screen is unchanged from today.
- No new dependency, no build step, no `package.json`. `localStorage` is browser-native.
- Console is clean, including on the corrupt-data and storage-unavailable paths.

---

## Files

| File | Change |
| --- | --- |
| `src/storage.js` | **New.** The record: load, validate, save, and the pure merge |
| `src/config.js` | Add the storage key |
| `src/main.js` | Fold the finished run in, count the session's attempts, render both lines |
| `index.html` | The record line on the ready overlay, the attempt line on the over overlay |
| `css/main.css` | Their styling, from existing tokens only |
| `docs/tasks/004-score-persistence.md` | This document |

**Must not change:** `src/simulation.js`, `src/renderer.js`, `src/state.js`,
`src/rng.js`, `src/input.js`.

If implementation appears to require touching any of those, that is a signal the design
has drifted, not a signal to widen the task. Stop and reconsider.

---

## Verification

### Automated, in a real browser

Driven over the DevTools Protocol, the same harness style used for 003:

1. **Round-trip** — play a game to a loss, reload, and the record is still there with the
   right figures.
2. **Idempotence** — folding the same run into the record twice changes nothing, and the
   record is byte-identical after three seconds of idle frames on the over screen.
3. **New-best detection** — a run that beats the record replaces it; a run that ties it
   does not claim "New best". The mark is asserted in a real browser: present on the
   new-best line and absent on the record-intact one, `aria-hidden`, drawing the glyph in
   the live accent, one line box, and with `textContent` and `innerText` both still
   exactly `Score N New best` — the glyph adds no text to the sentence.
4. **`longest` in storage** — set by a long run, and not lowered by a short one
   afterwards. It is no longer displayed, so what is asserted is the stored value, and
   that it is what decides whether the record line renders at all — including the case
   where it is the only thing distinguishing a finished game scoring zero from a first
   visit.
5. **Win path** — a cleared board records `longest` as the full board, and adds no count.
6. **Corrupt data** — for each of: invalid JSON, a JSON array, `null`, a missing field, a
   negative number, a float, a string where a number belongs — the page loads with
   defaults, renders correctly, and logs nothing.
7. **Storage unavailable** — with `localStorage` stubbed to throw on access, the game
   plays end to end, no record line renders, and the console is clean.
8. **First visit** — with storage empty, the ready screen contains no record line and is
   otherwise identical to the pre-task build.
9. **Attempts** — three runs in one page read `Attempts 1`, `2`, `3`; a reload drops the
   count back to one while the record survives; and no count ever reaches storage.
10. **No console errors, no exceptions, no browser log errors** across every scenario above.
11. **Layout** — no cell-size regression, no horizontal scroll, and the record line still
    a single line box at 320×568, 375×667, 412×915, 480×720, 844×390, and 1440×900.
12. **No layout shift** — the HUD, board, canvas, pause control, and pad occupy identical
    boxes whether or not the record line is present.

### Not verifiable here

Reported as unverified rather than claimed:

- Real Safari private browsing, where the write genuinely fails.
- Quota exhaustion on a real device.
- Whether the record line reads well at a glance on a phone in daylight.
- Cross-device: stated as out of scope, so there is nothing to test.

---

## Acceptance criteria

### Persistence

- [x] The best score survives a reload
- [x] A finished run is folded into the record, and only finished runs are
- [x] Attempts count runs within a session, and a reload starts them again at one
- [x] Attempts are never written to storage
- [x] A win is recorded, with `longest` equal to the full board
- [x] A tie does not claim a new best
- [x] A new best is marked with a star, and the mark adds no text to the sentence
- [x] The record line reports one figure and still hides itself on a first visit
- [x] Reloading with no record present is indistinguishable from today's build

### Integrity

- [x] Corrupt, truncated, or hostile stored data falls back to defaults without throwing
- [x] A record with one invalid field is rejected whole
- [x] The version is part of the storage key
- [x] With storage unavailable, the game is fully playable and silent
- [x] `simulation.js` is byte-identical
- [x] `renderer.js` does not reference stats, storage, or the record
- [x] The run is unaffected by the record — same seed, same inputs, same run

### Interface

- [x] The ready overlay shows the record only when there is one
- [x] The over overlay states whether the run was a new best
- [x] The over overlay counts the session's attempts, and always renders the line
- [x] A stale count in stored data is ignored rather than read as a third figure
- [x] The HUD is unchanged
- [x] The record line uses existing design tokens and no new colour
- [x] The record line reads as prose, with no count to pluralise wrongly
- [x] No layout shift when the record line appears or is absent
- [x] No cell-size regression at any reference viewport

### Quality

- [x] No console errors on any path, including corrupt data and storage unavailable
- [x] No new file beyond `src/storage.js`, no dependency, no build step
- [x] Reduced motion, keyboard operation, and touch controls are unaffected

---

## Deliberately deferred

- **A reset or clear-stats control.** See *Out of scope*.
- **Any global or cross-device statistic.** Task 001's absolute deferral stands.
- **History, charts, streaks, per-day figures.** Two totals, and the restraint is the
  point — a stats panel that competes with the board would violate task 002's hierarchy.
- **An export or import of the record.** Nobody has asked, and it needs a UI.
- **Audio, difficulty progression, further gameplay.** Unchanged from 001, 002, and 003.
- **Any change to `simulation.js` or `renderer.js`.**

---

## Definition of Done

1. It works, including corrupt data, unavailable storage, and a first visit.
2. The refinement pass has been run — see the `polish-pass` skill.
3. It is verified in a browser at narrow and wide viewports, and on a phone.
4. No console errors, dead code, or placeholders remain.
5. Every invariant above holds, and `simulation.js` and `renderer.js` are untouched.
6. You can answer yes to: *does this feel finished, and would it read as intentionally
   designed in a portfolio?*
