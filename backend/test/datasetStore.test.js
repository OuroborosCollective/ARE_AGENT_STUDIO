import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatasetStore } from '../src/datasetStore.js';
import { createAdbBridge } from '../src/adbBridge.js';
import { DATASET_SCHEMA_VERSION, deriveSampleId, validateDataImageUrl } from '../src/validation.js';

const validImage = `data:image/png;base64,${Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')}`;
function row(overrides = {}) {
  return {
    schema_version: DATASET_SCHEMA_VERSION,
    sample_id: 'client-placeholder',
    source: 'human_demo',
    instruction: 'Observe and reproduce the demonstrated touch.',
    input_frame_base64: validImage,
    genre: 'FPS',
    state_vector: [0.9, 0.8, 0.2, 0, 1, 0],
    target_action_chunk: [[0.25, 0.75, 0.8, 1]],
    tactical_reasoning: '',
    publication: { allowed: false, basis: 'unreviewed' },
    feature_vector: new Array(16).fill(0.5),
    client_metadata: { client_id: 'test-client', device_model: 'test', timestamp_epoch: 123456, session_id: 'test-session', sequence_index: 1 },
    ...overrides,
  };
}

test('complete image data URLs are accepted and placeholders are rejected', () => {
  assert.equal(validateDataImageUrl(validImage), true);
  assert.equal(validateDataImageUrl('data:image/jpeg;base64,mock'), false);
  assert.equal(validateDataImageUrl('data:image/jpeg;base64,Zm9v...[BASE64_IMAGE_TENSOR]'), false);
});

test('dataset store is content-addressed and idempotent', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-dataset-'));
  const store = new DatasetStore({ dataDir: dir });
  const first = await store.append([row()]);
  const second = await store.append([row()]);
  assert.equal(first.accepted_rows, 1);
  assert.equal(second.accepted_rows, 0);
  assert.equal(second.duplicate_rows, 1);
  assert.equal((await store.stats()).unique_samples, 1);
  assert.match(first.receipt_sha256, /^[a-f0-9]{64}$/);
  assert.equal(first.accepted_sample_ids[0], deriveSampleId(row()));
});

test('dataset store rejects incomplete evidence instead of writing it', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-dataset-'));
  const store = new DatasetStore({ dataDir: dir });
  await assert.rejects(() => store.append([row({ input_frame_base64: 'data:image/jpeg;base64,mock' })]), /invalid dataset row/);
  assert.equal((await store.stats()).unique_samples, 0);
});

test('ADB bridge is opt-in and uses fixed execFile arguments only', async () => {
  await assert.rejects(() => createAdbBridge().injectTap({ serial: 'device-1', x: 0.5, y: 0.5, width: 100, height: 200 }), /disabled/);
  const calls = [];
  const adb = createAdbBridge({ enabled: true, allowedSerials: ['device-1'], executor: async (...args) => calls.push(args) });
  const result = await adb.injectTap({ serial: 'device-1', x: 0.5, y: 0.25, width: 100, height: 200 });
  assert.equal(result.px_x, 50);
  assert.equal(result.px_y, 50);
  assert.deepEqual(calls[0][0], 'adb');
  assert.deepEqual(calls[0][1], ['-s', 'device-1', 'shell', 'input', 'tap', '50', '50']);
  await assert.rejects(() => adb.injectTap({ serial: 'device-1;rm -rf /', x: 0.5, y: 0.5, width: 100, height: 200 }), /allowlisted/);
});


test('concurrent duplicate appends serialize to one accepted ledger row', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-dataset-'));
  const store = new DatasetStore({ dataDir: dir });
  const receipts = await Promise.all(Array.from({ length: 12 }, () => store.append([row()])));
  assert.equal(receipts.reduce((sum, receipt) => sum + receipt.accepted_rows, 0), 1);
  assert.equal(receipts.reduce((sum, receipt) => sum + receipt.duplicate_rows, 0), 11);
  assert.equal((await store.stats()).unique_samples, 1);
  const ledgerLines = (await store.readLedger()).trim().split('\n');
  assert.equal(ledgerLines.length, 1);
});

test('store refuses a tampered existing ledger on startup', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-dataset-'));
  await fs.mkdir(dir, { recursive: true });
  const tampered = row({ sample_id: '0'.repeat(64) });
  await fs.writeFile(path.join(dir, 'telemetry.jsonl'), `${JSON.stringify(tampered)}\n`);
  const store = new DatasetStore({ dataDir: dir });
  await assert.rejects(() => store.init(), /sample_id does not match/);
});

test('public publication requires an explicit user-confirmed basis', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-dataset-'));
  const store = new DatasetStore({ dataDir: dir });
  await assert.rejects(
    () => store.append([row({ publication: { allowed: true, basis: 'unreviewed' } })]),
    /publication\.allowed=true requires basis=user_confirmed/,
  );
});
