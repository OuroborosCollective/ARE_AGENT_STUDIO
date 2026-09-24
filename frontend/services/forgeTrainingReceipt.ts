/**
 * ForgeAI reproducible training/evaluation receipts & HF model artifact lane — v1.
 *
 * This module implements issue #14: extend the roadmap's "Reproducible training"
 * into an implementation lane for structured policies.
 *
 * Key properties:
 *   1. A training receipt is a versioned record binding all inputs and outputs
 *      of a training run. The artifact hashes ARE the identity — training logs
 *      alone are not enough.
 *   2. Evaluation uses frozen internal packs derived only from data with valid
 *      usage rights. Metrics are separate (invalid-action rate, terminal
 *      completion, recovery, action efficiency, external Forge score,
 *      correction rate) — no fabricated composite "ARE score".
 *   3. A separate HF model repository per released structured-policy family.
 *      The model card links source repo revision, training receipt, dataset
 *      revision, evaluation receipt, known limitations, Forge external-evidence
 *      scope, and license/rights status.
 *   4. Default private/gated until release conditions are satisfied.
 *
 * This module must never import or mutate visual-path modules
 * (neuralPolicyEngine, datasetCodec, serverSyncGateway, receiptVerifier).
 * The static guard scripts/forge_truth_guard.mjs enforces this.
 */

// ---------------------------------------------------------------------------
// Schema versions
// ---------------------------------------------------------------------------

export const FORGE_TRAINING_RECEIPT_SCHEMA_VERSION = 'forge-training-receipt.v1' as const;
export const FORGE_EVALUATION_RECEIPT_SCHEMA_VERSION = 'forge-evaluation-receipt.v1' as const;
export const FORGE_MODEL_CARD_SCHEMA_VERSION = 'forge-model-card.v1' as const;

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
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto SHA-256 is unavailable; training receipt hash cannot be computed.');
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
// 1. Training receipt
// ---------------------------------------------------------------------------

export interface TrainingReceiptInput {
  trainingDatasetManifestSha256: string;
  selectedEpisodeIds: string[];
  selectedEpisodeRootHashes: string[];
  codeGitSha: string;
  dependencyLockHash: string;
  containerRuntimeDigest: string;
  deterministicSeeds: string[];
  trainingConfigSha256: string;
  startEpoch: number;
  endEpoch: number;
  outputArtifactHashes: string[];
  evaluationManifestSha256: string;
  toolProviderIdentifiers: string[];
  nondeterminismNotes: string;
  createdAtEpoch: number;
}

export interface TrainingReceipt {
  schema_version: 'forge-training-receipt.v1';
  training_dataset_manifest_sha256: string;
  selected_episode_ids: string[];
  selected_episode_root_hashes: string[];
  code_git_sha: string;
  dependency_lock_hash: string;
  container_runtime_digest: string;
  deterministic_seeds: string[];
  training_config_sha256: string;
  start_epoch: number;
  end_epoch: number;
  output_artifact_hashes: string[];
  evaluation_manifest_sha256: string;
  tool_provider_identifiers: string[];
  nondeterminism_notes: string;
  created_at_epoch: number;
  receipt_sha256: string;
}

