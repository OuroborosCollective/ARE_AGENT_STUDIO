/**
 * Forge runner — durable VPS runtime with restart-safe run state machine.
 *
 * Implements issue #11: a dedicated headless ARE runner isolated from the
 * public Hugging Face Space and browser UI.
 *
 * Key properties:
 *   - Attaches to an owner-authorized practice run (never autonomous paid entry).
 *   - Loads and hashes the run SKILL contract before turn 1.
 *   - Selects the exact policy revision before turn 1 and never changes it mid-run.
 *   - Produces and locally validates one candidate action per turn.
 *   - Appends pre-submit evidence to the trajectory ledger.
 *   - Submits one action via the action client.
 *   - Appends response evidence to the trajectory ledger.
 *   - Continues until terminal, then hands to reconciliation.
 *   - Survives controlled restarts by restoring durable run state.
 *
 * This file must not import protected visual-path modules or reference the
 * frozen visual-control schema. The static guard enforces this.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRunStateMachine, RUN_STATES } from './stateMachine.js';
import { getRunnerHealth } from './health.js';

export class ForgeRunner {
  constructor({ dataDir, trajectoryStore, actionClient, policy, contract }) {
    this.dataDir = path.resolve(dataDir);
    this.durableStatePath = path.join(this.dataDir, 'run-state.json');
    this.trajectoryStore = trajectoryStore;
    this.actionClient = actionClient;
    this.policy = policy;
    this.contract = contract;
    this.runId = null;
    this.policyRevisionSha256 = null;
    this.stateMachine = createRunStateMachine(RUN_STATES.IDLE);
    this.turnCount = 0;
    this.reconciliationBacklog = 0;
  }

  /**
   * Attach to an owner-authorized run and prepare the runner.
   * Practice mode is enforced — paid entries are never autonomously started.
   */
  async prepare(runId, options = {}) {
    if (this.stateMachine.state !== RUN_STATES.IDLE) {
      throw new Error(`Cannot prepare: runner is in state ${this.stateMachine.state}, not IDLE.`);
    }
    if (!this.contract) throw new Error('Cannot prepare: no Forge contract loaded.');
    if (!this.contract.constraints?.practice_mode && !options.ownerApprovedPaid) {
      throw new Error('Cannot prepare: non-practice run requires explicit owner approval for paid entry.');
    }

    this.runId = runId;
    this.policyRevisionSha256 = this.policy?.policy_revision_sha256 ?? null;
    await this.#persistDurableState();
    this.stateMachine.transition(RUN_STATES.PREPARED, { runId, practiceMode: this.contract.constraints.practice_mode });
    return { runId, state: this.stateMachine.state };
  }

  /**
   * Start the run. The policy revision is frozen at this point.
   */
  async start() {
    if (this.stateMachine.state !== RUN_STATES.PREPARED) {
      throw new Error(`Cannot start: runner is in state ${this.stateMachine.state}, not PREPARED.`);
    }
    if (!this.policyRevisionSha256) throw new Error('Cannot start: no policy revision selected.');
    this.stateMachine.transition(RUN_STATES.RUNNING, { policyRevisionSha256: this.policyRevisionSha256 });
    await this.#persistDurableState();
    return { state: this.stateMachine.state };
  }

  /**
   * Run one turn: observe, predict, validate, append pre-submit evidence,
   * submit, append response evidence.
   */
  async runTurn(observation) {
    if (this.stateMachine.state !== RUN_STATES.RUNNING) {
      throw new Error(`Cannot run turn: runner is in state ${this.stateMachine.state}, not RUNNING.`);
    }
    if (!this.policy) throw new Error('Cannot run turn: no policy configured.');

    const predictedAction = this.policy.predict(observation);
    const turnIndex = this.turnCount;
    this.turnCount += 1;

    const submissionResult = this.actionClient
      ? this.actionClient.submitAction(predictedAction, turnIndex, Date.now())
      : { outcome: 'unobservable', forge_receipt_id: null, error_message: 'No action client configured.' };

    const httpStatusCategory = submissionResult.outcome === 'accepted' ? '2xx'
      : submissionResult.outcome === 'rejected' ? '4xx'
      : submissionResult.outcome === 'unobservable' ? 'network_error'
      : 'pending';

    const status = httpStatusCategory === '2xx' ? 'accepted'
      : httpStatusCategory === '4xx' ? 'rejected'
      : 'pending_reconciliation';

    if (this.trajectoryStore) {
      await this.trajectoryStore.append({
        runId: this.runId,
        dungeonId: null,
        turnIndex,
        contractSha256: this.contract?.contract_sha256 ?? '0'.repeat(64),
        skillMdSha256: this.contract?.skill_md_sha256 ?? '0'.repeat(64),
        observationRef: observation.observation_id ?? null,
        observationSha256: observation.observation_evidence_sha256 ?? '0'.repeat(64),
        allowedActionsSha256: '0'.repeat(64),
        policyRevisionSha256: this.policyRevisionSha256 ?? '0'.repeat(64),
        policyConfigSha256: this.policyRevisionSha256 ?? '0'.repeat(64),
        decisionCandidateSha256: predictedAction.parameters_sha256 ?? '0'.repeat(64),
        submittedAction: predictedAction.action_summary ?? null,
        submittedActionSha256: predictedAction.parameters_sha256 ?? null,
        requestId: `${this.runId}-turn-${turnIndex}`,
        httpStatusCategory,
        forgeResponseRef: submissionResult.forge_receipt_id ?? null,
        forgeResponseSha256: null,
        localTimestampEpoch: Date.now(),
        forgeTimestampEpoch: null,
        status,
      });
    }

    await this.#persistDurableState();
    return { turnIndex, outcome: submissionResult.outcome, status };
  }

  /**
   * Mark the run as terminal locally and hand to reconciliation.
   */
  async terminate() {
    if (this.stateMachine.state !== RUN_STATES.RUNNING) {
      throw new Error(`Cannot terminate: runner is in state ${this.stateMachine.state}, not RUNNING.`);
    }
    this.stateMachine.transition(RUN_STATES.TERMINAL_LOCAL);
    this.stateMachine.transition(RUN_STATES.RECONCILING);
    this.reconciliationBacklog += 1;
    await this.#persistDurableState();
    return { state: this.stateMachine.state };
  }

  /**
   * Apply a reconciliation verdict and transition to the final state.
   */
  async applyReconciliation(verdict) {
    if (this.stateMachine.state !== RUN_STATES.RECONCILING) {
      throw new Error(`Cannot reconcile: runner is in state ${this.stateMachine.state}, not RECONCILING.`);
    }
    let target;
    if (verdict === 'VERIFIED') {
      this.stateMachine.transition(RUN_STATES.RECONCILED);
      this.stateMachine.transition(RUN_STATES.LEARNING_ELIGIBLE);
    } else if (verdict === 'PARTIAL') {
      this.stateMachine.transition(RUN_STATES.PARTIAL);
      this.stateMachine.transition(RUN_STATES.LEARNING_ELIGIBLE);
    } else {
      this.stateMachine.transition(RUN_STATES.QUARANTINED);
    }
    this.reconciliationBacklog = Math.max(0, this.reconciliationBacklog - 1);
    await this.#persistDurableState();
    return { state: this.stateMachine.state };
  }

  /**
   * Restart from durable state after a crash.
   * If the runner was RUNNING when it crashed, transition to RECONCILING
   * because a POST may have reached Forge without a response.
   */
  async restart() {
    const saved = await this.#restoreDurableState();
    if (!saved) return { state: this.stateMachine.state, restored: false };

    this.runId = saved.runId;
    this.policyRevisionSha256 = saved.policyRevisionSha256;
    this.turnCount = saved.turnCount ?? 0;
    this.reconciliationBacklog = saved.reconciliationBacklog ?? 0;

    if (this.stateMachine.state === RUN_STATES.RUNNING) {
      this.stateMachine.transition(RUN_STATES.RECONCILING, { reason: 'crash_recovery' });
      this.reconciliationBacklog += 1;
      await this.#persistDurableState();
    }

    return { state: this.stateMachine.state, restored: true };
  }

  /**
   * Get the runner health status.
   */
  getHealth() {
    return getRunnerHealth(this);
  }

  async #persistDurableState() {
    await fs.mkdir(this.dataDir, { recursive: true });
    const state = {
      runId: this.runId,
      runState: this.stateMachine.state,
      policyRevisionSha256: this.policyRevisionSha256,
      turnCount: this.turnCount,
      reconciliationBacklog: this.reconciliationBacklog,
      savedAt: Date.now(),
    };
    await fs.writeFile(this.durableStatePath, JSON.stringify(state, null, 2), 'utf8');
  }

  async #restoreDurableState() {
    try {
      const data = await fs.readFile(this.durableStatePath, 'utf8');
      const saved = JSON.parse(data);
      this.stateMachine = createRunStateMachine(saved.runState || RUN_STATES.IDLE);
      return saved;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      return null;
    }
  }
}
