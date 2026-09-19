import { COLS, ROWS, MIN_CELL_PX, BODY_INSET_PX, FOOD_INSET_PX } from './config.js';

/**
 * Everything that turns grid cells into pixels.
 *
 * This module knows the board is 24 cells square and nothing else about the
 * game: it never reads `phase`, `score`, or `over`. Replacing it wholesale is
 * the intended way to redesign the visuals.
 */

// camelCase key -> the CSS custom property that owns the value.
const TOKENS = Object.freeze({
  arena: '--arena',
  grid: '--grid',
  frame: '--frame',
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
 * Arena background, grid, and border, drawn once into an offscreen canvas.
 *
 * Grid lines are static, and stroking 48 of them every frame is exactly the
 * per-frame cost the project forbids. Rebuilding this only when the geometry
 * changes keeps the draw path down to one `drawImage` plus the cells.
 */
function paintArena(cacheCtx, view) {
  const { boardPx, cellSize, palette } = view;

  cacheCtx.fillStyle = palette.arena;
  cacheCtx.fillRect(0, 0, boardPx, boardPx);

  cacheCtx.strokeStyle = palette.grid;
  cacheCtx.lineWidth = 1;
  cacheCtx.beginPath();
  for (let i = 1; i < COLS; i += 1) {
    // The half-pixel offset puts a 1px line on a pixel instead of across two.
    const offset = i * cellSize + 0.5;
    cacheCtx.moveTo(offset, 0);
    cacheCtx.lineTo(offset, boardPx);
    cacheCtx.moveTo(0, offset);
    cacheCtx.lineTo(boardPx, offset);
  }
  cacheCtx.stroke();

  cacheCtx.strokeStyle = palette.frame;
  cacheCtx.lineWidth = 2;
  cacheCtx.strokeRect(1, 1, boardPx - 2, boardPx - 2);
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
  const bodySize = Math.max(1, cellSize - BODY_INSET_PX * 2);

  // Tail to neck, so the head is painted last and never partially covered.
  ctx.fillStyle = palette.body;
  for (let i = cells.length - 1; i >= 1; i -= 1) {
    const cell = cells[i];
    ctx.fillRect(
      cell.x * cellSize + BODY_INSET_PX,
      cell.y * cellSize + BODY_INSET_PX,
      bodySize,
      bodySize,
    );
  }

  // A diamond, so food differs from the snake by silhouette and not only by
  // colour. `food` is null only when the board was cleared.
  const food = state.food;
  if (food !== null) {
    const radius = Math.max(1, (cellSize - FOOD_INSET_PX * 2) / 2);
    const cx = (food.x + 0.5) * cellSize;
    const cy = (food.y + 0.5) * cellSize;

    ctx.fillStyle = palette.food;
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx + radius, cy);
    ctx.lineTo(cx, cy + radius);
    ctx.lineTo(cx - radius, cy);
    ctx.closePath();
    ctx.fill();
  }

  // The head fills its whole cell. That size difference is what keeps head and
  // body apart for a colour-blind player.
  const head = cells[0];
  ctx.fillStyle = palette.head;
  ctx.fillRect(head.x * cellSize, head.y * cellSize, cellSize, cellSize);
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
   * The transform is cleared before measuring so the measurement cannot be
   * polluted by the correction applied last time.
   */
  function snapToDevicePixels() {
    canvas.style.transform = '';

    const rect = canvas.getBoundingClientRect();
    const x = Math.round(rect.left * view.dpr) / view.dpr - rect.left;
    const y = Math.round(rect.top * view.dpr) / view.dpr - rect.top;

    if (x !== 0 || y !== 0) canvas.style.transform = `translate(${x}px, ${y}px)`;
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
