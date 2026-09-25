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
} from '../deterministicClock.js';

test('forge-runner clock: production now() returns a real epoch', () => {
  disableDeterministicMode();
  assert.equal(isDeterministicMode(), false);
  const before = Date.now();
  const t = now();
  const after = Date.now();
  assert.ok(t >= before && t <= after);
});

test('forge-runner clock: deterministic mode pins and advances', () => {
  enableDeterministicMode(2000);
  assert.equal(now(), 2000);
  tick(10);
  assert.equal(now(), 2010);
  disableDeterministicMode();
});

test('forge-runner clock: uniqueId is deterministic and reproducible', () => {
  enableDeterministicMode();
  assert.equal(uniqueId('turn'), 'turn-1');
  assert.equal(uniqueId('turn'), 'turn-2');
  enableDeterministicMode();
  assert.equal(uniqueId('turn'), 'turn-1');
  disableDeterministicMode();
});

test('forge-runner clock: isoTimestamp reflects the pinned instant', () => {
  enableDeterministicMode(0);
  assert.equal(isoTimestamp(), new Date(0).toISOString());
  disableDeterministicMode();
});