export function validateTrainingReceiptInput(input: TrainingReceiptInput): string[] {
  const errors: string[] = [];

  if (!SHA256_RE.test(input.trainingDatasetManifestSha256)) errors.push('Training dataset manifest hash must be a lowercase SHA-256 digest.');
  if (!Array.isArray(input.selectedEpisodeIds) || input.selectedEpisodeIds.length === 0) errors.push('Selected episode IDs must be a non-empty array.');
  if (!input.selectedEpisodeIds.every((id) => REF_RE.test(id))) errors.push('Each selected episode ID must be a safe reference.');
  if (!Array.isArray(input.selectedEpisodeRootHashes) || input.selectedEpisodeRootHashes.length !== input.selectedEpisodeIds.length) {
    errors.push('Selected episode root hashes must match the number of selected episode IDs.');
  }
  if (!input.selectedEpisodeRootHashes.every((h) => SHA256_RE.test(h))) errors.push('Each selected episode root hash must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.codeGitSha)) errors.push('Code Git SHA must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.dependencyLockHash)) errors.push('Dependency lock hash must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.containerRuntimeDigest)) errors.push('Container/runtime digest must be a lowercase SHA-256 digest.');
  if (!Array.isArray(input.deterministicSeeds) || input.deterministicSeeds.length === 0) errors.push('At least one deterministic seed is required.');
  if (!input.deterministicSeeds.every((s) => HEX_RE.test(s) && s.length > 0)) errors.push('Each deterministic seed must be a non-empty hex string.');
  if (!SHA256_RE.test(input.trainingConfigSha256)) errors.push('Training config hash must be a lowercase SHA-256 digest.');
  if (!Number.isInteger(input.startEpoch) || input.startEpoch < 0) errors.push('Start timestamp must be a non-negative integer.');
  if (!Number.isInteger(input.endEpoch) || input.endEpoch < input.startEpoch) errors.push('End timestamp must be a non-negative integer >= start timestamp.');
  if (!Array.isArray(input.outputArtifactHashes) || input.outputArtifactHashes.length === 0) errors.push('At least one output artifact hash is required.');
  if (!input.outputArtifactHashes.every((h) => SHA256_RE.test(h))) errors.push('Each output artifact hash must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.evaluationManifestSha256)) errors.push('Evaluation manifest hash must be a lowercase SHA-256 digest.');
  if (!Array.isArray(input.toolProviderIdentifiers) || input.toolProviderIdentifiers.length === 0) errors.push('At least one tool/provider identifier is required.');
  if (!input.toolProviderIdentifiers.every((id) => REF_RE.test(id))) errors.push('Each tool/provider identifier must be a safe reference.');
  if (typeof input.nondeterminismNotes !== 'string') errors.push('Nondeterminism notes must be a string.');
  if (input.nondeterminismNotes.length > 2048) errors.push('Nondeterminism notes must not exceed 2048 characters.');
  if (!Number.isInteger(input.createdAtEpoch) || input.createdAtEpoch < 0) errors.push('Created timestamp must be a non-negative integer.');

  return errors;
}

export async function buildTrainingReceipt(input: TrainingReceiptInput): Promise<TrainingReceipt> {
  const errors = validateTrainingReceiptInput(input);
  if (errors.length) {
    const error = new Error(`invalid training receipt input: ${errors.join('; ')}`);
    (error as Error & { code: string }).code = 'INVALID_TRAINING_RECEIPT';
    throw error;
  }

  const body = {
    schema_version: FORGE_TRAINING_RECEIPT_SCHEMA_VERSION,
    training_dataset_manifest_sha256: input.trainingDatasetManifestSha256,
    selected_episode_ids: input.selectedEpisodeIds,
    selected_episode_root_hashes: input.selectedEpisodeRootHashes,
    code_git_sha: input.codeGitSha,
    dependency_lock_hash: input.dependencyLockHash,
    container_runtime_digest: input.containerRuntimeDigest,
    deterministic_seeds: input.deterministicSeeds,
    training_config_sha256: input.trainingConfigSha256,
    start_epoch: input.startEpoch,
    end_epoch: input.endEpoch,
    output_artifact_hashes: input.outputArtifactHashes,
    evaluation_manifest_sha256: input.evaluationManifestSha256,
    tool_provider_identifiers: input.toolProviderIdentifiers,
    nondeterminism_notes: input.nondeterminismNotes,
    created_at_epoch: input.createdAtEpoch,
  };

  const receiptSha256 = await sha256Hex(canonicalJson(body));
  return { ...body, receipt_sha256: receiptSha256 };
}

export async function verifyTrainingReceiptIntegrity(receipt: TrainingReceipt): Promise<boolean> {
  const { receipt_sha256: _rs, ...body } = receipt;
  const computed = await sha256Hex(canonicalJson(body));
  return computed === receipt.receipt_sha256;
}

// ---------------------------------------------------------------------------
// 2. Evaluation receipt
// ---------------------------------------------------------------------------

export type EvaluationMetricName =
  | 'invalid_action_rate'
  | 'terminal_completion'
  | 'recovery_after_invalid_state'
  | 'action_efficiency'
  | 'external_forge_score'
  | 'correction_rate';

export interface EvaluationMetric {
  metric_name: EvaluationMetricName;
  value: number;
  description: string;
  is_external: boolean;
}

export interface EvaluationReceiptInput {
  evaluationPackId: string;
  datasetManifestSha256: string;
  policyRevisionId: string;
  metrics: EvaluationMetric[];
  evaluationConfigSha256: string;
  evaluatedAtEpoch: number;
}

export interface EvaluationReceipt {
  schema_version: 'forge-evaluation-receipt.v1';
  evaluation_pack_id: string;
  dataset_manifest_sha256: string;
  policy_revision_id: string;
  metrics: EvaluationMetric[];
  evaluation_config_sha256: string;
  evaluated_at_epoch: number;
  receipt_sha256: string;
}

const VALID_METRIC_NAMES: ReadonlySet<EvaluationMetricName> = new Set([
  'invalid_action_rate',
  'terminal_completion',
  'recovery_after_invalid_state',
  'action_efficiency',
  'external_forge_score',
  'correction_rate',
]);

export function validateEvaluationReceiptInput(input: EvaluationReceiptInput): string[] {
  const errors: string[] = [];

  if (!REF_RE.test(input.evaluationPackId)) errors.push('Evaluation pack ID must be a safe reference.');
  if (!SHA256_RE.test(input.datasetManifestSha256)) errors.push('Dataset manifest hash must be a lowercase SHA-256 digest.');
  if (!REF_RE.test(input.policyRevisionId)) errors.push('Policy revision ID must be a safe reference.');
  if (!Array.isArray(input.metrics) || input.metrics.length === 0) errors.push('At least one evaluation metric is required.');
  for (let i = 0; i < input.metrics.length; i++) {
    const m = input.metrics[i];
    if (!VALID_METRIC_NAMES.has(m.metric_name)) errors.push(`Metric ${i}: "${m.metric_name}" is not a valid metric name.`);
    if (typeof m.value !== 'number' || !Number.isFinite(m.value)) errors.push(`Metric ${i}: value must be a finite number.`);
    if (typeof m.description !== 'string' || m.description.trim().length === 0) errors.push(`Metric ${i}: description is required.`);
    if (typeof m.is_external !== 'boolean') errors.push(`Metric ${i}: is_external must be a boolean.`);
  }
  if (!SHA256_RE.test(input.evaluationConfigSha256)) errors.push('Evaluation config hash must be a lowercase SHA-256 digest.');
  if (!Number.isInteger(input.evaluatedAtEpoch) || input.evaluatedAtEpoch < 0) errors.push('Evaluated timestamp must be a non-negative integer.');

  return errors;
}

export async function buildEvaluationReceipt(input: EvaluationReceiptInput): Promise<EvaluationReceipt> {
  const errors = validateEvaluationReceiptInput(input);
  if (errors.length) {
    const error = new Error(`invalid evaluation receipt input: ${errors.join('; ')}`);
    (error as Error & { code: string }).code = 'INVALID_EVALUATION_RECEIPT';
    throw error;
  }

  const body = {
    schema_version: FORGE_EVALUATION_RECEIPT_SCHEMA_VERSION,
    evaluation_pack_id: input.evaluationPackId,
    dataset_manifest_sha256: input.datasetManifestSha256,
    policy_revision_id: input.policyRevisionId,
    metrics: input.metrics,
    evaluation_config_sha256: input.evaluationConfigSha256,
    evaluated_at_epoch: input.evaluatedAtEpoch,
  };

  const receiptSha256 = await sha256Hex(canonicalJson(body));
  return { ...body, receipt_sha256: receiptSha256 };
}

export async function verifyEvaluationReceiptIntegrity(receipt: EvaluationReceipt): Promise<boolean> {
  const { receipt_sha256: _rs, ...body } = receipt;
  const computed = await sha256Hex(canonicalJson(body));
  return computed === receipt.receipt_sha256;
}

// ---------------------------------------------------------------------------
// 3. HF model card
// ---------------------------------------------------------------------------

export interface ForgeModelCardInput {
  modelRepoId: string;
  policyFamilyId: string;
  sourceRepoRevision: string;
  trainingReceiptSha256: string;
  datasetRevisionSha256: string;
  evaluationReceiptSha256: string;
  knownLimitations: string;
  forgeExternalEvidenceScope: string;
  licenseRightsStatus: string;
  isPrivate: boolean;
  createdAtEpoch: number;
}

export interface ForgeModelCard {
  schema_version: 'forge-model-card.v1';
  model_repo_id: string;
  policy_family_id: string;
  source_repo_revision: string;
  training_receipt_sha256: string;
  dataset_revision_sha256: string;
  evaluation_receipt_sha256: string;
  known_limitations: string;
  forge_external_evidence_scope: string;
  license_rights_status: string;
  is_private: boolean;
  created_at_epoch: number;
  card_sha256: string;
}

export function validateModelCardInput(input: ForgeModelCardInput): string[] {
  const errors: string[] = [];

  if (!REF_RE.test(input.modelRepoId)) errors.push('Model repo ID must be a safe reference.');
  if (!REF_RE.test(input.policyFamilyId)) errors.push('Policy family ID must be a safe reference.');
  if (!SHA256_RE.test(input.sourceRepoRevision)) errors.push('Source repo revision must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.trainingReceiptSha256)) errors.push('Training receipt hash must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.datasetRevisionSha256)) errors.push('Dataset revision hash must be a lowercase SHA-256 digest.');
  if (!SHA256_RE.test(input.evaluationReceiptSha256)) errors.push('Evaluation receipt hash must be a lowercase SHA-256 digest.');
  if (typeof input.knownLimitations !== 'string' || input.knownLimitations.trim().length === 0) errors.push('Known limitations are required.');
  if (typeof input.forgeExternalEvidenceScope !== 'string' || input.forgeExternalEvidenceScope.trim().length === 0) errors.push('Forge external-evidence scope is required.');
  if (typeof input.licenseRightsStatus !== 'string' || input.licenseRightsStatus.trim().length === 0) errors.push('License/rights status is required.');
  if (typeof input.isPrivate !== 'boolean') errors.push('is_private must be a boolean.');
  if (!Number.isInteger(input.createdAtEpoch) || input.createdAtEpoch < 0) errors.push('Created timestamp must be a non-negative integer.');

  return errors;
}

