import { TICK_MS, MAX_FRAME_MS } from './config.js';
import { PHASE, REASON, createInitialState } from './state.js';
import { OUTCOME, queueDirection, step } from './simulation.js';
import { randomSeed } from './rng.js';
import { attachInput } from './input.js';
import { createRenderer } from './renderer.js';
import { loadStats, mergeResult, saveStats } from './storage.js';

/**
 * Bootstrap, the frame loop, and the wiring between the other modules.
 *
 * No game rules and no drawing live here: this module decides *when* the
 * simulation ticks and *when* the DOM is updated, never *what* either does.
 */

function requireElement(id) {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Required element #${id} is missing from the document`);
  return element;
}

// Validated once at startup rather than re-queried or re-checked per frame.
const dom = {
  board: requireElement('board'),
  canvas: requireElement('game-canvas'),
  score: requireElement('score'),
  ready: requireElement('overlay-ready'),
  paused: requireElement('overlay-paused'),
  over: requireElement('overlay-over'),
  overTitle: requireElement('over-title'),
  overDetail: requireElement('over-detail'),
  overAttempts: requireElement('over-attempts'),
  record: requireElement('record'),
};

const renderer = createRenderer(dom.canvas, dom.board);

let state = createInitialState({ seed: randomSeed() });
let accumulator = 0;
let lastFrame = 0;

// Read once at startup and replaced wholesale thereafter, the same way `state`
// is, so the record can never be half-updated.
let stats = loadStats();

// Runs finished since this page was loaded. Deliberately not part of `stats`:
// it is not persisted, and a reload is meant to lose it.
let attempts = 0;

// Whether the run that just ended beat the record it has now been folded into.
// Only meaningful while the over overlay is up.
let isNewBest = false;

/**
 * The mark that stands where the plain separator stands on every other line.
 *
 * A new best is the one thing the game-over screen is allowed to celebrate, and
 * celebrating it with the same `·` that separates a score from a record it failed
 * to beat says the opposite. So it gets a star, in the accent.
 *
 * It is an object rather than a character because the mark carries no text at
 * all: the glyph is drawn by CSS, so the sentence handed to a screen reader is
 * still "Score 42 New best" and no glyph name is read into the middle of it.
 */
const NEW_BEST_MARK = Object.freeze({ className: 'result__mark' });

/**
 * Write a sentence built from `parts` into `element`.
 *
 * `formatResult` returns a flat sequence in which numbers are figures and
 * everything else is prose. That keeps the one rule worth naming — a figure
 * looks different from a word — in a single place instead of being spelled out
 * again in each line of copy. It also leaves the text content exactly what the
 * sentence reads as, so what a screen reader announces is untouched by the
 * styling.
 *
 * The class is the HUD's own, so a figure means one thing across the whole
 * interface rather than being restyled per screen.
 */
function writeLine(element, parts) {
  element.replaceChildren(...parts.map((part) => {
    if (typeof part === 'string') return document.createTextNode(part);
    if (typeof part === 'number') {
      const figure = document.createElement('span');
      figure.className = 'stat__value';
      figure.textContent = String(part);
      return figure;
    }
    const mark = document.createElement('span');
    mark.className = part.className;
    mark.setAttribute('aria-hidden', 'true');
    return mark;
  }));
}

/**
 * `Best 42`
 *
 * One figure, because there is one record worth reporting. The longest snake is
 * deliberately not shown beside it: score and length move together — every food
 * is a point *and* a cell — so the longest snake is always the snake from the
 * best-scoring run, and a second figure could only ever be the first one plus
 * three.
 */
function formatRecord({ best }) {
  return ['Best ', best];
}

/**
 * `Attempts 3`
 *
 * Attempts count a session, not a career — the player who reloads starts again
 * at one — so they are not part of the stored record and are not shown beside
 * it. They belong to the screen that ends a run, which is the only place the
 * number means anything.
 */
function formatAttempts(attempts) {
  return ['Attempts ', attempts];
}

/**
 * The line under the game-over title: what this run scored, and how it stands
 * against the record.
 *
 * A tie is not a new best, so "New best" keeps meaning something. And a run
 * that ate nothing against a record of zero has nothing worth comparing to, so
 * it is left with just its score rather than being told its best is zero.
 */
function formatResult({ won, score, isNewBest, best }) {
  const line = won ? ['Perfect run — score ', score] : ['Score ', score];
  // The space before the mark is load-bearing for a screen reader and invisible
  // on screen: the mark itself renders nothing, so without it the two would run
  // together as "Score 42New best". The gap after the mark is the mark's own
  // margin, because a second space there would be collapsed away.
  if (isNewBest) return [...line, ' ', NEW_BEST_MARK, 'New best'];
  if (best === 0) return line;
  return [...line, ' · Best ', best];
}

