import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(root, '.core-test-build');
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
fs.rmSync(out, { recursive: true, force: true });
const sourceFiles = [
  'types.ts', 'constants.ts', 'services/neuralPolicyEngine.ts', 'services/datasetCodec.ts', 'services/receiptVerifier.ts', 'services/operationCorrectionCodec.ts',
  'services/forgeStructuredPolicy.ts',
  'services/forgeContractClient.ts',
];
for (const sourceFile of sourceFiles) {
  const sourcePath = path.join(root, sourceFile);
  const compiled = esbuild.transformSync(fs.readFileSync(sourcePath, 'utf8'), {
    loader: 'ts', format: 'cjs', target: 'es2022', sourcefile: sourceFile,
  });
  const outputPath = path.join(out, sourceFile.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, compiled.code);
}
fs.writeFileSync(path.join(out, 'package.json'), '{"type":"commonjs"}');
const { NeuralPolicyEngine } = require(path.join(out, 'services/neuralPolicyEngine.js'));
const { telemetryToDatasetRows, datasetRowsToJsonl } = require(path.join(out, 'services/datasetCodec.js'));
const { canonicalJson, verifyDatasetReceipt, verifyOperationCorrectionReceipt } = require(path.join(out, 'services/receiptVerifier.js'));
const { buildOperationCorrectionDraft, validateOperationCorrectionDraft } = require(path.join(out, 'services/operationCorrectionCodec.js'));
const { validateForgeTrajectoryDraft, buildForgeTrajectoryDraft, DeterministicSelectFirstPolicy, FORGE_TRAJECTORY_SCHEMA_VERSION } = require(path.join(out, 'services/forgeStructuredPolicy.js'));
const { validateForgeContractDiscovery, buildForgeContract, verifyForgeContractIntegrity, ForgeCredentialVault, ForgeActionClient, FORGE_CONTRACT_SCHEMA_VERSION } = require(path.join(out, 'services/forgeContractClient.js'));
const nodeCrypto = require('node:crypto');
const { GameArchetype, TouchEventType } = require(path.join(out, 'types.js'));

const a = new NeuralPolicyEngine('regression-seed', false);
const b = new NeuralPolicyEngine('regression-seed', false);
assert.equal(a.exportWeightsJSON(), b.exportWeightsJSON(), 'same seed must initialize byte-identical weights');
const features = a.extractStructuredFeatures(0.2, 0.8, 2, 0.9, 0.7, 1);
assert.deepEqual(a.forward(features).prediction, b.forward(features).prediction, 'same seed must produce identical forward output');

const target = [0.8, 0.2, 0.75, 1.0];
const before = a.trainStep(features, target).loss;
let after = before;
for (let i = 0; i < 20; i++) after = a.trainStep(features, target).loss;
assert.ok(Number.isFinite(after), 'training loss must remain finite');
assert.ok(after < before, `training on one observed pair should reduce loss (${before} -> ${after})`);

const frame = 'data:image/png;base64,' + Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');
const telemetry = {
  frameId: 7, timestamp: 1234, imageDataUrl: frame,
  action: { id: 'touch-1', timestamp: 1234, x: 0.25, y: 0.75, type: TouchEventType.DOWN, pressure: 0.8, durationMs: 65 },
  gameState: 'COMBAT', hpPercentage: 90, manaPercentage: 70, enemiesDetected: 2,
  genre: GameArchetype.FPS, clientId: 'test-client', sessionId: 'test-session', featureVector: new Array(16).fill(0.5),
};
const rows = telemetryToDatasetRows([telemetry, { ...telemetry, frameId: 8, action: null }], [], 'test-device');
assert.equal(rows.length, 1, 'only observed action/frame pairs may become dataset rows');
assert.equal(rows[0].input_frame_base64, frame, 'frame payload must not be truncated');
assert.deepEqual(rows[0].target_action_chunk, [[0.25, 0.75, 0.8, 1]], 'serializer must not fabricate future actions');
assert.equal(rows[0].source, 'human_demo');
assert.equal(rows[0].client_metadata.session_id, 'test-session', 'dataset row must preserve the capture session');
assert.equal(rows[0].client_metadata.sequence_index, 7, 'dataset row must preserve the capture sequence index');
assert.deepEqual(rows[0].state_mask, [1, 1, 1, 1, 1, 1], 'known detector state should be marked observed');
assert.equal(rows[0].publication.allowed, false, 'public publication must default to denied');
assert.equal(datasetRowsToJsonl(rows).split('\n').length, 1);
const upRows = telemetryToDatasetRows([{ ...telemetry, frameId: 9, action: { ...telemetry.action, id: 'touch-up', type: TouchEventType.UP } }], [], 'test-device');
assert.deepEqual(upRows[0].target_action_chunk, [[0.25, 0.75, 0.8, 0]], 'TOUCH_UP must be encoded as touch=0');

