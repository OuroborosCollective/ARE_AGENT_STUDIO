/**
 * ForgeAI terminal trajectory reconciliation — version 1.
 *
 * This module implements issue #12: independently reconcile terminal local
 * trajectories against Forge-owned readback. It prevents ARE from declaring
 * its own local log authoritative.
 *
 * Schema: are-agent-forge-reconciliation.v1
 *
 * Truth boundaries:
 *   1. VERIFIED means every field required by the declared verification
 *      contract was actually observed and matched — not just a Forge score.
 *   2. A mismatch quarantines a run from learning/publication until reviewed.
 *   3. An unavailable endpoint yields PARTIAL/UNOBSERVABLE, never VERIFIED.
 *   4. Schema drift yields no coercion — fields that Forge does not expose
 *      are reported as UNOBSERVABLE, not fabricated.
 *
 * This module must never import or mutate visual-path modules
 * (neuralPolicyEngine, datasetCodec, serverSyncGateway, receiptVerifier).
 * The static guard scripts/forge_truth_guard.mjs enforces this.
 */

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

export const FORGE_RECONCILIATION_SCHEMA_VERSION = 'are-agent-forge-reconciliation.v1' as const;

// ---------------------------------------------------------------------------
// Self-contained canonical JSON & SHA-256 (same algorithm, not imported)
// ---------------------------------------------------------------------------

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256Hex(data: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto SHA-256 is unavailable; reconciliation hash cannot be computed.');
  const bytes = new TextEncoder().encode(data);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReconciliationVerdict = 'VERIFIED' | 'PARTIAL' | 'MISMATCH' | 'UNOBSERVABLE' | 'UNPROVABLE';

export interface FieldComparison {
  field: string;
  local_value: string | null;
  forge_value: string | null;
  match: boolean | null; // null = field was not independently observable
}

export interface ForgeReconciliationReceipt {
  schema_version: 'are-agent-forge-reconciliation.v1';
  reconciliation_id: string;
  run_id: string;
  local_trajectory_root_hash: string;
  forge_endpoint_refs: string[];
  forge_response_hashes: string[];
  compared_fields: FieldComparison[];
  coverage_statement: string;
  verdict: ReconciliationVerdict;
  reconciliation_code_revision: string;
  reconciled_at_epoch: number;
  receipt_sha256: string;
}

export interface ForgeReconciliationInput {
  runId: string;
  localTrajectoryRootHash: string;
  forgeEndpointRefs: string[];
  forgeResponseHashes: string[];
  comparedFields: FieldComparison[];
  coverageStatement: string;
  reconciliationCodeRevision: string;
  reconciledAtEpoch: number;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SHA256_RE = /^[a-f0-9]{64}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const FIELD_NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;

export function validateForgeReconciliationInput(input: ForgeReconciliationInput): string[] {
  const errors: string[] = [];

  if (!REF_RE.test(input.runId)) errors.push('Run ID is required and may only use safe reference characters.');
  if (!SHA256_RE.test(input.localTrajectoryRootHash)) errors.push('Local trajectory root hash must be a lowercase SHA-256 digest.');

  if (!Array.isArray(input.forgeEndpointRefs)) {
    errors.push('Forge endpoint refs must be an array.');
  } else if (input.forgeEndpointRefs.length === 0) {
    errors.push('At least one Forge endpoint reference is required.');
  } else if (!input.forgeEndpointRefs.every((r) => REF_RE.test(r) || /^https?:\/\//.test(r))) {
    errors.push('Forge endpoint refs must be safe references or URLs.');
  }

  if (!Array.isArray(input.forgeResponseHashes)) {
    errors.push('Forge response hashes must be an array.');
  } else if (!input.forgeResponseHashes.every((h) => h === null || SHA256_RE.test(h))) {
    errors.push('Forge response hashes must be null or lowercase SHA-256 digests.');
  }

  if (!Array.isArray(input.comparedFields) || input.comparedFields.length === 0) {
    errors.push('At least one compared field is required.');
  } else {
    for (let i = 0; i < input.comparedFields.length; i++) {
      const f = input.comparedFields[i];
      if (!FIELD_NAME_RE.test(f.field)) errors.push(`Compared field ${i}: name must be a lowercase snake_case identifier.`);
      if (typeof f.local_value !== 'string' && f.local_value !== null) errors.push(`Compared field ${i}: local_value must be a string or null.`);
      if (typeof f.forge_value !== 'string' && f.forge_value !== null) errors.push(`Compared field ${i}: forge_value must be a string or null.`);
      if (typeof f.match !== 'boolean' && f.match !== null) errors.push(`Compared field ${i}: match must be boolean or null.`);
    }
  }

  if (typeof input.coverageStatement !== 'string' || input.coverageStatement.trim().length === 0) {
    errors.push('Coverage statement is required.');
  }
  if (input.coverageStatement.length > 1024) {
    errors.push('Coverage statement must not exceed 1024 characters.');
  }
  if (!SHA256_RE.test(input.reconciliationCodeRevision)) errors.push('Reconciliation code revision must be a lowercase SHA-256 digest.');
  if (!Number.isInteger(input.reconciledAtEpoch) || input.reconciledAtEpoch < 0) errors.push('Reconciled timestamp must be a non-negative integer.');

  return errors;
}

// ---------------------------------------------------------------------------
// Verdict computation
// ---------------------------------------------------------------------------

/**
 * Compute a reconciliation verdict from field comparisons.
 *
 * - MISMATCH: at least one field was observed on both sides and values differ.
 * - UNOBSERVABLE: every field's match is null (no field was independently observable).
 * - VERIFIED: every field was observed and matched.
 * - PARTIAL: some fields matched, others were unobservable (but no mismatch).
 * - UNPROVABLE: no fields were compared.
 */
export function computeReconciliationVerdict(fields: FieldComparison[]): ReconciliationVerdict {
  if (fields.length === 0) return 'UNPROVABLE';

  const hasMismatch = fields.some((f) => f.match === false);
  if (hasMismatch) return 'MISMATCH';

  const allUnobservable = fields.every((f) => f.match === null);
  if (allUnobservable) return 'UNOBSERVABLE';

  const allMatched = fields.every((f) => f.match === true);
  if (allMatched) return 'VERIFIED';

  return 'PARTIAL';
}

// ---------------------------------------------------------------------------
// Receipt building
// ---------------------------------------------------------------------------

export async function buildForgeReconciliationReceipt(input: ForgeReconciliationInput): Promise<ForgeReconciliationReceipt> {
  const errors = validateForgeReconciliationInput(input);
  if (errors.length) {
    const error = new Error(`invalid reconciliation input: ${errors.join('; ')}`);
    (error as Error & { code: string }).code = 'INVALID_RECONCILIATION';
    throw error;
  }

  const verdict = computeReconciliationVerdict(input.comparedFields);

  const body = {
    schema_version: FORGE_RECONCILIATION_SCHEMA_VERSION,
    run_id: input.runId,
    local_trajectory_root_hash: input.localTrajectoryRootHash,
    forge_endpoint_refs: input.forgeEndpointRefs,
    forge_response_hashes: input.forgeResponseHashes,
    compared_fields: input.comparedFields,
    coverage_statement: input.coverageStatement,
    verdict,
    reconciliation_code_revision: input.reconciliationCodeRevision,
    reconciled_at_epoch: input.reconciledAtEpoch,
  };

  const receiptSha256 = await sha256Hex(canonicalJson(body));
  const receipt: ForgeReconciliationReceipt = {
    ...body,
    reconciliation_id: receiptSha256,
    receipt_sha256: receiptSha256,
  };
  return receipt;
}

/**
 * Verify that a reconciliation receipt's hash matches its content.
 * Returns true if the receipt is intact, false if tampered.
 */
export async function verifyReconciliationIntegrity(receipt: ForgeReconciliationReceipt): Promise<boolean> {
  const { receipt_sha256: _rs, reconciliation_id: _rid, ...body } = receipt;
  const computed = await sha256Hex(canonicalJson(body));
  return computed === receipt.receipt_sha256 && receipt.reconciliation_id === receipt.receipt_sha256;
}