/**
 * Fold the run that just ended into the saved record, and count it.
 *
 * Called from the one place a terminal outcome can be produced, and the drain
 * loop cannot produce a second — by then the phase is no longer PLAYING — so
 * this runs exactly once per run, however many ticks that run held.
 *
 * `attempts` is a plain in-memory counter, reset by the reload that recreates
 * this module. Nothing writes it anywhere, which is the point: quitting loses
 * the count, and the next session starts at one.
 *
 * Runs before the over overlay is written, because that overlay reports both
 * how the run compares to the record this is about to replace, and which
 * attempt it was.
 */
function finishRun() {
  isNewBest = state.score > stats.best;
  stats = mergeResult(stats, { score: state.score, length: state.cells.length });
  attempts += 1;
  saveStats(stats);
}

/** Push the phase, score, and record into the DOM. Called only on a real change. */
function syncDom() {
  dom.score.textContent = String(state.score);

  dom.ready.hidden = state.phase !== PHASE.READY;
  dom.paused.hidden = state.phase !== PHASE.PAUSED;
  dom.over.hidden = state.phase !== PHASE.OVER;

  // Hidden rather than emptied: an empty line still takes the panel's gap, so a
  // first visit would sit lower than it does today. `longest` is never zero once
  // a game has been finished — the starting snake is already three cells — so it
  // is what says whether there is a record at all, and that is now the only
  // thing it is read for. `best` cannot stand in for it: a run that ate nothing
  // leaves it at zero, which is exactly what a first visit shows too.
  const hasRecord = stats.longest > 0;
  dom.record.hidden = !hasRecord;
  if (hasRecord) writeLine(dom.record, formatRecord(stats));

  if (state.phase === PHASE.OVER) {
    const won = state.over.reason === REASON.WIN;
    // Clearing the board is a different event from dying, so it says so.
    dom.overTitle.textContent = won ? 'Board cleared' : 'Game over';
    writeLine(dom.overDetail, formatResult({
      won,
      score: state.score,
      isNewBest,
      best: stats.best,
    }));
    writeLine(dom.overAttempts, formatAttempts(attempts));
  }
}

/**
 * Begin a new game.
 *
 * The previous state object is discarded rather than reset field by field, so
 * no stale queue, score, or death reason can survive into the new run.
 *
 * @param {{x: number, y: number} | null} requestedDirection
 */
function start(requestedDirection) {
  state = createInitialState({ seed: randomSeed() });
  state.phase = PHASE.PLAYING;

  // Validated against START_DIRECTION, so a left press is safely ignored
  // rather than reversing the snake into itself on the first tick.
  if (requestedDirection !== null) queueDirection(state, requestedDirection);

  // Resetting both means the first frame of a new game cannot discharge ticks
  // accumulated while the ready or over overlay was up.
  accumulator = 0;
  lastFrame = performance.now();

  // The previous run's verdict belongs to the overlay that has just been hidden.
  isNewBest = false;

  syncDom();
}

function togglePause() {
  if (state.phase === PHASE.PLAYING) state.phase = PHASE.PAUSED;
  else if (state.phase === PHASE.PAUSED) state.phase = PHASE.PLAYING;
  else return;

  // The direction queue is untouched, so turns made before the pause still
  // apply on resume.
  syncDom();
}

function handleVisibilityChange() {
  if (document.hidden && state.phase === PHASE.PLAYING) {
    state.phase = PHASE.PAUSED;
    syncDom();
  }
}

function frame(now) {
  // Scheduled first so a thrown frame cannot silently end the loop.
  requestAnimationFrame(frame);

  let dt = now - lastFrame;
  lastFrame = now;

  // The backstop for a huge dt arriving by any route — a stall, a long task, a
  // resumed tab — which would otherwise discharge dozens of ticks at once.
  if (dt > MAX_FRAME_MS) dt = MAX_FRAME_MS;

  accumulator += dt;

  // Drained unconditionally. Draining only while playing would let time pile up
  // during ready and over and then burst the instant play resumes.
  while (accumulator >= TICK_MS) {
    accumulator -= TICK_MS;
    if (state.phase !== PHASE.PLAYING) continue;

    const outcome = step(state);
    if (outcome === OUTCOME.ATE) {
      dom.score.textContent = String(state.score);
    } else if (outcome !== OUTCOME.NONE) {
      // Terminal: a wall, itself, or a cleared board. Recorded before the overlay
      // is written, because that overlay reports the comparison.
      finishRun();
      syncDom();
    }
  }

  renderer.draw(state);
}

attachInput({
  getState: () => state,
  start,
  togglePause,
  turn: (direction) => queueDirection(state, direction),
});

// Only the tab being hidden pauses. Losing window focus without hiding the tab
// is not a reason to interrupt play; the dt clamp covers that case.
document.addEventListener('visibilitychange', handleVisibilityChange);

syncDom();
lastFrame = performance.now();
requestAnimationFrame(frame);
