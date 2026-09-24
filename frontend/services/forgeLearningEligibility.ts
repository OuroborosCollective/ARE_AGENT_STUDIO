/**
 * ForgeAI terminal-run-only offline learning & DAgger-style corrections — v1.
 *
 * This module implements issue #13: offline learning from completed Forge
 * runs without contaminating benchmark identity or rewriting history.
 *
 * Key properties:
 *   1. No online/mid-run training. Policy revision is frozen before turn 1
 *      and remains fixed until terminal. Run N influences policy N+1 only
 *      after terminal reconciliation.
 *   2. Learning eligibility consumes the reconciliation verdict rather than
 *      trusting runner success flags.
 *   3. Corrections are append-only records that reference the exact
 *      observation hash and original prediction/action. The original action
 *      is never overwritten.
 *   4. Episode splitting is at the run (episode) level, never individual
 *      turns, to prevent leakage across the same dungeon trajectory.
 *   5. Every produced policy revision binds a full manifest: dataset hash,
 *      input run IDs/root hashes, code Git SHA, training seed, training
 *      config hash, environment digest, output artifact hash, and evaluation
 *      manifest hash.
 *
 * This module must never import or mutate visual-path modules
 * (neuralPolicyEngine, datasetCodec, serverSyncGateway, receiptVerifier).
 * The static guard scripts/forge_truth_guard.mjs enforces this.
 */

// ---------------------------------------------------------------------------
// Schema versions
// ---------------------------------------------------------------------------

export const FORGE_LEARNING_SCHEMA_VERSION = 'forge-learning.v1' as const;
export const FORGE_CORRECTION_SCHEMA_VERSION = 'forge-structured-correction.v1' as const;
export const FORGE_POLICY_MANIFEST_SCHEMA_VERSION = 'forge-policy-revision-manifest.v1' as const;

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
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto SHA-256 is unavailable; learning hash cannot be computed.');
  const bytes = new TextEncoder().encode(data);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Shared validation regexes
// ---------------------------------------------------------------------------

const SHA256_RE = /^[a-f0-9]{64}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const HEX_RE = /^[a-f0-9]+$/;

// ---------------------------------------------------------------------------
// 1. Learning eligibility check
// ---------------------------------------------------------------------------

export type ReconciliationVerdict = 'VERIFIED' | 'PARTIAL' | 'MISMATCH' | 'UNOBSERVABLE' | 'UNPROVABLE';

export interface LearningEligibilityInput {
  runId: string;
  trajectoryValidates: boolean;
  terminalStatusImmutable: boolean;
  reconciliationVerdict: ReconciliationVerdict;
  rightsAllowsTraining: boolean;
  hasUnresolvedQuarantine: boolean;
}

export interface LearningEligibilityResult {
  run_id: string;
  eligible: boolean;
  reasons: string[];
  checked_at_epoch: number;
}

/**
 * The documented reconciliation threshold for learning eligibility.
 * A run may enter training only when the reconciliation verdict is VERIFIED
 * or PARTIAL. MISMATCH, UNOBSERVABLE, and UNPROVABLE are not sufficient.
 */
export const LEARNING_RECONCILIATION_THRESHOLD: ReadonlySet<ReconciliationVerdict> = new Set(['VERIFIED', 'PARTIAL']);

/**
 * Check whether a completed Forge run is eligible for offline learning.
 *
 * A run may enter training only when ALL of the following hold:
 *   - The trajectory ledger validates (hash chain intact).
 *   - The terminal status is immutable (run is finished, not mid-flight).
 *   - The reconciliation verdict meets the documented threshold.
 *   - Rights/privacy classification allows local training use.
 *   - No unresolved mismatch or quarantine exists.
 */
