import fs from 'node:fs/promises';
import path from 'node:path';
import { canonicalJson, deriveSampleId, sha256Hex, validateDatasetRow } from './validation.js';

export class DatasetStore {
  constructor({ dataDir }) {
    this.dataDir = path.resolve(dataDir);
    this.ledgerPath = path.join(this.dataDir, 'telemetry.jsonl');
    this.receiptPath = path.join(this.dataDir, 'receipts.jsonl');
    this.seen = new Set();
    this.publicationApproved = 0;
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
    const discovered = new Set();
    let publicationApproved = 0;
    try {
      const ledger = await fs.readFile(this.ledgerPath, 'utf8');
      for (const line of ledger.split('\n')) {
        if (!line.trim()) continue;
        let row;
        try {
          row = JSON.parse(line);
        } catch {
          throw new Error('dataset ledger contains invalid JSON and cannot be trusted');
        }
        const errors = validateDatasetRow(row);
        if (errors.length) throw new Error(`dataset ledger contains invalid evidence: ${errors.join('; ')}`);
        const expectedId = deriveSampleId(row);
        if (row.sample_id !== expectedId) throw new Error('dataset ledger sample_id does not match its content hash identity');
        if (discovered.has(row.sample_id)) throw new Error('dataset ledger contains duplicate sample_id entries');
        discovered.add(row.sample_id);
        if (row.publication?.allowed === true && row.publication?.basis === 'owner_confirmed') publicationApproved += 1;
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    this.seen = discovered;
    this.publicationApproved = publicationApproved;
    this.initialized = true;
  }

  async append(rows, metadata = {}) {
    const operation = this.writeQueue.then(() => this.#appendInternal(rows, metadata));
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async #appendInternal(rows, metadata) {
    if (!this.initialized) await this.init();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('at least one dataset row is required');

    const normalized = [];
    for (const candidate of rows) {
      const row = structuredClone(candidate);
      row.sample_id = deriveSampleId(row);
      const errors = validateDatasetRow(row);
      if (errors.length) {
        const err = new Error(`invalid dataset row: ${errors.join('; ')}`);
        err.code = 'INVALID_DATASET_ROW';
        throw err;
      }
      normalized.push(row);
    }

    const uniqueRows = [];
    const staged = new Set();
    for (const row of normalized) {
      if (!this.seen.has(row.sample_id) && !staged.has(row.sample_id)) {
        staged.add(row.sample_id);
        uniqueRows.push(row);
      }
    }

    if (uniqueRows.length) {
      const payload = `${uniqueRows.map((row) => canonicalJson(row)).join('\n')}\n`;
      await fs.appendFile(this.ledgerPath, payload, 'utf8');
      uniqueRows.forEach((row) => this.seen.add(row.sample_id));
      this.publicationApproved += uniqueRows.filter((row) => row.publication?.allowed === true && row.publication?.basis === 'owner_confirmed').length;
    }

    const receiptBody = {
      receipt_version: 'are-agent-receipt.v1',
      accepted_at: new Date().toISOString(),
      client_id: metadata.clientId || null,
      requested_rows: normalized.length,
      accepted_rows: uniqueRows.length,
      duplicate_rows: normalized.length - uniqueRows.length,
      accepted_sample_ids: uniqueRows.map((row) => row.sample_id),
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
      schema_version: 'are-agent-vla.v1',
      unique_samples: this.seen.size,
      ledger_sha256: await this.ledgerHash(),
    };
  }

  async publicStats() {
    if (!this.initialized) await this.init();
    return {
      accepted_unique_samples: this.seen.size,
      publication_approved_samples: this.publicationApproved,
      ledger_sha256: await this.ledgerHash(),
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
