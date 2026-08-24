import type { DatasetReceipt, OperationCorrectionReceipt } from '../types';

const SHA256_RE = /^[a-f0-9]{64}$/;

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto SHA-256 is unavailable; receipt cannot be verified.');
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyDatasetReceipt(value: unknown, expectedRequestedRows: number): Promise<DatasetReceipt> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('dataset daemon returned a non-object receipt');
  const receipt = value as DatasetReceipt;
  if (receipt.receipt_version !== 'are-agent-receipt.v1') throw new Error('dataset daemon returned an unsupported receipt version');
  if (!Number.isInteger(receipt.requested_rows) || !Number.isInteger(receipt.accepted_rows) || !Number.isInteger(receipt.duplicate_rows)) throw new Error('dataset receipt row counts are invalid');
  if (receipt.requested_rows !== expectedRequestedRows) throw new Error('dataset receipt requested_rows does not match the submitted batch');
  if (receipt.accepted_rows < 0 || receipt.duplicate_rows < 0 || receipt.accepted_rows + receipt.duplicate_rows !== receipt.requested_rows) throw new Error('dataset receipt row counts are inconsistent');
  if (!Array.isArray(receipt.accepted_sample_ids) || receipt.accepted_sample_ids.length !== receipt.accepted_rows || !receipt.accepted_sample_ids.every((id) => SHA256_RE.test(id))) throw new Error('dataset receipt accepted_sample_ids are invalid');
  if (!SHA256_RE.test(receipt.ledger_sha256) || !SHA256_RE.test(receipt.receipt_sha256)) throw new Error('dataset receipt hashes are invalid');
  if (Number.isNaN(Date.parse(receipt.accepted_at))) throw new Error('dataset receipt accepted_at is invalid');

  const { receipt_sha256: claimedHash, ...body } = receipt;
  const computedHash = await sha256Hex(canonicalJson(body));
  if (computedHash !== claimedHash) throw new Error('dataset receipt SHA-256 does not match its canonical body');
  return receipt;
}

export async function verifyOperationCorrectionReceipt(value: unknown, expectedRequestedRows: number): Promise<OperationCorrectionReceipt> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('operation correction daemon returned a non-object receipt');
  const receipt = value as OperationCorrectionReceipt;
  if (receipt.receipt_version !== 'are-agent-operation-correction-receipt.v1') throw new Error('operation correction daemon returned an unsupported receipt version');
  if (!Number.isInteger(receipt.requested_rows) || !Number.isInteger(receipt.accepted_rows) || !Number.isInteger(receipt.duplicate_rows)) throw new Error('operation correction receipt row counts are invalid');
  if (receipt.requested_rows !== expectedRequestedRows) throw new Error('operation correction receipt requested_rows does not match the submitted batch');
  if (receipt.accepted_rows < 0 || receipt.duplicate_rows < 0 || receipt.accepted_rows + receipt.duplicate_rows !== receipt.requested_rows) throw new Error('operation correction receipt row counts are inconsistent');
  if (!Array.isArray(receipt.accepted_correction_ids) || receipt.accepted_correction_ids.length !== receipt.accepted_rows || !receipt.accepted_correction_ids.every((id) => SHA256_RE.test(id))) throw new Error('operation correction receipt accepted_correction_ids are invalid');
  if (!SHA256_RE.test(receipt.ledger_sha256) || !SHA256_RE.test(receipt.receipt_sha256)) throw new Error('operation correction receipt hashes are invalid');
  if (Number.isNaN(Date.parse(receipt.accepted_at))) throw new Error('operation correction receipt accepted_at is invalid');

  const { receipt_sha256: claimedHash, ...body } = receipt;
  const computedHash = await sha256Hex(canonicalJson(body));
  if (computedHash !== claimedHash) throw new Error('operation correction receipt SHA-256 does not match its canonical body');
  return receipt;
}
