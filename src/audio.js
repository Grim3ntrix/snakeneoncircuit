/**
 * The four sounds the game makes, and the rules about when it is allowed to make
 * them.
 *
 * Everything here is synthesised. There are no audio files, because an asset
 * pipeline is a build step wearing a different hat and this project has none — and
 * four oscillators are smaller than one .mp3 besides.
 *
 * No DOM. The only browser capability it needs is `AudioContext`, and that is not
 * touched until `unlock()` is called from inside a gesture. Until then this module
 * is inert, which is what lets it be imported anywhere.
 */

export const SOUND = Object.freeze({
  EAT: 'eat',
  DEATH: 'death',
  WIN: 'win',
  BEST: 'best',
});

/**
 * Equal-temperament frequencies, named.
 *
 * A voice written as `659.25` is a voice nobody can edit. They are also all the
 * pitches the game owns: a limited palette applies to sound the way it applies to
 * colour, so the four voices draw from one short list rather than each inventing
 * its own notes.
 */
const NOTE = Object.freeze({
  A2: 110.0,
  A3: 220.0,
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
});

/**
 * The voices, in one table.
 *
 * A note is an oscillator with a gain envelope. `freq` is where it sounds, `to` is
 * where it glides to by the end if it glides at all, `at` is when it begins
 * relative to the sound, and `dur` is how long it lasts.
 *
 * `gain` is per voice rather than per note, because the three-note figure would
 * otherwise be three times as loud as the one-note blip.
 */
const VOICES = Object.freeze({
  // Bright, short, and rising: the node was taken.
  eat: {
    type: 'triangle',
    gain: 0.5,
    notes: [{ freq: NOTE.E5, to: NOTE.A5, dur: 0.09 }],
  },

  // The signal stopping. Low, falling, and a sine — the harmonics that make the
  // other three read as live signals are exactly what this one must not have.
  death: {
    type: 'sine',
    gain: 0.62,
    notes: [{ freq: NOTE.A3, to: NOTE.A2, dur: 0.34 }],
  },

  // The signal completing: a triad, one note at a time, resolving upward.
  win: {
    type: 'triangle',
    gain: 0.36,
    notes: [
      { freq: NOTE.C5, dur: 0.16 },
      { at: 0.09, freq: NOTE.E5, dur: 0.16 },
      { at: 0.18, freq: NOTE.A5, dur: 0.22 },
    ],
  },

  // Higher and shorter than the win figure, so it reads as the run having been
  // rewarded rather than merely having ended. Its first note is late because it
  // never plays alone: it always follows the outcome it is reporting on, and the
  // delay is what stops the two speaking over each other.
  best: {
    type: 'triangle',
    gain: 0.34,
    notes: [
      { at: 0.5, freq: NOTE.G5, dur: 0.11 },
      { at: 0.6, freq: NOTE.C6, dur: 0.2 },
    ],
  },
});

// Where the master sits. Low, because a browser game that is loud is a browser game
// that gets muted and never unmuted.
const MASTER_GAIN = 0.22;

// Envelope shape, shared by every note: a fast attack so the tone has an edge, and
// an exponential release so the tail decays the way a struck object does. A linear
// fade is what makes a synthesised blip sound like a volume knob being turned down.
const ATTACK_S = 0.004;
const SILENT = 0.0001;

// Scheduling is done slightly ahead of the clock, so no note is ever asked to
// start at a moment that has already passed.
const START_DELAY_S = 0.01;

/**
 * `resume()` and `suspend()` both reject if the context was closed underneath us.
 * There is nothing to do about that and nothing worth saying about it.
 */
function ignore() {}

/**
 * @param {{muted?: boolean}} [options] the stored preference, if there is one
 * @returns {{
 *   unlock: () => void,
 *   play: (kind: string) => void,
 *   setMuted: (muted: boolean) => void,
 *   setHidden: (hidden: boolean) => void,
 * }}
 */
export function createAudio({ muted = false } = {}) {
  // Null until a player has done something. That is both the autoplay rule and a
  // small saving on a page nobody has touched.
  let context = null;
  let master = null;
  let isMuted = muted;
  let isHidden = false;

  /**
   * Make the context's running state agree with the two things that decide it: the
   * sound being on, and the tab being visible.
   *
   * Nothing here loops, so this is not about silencing a noise. It is about not
   * holding a running audio thread for a tab nobody is looking at.
   */
  function applyRunning() {
    if (context === null) return;

    const wanted = !isMuted && !isHidden;
    if (wanted === (context.state === 'running')) return;

    (wanted ? context.resume() : context.suspend()).catch(ignore);
  }

  /**
   * Create the context, inside a gesture. Called from the one place a player can
   * begin a game, and from nowhere else.
   *
   * The timing is the whole point of the function. A context created outside a user
   * gesture does not start, and Chrome says so in the console — which a project
   * requiring a clean console cannot accept, however convenient creating it at load
   * would be. Nothing is lost by waiting: the ready screen has no sound to make,
   * and this runs before any sound the game is able to produce.
   *
   * Safe to call repeatedly, and safe to call where Web Audio does not exist, in
   * which case the game is simply silent.
   */
  function unlock() {
    if (context === null) {
      try {
        const Context = window.AudioContext ?? window.webkitAudioContext;
        if (Context === undefined) return;

        context = new Context();
        master = context.createGain();
        master.gain.value = MASTER_GAIN;
        master.connect(context.destination);
      } catch {
        // Absent, blocked by policy, or the page is out of contexts. The game plays
        // on in silence and the console stays clean, which is the same posture
        // storage takes when it cannot write.
        context = null;
        master = null;
        return;
      }
    }

    applyRunning();
  }

  /**
   * Play one voice.
   *
   * A no-op before `unlock()`, while muted, and while the tab is hidden — so the
   * caller never has to ask whether the sound is available before asking for it.
   *
   * @param {string} kind a SOUND value
   */
  function play(kind) {
    if (context === null || isMuted || isHidden) return;

    const voice = VOICES[kind];
    const start = context.currentTime + START_DELAY_S;

    for (const note of voice.notes) {
      const at = start + (note.at ?? 0);
      const endsAt = at + note.dur;

      const oscillator = context.createOscillator();
      oscillator.type = voice.type;
      oscillator.frequency.setValueAtTime(note.freq, at);
      if (note.to !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(note.to, endsAt);
      }

      const envelope = context.createGain();
      envelope.gain.setValueAtTime(SILENT, at);
      envelope.gain.linearRampToValueAtTime(voice.gain, at + ATTACK_S);
      envelope.gain.exponentialRampToValueAtTime(SILENT, endsAt);

      oscillator.connect(envelope);
      envelope.connect(master);

      // Both ends are named, so the node is released as soon as it has finished
      // rather than being held for the life of the page.
      oscillator.start(at);
      oscillator.stop(endsAt);
    }
  }

  return {
    unlock,
    play,

    setMuted(next) {
      isMuted = next;
      applyRunning();
    },

    setHidden(next) {
      isHidden = next;
      applyRunning();
    },
  };
}