export function checkLearningEligibility(input: LearningEligibilityInput, checkedAtEpoch: number): LearningEligibilityResult {
  const reasons: string[] = [];

  if (!input.trajectoryValidates) reasons.push('Trajectory ledger does not validate.');
  if (!input.terminalStatusImmutable) reasons.push('Terminal status is not immutable.');
  if (!LEARNING_RECONCILIATION_THRESHOLD.has(input.reconciliationVerdict)) {
    reasons.push(`Reconciliation verdict "${input.reconciliationVerdict}" does not meet the learning threshold (VERIFIED or PARTIAL).`);
  }
  if (!input.rightsAllowsTraining) reasons.push('Rights/privacy classification does not allow local training use.');
  if (input.hasUnresolvedQuarantine) reasons.push('Unresolved quarantine exists.');

  return {
    run_id: input.runId,
    eligible: reasons.length === 0,
    reasons,
    checked_at_epoch: checkedAtEpoch,
  };
}

// ---------------------------------------------------------------------------
// 2. Forge structured correction (DAgger-style)
// ---------------------------------------------------------------------------

export interface ForgeCorrectionInput {
  runId: string;
  turnIndex: number;
  observationSha256: string;
  originalPredictionSha256: string;
  originalActionSha256: string | null;
  correctedActionSummary: string;
  correctedActionSha256: string;
  correctionRationale: string;
  ownerApprovedAdmission: boolean;
  createdAtEpoch: number;
}

export interface ForgeStructuredCorrection {
  schema_version: 'forge-structured-correction.v1';
  correction_id: string;
  run_id: string;
  turn_index: number;
  observation_sha256: string;
  original_prediction_sha256: string;
  original_action_sha256: string | null;
  corrected_action_summary: string;
  corrected_action_sha256: string;
  correction_rationale: string;
  admitted_to_training: boolean;
  created_at_epoch: number;
  correction_sha256: string;
}

