import type {
  OperationCorrectionDecision,
  OperationCorrectionReasonCode,
  OperationCorrectionRecord,
  OperationLearningConsent,
  OperationRiskTier,
} from '../types';

export const OPERATION_CORRECTION_SCHEMA_VERSION = 'are-agent-operation-correction.v1' as const;
const SHA256_RE = /^[a-f0-9]{64}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const OPERATION_TYPE_RE = /^[a-z][a-z0-9._-]{1,79}$/;

export interface OperationCorrectionDraftInput {
  context: {
    sessionId: string;
    sequenceIndex: number;
    missionId?: string;
    attemptId?: string;
  };
  proposal: {
    proposalId: string;
    operationType: string;
    actionSummary: string;
    targetRef?: string;
    parametersSha256: string;
    policyRevisionSha256: string;
    observationEvidenceSha256: string;
    requestedAtEpoch: number;
    riskTier: OperationRiskTier;
  };
  correction: {
    decision: OperationCorrectionDecision;
    reasonCode: OperationCorrectionReasonCode;
    ownerRef: string;
    rationale?: string;
    correctedActionSummary?: string;
    correctedParametersSha256?: string;
    capturedAtEpoch: number;
  };
  learningAllowed: boolean;
}

function isSummary(value: string | undefined): boolean {
  return typeof value === 'string'
    && Boolean(value.trim())
    && value.length <= 280
    && !/\b(?:api[_-]?key|access[_-]?token|password|secret|private[_-]?key)\b\s*[:=]/i.test(value);
}

export function validateOperationCorrectionDraft(input: OperationCorrectionDraftInput): string[] {
  const errors: string[] = [];
  if (!REF_RE.test(input.context.sessionId)) errors.push('Session reference is required and may only use safe reference characters.');
  if (!Number.isInteger(input.context.sequenceIndex) || input.context.sequenceIndex < 0) errors.push('Sequence index must be a non-negative integer.');
  if (input.context.missionId && !REF_RE.test(input.context.missionId)) errors.push('Mission reference uses unsupported characters.');
  if (input.context.attemptId && !REF_RE.test(input.context.attemptId)) errors.push('Attempt reference uses unsupported characters.');
  if (!REF_RE.test(input.proposal.proposalId)) errors.push('Proposal reference is required and may only use safe reference characters.');
  if (!OPERATION_TYPE_RE.test(input.proposal.operationType)) errors.push('Operation type must be a stable lowercase identifier, such as agent.route.select.');
  if (!isSummary(input.proposal.actionSummary)) errors.push('Action summary is required, limited to 280 characters, and must not contain credential assignments.');
  if (input.proposal.targetRef && !REF_RE.test(input.proposal.targetRef)) errors.push('Target reference uses unsupported characters.');
  for (const [label, hash] of Object.entries({
    'Parameters hash': input.proposal.parametersSha256,
    'Policy revision hash': input.proposal.policyRevisionSha256,
    'Observation-evidence hash': input.proposal.observationEvidenceSha256,
  })) if (!SHA256_RE.test(hash)) errors.push(`${label} must be a lowercase SHA-256 digest.`);
  if (!Number.isInteger(input.proposal.requestedAtEpoch) || input.proposal.requestedAtEpoch < 0) errors.push('Proposal timestamp must be a non-negative integer.');
  if (!REF_RE.test(input.correction.ownerRef)) errors.push('Owner reference is required and may only use safe reference characters.');
  if (input.correction.rationale && !isSummary(input.correction.rationale)) errors.push('Rationale must be limited and must not contain credential assignments.');
  if (!Number.isInteger(input.correction.capturedAtEpoch) || input.correction.capturedAtEpoch < 0) errors.push('Correction timestamp must be a non-negative integer.');
  if (input.correction.decision === 'amend') {
    if (!isSummary(input.correction.correctedActionSummary)) errors.push('An amendment requires a corrected action summary.');
    if (!SHA256_RE.test(input.correction.correctedParametersSha256 || '')) errors.push('An amendment requires a corrected parameters SHA-256 digest.');
  }
  return errors;
}

export function buildOperationCorrectionDraft(input: OperationCorrectionDraftInput): OperationCorrectionRecord {
  const learning: OperationLearningConsent = input.learningAllowed
    ? { allowed: true, basis: 'owner_confirmed' }
    : { allowed: false, basis: 'unreviewed' };
  const correction = {
    decision: input.correction.decision,
    reason_code: input.correction.reasonCode,
    owner_ref: input.correction.ownerRef,
    ...(input.correction.rationale ? { rationale: input.correction.rationale } : {}),
    ...(input.correction.decision === 'amend' ? {
      corrected_action_summary: input.correction.correctedActionSummary || '',
      corrected_parameters_sha256: input.correction.correctedParametersSha256 || '',
    } : {}),
    captured_at_epoch: input.correction.capturedAtEpoch,
  };
  return {
    schema_version: OPERATION_CORRECTION_SCHEMA_VERSION,
    correction_id: 'client-placeholder',
    context: {
      session_id: input.context.sessionId,
      sequence_index: input.context.sequenceIndex,
      mission_id: input.context.missionId || null,
      attempt_id: input.context.attemptId || null,
    },
    proposal: {
      proposal_id: input.proposal.proposalId,
      operation_type: input.proposal.operationType,
      action_summary: input.proposal.actionSummary,
      target_ref: input.proposal.targetRef || null,
      parameters_sha256: input.proposal.parametersSha256,
      policy_revision_sha256: input.proposal.policyRevisionSha256,
      observation_evidence_sha256: input.proposal.observationEvidenceSha256,
      requested_at_epoch: input.proposal.requestedAtEpoch,
      risk_tier: input.proposal.riskTier,
      execution_state: 'not_executed',
    },
    correction,
    learning,
  };
}