export async function buildForgeModelCard(input: ForgeModelCardInput): Promise<ForgeModelCard> {
  const errors = validateModelCardInput(input);
  if (errors.length) {
    const error = new Error(`invalid model card input: ${errors.join('; ')}`);
    (error as Error & { code: string }).code = 'INVALID_MODEL_CARD';
    throw error;
  }

  const body = {
    schema_version: FORGE_MODEL_CARD_SCHEMA_VERSION,
    model_repo_id: input.modelRepoId,
    policy_family_id: input.policyFamilyId,
    source_repo_revision: input.sourceRepoRevision,
    training_receipt_sha256: input.trainingReceiptSha256,
    dataset_revision_sha256: input.datasetRevisionSha256,
    evaluation_receipt_sha256: input.evaluationReceiptSha256,
    known_limitations: input.knownLimitations,
    forge_external_evidence_scope: input.forgeExternalEvidenceScope,
    license_rights_status: input.licenseRightsStatus,
    is_private: input.isPrivate,
    created_at_epoch: input.createdAtEpoch,
  };

  const cardSha256 = await sha256Hex(canonicalJson(body));
  return { ...body, card_sha256: cardSha256 };
}

export async function verifyModelCardIntegrity(card: ForgeModelCard): Promise<boolean> {
  const { card_sha256: _cs, ...body } = card;
  const computed = await sha256Hex(canonicalJson(body));
  return computed === card.card_sha256;
}
