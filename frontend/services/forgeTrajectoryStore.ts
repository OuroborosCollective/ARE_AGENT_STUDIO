/**
 * ForgeAI append-only trajectory ledger — version 1.
 *
 * This module implements issue #10: an ARE-owned, append-only evidence ledger
 * for every structured Forge turn. It is the local causal record; it is not
 * Forge authority by itself.
 *
 * Schema: are-agent-forge-trajectory.v1
 *
 * Store properties (following datasetStore.js / verifiedImitationStore.js):
 *   - Canonical serialization (deterministic, sorted keys)
 *   - Serialized concurrent append (write queue)
 *   - Stable identity (record_sha256)
 *   - Idempotent duplicate handling (request_id)
 *   - Startup revalidation (hash chain verification)
 *   - Corruption/tamper refusal (chain break → reject)
 *   - Append-only JSONL ledger
 *   - Receipt generated per accepted append, independently verifiable
 *   - PENDING_RECONCILIATION state for ambiguous network failure
 *
 * This module must never import or mutate visual-path modules
 * (neuralPolicyEngine, datasetCodec, serverSyncGateway, receiptVerifier).
 * The static guard scripts/forge_truth_guard.mjs enforces this.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isoTimestamp } from './deterministicClock';

// ---------------------------------------------------------------------------
// Schema versions
// ---------------------------------------------------------------------------

export const FORGE_TRAJECTORY_LEDGER_SCHEMA_VERSION = 'are-agent-forge-trajectory.v1' as const;
export const FORGE_TRAJECTORY_RECEIPT_VERSION = 'are-agent-forge-trajectory-receipt.v1' as const;

// ---------------------------------------------------------------------------
// Self-contained canonical JSON & SHA-256 (not imported from protected modules)
// ---------------------------------------------------------------------------

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SHA256_RE = /^[a-f0-9]{64}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const HTTP_STATUS_RE = /^(2xx|3xx|4xx|5xx|network_error|pending)$/;
const VALID_STATUSES: readonly string[] = ['accepted', 'pending_reconciliation', 'rejected'];

function containsCredential(value: string | null): boolean {
  if (!value) return false;
  return /\b(?:api[_-]?key|access[_-]?token|password|secret|private[_-]?key|bearer)\b\s*[:=]/i.test(value);
}

// ---------------------------------------------------------------------------
// Record types
// ---------------------------------------------------------------------------

export type ForgeTrajectoryRecordStatus = 'accepted' | 'pending_reconciliation' | 'rejected';

export interface ForgeTrajectoryRecord {
  schema_version: 'are-agent-forge-trajectory.v1';
  record_id: string;
  run_id: string;
  dungeon_id: string | null;
  turn_index: number;
  contract_sha256: string;
  skill_md_sha256: string;
  observation_ref: string | null;
  observation_sha256: string;
  allowed_actions_sha256: string;
  policy_revision_sha256: string;
  policy_config_sha256: string;
  decision_candidate_sha256: string;
  submitted_action: string | null;
  submitted_action_sha256: string | null;
  request_id: string;
  http_status_category: string;
  forge_response_ref: string | null;
  forge_response_sha256: string | null;
  local_timestamp_epoch: number;
  forge_timestamp_epoch: number | null;
  previous_record_sha256: string;
  record_sha256: string;
  status: ForgeTrajectoryRecordStatus;
}

export interface ForgeTrajectoryRecordInput {
  runId: string;
  dungeonId: string | null;
  turnIndex: number;
  contractSha256: string;
  skillMdSha256: string;
  observationRef: string | null;
  observationSha256: string;
  allowedActionsSha256: string;
  policyRevisionSha256: string;
  policyConfigSha256: string;
  decisionCandidateSha256: string;
  submittedAction: string | null;
  submittedActionSha256: string | null;
  requestId: string;
  httpStatusCategory: string;
  forgeResponseRef: string | null;
  forgeResponseSha256: string | null;
  localTimestampEpoch: number;
  forgeTimestampEpoch: number | null;
  status: ForgeTrajectoryRecordStatus;
}

export interface ForgeTrajectoryReceipt {
  receipt_version: 'are-agent-forge-trajectory-receipt.v1';
  accepted_at: string;
  request_id: string;
  record_id: string | null;
  duplicate: boolean;
  ledger_sha256: string;
  receipt_sha256: string;
}

// ---------------------------------------------------------------------------
// Validation function
// ---------------------------------------------------------------------------

export function validateForgeTrajectoryRecord(input: ForgeTrajectoryRecordInput): string[] {
  const errors: string[] = [];

  if (!REF_RE.test(input.runId)) errors.push('Run ID is required and may only use safe reference characters.');
  if (input.dungeonId !== null && !REF_RE.test(input.dungeonId)) errors.push('Dungeon ID must be null or a safe reference.');
  if (!Number.isInteger(input.turnIndex) || input.turnIndex < 0) errors.push('Turn index must be a non-negative integer.');
  if (!SHA256_RE.test(input.contractSha256)) errors.push('Contract hash must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.skillMdSha256)) errors.push('SKILL.md hash must be a lowercase SHA-256 digest.');
  if (input.observationRef !== null && !REF_RE.test(input.observationRef)) errors.push('Observation reference must be null or a safe reference.');
  if (!SHA256_RE.test(input.observationSha256)) errors.push('Observation hash must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.allowedActionsSha256)) errors.push('Allowed actions hash must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.policyRevisionSha256)) errors.push('Policy revision hash must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.policyConfigSha256)) errors.push('Policy config hash must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.decisionCandidateSha256)) errors.push('Decision candidate hash must be a lowercase SHA-256 digest.');
  if (input.submittedAction !== null && containsCredential(input.submittedAction)) errors.push('Submitted action must not contain credential assignments.');
  if (input.submittedActionSha256 !== null && !SHA256_RE.test(input.submittedActionSha256)) errors.push('Submitted action hash must be null or a lowercase SHA-256 digest.');
  if (!REF_RE.test(input.requestId)) errors.push('Request ID is required and may only use safe reference characters.');
  if (!HTTP_STATUS_RE.test(input.httpStatusCategory)) errors.push('HTTP status category must be one of: 2xx, 3xx, 4xx, 5xx, network_error, pending.');
  if (input.forgeResponseRef !== null && containsCredential(input.forgeResponseRef)) errors.push('Forge response reference must not contain credential assignments.');
  if (input.forgeResponseSha256 !== null && !SHA256_RE.test(input.forgeResponseSha256)) errors.push('Forge response hash must be null or a lowercase SHA-256 digest.');
  if (!Number.isInteger(input.localTimestampEpoch) || input.localTimestampEpoch < 0) errors.push('Local timestamp must be a non-negative integer.');
  if (input.forgeTimestampEpoch !== null && (!Number.isInteger(input.forgeTimestampEpoch) || input.forgeTimestampEpoch < 0)) errors.push('Forge timestamp must be null or a non-negative integer.');
  if (!VALID_STATUSES.includes(input.status)) errors.push('Status must be one of: accepted, pending_reconciliation, rejected.');

  return errors;
}

// ---------------------------------------------------------------------------
// Append-only trajectory store
// ---------------------------------------------------------------------------

const GENESIS_HASH = '0'.repeat(64);

export class ForgeTrajectoryStore {
  private dataDir: string;
  private ledgerPath: string;
  private receiptPath: string;
  private records: Map<string, ForgeTrajectoryRecord>;
  private requestIndex: Map<string, string>;
  private lastRecordSha256: string;
  private initialized: boolean;
  private initPromise: Promise<void> | null;
  private writeQueue: Promise<unknown>;

  constructor({ dataDir }: { dataDir: string }) {
    this.dataDir = path.resolve(dataDir);
    this.ledgerPath = path.join(this.dataDir, 'forge-trajectory.jsonl');
    this.receiptPath = path.join(this.dataDir, 'forge-trajectory-receipts.jsonl');
    this.records = new Map();
    this.requestIndex = new Map();
    this.lastRecordSha256 = GENESIS_HASH;
    this.initialized = false;
    this.initPromise = null;
    this.writeQueue = Promise.resolve();
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.#initInternal();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  async #initInternal(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    const discovered = new Map<string, ForgeTrajectoryRecord>();
    const reqIndex = new Map<string, string>();
    let lastSha = GENESIS_HASH;

    try {
      const ledger = await fs.readFile(this.ledgerPath, 'utf8');
      const lines = ledger.split('\n').filter((line) => line.trim());
      for (let i = 0; i < lines.length; i++) {
        let row: ForgeTrajectoryRecord;
        try {
          row = JSON.parse(lines[i]);
        } catch {
          throw new Error('forge trajectory ledger contains invalid JSON and cannot be trusted');
        }
        if (row.schema_version !== FORGE_TRAJECTORY_LEDGER_SCHEMA_VERSION) {
          throw new Error(`forge trajectory ledger record ${i} has wrong schema version`);
        }
        // Verify hash chain: previous_record_sha256 must match the previous record's hash
        if (row.previous_record_sha256 !== lastSha) {
          throw new Error(`forge trajectory ledger hash chain broken at record ${i}: previous_record_sha256 mismatch`);
        }
        // Verify record hash: recompute over body excluding record_id and record_sha256
        const { record_sha256: _rs, record_id: _rid, ...body } = row;
        const computed = sha256Hex(canonicalJson(body));
        if (computed !== row.record_sha256) {
          throw new Error(`forge trajectory ledger record ${i} hash mismatch — tamper detected`);
        }
        if (row.record_id !== row.record_sha256) {
          throw new Error(`forge trajectory ledger record ${i} identity does not match content hash`);
        }
        if (discovered.has(row.record_id)) {
          throw new Error('forge trajectory ledger contains duplicate record_id entries');
        }
        if (reqIndex.has(row.request_id)) {
          throw new Error('forge trajectory ledger contains duplicate request_id entries');
        }
        discovered.set(row.record_id, row);
        reqIndex.set(row.request_id, row.record_id);
        lastSha = row.record_sha256;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
    }

    this.records = discovered;
    this.requestIndex = reqIndex;
    this.lastRecordSha256 = lastSha;
    this.initialized = true;
  }

  async append(input: ForgeTrajectoryRecordInput): Promise<ForgeTrajectoryReceipt> {
    const operation = this.writeQueue.then(() => this.#appendInternal(input));
    this.writeQueue = operation.catch(() => undefined);
    return operation as Promise<ForgeTrajectoryReceipt>;
  }

  async #appendInternal(input: ForgeTrajectoryRecordInput): Promise<ForgeTrajectoryReceipt> {
    if (!this.initialized) await this.init();

    const errors = validateForgeTrajectoryRecord(input);
    if (errors.length) {
      const error = new Error(`invalid forge trajectory record: ${errors.join('; ')}`);
      (error as Error & { code: string }).code = 'INVALID_FORGE_TRAJECTORY';
      throw error;
    }

    // Idempotent duplicate check: same request_id → return receipt for existing record
    if (this.requestIndex.has(input.requestId)) {
      const existingId = this.requestIndex.get(input.requestId)!;
      const receiptBody = {
        receipt_version: FORGE_TRAJECTORY_RECEIPT_VERSION,
        accepted_at: isoTimestamp(),
        request_id: input.requestId,
        record_id: existingId,
        duplicate: true,
        ledger_sha256: await this.ledgerHash(),
      };
      const receipt: ForgeTrajectoryReceipt = {
        ...receiptBody,
        receipt_sha256: sha256Hex(canonicalJson(receiptBody)),
      };
      await fs.appendFile(this.receiptPath, `${canonicalJson(receipt)}\n`, 'utf8');
      return receipt;
    }

    // Build the record body (excluding record_id and record_sha256)
    const body = {
      schema_version: FORGE_TRAJECTORY_LEDGER_SCHEMA_VERSION,
      run_id: input.runId,
      dungeon_id: input.dungeonId,
      turn_index: input.turnIndex,
      contract_sha256: input.contractSha256,
      skill_md_sha256: input.skillMdSha256,
      observation_ref: input.observationRef,
      observation_sha256: input.observationSha256,
      allowed_actions_sha256: input.allowedActionsSha256,
      policy_revision_sha256: input.policyRevisionSha256,
      policy_config_sha256: input.policyConfigSha256,
      decision_candidate_sha256: input.decisionCandidateSha256,
      submitted_action: input.submittedAction,
      submitted_action_sha256: input.submittedActionSha256,
      request_id: input.requestId,
      http_status_category: input.httpStatusCategory,
      forge_response_ref: input.forgeResponseRef,
      forge_response_sha256: input.forgeResponseSha256,
      local_timestamp_epoch: input.localTimestampEpoch,
      forge_timestamp_epoch: input.forgeTimestampEpoch,
      previous_record_sha256: this.lastRecordSha256,
      status: input.status,
    };

    const recordSha256 = sha256Hex(canonicalJson(body));
    const record: ForgeTrajectoryRecord = {
      ...body,
      record_id: recordSha256,
      record_sha256: recordSha256,
    };

    // Append to ledger
    await fs.appendFile(this.ledgerPath, `${canonicalJson(record)}\n`, 'utf8');
    this.records.set(record.record_id, record);
    this.requestIndex.set(record.request_id, record.record_id);
    this.lastRecordSha256 = recordSha256;

    // Generate receipt
    const receiptBody = {
      receipt_version: FORGE_TRAJECTORY_RECEIPT_VERSION,
      accepted_at: isoTimestamp(),
      request_id: input.requestId,
      record_id: record.record_id,
      duplicate: false,
      ledger_sha256: await this.ledgerHash(),
    };
    const receipt: ForgeTrajectoryReceipt = {
      ...receiptBody,
      receipt_sha256: sha256Hex(canonicalJson(receiptBody)),
    };
    await fs.appendFile(this.receiptPath, `${canonicalJson(receipt)}\n`, 'utf8');
    return receipt;
  }

  async getRecords(): Promise<ForgeTrajectoryRecord[]> {
    if (!this.initialized) await this.init();
    return Array.from(this.records.values());
  }

  async getRecordsByRun(runId: string): Promise<ForgeTrajectoryRecord[]> {
    if (!this.initialized) await this.init();
    return Array.from(this.records.values()).filter((r) => r.run_id === runId);
  }

  async getRecord(recordId: string): Promise<ForgeTrajectoryRecord | null> {
    if (!this.initialized) await this.init();
    return this.records.get(recordId) ?? null;
  }

  async ledgerHash(): Promise<string> {
    try {
      return sha256Hex(await fs.readFile(this.ledgerPath, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return sha256Hex('');
      throw error;
    }
  }

  async stats(): Promise<{ schema_version: string; record_count: number; ledger_sha256: string }> {
    if (!this.initialized) await this.init();
    return {
      schema_version: FORGE_TRAJECTORY_LEDGER_SCHEMA_VERSION,
      record_count: this.records.size,
      ledger_sha256: await this.ledgerHash(),
    };
  }
}
