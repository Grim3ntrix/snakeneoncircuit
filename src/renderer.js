import {
  COLS,
  ROWS,
  MIN_CELL_PX,
  BODY_INSET_PX,
  FOOD_INSET_PX,
  MAJOR_GRID_EVERY,
  FIDUCIAL_ARM_CELLS,
  FIDUCIAL_INSET_PX,
  TRACE_TAIL_ALPHA,
  FOOD_HALO_ALPHA,
  FOOD_HALO_SPREAD_RATIO,
  FOOD_FLARE_SPREAD_RATIO,
  EYE_GAP_RATIO,
  EYE_MIN_CELL_PX,
  EYE_EXTRA_PX,
  EYE_SHUT_PX,
  CORNER_RATIO,
} from './config.js';
import { EFFECT } from './effects.js';

/**
 * Everything that turns grid cells into pixels.
 *
 * This module knows the board is 24 cells square and nothing else about the
 * game: it never reads `phase`, `score`, or `over`, and it cannot ask what
 * happened. It can only be *told*, through the event timeline it is handed, which
 * is what keeps it replaceable wholesale as a visual redesign.
 *
 * The board is drawn as a printed circuit — substrate, a two-tier grid, corner
 * fiducials — and the snake as a single trace carrying a signal that attenuates
 * toward the tail. Food is the only lit element. The identity is in the form,
 * not the palette; see docs/tasks/002-neon-circuit-identity.md.
 *
 * Event feedback is the one thing here that involves time, and it arrives already
 * aged: the timeline is advanced by the caller, and this module only reads how far
 * through each effect is. See docs/decisions/001-render-events.md.
 */

// camelCase key -> the CSS custom property that owns the value.
const TOKENS = Object.freeze({
  arena: '--arena',
  grid: '--grid',
  gridMajor: '--grid-major',
  frame: '--frame',
  edgeMark: '--edge-mark',
  body: '--snake-body',
  head: '--snake-head',
  food: '--food',
});

/**
 * Read the palette out of `:root` so the canvas and the CSS chrome share one
 * definition. The stylesheet is a <link> in <head> and this module is deferred,
 * so CSS is guaranteed parsed by the time this runs.
 *
 * An empty token means the game would render invisible, so fail loudly here
 * rather than silently drawing nothing.
 */
function readPalette() {
  const styles = getComputedStyle(document.documentElement);
  const palette = {};

  for (const [name, token] of Object.entries(TOKENS)) {
    const value = styles.getPropertyValue(token).trim();
    if (value === '') throw new Error(`Palette token ${token} is missing from :root`);
    palette[name] = value;
  }

  return Object.freeze(palette);
}

/**
 * The two-tier grid and the corner fiducials.
 *
 * Both exist to make the field read as a board rather than as graph paper: the
 * major lines give it structure the player can navigate by, and the fiducials
 * are how a real board is aligned during assembly.
 */
function paintGrid(cacheCtx, view) {
  const { boardPx, cellSize, palette } = view;

  // The half-pixel offset puts a 1px line on a pixel instead of across two.
  // It holds at every integer device pixel ratio: at 3x a line centred on a
  // half CSS pixel spans three whole device pixels.
  const strokeGrid = (every, offsetFrom) => {
    cacheCtx.beginPath();
    for (let i = offsetFrom; i < COLS; i += every) {
      const offset = i * cellSize + 0.5;
      cacheCtx.moveTo(offset, 0);
      cacheCtx.lineTo(offset, boardPx);
      cacheCtx.moveTo(0, offset);
      cacheCtx.lineTo(boardPx, offset);
    }
    cacheCtx.stroke();
  };

  cacheCtx.lineWidth = 1;

  cacheCtx.strokeStyle = palette.grid;
  strokeGrid(1, 1);

  // Drawn separately rather than over the minor lines, so a shared boundary is
  // one colour rather than two stacked strokes.
  cacheCtx.strokeStyle = palette.gridMajor;
  strokeGrid(MAJOR_GRID_EVERY, MAJOR_GRID_EVERY);

  const inset = FIDUCIAL_INSET_PX + 0.5;
  const far = boardPx - FIDUCIAL_INSET_PX - 0.5;
  const arm = Math.max(3, Math.round(cellSize * FIDUCIAL_ARM_CELLS));

  cacheCtx.strokeStyle = palette.edgeMark;
  cacheCtx.beginPath();
  cacheCtx.moveTo(inset, inset + arm);
  cacheCtx.lineTo(inset, inset);
  cacheCtx.lineTo(inset + arm, inset);

  cacheCtx.moveTo(far - arm, inset);
  cacheCtx.lineTo(far, inset);
  cacheCtx.lineTo(far, inset + arm);

  cacheCtx.moveTo(far, far - arm);
  cacheCtx.lineTo(far, far);
  cacheCtx.lineTo(far - arm, far);

  cacheCtx.moveTo(inset + arm, far);
  cacheCtx.lineTo(inset, far);
  cacheCtx.lineTo(inset, far - arm);
  cacheCtx.stroke();
}