const receiptBody = {
  receipt_version: 'are-agent-receipt.v1', accepted_at: new Date(0).toISOString(), client_id: 'test-client',
  requested_rows: 1, accepted_rows: 1, duplicate_rows: 0, accepted_sample_ids: ['a'.repeat(64)], ledger_sha256: 'b'.repeat(64),
};
const receipt = { ...receiptBody, receipt_sha256: nodeCrypto.createHash('sha256').update(canonicalJson(receiptBody)).digest('hex') };
assert.equal((await verifyDatasetReceipt(receipt, 1)).receipt_sha256, receipt.receipt_sha256, 'receipt verifier must accept a canonical matching SHA-256');
await assert.rejects(() => verifyDatasetReceipt({ ...receipt, accepted_rows: 0 }, 1), /inconsistent|accepted_sample_ids|SHA-256/, 'tampered receipt must fail closed');

const operationCorrectionInput = {
  context: { sessionId: 'session-test', sequenceIndex: 4, missionId: 'mission-test', attemptId: 'attempt-test' },
  proposal: {
    proposalId: 'proposal-test', operationType: 'agent.route.select', actionSummary: 'Select the reviewed route candidate.', targetRef: 'route/test',
    parametersSha256: 'c'.repeat(64), policyRevisionSha256: 'd'.repeat(64), observationEvidenceSha256: 'e'.repeat(64), requestedAtEpoch: 10, riskTier: 'external',
  },
  correction: { decision: 'reject', reasonCode: 'MISSING_EVIDENCE', ownerRef: 'owner-test', capturedAtEpoch: 11 },
  learningAllowed: false,
};
assert.deepEqual(validateOperationCorrectionDraft(operationCorrectionInput), [], 'complete non-secret operation correction input must validate');
const operationCorrection = buildOperationCorrectionDraft(operationCorrectionInput);
assert.equal(operationCorrection.proposal.execution_state, 'not_executed', 'operation correction records must never claim execution');
assert.deepEqual(operationCorrection.learning, { allowed: false, basis: 'unreviewed' }, 'offline learning must default to denied');
const amended = buildOperationCorrectionDraft({
  ...operationCorrectionInput,
  correction: { ...operationCorrectionInput.correction, decision: 'amend', correctedActionSummary: 'Use the reviewed route.', correctedParametersSha256: 'f'.repeat(64) },
  learningAllowed: true,
});
assert.equal(amended.learning.basis, 'owner_confirmed', 'learning must require explicit owner confirmation');
assert.equal(amended.correction.corrected_parameters_sha256, 'f'.repeat(64), 'amendment must preserve only a parameter digest');
assert.match(validateOperationCorrectionDraft({ ...operationCorrectionInput, proposal: { ...operationCorrectionInput.proposal, observationEvidenceSha256: 'not-a-hash' } })[0], /Observation-evidence hash/, 'unbound evidence must fail preflight');

const operationReceiptBody = {
  receipt_version: 'are-agent-operation-correction-receipt.v1', accepted_at: new Date(0).toISOString(), client_id: 'test-client',
  requested_rows: 1, accepted_rows: 1, duplicate_rows: 0, accepted_correction_ids: ['c'.repeat(64)], ledger_sha256: 'd'.repeat(64),
};
const operationReceipt = { ...operationReceiptBody, receipt_sha256: nodeCrypto.createHash('sha256').update(canonicalJson(operationReceiptBody)).digest('hex') };
assert.equal((await verifyOperationCorrectionReceipt(operationReceipt, 1)).receipt_sha256, operationReceipt.receipt_sha256, 'operation correction receipt must verify against its canonical body');
await assert.rejects(() => verifyOperationCorrectionReceipt({ ...operationReceipt, accepted_correction_ids: [] }, 1), /accepted_correction_ids|SHA-256/, 'tampered operation correction receipt must fail closed');

