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
} from './config.js';

/**
 * Everything that turns grid cells into pixels.
 *
 * This module knows the board is 24 cells square and nothing else about the
 * game: it never reads `phase`, `score`, or `over`. Replacing it wholesale is
 * the intended way to redesign the visuals.
 *
 * The board is drawn as a printed circuit — substrate, a two-tier grid, corner
 * fiducials — and the snake as a single trace carrying a signal that attenuates
 * toward the tail. Food is the only lit element. The identity is in the form,
 * not the palette; see docs/tasks/002-neon-circuit-identity.md.
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

/**
 * Signal attenuation along the trace: full brightness at the neck, fading to
 * `TRACE_TAIL_ALPHA` at the tail. Beyond looking right, this tells the player
 * which way they are travelling without having to find the head.
 */
function traceAlpha(index, length) {
  if (length <= 2) return 1;
  const along = (index - 1) / (length - 2);
  return 1 - (1 - TRACE_TAIL_ALPHA) * along;
}

/**
 * The body, as one continuous conductor rather than a row of tiles.
 *
 * Each segment fills its inset square plus a single bridge reaching toward the
 * next segment up the body. Segment and bridge go into the same path so nothing
 * is composited twice — at alpha below 1 an overlap would show as a seam — and
 * because every segment owns exactly one bridge, the bridges tile the gaps
 * without overlapping each other either.
 */
function paintBody(ctx, cells, view) {
  const { cellSize, palette } = view;
  const size = Math.max(1, cellSize - BODY_INSET_PX * 2);

  ctx.fillStyle = palette.body;

  for (let i = cells.length - 1; i >= 1; i -= 1) {
    const cell = cells[i];
    const x = cell.x * cellSize;
    const y = cell.y * cellSize;
    const toward = cells[i - 1];

    ctx.globalAlpha = traceAlpha(i, cells.length);
    ctx.beginPath();
    ctx.rect(x + BODY_INSET_PX, y + BODY_INSET_PX, size, size);

    // `max` picks the boundary the two cells share, whichever way the body
    // turns. The gap between two inset squares is always exactly two insets
    // wide, so the bridge is too.
    if (toward.x !== cell.x) {
      ctx.rect(Math.max(cell.x, toward.x) * cellSize - BODY_INSET_PX, y + BODY_INSET_PX, BODY_INSET_PX * 2, size);
    } else {
      ctx.rect(x + BODY_INSET_PX, Math.max(cell.y, toward.y) * cellSize - BODY_INSET_PX, size, BODY_INSET_PX * 2);
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
 * Draw one frame. Pure with respect to the game: reads state, writes pixels.
 *
 * Allocates nothing. Every value below is a number, and the only objects
 * touched are the frozen ones captured at creation.
 */
function paintFrame(ctx, state, view) {
  const { boardPx, cellSize, palette, cache } = view;

  ctx.drawImage(cache, 0, 0, boardPx, boardPx);

  const cells = state.cells;

  // A diamond, so food differs from the snake by silhouette and not only by
  // colour — they sit within 1.9:1 of each other in luminance, so the shape is
  // what separates them for a colour-blind player. `food` is null only when the
  // board was cleared.
  const food = state.food;
  if (food !== null) {
    const radius = Math.max(1, (cellSize - FOOD_INSET_PX * 2) / 2);
    const cx = (food.x + 0.5) * cellSize;
    const cy = (food.y + 0.5) * cellSize;

    ctx.fillStyle = palette.food;

    // The halo: a second filled path. It is the only glow on the board, and it
    // is what makes the objective the first thing the eye finds.
    ctx.globalAlpha = FOOD_HALO_ALPHA;
    traceDiamond(ctx, cx, cy, radius + Math.max(1, cellSize * FOOD_HALO_SPREAD_RATIO));
    ctx.fill();

    ctx.globalAlpha = 1;
    traceDiamond(ctx, cx, cy, radius);
    ctx.fill();
  }

  // Tail to neck, so the head is painted last and never partially covered.
  paintBody(ctx, cells, view);

  // The head fills its whole cell. That size difference is what keeps head and
  // body apart for a colour-blind player — they are only 1.46:1 apart in
  // luminance, so the silhouette is load-bearing.
  const head = cells[0];
  ctx.fillStyle = palette.head;
  ctx.fillRect(head.x * cellSize, head.y * cellSize, cellSize, cellSize);

  // Joins the head to the neck. The head is a full cell and the neck is inset,
  // so this gap is one inset wide, not two.
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
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} board the element whose content box the board must fit
 * @returns {{ draw: (state: object) => void }}
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
    draw(state) {
      paintFrame(ctx, state, view);
    },
  };
}
