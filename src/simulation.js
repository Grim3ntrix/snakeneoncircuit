import { COLS, ROWS, MAX_QUEUED_INPUTS, SCORE_PER_FOOD } from './config.js';
import { PHASE, REASON, freeCells } from './state.js';

/**
 * What a single tick produced.
 *
 * `step` mutates state and returns one of these as a *signal* for the caller —
 * the authoritative record stays in `state.phase` and `state.over`. This is the
 * seam that lets feedback, audio, and statistics hook in later without the
 * simulation knowing any of them exist.
 */
export const OUTCOME = Object.freeze({
  NONE: 'none',
  ATE: 'ate',
  DIED_WALL: 'died-wall',
  DIED_SELF: 'died-self',
  WON: 'won',
});

/**
 * Is `dir` a no-op repeat of, or an exact reversal of, `ref`?
 *
 * Both must be rejected. A reversal would drive the snake into its own neck.
 * A repeat is not illegal, but it silently fills the queue — and with a cap of
 * two, two auto-repeat events would block the turn the player actually meant.
 */
export function isRedundantOrReversal(dir, ref) {
  const same = dir.x === ref.x && dir.y === ref.y;
  const opposite = dir.x === -ref.x && dir.y === -ref.y;
  return same || opposite;
}

/**
 * The direction a new input must be validated against: the last direction
 * already queued, or the direction in force if nothing is queued.
 *
 * Validating against `state.direction` alone is the classic bug. Two inputs
 * arriving inside one tick would both be checked against the stale direction,
 * so a reversal could slip through the second one.
 */
export function referenceDirection(state) {
  return state.pending.length > 0 ? state.pending[state.pending.length - 1] : state.direction;
}

/**
 * Queue a direction change, if it is legal and there is room.
 * @returns {boolean} whether the input was accepted
 */
export function queueDirection(state, dir) {
  if (state.pending.length >= MAX_QUEUED_INPUTS) return false;
  if (isRedundantOrReversal(dir, referenceDirection(state))) return false;
  state.pending.push(dir);
  return true;
}

/**
 * Place food on a free cell, or end the game if the board is full.
 *
 * Must be called after the snake has been updated, never before, so the new
 * food cannot land on a cell the snake is about to occupy.
 *
 * @returns {string} OUTCOME.ATE, or OUTCOME.WON when no cell remains
 */
export function spawnFood(state) {
  const free = freeCells(state.cells);

  if (free.length === 0) {
    state.food = null;
    state.phase = PHASE.OVER;
    state.over = { reason: REASON.WIN };
    return OUTCOME.WON;
  }

  state.food = free[Math.floor(state.rng() * free.length)];
  return OUTCOME.ATE;
}

/**
 * Advance the simulation by exactly one tick.
 *
 * Mutates `state` in place. Touches no DOM, no canvas, and no clock — the
 * simulation is independent of rendering and of frame rate by construction.
 *
 * @returns {string} an OUTCOME value
 */
export function step(state) {
  if (state.phase !== PHASE.PLAYING) return OUTCOME.NONE;

  if (state.pending.length > 0) {
    state.direction = state.pending.shift();
  }

  const head = state.cells[0];
  const next = { x: head.x + state.direction.x, y: head.y + state.direction.y };

  if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
    state.phase = PHASE.OVER;
    state.over = { reason: REASON.WALL };
    return OUTCOME.DIED_WALL;
  }

  const growing = state.food !== null && next.x === state.food.x && next.y === state.food.y;

  // The tail vacates its cell on this tick unless the snake is growing, so it
  // is an obstacle only when growing. Getting this backwards either kills the
  // player for a legal move or lets them pass through their own body.
  const obstacleCount = growing ? state.cells.length : state.cells.length - 1;
  for (let i = 0; i < obstacleCount; i += 1) {
    const cell = state.cells[i];
    if (cell.x === next.x && cell.y === next.y) {
      state.phase = PHASE.OVER;
      state.over = { reason: REASON.SELF };
      return OUTCOME.DIED_SELF;
    }
  }

  state.cells.unshift(next);

  if (growing) {
    state.score += SCORE_PER_FOOD;
    return spawnFood(state);
  }

  state.cells.pop();
  return OUTCOME.NONE;
}
