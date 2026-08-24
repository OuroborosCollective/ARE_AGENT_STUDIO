import { canonicalJson, sha256Hex } from './validation.js';

export const VERIFIED_IMITATION_SCHEMA_VERSION = 'are-agent-verified-imitation.v1';
export const VERIFIED_IMITATION_RECEIPT_VERSION = 'are-agent-verified-imitation-receipt.v1';

const SHA256_RE = /^[a-f0-9]{64}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validHash(value) {
  return typeof value === 'string' && SHA256_RE.test(value);
}

function validRef(value) {
  return typeof value === 'string' && REF_RE.test(value);
}

function validEpoch(value) {
  return Number.isInteger(value) && value >= 0;
}

function identityMaterial(row) {
  return {
    schema_version: row?.schema_version,
    context: {
      session_id: row?.context?.session_id,
      sequence_index: row?.context?.sequence_index,
      episode_id: row?.context?.episode_id ?? null,
    },
    action: {
      action_id: row?.action?.action_id,
      action_type: row?.action?.action_type,
      policy_revision_sha256: row?.action?.policy_revision_sha256,
      observation_before_sha256: row?.action?.observation_before_sha256,
      action_command_sha256: row?.action?.action_command_sha256,
    },
    evaluation: {
      method: row?.evaluation?.method,
      result: row?.evaluation?.result,
      evaluator_ref: row?.evaluation?.evaluator_ref,
      verified_at_epoch: row?.evaluation?.verified_at_epoch,
      action_receipt_sha256: row?.evaluation?.action_receipt_sha256,
      observation_after_sha256: row?.evaluation?.observation_after_sha256,
      device_readback_sha256: row?.evaluation?.device_readback_sha256,
      independent_evidence_sha256: row?.evaluation?.independent_evidence_sha256,
    },
  };
}

export function deriveVerifiedImitationId(row) {
  return sha256Hex(canonicalJson(identityMaterial(row)));
}

export function normalizeVerifiedImitation(candidate) {
  const row = structuredClone(candidate);
  row.verification_id = deriveVerifiedImitationId(row);
  return row;
}

function validateShared(row, { requireDerived }) {
  const errors = [];
  if (!isObject(row)) return ['verified imitation record must be an object'];
  if (row.schema_version !== VERIFIED_IMITATION_SCHEMA_VERSION) errors.push(`schema_version must equal ${VERIFIED_IMITATION_SCHEMA_VERSION}`);

  if (!isObject(row.context)) {
    errors.push('context is required');
  } else {
    if (!validRef(row.context.session_id)) errors.push('context.session_id must be a non-secret reference');
    if (!validEpoch(row.context.sequence_index)) errors.push('context.sequence_index must be a non-negative integer');
    if (row.context.episode_id !== undefined && row.context.episode_id !== null && !validRef(row.context.episode_id)) errors.push('context.episode_id must be a non-secret reference when present');
  }

  if (!isObject(row.action)) {
    errors.push('action is required');
  } else {
    if (!validRef(row.action.action_id)) errors.push('action.action_id must be a non-secret reference');
    if (!validRef(row.action.action_type)) errors.push('action.action_type must be a stable action reference');
    if (!validHash(row.action.policy_revision_sha256)) errors.push('action.policy_revision_sha256 must be a SHA-256 digest');
    if (!validHash(row.action.observation_before_sha256)) errors.push('action.observation_before_sha256 must be a SHA-256 digest');
    if (!validHash(row.action.action_command_sha256)) errors.push('action.action_command_sha256 must be a SHA-256 digest');
  }

  if (!isObject(row.evaluation)) {
    errors.push('evaluation is required');
  } else {
    if (row.evaluation.method !== 'device_readback') errors.push('evaluation.method must be device_readback for a priced verified imitation action');
    if (row.evaluation.result !== 'reproduced') errors.push('evaluation.result must be reproduced for a priced verified imitation action');
    if (!validRef(row.evaluation.evaluator_ref)) errors.push('evaluation.evaluator_ref must be a non-secret reference');
    if (!validEpoch(row.evaluation.verified_at_epoch)) errors.push('evaluation.verified_at_epoch must be a non-negative integer');
    if (!validHash(row.evaluation.action_receipt_sha256)) errors.push('evaluation.action_receipt_sha256 must be a SHA-256 digest');
    if (!validHash(row.evaluation.observation_after_sha256)) errors.push('evaluation.observation_after_sha256 must be a SHA-256 digest');
    if (!validHash(row.evaluation.device_readback_sha256)) errors.push('evaluation.device_readback_sha256 must be a SHA-256 digest');
    if (!validHash(row.evaluation.independent_evidence_sha256)) errors.push('evaluation.independent_evidence_sha256 must be a SHA-256 digest');
  }

  if (requireDerived && row.verification_id !== deriveVerifiedImitationId(row)) errors.push('verification_id does not match content identity');
  return errors;
}

export function validateVerifiedImitationDraft(row) {
  return validateShared(row, { requireDerived: false });
}

export function validateVerifiedImitationRow(row) {
  return validateShared(row, { requireDerived: true });
}
