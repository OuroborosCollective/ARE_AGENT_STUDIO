import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startRunnerServer } from '../server.js';

test('real HTTP host stays live but cannot claim gameplay readiness or mutate runs', async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-host-'));
  const server = await startRunnerServer({ port: 0, dataDir });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const live = await fetch(`${base}/health`);
  assert.equal(live.status, 200);
  const health = await live.json();
  assert.equal(health.process_alive, true);
  assert.equal(health.ready, false);
  assert.equal(health.credential_configured, false);
  assert.equal(health.contract_reachable, false);
  assert.equal((await fetch(`${base}/ready`)).status, 503);
  assert.equal((await fetch(`${base}/ready`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${base}/turn`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${base}/missing`)).status, 404);
});

test('corrupt durable state prevents process startup', async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-host-corrupt-'));
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  await fs.writeFile(path.join(dataDir, 'run-state.json'), '{broken');
  await assert.rejects(startRunnerServer({ port: 0, dataDir }));
});
