import { MUSIC, START_LENGTH } from './config.js';

/**
 * Everything the game is allowed to sound like: the four event voices, and the
 * generative bed that runs underneath a run.
 *
 * All of it is synthesised. There are no audio files, because an asset pipeline is
 * a build step wearing a different hat and this project has none — and a handful
 * of oscillators is smaller than one .mp3 besides.
 *
 * The voices and the bed are one subject and live in one module, but they are not
 * the same kind of thing. A voice is an *event*: something happened, and the game
 * says so once. The bed is a *state*: it is on while a run is on, it grows with the
 * snake, and it carries no information at all. See docs/tasks/006-background-music.md
 * for why a bed was allowed in after 005 deliberately went without one.
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

/**
 * The bed, as three layers over one clock.
 *
 * Each layer is a short figure that repeats on its own, and the figure lengths are
 * the whole design: 4, 16, and 11 steps. The two figures are coprime, so they only
 * return to the same relationship after 176 steps — about 35 seconds at the slowest
 * tempo and 26 at the fastest, which is longer than most runs. That is what stops a
 * bed built from three short loops from being heard as one short loop.
 *
 * The notes are indices into `NOTE` rather than raw frequencies, so a figure can be
 * read as a shape — up two, down one — instead of as seven numbers to be decoded.
 * Everything here is drawn from A, C, E, and G: one triad and its seventh, the whole
 * of the game's palette. That is why no combination of the layers can clash — there
 * is no interval in the set that wants resolving, so three figures on three different
 * clocks can overlap wherever they like and still agree.
 */
const BED = Object.freeze({
  // The pulse. Every fourth step, and long enough to still be ringing when the next
  // one is due at the fastest tempo — 1.0s against a 0.6s gap — so the bottom of the
  // bed is a drone rather than a beat. At the slow tempo the gap is 1.2s and it has
  // decayed into silence first, which is the shape the bed opens with.
  pulseEvery: 4,
  pulse: NOTE.A2,

  // The figure. One note a step, walking the scale rather than running it, so it
  // reads as a line under the board instead of as a melody competing with it.
  //
  // `dur` is the legato: at the slowest tempo a step is 0.3s, so a note shorter
  // than that leaves a gap where only the pulse is playing — and the pulse sits
  // at 110 Hz, which is below what a phone speaker reproduces. A figure that
  // overlaps its own tail is continuously audible from the first step, which is
  // the point of having it.
  figure: Object.freeze({
    notes: Object.freeze([
      NOTE.A3, NOTE.E5, NOTE.C5, NOTE.G5,
      NOTE.E5, NOTE.A5, NOTE.G5, NOTE.C5,
      NOTE.A3, NOTE.E5, NOTE.A5, NOTE.G5,
      NOTE.E5, NOTE.C5, NOTE.G5, NOTE.E5,
    ]),
    dur: 0.28,
  }),

  // The counter-figure, an octave up and half as often. It is the layer that
  // arrives when the snake gets long, which is the one thing the player hears their
  // own progress in — see MUSIC.upperFromLength.
  upperEvery: 2,
  upper: Object.freeze([
    NOTE.A5, NOTE.G5, NOTE.C6, NOTE.E5,
    NOTE.A5, NOTE.C6, NOTE.G5, NOTE.E5,
    NOTE.G5, NOTE.C6, NOTE.A5,
  ]),
});

/**
 * How each layer sounds, as opposed to what it plays.
 *
 * Shorter than the event voices, and the bed as a whole is mixed to sit under the
 * game rather than beside it — see `MUSIC.gain`, whose size a phone set.
 *
 * The pulse is the one layer that does not follow that bus. At 110Hz it is below
 * what a phone speaker reproduces at all, so raising it along with everything else
 * would spend headroom on a frequency the device cannot play, and on a speaker that
 * can play it, it is already the loudest thing in the bed. Holding its own gain
 * where the tripled bus leaves its absolute level unchanged lets the figure and the
 * counter-figure — the two a phone can actually reproduce — carry the bed instead.
 * The upper is still the quietest of the three: it is the highest and the most
 * efficient, so at the same level it would dominate.
 */
