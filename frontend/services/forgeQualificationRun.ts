/**
 * Issue #20 — ForgeAI Qualification Run Evidence Bundle Builder.
 *
 * This module is the "Baugrundstück" (foundation) for the first real Forge
 * practice benchmark. It captures the evidence bundle structure defined in
 * docs/QUALIFICATION_RUN_EVIDENCE.md, validates preconditions, and produces
 * an integrity-verifiable evidence receipt with strict provenance status
 * vocabulary.
 *
 * Status: BLOCKED — No free/practice run is available or confirmed.
 * This issue must NOT be converted into a paid purchase.
 *
 * Schema: forge-qualification-run.v1
 *
 * Self-contained: no imports from protected visual-path modules.
 */

export const FORGE_QUALIFICATION_RUN_SCHEMA_VERSION = 'forge-qualification-run.v1';

export type QualificationRunStatus = 'BLOCKED' | 'READY' | 'EXECUTING' | 'COMPLETED';

export type EvidenceStatus =
  | 'OBSERVED'
  | 'DERIVED'
  | 'VERIFIED'
  | 'PARTIAL'
  | 'UNOBSERVABLE'
  | 'UNPROVABLE'
  | 'REJECTED';

export interface QualificationPrecondition {
  id: string;
  label: string;
  met: boolean;
  evidence: ReadinessEvidence | null;
}

export interface EvidenceField {
  field: string;
  status: EvidenceStatus;
  value: string | null;
  source: string;
}

/** Caller-supplied evidence references; hashes bind receipts, not their truth.
 * The orchestrator must read/verify these sources before supplying them. */
export interface ReadinessEvidence {
  receiptSha256: string;
  sourceRef: string;
  gitSha: string;
}

export interface QualificationRunInput {
  readinessEvidence?: Record<string, ReadinessEvidence>;
  reconciliationReceiptSha256?: string | null;
  reconciliationCoverage?: string | null;
  runId: string | null;
  dungeonId: string | null;
  gitSha: string;
  runnerImageDigest: string | null;
  policyRevisionSha256: string | null;
  policyConfigSha256: string | null;
  forgeContractSha256: string | null;
  skillMdSha256: string | null;
  trajectoryRootHash: string | null;
  terminalState: string | null;
  externalScore: string | null;
  reconciliationVerdict: string | null;
  learningReceiptSha256: string | null;
  policyNPlus1ArtifactHash: string | null;
  hfSnapshotManifestSha256: string | null;
  practiceRunAuthorized: boolean;
  createdAtEpoch: number;
}

export interface QualificationEvidenceBundle {
  schema_version: typeof FORGE_QUALIFICATION_RUN_SCHEMA_VERSION;
  qualification_id: string;
  status: QualificationRunStatus;
  preconditions: QualificationPrecondition[];
  evidence: EvidenceField[];
  git_sha: string;
  runner_image_digest: string | null;
  practice_run_authorized: boolean;
  created_at_epoch: number;
  bundle_sha256: string;
}

const SHA256_RE = /^[a-f0-9]{64}$/;
const GIT_SHA_RE = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const VERDICTS = ['VERIFIED', 'PARTIAL', 'MISMATCH', 'UNOBSERVABLE', 'UNPROVABLE'];

