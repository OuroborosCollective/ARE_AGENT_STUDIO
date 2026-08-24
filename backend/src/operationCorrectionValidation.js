import { canonicalJson, sha256Hex } from './validation.js';

export const OPERATION_CORRECTION_SCHEMA_VERSION = 'are-agent-operation-correction.v1';
export const OPERATION_CORRECTION_RECEIPT_VERSION = 'are-agent-operation-correction-receipt.v1';

const SHA256_RE = /^[a-f0-9]{64}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const OPERATION_TYPE_RE = /^[a-z][a-z0-9._-]{1,79}$/;
const RISK_TIERS = new Set(['reversible', 'external', 'irreversible']);
const DECISIONS = new Set(['approve', 'reject', 'amend']);
const REASON_CODES = new Set([
  'WRONG_TARGET',
  'SCOPE_TOO_BROAD',
  'MISSING_EVIDENCE',
  'CONSENT_REQUIRED',
  'UNSAFE_EFFECT',
  'INCORRECT_ACTION',
  'OTHER',
]);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validRef(value) {
  return typeof value === 'string' && REF_RE.test(value);
}

function validHash(value) {
  return typeof value === 'string' && SHA256_RE.test(value);
}

function validEpoch(value) {
  return Number.isInteger(value) && value >= 0;
}

function validSummary(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 280) return false;
  // A correction ledger stores only opaque hashes for parameters. Do not let an
  // accidental credential assignment turn a summary field into a secret sink.
  return !/\b(?:api[_-]?key|access[_-]?token|password|secret|private[_-]?key)\b\s*[:=]/i.test(value);
}

function proposalIdentity(proposal) {
  return {
    proposal_id: proposal?.proposal_id,
    operation_type: proposal?.operation_type,
    action_summary: proposal?.action_summary,
    target_ref: proposal?.target_ref ?? null,
    parameters_sha256: proposal?.parameters_sha256,
    policy_revision_sha256: proposal?.policy_revision_sha256,
    observation_evidence_sha256: proposal?.observation_evidence_sha256,
    requested_at_epoch: proposal?.requested_at_epoch,
    risk_tier: proposal?.risk_tier,
    execution_state: proposal?.execution_state,
  };
}

export function deriveProposalHash(proposal) {
  return sha256Hex(canonicalJson(proposalIdentity(proposal)));
}

export function deriveOperationCorrectionId(row) {
  const identity = {
    schema_version: row?.schema_version,
    context: {
      session_id: row?.context?.session_id,
      sequence_index: row?.context?.sequence_index,
      mission_id: row?.context?.mission_id ?? null,
      attempt_id: row?.context?.attempt_id ?? null,
    },
    proposal_sha256: deriveProposalHash(row?.proposal),
    correction: {
      decision: row?.correction?.decision,
      reason_code: row?.correction?.reason_code,
      owner_ref: row?.correction?.owner_ref,
      rationale: row?.correction?.rationale ?? null,
      corrected_action_summary: row?.correction?.corrected_action_summary ?? null,
      corrected_parameters_sha256: row?.correction?.corrected_parameters_sha256 ?? null,
      captured_at_epoch: row?.correction?.captured_at_epoch,
    },
    learning: {
      allowed: row?.learning?.allowed,
      basis: row?.learning?.basis,
    },
  };
  return sha256Hex(canonicalJson(identity));
}

export function normalizeOperationCorrection(candidate) {
  const row = structuredClone(candidate);
  if (!isObject(row.proposal)) return row;
  row.proposal.proposal_sha256 = deriveProposalHash(row.proposal);
  row.correction_id = deriveOperationCorrectionId(row);
  return row;
}

