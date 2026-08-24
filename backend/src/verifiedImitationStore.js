import fs from 'node:fs/promises';
import path from 'node:path';
import {
  VERIFIED_IMITATION_RECEIPT_VERSION,
  VERIFIED_IMITATION_SCHEMA_VERSION,
  deriveVerifiedImitationId,
  normalizeVerifiedImitation,
  validateVerifiedImitationDraft,
  validateVerifiedImitationRow,
} from './verifiedImitationValidation.js';
import { canonicalJson, sha256Hex } from './validation.js';

/**
 * A separate append-only ledger for independently recorded device-readback
 * evaluations. It intentionally does not accept a generic "success" claim:
 * every countable record binds a policy revision, command, before/after
 * observations, a bridge receipt, and a separately captured readback digest.
 */
export class VerifiedImitationStore {
  constructor({ dataDir }) {
    this.dataDir = path.resolve(dataDir);
    this.ledgerPath = path.join(this.dataDir, 'verified-imitations.jsonl');
    this.receiptPath = path.join(this.dataDir, 'verified-imitation-receipts.jsonl');
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
          throw new Error('verified imitation ledger contains invalid JSON and cannot be trusted');
        }
        const errors = validateVerifiedImitationRow(row);
        if (errors.length) throw new Error(`verified imitation ledger contains invalid evidence: ${errors.join('; ')}`);
        if (row.verification_id !== deriveVerifiedImitationId(row)) throw new Error('verified imitation ledger identity does not match content');
        if (discovered.has(row.verification_id)) throw new Error('verified imitation ledger contains duplicate verification_id entries');
        discovered.set(row.verification_id, row);
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
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('at least one verified imitation record is required');

    const normalized = [];
    for (const candidate of rows) {
      const draftErrors = validateVerifiedImitationDraft(candidate);
      if (draftErrors.length) {
        const error = new Error(`invalid verified imitation: ${draftErrors.join('; ')}`);
        error.code = 'INVALID_VERIFIED_IMITATION';
        throw error;
      }
      const row = normalizeVerifiedImitation(candidate);
      const errors = validateVerifiedImitationRow(row);
      if (errors.length) {
        const error = new Error(`invalid normalized verified imitation: ${errors.join('; ')}`);
        error.code = 'INVALID_VERIFIED_IMITATION';
        throw error;
      }
      normalized.push(row);
    }

    const uniqueRows = [];
    const staged = new Set();
    for (const row of normalized) {
      if (!this.records.has(row.verification_id) && !staged.has(row.verification_id)) {
        staged.add(row.verification_id);
        uniqueRows.push(row);
      }
    }
    if (uniqueRows.length) {
      await fs.appendFile(this.ledgerPath, `${uniqueRows.map((row) => canonicalJson(row)).join('\n')}\n`, 'utf8');
      uniqueRows.forEach((row) => this.records.set(row.verification_id, row));
    }

    const receiptBody = {
      receipt_version: VERIFIED_IMITATION_RECEIPT_VERSION,
      accepted_at: new Date().toISOString(),
      client_id: metadata.clientId || null,
      requested_rows: normalized.length,
      accepted_rows: uniqueRows.length,
      duplicate_rows: normalized.length - uniqueRows.length,
      accepted_verification_ids: uniqueRows.map((row) => row.verification_id),
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
      schema_version: VERIFIED_IMITATION_SCHEMA_VERSION,
      verified_device_readback_actions: this.records.size,
      ledger_sha256: await this.ledgerHash(),
    };
  }
}
