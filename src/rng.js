/**
 * Seeded pseudo-random number generator.
 *
 * The project requires that identical inputs and an identical seed produce an
 * identical run. Seeding food placement is what makes that true, and it is
 * also what will let a run be replayed or a daily-seed mode be added later.
 */

/**
 * mulberry32 — small, fast, and good enough for placing food on a grid.
 * @param {number} seed
 * @returns {() => number} generator producing values in [0, 1)
 */
export function createRng(seed) {
  let state = seed >>> 0;

  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A fresh seed for a new game.
 *
 * Time alone is too coarse — two restarts inside the same millisecond would
 * deal the same food. The random component widens it. Reproducibility comes
 * from the seed being stored on the state, not from this being predictable.
 *
 * @returns {number} unsigned 32-bit seed
 */
export function randomSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
}