/**
 * Arena background, grid, and border, drawn once into an offscreen canvas.
 *
 * Grid lines are static, and stroking them every frame is exactly the per-frame
 * cost the project forbids. Rebuilding this only when the geometry changes
 * keeps the draw path down to one `drawImage` plus the cells.
 */
function paintArena(cacheCtx, view) {
  const { boardPx, palette } = view;

  cacheCtx.fillStyle = palette.arena;
  cacheCtx.fillRect(0, 0, boardPx, boardPx);

  paintGrid(cacheCtx, view);

  cacheCtx.strokeStyle = palette.frame;
  cacheCtx.lineWidth = 2;
  cacheCtx.strokeRect(1, 1, boardPx - 2, boardPx - 2);
}

// How far the event's wavefront is softened as it travels, in cells. A step
// across a single cell moves a whole cell per tick and reads as dropped frames;
// this reads as a front passing.
const WAVE_EDGE_CELLS = 1.5;

// How much of the trace a win's travelling band covers, in cells — and how far
// past the tail both wavefronts run, so each has left the trace before its effect
// is over. The overshoot is what makes the last animated frame identical to the
// settled one: without it the trace would visibly snap on the final tick.
const WAVE_BAND_CELLS = 4;

/**
 * Signal attenuation along the trace at rest: full brightness at the neck, fading
 * to `TRACE_TAIL_ALPHA` at the tail. Beyond looking right, this tells the player
 * which way they are travelling without having to find the head.
 */
function traceAlpha(index, length) {
  if (length <= 2) return 1;
  const along = (index - 1) / (length - 2);
  return 1 - (1 - TRACE_TAIL_ALPHA) * along;
}

/**
 * The body's brightness with the run's outcome travelling down it.
 *
 * One mechanic, two readings, and the difference between them is which side of the
 * front is changed. A death leaves `TRACE_TAIL_ALPHA` behind its front — the signal
 * is out, and it stays out. A win carries a band of full brightness and leaves the
 * ramp exactly as it found it — the signal made it all the way round and the
 * conductor is unchanged.
 *
 * The floor on a death is `TRACE_TAIL_ALPHA` and nothing lower, because that is the
 * constant's own reason for existing: 0.5 is where the body still clears 3:1 against
 * the substrate. The trace goes out exactly as far as it can be watched going out.
 *
 * `wave` is the live outcome slot, passed by reference so this allocates nothing.
 * With no wave, this returns the resting ramp and an ordinary frame computes what it
 * computed before this existed.
 */
function waveAlpha(index, length, wave) {
  const resting = traceAlpha(index, length);
  if (wave === null) return resting;

  // Walks the whole body over the effect's life, and past the end of it.
  const front = wave.t * (length - 1 + WAVE_BAND_CELLS);

  if (wave.kind === EFFECT.DEATH) {
    const passed = Math.min(1, Math.max(0, (front - index) / WAVE_EDGE_CELLS));
    return resting + (TRACE_TAIL_ALPHA - resting) * passed;
  }

  // A win. The band is added to whatever the ramp already is there, so it is
  // brightest in the middle of the body rather than merely equal along the band.
  const fromFront = Math.abs(index - front);
  if (fromFront >= WAVE_BAND_CELLS) return resting;
  return resting + (1 - resting) * (1 - fromFront / WAVE_BAND_CELLS);
}

/**
 * The corner radius for a shape `size` px across.
 *
 * Clamped at half the shape because `roundRect` does not throw past that — it
 * silently degrades to an ellipse — so an over-large radius would stop being a
 * decision and start being a surprise. Half is where the arcs meet, which is the
 * roundest a rectangle can be and still be one.
 */
