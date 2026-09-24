/**
 * ForgeAI contract discovery, SKILL.md parsing, credential isolation
 * and action client — version 1.
 *
 * This module implements issue #9: the Forge runner's ability to discover
 * a Forge game contract, parse its SKILL.md description, isolate run
 * credentials server-side, and submit structured actions to the Forge
 * action endpoint.
 *
 * This module must never import or mutate visual-path modules
 * (neuralPolicyEngine, datasetCodec, serverSyncGateway, receiptVerifier).
 * The static guard `scripts/forge_truth_guard.mjs` enforces this.
 *
 * Truth boundaries:
 *   1. Credential values are never exposed — only their presence is observable.
 *   2. An action submission result is UNOBSERVABLE until a real Forge endpoint
 *      responds; the client never fabricates acceptance.
 *   3. Practice runs and paid entries are strictly separated.
 */

import type { ForgeStructuredAction, ForgeRiskTier } from './forgeStructuredPolicy';

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

export const FORGE_CONTRACT_SCHEMA_VERSION = 'forge-contract.v1' as const;

// ---------------------------------------------------------------------------
// Validation regexes
// ---------------------------------------------------------------------------

const CONTRACT_REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const ACTION_TYPE_RE = /^[a-z][a-z0-9._-]{1,79}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const VALID_RISK_TIERS: readonly ForgeRiskTier[] = ['reversible', 'external', 'irreversible'];

// ---------------------------------------------------------------------------
// Canonical JSON (deterministic, sorted keys — same algorithm as receiptVerifier
// but self-contained to avoid importing the protected visual-path module)
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
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto SHA-256 is unavailable; contract hash cannot be computed.');
  const bytes = new TextEncoder().encode(data);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Forge contract discovery & SKILL.md parsing
// ---------------------------------------------------------------------------

export interface ForgeContractConstraints {
  max_turns: number | null;
  timeout_seconds: number | null;
  allowed_risk_tiers: ForgeRiskTier[];
  practice_mode: boolean;
}

export interface ForgeContract {
  schema_version: 'forge-contract.v1';
  contract_id: string;
  game_ref: string;
  skill_md_sha256: string;
  available_action_types: string[];
  constraints: ForgeContractConstraints;
  contract_sha256: string;
  discovered_at_epoch: number;
}

export interface ForgeContractDiscoveryInput {
  contractId: string;
  gameRef: string;
  skillMdContent: string;
  availableActionTypes: string[];
  constraints: {
    maxTurns: number | null;
    timeoutSeconds: number | null;
    allowedRiskTiers: ForgeRiskTier[];
    practiceMode: boolean;
  };
  discoveredAtEpoch: number;
}

/**
 * Validate a Forge contract discovery input before building.
 * Checks references, SKILL.md content safety, action types, and constraints.
 */
export function validateForgeContractDiscovery(input: ForgeContractDiscoveryInput): string[] {
  const errors: string[] = [];

  if (!CONTRACT_REF_RE.test(input.contractId)) {
    errors.push('Contract reference is required and may only use safe reference characters.');
  }
  if (!CONTRACT_REF_RE.test(input.gameRef)) {
    errors.push('Game reference is required and may only use safe reference characters.');
  }
  if (typeof input.skillMdContent !== 'string' || input.skillMdContent.trim().length === 0) {
    errors.push('SKILL.md content is required and must not be empty.');
  }
  if (input.skillMdContent.length > 65536) {
    errors.push('SKILL.md content must not exceed 64 KiB.');
  }
  // Credential leak guard: reject if SKILL.md contains credential assignments
  if (/\b(?:api[_-]?key|access[_-]?token|password|secret|private[_-]?key)\b\s*[:=]/i.test(input.skillMdContent)) {
    errors.push('SKILL.md content must not contain credential assignments.');
  }
  if (!Array.isArray(input.availableActionTypes) || input.availableActionTypes.length === 0) {
    errors.push('Available action types must be a non-empty array of stable lowercase identifiers.');
  } else if (!input.availableActionTypes.every((a) => ACTION_TYPE_RE.test(a))) {
    errors.push('Available action types must be stable lowercase identifiers.');
  }
  if (input.constraints.maxTurns !== null && (!Number.isInteger(input.constraints.maxTurns) || input.constraints.maxTurns < 0)) {
    errors.push('Max turns must be null or a non-negative integer.');
  }
  if (input.constraints.timeoutSeconds !== null && (!Number.isInteger(input.constraints.timeoutSeconds) || input.constraints.timeoutSeconds < 0)) {
    errors.push('Timeout seconds must be null or a non-negative integer.');
  }
  if (!Array.isArray(input.constraints.allowedRiskTiers) || !input.constraints.allowedRiskTiers.every((t) => VALID_RISK_TIERS.includes(t))) {
    errors.push('Allowed risk tiers must be a subset of: reversible, external, irreversible.');
  }
  if (typeof input.constraints.practiceMode !== 'boolean') {
    errors.push('Practice mode must be a boolean.');
  }
  if (!Number.isInteger(input.discoveredAtEpoch) || input.discoveredAtEpoch < 0) {
    errors.push('Discovered timestamp must be a non-negative integer.');
  }

  return errors;
}

/**
 * Build a Forge contract from a discovery input.
 * The contract hash is computed over the canonical form of the contract
 * (excluding the hash itself), ensuring tamper-evident integrity.
 */
