/**
 * Deterministic clock & identity source for the forge-runner package.
 *
 * Production mode (default): `now()` returns real wall-clock epoch
 * milliseconds so run-state and trajectory provenance stay evidence-bound.
 *
 * Deterministic mode (tests only): `enableDeterministicMode()` pins time to
 * a monotonic counter advanced by `tick()`, and `uniqueId()` returns a
 * reproducible counter-based identifier — no `Math.random`, no wall clock.
 *
 * The static guard `scripts/determinism_scan.mjs` fails CI if any non-test
 * source file calls `Date.now`, `new Date`, or `Math.random` directly.
 */

let deterministic = false;
let deterministicNow = 0;
let idCounter = 0;

export function now() {
  return deterministic ? deterministicNow : Date.now();
}

export function isoTimestamp() {
  return new Date(now()).toISOString();
}

export function uniqueId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function enableDeterministicMode(initialNow = 0) {
  deterministic = true;
  deterministicNow = initialNow;
  idCounter = 0;
}

export function tick(ms = 1) {
  if (!deterministic) return;
  deterministicNow += ms;
}

export function disableDeterministicMode() {
  deterministic = false;
}

export function isDeterministicMode() {
  return deterministic;
}