function cornerRadius(size) {
  return Math.min(Math.round(size * CORNER_RATIO), Math.floor(size / 2));
}

/**
 * The body, as one continuous conductor rather than a row of tiles.
 *
 * Each segment fills its inset square plus a single bridge reaching toward the
 * next segment up the body. Segment and bridge go into the same path so nothing
 * is composited twice — at alpha below 1 an overlap would show as a seam — and
 * that is also what lets a bridge run back *over* the segments it joins.
 *
 * It has to. Rounding a segment cuts its corners away, and a bridge that stopped at
 * the shared boundary would leave every cut showing as a notch along the trace's
 * edge. Reaching one radius into both neighbours buries them, so the rounding
 * survives only where a conductor actually has a corner: the outer side of a turn,
 * and the tail. The overlap itself costs nothing — one path, filled once — and the
 * bridges still never meet each other, each owning exactly one gap, which is what
 * keeps the per-segment alpha below honest and the wavefront reading as a gradient
 * along one conductor rather than as tiles switching on and off.
 */
function paintBody(ctx, cells, view, wave) {
  const { cellSize, palette } = view;
  const size = Math.max(1, cellSize - BODY_INSET_PX * 2);
  const radius = cornerRadius(size);
  const bridge = BODY_INSET_PX * 2 + radius * 2;

  ctx.fillStyle = palette.body;

  for (let i = cells.length - 1; i >= 1; i -= 1) {
    const cell = cells[i];
    const x = cell.x * cellSize;
    const y = cell.y * cellSize;
    const toward = cells[i - 1];

    ctx.globalAlpha = waveAlpha(i, cells.length, wave);
    ctx.beginPath();
    ctx.roundRect(x + BODY_INSET_PX, y + BODY_INSET_PX, size, size, radius);

    // `max` picks the boundary the two cells share, whichever way the body
    // turns. The gap between two inset squares is always exactly two insets
    // wide, and the bridge adds one radius at each end to bury the corners it
    // passes.
    if (toward.x !== cell.x) {
      ctx.rect(Math.max(cell.x, toward.x) * cellSize - BODY_INSET_PX - radius, y + BODY_INSET_PX, bridge, size);
    } else {
      ctx.rect(x + BODY_INSET_PX, Math.max(cell.y, toward.y) * cellSize - BODY_INSET_PX - radius, size, bridge);
    }

    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

/** A diamond centred on (cx, cy). Builds the path only; the caller fills it. */
function traceDiamond(ctx, cx, cy, radius) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx + radius, cy);
  ctx.lineTo(cx, cy + radius);
  ctx.lineTo(cx - radius, cy);
  ctx.closePath();
}

/**
 * The food's two radii, in CSS pixels. Scalars rather than a pair, because this is
 * read in the draw path and an object here would be the per-frame allocation the
 * project forbids.
 */
function foodRadius(cellSize) {
  return Math.max(1, (cellSize - FOOD_INSET_PX * 2) / 2);
}

function foodHaloRadius(cellSize) {
  return foodRadius(cellSize) + Math.max(1, cellSize * FOOD_HALO_SPREAD_RATIO);
}

/**
 * The eaten node's halo, expanding and fading on the cell it was consumed on.
 *
 * The shape is the food's own halo rather than a new one, because what the player
 * is watching is the node's light leaving it — a thing the board already knows how
 * to say, and so not worth saying twice in two visual languages.
 *
 * Drawn in the food layer, before the snake. The head arrives on this very cell, so
 * it covers the flare's centre while the light spreads out past it, and the trace —
 * painted afterwards — can never be occluded by a celebration of it eating.
 */
