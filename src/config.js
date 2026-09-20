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

// Major grid lines every 6 cells. 24 divides by 6 into four, so the board reads
// as a 4x4 arrangement of blocks rather than an unmarked field — which gives
// the player a spatial reference and stops the lattice reading as graph paper.
export const MAJOR_GRID_EVERY = 6;

// Corner fiducials, as a multiple of the cell so they scale with the board
// instead of vanishing on a small screen.
export const FIDUCIAL_ARM_CELLS = 1.5;
export const FIDUCIAL_INSET_PX = 5;

// The trace attenuates from the head to the tail. This floor is a legibility
// limit, not a taste call: composited over the substrate, --snake-body reaches
// 3:1 at alpha 0.45 and falls to 2.70:1 at 0.40. Under 3:1 the tail stops
// being a readable graphical object (WCAG 1.4.11) — and the tail is the cell
// the whole tail-vacate rule turns on, so the player has to see it.
export const TRACE_TAIL_ALPHA = 0.5;

// The food is the only lit element on the board. The halo is a second filled
// path, not a shadow: ctx.shadowBlur allocates a blur surface per draw call
// and cannot be cached.
export const FOOD_HALO_ALPHA = 0.22;
export const FOOD_HALO_SPREAD_RATIO = 0.2;
