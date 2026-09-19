import { TICK_MS, MAX_FRAME_MS } from './config.js';
import { PHASE, REASON, createInitialState } from './state.js';
import { OUTCOME, queueDirection, step } from './simulation.js';
import { randomSeed } from './rng.js';
import { attachInput } from './input.js';
import { createRenderer } from './renderer.js';

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
};

const renderer = createRenderer(dom.canvas, dom.board);

let state = createInitialState({ seed: randomSeed() });
let accumulator = 0;
let lastFrame = 0;

/** Push the phase and score into the DOM. Called only on a real change. */
function syncDom() {
  dom.score.textContent = String(state.score);

  dom.ready.hidden = state.phase !== PHASE.READY;
  dom.paused.hidden = state.phase !== PHASE.PAUSED;
  dom.over.hidden = state.phase !== PHASE.OVER;

  if (state.phase === PHASE.OVER) {
    const won = state.over.reason === REASON.WIN;
    // Clearing the board is a different event from dying, so it says so.
    dom.overTitle.textContent = won ? 'Board cleared' : 'Game over';
    dom.overDetail.textContent = won
      ? `Perfect run — score ${state.score}`
      : `Score ${state.score}`;
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