const BED_VOICES = Object.freeze({
  pulse: { type: 'sine', gain: 0.28, dur: 1.0 },
  figure: { type: 'triangle', gain: 0.30, dur: 0.28 },
  upper: { type: 'sine', gain: 0.22, dur: 0.30 },
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
 * @param {{muted?: boolean, music?: boolean}} [options] the stored preferences, if there are any
 * @returns {{
 *   unlock: () => void,
 *   play: (kind: string) => void,
 *   setMuted: (muted: boolean) => void,
 *   setMusic: (enabled: boolean) => void,
 *   setPlaying: (playing: boolean) => void,
 *   setHidden: (hidden: boolean) => void,
 *   tick: (length: number) => void,
 * }}
 */
export function createAudio({ muted = false, music = true } = {}) {
  // Null until a player has done something. That is both the autoplay rule and a
  // small saving on a page nobody has touched.
  let context = null;
  let master = null;

  // The bed's two stages, and they are separate for a reason. `musicGain` is the
  // fades the game asks for — a run starting, a run ending — and `musicDuck` is the
  // dip a voice asks for. One node doing both would mean a duck landing during a
  // fade, with two ramps writing the same parameter and the gain ending wherever
  // they happened to arrive.
  let musicGain = null;
  let musicDuck = null;

  let isMuted = muted;
  let isHidden = false;
  let musicEnabled = music;

  // What main.js says about the run. The bed is a *state* of the game rather than an
  // event inside it, so it is told when a run starts and stops rather than being left
  // to infer it from a length — length alone cannot tell a run that has just begun
  // from one that has ended, and those want opposite things.
  let runInProgress = false;

  // The resolved answer to "should the bed be audible", and the clock it keeps.
  // `nextStepAt` and `stepIndex` are in context time and are meaningless while
  // `bedRunning` is false.
  let bedRunning = false;
  let stepIndex = 0;
  let nextStepAt = 0;

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
   * Bring the bed in line with the four things that decide whether it should be
   * audible: a run being on, the setting being on, the game not being muted, and the
   * tab being visible.
   *
   * The whole truth table is written once, here, rather than at each of the four
   * setters that feed it. The interesting cases are the combinations — muting
   * mid-run, returning to a hidden tab mid-run, turning music on over a run already
   * in progress — and four call sites each handling its own would be four chances to
   * get one of those wrong.
   *
   * A no-op when the answer has not changed, which is what makes it safe to call
   * from every setter without restarting a fade that is already in flight.
   */
  function syncMusic() {
    if (context === null) return;

    const wanted = runInProgress && musicEnabled && !isMuted && !isHidden;
    if (wanted === bedRunning) return;

    bedRunning = wanted;

    const now = context.currentTime;

    // Cancelled before the new ramp is set, or a fade still in flight would fight
    // this one and the gain would land wherever the two happened to cross.
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, now);

    if (wanted) {
      // The clock restarts with the bed. A run always opens at the slow tempo, and a
      // step index carried over from the last run would drop the listener into the
      // middle of a figure rather than at the start of one.
      stepIndex = 0;
      nextStepAt = now + START_DELAY_S;
      musicGain.gain.linearRampToValueAtTime(MUSIC.gain, now + MUSIC.fadeS);
    } else {
      // Out matters more than in. A run has ended, and a bed still playing over the
      // settled board would say the run had not really ended.
      musicGain.gain.linearRampToValueAtTime(0, now + MUSIC.fadeS);
    }
  }

  /**
   * How long one step lasts, from the snake's length.
   *
   * Linear, and clamped at both ends. It runs from the starting length to
   * `fullLength` and then holds: the acceleration is there to be heard as progress,
   * and a ramp that kept going past the point where the board is full would be
   * tracking a number the player has stopped caring about — or, before long, be a
   * buzz.
   */
  function stepSeconds(length) {
    const span = MUSIC.fullLength - START_LENGTH;
    const progress = Math.min(1, Math.max(0, (length - START_LENGTH) / span));
    return (MUSIC.stepMsSlow + (MUSIC.stepMsFast - MUSIC.stepMsSlow) * progress) / 1000;
  }

  /**
   * One note of the bed, placed at an exact moment on the context clock.
   *
   * The voices in `play` are placed the same way, and for the same reason: a note
   * given to Web Audio in advance lands on the beat, and one played on arrival does
   * not.
   */
  function bedNote(layer, frequency, at) {
    const voice = BED_VOICES[layer];
    const endsAt = at + voice.dur;

    const oscillator = context.createOscillator();
    oscillator.type = voice.type;
    oscillator.frequency.setValueAtTime(frequency, at);

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(SILENT, at);
    envelope.gain.linearRampToValueAtTime(voice.gain, at + ATTACK_S);
    envelope.gain.exponentialRampToValueAtTime(SILENT, endsAt);

    oscillator.connect(envelope);
    envelope.connect(musicDuck);

    oscillator.start(at);
    oscillator.stop(endsAt);
  }

  /**
   * The three layers, as of one step.
   *
   * Each reads its own figure by its own modulo, and that is the entire mechanism
   * behind the bed not repeating: nothing here knows how long the others are. The
   * figure's 16 and the upper's 11 are coprime, so the pair realigns only every 176
   * steps — around 35 seconds at the slow tempo, 26 at the fast one.
   */
  function scheduleStep(index, at, length) {
    if (index % BED.pulseEvery === 0) bedNote('pulse', BED.pulse, at);

    bedNote('figure', BED.figure.notes[index % BED.figure.notes.length], at);

    // The upper layer is the reward for a run that has got somewhere, so it is the
    // one layer gated on length rather than on the clock.
    if (length >= MUSIC.upperFromLength && index % BED.upperEvery === 0) {
      bedNote('upper', BED.upper[index % BED.upper.length], at);
    }
  }

  /**
   * Schedule every step that falls inside the lookahead. Called once a frame.
   *
   * Notes have to be handed to the clock before they are wanted, so this runs ahead
   * of `currentTime` rather than on it. Most calls do nothing: the lookahead is
   * 120ms and a step is 150–300ms, so a frame schedules a step roughly half the
   * time — a few oscillators a second, which is nothing next to a draw.
   *
   * @param {number} length the snake's length, the bed's only input
   */
  function tick(length) {
    if (!bedRunning) return;

    // Some mobile browsers leave the context suspended immediately after
    // creation, even inside a user gesture. If we find ourselves here with
    // a suspended context, try to resume it and wait for the next frame
    // rather than scheduling silent notes.
    if (context.state === 'suspended') {
      context.resume().catch(ignore);
      return;
    }

    const now = context.currentTime;

    // The hazard, and it is the audio twin of the frame loop's own dt clamp. A
    // stalled frame or a throttled hidden tab leaves `nextStepAt` in the past, and
    // without this the loop below would discharge every step that was missed at once
    // — a burst of notes instead of a beat. The step is moved up to now rather than
    // caught up, so lateness is dropped rather than paid back in a clump.
    if (nextStepAt < now) nextStepAt = now;

    const stepS = stepSeconds(length);
    while (nextStepAt < now + MUSIC.lookaheadS) {
      scheduleStep(stepIndex, nextStepAt, length);
      nextStepAt += stepS;
      stepIndex += 1;
    }
  }

  /**
   * Drop the bed for a moment so a voice can be heard over it.
   *
   * The recovery is a `setTargetAtTime` rather than a ramp, and that is the point:
   * the bed has no idea when the next voice will arrive, and a target approaches its
   * value without having to be told how long it has. A second eat during the first
   * one's dip therefore re-aims the same curve rather than scheduling a second ramp
   * that the two would then have to agree about.
   */
  function duck() {
    if (!bedRunning) return;

    const now = context.currentTime;
    musicDuck.gain.cancelScheduledValues(now);
    musicDuck.gain.setValueAtTime(MUSIC.duckGain, now);
    musicDuck.gain.setTargetAtTime(1, now, MUSIC.duckS / 3);
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

        // The bed's chain, built once with the context rather than on the first run
        // that wants it: creating nodes is not the gesture-gated part, starting the
        // context is, and a graph assembled mid-run is a graph that can be assembled
        // wrongly in front of a player.
        //
        // `musicGain` starts at zero because the bed is not playing yet — nothing has
        // started a run — and the first fade ramps up from exactly there.
        musicGain = context.createGain();
        musicGain.gain.value = 0;
        musicGain.connect(master);

        musicDuck = context.createGain();
        musicDuck.gain.value = 1;
        musicDuck.connect(musicGain);
      } catch {
        // Absent, blocked by policy, or the page is out of contexts. The game plays
        // on in silence and the console stays clean, which is the same posture
        // storage takes when it cannot write.
        context = null;
        master = null;
        musicGain = null;
        musicDuck = null;
        return;
      }
    }

    applyRunning();
    syncMusic();
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

    // The bed steps aside for the acknowledgement. An eat fires up to 8⅓ times a
    // second and shares a band with the figure, so without this the one sound the
    // player most needs to hear would be the one most likely to be covered.
    duck();

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
    tick,

    setMuted(next) {
      isMuted = next;
      applyRunning();
      syncMusic();
    },

    // The narrower of the two switches: this one silences the bed and leaves the
    // voices alone, where `setMuted` silences everything.
    setMusic(next) {
      musicEnabled = next;
      syncMusic();
    },

    setPlaying(next) {
      runInProgress = next;
      syncMusic();
    },

    setHidden(next) {
      isHidden = next;
      applyRunning();
      syncMusic();
    },
  };
}
