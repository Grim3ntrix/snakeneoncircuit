import { TICK_MS, MAX_FRAME_MS } from './config.js';
import { PHASE, REASON, createInitialState } from './state.js';
import { OUTCOME, queueDirection, step } from './simulation.js';
import { randomSeed } from './rng.js';
import { attachInput } from './input.js';
import { createRenderer } from './renderer.js';
import { createEffects, EFFECT } from './effects.js';
import { createAudio, SOUND } from './audio.js';
import { loadMuted, loadStats, mergeResult, saveMuted, saveStats } from './storage.js';

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
  pause: requireElement('pause'),
  sound: requireElement('sound'),
  soundOnHint: requireElement('hint-sound-on'),
  soundOffHint: requireElement('hint-sound-off'),
};

const renderer = createRenderer(dom.canvas, dom.board);

let state = createInitialState({ seed: randomSeed() });
let accumulator = 0;
let lastFrame = 0;

// Read once at startup and replaced wholesale thereafter, the same way `state`
// is, so the record can never be half-updated.
let stats = loadStats();

// The sound preference, and the single answer to "should this game make a noise".
// Both consumers are told rather than asked: `audio` is pushed the value on every
// change, and the interface reads it to decide what the sound control says. Two
// copies of this boolean would eventually disagree, and the failure would be a
// button claiming sound is on over a silent board.
let muted = loadMuted();

const audio = createAudio({ muted });

// Read once, like the palette. A media query per frame would be the one thing in
// the draw path that is not arithmetic, and a player who changes this preference
// mid-session is changing it for every other page they have open too.
const effects = createEffects({
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
});

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
 * What the game-over screen calls each ending.
 *
 * A table rather than a chain of conditionals, because the reasons are a closed
 * set the simulation already names and every one of them should have a title
 * somebody wrote, rather than the last branch being a catch-all that happens to
 * read correctly for the common case.
 *
 * The title is where the reason goes rather than the detail line, so the panel
 * does not get taller: it replaces a line rather than adding one, which leaves
 * the fit at 320px exactly as it was.
 */
const OVER_TITLES = Object.freeze({
  [REASON.WALL]: 'Hit a wall',
  [REASON.SELF]: 'Bit itself',
  [REASON.WIN]: 'Board cleared',
});

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

/** Push the phase, score, record, and sound state into the DOM. Called on a real change. */
function syncDom() {
  dom.score.textContent = String(state.score);

  dom.ready.hidden = state.phase !== PHASE.READY;
  dom.paused.hidden = state.phase !== PHASE.PAUSED;
  dom.over.hidden = state.phase !== PHASE.OVER;

  // The sound control reports its own state in its own label, so muting is never
  // a silent, unacknowledged action — which for this control would be the worst
  // possible outcome, because silence is exactly what it produces and so cannot
  // also be the thing that confirms it happened.
  dom.sound.textContent = muted ? 'Muted' : 'Sound';

  // Pause is the one control that is not always answerable: there is nothing to
  // pause on the ready screen and nothing to resume on the over screen. It is
  // disabled rather than hidden, because hiding it would reflow the row it shares
  // with the pad — and disabled rather than left live, because a control that
  // lights up under a thumb and then does nothing is worse than one that says so
  // before it is pressed.
  dom.pause.disabled = state.phase !== PHASE.PLAYING && state.phase !== PHASE.PAUSED;

  // The keyboard hint and the control are complements, not alternatives: CSS
  // shows this pair only where there is a keyboard and hides it where there is a
  // button. Which of the two is worded as available is the same question the
  // label above answers.
  dom.soundOnHint.hidden = muted;
  dom.soundOffHint.hidden = !muted;

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
    // Why the run ended, not merely that it did. A wall, the snake's own body,
    // and a board with nowhere left to go are three different events, and a
    // player who died on themselves should not be told they hit a wall.
    dom.overTitle.textContent = OVER_TITLES[state.over.reason];
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
  // First, because this is the call that is allowed to create the audio context,
  // and it only is because it runs synchronously inside the press that started the
  // game. A context built anywhere else is built outside a user gesture, which
  // leaves it suspended and puts a warning in the console — see src/audio.js.
  audio.unlock();

  state = createInitialState({ seed: randomSeed() });
  state.phase = PHASE.PLAYING;

  // Validated against START_DIRECTION, so a left press is safely ignored
  // rather than reversing the snake into itself on the first tick.
  if (requestedDirection !== null) queueDirection(state, requestedDirection);

  // Resetting both means the first frame of a new game cannot discharge ticks
  // accumulated while the ready or over overlay was up.
  accumulator = 0;
  lastFrame = performance.now();

  // A death is held settled on the board so that the over screen keeps showing
  // where the run ended. That is the one thing that must not survive into the
  // next run: without this, the new snake would be drawn cold.
  effects.clear();

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

/**
 * Turn the sound on or off, and remember which.
 *
 * Not phase-checked, unlike pausing: this is a setting rather than a move, so it
 * is answerable on every screen the game has — including the ready screen, which
 * is where a player is most likely to reach for it.
 *
 * The write is best-effort and the in-memory value is the truth for this session,
 * so a player whose storage is unavailable gets a control that works for as long
 * as the page is open, rather than one that appears to work and does not.
 */
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  saveMuted(muted);
  syncDom();
}

function handleVisibilityChange() {
  // Independent of the phase. A tab nobody is looking at has no reason to hold a
  // running audio thread, whether or not a game is in progress — and it is the
  // phase that decides whether the game also pauses.
  audio.setHidden(document.hidden);

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

  // Aged before the ticks below, not after. An effect spawned by this frame's tick
  // is then drawn at the instant it happened rather than a whole tick into its
  // life, which for the shortest of them would be halfway through.
  effects.advance(dt);

  accumulator += dt;

  // Drained unconditionally. Draining only while playing would let time pile up
  // during ready and over and then burst the instant play resumes.
  while (accumulator >= TICK_MS) {
    accumulator -= TICK_MS;
    if (state.phase !== PHASE.PLAYING) continue;

    const outcome = step(state);
    if (outcome === OUTCOME.ATE) {
      dom.score.textContent = String(state.score);

      // The head has just moved onto the node's cell, so that is where the node
      // was — which is precisely where the flare belongs, and why the cell does
      // not have to be remembered from before the step.
      effects.spawn(EFFECT.EAT, state.cells[0]);
      audio.play(SOUND.EAT);
    } else if (outcome !== OUTCOME.NONE) {
      // Terminal: a wall, itself, or a cleared board. Recorded before the overlay
      // is written, because that overlay reports the comparison.
      finishRun();
      syncDom();

      // Clearing the board and being stopped are the same kind of moment and two
      // different events, so they get two different readings of the one wavefront:
      // the signal completing, or the signal cut off. See src/renderer.js.
      const won = state.over.reason === REASON.WIN;
      effects.spawn(won ? EFFECT.WIN : EFFECT.DEATH);
      audio.play(won ? SOUND.WIN : SOUND.DEATH);

      // Last, and always after the outcome's own voice: it is a remark on the run
      // that just ended, not an alternative ending to it.
      if (isNewBest) audio.play(SOUND.BEST);
    }
  }

  renderer.draw(state, effects);
}

attachInput({
  getState: () => state,
  start,
  togglePause,
  toggleMute,
  turn: (direction) => queueDirection(state, direction),
});

// Only the tab being hidden pauses. Losing window focus without hiding the tab
// is not a reason to interrupt play; the dt clamp covers that case.
document.addEventListener('visibilitychange', handleVisibilityChange);

syncDom();
lastFrame = performance.now();
requestAnimationFrame(frame);
