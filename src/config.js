/**
 * Single source of truth for every tunable value in the game.
 * Nothing in this module may hold mutable state.
 */

// Square board, so it fits a portrait phone and a landscape desktop alike.
export const COLS = 24;
export const ROWS = 24;

// Fixed simulation step. Deliberately constant: speed progression is a later
// task, and holding it constant keeps the core's timing trivially predictable.
export const TICK_MS = 120;

// Clamp for a single frame's delta. This bounds how many ticks one frame can
// discharge, so a stall or a resumed tab cannot burst the snake into a wall.
export const MAX_FRAME_MS = 250;

export const SCORE_PER_FOOD = 1;

// Bounded so a held key cannot bank turns. Two is enough to describe any
// corner a player can physically intend, and a third would be wasted input.
export const MAX_QUEUED_INPUTS = 2;

export const START_LENGTH = 3;

export const DIRECTIONS = Object.freeze({
  UP: Object.freeze({ x: 0, y: -1 }),
  DOWN: Object.freeze({ x: 0, y: 1 }),
  LEFT: Object.freeze({ x: -1, y: 0 }),
  RIGHT: Object.freeze({ x: 1, y: 0 }),
});

export const START_DIRECTION = DIRECTIONS.RIGHT;

// Head sits at the centre of the board; the body extends to its left.
export const START_HEAD = Object.freeze({
  x: Math.floor(COLS / 2),
  y: Math.floor(ROWS / 2),
});

export const KEY_MAP = Object.freeze({
  ArrowUp: 'UP',
  w: 'UP',
  W: 'UP',
  ArrowDown: 'DOWN',
  s: 'DOWN',
  S: 'DOWN',
  ArrowLeft: 'LEFT',
  a: 'LEFT',
  A: 'LEFT',
  ArrowRight: 'RIGHT',
  d: 'RIGHT',
  D: 'RIGHT',
});

// Sets rather than arrays: these are only ever membership-tested. `const`
// bindings, never mutated — note that Object.freeze would not actually prevent
// Set#add, so it is deliberately not used to imply a guarantee it cannot give.
export const PAUSE_KEYS = new Set(['p', 'P', 'Escape']);

// Enter and Space both begin a game. event.key for Space is a single space.
export const START_KEYS = new Set(['Enter', ' ']);

// Arrow keys scroll the page and Space scrolls or activates, so all five are
// suppressed. WASD has no default behaviour worth preventing.
export const PREVENT_DEFAULT_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']);

// Smallest cell we will render. The board would rather overflow its container
// than shrink below the point where the grid stops being readable.
export const MIN_CELL_PX = 8;

// Body segments are inset from their cell so the head differs from the body by
// shape as well as colour — colour alone would fail colour-blind players.
export const BODY_INSET_PX = 2;
export const FOOD_INSET_PX = 3;
