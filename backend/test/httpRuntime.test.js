import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHttpServer } from '../src/httpServer.js';
import { DATASET_SCHEMA_VERSION } from '../src/validation.js';
import { OPERATION_CORRECTION_SCHEMA_VERSION } from '../src/operationCorrectionValidation.js';
import { VERIFIED_IMITATION_SCHEMA_VERSION } from '../src/verifiedImitationValidation.js';

const validImage = `data:image/png;base64,${Buffer.from('runtime-http-evidence-frame-000000000000').toString('base64')}`;
const sample = {
  schema_version: DATASET_SCHEMA_VERSION,
  sample_id: 'placeholder',
  source: 'human_demo',
  instruction: 'Observe and reproduce the demonstrated touch.',
  input_frame_base64: validImage,
  genre: 'FPS',
  state_vector: [0.9, 0.8, 0.2, 0, 1, 0],
  target_action_chunk: [[0.25, 0.75, 0.8, 1]],
  tactical_reasoning: '',
  publication: { allowed: false, basis: 'unreviewed' },
  feature_vector: new Array(16).fill(0.5),
  client_metadata: { client_id: 'http-test', device_model: 'test', timestamp_epoch: 42, session_id: 'http-session', sequence_index: 1 },
};

const operationCorrectionSample = {
  schema_version: OPERATION_CORRECTION_SCHEMA_VERSION,
  correction_id: 'client-placeholder',
  context: { session_id: 'http-operation-session', sequence_index: 1, mission_id: 'http-mission', attempt_id: 'http-attempt' },
  proposal: {
    proposal_id: 'http-proposal', operation_type: 'agent.route.select', action_summary: 'Select the reviewed route candidate.', target_ref: 'route/http',
    parameters_sha256: 'a'.repeat(64), policy_revision_sha256: 'b'.repeat(64), observation_evidence_sha256: 'c'.repeat(64),
    requested_at_epoch: 42, risk_tier: 'external', execution_state: 'not_executed',
  },
  correction: { decision: 'reject', reason_code: 'MISSING_EVIDENCE', owner_ref: 'http-owner', captured_at_epoch: 43 },
  learning: { allowed: true, basis: 'owner_confirmed' },
};

function verifiedImitationFixture(index = 0) {
  return {
    schema_version: VERIFIED_IMITATION_SCHEMA_VERSION,
    verification_id: 'client-placeholder',
    context: { session_id: 'http-verification-session', sequence_index: index, episode_id: 'http-episode' },
    action: {
      action_id: `http-verified-action-${index}`,
      action_type: 'mobile.tap',
      policy_revision_sha256: 'a'.repeat(64), observation_before_sha256: 'b'.repeat(64), action_command_sha256: 'c'.repeat(64),
    },
    evaluation: {
      method: 'device_readback', result: 'reproduced', evaluator_ref: 'http-evaluator', verified_at_epoch: 100 + index,
      action_receipt_sha256: 'd'.repeat(64), observation_after_sha256: 'e'.repeat(64),
      device_readback_sha256: 'f'.repeat(64), independent_evidence_sha256: '1'.repeat(64),
    },
  };
}

test('HTTP runtime accepts valid JSONL, returns receipt, and rejects invalid rows', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-http-'));
  const { server } = await createHttpServer({ dataDir: dir, authToken: 'test-token' });
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const health = await fetch(`${base}/api/v1/health`);
  assert.equal(health.status, 200);
  const healthPayload = await health.json();
  assert.equal(healthPayload.unique_samples, 0);
  assert.equal(healthPayload.advisory_enabled, false);
  assert.equal(healthPayload.advisory_provider, null);
  assert.equal(healthPayload.advisory_model, null);
  assert.equal(healthPayload.advisory_route_kind, 'server_openai_compatible');

  const unauthorized = await fetch(`${base}/api/v1/dataset/stats`);
  assert.equal(unauthorized.status, 401);

  const accepted = await fetch(`${base}/api/v1/telemetry/push`, {
    method: 'POST',
    headers: { 'content-type': 'application/jsonl', authorization: 'Bearer test-token', 'x-client-uuid': 'http-test' },
    body: `${JSON.stringify(sample)}\n`,
  });
  assert.equal(accepted.status, 201);
  const receipt = await accepted.json();
  assert.equal(receipt.success, true);
  assert.equal(receipt.receipt.accepted_rows, 1);
  assert.match(receipt.receipt.ledger_sha256, /^[a-f0-9]{64}$/);

  const duplicate = await fetch(`${base}/api/v1/telemetry/push`, {
    method: 'POST',
    headers: { 'content-type': 'application/jsonl', authorization: 'Bearer test-token' },
    body: `${JSON.stringify(sample)}\n`,
  });
  assert.equal((await duplicate.json()).receipt.duplicate_rows, 1);

  const invalid = await fetch(`${base}/api/v1/telemetry/push`, {
    method: 'POST',
    headers: { 'content-type': 'application/jsonl', authorization: 'Bearer test-token' },
    body: `${JSON.stringify({ ...sample, input_frame_base64: 'data:image/jpeg;base64,mock', client_metadata: { ...sample.client_metadata, timestamp_epoch: 43 } })}\n`,
  });
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).success, false);

  const stats = await fetch(`${base}/api/v1/dataset/stats`, { headers: { authorization: 'Bearer test-token' } });
  assert.equal((await stats.json()).unique_samples, 1);
});

