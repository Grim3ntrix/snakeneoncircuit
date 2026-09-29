import { STATS_KEY } from './config.js';

/**
 * The player's saved record: the best score, and the longest snake.
 *
 * This is the only module in the project that touches `localStorage`, and
 * everything it does is best-effort. Storage can be full, disabled by policy,
 * or absent outright, and in Safari's private mode even reading the property
 * throws. A player without working storage gets the game exactly as it was
 * before this module existed, and hears nothing about it.
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

// Every field is a count of something, so every field is a non-negative
// integer. `isSafeInteger` also rejects Infinity, NaN, and 1e999 — which
// JSON.parse will happily hand back as Infinity.
function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
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
  let raw;
  try {
    raw = window.localStorage.getItem(STATS_KEY);
  } catch {
    // Unavailable, not merely empty. Reading the property is itself the throw.
    return EMPTY_STATS;
  }

  if (raw === null) return EMPTY_STATS;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_STATS;
  }

  // null, an array, and a bare string or number all parse fine and are all
  // wrong. Only a plain object can carry the two fields.
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return EMPTY_STATS;
  }

  const { best, longest } = parsed;
  if (!isCount(best) || !isCount(longest)) return EMPTY_STATS;

  // Rebuilt field by field rather than returned as parsed, so nothing else the
  // stored JSON happened to contain can travel any further.
  return { best, longest };
}

/**
 * Write the record. Never throws.
 *
 * A failure here costs the player their record and nothing else, which is not
 * worth an error the game cannot act on.
 *
 * @param {{best: number, longest: number}} stats
 */
export function saveStats(stats) {
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Full, disabled, or absent. The record is a nicety; the game is not.
  }
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
