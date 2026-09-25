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
}

export interface EvidenceField {
  field: string;
  status: EvidenceStatus;
  value: string | null;
  source: string;
}

export interface QualificationRunInput {
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
  if (typeof input.gitSha !== 'string' || !SHA256_RE.test(input.gitSha)) {
    errors.push('gitSha must be a 64-char hex SHA-256');
  }
  if (typeof input.createdAtEpoch !== 'number' || !Number.isFinite(input.createdAtEpoch) || input.createdAtEpoch < 0) {
    errors.push('createdAtEpoch must be a non-negative finite number');
  }
  if (typeof input.practiceRunAuthorized !== 'boolean') {
    errors.push('practiceRunAuthorized must be a boolean');
  }
  if (input.runnerImageDigest != null && (typeof input.runnerImageDigest !== 'string' || !input.runnerImageDigest.trim())) {
    errors.push('runnerImageDigest must be a non-empty string or null');
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
  return errors;
}

export function checkQualificationPreconditions(input: QualificationRunInput): QualificationPrecondition[] {
  return [
    { id: 'structured_policy_contract', label: 'Structured policy contract live (#8)', met: input.policyRevisionSha256 != null },
    { id: 'forge_adapter', label: 'Forge adapter live and contract re-read (#9)', met: input.forgeContractSha256 != null && input.skillMdSha256 != null },
    { id: 'vps_runner', label: 'Dedicated VPS runner deployed (#11)', met: input.runnerImageDigest != null },
    { id: 'trajectory_ledger', label: 'Trusted trajectory ledger (#10)', met: input.trajectoryRootHash != null },
    { id: 'reconciliation_pipeline', label: 'Reconciliation pipeline ready (#12)', met: input.reconciliationVerdict != null },
    { id: 'learning_pipeline', label: 'Learning pipeline ready but disabled until terminal (#13)', met: input.learningReceiptSha256 != null },
    { id: 'hf_snapshot_pipeline', label: 'HF private snapshot pipeline ready (#16)', met: input.hfSnapshotManifestSha256 != null },
    { id: 'rights_gate', label: 'Rights gate installed (#15)', met: true },
    { id: 'training_receipt_lane', label: 'Training/evaluation receipt lane ready (#14)', met: input.policyConfigSha256 != null },
    { id: 'ci_gates', label: 'CI/contract-drift/security gates installed (#19)', met: true },
    { id: 'practice_run_authorized', label: 'Remaining practice allowance or owner-authorized run confirmed through real Forge readback', met: input.practiceRunAuthorized },
  ];
}

function buildEvidenceFields(input: QualificationRunInput): EvidenceField[] {
  const allMet = checkQualificationPreconditions(input).every((p) => p.met);
  const hasRun = input.runId != null && input.terminalState != null;

  return [
    {
      field: 'run_id',
      status: hasRun ? 'OBSERVED' : 'UNOBSERVABLE',
      value: input.runId,
      source: hasRun ? 'Forge run identifier' : 'no run executed',
    },
    {
      field: 'dungeon_id',
      status: hasRun ? 'OBSERVED' : 'UNOBSERVABLE',
      value: input.dungeonId,
      source: hasRun ? 'Forge dungeon identifier' : 'no run executed',
    },
    {
      field: 'forge_contract_hash',
      status: input.forgeContractSha256 != null ? 'VERIFIED' : 'UNOBSERVABLE',
      value: input.forgeContractSha256,
      source: input.forgeContractSha256 != null ? 'contract discovery' : 'no run executed',
    },
    {
      field: 'trajectory_root_hash',
      status: input.trajectoryRootHash != null ? 'VERIFIED' : 'UNOBSERVABLE',
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
      status: input.externalScore != null ? 'VERIFIED' : 'UNOBSERVABLE',
      value: input.externalScore,
      source: input.externalScore != null ? 'Forge readback' : 'no run executed',
    },
    {
      field: 'reconciliation_verdict',
      status: input.reconciliationVerdict != null ? 'VERIFIED' : 'UNOBSERVABLE',
      value: input.reconciliationVerdict,
      source: input.reconciliationVerdict != null ? 'independent reconciliation' : 'no run executed',
    },
    {
      field: 'policy_revision_played',
      status: input.policyRevisionSha256 != null ? 'DERIVED' : 'UNOBSERVABLE',
      value: input.policyRevisionSha256,
      source: input.policyRevisionSha256 != null ? 'frozen policy revision' : 'no run executed',
    },
    {
      field: 'learning_receipt',
      status: input.learningReceiptSha256 != null ? 'VERIFIED' : 'UNPROVABLE',
      value: input.learningReceiptSha256,
      source: input.learningReceiptSha256 != null ? 'offline learning receipt' : 'no run to learn from',
    },
    {
      field: 'policy_n_plus_1_artifact',
      status: input.policyNPlus1ArtifactHash != null ? 'VERIFIED' : 'UNPROVABLE',
      value: input.policyNPlus1ArtifactHash,
      source: input.policyNPlus1ArtifactHash != null ? 'policy revision artifact' : 'no learning performed',
    },
    {
      field: 'hf_snapshot_manifest',
      status: input.hfSnapshotManifestSha256 != null ? 'VERIFIED' : 'UNPROVABLE',
      value: input.hfSnapshotManifestSha256,
      source: input.hfSnapshotManifestSha256 != null ? 'HF snapshot pipeline' : 'no snapshot uploaded',
    },
    {
      field: 'source_runtime_revision',
      status: 'DERIVED',
      value: input.gitSha,
      source: 'Git SHA available, no runtime deployed',
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
  if (!allPreconditionsMet) {
    status = 'BLOCKED';
  } else if (input.terminalState != null && input.reconciliationVerdict != null) {
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
