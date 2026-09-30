import { SETTINGS_KEY, STATS_KEY } from './config.js';

/**
 * Everything the game remembers between visits: the player's record, and how they
 * want the game to sound.
 *
 * This is the only module in the project that touches `localStorage`, and
 * everything it does is best-effort. Storage can be full, disabled by policy,
 * or absent outright, and in Safari's private mode even reading the property
 * throws. A player without working storage gets the game exactly as it was
 * before this module existed, and hears nothing about it.
 *
 * The two are stored under separate keys rather than as one object. They are
 * unrelated, they fail independently, and keeping them together would mean a
 * corrupt score silently taking the sound setting down with it — which is the
 * failure all-or-nothing validation exists to prevent, not to cause.
 *
 * Attempts are deliberately not here. They count a session, not a career: the
 * player who reloads starts again at one. What survives a reload is the record.
 *
 * `longest` is stored but never displayed — score and length move together, so
 * it is always `best` plus the starting length. It earns its place anyway: it is
 * the only field that can say whether any game has been finished, because a run
 * that ate nothing leaves `best` at zero, which is also what a first visit
 * looks like.
 */

/** What a missing, unreadable, or rejected record reads as. */
export const EMPTY_STATS = Object.freeze({ best: 0, longest: 0 });

/** The game makes a noise, and has a bed under it, until the player says otherwise. */
export const DEFAULT_SETTINGS = Object.freeze({ muted: false, music: true });

// Every field of the record is a count of something, so every field is a
// non-negative integer. `isSafeInteger` also rejects Infinity, NaN, and 1e999 —
// which JSON.parse will happily hand back as Infinity.
function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Read a key and parse it as a plain object, or return null.
 *
 * Every way this can fail lands in the same place: the key absent, unreadable,
 * not JSON at all, or JSON that is not an object. Both readers below want the
 * same thing from that — to fall back to their defaults — so the difference
 * between the failures is discarded here rather than at each call site.
 *
 * Reading `window.localStorage` is itself inside the try, because in Safari's
 * private mode the property access is what throws, not the methods on it.
 */
function readObject(key) {
  let raw;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return null;
  }

  if (raw === null) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // null, an array, and a bare string or number all parse fine and are all wrong.
  // Only a plain object can carry named fields.
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  return parsed;
}

/**
 * Write a value under a key. Never throws.
 *
 * A failure here costs the player their record, or their sound preference, and
 * nothing else — which is not worth an error the game cannot act on.
 */
function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Full, disabled, or absent. The record is a nicety; the game is not.
  }
}

/**
 * Read the record, or return the defaults.
 *
 * Stored data is external input. It can be hand-edited, truncated by a quota
 * error, or written by an older build, so a record that is not exactly the
 * shape this version writes is treated as no record at all.
 *
 * A record with one bad field is rejected **whole** rather than salvaged. A
 * half-valid record means something wrote it wrongly, and keeping the
 * plausible-looking half is how a wrong number becomes permanent.
 *
 * @returns {{best: number, longest: number}}
 */
export function loadStats() {
  const parsed = readObject(STATS_KEY);
  if (parsed === null) return EMPTY_STATS;

  const { best, longest } = parsed;
  if (!isCount(best) || !isCount(longest)) return EMPTY_STATS;

  // Rebuilt field by field rather than returned as parsed, so nothing else the
  // stored JSON happened to contain can travel any further.
  return { best, longest };
}

/**
 * Write the record. Never throws.
 *
 * @param {{best: number, longest: number}} stats
 */
export function saveStats(stats) {
  write(STATS_KEY, stats);
}

/**
 * The two audio preferences, or the defaults.
 *
 * A preference rather than a record, and validated the same way: anything that is
 * not exactly the shape this writes — the key absent, invalid JSON, a field that
 * is a string or missing — reads as the defaults rather than as a value to
 * interpret. There is no partial answer to "should this be silent".
 *
 * Rejecting the object whole rather than salvaging the fields that look right is
 * also what lets this key stay at v1 while its shape widens from one boolean to
 * two. A record written before `music` existed holds only `muted`, is rejected
 * here, and reads as the defaults — so an older record can never be read back as
 * though it had the newer shape, which is the guarantee the versioning rule in
 * config.js exists to provide. See docs/tasks/006-background-music.md.
 *
 * @returns {{muted: boolean, music: boolean}}
 */
export function loadSettings() {
  const parsed = readObject(SETTINGS_KEY);
  if (parsed === null) return DEFAULT_SETTINGS;
  if (typeof parsed.muted !== 'boolean' || typeof parsed.music !== 'boolean') return DEFAULT_SETTINGS;

  // Rebuilt field by field, like the record above, so nothing else the stored
  // JSON happened to contain can travel any further.
  return { muted: parsed.muted, music: parsed.music };
}

/**
 * Write both audio preferences. Never throws.
 *
 * @param {{muted: boolean, music: boolean}} settings
 */
export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}

/**
 * Fold one finished run into the record.
 *
 * Pure, and takes the current record rather than reading storage itself, so the
 * folding rules can be exercised without a browser. Whether the run set a
 * record is the caller's question to ask — it depends on the previous value,
 * which is gone by the time this returns.
 *
 * @param {{best: number, longest: number}} stats
 * @param {{score: number, length: number}} result
 * @returns {{best: number, longest: number}}
 */
export function mergeResult(stats, { score, length }) {
  return {
    best: Math.max(stats.best, score),
    longest: Math.max(stats.longest, length),
  };
}
