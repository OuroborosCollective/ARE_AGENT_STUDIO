/**
 * ForgeAI rights/terms publication gate — v1.
 *
 * This module implements issue #15: make public Hugging Face publication
 * fail closed until we know exactly what ARE may redistribute and under
 * what basis.
 *
 * Key properties:
 *   1. A machine-readable publication-rights record binds policy/terms URLs,
 *      observed last-updated dates, evidence hashes, review dates, and
 *      per-category permissions.
 *   2. Every exported row/field must have a rights classification.
 *   3. The snapshot builder must include allowed fields, omit or quarantine
 *      disallowed/uncertain fields, count and explain exclusions, and
 *      preserve hashes so private source evidence can be correlated.
 *   4. Public publish is refused when the release manifest contains
 *      unresolved rights classes. Unknown = not public.
 *
 * This module must never import or mutate visual-path modules
 * (neuralPolicyEngine, datasetCodec, serverSyncGateway, receiptVerifier).
 * The static guard scripts/forge_truth_guard.mjs enforces this.
 */

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

export const FORGE_RIGHTS_RECORD_SCHEMA_VERSION = 'forge-publication-rights.v1' as const;

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

async function sha256Hex(data: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto SHA-256 is unavailable; rights record hash cannot be computed.');
  const bytes = new TextEncoder().encode(data);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Shared validation regexes
// ---------------------------------------------------------------------------

const SHA256_RE = /^[a-f0-9]{64}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const URL_RE = /^https?:\/\/[A-Za-z0-9._:/-]+$/;

// ---------------------------------------------------------------------------
// Rights categories
// ---------------------------------------------------------------------------

export type RightsCategory =
  | 'are_owned_action_metadata'
  | 'forge_observations_state'
  | 'forge_scores'
  | 'forge_replay_history'
  | 'derived_labels'
  | 'forge_screenshots_content';

export const ALL_RIGHTS_CATEGORIES: RightsCategory[] = [
  'are_owned_action_metadata',
  'forge_observations_state',
  'forge_scores',
  'forge_replay_history',
  'derived_labels',
  'forge_screenshots_content',
];

// ---------------------------------------------------------------------------
// Per-category permissions
// ---------------------------------------------------------------------------

export interface CategoryPermissions {
  category: RightsCategory;
  allowed_local_use: boolean;
  allowed_private_hf_upload: boolean;
  allowed_public_redistribution: boolean;
  allowed_model_training: boolean;
  attribution_notice_required: boolean;
  explicit_permission_ref: string | null;
}

// ---------------------------------------------------------------------------
// Rights record
// ---------------------------------------------------------------------------

export interface ForgeRightsRecordInput {
  policyTermsUrls: string[];
  observedLastUpdatedDates: (string | null)[];
  evidenceSnapshotHashes: string[];
  reviewDate: string;
  categoryPermissions: CategoryPermissions[];
  reviewerConfirmation: string;
  createdAtEpoch: number;
}

export interface ForgeRightsRecord {
  schema_version: 'forge-publication-rights.v1';
  policy_terms_urls: string[];
  observed_last_updated_dates: (string | null)[];
  evidence_snapshot_hashes: string[];
  review_date: string;
  category_permissions: CategoryPermissions[];
  reviewer_confirmation: string;
  created_at_epoch: number;
  record_sha256: string;
}

export function validateRightsRecordInput(input: ForgeRightsRecordInput): string[] {
  const errors: string[] = [];

  if (!Array.isArray(input.policyTermsUrls) || input.policyTermsUrls.length === 0) errors.push('At least one policy/terms URL is required.');
  if (!input.policyTermsUrls.every((u) => URL_RE.test(u))) errors.push('Each policy/terms URL must be a valid HTTP(S) URL.');

  if (!Array.isArray(input.observedLastUpdatedDates) || input.observedLastUpdatedDates.length !== input.policyTermsUrls.length) {
    errors.push('Observed last-updated dates must match the number of policy/terms URLs.');
  }
  for (let i = 0; i < input.observedLastUpdatedDates.length; i++) {
    const d = input.observedLastUpdatedDates[i];
    if (d !== null && (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d))) {
      errors.push(`Observed last-updated date ${i} must be null or a YYYY-MM-DD string.`);
    }
  }

  if (!Array.isArray(input.evidenceSnapshotHashes) || input.evidenceSnapshotHashes.length === 0) errors.push('At least one evidence snapshot hash is required.');
  if (!input.evidenceSnapshotHashes.every((h) => SHA256_RE.test(h))) errors.push('Each evidence snapshot hash must be a lowercase SHA-256 digest.');

  if (typeof input.reviewDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.reviewDate)) errors.push('Review date must be a YYYY-MM-DD string.');

  if (!Array.isArray(input.categoryPermissions) || input.categoryPermissions.length === 0) errors.push('At least one category permission entry is required.');
  const seenCategories = new Set<string>();
  for (let i = 0; i < input.categoryPermissions.length; i++) {
    const p = input.categoryPermissions[i];
    if (!ALL_RIGHTS_CATEGORIES.includes(p.category)) errors.push(`Category permission ${i}: "${p.category}" is not a valid rights category.`);
    if (seenCategories.has(p.category)) errors.push(`Category permission ${i}: duplicate category "${p.category}".`);
    seenCategories.add(p.category);
    if (typeof p.allowed_local_use !== 'boolean') errors.push(`Category ${p.category}: allowed_local_use must be a boolean.`);
    if (typeof p.allowed_private_hf_upload !== 'boolean') errors.push(`Category ${p.category}: allowed_private_hf_upload must be a boolean.`);
    if (typeof p.allowed_public_redistribution !== 'boolean') errors.push(`Category ${p.category}: allowed_public_redistribution must be a boolean.`);
    if (typeof p.allowed_model_training !== 'boolean') errors.push(`Category ${p.category}: allowed_model_training must be a boolean.`);
    if (typeof p.attribution_notice_required !== 'boolean') errors.push(`Category ${p.category}: attribution_notice_required must be a boolean.`);
    if (p.explicit_permission_ref !== null && !REF_RE.test(p.explicit_permission_ref)) errors.push(`Category ${p.category}: explicit_permission_ref must be null or a safe reference.`);
  }

  if (typeof input.reviewerConfirmation !== 'string' || input.reviewerConfirmation.trim().length === 0) errors.push('Reviewer confirmation is required.');
  if (!Number.isInteger(input.createdAtEpoch) || input.createdAtEpoch < 0) errors.push('Created timestamp must be a non-negative integer.');

  return errors;
}

