import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { OperationCorrectionStore } from '../src/operationCorrectionStore.js';
import { OPERATION_CORRECTION_SCHEMA_VERSION } from '../src/operationCorrectionValidation.js';

const hashes = {
  parameters: 'a'.repeat(64),
  policy: 'b'.repeat(64),
  evidence: 'c'.repeat(64),
  correctedParameters: 'd'.repeat(64),
};

function correctionRow(overrides = {}) {
  const base = {
    schema_version: OPERATION_CORRECTION_SCHEMA_VERSION,
    correction_id: 'client-placeholder',
    context: { session_id: 'session-test', sequence_index: 1, mission_id: 'mission-test', attempt_id: 'attempt-test' },
    proposal: {
      proposal_id: 'proposal-test',
      operation_type: 'agent.route.select',
      action_summary: 'Select the reviewed route candidate.',
      target_ref: 'route/test',
      parameters_sha256: hashes.parameters,
      policy_revision_sha256: hashes.policy,
      observation_evidence_sha256: hashes.evidence,
      requested_at_epoch: 100,
      risk_tier: 'external',
      execution_state: 'not_executed',
    },
    correction: {
      decision: 'reject',
      reason_code: 'MISSING_EVIDENCE',
      owner_ref: 'owner-test',
      rationale: 'The evidence binding is incomplete.',
      captured_at_epoch: 101,
    },
    learning: { allowed: false, basis: 'unreviewed' },
  };
  return {
    ...base,
    ...overrides,
    context: { ...base.context, ...(overrides.context || {}) },
    proposal: { ...base.proposal, ...(overrides.proposal || {}) },
    correction: { ...base.correction, ...(overrides.correction || {}) },
    learning: { ...base.learning, ...(overrides.learning || {}) },
  };
}

test('operation correction ledger is append-only, idempotent, and excluded from learning by default', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-operation-correction-'));
  const store = new OperationCorrectionStore({ dataDir: dir });
  const first = await store.append([correctionRow()]);
  const duplicate = await store.append([correctionRow()]);
  assert.equal(first.accepted_rows, 1);
  assert.equal(duplicate.accepted_rows, 0);
  assert.equal(duplicate.duplicate_rows, 1);
  assert.match(first.receipt_sha256, /^[a-f0-9]{64}$/);
  assert.equal((await store.stats()).unique_corrections, 1);
  assert.equal((await store.learningProjection()).candidate_count, 0, 'learning must remain off without explicit owner confirmation');
});

test('operation correction candidates are deterministic side-channel projections with no execution authority', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-operation-correction-'));
  const store = new OperationCorrectionStore({ dataDir: dir });
  await store.append([
    correctionRow({ learning: { allowed: true, basis: 'owner_confirmed' } }),
    correctionRow({
      context: { sequence_index: 2 },
      proposal: { proposal_id: 'proposal-test-2', requested_at_epoch: 102 },
      correction: { captured_at_epoch: 103 },
      learning: { allowed: true, basis: 'owner_confirmed' },
    }),
  ]);
  const first = await store.learningProjection();
  const second = await store.learningProjection();
  assert.deepEqual(second, first, 'projection replay must be byte-stable for the same ledger');
  assert.equal(first.candidate_count, 1);
  assert.equal(first.candidates[0].correction_count, 2);
  assert.equal(first.candidates[0].execution_authority, 'none');
  assert.equal(first.candidates[0].status, 'candidate_only');
});

test('operation correction ledger rejects effect claims and unconsented learning', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-operation-correction-'));
  const store = new OperationCorrectionStore({ dataDir: dir });
  await assert.rejects(
    () => store.append([correctionRow({ proposal: { execution_state: 'requested' } })]),
    /execution_state must be not_executed/,
  );
  await assert.rejects(
    () => store.append([correctionRow({ learning: { allowed: true, basis: 'unreviewed' } })]),
    /learning\.allowed=true requires basis=owner_confirmed/,
  );
  await assert.rejects(
    () => store.append([correctionRow({ correction: { decision: 'amend', corrected_action_summary: 'Use the reviewed route.', corrected_parameters_sha256: 'not-a-hash' } })]),
    /corrected_parameters_sha256/,
  );
});

test('operation correction ledger refuses a tampered persisted identity on startup', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'are-agent-operation-correction-'));
  const store = new OperationCorrectionStore({ dataDir: dir });
  await store.append([correctionRow()]);
  const ledgerPath = path.join(dir, 'operation-corrections.jsonl');
  const persisted = JSON.parse((await fs.readFile(ledgerPath, 'utf8')).trim());
  persisted.correction_id = '0'.repeat(64);
  await fs.writeFile(ledgerPath, `${JSON.stringify(persisted)}\n`);
  await assert.rejects(() => new OperationCorrectionStore({ dataDir: dir }).init(), /correction_id does not match/);
});
