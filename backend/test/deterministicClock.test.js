import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  now,
  isoTimestamp,
  uniqueId,
  enableDeterministicMode,
  tick,
  disableDeterministicMode,
  isDeterministicMode,
} from '../src/deterministicClock.js';

test('deterministicClock: production now() tracks real wall-clock time', () => {
  disableDeterministicMode();
  assert.equal(isDeterministicMode(), false);
  const before = Date.now();
  const t = now();
  const after = Date.now();
  assert.ok(t >= before && t <= after, 'now() must return a real epoch millisecond');
});

test('deterministicClock: enableDeterministicMode pins and advances the clock', () => {
  enableDeterministicMode(1000);
  assert.equal(isDeterministicMode(), true);
  assert.equal(now(), 1000);
  tick(5);
  assert.equal(now(), 1005);
  tick();
  assert.equal(now(), 1006);
  disableDeterministicMode();
  assert.equal(isDeterministicMode(), false);
});

test('deterministicClock: isoTimestamp reflects the pinned instant deterministically', () => {
  enableDeterministicMode(0);
  assert.equal(isoTimestamp(), new Date(0).toISOString());
  tick(1000);
  assert.equal(isoTimestamp(), new Date(1000).toISOString());
  disableDeterministicMode();
});

test('deterministicClock: uniqueId is deterministic, reproducible, and never random', () => {
  enableDeterministicMode();
  const a1 = uniqueId('TR');
  const a2 = uniqueId('TR');
  const a3 = uniqueId('DAGGER');
  assert.equal(a1, 'TR-1');
  assert.equal(a2, 'TR-2');
  assert.equal(a3, 'DAGGER-3');

  // A second deterministic session reproduces the exact same sequence.
  enableDeterministicMode();
  assert.equal(uniqueId('TR'), 'TR-1');
  assert.equal(uniqueId('TR'), 'TR-2');
  disableDeterministicMode();
});

test('deterministicClock: two deterministic sessions are byte-identical', () => {
  enableDeterministicMode(5000);
  const seq1 = [now(), uniqueId('x'), tick(3), now(), uniqueId('y')];
  enableDeterministicMode(5000);
  const seq2 = [now(), uniqueId('x'), tick(3), now(), uniqueId('y')];
  assert.deepEqual(seq1, seq2);
  disableDeterministicMode();
});
