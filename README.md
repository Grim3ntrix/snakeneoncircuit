# Snake Neon Circuit

A polished, framework-free take on retro Snake — built to feel finished, not just to work.

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
![Dependencies: none](https://img.shields.io/badge/dependencies-none-black.svg)
![Vanilla JS](https://img.shields.io/badge/vanilla-HTML%20%2F%20CSS%20%2F%20JS-black.svg)

## Status

**Early development.** The repository currently contains project scaffolding only — there is no gameplay code yet. Sections below marked _planned_ describe intent, not shipped behavior.

## About

Snake is a solved problem, so the interesting part is everything around it: input that feels immediate, timing that stays honest across refresh rates, a deliberate visual identity, and an interface that works as well on a phone as on a desktop.

The guiding standard for this project is that functional does not mean finished. Every user-facing change gets a dedicated refinement pass before it counts as done.

## Tech

- HTML, CSS, and JavaScript (ES modules)
- Canvas 2D for rendering
- No frameworks, no bundler, no build step, no dependencies

Browser-native capability is preferred over adding a library. Dependencies are treated as a cost that has to be justified.

## Getting started

There is nothing to install.

```bash
git clone https://github.com/Grim3ntrix/snakeneoncircuit.git
cd snakeneoncircuit
```

Once the game exists, open `index.html` directly, or serve the folder to avoid ES module restrictions on `file://`:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

## Project structure

```
CLAUDE.md     Engineering, UX, and polish standards for this repo
.claude/      Claude Code workflows (refinement pass skill + /polish command)
docs/tasks/   Specifications for individual pieces of work
LICENSE       MIT
```

Planned, added when first needed:

```
index.html    Entry point
src/          Game simulation, rendering, input, persistence
docs/decisions/  Architectural decision notes
```

## Roadmap

Indicative, not a specification.

- [ ] Core gameplay: fixed-timestep simulation, deterministic movement, exact collision
- [ ] Visual identity and interface
- [ ] Responsive layout and touch controls
- [ ] Score persistence and statistics
- [ ] Accessibility pass: keyboard, contrast, reduced motion

## Development

Engineering, gameplay, UI/UX, and visual standards live in [CLAUDE.md](CLAUDE.md). It is written as instructions for Claude Code, but it doubles as the contribution guide — the expectations are the same for humans.

The short version: keep it vanilla, keep it simple, separate simulation from rendering, verify in a real browser, and refine before declaring anything complete.

## License

[MIT](LICENSE) © 2026 Richard Samberi