test('HTTP runtime can serve a built SPA without confusing it with API evidence', async () => {
  const staticDir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-static-'));
  await fs.writeFile(path.join(staticDir, 'index.html'), '<!doctype html><title>ARE Agent Studio</title>');
  const { server } = await createHttpServer({ dataDir: await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-data-')), staticDir });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/some/client/route`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /ARE Agent Studio/);
    const missingApi = await fetch(`http://127.0.0.1:${address.port}/api/v1/not-real`);
    assert.equal(missingApi.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('HTTP runtime records operation corrections as non-executing evidence and exposes only candidate projections', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-operation-http-'));
  const { server } = await createHttpServer({ dataDir: dir, authToken: 'test-token', operationCorrectionWriteEnabled: true });
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const health = await (await fetch(`${base}/api/v1/health`)).json();
  assert.equal(health.operation_correction_write_enabled, true);
  const accepted = await fetch(`${base}/api/v1/operation-corrections/push`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token', 'x-client-uuid': 'http-operation-test' },
    body: JSON.stringify(operationCorrectionSample),
  });
  assert.equal(accepted.status, 201);
  const receipt = await accepted.json();
  assert.equal(receipt.success, true);
  assert.equal(receipt.receipt.receipt_version, 'are-agent-operation-correction-receipt.v1');
  assert.equal(receipt.receipt.accepted_rows, 1);
  assert.match(receipt.receipt.accepted_correction_ids[0], /^[a-f0-9]{64}$/);

  const projection = await (await fetch(`${base}/api/v1/operation-corrections/candidates`, { headers: { authorization: 'Bearer test-token' } })).json();
  assert.equal(projection.candidate_count, 1);
  assert.equal(projection.candidates[0].execution_authority, 'none');
  assert.equal(projection.candidates[0].status, 'candidate_only');
});


test('public-style runtime can serve the Studio while dataset writes stay disabled', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-http-ro-'));
  const { server } = await createHttpServer({ dataDir: dir, writeEnabled: false });
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const health = await (await fetch(`${base}/api/v1/health`)).json();
  assert.equal(health.dataset_write_enabled, false);
  assert.equal(health.operation_correction_write_enabled, false);
  const response = await fetch(`${base}/api/v1/telemetry/push`, {
    method: 'POST', headers: { 'content-type': 'application/jsonl' }, body: `${JSON.stringify(sample)}\n`,
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /writes are disabled/);
  const operationResponse = await fetch(`${base}/api/v1/operation-corrections/push`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(operationCorrectionSample),
  });
  assert.equal(operationResponse.status, 503);
  assert.match((await operationResponse.json()).error, /operation correction writes are disabled/);
});

test('public metrics never expose sample payloads, count only verified device-readback records, and protect exports', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-public-metrics-'));
  const { server } = await createHttpServer({
    dataDir: dir,
    authToken: 'test-token',
    verifiedImitationWriteEnabled: true,
    datasetExportEnabled: false,
    publicInfo: {
      sourceRepositoryUrl: 'https://github.com/OuroborosCollective/ARE_AGENT_STUDIO',
      apkClientRepositoryUrl: 'https://github.com/OuroborosCollective/ARE_AGENT_STUDIO',
    },
  });
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const initial = await (await fetch(`${base}/api/v1/public/metrics`)).json();
  assert.equal(initial.dataset.accepted_unique_samples, 0);
  assert.equal(initial.verified_imitation.verified_device_readback_actions, 0);
  assert.equal(initial.pricing.current_price_cents, 425);
  assert.equal(initial.pricing.verified_actions_until_next_step, 15);
  assert.equal(initial.access.dataset_download, 'disabled');
  assert.equal(initial.links.hugging_face_project_url, null);
  assert.equal(initial.links.purchase_enabled, false);
  assert.doesNotMatch(JSON.stringify(initial), /input_frame_base64|target_action_chunk/);
  assert.match(initial.snapshot_sha256, /^[a-f0-9]{64}$/);

  const rejectedAnonymousClaim = await fetch(`${base}/api/v1/verified-imitations/push`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(verifiedImitationFixture()),
  });
  assert.equal(rejectedAnonymousClaim.status, 401);

  const accepted = await fetch(`${base}/api/v1/verified-imitations/push`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token', 'x-client-uuid': 'http-test' },
    body: JSON.stringify(Array.from({ length: 15 }, (_, index) => verifiedImitationFixture(index))),
  });
  assert.equal(accepted.status, 201);
  assert.equal((await accepted.json()).receipt.accepted_rows, 15);

  const threshold = await (await fetch(`${base}/api/v1/public/metrics`)).json();
  assert.equal(threshold.verified_imitation.verified_device_readback_actions, 15);
  assert.equal(threshold.pricing.current_price_cents, 525);
  assert.equal(threshold.pricing.verified_actions_until_next_step, 15);

  const exportAttempt = await fetch(`${base}/api/v1/dataset/export.jsonl`, { headers: { authorization: 'Bearer test-token' } });
  assert.equal(exportAttempt.status, 403);
  assert.match((await exportAttempt.json()).error, /export is disabled/);
});
