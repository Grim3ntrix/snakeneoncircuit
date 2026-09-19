import { KEY_MAP, PAUSE_KEYS, START_KEYS, PREVENT_DEFAULT_KEYS, DIRECTIONS } from './config.js';
import { PHASE } from './state.js';

/**
 * The keyboard is the only input device in this task, and this is the only
 * module that listens for it.
 *
 * The module translates a physical key into one of four intents and hands it to
 * the caller, which owns the phase transitions. That split keeps this file free
 * of game rules and keeps the state machine in exactly one place.
 *
 * `turn` is not phase-checked here beyond what the table below requires: while
 * playing it is always passed through, because whether a turn is *legal*
 * depends on the queue, which the simulation owns.
 *
 * @param {{
 *   getState: () => { phase: string },
 *   start: (direction: {x: number, y: number} | null) => void,
 *   togglePause: () => void,
 *   turn: (direction: {x: number, y: number}) => void,
 * }} handlers
 */
export function attachInput({ getState, start, togglePause, turn }) {
  function onKeyDown(event) {
    // Modifier combinations belong to the browser, not to the game. Bailing
    // before preventDefault keeps Ctrl/Meta shortcuts working.
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const { key } = event;

    // Arrows scroll and Space scrolls or re-activates the focused element, so
    // both are suppressed. WASD has no default behaviour worth preventing.
    if (PREVENT_DEFAULT_KEYS.has(key)) event.preventDefault();

    const direction = DIRECTIONS[KEY_MAP[key]];

    if (direction !== undefined) {
      const { phase } = getState();
      if (phase === PHASE.READY || phase === PHASE.OVER) {
        start(direction);
      } else if (phase === PHASE.PLAYING) {
        // Auto-repeat is deliberately not filtered: a held direction is a
        // duplicate of the queue tail, which queue validation already rejects.
        turn(direction);
      }
      return;
    }

    // Pause and start are toggles, so a held key *would* flip state many times
    // a second. This is the one place auto-repeat must be filtered explicitly.
    if (event.repeat) return;

    if (PAUSE_KEYS.has(key)) {
      const { phase } = getState();
      if (phase === PHASE.PLAYING || phase === PHASE.PAUSED) togglePause();
      return;
    }

    if (START_KEYS.has(key)) {
      const { phase } = getState();
      if (phase === PHASE.READY || phase === PHASE.OVER) start(null);
    }
  }

  window.addEventListener('keydown', onKeyDown);
}
