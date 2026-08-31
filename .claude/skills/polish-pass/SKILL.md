---
name: polish-pass
description: The mandatory refinement pass for user-facing work in this repository. Use after a feature, screen, animation, or interaction functions but before reporting it complete, when asked to polish or refine or improve game feel, or when judging whether something looks and feels finished rather than merely working.
---

# Polish pass

Working code is the halfway point. This pass turns something that works into something that feels finished.

Run it when a user-facing change functions and you are about to report it complete, when asked to polish or refine, or when an area feels off and you need a systematic read of why.

Do not treat it as a checkbox exercise. Every step should produce real changes or an explicit, reasoned "already right".

## 1. Look at it as a stranger

Stop reading code and use the thing.

- Play a full round. Lose on purpose. Pause mid-move. Mash keys. Resize mid-game. Reload. Come back after a minute away.
- Write down every moment of friction, hesitation, or ugliness the instant you notice it, before you start rationalizing it.

That raw list is the agenda for this pass. Do not shorten it because a fix looks inconvenient.

## 2. Subtract first

Before adding anything, find what should go. Hunt for anything that reads as generic, unfinished, awkward, excessive, inconsistent, placeholder-like, or needlessly complicated.

Common finds: default browser styling left in place; effects that communicate nothing; two animations competing for attention; two elements doing one element's job; decorative noise over the play field; filler copy; unused CSS or JS; values that contradict the spacing or type scale; three shades of nearly the same color.

Removal is usually the highest-value work in this pass.

## 3. Audit by dimension

The standards themselves live in `CLAUDE.md` under Gameplay quality, UI/UX quality, and Visual direction. This section is how you check them, not a second copy of them — when a threshold matters, `CLAUDE.md` is the source of truth.

**Visual** — hierarchy holds at a glance; alignment sits on a grid; spacing is optically consistent; palette is limited and applied consistently; type scale respected; radii, borders, and shadows consistent; text and UI contrast passes; nothing looks accidental.

**Motion and timing** — durations are short, roughly 120–240ms for UI, longer only with intent; one easing vocabulary; entrances and exits agree with each other; nothing janks or blocks input; `prefers-reduced-motion` genuinely respected; nothing animates every frame that does not need to.

**Game feel** — input feels immediate and a press is acknowledged within a frame; eating, scoring, and dying each get distinct feedback proportionate to the event; the difficulty ramp is legible to the player; death reads clearly and restart is instant; no dead air between rounds.

**Responsive** — 320px through large desktop; no horizontal scroll; no layout shift; the board stays legible and correctly proportioned; touch controls reachable one-handed; phone landscape works; rendering is crisp at fractional device pixel ratios.

**Accessibility** — a complete keyboard path with visible focus; sensible focus order; meaningful state changes announced; no color-only signals; touch targets large enough; reduced motion honored in practice, not just declared; text can scale without breaking layout.

**Performance** — frame rate steady during play; no per-frame allocation or accumulating listeners; no layout thrash; a long session does not degrade; first paint is fast.

**Consistency** — one name per concept across code and UI; shared tokens rather than local copies; the same interaction pattern for the same kind of action.

**Edge cases** — first ever visit; missing stored data; corrupt stored data; a nearly full board; a very long session; rapid restarts; the tab hidden during play; two tabs open at once.

**Copy and detail** — labels precise and consistently cased; numbers formatted and aligned so they do not jitter; no truncation; title, favicon, and meta set; no lorem or debug text.

## 4. Fix, then re-verify

Fix in order of how much a player would notice, not how easy each fix is. Then re-run steps 1 and 3 over everything you touched — polish changes routinely introduce new inconsistencies.

## 5. Ask the final questions

Answer honestly:

- Does this merely work, or does it feel finished?
- Shown as a portfolio piece, would it read as intentionally designed?
- Is anything here present only because it was easy to add?

If any answer is unsatisfying, iterate. Otherwise report what you changed, what you deliberately removed, and anything you consciously left alone and why.

## Guardrails

- Quality, not excess. Never add effects to look impressive; the calmer result is often the more polished one.
- Refine the existing intent. Do not redesign a working design mid-pass.
- Do not polish by adding dependencies.
- If a finding requires an architectural change, raise it and record the decision in `docs/decisions/` rather than smuggling it in.