function validateShared(row, { requireDerived }) {
  const errors = [];
  if (!isObject(row)) return ['operation correction must be an object'];
  if (row.schema_version !== OPERATION_CORRECTION_SCHEMA_VERSION) errors.push(`schema_version must equal ${OPERATION_CORRECTION_SCHEMA_VERSION}`);

  if (!isObject(row.context)) {
    errors.push('context is required');
  } else {
    if (!validRef(row.context.session_id)) errors.push('context.session_id must be a non-secret reference');
    if (!validEpoch(row.context.sequence_index)) errors.push('context.sequence_index must be a non-negative integer');
    if (row.context.mission_id !== undefined && row.context.mission_id !== null && !validRef(row.context.mission_id)) errors.push('context.mission_id must be a non-secret reference when present');
    if (row.context.attempt_id !== undefined && row.context.attempt_id !== null && !validRef(row.context.attempt_id)) errors.push('context.attempt_id must be a non-secret reference when present');
  }

  if (!isObject(row.proposal)) {
    errors.push('proposal is required');
  } else {
    if (!validRef(row.proposal.proposal_id)) errors.push('proposal.proposal_id must be a non-secret reference');
    if (typeof row.proposal.operation_type !== 'string' || !OPERATION_TYPE_RE.test(row.proposal.operation_type)) errors.push('proposal.operation_type must be a stable lowercase operation identifier');
    if (!validSummary(row.proposal.action_summary)) errors.push('proposal.action_summary is required, limited, and must not contain credential assignments');
    if (row.proposal.target_ref !== undefined && row.proposal.target_ref !== null && !validRef(row.proposal.target_ref)) errors.push('proposal.target_ref must be a non-secret reference when present');
    if (!validHash(row.proposal.parameters_sha256)) errors.push('proposal.parameters_sha256 must be a SHA-256 digest');
    if (!validHash(row.proposal.policy_revision_sha256)) errors.push('proposal.policy_revision_sha256 must be a SHA-256 digest');
    if (!validHash(row.proposal.observation_evidence_sha256)) errors.push('proposal.observation_evidence_sha256 must be a SHA-256 digest');
    if (!validEpoch(row.proposal.requested_at_epoch)) errors.push('proposal.requested_at_epoch must be a non-negative integer');
    if (!RISK_TIERS.has(row.proposal.risk_tier)) errors.push('proposal.risk_tier is invalid');
    if (row.proposal.execution_state !== 'not_executed') errors.push('proposal.execution_state must be not_executed; this ledger cannot prove or authorize effects');
    if (requireDerived && row.proposal.proposal_sha256 !== deriveProposalHash(row.proposal)) errors.push('proposal.proposal_sha256 does not match canonical proposal content');
  }

  if (!isObject(row.correction)) {
    errors.push('correction is required');
  } else {
    if (!DECISIONS.has(row.correction.decision)) errors.push('correction.decision must be approve, reject, or amend');
    if (!REASON_CODES.has(row.correction.reason_code)) errors.push('correction.reason_code is invalid');
    if (!validRef(row.correction.owner_ref)) errors.push('correction.owner_ref must be a non-secret owner reference');
    if (row.correction.rationale !== undefined && row.correction.rationale !== null && !validSummary(row.correction.rationale)) errors.push('correction.rationale must be limited and must not contain credential assignments when present');
    if (!validEpoch(row.correction.captured_at_epoch)) errors.push('correction.captured_at_epoch must be a non-negative integer');
    if (row.correction.decision === 'amend') {
      if (!validSummary(row.correction.corrected_action_summary)) errors.push('an amendment requires correction.corrected_action_summary');
      if (!validHash(row.correction.corrected_parameters_sha256)) errors.push('an amendment requires correction.corrected_parameters_sha256');
    } else if (row.correction.corrected_action_summary !== undefined || row.correction.corrected_parameters_sha256 !== undefined) {
      errors.push('corrected action fields are only valid for an amendment');
    }
  }

  if (!isObject(row.learning)) {
    errors.push('learning metadata is required');
  } else if (typeof row.learning.allowed !== 'boolean' || !['unreviewed', 'owner_confirmed'].includes(row.learning.basis)) {
    errors.push('learning metadata is invalid');
  } else if (row.learning.allowed && row.learning.basis !== 'owner_confirmed') {
    errors.push('learning.allowed=true requires basis=owner_confirmed');
  } else if (!row.learning.allowed && row.learning.basis !== 'unreviewed') {
    errors.push('learning.allowed=false requires basis=unreviewed');
  }

  if (requireDerived && row.correction_id !== deriveOperationCorrectionId(row)) errors.push('correction_id does not match content identity');
  return errors;
}

export function validateOperationCorrectionDraft(row) {
  return validateShared(row, { requireDerived: false });
}

export function validateOperationCorrectionRow(row) {
  return validateShared(row, { requireDerived: true });
}

export function isSha256(value) {
  return validHash(value);
}
