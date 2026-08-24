import fs from 'node:fs/promises';
import path from 'node:path';
import {
  OPERATION_CORRECTION_RECEIPT_VERSION,
  OPERATION_CORRECTION_SCHEMA_VERSION,
  deriveOperationCorrectionId,
  normalizeOperationCorrection,
  validateOperationCorrectionDraft,
  validateOperationCorrectionRow,
} from './operationCorrectionValidation.js';
import { canonicalJson, sha256Hex } from './validation.js';

function candidateMaterial(row) {
  return {
    operation_type: row.proposal.operation_type,
    risk_tier: row.proposal.risk_tier,
    decision: row.correction.decision,
    reason_code: row.correction.reason_code,
    corrected_action_summary: row.correction.corrected_action_summary ?? null,
    corrected_parameters_sha256: row.correction.corrected_parameters_sha256 ?? null,
  };
}

export class OperationCorrectionStore {
  constructor({ dataDir }) {
    this.dataDir = path.resolve(dataDir);
    this.ledgerPath = path.join(this.dataDir, 'operation-corrections.jsonl');
    this.receiptPath = path.join(this.dataDir, 'operation-correction-receipts.jsonl');
    this.records = new Map();
    this.initialized = false;
    this.initPromise = null;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.#initInternal();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  async #initInternal() {
    await fs.mkdir(this.dataDir, { recursive: true });
    const discovered = new Map();
    try {
      const ledger = await fs.readFile(this.ledgerPath, 'utf8');
      for (const line of ledger.split('\n')) {
        if (!line.trim()) continue;
        let row;
        try {
          row = JSON.parse(line);
        } catch {
          throw new Error('operation correction ledger contains invalid JSON and cannot be trusted');
        }
        const errors = validateOperationCorrectionRow(row);
        if (errors.length) throw new Error(`operation correction ledger contains invalid evidence: ${errors.join('; ')}`);
        if (row.correction_id !== deriveOperationCorrectionId(row)) throw new Error('operation correction ledger identity does not match content');
        if (discovered.has(row.correction_id)) throw new Error('operation correction ledger contains duplicate correction_id entries');
        discovered.set(row.correction_id, row);
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    this.records = discovered;
    this.initialized = true;
  }

  async append(rows, metadata = {}) {
    const operation = this.writeQueue.then(() => this.#appendInternal(rows, metadata));
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async #appendInternal(rows, metadata) {
    if (!this.initialized) await this.init();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('at least one operation correction row is required');

    const normalized = [];
    for (const candidate of rows) {
      const draftErrors = validateOperationCorrectionDraft(candidate);
      if (draftErrors.length) {
        const err = new Error(`invalid operation correction: ${draftErrors.join('; ')}`);
        err.code = 'INVALID_OPERATION_CORRECTION';
        throw err;
      }
      const row = normalizeOperationCorrection(candidate);
      const errors = validateOperationCorrectionRow(row);
      if (errors.length) {
        const err = new Error(`invalid normalized operation correction: ${errors.join('; ')}`);
        err.code = 'INVALID_OPERATION_CORRECTION';
        throw err;
      }
      normalized.push(row);
    }

    const uniqueRows = [];
    const staged = new Set();
    for (const row of normalized) {
      if (!this.records.has(row.correction_id) && !staged.has(row.correction_id)) {
        staged.add(row.correction_id);
        uniqueRows.push(row);
      }
    }

    if (uniqueRows.length) {
      await fs.appendFile(this.ledgerPath, `${uniqueRows.map((row) => canonicalJson(row)).join('\n')}\n`, 'utf8');
      uniqueRows.forEach((row) => this.records.set(row.correction_id, row));
    }

    const receiptBody = {
      receipt_version: OPERATION_CORRECTION_RECEIPT_VERSION,
      accepted_at: new Date().toISOString(),
      client_id: metadata.clientId || null,
      requested_rows: normalized.length,
      accepted_rows: uniqueRows.length,
      duplicate_rows: normalized.length - uniqueRows.length,
      accepted_correction_ids: uniqueRows.map((row) => row.correction_id),
      ledger_sha256: await this.ledgerHash(),
    };
    const receipt = { ...receiptBody, receipt_sha256: sha256Hex(canonicalJson(receiptBody)) };
    await fs.appendFile(this.receiptPath, `${canonicalJson(receipt)}\n`, 'utf8');
    return receipt;
  }

  async ledgerHash() {
    try {
      return sha256Hex(await fs.readFile(this.ledgerPath));
    } catch (error) {
      if (error?.code === 'ENOENT') return sha256Hex('');
      throw error;
    }
  }

  async stats() {
    if (!this.initialized) await this.init();
    return {
      schema_version: OPERATION_CORRECTION_SCHEMA_VERSION,
      unique_corrections: this.records.size,
      ledger_sha256: await this.ledgerHash(),
    };
  }

  async learningProjection() {
    if (!this.initialized) await this.init();
    const sourceLedgerSha256 = await this.ledgerHash();
    const groups = new Map();
    for (const row of this.records.values()) {
      if (!row.learning.allowed || row.learning.basis !== 'owner_confirmed') continue;
      const material = candidateMaterial(row);
      const materialHash = sha256Hex(canonicalJson(material));
      const current = groups.get(materialHash) || { material, correctionIds: [] };
      current.correctionIds.push(row.correction_id);
      groups.set(materialHash, current);
    }
    const candidates = [...groups.entries()]
      .map(([materialHash, group]) => {
        const correctionIds = [...group.correctionIds].sort();
        return {
          schema_version: 'are-agent-operation-learning-candidate.v1',
          candidate_id: sha256Hex(canonicalJson({ source_ledger_sha256: sourceLedgerSha256, material_hash: materialHash, correction_ids: correctionIds })),
          source_ledger_sha256: sourceLedgerSha256,
          material: group.material,
          correction_count: correctionIds.length,
          correction_ids: correctionIds,
          execution_authority: 'none',
          status: 'candidate_only',
        };
      })
      .sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));
    return {
      schema_version: 'are-agent-operation-learning-projection.v1',
      source_ledger_sha256: sourceLedgerSha256,
      candidate_count: candidates.length,
      candidates,
    };
  }

  async readLedger() {
    try {
      return await fs.readFile(this.ledgerPath, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') return '';
      throw error;
    }
  }
}