export async function buildForgeContract(input: ForgeContractDiscoveryInput): Promise<ForgeContract> {
  const skillMdSha256 = await sha256Hex(input.skillMdContent);
  const contractBody = {
    schema_version: FORGE_CONTRACT_SCHEMA_VERSION,
    contract_id: input.contractId,
    game_ref: input.gameRef,
    skill_md_sha256: skillMdSha256,
    available_action_types: input.availableActionTypes,
    constraints: {
      max_turns: input.constraints.maxTurns,
      timeout_seconds: input.constraints.timeoutSeconds,
      allowed_risk_tiers: input.constraints.allowedRiskTiers,
      practice_mode: input.constraints.practiceMode,
    },
    discovered_at_epoch: input.discoveredAtEpoch,
  };
  const contractSha256 = await sha256Hex(canonicalJson(contractBody));
  return {
    ...contractBody,
    contract_sha256: contractSha256,
  };
}

/**
 * Verify that a contract's hash matches its content.
 * Returns true if the contract is intact, false if tampered.
 */
export async function verifyForgeContractIntegrity(contract: ForgeContract): Promise<boolean> {
  const { contract_sha256, ...body } = contract;
  const computed = await sha256Hex(canonicalJson(body));
  return computed === contract_sha256;
}

// ---------------------------------------------------------------------------
// Credential isolation — server-side vault
// ---------------------------------------------------------------------------

/**
 * A server-side credential vault for Forge run credentials.
 *
 * Credentials are stored in memory only and never serialized.
 * The vault exposes:
 *   - `hasCredentials()` — whether credentials are present (observable)
 *   - `getAuthHeader()` — an Authorization header for server-side fetch only
 *
 * Credential VALUES are never exposed to the client, browser, Git, or logs.
 * Only their presence is observable.
 */
export class ForgeCredentialVault {
  private readonly credential: string | null;
  private readonly runId: string;

  constructor(runId: string, credential: string | null) {
    this.runId = runId;
    this.credential = credential;
  }

  /** Returns true if a credential is present. Never exposes the value. */
  hasCredentials(): boolean {
    return this.credential !== null && this.credential.length > 0;
  }

  /** Returns the run ID this vault is scoped to. */
  getRunId(): string {
    return this.runId;
  }

  /**
   * Returns an Authorization header value for server-side use only.
   * Throws if no credential is present — the caller must check hasCredentials().
   * This method must never be called from browser/client code.
   */
  getAuthHeader(): string {
    if (!this.credential) {
      throw new Error('ForgeCredentialVault: no credential present — cannot build auth header.');
    }
    return `Bearer ${this.credential}`;
  }
}

// ---------------------------------------------------------------------------
// Action client — submits structured actions to the Forge endpoint
// ---------------------------------------------------------------------------

export type ForgeSubmissionOutcome = 'accepted' | 'rejected' | 'unobservable';

export interface ForgeActionSubmissionResult {
  outcome: ForgeSubmissionOutcome;
  turn_index: number;
  action_type: string;
  target_ref: string;
  submitted_action: ForgeStructuredAction | null;
  forge_receipt_id: string | null;
  error_message: string | null;
  submitted_at_epoch: number;
}

/**
 * The Forge action client submits structured actions to the Forge action
 * endpoint and returns a submission result.
 *
 * If no real Forge endpoint is configured, the outcome is `unobservable` —
 * the client NEVER fabricates acceptance or rejection.
 *
 * The client uses the credential vault for authentication but never
 * exposes credentials in the result or logs.
 */
export class ForgeActionClient {
  private readonly vault: ForgeCredentialVault;
  private readonly endpoint: string | null;

  constructor(vault: ForgeCredentialVault, endpoint: string | null) {
    this.vault = vault;
    this.endpoint = endpoint;
  }

  /**
   * Submit a structured action to the Forge endpoint.
   *
   * Returns a ForgeActionSubmissionResult. If no endpoint is configured,
   * the outcome is `unobservable` and `submitted_action` is null.
   *
   * This is a synchronous contract method — the real runner will provide
   * an async implementation that performs the actual HTTP request.
   * The contract here defines the shape and truth boundaries.
   */
  submitAction(action: ForgeStructuredAction, turnIndex: number, submittedAtEpoch: number): ForgeActionSubmissionResult {
    if (!this.endpoint) {
      return {
        outcome: 'unobservable',
        turn_index: turnIndex,
        action_type: action.action_type,
        target_ref: action.target_ref,
        submitted_action: null,
        forge_receipt_id: null,
        error_message: 'No Forge endpoint configured — submission is unobservable.',
        submitted_at_epoch: submittedAtEpoch,
      };
    }

    if (!this.vault.hasCredentials()) {
      return {
        outcome: 'unobservable',
        turn_index: turnIndex,
        action_type: action.action_type,
        target_ref: action.target_ref,
        submitted_action: null,
        forge_receipt_id: null,
        error_message: 'No Forge credentials present — submission is unobservable.',
        submitted_at_epoch: submittedAtEpoch,
      };
    }

    // The real implementation would perform an HTTP request here.
    // For the contract, we return unobservable because the actual
    // Forge response is not available in this scaffolding.
    return {
      outcome: 'unobservable',
      turn_index: turnIndex,
      action_type: action.action_type,
      target_ref: action.target_ref,
      submitted_action: null,
      forge_receipt_id: null,
      error_message: 'Forge endpoint configured but no real response available in scaffolding.',
      submitted_at_epoch: submittedAtEpoch,
    };
  }
}
