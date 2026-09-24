import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRunStateMachine, RUN_STATES, isValidTransition, isTerminalState } from '../stateMachine.js';
import { ForgeRunner } from '../runner.js';
import { getRunnerHealth, createHealthHandler } from '../health.js';

// --- State machine transitions ---

test('state machine starts in IDLE', () => {
  const sm = createRunStateMachine();
  assert.equal(sm.state, RUN_STATES.IDLE);
  assert.equal(sm.isTerminal(), false);
});

test('valid transition IDLE → PREPARED → RUNNING → TERMINAL_LOCAL → RECONCILING → RECONCILED → LEARNING_ELIGIBLE', () => {
  const sm = createRunStateMachine();
  sm.transition(RUN_STATES.PREPARED);
  sm.transition(RUN_STATES.RUNNING);
  sm.transition(RUN_STATES.TERMINAL_LOCAL);
  sm.transition(RUN_STATES.RECONCILING);
  sm.transition(RUN_STATES.RECONCILED);
  sm.transition(RUN_STATES.LEARNING_ELIGIBLE);
  assert.equal(sm.state, RUN_STATES.LEARNING_ELIGIBLE);
  assert.equal(sm.isTerminal(), true);
});

test('valid transition RECONCILING → QUARANTINED on mismatch', () => {
  const sm = createRunStateMachine();
  sm.transition(RUN_STATES.PREPARED);
  sm.transition(RUN_STATES.RUNNING);
  sm.transition(RUN_STATES.TERMINAL_LOCAL);
  sm.transition(RUN_STATES.RECONCILING);
  sm.transition(RUN_STATES.QUARANTINED);
  assert.equal(sm.state, RUN_STATES.QUARANTINED);
  assert.equal(sm.isTerminal(), true);
});

test('valid transition RECONCILING → PARTIAL → LEARNING_ELIGIBLE', () => {
  const sm = createRunStateMachine();
  sm.transition(RUN_STATES.PREPARED);
  sm.transition(RUN_STATES.RUNNING);
  sm.transition(RUN_STATES.TERMINAL_LOCAL);
  sm.transition(RUN_STATES.RECONCILING);
  sm.transition(RUN_STATES.PARTIAL);
  sm.transition(RUN_STATES.LEARNING_ELIGIBLE);
  assert.equal(sm.state, RUN_STATES.LEARNING_ELIGIBLE);
});

test('invalid transition throws', () => {
  const sm = createRunStateMachine();
  assert.throws(() => sm.transition(RUN_STATES.RUNNING), /Invalid run state transition/);
});

test('cannot transition from terminal state', () => {
  const sm = createRunStateMachine();
  sm.transition(RUN_STATES.PREPARED);
  sm.transition(RUN_STATES.RUNNING);
  sm.transition(RUN_STATES.TERMINAL_LOCAL);
  sm.transition(RUN_STATES.RECONCILING);
  sm.transition(RUN_STATES.QUARANTINED);
  assert.throws(() => sm.transition(RUN_STATES.RECONCILING), /Invalid run state transition/);
});

test('history records all transitions with evidence', () => {
  const sm = createRunStateMachine();
  sm.transition(RUN_STATES.PREPARED, { runId: 'test-run' });
  assert.equal(sm.history.length, 2);
  assert.equal(sm.history[1].transition.from, RUN_STATES.IDLE);
  assert.equal(sm.history[1].transition.to, RUN_STATES.PREPARED);
  assert.equal(sm.history[1].evidence.runId, 'test-run');
});

test('isValidTransition and isTerminalState are pure functions', () => {
  assert.equal(isValidTransition(RUN_STATES.IDLE, RUN_STATES.PREPARED), true);
  assert.equal(isValidTransition(RUN_STATES.IDLE, RUN_STATES.RUNNING), false);
  assert.equal(isTerminalState(RUN_STATES.LEARNING_ELIGIBLE), true);
  assert.equal(isTerminalState(RUN_STATES.RUNNING), false);
});

// --- Runner lifecycle ---

async function createTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'forge-runner-test-'));
}

test('runner prepare enforces practice mode — rejects non-practice without owner approval', async () => {
  const dataDir = await createTempDir();
  const runner = new ForgeRunner({
    dataDir,
    trajectoryStore: null,
    actionClient: null,
    policy: null,
    contract: { constraints: { practice_mode: false }, contract_sha256: 'a'.repeat(64), skill_md_sha256: 'b'.repeat(64) },
  });
  await assert.rejects(() => runner.prepare('run-1'), /paid entry/);
  await fs.rm(dataDir, { recursive: true, force: true });
});

test('runner prepare accepts practice mode', async () => {
  const dataDir = await createTempDir();
  const runner = new ForgeRunner({
    dataDir,
    trajectoryStore: null,
    actionClient: null,
    policy: { policy_revision_sha256: 'c'.repeat(64), predict: () => ({ action_type: 'select', target_ref: 'a', parameters: {}, action_summary: 'test', parameters_sha256: 'd'.repeat(64), risk_tier: 'reversible', rationale: 'test', confidence: 1 }) },
    contract: { constraints: { practice_mode: true }, contract_sha256: 'a'.repeat(64), skill_md_sha256: 'b'.repeat(64) },
  });
  const result = await runner.prepare('run-1');
  assert.equal(result.state, RUN_STATES.PREPARED);
  await fs.rm(dataDir, { recursive: true, force: true });
});

