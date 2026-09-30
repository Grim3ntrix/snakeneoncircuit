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

// The sound toggle. Deliberately not folded into PAUSE_KEYS even though both are
// "the keys that are not directions": the one place that reads either has to say
// which it means, and a set that quietly answers two questions cannot.
export const MUTE_KEYS = new Set(['m', 'M']);

// The music toggle — the narrower of a pair rather than an unrelated key. `M` is
// the master mute, so pressing it silences everything; this is the control for
// the bed alone, and it sits beside `M` on the keyboard so the two read as one
// subject. Free: nothing else in this module claims `n`.
export const MUSIC_KEYS = new Set(['n', 'N']);

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

// How much further that halo reaches by the end of an eat flare, as a ratio of the
// cell. Larger than the halo's own spread, because the halo is only ever seen at
// rest while this one is followed from the moment it starts, and an expansion the
// eye cannot see is not an effect. Smaller than a cell, because the flare is drawn
// under the food the player has to find next: past about half a cell it stops
// being the node's light leaving and becomes a second thing on the board.
export const FOOD_FLARE_SPREAD_RATIO = 0.5;

// How long each board effect takes to play out. Timings, so they belong beside
// TICK_MS rather than next to the drawing they drive — and `eat` is read against
// TICK_MS to size the timeline, which is a relationship only visible from here.
//
// `death` is long enough to be watched and shorter than the overlay's arrival, so
// the board settles while the panel is still coming in. `win` is longer because
// the trace it travels is the whole board.
export const EFFECT_MS = Object.freeze({
  eat: 260,
  death: 420,
  win: 640,
});

// Not a tunable, but this module is the single source of truth for constants
// and a storage key inlined at its call site is one that can drift from the
// reader of it.
//
// The version is part of the key rather than a field in the value. A future
// schema is then a different key, so the record written today can never be
// read back as though it had the newer shape — which is the entire failure
// mode versioning exists to prevent, for the price of a suffix.
export const STATS_KEY = 'snakeneoncircuit.stats.v1';

// A second key rather than a third field in the one above. The record and the
// audio preferences are unrelated, and keeping them in one object would mean a
// corrupt score silently taking the sound setting down with it — which is exactly
// what all-or-nothing validation is supposed to prevent, not cause. Separate keys
// also version separately, so neither schema can be read back as the other's.
//
// This key holds `{ muted, music }` and stayed at v1 when the second field was
// added, which the versioning note above says should not happen. The reason it is
// safe here is that validation is total: `loadSettings` accepts exactly two
// booleans and rejects the object whole otherwise, so a v1 record holding only
// `muted` reads as the defaults rather than as settings missing a field. A bump
// would be required if v1 had ever been written by a real browser; it had not.
export const SETTINGS_KEY = 'snakeneoncircuit.settings.v1';

// The bed under the game. Every value here is a property of the music as a whole
// rather than of a note, so the notes themselves live beside the voices in
// audio.js — the same split as the palette, which is a token here and a drawing
// decision there.
export const MUSIC = Object.freeze({
  // The tempo ramp, as a step every `stepMs`. It runs from the starting length to
  // `fullLength` and stops there: the acceleration is there to be heard as
  // progress, and a bed that kept speeding up past the point where the board is
  // full would be tracking a number the player has stopped caring about.
  stepMsSlow: 300,
  stepMsFast: 150,
  fullLength: 40,

  // The third layer's entry point, in cells. Before this the bed is a pulse and a
  // figure; after it there is a counter-figure an octave up. Low enough that a
  // player who survives the first few seconds hears the music change, which is the
  // whole reason the bed is tied to length rather than to a clock.
  upperFromLength: 12,

  // How far ahead of the context clock steps are scheduled. Web Audio has to be
  // given its notes early or they land late and audibly uneven, so this is a
  // scheduling buffer rather than a latency: it is the window a stall has to
  // exceed before a note is missed.
  lookaheadS: 0.12,

  // Where the bed sits under the master, and where it drops to when a voice plays.
  // The dip exists for legibility rather than taste: an eat fires up to 8⅓ times a
  // second and shares a band with the figure, so without it the acknowledgement
  // stops being the loudest thing at exactly the moment it matters.
  //
  // `duckS` is the whole recovery, not the time constant: audio.js divides it by
  // three, because `setTargetAtTime` is within about 5% of its target after three of
  // them. Longer than the eat blip's 90ms on purpose — the dip has to outlast the
  // sound it is clearing the way for.
  gain: 0.5,
  duckGain: 0.35,
  duckS: 0.18,

  // The bed's own fade, in and out. Out matters more: a run ends, and music still
  // going over a settled board would say the run had not really ended.
  fadeS: 0.35,
});