export async function buildForgeRightsRecord(input: ForgeRightsRecordInput): Promise<ForgeRightsRecord> {
  const errors = validateRightsRecordInput(input);
  if (errors.length) {
    const error = new Error(`invalid rights record input: ${errors.join('; ')}`);
    (error as Error & { code: string }).code = 'INVALID_RIGHTS_RECORD';
    throw error;
  }

  const body = {
    schema_version: FORGE_RIGHTS_RECORD_SCHEMA_VERSION,
    policy_terms_urls: input.policyTermsUrls,
    observed_last_updated_dates: input.observedLastUpdatedDates,
    evidence_snapshot_hashes: input.evidenceSnapshotHashes,
    review_date: input.reviewDate,
    category_permissions: input.categoryPermissions,
    reviewer_confirmation: input.reviewerConfirmation,
    created_at_epoch: input.createdAtEpoch,
  };

  const recordSha256 = await sha256Hex(canonicalJson(body));
  return { ...body, record_sha256: recordSha256 };
}

export async function verifyRightsRecordIntegrity(record: ForgeRightsRecord): Promise<boolean> {
  const { record_sha256: _rs, ...body } = record;
  const computed = await sha256Hex(canonicalJson(body));
  return computed === record.record_sha256;
}

// ---------------------------------------------------------------------------
// Publication gate: check if a field may be publicly published
// ---------------------------------------------------------------------------

export interface FieldRightsClassification {
  field_name: string;
  category: RightsCategory;
}

export interface PublicationGateResult {
  allowed_fields: string[];
  quarantined_fields: string[];
  quarantined_reasons: Record<string, string>;
  public_publish_allowed: boolean;
}

/**
 * Classify fields against a rights record. Fields whose category allows
 * public redistribution are included; others are quarantined.
 *
 * Unknown categories default to quarantine (fail-closed).
 */
export function classifyFieldsForPublication(
  fields: FieldRightsClassification[],
  rightsRecord: ForgeRightsRecord,
): PublicationGateResult {
  const permissionsByCategory = new Map<string, CategoryPermissions>();
  for (const p of rightsRecord.category_permissions) {
    permissionsByCategory.set(p.category, p);
  }

  const allowedFields: string[] = [];
  const quarantinedFields: string[] = [];
  const quarantinedReasons: Record<string, string> = {};

  for (const field of fields) {
    const perms = permissionsByCategory.get(field.category);
    if (!perms) {
      quarantinedFields.push(field.field_name);
      quarantinedReasons[field.field_name] = `Category "${field.category}" has no permissions entry — unknown defaults to quarantine.`;
      continue;
    }
    if (!perms.allowed_public_redistribution) {
      quarantinedFields.push(field.field_name);
      quarantinedReasons[field.field_name] = `Category "${field.category}" does not allow public redistribution.`;
      continue;
    }
    allowedFields.push(field.field_name);
  }

  return {
    allowed_fields: allowedFields,
    quarantined_fields: quarantinedFields,
    quarantined_reasons: quarantinedReasons,
    public_publish_allowed: quarantinedFields.length === 0,
  };
}

/**
 * Assert that a release manifest is safe for public publication.
 * Throws if any field is unresolved (quarantined or unknown).
 */
export function assertPublicationAllowed(
  fields: FieldRightsClassification[],
  rightsRecord: ForgeRightsRecord,
): PublicationGateResult {
  const result = classifyFieldsForPublication(fields, rightsRecord);
  if (!result.public_publish_allowed) {
    const error = new Error(`Publication gate: ${result.quarantined_fields.length} field(s) quarantined: ${result.quarantined_fields.join(', ')}`);
    (error as Error & { code: string }).code = 'PUBLICATION_BLOCKED';
    throw error;
  }
  return result;
}