export function validateForgeCorrectionInput(input: ForgeCorrectionInput): string[] {
  const errors: string[] = [];

  if (!REF_RE.test(input.runId)) errors.push('Run ID is required and may only use safe reference characters.');
  if (!Number.isInteger(input.turnIndex) || input.turnIndex < 0) errors.push('Turn index must be a non-negative integer.');
  if (!SHA256_RE.test(input.observationSha256)) errors.push('Observation hash must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.originalPredictionSha256)) errors.push('Original prediction hash must be a lowercase SHA-256 digest.');
  if (input.originalActionSha256 !== null && !SHA256_RE.test(input.originalActionSha256)) {
    errors.push('Original action hash must be null or a lowercase SHA-256 digest.');
  }
  if (typeof input.correctedActionSummary !== 'string' || !input.correctedActionSummary.trim() || input.correctedActionSummary.length > 280) {
    errors.push('Corrected action summary is required and must not exceed 280 characters.');
  }
  if (!SHA256_RE.test(input.correctedActionSha256)) errors.push('Corrected action hash must be a lowercase SHA-256 digest.');
  if (typeof input.correctionRationale !== 'string' || !input.correctionRationale.trim() || input.correctionRationale.length > 280) {
    errors.push('Correction rationale is required and must not exceed 280 characters.');
  }
  if (typeof input.ownerApprovedAdmission !== 'boolean') errors.push('Owner-approved admission must be a boolean.');
  if (!Number.isInteger(input.createdAtEpoch) || input.createdAtEpoch < 0) errors.push('Created timestamp must be a non-negative integer.');

  return errors;
}

/**
 * Build a Forge structured correction record.
 *
 * The correction is an append-only record that references the exact
 * observation hash and original prediction/action. The original action
 * is never overwritten — the correction is a NEW record alongside the
 * original trajectory entry.
 *
 * `admitted_to_training` is separate from the act of recording feedback.
 * A correction may be recorded without being admitted to training; the
 * owner must explicitly approve admission.
 */
export async function buildForgeCorrection(input: ForgeCorrectionInput): Promise<ForgeStructuredCorrection> {
  const errors = validateForgeCorrectionInput(input);
  if (errors.length) {
    const error = new Error(`invalid forge correction input: ${errors.join('; ')}`);
    (error as Error & { code: string }).code = 'INVALID_FORGE_CORRECTION';
    throw error;
  }

  const body = {
    schema_version: FORGE_CORRECTION_SCHEMA_VERSION,
    run_id: input.runId,
    turn_index: input.turnIndex,
    observation_sha256: input.observationSha256,
    original_prediction_sha256: input.originalPredictionSha256,
    original_action_sha256: input.originalActionSha256,
    corrected_action_summary: input.correctedActionSummary,
    corrected_action_sha256: input.correctedActionSha256,
    correction_rationale: input.correctionRationale,
    admitted_to_training: input.ownerApprovedAdmission,
    created_at_epoch: input.createdAtEpoch,
  };

  const correctionSha256 = await sha256Hex(canonicalJson(body));
  return {
    ...body,
    correction_id: correctionSha256,
    correction_sha256: correctionSha256,
  };
}

/**
 * Verify that a correction record's hash matches its content.
 */
export async function verifyCorrectionIntegrity(correction: ForgeStructuredCorrection): Promise<boolean> {
  const { correction_sha256: _cs, correction_id: _cid, ...body } = correction;
  const computed = await sha256Hex(canonicalJson(body));
  return computed === correction.correction_sha256 && correction.correction_id === correction.correction_sha256;
}

// ---------------------------------------------------------------------------
// 3. Episode-level splitting
// ---------------------------------------------------------------------------

export interface EpisodeSplitRatios {
  train: number;
  validation: number;
  test: number;
}

export interface EpisodeSplitResult {
  train: string[];
  validation: string[];
  test: string[];
  seed: string;
  ratios: EpisodeSplitRatios;
}

/**
 * Deterministically split run IDs (episodes) into train/validation/test sets.
 *
 * Splitting is at the EPISODE (run) level, never individual turns, to prevent
 * leakage across the same dungeon trajectory. The same input run IDs and seed
 * always produce the same split.
 *
 * Ratios must sum to 1.0. The split is deterministic: run IDs are sorted
 * canonically, then assigned to sets based on a seeded hash of each run ID.
 */
export function splitEpisodes(runIds: string[], ratios: EpisodeSplitRatios, seed: string): EpisodeSplitResult {
  const errors: string[] = [];
  if (!Array.isArray(runIds) || runIds.length === 0) errors.push('Run IDs must be a non-empty array.');
  if (!runIds.every((id) => REF_RE.test(id))) errors.push('Each run ID must be a safe reference.');
  if (ratios.train < 0 || ratios.validation < 0 || ratios.test < 0) errors.push('Ratios must be non-negative.');
  const sum = ratios.train + ratios.validation + ratios.test;
  if (Math.abs(sum - 1.0) > 0.001) errors.push(`Ratios must sum to 1.0 (got ${sum}).`);
  if (!HEX_RE.test(seed) || seed.length === 0) errors.push('Seed must be a non-empty hex string.');
  if (errors.length) {
    const error = new Error(`invalid episode split input: ${errors.join('; ')}`);
    (error as Error & { code: string }).code = 'INVALID_EPISODE_SPLIT';
    throw error;
  }

  // Deterministic ordering: sort run IDs canonically
  const sorted = [...runIds].sort();

  // Deterministic assignment: use a simple seeded hash of each run ID
  // to produce a value in [0, 1), then assign to train/val/test by ratio.
  const train: string[] = [];
  const validation: string[] = [];
  const test: string[] = [];

  for (const runId of sorted) {
    // Simple deterministic hash: XOR each character with the seed
    let hash = 0;
    const combined = runId + ':' + seed;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
    }
    // Map to [0, 1)
    const normalized = Math.abs(hash) / 2147483648;
    const trainBound = ratios.train;
    const valBound = ratios.train + ratios.validation;
    if (normalized < trainBound) {
      train.push(runId);
    } else if (normalized < valBound) {
      validation.push(runId);
    } else {
      test.push(runId);
    }
  }

  return { train, validation, test, seed, ratios };
}

// ---------------------------------------------------------------------------
// 4. Policy revision manifest
// ---------------------------------------------------------------------------

export interface PolicyRevisionManifestInput {
  policyRevisionId: string;
  trainingDatasetManifestSha256: string;
  inputRunIds: string[];
  inputRunRootHashes: string[];
  codeGitSha: string;
  trainingSeed: string;
  trainingConfigSha256: string;
  environmentDigest: string;
  outputArtifactSha256: string;
  evaluationManifestSha256: string;
  createdAtEpoch: number;
}

