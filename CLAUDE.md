# CLAUDE.md

Persistent instructions for Claude Code working in this repository.

## Project

`snakeneoncircuit` — a small, framework-free web game. The end goal is a retro Snake game that is exceptionally polished.

Current state: no application code exists yet. Do not assume any tooling, build step, or file layout you have not verified.

## The standard

> Impress through polish, originality, responsiveness, and attention to detail — not by satisfying functional requirements.

Functional is not finished. This applies to every user-facing change, not only to a final release.

## Where things live

| Need | Location |
| --- | --- |
| Change Claude's permanent behavior | this file (`CLAUDE.md`) |
| A repeatable Claude workflow or long procedure | `.claude/skills/<name>/SKILL.md` |
| A manual trigger for such a workflow | `.claude/commands/<name>.md` |
| Shared Claude config (permissions, hooks, env) | `.claude/settings.json` — create only when a real need exists |
| Personal Claude config | `.claude/settings.local.json` (gitignored, never commit) |
| Project documentation | `README.md`, `docs/` |
| Architectural decisions | `docs/decisions/NNN-short-title.md` |
| A specific piece of work to do | `docs/tasks/<task>.md` |

Each rule belongs in exactly one place. If a rule here would need more than a few lines of procedure, move the procedure into a skill and keep one line here.

## Vanilla web constraint

- No frameworks, bundlers, transpilers, or build step unless a task explicitly establishes one.
- Reach for browser-native capability first: ES modules, Canvas 2D, `requestAnimationFrame`, CSS custom properties, Pointer Events, `localStorage`, `matchMedia`.
- Every dependency is a cost. The default answer is no. If you add one, record why in `docs/decisions/`.
- Do not overengineer. This is a small project — match the architecture to that size.
- No abstraction on first use. Introduce one when a second real case exists, not in anticipation of one.

## Engineering standards

- Separate concerns: simulation/state, rendering, input, and persistence are distinct units. Simulation code must not touch the DOM.
- Small modules with one responsibility and honest names. Name things after what they are, not after the pattern used.
- Single source of truth for constants, timings, and design tokens. No magic number duplicated across files.
- Validate at boundaries — user input, stored data, DOM lookups, external state. Trust your own internals; do not scatter defensive checks through pure logic.
- Predictable behavior: no implicit globals, no hidden side effects, no mutation of arguments.
- Delete dead and commented-out code. Leave no placeholders, TODOs, or stubs in work you call finished.
- Comments explain *why*. A comment that restates the code should become a better name instead.
- Once code exists, match its established style. Consistency beats personal preference.

## Gameplay quality

Apply when implementing gameplay:

- Fixed-timestep simulation, decoupled from render. Behavior must not change with frame rate or refresh rate.
- Deterministic: the same inputs and seed produce the same run.
- Never lose an input. Buffer direction changes so a fast press inside one tick still registers, and reject illegal moves such as instant reversal explicitly rather than by accident.
- Collision rules exact at the edges: wall, self, the tail on the frame it vacates a cell, and the last free cell when the board fills.
- An explicit state machine for ready / playing / paused / over. No boolean soup.
- Handle real conditions: `visibilitychange` and blur, resize, device pixel ratio, touch input, storage unavailable.
- No per-frame allocation or listener growth. Frame cost stays flat across a long session.

## UI/UX quality

Visual and interaction design are engineering concerns here, not decoration.

- Clear hierarchy: the eye lands on the play field first, then score, then everything else.
- Deliberate spacing and type scale. Use a scale, not one-off values.
- Every interactive element has visible hover, active, `:focus-visible`, and disabled states.
- Keyboard operable end to end with visible focus. Never remove an outline without a better replacement.
- Meet WCAG AA contrast for text and UI. Keep gameplay elements distinguishable without relying on color alone.
- Honor `prefers-reduced-motion`.
- Touch targets at least 44×44 CSS px. Playable one-handed on a phone.
- Responsive from ~320px to large desktop, with no layout shift and no horizontal scroll.
- Feedback for every action. Nothing should feel unacknowledged.

## Visual direction

The game must have a deliberate identity. It must not read as a tutorial project, a generic Snake clone, a stock cyberpunk template, generated UI, or a pile of unrelated effects.

- Commit to one coherent system: a limited palette, consistent radii, one motion vocabulary of shared easings and durations.
- Restraint over accumulation. Each effect earns its place by aiding legibility, feedback, or identity. Remove the rest.
- Gameplay legibility outranks decoration. If an effect makes the snake, food, or board harder to read, it goes.
- Motion is short and purposeful, and never blocks input.

## Refinement is mandatory

Once a user-facing feature works, run a dedicated refinement pass before calling it done — see the `polish-pass` skill, or `/polish`. This is a required step, not an optional extra.

The pass subtracts as much as it adds; removing something generic, excessive, or unfinished counts as progress. Never add effects in order to seem impressive.

## Autonomy

Decide and proceed. Do not ask permission for routine implementation details.

When several valid approaches exist, weigh project constraints, maintainability, user experience, and performance, then choose one and move on. Record genuinely significant architectural choices in `docs/decisions/`.

Ask only when a decision would materially change requirements, architecture, or user-facing behavior — or when proceeding could be destructive.

## Verification

Verify your own work. Never report something as working that you have not exercised.

- Inspect what the repository actually provides before running anything: `package.json` scripts, config files, an existing test setup. Do not invent commands or require tooling that does not exist.
- With no tooling present, verification means reading the diff critically and exercising the change in a real browser.
- Zero console errors or warnings during normal use.
- Check a narrow viewport, keyboard-only operation, and reduced motion before declaring UI work done.
- When tooling is added later, run it and keep it green.

## Definition of done

A user-facing change is done only when:

1. It works, including its edge cases.
2. The refinement pass has been run.
3. It is verified in a browser at narrow and wide viewports.
4. No console errors, dead code, or placeholders remain.
5. You can answer yes to: *does this feel finished, and would it read as intentionally designed in a portfolio?*

If not, refine it before reporting completion.

## Repository safety

- Do not commit or push unless asked, and do not do substantial work directly on `main`.
- Do not add dependencies, tooling, or configuration silently.
- Do not delete or rewrite existing documentation without a reason.
