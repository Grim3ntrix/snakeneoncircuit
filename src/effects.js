import { EFFECT_MS, TICK_MS } from './config.js';

/**
 * What just happened, and how far through being shown it is.
 *
 * Deliberately not part of `state`. The simulation must not know that a flare
 * exists, and nothing here may be able to change what the game does: these are
 * outputs of a run, never inputs to one.
 *
 * No DOM, no canvas, and no clock. The caller advances this by a delta and the
 * renderer reads it, which leaves the module arithmetic over numbers — and so
 * testable under Node, the same way the simulation is.
 */

export const EFFECT = Object.freeze({
  EAT: 'eat',
  DEATH: 'death',
  WIN: 'win',
});

/**
 * The one effect whose end state is a state the board rests in.
 *
 * A death leaves the signal out, and out is where it stays until the next run, so
 * this effect is held rather than retired when it completes. The other two pass
 * through and leave the board as they found it, which is also why this set decides
 * what survives reduced motion: an effect with no travel says nothing without it.
 */
const SETTLES = new Set([EFFECT.DEATH]);

// A flare lives for EFFECT_MS.eat while the simulation ticks every TICK_MS, so at
// most this many can be in flight at once. Derived rather than chosen, so changing
// either constant cannot silently overflow the timeline — and one spare, so the
// full-timeline policy is exercised by reality rather than only by a burst no
// player can produce.
const EAT_SLOTS = Math.ceil(EFFECT_MS.eat / TICK_MS) + 1;

// `t` runs 0 to 1 over the effect's duration; everything else is where it happened.
function createSlot() {
  return { active: false, kind: null, x: 0, y: 0, t: 0 };
}

/**
 * @param {{reducedMotion?: boolean}} [options]
 * @returns {{
 *   spawn: (kind: string, cell?: {x: number, y: number}) => void,
 *   advance: (dt: number) => void,
 *   clear: () => void,
 *   slots: ReadonlyArray<{active: boolean, kind: string|null, x: number, y: number, t: number}>,
 * }}
 */
export function createEffects({ reducedMotion = false } = {}) {
  // Every slot is allocated here and reused for the life of the page. `advance`
  // and the draw path only ever assign to them, which is what keeps the per-frame
  // cost flat.
  const slots = [];
  for (let i = 0; i < EAT_SLOTS; i += 1) slots.push(createSlot());

  // One slot for the outcome, because the game ends on it and cannot produce a
  // second. Kept last so the eater slots are the contiguous run at the front.
  slots.push(createSlot());
  const outcome = slots[EAT_SLOTS];

  /**
   * The slot a new flare takes: the first free one, or — if every slot is somehow
   * in flight — the one closest to finishing.
   *
   * Reusing the oldest keeps the newest eat, which is the one the player is looking
   * at. Dropping it instead would discard the acknowledgement that matters in order
   * to preserve one they have already seen. The scan is bounded by EAT_SLOTS, so it
   * allocates nothing and cannot loop.
   */
  function nextEatSlot() {
    let oldest = 0;
    for (let i = 0; i < EAT_SLOTS; i += 1) {
      if (!slots[i].active) return slots[i];
      if (slots[i].t > slots[oldest].t) oldest = i;
    }
    return slots[oldest];
  }

  /**
   * Record that something happened.
   *
   * @param {string} kind an EFFECT value
   * @param {{x: number, y: number}} [cell] where it happened. Read by EAT alone;
   *   the outcome effects travel the whole trace rather than starting at a point.
   */
  function spawn(kind, cell) {
    if (reducedMotion && !SETTLES.has(kind)) return;

    const slot = kind === EFFECT.EAT ? nextEatSlot() : outcome;
    slot.active = true;
    slot.kind = kind;
    if (cell !== undefined) {
      slot.x = cell.x;
      slot.y = cell.y;
    }

    // Reduced motion skips the travel and keeps the fact: a death still reads as a
    // death, it simply arrives already finished.
    slot.t = reducedMotion ? 1 : 0;
  }

  /**
   * Age every live effect by one frame.
   *
   * The delta is the caller's and is already clamped upstream, so a stall or a
   * resumed tab retires an effect rather than leaving it frozen mid-flight.
   */
  function advance(dt) {
    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      if (!slot.active) continue;

      slot.t += dt / EFFECT_MS[slot.kind];
      if (slot.t < 1) continue;

      if (SETTLES.has(slot.kind)) {
        // Held at its end state, which is the whole point of the effect.
        slot.t = 1;
      } else {
        slot.active = false;
        slot.kind = null;
        slot.t = 0;
      }
    }
  }

  /**
   * Forget everything.
   *
   * Called when a run begins. A settled trace belongs to the run that ended, and
   * the new one starts with its signal intact.
   */
  function clear() {
    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      slot.active = false;
      slot.kind = null;
      slot.t = 0;
    }
  }

  return { spawn, advance, clear, slots };
}
