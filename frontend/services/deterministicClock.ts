/**
 * Deterministic clock & identity source — the single seam for wall-clock
 * time and unique identifiers in the ARE Agent Studio frontend.
 *
 * Why this exists: scattered Date.now / new Date / Math.random calls
 * make runtime behaviour impossible to reproduce and to assert in
 * regression tests. Routing every timestamp and identifier through this
 * module gives the suite a deterministic knob while preserving real
 * provenance in production.
 *
 * Production mode (default): `now()` returns real wall-clock epoch
 * milliseconds and `isoTimestamp()` returns the real ISO 8601 instant, so
 * dataset rows and receipts keep their evidence-bound provenance.
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
export function now(): number {
  return deterministic ? deterministicNow : Date.now();
}

/** ISO 8601 timestamp for the current instant (real in production). */
export function isoTimestamp(): string {
  return new Date(now()).toISOString();
}

/** Localized wall-clock string for a stored epoch (UI display only). */
export function formatLocalTime(epoch: number): string {
  return new Date(epoch).toLocaleTimeString();
}

/**
 * Deterministic, reproducible unique identifier.
 * Uses a monotonic counter — never `Math.random` — so two runs in
 * deterministic mode produce byte-identical id sequences.
 */
export function uniqueId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

// --- Test-only control surface --------------------------------------------

/** Pin the clock for deterministic regression runs. */
export function enableDeterministicMode(initialNow = 0): void {
  deterministic = true;
  deterministicNow = initialNow;
  idCounter = 0;
}

/** Advance the pinned deterministic clock by `ms` (default 1ms). */
export function tick(ms = 1): void {
  if (!deterministic) return;
  deterministicNow += ms;
}

/** Restore real wall-clock behaviour. */
export function disableDeterministicMode(): void {
  deterministic = false;
}

/** Whether the clock is currently pinned to deterministic mode. */
export function isDeterministicMode(): boolean {
  return deterministic;
}
