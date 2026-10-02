import {
  KEY_MAP,
  PAUSE_KEYS,
  START_KEYS,
  MUTE_KEYS,
  MUSIC_KEYS,
  PREVENT_DEFAULT_KEYS,
  DIRECTIONS,
} from './config.js';
import { PHASE } from './state.js';

/**
 * This is the only module that listens for input, from any device.
 *
 * The module translates a physical press — a key, or a finger on the pad — into
 * one of four intents and hands it to the caller, which owns the phase
 * transitions. That split keeps this file free of game rules and keeps the state
 * machine in exactly one place.
 *
 * `turn` is not phase-checked here beyond what `dispatchDirection` requires:
 * while playing it is always passed through, because whether a turn is *legal*
 * depends on the queue, which the simulation owns.
 *
 * `toggleMute` is likewise not phase-checked at all — not even to the extent
 * `togglePause` is. Sound is a setting rather than a game action, so it is legal
 * on the ready screen, over a finished run, and mid-game alike. `toggleMusic` is the
 * same kind of thing and is handled the same way.
 *
 * @param {{
 *   getState: () => { phase: string },
 *   start: (direction: {x: number, y: number} | null) => void,
 *   togglePause: () => void,
 *   toggleMute: () => void,
 *   toggleMusic: () => void,
 *   turn: (direction: {x: number, y: number}) => void,
 * }} handlers
 */