export interface PolicyRevisionManifest {
  schema_version: 'forge-policy-revision-manifest.v1';
  policy_revision_id: string;
  training_dataset_manifest_sha256: string;
  input_run_ids: string[];
  input_run_root_hashes: string[];
  code_git_sha: string;
  training_seed: string;
  training_config_sha256: string;
  environment_digest: string;
  output_artifact_sha256: string;
  evaluation_manifest_sha256: string;
  created_at_epoch: number;
  manifest_sha256: string;
}

export function validatePolicyRevisionManifestInput(input: PolicyRevisionManifestInput): string[] {
  const errors: string[] = [];

  if (!REF_RE.test(input.policyRevisionId)) errors.push('Policy revision ID is required and may only use safe reference characters.');
  if (!SHA256_RE.test(input.trainingDatasetManifestSha256)) errors.push('Training dataset manifest hash must be a lowercase SHA-256 digest.');
  if (!Array.isArray(input.inputRunIds) || input.inputRunIds.length === 0) errors.push('Input run IDs must be a non-empty array.');
  if (!input.inputRunIds.every((id) => REF_RE.test(id))) errors.push('Each input run ID must be a safe reference.');
  if (!Array.isArray(input.inputRunRootHashes) || input.inputRunRootHashes.length !== input.inputRunIds.length) {
    errors.push('Input run root hashes must match the number of input run IDs.');
  }
  if (!input.inputRunRootHashes.every((h) => SHA256_RE.test(h))) errors.push('Each input run root hash must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.codeGitSha)) errors.push('Code Git SHA must be a lowercase SHA-256 digest.');
  if (!HEX_RE.test(input.trainingSeed) || input.trainingSeed.length === 0) errors.push('Training seed must be a non-empty hex string.');
  if (!SHA256_RE.test(input.trainingConfigSha256)) errors.push('Training config hash must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.environmentDigest)) errors.push('Environment digest must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.outputArtifactSha256)) errors.push('Output artifact hash must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.evaluationManifestSha256)) errors.push('Evaluation manifest hash must be a lowercase SHA-256 digest.');
  if (!Number.isInteger(input.createdAtEpoch) || input.createdAtEpoch < 0) errors.push('Created timestamp must be a non-negative integer.');

  return errors;
}

/**
 * Build a policy revision manifest that binds all required metadata to a
 * policy revision. Every produced policy revision must carry this manifest.
 *
 * If the "policy" is an LLM planner prompt/tool configuration rather than
 * trainable weights, the same fields are versioned/hashed with equal rigor:
 * the output artifact hash covers the exact prompt/config artifact.
 */
export async function buildPolicyRevisionManifest(input: PolicyRevisionManifestInput): Promise<PolicyRevisionManifest> {
  const errors = validatePolicyRevisionManifestInput(input);
  if (errors.length) {
    const error = new Error(`invalid policy revision manifest input: ${errors.join('; ')}`);
    (error as Error & { code: string }).code = 'INVALID_POLICY_MANIFEST';
    throw error;
  }

  const body = {
    schema_version: FORGE_POLICY_MANIFEST_SCHEMA_VERSION,
    policy_revision_id: input.policyRevisionId,
    training_dataset_manifest_sha256: input.trainingDatasetManifestSha256,
    input_run_ids: input.inputRunIds,
    input_run_root_hashes: input.inputRunRootHashes,
    code_git_sha: input.codeGitSha,
    training_seed: input.trainingSeed,
    training_config_sha256: input.trainingConfigSha256,
    environment_digest: input.environmentDigest,
    output_artifact_sha256: input.outputArtifactSha256,
    evaluation_manifest_sha256: input.evaluationManifestSha256,
    created_at_epoch: input.createdAtEpoch,
  };

  const manifestSha256 = await sha256Hex(canonicalJson(body));
  return {
    ...body,
    manifest_sha256: manifestSha256,
  };
}

/**
 * Verify that a policy revision manifest's hash matches its content.
 */
export async function verifyPolicyRevisionManifestIntegrity(manifest: PolicyRevisionManifest): Promise<boolean> {
  const { manifest_sha256: _ms, ...body } = manifest;
  const computed = await sha256Hex(canonicalJson(body));
  return computed === manifest.manifest_sha256;
}
