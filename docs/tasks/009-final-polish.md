# Task 009 — Final Polish

The game is feature-complete and playable. This task is the last refinement
pass before the project counts as finished: the README as a public face,
the repository as a portfolio piece, and anything that reads as unfinished
or placeholder-like.

---

## The design

### README

The README is the first thing a visitor sees. It should read as intentional
rather than assembled:

1. **A play badge.** A link to the live build, prominent enough that a visitor
   does not have to hunt for it. The badge lives with the existing shields at
   the top of the file and links to the GitHub Pages URL.
2. **Screenshots.** Two images: one of the board at rest, one of gameplay in
   progress. They sit between About and Play it locally, sized to the same
   width as the table below them. Images live in `docs/screenshots/` and are
   referenced by relative path so they render on GitHub and on the project
   site without any extra configuration.

### Repository

No `TODO`s, `FIXME`s, placeholder paths, or commented-out blocks anywhere
in work that counts as finished. The docs/decisions/ record is current with
the architecture.

---

## What is deliberately left alone

- The bridge-bleed artifact recorded in decision 003. It is unreachable on
  any real viewport and is not a defect in play.
- The `expands` assertion in `render-check.mjs` that compares
  `growth[3].extent > growth[0].extent` past a readability threshold. The
  honest effect is stranded by a `null` return, not by a wrong measurement.