export function attachInput({ getState, start, togglePause, toggleMute, toggleMusic, turn }) {
  const pad = document.getElementById('pad');
  const pause = document.getElementById('pause');
  const sound = document.getElementById('sound');

  /**
   * The pad is part of the game now, not an optional extra, and a missing one
   * would leave the game unplayable on a phone while looking perfectly fine on
   * the desktop machine it was written on. So this fails as loudly as a missing
   * canvas does, where it is written rather than where it is played.
   */
  if (
    pad === null ||
    pause === null ||
    sound === null ||
    pad.querySelectorAll('button[data-direction]').length !== 4
  ) {
    throw new Error(
      'Touch controls are missing from the document: expected #pad holding four button[data-direction], #pause, and #sound',
    );
  }

  /**
   * The music control, one per overlay. One query wires all three, the same shape
   * as the pad's four keys and for the same reason: a fourth screen carrying
   * `data-music` would need nothing here.
   *
   * Checked rather than assumed, because a misspelled attribute makes
   * `querySelectorAll` return an empty list, and an empty list is silently a no-op
   * — the one failure mode that leaves a control looking finished and doing
   * nothing at all.
   */
  const musicButtons = document.querySelectorAll('button[data-music]');

  if (musicButtons.length === 0) {
    throw new Error(
      'The music control is missing from the document: expected a button[data-music] on each overlay',
    );
  }

  /**
   * The pad's vocabulary, mapped to the same direction names KEY_MAP uses.
   *
   * Two steps rather than one on purpose: it makes the lookup here identical in
   * shape to the keyboard's, and both are then safe against an attribute holding
   * an inherited object key such as "constructor", which a single-step table
   * would resolve to a function and queue as though it were a direction.
   */
  const PAD_KEYS = { up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT' };

  /**
   * Route a direction intent by phase.
   *
   * Both sources call this and neither decides for itself. A second copy of this
   * branch would be identical until the day one of them was edited, and the cases
   * it would then diverge on are exactly the ones nobody exercises: a direction
   * pressed while paused, or while the game is over.
   */
  function dispatchDirection(direction) {
    const { phase } = getState();
    if (phase === PHASE.READY || phase === PHASE.OVER) {
      start(direction);
    } else if (phase === PHASE.PLAYING) {
      turn(direction);
    }
  }

  function onKeyDown(event) {
    // Modifier combinations belong to the browser, not to the game. Bailing
    // before preventDefault keeps Ctrl/Meta shortcuts working.
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const { key } = event;

    // Whether this press landed on a control rather than on the page. The music
    // buttons are inside overlays, which makes them the first thing in the game a
    // keyboard can reach — and a focused button is something the browser is going to
    // activate on its own.
    const onControl = event.target instanceof Element && event.target.closest('button') !== null;

    // Arrows scroll and Space scrolls or re-activates the focused element, so both
    // are suppressed. WASD has no default behaviour worth preventing. Space on a
    // focused control is the exception, and the reason the check above exists:
    // re-activating the focused element is not a default to suppress, it is the
    // button's own activation, and suppressing it would put the music control out of
    // reach of the one key that reaches a button.
    if (PREVENT_DEFAULT_KEYS.has(key) && !(onControl && key === ' ')) event.preventDefault();

    const direction = DIRECTIONS[KEY_MAP[key]];

    if (direction !== undefined) {
      // Auto-repeat is deliberately not filtered: a held direction is a
      // duplicate of the queue tail, which queue validation already rejects.
      dispatchDirection(direction);
      return;
    }

    // Pause, mute, and start are toggles, so a held key *would* flip state many
    // times a second. This is the one place auto-repeat must be filtered
    // explicitly.
    if (event.repeat) return;

    // First, and with no phase check: sound is a setting, not a move, so it is
    // answerable on every screen the game has.
    if (MUTE_KEYS.has(key)) {
      toggleMute();
      return;
    }

    // Immediately after it, and answered the same way, because it is the same kind
    // of thing: the bed's own switch rather than a move. `M` beside it is the master
    // one, and the two are adjacent on the keyboard so the pair reads as a pair.
    if (MUSIC_KEYS.has(key)) {
      toggleMusic();
      return;
    }

    if (PAUSE_KEYS.has(key)) {
      const { phase } = getState();
      if (phase === PHASE.PLAYING || phase === PHASE.PAUSED) togglePause();
      return;
    }

    if (START_KEYS.has(key)) {
      // A press that lands on a focused control belongs to that control. Enter and
      // Space start a game *and* activate a button, so without this one press would
      // do both: start a run the player was not asking for and change the setting
      // they were. Directions are not subject to this and were dispatched above —
      // the arrow keys are the game's, whatever happens to be focused.
      if (onControl) return;

      const { phase } = getState();
      if (phase === PHASE.READY || phase === PHASE.OVER) start(null);
    }
  }

  /**
   * `pointerdown`, not `click`. A click fires on release, which adds the whole
   * duration of the press to the turn's latency, and it does not fire at all if
   * the finger moves off the key before lifting — during fast play, exactly when
   * the input matters most.
   *
   * One listener for the whole pad rather than one per key, and nothing is
   * cancelled: `preventDefault` here would also suppress the `:active` state,
   * and on a control whose only feedback is that state, the acknowledgement of
   * the press is the whole point.
   */
  function onPadPointerDown(event) {
    // A right or middle click is not a direction. A touch or pen pointer down
    // reports button 0, exactly as a left mouse button does.
    if (event.button !== 0) return;

    const key = event.target.closest('button[data-direction]');
    if (key === null) return;

    const direction = DIRECTIONS[PAD_KEYS[key.dataset.direction]];
    if (direction === undefined) return;

    // The press is the intent. Nothing else is read from the gesture, and a
    // second finger is simply a second press — the queue's own cap is what
    // limits how far ahead a player can bank turns.
    dispatchDirection(direction);
  }

  /**
   * `click`, not `pointerdown` — and the pad's reason for `pointerdown` is the
   * reason it does not apply here.
   *
   * That reason is latency: a click fires on release, so it adds the whole press
   * to a turn's delay and does not fire at all if the finger slides off, "during
   * fast play, exactly when the input matters most". Nothing is timed against a
   * pause — the simulation is not waiting on it and a pause that lands 80ms later
   * is not late, it is a pause.
   *
   * What that leaves is the other half of the same property, and it is the point:
   * a click needs the down and the up on the same element, so a thumb that lands
   * on Pause on its way to the pad and slides off does nothing at all. That is the
   * accidental pause a phone player reported, and this makes it a no-op.
   *
   * Whether the pause is legal is not asked here, and it is answered twice anyway:
   * the button is `disabled` outside PLAYING and PAUSED, so a click cannot arrive
   * at all, and `togglePause` returns unchanged on any other phase. The keyboard
   * path above checks the phase in this file because it has nothing else to lean
   * on — the P key is always live. The same check here would be unreachable.
   */
  function onPauseClick() {
    togglePause();
  }

  /**
   * The sound control takes the same gesture as Pause, and this is the same
   * decision rather than a copy of it: every control that is not the pad answers to
   * `click`, and the pad alone answers to `pointerdown`.
   *
   * The pad's case for `pointerdown` is latency — a turn is timed against a 120ms
   * tick — and nothing about a mute is timed against anything. What that leaves is
   * the property the placement above is built on: a click needs the down and the up
   * on the same element, so a thumb that lands on Sound on its way to the pad and
   * slides off does nothing at all. Firing on touch-down there would undo in one
   * line the separation the layout spends 32px to create.
   *
   * It is also one of the two controls the game relabels to report their own state
   * — the Music buttons are the other — so pressing it is never unacknowledged.
   * See the `#sound` handling in main.js.
   */
  function onSoundClick() {
    toggleMute();
  }

  /**
   * The music controls, on all three overlays.
   *
   * `click`, not `pointerdown`, for the rule Pause also follows: the pad fires on
   * touch-down because a turn is timed against a 120ms tick and a late one is
   * fatal, and none of that reaches a control nothing is being timed against.
   *
   * One more reason is this button's alone — it is inside an overlay, which makes
   * it the only control a keyboard can reach, and the browser synthesises a `click`
   * for a key press and nothing else.
   *
   * No `preventDefault`, for the same reason the pad has none: this control's
   * `:active` and `:focus-visible` states are the acknowledgement of the press.
   */
  function onMusicClick() {
    toggleMusic();
  }

  pad.addEventListener('pointerdown', onPadPointerDown);
  pause.addEventListener('click', onPauseClick);
  sound.addEventListener('click', onSoundClick);
  window.addEventListener('keydown', onKeyDown);

  for (const button of musicButtons) {
    button.addEventListener('click', onMusicClick);
  }
}
