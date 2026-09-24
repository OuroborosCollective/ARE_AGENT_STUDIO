/**
 * ForgeAI structured-control policy contract — version 1.
 *
 * This is the SEPARATE structured-control plane for ForgeAI agent participation.
 * It uses the schema `forge-trajectory.v1`, never the frozen visual-control schema.
 * Actions are typed structured commands submitted to the Forge action client,
 * not pixel-space taps.
 *
 * This module must never import or mutate visual-path modules
 * (neuralPolicyEngine, datasetCodec, serverSyncGateway, receiptVerifier).
 * The static guard `scripts/forge_truth_guard.mjs` enforces this.
 *
 * Truth boundaries enforced by this contract:
 *   1. Prediction ≠ submitted action.
 *   2. Submitted action ≠ accepted Forge turn.
 *   3. Local trajectory ≠ externally verified trajectory until Forge readback.
 */

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

export const FORGE_TRAJECTORY_SCHEMA_VERSION = 'forge-trajectory.v1' as const;

// ---------------------------------------------------------------------------
// Typed structured actions (not pixel-space taps)
// ---------------------------------------------------------------------------

export type ForgeActionType =
  | 'navigate'  // navigate to a URL, endpoint, or view
  | 'select'    // select an option, element, or choice
  | 'submit'    // submit a form, request, or action
  | 'query'     // query for information or state
  | 'wait'      // wait for a condition or timeout
  | 'observe'   // observe and record current state
  | 'reason';   // emit reasoning or plan without side effects

export type ForgeRiskTier = 'reversible' | 'external' | 'irreversible';

export type ForgeTrajectoryStatus = 'predicted' | 'submitted' | 'accepted' | 'rejected';

/**
 * A single typed structured command produced by the structured policy.
 * This is NOT a pixel-space tap — it is a semantic action submitted to the
 * Forge action client.
 */
export interface ForgeStructuredAction {
  action_type: ForgeActionType;
  target_ref: string;
  parameters: Record<string, string | number | boolean>;
  action_summary: string;
  parameters_sha256: string;
  risk_tier: ForgeRiskTier;
  rationale: string;
  confidence: number; // [0, 1]
}

/**
 * An observation of the current Forge turn state.
 * The structured policy consumes this and produces a ForgeStructuredAction.
 */
export interface ForgeObservation {
  observation_id: string;
  turn_index: number;
  captured_at_epoch: number;
  state_summary: string;
  available_actions: string[];
  observation_evidence_sha256: string;
}

/**
 * One entry in the append-only Forge trajectory ledger.
 *
 * The three-stage lifecycle is explicit:
 *   predicted  — policy produced an action (no submission yet)
 *   submitted  — action was sent to the Forge action client (may differ from prediction)
 *   accepted   — Forge readback confirmed the turn was accepted
 *   rejected   — Forge readback confirmed the turn was rejected
 *
 * `submitted_action` is null until the action is actually submitted.
 * `accepted` is null until independent Forge readback reconciles the turn.
 */
export interface ForgeTrajectoryEntry {
  schema_version: 'forge-trajectory.v1';
  entry_id: string;
  run_id: string;
  turn_index: number;
  observation: ForgeObservation;
  predicted_action: ForgeStructuredAction;
  submitted_action: ForgeStructuredAction | null;
  accepted: boolean | null;
  status: ForgeTrajectoryStatus;
  policy_revision_sha256: string;
  captured_at_epoch: number;
}

// ---------------------------------------------------------------------------
// Policy contract interface
// ---------------------------------------------------------------------------

/**
 * The versioned structured-control policy contract.
 * A conforming policy takes a ForgeObservation and produces a
 * ForgeStructuredAction. It never touches the visual-control plane.
 */
export interface ForgePolicyContract {
  readonly schema_version: 'forge-trajectory.v1';
  readonly policy_revision_sha256: string;
  predict(observation: ForgeObservation): ForgeStructuredAction;
}

// ---------------------------------------------------------------------------
// Validation and building (follows the operationCorrectionCodec pattern)
// ---------------------------------------------------------------------------

const SHA256_RE = /^[a-f0-9]{64}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const ACTION_TYPE_RE = /^[a-z][a-z0-9._-]{1,79}$/;
const VALID_ACTION_TYPES: readonly ForgeActionType[] = [
  'navigate', 'select', 'submit', 'query', 'wait', 'observe', 'reason',
];
const VALID_RISK_TIERS: readonly ForgeRiskTier[] = ['reversible', 'external', 'irreversible'];

export interface ForgeTrajectoryDraftInput {
  runId: string;
  turnIndex: number;
  observation: {
    observationId: string;
    capturedAtEpoch: number;
    stateSummary: string;
    availableActions: string[];
    observationEvidenceSha256: string;
  };
  predictedAction: {
    actionType: string;
    targetRef: string;
    parameters: Record<string, string | number | boolean>;
    actionSummary: string;
    parametersSha256: string;
    riskTier: ForgeRiskTier;
    rationale: string;
    confidence: number;
  };
  policyRevisionSha256: string;
  capturedAtEpoch: number;
}

function isSummary(value: string | undefined): boolean {
  return typeof value === 'string'
    && Boolean(value.trim())
    && value.length <= 280
    && !/\b(?:api[_-]?key|access[_-]?token|password|secret|private[_-]?key)\b\s*[:=]/i.test(value);
}

