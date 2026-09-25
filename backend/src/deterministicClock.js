/**
 * Deterministic clock & identity source — the single seam for wall-clock
 * time and unique identifiers in the ARE Agent Studio backend.
 *
 * Production mode (default): `now()` returns real wall-clock epoch
 * milliseconds and `isoTimestamp()` returns the real ISO 8601 instant, so
 * ledger receipts keep their evidence-bound provenance.
 *
 * Deterministic mode (tests only): `enableDeterministicMode()` pins time to
 * a monotonic counter advanced by `tick()`, and `uniqueId()` returns a
 * reproducible counter-based identifier — no `Math.random`, no wall clock.
 *
 * The static guard `scripts/determinism_scan.mjs` fails CI if any non-test,
 * non-protected source file calls `Date.now`, `new Date`, or `Math.random`
 * directly instead of going through this module.
 */

let deterministic = false;
let deterministicNow = 0;
let idCounter = 0;

/** Wall-clock epoch milliseconds, or the pinned deterministic value in tests. */
export function now() {
  return deterministic ? deterministicNow : Date.now();
}

/** ISO 8601 timestamp for the current instant (real in production). */
export function isoTimestamp() {
  return new Date(now()).toISOString();
}

/**
 * Deterministic, reproducible unique identifier.
 * Uses a monotonic counter — never `Math.random` — so two runs in
 * deterministic mode produce byte-identical id sequences.
 */
export function uniqueId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

// --- Test-only control surface --------------------------------------------

/** Pin the clock for deterministic regression runs. */
export function enableDeterministicMode(initialNow = 0) {
  deterministic = true;
  deterministicNow = initialNow;
  idCounter = 0;
}

/** Advance the pinned deterministic clock by `ms` (default 1ms). */
export function tick(ms = 1) {
  if (!deterministic) return;
  deterministicNow += ms;
}

/** Restore real wall-clock behaviour. */
export function disableDeterministicMode() {
  deterministic = false;
}

/** Whether the clock is currently pinned to deterministic mode. */
export function isDeterministicMode() {
  return deterministic;
}
