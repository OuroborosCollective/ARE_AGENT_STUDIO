import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHttpServer } from '../src/httpServer.js';
import { createAdvisoryGateway } from '../src/advisoryGateway.js';
import { createAdbBridge } from '../src/adbBridge.js';
import { VERIFIED_IMITATION_SCHEMA_VERSION } from '../src/verifiedImitationValidation.js';

/**
 * Regression suite for the backend error-code -> HTTP-status family.
 * Each case pins a status that was previously wrong before the big-hunt fixes.
 */

function verifiedImitationFixture(index = 0) {
  return {
    schema_version: VERIFIED_IMITATION_SCHEMA_VERSION,
    verification_id: 'client-placeholder',
    context: { session_id: 'err-family-session', sequence_index: index, episode_id: 'err-episode' },
    action: {
      action_id: `err-action-${index}`,
      action_type: 'mobile.tap',
      policy_revision_sha256: 'a'.repeat(64),
      observation_before_sha256: 'b'.repeat(64),
      action_command_sha256: 'c'.repeat(64),
    },
    evaluation: {
      method: 'device_readback',
      result: 'reproduced',
      evaluator_ref: 'err-evaluator',
      verified_at_epoch: 100 + index,
      action_receipt_sha256: 'd'.repeat(64),
      observation_after_sha256: 'e'.repeat(64),
      device_readback_sha256: 'f'.repeat(64),
      independent_evidence_sha256: '1'.repeat(64),
    },
  };
}

async function startServer(options) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-err-family-'));
  const { server } = await createHttpServer({ dataDir: dir, authToken: 'tok', ...options });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}`, dir };
}

function post(base, pathname, body) {
  return fetch(`${base}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer tok' },
    body: JSON.stringify(body),
  });
}

test('invalid verified imitation row returns 422, not 400 (INVALID_VERIFIED_IMITATION family)', async (t) => {
  const { server, base } = await startServer({ verifiedImitationWriteEnabled: true });
  t.after(() => server.close());
  const res = await post(base, '/api/v1/verified-imitations/push', {
    schema_version: 'wrong', context: {}, action: {}, evaluation: {},
  });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).success, false);
});

test('a valid verified imitation row is still accepted as 201 after the mapping fix', async (t) => {
  const { server, base } = await startServer({ verifiedImitationWriteEnabled: true });
  t.after(() => server.close());
  const res = await post(base, '/api/v1/verified-imitations/push', verifiedImitationFixture(0));
  assert.equal(res.status, 201);
});

test('advisory provider transport failure returns 502, not 400', async (t) => {
  const advisory = createAdvisoryGateway({
    endpoint: 'https://provider.example/v1/chat/completions',
    model: 'm',
    fetchImpl: async () => { throw new Error('ECONNREFUSED'); },
  });
  const { server, base } = await startServer({ advisoryGateway: advisory });
  t.after(() => server.close());
  const res = await post(base, '/api/v1/advisory/complete', { prompt: 'inspect' });
  assert.equal(res.status, 502);
});

test('advisory provider non-JSON HTTP error returns 502, not 422', async (t) => {
  const advisory = createAdvisoryGateway({
    endpoint: 'https://provider.example/v1/chat/completions',
    model: 'm',
    fetchImpl: async () => new Response('<html>500</html>', { status: 500, headers: { 'content-type': 'text/html' } }),
  });
  const { server, base } = await startServer({ advisoryGateway: advisory });
  t.after(() => server.close());
  const res = await post(base, '/api/v1/advisory/complete', { prompt: 'inspect' });
  assert.equal(res.status, 502);
});

test('advisory 200-OK with no assistant text returns 502, not 422', async (t) => {
  const advisory = createAdvisoryGateway({
    endpoint: 'https://provider.example/v1/chat/completions',
    model: 'm',
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), { status: 200, headers: { 'content-type': 'application/json' } }),
  });
  const { server, base } = await startServer({ advisoryGateway: advisory });
  t.after(() => server.close());
  const res = await post(base, '/api/v1/advisory/complete', { prompt: 'inspect' });
  assert.equal(res.status, 502);
});

test('adb execution failure returns 502, not 400', async (t) => {
  const adb = createAdbBridge({
    enabled: true,
    allowedSerials: ['serial1'],
    executor: async () => { throw new Error('adb: device offline'); },
  });
  const { server, base } = await startServer({ adbBridge: adb });
  t.after(() => server.close());
  const res = await post(base, '/api/v1/device/tap', { serial: 'serial1', x: 0.5, y: 0.5, width: 1080, height: 1920 });
  assert.equal(res.status, 502);
});

test('adb invalid tap coordinates return 422, not 400', async (t) => {
  const adb = createAdbBridge({ enabled: true, allowedSerials: ['serial1'] });
  const { server, base } = await startServer({ adbBridge: adb });
  t.after(() => server.close());
  const res = await post(base, '/api/v1/device/tap', { serial: 'serial1', x: 2, y: 0.5, width: 1080, height: 1920 });
  assert.equal(res.status, 422);
});

test('adb invalid serial returns 422 and a non-allowlisted serial returns 403', async (t) => {
  const adb = createAdbBridge({ enabled: true, allowedSerials: ['serial1'] });
  const { server, base } = await startServer({ adbBridge: adb });
  t.after(() => server.close());
  const invalid = await post(base, '/api/v1/device/tap', { serial: 'bad serial!', x: 0.5, y: 0.5, width: 1080, height: 1920 });
  assert.equal(invalid.status, 422);
  const denied = await post(base, '/api/v1/device/tap', { serial: 'serial2', x: 0.5, y: 0.5, width: 1080, height: 1920 });
  assert.equal(denied.status, 403);
});

test('a misconfigured advisory URL degrades to disabled instead of crashing the daemon', async () => {
  const gateway = createAdvisoryGateway({ endpoint: 'not-a-valid-url', model: 'm' });
  assert.equal(gateway.enabled, false);
  await assert.rejects(() => gateway.complete({ prompt: 'x' }), (error) => error.code === 'ADVISORY_DISABLED');
});

test('empty telemetry body returns 422, not 400 (INVALID_REQUEST_BODY family)', async (t) => {
  const { server, base } = await startServer({ writeEnabled: true });
  t.after(() => server.close());
  const res = await fetch(`${base}/api/v1/telemetry/push`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer tok' },
    body: '   ',
  });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).success, false);
});

test('malformed JSON body for device tap returns 422, not 400 (INVALID_JSON family)', async (t) => {
  const adb = createAdbBridge({ enabled: true, allowedSerials: ['serial1'] });
  const { server, base } = await startServer({ adbBridge: adb });
  t.after(() => server.close());
  const res = await post(base, '/api/v1/device/tap', 'not json');
  assert.equal(res.status, 422);
});

test('malformed JSON body for advisory complete returns 422, not 400 (INVALID_JSON family)', async (t) => {
  const { server, base } = await startServer();
  t.after(() => server.close());
  const res = await fetch(`${base}/api/v1/advisory/complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer tok' },
    body: 'not json',
  });
  assert.equal(res.status, 422);
});
