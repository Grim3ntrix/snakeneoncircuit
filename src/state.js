import { COLS, ROWS, START_LENGTH, START_HEAD, START_DIRECTION } from './config.js';
import { createRng, randomSeed } from './rng.js';

export const PHASE = Object.freeze({
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  OVER: 'over',
});

export const REASON = Object.freeze({
  WALL: 'wall',
  SELF: 'self',
  WIN: 'win',
});

/**
 * Every grid cell the snake does not currently occupy.
 *
 * Building the full list rather than probing random cells until one misses the
 * snake is deliberate: it cannot loop forever, it cannot fail on a nearly full
 * board, and it costs one pass over the grid. The caller decides what an empty
 * list means.
 *
 * @param {{x: number, y: number}[]} cells
 * @returns {{x: number, y: number}[]}
 */
export function freeCells(cells) {
  const occupied = new Set();
  for (const cell of cells) occupied.add(cell.y * COLS + cell.x);

  const free = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!occupied.has(y * COLS + x)) free.push({ x, y });
    }
  }
  return free;
}

/**
 * The only way a game begins.
 *
 * Restart calls this again rather than resetting fields on the previous state,
 * which makes leaking state between runs structurally impossible instead of
 * something we have to remember to avoid. A forgotten field cannot survive a
 * wholesale replacement.
 *
 * @param {{seed?: number}} [options]
 */
export function createInitialState({ seed = randomSeed() } = {}) {
  const cells = [];
  for (let i = 0; i < START_LENGTH; i += 1) {
    cells.push({ x: START_HEAD.x - i, y: START_HEAD.y });
  }

  const rng = createRng(seed);
  const free = freeCells(cells);
  const food = free.length > 0 ? free[Math.floor(rng() * free.length)] : null;

  return {
    phase: PHASE.READY,
    cells,
    direction: { x: START_DIRECTION.x, y: START_DIRECTION.y },
    pending: [],
    food,
    score: 0,
    seed,
    rng,
    over: null,
  };
}