// --- Forge structured-control policy contract (forge-trajectory.v1) ---

const forgeTrajectoryInput = {
  runId: 'forge-run-001',
  turnIndex: 0,
  observation: {
    observationId: 'obs-001',
    capturedAtEpoch: 1000,
    stateSummary: 'Forge turn 0: three route options available.',
    availableActions: ['forge.route.a', 'forge.route.b', 'forge.route.c'],
    observationEvidenceSha256: 'a'.repeat(64),
  },
  predictedAction: {
    actionType: 'select',
    targetRef: 'forge.route.a',
    parameters: { route: 'a' },
    actionSummary: 'Select the first reviewed route candidate.',
    parametersSha256: 'b'.repeat(64),
    riskTier: 'reversible',
    rationale: 'Lowest-risk route per deterministic policy.',
    confidence: 0.9,
  },
  policyRevisionSha256: 'c'.repeat(64),
  capturedAtEpoch: 1001,
};
assert.deepEqual(validateForgeTrajectoryDraft(forgeTrajectoryInput), [], 'complete non-secret forge trajectory input must validate');
const forgeEntry = buildForgeTrajectoryDraft(forgeTrajectoryInput);
assert.equal(forgeEntry.schema_version, FORGE_TRAJECTORY_SCHEMA_VERSION, 'forge trajectory must use the forge-trajectory.v1 schema, never the frozen visual-control schema');
assert.equal(forgeEntry.status, 'predicted', 'a new trajectory entry must start as predicted, not submitted or accepted');
assert.equal(forgeEntry.submitted_action, null, 'submitted action must be null until the action is actually submitted to Forge');
assert.equal(forgeEntry.accepted, null, 'accepted must be null until independent Forge readback reconciles the turn');
assert.equal(forgeEntry.predicted_action.action_type, 'select', 'structured actions are typed commands, not pixel-space taps');
assert.equal(forgeEntry.run_id, 'forge-run-001', 'trajectory entry must preserve the run reference');
assert.deepEqual(forgeEntry.observation.available_actions, ['forge.route.a', 'forge.route.b', 'forge.route.c'], 'observation must preserve available actions');

// Prediction ≠ submitted action: the entry starts with only a prediction
assert.ok(forgeEntry.predicted_action !== null && forgeEntry.submitted_action === null, 'prediction must exist before any submission');

// Invalid inputs must fail validation
assert.ok(validateForgeTrajectoryDraft({ ...forgeTrajectoryInput, predictedAction: { ...forgeTrajectoryInput.predictedAction, actionType: 'tap_pixel' } }).length > 0, 'pixel-space action types must be rejected');
assert.ok(validateForgeTrajectoryDraft({ ...forgeTrajectoryInput, predictedAction: { ...forgeTrajectoryInput.predictedAction, confidence: 1.5 } }).length > 0, 'confidence above 1 must be rejected');
assert.ok(validateForgeTrajectoryDraft({ ...forgeTrajectoryInput, observation: { ...forgeTrajectoryInput.observation, observationEvidenceSha256: 'not-a-hash' } }).length > 0, 'invalid observation evidence hash must be rejected');
assert.ok(validateForgeTrajectoryDraft({ ...forgeTrajectoryInput, policyRevisionSha256: 'short' }).length > 0, 'invalid policy revision hash must be rejected');

// Deterministic reference policy
const policy = new DeterministicSelectFirstPolicy('d'.repeat(64));
const policyPrediction = policy.predict(forgeEntry.observation);
assert.equal(policyPrediction.action_type, 'select', 'deterministic select-first policy must produce a select action');
assert.equal(policyPrediction.target_ref, 'forge.route.a', 'deterministic select-first policy must select the first available action');
assert.equal(policy.policy_revision_sha256, 'd'.repeat(64), 'policy must expose its revision hash');
assert.equal(policy.schema_version, FORGE_TRAJECTORY_SCHEMA_VERSION, 'policy contract must declare the forge-trajectory.v1 schema');

// --- ForgeAI contract discovery, SKILL.md parsing, credential isolation & action client (#9) ---

