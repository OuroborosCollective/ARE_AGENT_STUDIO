import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { VerifiedImitationStore } from '../src/verifiedImitationStore.js';
import { pricingForVerifiedActions } from '../src/publicMetrics.js';
import { VERIFIED_IMITATION_SCHEMA_VERSION } from '../src/verifiedImitationValidation.js';

function fixture(index = 0) {
  return {
    schema_version: VERIFIED_IMITATION_SCHEMA_VERSION,
    verification_id: 'client-placeholder',
    context: { session_id: 'fixture-session', sequence_index: index, episode_id: 'fixture-episode' },
    action: {
      action_id: `fixture-action-${index}`,
      action_type: 'mobile.tap',
      policy_revision_sha256: 'a'.repeat(64),
      observation_before_sha256: 'b'.repeat(64),
      action_command_sha256: 'c'.repeat(64),
    },
    evaluation: {
      method: 'device_readback',
      result: 'reproduced',
      evaluator_ref: 'fixture-evaluator',
      verified_at_epoch: 100 + index,
      action_receipt_sha256: 'd'.repeat(64),
      observation_after_sha256: 'e'.repeat(64),
      device_readback_sha256: 'f'.repeat(64),
      independent_evidence_sha256: '1'.repeat(64),
    },
  };
}

test('verified imitation ledger is append-only, idempotent, and reload-verified', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-verified-imitation-'));
  const store = new VerifiedImitationStore({ dataDir: dir });
  await store.init();
  const first = await store.append([fixture()], { clientId: 'test-client' });
  assert.equal(first.accepted_rows, 1);
  assert.match(first.accepted_verification_ids[0], /^[a-f0-9]{64}$/);
  const duplicate = await store.append([fixture()]);
  assert.equal(duplicate.accepted_rows, 0);
  assert.equal(duplicate.duplicate_rows, 1);
  assert.equal((await store.stats()).verified_device_readback_actions, 1);

  const reloaded = new VerifiedImitationStore({ dataDir: dir });
  await reloaded.init();
  assert.equal((await reloaded.stats()).verified_device_readback_actions, 1);
});

test('verified imitation ledger refuses non-device evidence and malformed claims', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-verified-imitation-invalid-'));
  const store = new VerifiedImitationStore({ dataDir: dir });
  await store.init();
  await assert.rejects(
    () => store.append([{ ...fixture(), evaluation: { ...fixture().evaluation, method: 'self_report' } }]),
    (error) => error?.code === 'INVALID_VERIFIED_IMITATION' && /device_readback/.test(error.message),
  );
  await assert.rejects(
    () => store.append([{ ...fixture(), evaluation: { ...fixture().evaluation, independent_evidence_sha256: 'not-a-digest' } }]),
    (error) => error?.code === 'INVALID_VERIFIED_IMITATION' && /independent_evidence_sha256/.test(error.message),
  );
});

test('verified imitation startup rejects a tampered identity', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-verified-imitation-tamper-'));
  const store = new VerifiedImitationStore({ dataDir: dir });
  await store.init();
  await store.append([fixture()]);
  const ledgerPath = path.join(dir, 'verified-imitations.jsonl');
  const row = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
  row.verification_id = '0'.repeat(64);
  await fs.writeFile(ledgerPath, `${JSON.stringify(row)}\n`, 'utf8');
  await assert.rejects(() => new VerifiedImitationStore({ dataDir: dir }).init(), /does not match content/);
});

test('pricing advances only after each complete fifteen evidence-backed action records', () => {
  assert.deepEqual(pricingForVerifiedActions(0), {
    currency: 'EUR', base_price_cents: 425, increment_cents: 100, verified_actions_per_increment: 15,
    verified_device_readback_actions: 0, completed_price_steps: 0, current_price_cents: 425,
    next_price_step_at_verified_actions: 15, verified_actions_until_next_step: 15,
  });
  assert.equal(pricingForVerifiedActions(14).current_price_cents, 425);
  assert.equal(pricingForVerifiedActions(15).current_price_cents, 525);
  assert.equal(pricingForVerifiedActions(29).current_price_cents, 525);
  assert.equal(pricingForVerifiedActions(30).current_price_cents, 625);
});