function paintFlares(ctx, effects, view) {
  const { cellSize, palette } = view;
  const reach = foodHaloRadius(cellSize);

  ctx.fillStyle = palette.food;

  for (let i = 0; i < effects.slots.length; i += 1) {
    const slot = effects.slots[i];
    if (!slot.active || slot.kind !== EFFECT.EAT) continue;

    // Linear, and measurably so. The squared curve this replaces was chosen to stop
    // a haze hanging over the cell the snake is now sitting on — but the head is
    // opaque and painted after this, so there is no haze over that cell to suppress.
    // The only part a faster fade could remove was the part outside the head, which
    // is the whole of what the player can see: measured under an arriving head, the
    // squared curve left a single tinted pixel at the head's own edge and nothing
    // beyond it.
    ctx.globalAlpha = FOOD_HALO_ALPHA * (1 - slot.t);

    // Front-loaded growth, for the same reason and by the same measurement. The
    // flare starts at the halo's radius, which is barely wider than the half cell the
    // head paints over, so a linear expansion spends its brightest moments still
    // hidden. The square root puts it out past the head while it still has
    // brightness to spend, and leaves the rest of its life to the fade.
    traceDiamond(
      ctx,
      (slot.x + 0.5) * cellSize,
      (slot.y + 0.5) * cellSize,
      reach + Math.sqrt(slot.t) * cellSize * FOOD_FLARE_SPREAD_RATIO,
    );
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

/**
 * The run's outcome effect, if there is one — the single slot the whole trace's
 * wavefront is read from.
 *
 * Returned by reference and never copied: it is read once per frame while the body
 * is drawn, and building anything here is the per-frame allocation the project
 * forbids.
 */
function outcomeOf(effects) {
  const slots = effects.slots;

  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];
    if (slot.active && slot.kind !== EFFECT.EAT) return slot;
  }

  return null;
}

/**
 * How far open the eye is, 0 to 1, from the newest eat flare and nothing else.
 *
 * It takes the smallest `t` rather than the first active slot it finds, because a
 * second eat can arrive before the first has faded: reading whichever slot came
 * first would let an older flare, already closing, drag the eye shut mid-bite.
 *
 * No eat in flight reads as fully closed, which is the resting state.
 */
function eatOpenness(effects) {
  const slots = effects.slots;
  let youngest = 1;

  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];
    if (slot.active && slot.kind === EFFECT.EAT && slot.t < youngest) youngest = slot.t;
  }

  return 1 - youngest;
}

/**
 * The head's face: two eyes, and nothing else.
 *
 * Two, not one, and that is the design rather than a doubling of it. A single mark
 * on a filled square reads as a hole; a *pair* of them at the same size reads as
 * eyes. The reading is carried by the count.
 *
 * They are round and dark. Round, because a square mark at this size is a dead
 * pixel — the exact failure this replaces. Dark, because it is the only direction
 * available: `--snake-head` sits at L 0.848, so `--ink` against it measures 1.00:1
 * and even pure white manages only 1.17:1. There is no room above the head for a
 * sclera, so the reference this follows is inverted — a dark eye on a lit pad rather
 * than a lit eye on a dark one — and the 15.83:1 the head already measured against
 * `--arena` becomes the eye's contrast instead of the head's.
 *
 * The travel direction is `head - neck`. `cells[1]` is the cell the head moved out
 * of, so the two are always orthogonally adjacent and the difference is a unit step
 * on one axis. Nothing new is passed in, and `draw` keeps its signature.
 *
 * Both readings come from the effects timeline and never from game state: `mood` is
 * the outcome slot and `open` is how fresh the newest eat is, so the renderer is
 * still only ever told *that* something happened.
 *
 * Allocates nothing. Each eye is centred on an exact half- or whole pixel according
 * to its own parity, so the pair is symmetric rather than nearly so — a face is the
 * one place on this board where being half a pixel out would show.
 */