const contractInput = {
  contractId: 'forge-contract-001',
  gameRef: 'forge.game.example',
  skillMdContent: '# SKILL.md\n\nNavigate the Forge evaluation environment.\n\nAvailable actions: navigate, select, submit, query.',
  availableActionTypes: ['navigate', 'select', 'submit', 'query'],
  constraints: { maxTurns: 100, timeoutSeconds: 3600, allowedRiskTiers: ['reversible', 'external'], practiceMode: true },
  discoveredAtEpoch: 2000,
};
assert.deepEqual(validateForgeContractDiscovery(contractInput), [], 'complete non-secret forge contract input must validate');
const contract = await buildForgeContract(contractInput);
assert.equal(contract.schema_version, FORGE_CONTRACT_SCHEMA_VERSION, 'contract must use the forge-contract.v1 schema');
assert.equal(contract.contract_id, 'forge-contract-001', 'contract must preserve the contract reference');
assert.equal(contract.constraints.practice_mode, true, 'contract must preserve practice mode flag');
assert.deepEqual(contract.constraints.allowed_risk_tiers, ['reversible', 'external'], 'contract must preserve allowed risk tiers');
assert.match(contract.skill_md_sha256, /^[a-f0-9]{64}$/, 'SKILL.md hash must be a SHA-256 digest');
assert.match(contract.contract_sha256, /^[a-f0-9]{64}$/, 'contract hash must be a SHA-256 digest');
assert.ok(await verifyForgeContractIntegrity(contract), 'untampered contract must verify its integrity hash');

// Tampered contract must fail integrity check
const tamperedContract = { ...contract, game_ref: 'forge.game.tampered' };
assert.ok(!(await verifyForgeContractIntegrity(tamperedContract)), 'tampered contract must fail integrity check');

// Credential leak in SKILL.md must be rejected
assert.ok(validateForgeContractDiscovery({ ...contractInput, skillMdContent: 'api_key=abc123' }).length > 0, 'SKILL.md with credential assignment must be rejected');
// Empty SKILL.md must be rejected
assert.ok(validateForgeContractDiscovery({ ...contractInput, skillMdContent: '' }).length > 0, 'empty SKILL.md must be rejected');
// Invalid action types must be rejected
assert.ok(validateForgeContractDiscovery({ ...contractInput, availableActionTypes: ['Navigate'] }).length > 0, 'non-lowercase action types must be rejected');

// Credential vault: presence is observable, value is never exposed
const vaultWithCred = new ForgeCredentialVault('forge-run-001', 'secret-token-value');
assert.equal(vaultWithCred.hasCredentials(), true, 'vault with credential must report presence');
assert.equal(vaultWithCred.getRunId(), 'forge-run-001', 'vault must expose run ID');
const vaultEmpty = new ForgeCredentialVault('forge-run-002', null);
assert.equal(vaultEmpty.hasCredentials(), false, 'vault without credential must report absence');
assert.throws(() => vaultEmpty.getAuthHeader(), /no credential/, 'vault without credential must throw on getAuthHeader');

// Action client: no endpoint → unobservable, never fabricated
const clientNoEndpoint = new ForgeActionClient(vaultWithCred, null);
const resultNoEndpoint = clientNoEndpoint.submitAction(forgeEntry.predicted_action, 0, 2001);
assert.equal(resultNoEndpoint.outcome, 'unobservable', 'action client without endpoint must return unobservable, never fabricated');
assert.equal(resultNoEndpoint.submitted_action, null, 'unobservable result must not carry a submitted action');
assert.equal(resultNoEndpoint.forge_receipt_id, null, 'unobservable result must not carry a forge receipt id');

// Action client: no credentials → unobservable
const clientNoCreds = new ForgeActionClient(vaultEmpty, 'https://forge.example/api');
const resultNoCreds = clientNoCreds.submitAction(forgeEntry.predicted_action, 0, 2002);
assert.equal(resultNoCreds.outcome, 'unobservable', 'action client without credentials must return unobservable');
assert.equal(resultNoCreds.error_message, 'No Forge credentials present — submission is unobservable.', 'must explain the unobservable reason');

// Action client: endpoint + credentials but no real Forge → still unobservable (scaffolding)
const clientScaffold = new ForgeActionClient(vaultWithCred, 'https://forge.example/api');
const resultScaffold = clientScaffold.submitAction(forgeEntry.predicted_action, 0, 2003);
assert.equal(resultScaffold.outcome, 'unobservable', 'scaffolding action client must never fabricate acceptance');
assert.equal(resultScaffold.submitted_action, null, 'scaffolding result must not carry a submitted action');

console.log('frontend core regressions: 58 assertions passed');