export function validateForgeTrajectoryDraft(input: ForgeTrajectoryDraftInput): string[] {
  const errors: string[] = [];

  // Run reference
  if (!REF_RE.test(input.runId)) errors.push('Run reference is required and may only use safe reference characters.');

  // Turn index
  if (!Number.isInteger(input.turnIndex) || input.turnIndex < 0) errors.push('Turn index must be a non-negative integer.');

  // Observation
  if (!REF_RE.test(input.observation.observationId)) errors.push('Observation reference is required and may only use safe reference characters.');
  if (!Number.isInteger(input.observation.capturedAtEpoch) || input.observation.capturedAtEpoch < 0) errors.push('Observation timestamp must be a non-negative integer.');
  if (!isSummary(input.observation.stateSummary)) errors.push('Observation state summary is required, limited to 280 characters, and must not contain credential assignments.');
  if (!Array.isArray(input.observation.availableActions) || !input.observation.availableActions.every((a) => ACTION_TYPE_RE.test(a))) {
    errors.push('Available actions must be an array of stable lowercase identifiers.');
  }
  if (!SHA256_RE.test(input.observation.observationEvidenceSha256)) errors.push('Observation-evidence hash must be a lowercase SHA-256 digest.');

  // Predicted action
  if (!VALID_ACTION_TYPES.includes(input.predictedAction.actionType as ForgeActionType)) {
    errors.push(`Action type must be one of: ${VALID_ACTION_TYPES.join(', ')}.`);
  }
  if (!REF_RE.test(input.predictedAction.targetRef)) errors.push('Action target reference is required and may only use safe reference characters.');
  if (!isSummary(input.predictedAction.actionSummary)) errors.push('Action summary is required, limited to 280 characters, and must not contain credential assignments.');
  if (!SHA256_RE.test(input.predictedAction.parametersSha256)) errors.push('Parameters hash must be a lowercase SHA-256 digest.');
  if (!VALID_RISK_TIERS.includes(input.predictedAction.riskTier)) {
    errors.push(`Risk tier must be one of: ${VALID_RISK_TIERS.join(', ')}.`);
  }
  if (!isSummary(input.predictedAction.rationale)) errors.push('Rationale is required, limited to 280 characters, and must not contain credential assignments.');
  if (typeof input.predictedAction.confidence !== 'number' || input.predictedAction.confidence < 0 || input.predictedAction.confidence > 1) {
    errors.push('Confidence must be a number in [0, 1].');
  }

  // Policy revision
  if (!SHA256_RE.test(input.policyRevisionSha256)) errors.push('Policy revision hash must be a lowercase SHA-256 digest.');

  // Captured timestamp
  if (!Number.isInteger(input.capturedAtEpoch) || input.capturedAtEpoch < 0) errors.push('Captured timestamp must be a non-negative integer.');

  return errors;
}

export function buildForgeTrajectoryDraft(input: ForgeTrajectoryDraftInput): ForgeTrajectoryEntry {
  return {
    schema_version: FORGE_TRAJECTORY_SCHEMA_VERSION,
    entry_id: 'client-placeholder',
    run_id: input.runId,
    turn_index: input.turnIndex,
    observation: {
      observation_id: input.observation.observationId,
      turn_index: input.turnIndex,
      captured_at_epoch: input.observation.capturedAtEpoch,
      state_summary: input.observation.stateSummary,
      available_actions: input.observation.availableActions,
      observation_evidence_sha256: input.observation.observationEvidenceSha256,
    },
    predicted_action: {
      action_type: input.predictedAction.actionType as ForgeActionType,
      target_ref: input.predictedAction.targetRef,
      parameters: input.predictedAction.parameters,
      action_summary: input.predictedAction.actionSummary,
      parameters_sha256: input.predictedAction.parametersSha256,
      risk_tier: input.predictedAction.riskTier,
      rationale: input.predictedAction.rationale,
      confidence: input.predictedAction.confidence,
    },
    submitted_action: null,
    accepted: null,
    status: 'predicted',
    policy_revision_sha256: input.policyRevisionSha256,
    captured_at_epoch: input.capturedAtEpoch,
  };
}

// ---------------------------------------------------------------------------
// Reference deterministic policy implementation
// ---------------------------------------------------------------------------

/**
 * A minimal deterministic structured policy that always selects the first
 * available action. This is a reference implementation for testing and
 * scaffolding — the real Forge runner will supply its own policy.
 *
 * The policy is deterministic: the same observation always produces the same
 * predicted action, given the same policy revision.
 */
export class DeterministicSelectFirstPolicy implements ForgePolicyContract {
  readonly schema_version = FORGE_TRAJECTORY_SCHEMA_VERSION;
  readonly policy_revision_sha256: string;

  constructor(policyRevisionSha256: string) {
    this.policy_revision_sha256 = policyRevisionSha256;
  }

  predict(observation: ForgeObservation): ForgeStructuredAction {
    const firstAction = observation.available_actions[0] || 'observe';
    return {
      action_type: 'select',
      target_ref: firstAction,
      parameters: { turn: observation.turn_index },
      action_summary: `Select the first available action: ${firstAction}.`,
      parameters_sha256: '0'.repeat(64),
      risk_tier: 'reversible',
      rationale: 'Deterministic select-first reference policy.',
      confidence: 1.0,
    };
  }
}