function paintEye(ctx, head, neck, view, mood, open) {
  const { cellSize, palette } = view;

  // Below this the pair is two 2px dots — damaged pixels twice over, which is the
  // failure this exists to fix rather than a smaller version of the face.
  if (cellSize < EYE_MIN_CELL_PX || neck === undefined) return;

  // The gap is spent first and the eye takes what is left, so the two can never
  // close on each other and merge back into the single mark they replace.
  const gap = Math.max(1, Math.round(cellSize * EYE_GAP_RATIO));
  const across = Math.max(2, Math.floor((cellSize - BODY_INSET_PX * 2 - gap) / 2));
  const shut = mood !== null && mood.kind === EFFECT.DEATH;

  // The pupils widen together on an eat. A death does not shrink them — it shuts
  // them to a slit, a state the settled effect holds rather than a motion it plays.
  const radius = (across + (shut ? 0 : Math.round(open * EYE_EXTRA_PX))) / 2;

  // Half a cell back from the leading edge, so the pair sits on the face rather
  // than on the nose, and one BODY_INSET_PX in from it — the margin the body
  // already keeps from its own cell, so this is the grid's grammar and not a new
  // one of its own.
  const lead = cellSize - BODY_INSET_PX - across / 2;
  const mid = cellSize / 2;
  const offset = (across + gap) / 2;

  const x0 = head.x * cellSize;
  const y0 = head.y * cellSize;

  ctx.fillStyle = palette.arena;

  for (let i = 0; i < 2; i += 1) {
    const side = i === 0 ? -offset : offset;

    // Across the face, never along it: an eye on the leading edge with its twin
    // directly behind it would be one eye seen twice.
    const cx = head.x !== neck.x ? (head.x > neck.x ? lead : cellSize - lead) : mid + side;
    const cy = head.x !== neck.x ? mid + side : (head.y > neck.y ? lead : cellSize - lead);

    if (shut) {
      // A horizontal slit whatever the travel — an eye closes by the lid coming
      // down, and the pair going out together is what says the run ended.
      ctx.fillRect(Math.round(x0 + cx - across / 2), Math.round(y0 + cy - EYE_SHUT_PX / 2), across, EYE_SHUT_PX);
    } else {
      ctx.beginPath();
      ctx.arc(x0 + cx, y0 + cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draw one frame. Pure with respect to the game: reads state and the event
 * timeline, writes pixels.
 *
 * Allocates nothing. Every value below is a number, and the only objects touched
 * are the frozen ones captured at creation and the effects' own preallocated slots.
 */
function paintFrame(ctx, state, view, effects) {
  const { boardPx, cellSize, palette, cache } = view;

  ctx.drawImage(cache, 0, 0, boardPx, boardPx);

  const cells = state.cells;

  // A diamond, so food differs from the snake by silhouette and not only by
  // colour — they sit within 1.9:1 of each other in luminance, so the shape is
  // what separates them for a colour-blind player. `food` is null only when the
  // board was cleared.
  const food = state.food;
  if (food !== null) {
    const cx = (food.x + 0.5) * cellSize;
    const cy = (food.y + 0.5) * cellSize;

    ctx.fillStyle = palette.food;

    // The halo: a second filled path. It is the only glow on the board, and it
    // is what makes the objective the first thing the eye finds.
    ctx.globalAlpha = FOOD_HALO_ALPHA;
    traceDiamond(ctx, cx, cy, foodHaloRadius(cellSize));
    ctx.fill();

    ctx.globalAlpha = 1;
    traceDiamond(ctx, cx, cy, foodRadius(cellSize));
    ctx.fill();
  }

  // Under the snake, so the trace always wins where the two overlap.
  paintFlares(ctx, effects, view);

  // Asked once and handed to both, rather than twice: the trace's wavefront and the
  // head's own eye are reading the same event.
  const outcome = outcomeOf(effects);

  // Tail to neck, so the head is painted last and never partially covered.
  paintBody(ctx, cells, view, outcome);

  // The head fills its whole cell. That size difference is what keeps head and
  // body apart for a colour-blind player — they are only 1.46:1 apart in
  // luminance, so the silhouette is load-bearing.
  //
  // It is also the one part of the snake the outcome's wavefront does not touch.
  // The trace going out is the signal stopping; the head is the pad it stopped at,
  // and leaving it lit is what still says where the run ended.
  const head = cells[0];
  ctx.fillStyle = palette.head;
  ctx.beginPath();
  ctx.roundRect(head.x * cellSize, head.y * cellSize, cellSize, cellSize, cornerRadius(cellSize));
  ctx.fill();

  // The head is a full cell and the neck is inset, so the pad overhangs the trace by
  // one inset. The bridge already covers that band, but it belongs to the trace and
  // carries the trace's attenuation, which would put a dimmer step exactly where the
  // signal arrives at the pad. This repaints it in the pad's own colour instead.
  const neck = cells[1];
  if (neck !== undefined) {
    if (neck.x !== head.x) {
      const edge = neck.x > head.x ? (head.x + 1) * cellSize : head.x * cellSize - BODY_INSET_PX;
      ctx.fillRect(edge, head.y * cellSize + BODY_INSET_PX, BODY_INSET_PX, Math.max(1, cellSize - BODY_INSET_PX * 2));
    } else {
      const edge = neck.y > head.y ? (head.y + 1) * cellSize : head.y * cellSize - BODY_INSET_PX;
      ctx.fillRect(head.x * cellSize + BODY_INSET_PX, edge, Math.max(1, cellSize - BODY_INSET_PX * 2), BODY_INSET_PX);
    }
  }

  // Last, so the join above can never clip the eye's leading edge.
  paintEye(ctx, head, neck, view, outcome, eatOpenness(effects));
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} board the element whose content box the board must fit
 * @returns {{ draw: (state: object, effects: object) => void }}
 */
export function createRenderer(canvas, board) {
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D context is unavailable');

  const cache = document.createElement('canvas');
  const cacheCtx = cache.getContext('2d');
  if (cacheCtx === null) throw new Error('Canvas 2D context is unavailable');

  const view = { ctx, cache, palette: readPalette(), cellSize: 0, boardPx: 0, dpr: 0 };

  /**
   * Nudge the canvas onto whole device pixels.
   *
   * Centring can land the board on a half pixel when the space left over is
   * odd. The canvas is then composited with a half-pixel offset, which makes
   * the compositor blend adjacent rows: at dpr 1 every horizontal grid line
   * softens to half weight across two rows while the vertical ones stay crisp.
   * Correcting it keeps the two axes identical, and the nudge is sub-pixel so
   * it can never read as movement.
   *
   * Applied to the board rather than to the canvas so that everything stacked on
   * the board moves with it. The scrim is its own element sized to the same
   * square, and nudging only the canvas left the two up to half a device pixel
   * out of register — showing as a bright hairline along one edge of the board,
   * which is exactly where the fiducials draw the eye. Nudging the board makes
   * the two congruent by construction rather than by a second token to keep in
   * step.
   *
   * The correction is measured rather than assumed, so moving the board carries
   * the canvas by exactly the amount the canvas needed. It is also always a
   * whole number of device pixels, so it cannot soften anything.
   *
   * The transform is cleared before measuring so the measurement cannot be
   * polluted by the correction applied last time.
   */
  function snapToDevicePixels() {
    board.style.transform = '';

    const rect = canvas.getBoundingClientRect();
    const x = Math.round(rect.left * view.dpr) / view.dpr - rect.left;
    const y = Math.round(rect.top * view.dpr) / view.dpr - rect.top;

    if (x !== 0 || y !== 0) board.style.transform = `translate(${x}px, ${y}px)`;
  }

  /**
   * Fit the board to its container and match the device pixel ratio.
   *
   * Sizing the canvas is not free — assigning to width/height reallocates the
   * backing store and discards its contents — so the expensive half is skipped
   * when nothing relevant changed. That also stops a resize triggered by our own
   * canvas write from feeding back into the observer.
   */
  function resize() {
    const available = Math.min(board.clientWidth / COLS, board.clientHeight / ROWS);
    const cellSize = Math.max(MIN_CELL_PX, Math.floor(available));
    const dpr = window.devicePixelRatio || 1;

    if (cellSize !== view.cellSize || dpr !== view.dpr) {
      view.cellSize = cellSize;
      view.boardPx = cellSize * COLS;
      view.dpr = dpr;

      canvas.style.width = `${view.boardPx}px`;
      canvas.style.height = `${view.boardPx}px`;
      canvas.width = Math.round(view.boardPx * dpr);
      canvas.height = Math.round(view.boardPx * dpr);

      // The chrome aligns its rule to the board, and the board's width is the
      // one thing only this module knows. Publishing it here keeps a single
      // source of truth rather than having the stylesheet guess.
      document.documentElement.style.setProperty('--board-px', `${view.boardPx}px`);

      // Applied once here rather than every frame. Everything downstream draws
      // in CSS pixels.
      view.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cache.width = canvas.width;
      cache.height = canvas.height;
      cacheCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintArena(cacheCtx, view);
    }

    // Outside the guard: the board can shift by a half pixel without its size
    // or the cell size changing at all.
    snapToDevicePixels();
  }

  // Observe rather than poll: the observer fires on container size changes we
  // could not otherwise see, including ones that never resize the window.
  new ResizeObserver(resize).observe(board);

  // The first observer delivery is asynchronous and lands after this frame's
  // rAF callbacks, so size once up front or the first draw has no geometry.
  resize();

  return {
    draw(state, effects) {
      paintFrame(ctx, state, view, effects);
    },
  };
}