test('runner full lifecycle: prepare → start → terminate → reconcile(VERIFIED)', async () => {
  const dataDir = await createTempDir();
  const runner = new ForgeRunner({
    dataDir,
    trajectoryStore: null,
    actionClient: null,
    policy: { policy_revision_sha256: 'c'.repeat(64), predict: () => ({ action_type: 'select', target_ref: 'a', parameters: {}, action_summary: 'test', parameters_sha256: 'd'.repeat(64), risk_tier: 'reversible', rationale: 'test', confidence: 1 }) },
    contract: { constraints: { practice_mode: true }, contract_sha256: 'a'.repeat(64), skill_md_sha256: 'b'.repeat(64) },
  });
  await runner.prepare('run-1');
  await runner.start();
  assert.equal(runner.stateMachine.state, RUN_STATES.RUNNING);
  await runner.terminate();
  assert.equal(runner.stateMachine.state, RUN_STATES.RECONCILING);
  const recResult = await runner.applyReconciliation('VERIFIED');
  assert.equal(recResult.state, RUN_STATES.LEARNING_ELIGIBLE);
  assert.equal(runner.stateMachine.isTerminal(), true);
  await fs.rm(dataDir, { recursive: true, force: true });
});

test('runner reconcile(MISMATCH) → QUARANTINED', async () => {
  const dataDir = await createTempDir();
  const runner = new ForgeRunner({
    dataDir,
    trajectoryStore: null,
    actionClient: null,
    policy: { policy_revision_sha256: 'c'.repeat(64), predict: () => ({ action_type: 'select', target_ref: 'a', parameters: {}, action_summary: 'test', parameters_sha256: 'd'.repeat(64), risk_tier: 'reversible', rationale: 'test', confidence: 1 }) },
    contract: { constraints: { practice_mode: true }, contract_sha256: 'a'.repeat(64), skill_md_sha256: 'b'.repeat(64) },
  });
  await runner.prepare('run-1');
  await runner.start();
  await runner.terminate();
  const recResult = await runner.applyReconciliation('MISMATCH');
  assert.equal(recResult.state, RUN_STATES.QUARANTINED);
  await fs.rm(dataDir, { recursive: true, force: true });
});

// --- Crash/restart safety ---

test('runner restart from RUNNING → RECONCILING (POST may have reached Forge)', async () => {
  const dataDir = await createTempDir();
  const runner = new ForgeRunner({
    dataDir,
    trajectoryStore: null,
    actionClient: null,
    policy: { policy_revision_sha256: 'c'.repeat(64), predict: () => ({ action_type: 'select', target_ref: 'a', parameters: {}, action_summary: 'test', parameters_sha256: 'd'.repeat(64), risk_tier: 'reversible', rationale: 'test', confidence: 1 }) },
    contract: { constraints: { practice_mode: true }, contract_sha256: 'a'.repeat(64), skill_md_sha256: 'b'.repeat(64) },
  });
  await runner.prepare('run-1');
  await runner.start();

  // Simulate crash: create a new runner with the same dataDir
  const restarted = new ForgeRunner({
    dataDir,
    trajectoryStore: null,
    actionClient: null,
    policy: null,
    contract: { constraints: { practice_mode: true }, contract_sha256: 'a'.repeat(64), skill_md_sha256: 'b'.repeat(64) },
  });
  const result = await restarted.restart();
  assert.equal(result.restored, true);
  assert.equal(restarted.stateMachine.state, RUN_STATES.RECONCILING);
  assert.equal(restarted.runId, 'run-1');
  await fs.rm(dataDir, { recursive: true, force: true });
});

test('runner restart with no durable state returns restored=false', async () => {
  const dataDir = await createTempDir();
  const runner = new ForgeRunner({
    dataDir,
    trajectoryStore: null,
    actionClient: null,
    policy: null,
    contract: null,
  });
  const result = await runner.restart();
  assert.equal(result.restored, false);
  assert.equal(runner.stateMachine.state, RUN_STATES.IDLE);
  await fs.rm(dataDir, { recursive: true, force: true });
});

// --- Health endpoint ---

test('getRunnerHealth returns all required fields', () => {
  const runner = new ForgeRunner({
    dataDir: '/tmp',
    trajectoryStore: { initialized: true },
    actionClient: { vault: { hasCredentials: () => true } },
    policy: null,
    contract: { constraints: { practice_mode: true } },
  });
  runner.stateMachine = createRunStateMachine(RUN_STATES.RUNNING);
  runner.reconciliationBacklog = 2;
  const health = getRunnerHealth(runner);
  assert.equal(health.process_alive, true);
  assert.equal(health.contract_reachable, true);
  assert.equal(health.credential_configured, true);
  assert.equal(health.active_run_state, RUN_STATES.RUNNING);
  assert.equal(health.ledger_trusted, true);
  assert.equal(health.reconciliation_backlog, 2);
});

test('getRunnerHealth with no contract or credentials', () => {
  const runner = new ForgeRunner({
    dataDir: '/tmp',
    trajectoryStore: null,
    actionClient: null,
    policy: null,
    contract: null,
  });
  const health = getRunnerHealth(runner);
  assert.equal(health.contract_reachable, false);
  assert.equal(health.credential_configured, false);
  assert.equal(health.ledger_trusted, false);
  assert.equal(health.active_run_state, RUN_STATES.IDLE);
});