async function sha256Hex(data: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto SHA-256 is unavailable; qualification hash cannot be computed.');
  const bytes = new TextEncoder().encode(data);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function validateQualificationRunInput(input: Partial<QualificationRunInput>): string[] {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') return ['input must be an object'];
  if (typeof input.gitSha !== 'string' || !GIT_SHA_RE.test(input.gitSha)) {
    errors.push('gitSha must be a full 40- or 64-char Git object ID');
  }
  if (typeof input.createdAtEpoch !== 'number' || !Number.isFinite(input.createdAtEpoch) || input.createdAtEpoch < 0) {
    errors.push('createdAtEpoch must be a non-negative finite number');
  }
  if (typeof input.practiceRunAuthorized !== 'boolean') {
    errors.push('practiceRunAuthorized must be a boolean');
  }
  if (input.runnerImageDigest != null && (typeof input.runnerImageDigest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(input.runnerImageDigest))) {
    errors.push('runnerImageDigest must be sha256:<64 hex characters> or null');
  }
  if (input.policyRevisionSha256 != null && !SHA256_RE.test(input.policyRevisionSha256)) {
    errors.push('policyRevisionSha256 must be a 64-char hex SHA-256 or null');
  }
  if (input.policyConfigSha256 != null && !SHA256_RE.test(input.policyConfigSha256)) {
    errors.push('policyConfigSha256 must be a 64-char hex SHA-256 or null');
  }
  if (input.forgeContractSha256 != null && !SHA256_RE.test(input.forgeContractSha256)) {
    errors.push('forgeContractSha256 must be a 64-char hex SHA-256 or null');
  }
  if (input.skillMdSha256 != null && !SHA256_RE.test(input.skillMdSha256)) {
    errors.push('skillMdSha256 must be a 64-char hex SHA-256 or null');
  }
  if (input.trajectoryRootHash != null && !SHA256_RE.test(input.trajectoryRootHash)) {
    errors.push('trajectoryRootHash must be a 64-char hex SHA-256 or null');
  }
  if (input.learningReceiptSha256 != null && !SHA256_RE.test(input.learningReceiptSha256)) {
    errors.push('learningReceiptSha256 must be a 64-char hex SHA-256 or null');
  }
  if (input.policyNPlus1ArtifactHash != null && !SHA256_RE.test(input.policyNPlus1ArtifactHash)) {
    errors.push('policyNPlus1ArtifactHash must be a 64-char hex SHA-256 or null');
  }
  if (input.hfSnapshotManifestSha256 != null && !SHA256_RE.test(input.hfSnapshotManifestSha256)) {
    errors.push('hfSnapshotManifestSha256 must be a 64-char hex SHA-256 or null');
  }
  for (const key of ['runId', 'dungeonId', 'terminalState', 'externalScore', 'reconciliationCoverage'] as const) {
    if (input[key] != null && (typeof input[key] !== 'string' || !input[key]!.trim())) errors.push(`${key} must be non-empty or null`);
  }
  if (input.reconciliationVerdict != null && !VERDICTS.includes(input.reconciliationVerdict)) errors.push('unknown reconciliation verdict');
  if (input.reconciliationReceiptSha256 != null && !SHA256_RE.test(input.reconciliationReceiptSha256)) errors.push('invalid reconciliation receipt hash');
  if (input.readinessEvidence != null) {
    if (typeof input.readinessEvidence !== 'object' || Array.isArray(input.readinessEvidence)) errors.push('readinessEvidence must be an object');
    else for (const receipt of Object.values(input.readinessEvidence)) {
      if (!receipt || typeof receipt.receiptSha256 !== 'string' || !SHA256_RE.test(receipt.receiptSha256)
        || typeof receipt.sourceRef !== 'string' || !receipt.sourceRef.trim()
        || typeof receipt.gitSha !== 'string' || !GIT_SHA_RE.test(receipt.gitSha)) errors.push('invalid readiness evidence reference');
    }
  }
  return errors;
}

export function checkQualificationPreconditions(input: QualificationRunInput): QualificationPrecondition[] {
  // Readiness is established BEFORE play. Post-run learning/snapshot outputs
  // are optional and cannot be prerequisites for the run that creates them.
  const checks: Array<[string, string, boolean]> = [
    ['structured_policy_contract', 'Structured policy and config tested (#8)', !!input.policyRevisionSha256 && !!input.policyConfigSha256],
    ['forge_adapter', 'Current run contract read and adapter tested (#9)', !!input.forgeContractSha256 && !!input.skillMdSha256],
    ['vps_runner', 'Exact-revision runner deployed (#11)', !!input.runnerImageDigest],
    ['trajectory_ledger', 'Trusted empty or existing ledger (#10)', true],
    ['reconciliation_pipeline', 'Reconciliation pipeline ready (#12)', true],
    ['learning_pipeline', 'Offline learning gated until terminal (#13)', true],
    ['hf_snapshot_pipeline', 'Private snapshot pipeline ready (#16)', true],
    ['rights_gate', 'Rights gate installed (#15)', true],
    ['training_receipt_lane', 'Training receipt lane ready (#14)', !!input.policyConfigSha256],
    ['ci_gates', 'Exact-head regressions green (#19)', true],
    ['practice_run_authorized', 'Authorized free run confirmed by Forge readback', input.practiceRunAuthorized === true],
  ];
  return checks.map(([id, label, configured]) => {
    const reference = input.readinessEvidence?.[id];
    const evidence = reference ? { ...reference } : null;
    return { id, label, evidence, met: configured && evidence != null
      && evidence.gitSha === input.gitSha && SHA256_RE.test(evidence.receiptSha256)
      && typeof evidence.sourceRef === 'string' && evidence.sourceRef.trim().length > 0 };
  });
}

function buildEvidenceFields(input: QualificationRunInput): EvidenceField[] {
  const hasRun = input.runId != null;

  return [
    ...([
      ['policy_revision_selected', input.policyRevisionSha256],
      ['policy_config_hash', input.policyConfigSha256],
      ['skill_md_hash', input.skillMdSha256],
      ['runner_image_digest', input.runnerImageDigest],
    ] as Array<[string, string | null]>).map(([field, value]): EvidenceField => ({
      field, value, status: value != null ? 'DERIVED' : 'UNPROVABLE',
      source: 'Declared pre-run configuration; verification requires referenced readiness receipts',
    })),
    {
      field: 'run_id',
      status: hasRun ? 'OBSERVED' : 'UNOBSERVABLE',
      value: input.runId,
      source: hasRun ? 'Forge run identifier' : 'no run executed',
    },
    {
      field: 'dungeon_id',
      status: input.dungeonId != null ? 'OBSERVED' : 'UNOBSERVABLE',
      value: input.dungeonId,
      source: hasRun ? 'Forge dungeon identifier' : 'no run executed',
    },
    {
      field: 'forge_contract_hash',
      status: input.forgeContractSha256 != null ? 'DERIVED' : 'UNOBSERVABLE',
      value: input.forgeContractSha256,
      source: input.forgeContractSha256 != null ? 'contract discovery' : 'no run executed',
    },
    {
      field: 'trajectory_root_hash',
      status: input.trajectoryRootHash != null ? 'DERIVED' : 'UNOBSERVABLE',
      value: input.trajectoryRootHash,
      source: input.trajectoryRootHash != null ? 'append-only ledger' : 'no run executed',
    },
    {
      field: 'terminal_state',
      status: input.terminalState != null ? 'OBSERVED' : 'UNOBSERVABLE',
      value: input.terminalState,
      source: input.terminalState != null ? 'run lifecycle' : 'no run executed',
    },
    {
      field: 'external_score',
      status: input.externalScore != null ? 'OBSERVED' : 'UNOBSERVABLE',
      value: input.externalScore,
      source: input.externalScore != null ? 'Forge readback' : 'no run executed',
    },
    {
      field: 'reconciliation_verdict',
      status: input.reconciliationVerdict === 'MISMATCH' ? 'REJECTED' : input.reconciliationVerdict === 'PARTIAL' ? 'PARTIAL' : input.reconciliationVerdict === 'UNOBSERVABLE' ? 'UNOBSERVABLE' : input.reconciliationVerdict === 'UNPROVABLE' ? 'UNPROVABLE' : input.reconciliationVerdict != null ? 'DERIVED' : 'UNOBSERVABLE',
      value: input.reconciliationVerdict,
      source: input.reconciliationVerdict != null ? 'independent reconciliation' : 'no run executed',
    },
    {
      field: 'policy_revision_played',
      status: hasRun && input.policyRevisionSha256 != null ? 'DERIVED' : 'UNOBSERVABLE',
      value: hasRun ? input.policyRevisionSha256 : null,
      source: input.policyRevisionSha256 != null ? 'frozen policy revision' : 'no run executed',
    },
    {
      field: 'learning_receipt',
      status: input.learningReceiptSha256 != null ? 'DERIVED' : 'UNPROVABLE',
      value: input.learningReceiptSha256,
      source: input.learningReceiptSha256 != null ? 'offline learning receipt' : 'no run to learn from',
    },
    {
      field: 'policy_n_plus_1_artifact',
      status: input.policyNPlus1ArtifactHash != null ? 'DERIVED' : 'UNPROVABLE',
      value: input.policyNPlus1ArtifactHash,
      source: input.policyNPlus1ArtifactHash != null ? 'policy revision artifact' : 'no learning performed',
    },
    {
      field: 'hf_snapshot_manifest',
      status: input.hfSnapshotManifestSha256 != null ? 'DERIVED' : 'UNPROVABLE',
      value: input.hfSnapshotManifestSha256,
      source: input.hfSnapshotManifestSha256 != null ? 'HF snapshot pipeline' : 'no snapshot uploaded',
    },
    { field: 'reconciliation_receipt', status: input.reconciliationReceiptSha256 ? 'DERIVED' : 'UNPROVABLE', value: input.reconciliationReceiptSha256 ?? null, source: input.reconciliationCoverage ?? 'no reconciliation coverage supplied' },
    {
      field: 'source_runtime_revision',
      status: 'DERIVED',
      value: input.gitSha,
      source: 'Declared source revision; deployment requires the vps_runner receipt',
    },
  ];
}

export async function buildQualificationEvidenceBundle(input: QualificationRunInput): Promise<QualificationEvidenceBundle> {
  const errors = validateQualificationRunInput(input);
  if (errors.length) {
    throw new Error(`invalid qualification run input: ${errors.join('; ')}`);
  }

  const preconditions = checkQualificationPreconditions(input);
  const allPreconditionsMet = preconditions.every((p) => p.met);
  const evidence = buildEvidenceFields(input);

  let status: QualificationRunStatus;
  const reconciled = ['VERIFIED', 'PARTIAL'].includes(input.reconciliationVerdict ?? '')
    && !!input.reconciliationReceiptSha256 && !!input.reconciliationCoverage;
  if (!allPreconditionsMet || (input.terminalState != null && (!input.runId || !input.trajectoryRootHash || !reconciled))) {
    status = 'BLOCKED';
  } else if (input.runId != null && input.terminalState != null && reconciled) {
    status = 'COMPLETED';
  } else if (input.runId != null) {
    status = 'EXECUTING';
  } else {
    status = 'READY';
  }

  const body = {
    schema_version: FORGE_QUALIFICATION_RUN_SCHEMA_VERSION as typeof FORGE_QUALIFICATION_RUN_SCHEMA_VERSION,
    qualification_id: '', // filled after hash
    status,
    preconditions,
    evidence,
    git_sha: input.gitSha,
    runner_image_digest: input.runnerImageDigest,
    practice_run_authorized: input.practiceRunAuthorized,
    created_at_epoch: input.createdAtEpoch,
  };

  const bundleSha256 = await sha256Hex(canonicalJson({ ...body, qualification_id: '' }));
  const qualificationId = bundleSha256;

  return {
    ...body,
    qualification_id: qualificationId,
    bundle_sha256: bundleSha256,
  };
}

export async function verifyQualificationEvidenceIntegrity(bundle: QualificationEvidenceBundle): Promise<boolean> {
  if (!bundle || bundle.schema_version !== FORGE_QUALIFICATION_RUN_SCHEMA_VERSION) return false;
  const { bundle_sha256, qualification_id, ...body } = bundle;
  const expectedHash = await sha256Hex(canonicalJson({ ...body, qualification_id: '' }));
  return expectedHash === bundle_sha256 && bundle_sha256 === qualification_id;
}
