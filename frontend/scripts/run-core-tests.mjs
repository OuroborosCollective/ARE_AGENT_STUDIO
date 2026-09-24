import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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
  'services/forgeTrajectoryStore.ts',
  'services/forgeReconciliation.ts',
  'services/forgeLearningEligibility.ts',
  'services/forgeTrainingReceipt.ts',
  'services/forgeRightsGate.ts',
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
const { ForgeTrajectoryStore, validateForgeTrajectoryRecord, FORGE_TRAJECTORY_LEDGER_SCHEMA_VERSION } = require(path.join(out, 'services/forgeTrajectoryStore.js'));
const { validateForgeReconciliationInput, buildForgeReconciliationReceipt, verifyReconciliationIntegrity, computeReconciliationVerdict, FORGE_RECONCILIATION_SCHEMA_VERSION } = require(path.join(out, 'services/forgeReconciliation.js'));
const { checkLearningEligibility, LEARNING_RECONCILIATION_THRESHOLD, buildForgeCorrection, validateForgeCorrectionInput, verifyCorrectionIntegrity, splitEpisodes, buildPolicyRevisionManifest, validatePolicyRevisionManifestInput, verifyPolicyRevisionManifestIntegrity, FORGE_LEARNING_SCHEMA_VERSION, FORGE_CORRECTION_SCHEMA_VERSION, FORGE_POLICY_MANIFEST_SCHEMA_VERSION } = require(path.join(out, 'services/forgeLearningEligibility.js'));
const { buildTrainingReceipt, validateTrainingReceiptInput, verifyTrainingReceiptIntegrity, buildEvaluationReceipt, validateEvaluationReceiptInput, verifyEvaluationReceiptIntegrity, buildForgeModelCard, validateModelCardInput, verifyModelCardIntegrity, FORGE_TRAINING_RECEIPT_SCHEMA_VERSION, FORGE_EVALUATION_RECEIPT_SCHEMA_VERSION, FORGE_MODEL_CARD_SCHEMA_VERSION } = require(path.join(out, 'services/forgeTrainingReceipt.js'));
const { buildForgeRightsRecord, validateRightsRecordInput, verifyRightsRecordIntegrity, classifyFieldsForPublication, assertPublicationAllowed, ALL_RIGHTS_CATEGORIES, FORGE_RIGHTS_RECORD_SCHEMA_VERSION } = require(path.join(out, 'services/forgeRightsGate.js'));
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

// --- ForgeAI append-only trajectory ledger, receipts & tamper detection (#10) ---

const trajDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-traj-test-'));
const trajStore = new ForgeTrajectoryStore({ dataDir: trajDir });

const trajInput = {
  runId: 'forge-run-001',
  dungeonId: 'forge-dungeon-001',
  turnIndex: 0,
  contractSha256: 'a'.repeat(64),
  skillMdSha256: 'b'.repeat(64),
  observationRef: 'obs-001',
  observationSha256: 'c'.repeat(64),
  allowedActionsSha256: 'd'.repeat(64),
  policyRevisionSha256: 'e'.repeat(64),
  policyConfigSha256: 'f'.repeat(64),
  decisionCandidateSha256: '1'.repeat(64),
  submittedAction: 'select route A',
  submittedActionSha256: '2'.repeat(64),
  requestId: 'req-001',
  httpStatusCategory: '2xx',
  forgeResponseRef: 'forge-receipt-001',
  forgeResponseSha256: '3'.repeat(64),
  localTimestampEpoch: 3000,
  forgeTimestampEpoch: 3001,
  status: 'accepted',
};
assert.deepEqual(validateForgeTrajectoryRecord(trajInput), [], 'complete trajectory record input must validate');
const trajReceipt = await trajStore.append(trajInput);
assert.equal(trajReceipt.duplicate, false, 'first append must not be a duplicate');
assert.match(trajReceipt.receipt_sha256, /^[a-f0-9]{64}$/, 'trajectory receipt hash must be a SHA-256 digest');

const trajRecords = await trajStore.getRecords();
assert.equal(trajRecords.length, 1, 'store must contain one record after first append');
assert.equal(trajRecords[0].run_id, 'forge-run-001', 'record must preserve run ID');
assert.equal(trajRecords[0].schema_version, FORGE_TRAJECTORY_LEDGER_SCHEMA_VERSION, 'record must use the forge trajectory ledger schema');
assert.equal(trajRecords[0].previous_record_sha256, '0'.repeat(64), 'first record must have genesis previous hash');
assert.equal(trajRecords[0].record_sha256, trajRecords[0].record_id, 'record_id must equal record_sha256');

// Idempotent duplicate append
const dupReceipt = await trajStore.append(trajInput);
assert.equal(dupReceipt.duplicate, true, 'duplicate append must be detected by request_id');
assert.equal(dupReceipt.record_id, trajReceipt.record_id, 'duplicate receipt must reference the original record');

// Second record — hash chain
const trajInput2 = { ...trajInput, turnIndex: 1, requestId: 'req-002', localTimestampEpoch: 3002 };
const trajReceipt2 = await trajStore.append(trajInput2);
assert.equal(trajReceipt2.duplicate, false, 'second append must not be a duplicate');
const trajRecords2 = await trajStore.getRecords();
assert.equal(trajRecords2.length, 2, 'store must contain two records after second append');
assert.equal(trajRecords2[1].previous_record_sha256, trajRecords2[0].record_sha256, 'second record must chain to first record hash');

// PENDING_RECONCILIATION for ambiguous network failure
const pendingInput = { ...trajInput, turnIndex: 2, requestId: 'req-003', httpStatusCategory: 'network_error', status: 'pending_reconciliation' };
const pendingReceipt = await trajStore.append(pendingInput);
assert.equal(pendingReceipt.duplicate, false, 'pending reconciliation append must not be a duplicate');
const pendingRecords = await trajStore.getRecordsByRun('forge-run-001');
assert.equal(pendingRecords[2].status, 'pending_reconciliation', 'network error record must be pending reconciliation');

// Credential redaction — validation rejects credential patterns
assert.ok(validateForgeTrajectoryRecord({ ...trajInput, requestId: 'req-004', submittedAction: 'api_key=secret123' }).length > 0, 'submitted action with credential assignment must be rejected');

// Tamper detection — modify a historical record and verify startup rejects
const ledgerText = fs.readFileSync(path.join(trajDir, 'forge-trajectory.jsonl'), 'utf8');
const trajLines = ledgerText.trim().split('\n');
const tamperedRow = JSON.parse(trajLines[0]);
tamperedRow.run_id = 'tampered-run';
trajLines[0] = JSON.stringify(tamperedRow);
fs.writeFileSync(path.join(trajDir, 'forge-trajectory.jsonl'), trajLines.join('\n') + '\n', 'utf8');
const tamperedStore = new ForgeTrajectoryStore({ dataDir: trajDir });
await assert.rejects(() => tamperedStore.init(), /hash mismatch|tamper|chain/, 'tampered ledger must be rejected on startup');

// No effect on VLA dataset counters — trajectory store has its own schema
const trajStats = await trajStore.stats();
assert.equal(trajStats.schema_version, FORGE_TRAJECTORY_LEDGER_SCHEMA_VERSION, 'trajectory store must use its own schema, not the VLA schema');
assert.equal(trajStats.record_count, 3, 'trajectory store must report its own record count independent of VLA counters');

fs.rmSync(trajDir, { recursive: true, force: true });

// --- ForgeAI terminal trajectory reconciliation against ForgeAI readback (#12) ---

const reconInput = {
  runId: 'forge-run-001',
  localTrajectoryRootHash: 'a'.repeat(64),
  forgeEndpointRefs: ['https://forge.ai/api/runs/forge-run-001'],
  forgeResponseHashes: ['b'.repeat(64)],
  comparedFields: [
    { field: 'run_status', local_value: 'terminal', forge_value: 'terminal', match: true },
    { field: 'turn_count', local_value: '3', forge_value: '3', match: true },
    { field: 'score', local_value: null, forge_value: null, match: null },
  ],
  coverageStatement: 'Run status and turn count were independently observed and matched. Score was not exposed by the Forge endpoint.',
  reconciliationCodeRevision: 'c'.repeat(64),
  reconciledAtEpoch: 4000,
};
assert.deepEqual(validateForgeReconciliationInput(reconInput), [], 'complete reconciliation input must validate');
const reconReceipt = await buildForgeReconciliationReceipt(reconInput);
assert.equal(reconReceipt.schema_version, FORGE_RECONCILIATION_SCHEMA_VERSION, 'reconciliation must use the forge-reconciliation.v1 schema');
assert.equal(reconReceipt.verdict, 'PARTIAL', 'mixed match/unobservable fields must yield PARTIAL verdict');
assert.equal(reconReceipt.run_id, 'forge-run-001', 'reconciliation receipt must preserve run ID');
assert.match(reconReceipt.receipt_sha256, /^[a-f0-9]{64}$/, 'reconciliation receipt hash must be a SHA-256 digest');
assert.equal(reconReceipt.reconciliation_id, reconReceipt.receipt_sha256, 'reconciliation ID must equal receipt hash');
assert.ok(await verifyReconciliationIntegrity(reconReceipt), 'untampered reconciliation receipt must verify its integrity');

// VERIFIED verdict: all fields observed and matched
const verifiedInput = { ...reconInput, comparedFields: [
  { field: 'run_status', local_value: 'terminal', forge_value: 'terminal', match: true },
  { field: 'turn_count', local_value: '3', forge_value: '3', match: true },
], coverageStatement: 'All declared verification fields were independently observed and matched.' };
const verifiedReceipt = await buildForgeReconciliationReceipt(verifiedInput);
assert.equal(verifiedReceipt.verdict, 'VERIFIED', 'all fields matched must yield VERIFIED verdict');

// MISMATCH verdict: at least one field observed and differs
const mismatchInput = { ...reconInput, comparedFields: [
  { field: 'run_status', local_value: 'terminal', forge_value: 'running', match: false },
  { field: 'turn_count', local_value: '3', forge_value: '3', match: true },
], coverageStatement: 'Run status mismatched: local terminal vs Forge running.' };
const mismatchReceipt = await buildForgeReconciliationReceipt(mismatchInput);
assert.equal(mismatchReceipt.verdict, 'MISMATCH', 'field mismatch must yield MISMATCH verdict');

// UNOBSERVABLE verdict: all fields unobservable
const unobservableInput = { ...reconInput, comparedFields: [
  { field: 'score', local_value: null, forge_value: null, match: null },
  { field: 'replay', local_value: null, forge_value: null, match: null },
], coverageStatement: 'No fields were independently observable from the Forge endpoint.' };
const unobservableReceipt = await buildForgeReconciliationReceipt(unobservableInput);
assert.equal(unobservableReceipt.verdict, 'UNOBSERVABLE', 'all fields unobservable must yield UNOBSERVABLE verdict');

// Tampered receipt must fail integrity check
const tamperedRecon = { ...reconReceipt, verdict: 'VERIFIED' };
assert.ok(!(await verifyReconciliationIntegrity(tamperedRecon)), 'tampered reconciliation receipt must fail integrity check');

// computeReconciliationVerdict pure function
assert.equal(computeReconciliationVerdict([{ field: 'a', local_value: '1', forge_value: '1', match: true }]), 'VERIFIED', 'all matched → VERIFIED');
assert.equal(computeReconciliationVerdict([{ field: 'a', local_value: '1', forge_value: '2', match: false }]), 'MISMATCH', 'any mismatch → MISMATCH');
assert.equal(computeReconciliationVerdict([{ field: 'a', local_value: null, forge_value: null, match: null }]), 'UNOBSERVABLE', 'all null → UNOBSERVABLE');
assert.equal(computeReconciliationVerdict([]), 'UNPROVABLE', 'empty → UNPROVABLE');

// --- ForgeAI terminal-run-only offline learning & DAgger-style corrections (#13) ---

// Learning eligibility: all conditions met → eligible
const eligibleInput = {
  runId: 'forge-run-001',
  trajectoryValidates: true,
  terminalStatusImmutable: true,
  reconciliationVerdict: 'VERIFIED',
  rightsAllowsTraining: true,
  hasUnresolvedQuarantine: false,
};
const eligibleResult = checkLearningEligibility(eligibleInput, 5000);
assert.equal(eligibleResult.eligible, true, 'all conditions met must yield eligible');
assert.equal(eligibleResult.reasons.length, 0, 'eligible run must have no reasons');
assert.equal(eligibleResult.run_id, 'forge-run-001', 'eligibility result must preserve run ID');

// Learning eligibility: quarantine blocks learning
const quarantinedResult = checkLearningEligibility({ ...eligibleInput, hasUnresolvedQuarantine: true }, 5001);
assert.equal(quarantinedResult.eligible, false, 'unresolved quarantine must block learning');
assert.ok(quarantinedResult.reasons.some((r) => r.includes('quarantine')), 'must report quarantine as blocking reason');

// Learning eligibility: MISMATCH verdict blocks learning (below threshold)
const mismatchEligibility = checkLearningEligibility({ ...eligibleInput, reconciliationVerdict: 'MISMATCH' }, 5002);
assert.equal(mismatchEligibility.eligible, false, 'MISMATCH verdict must block learning');
assert.ok(mismatchEligibility.reasons.some((r) => r.includes('MISMATCH')), 'must report verdict below threshold');

// Learning eligibility: UNOBSERVABLE verdict blocks learning
const unobservableEligibility = checkLearningEligibility({ ...eligibleInput, reconciliationVerdict: 'UNOBSERVABLE' }, 5003);
assert.equal(unobservableEligibility.eligible, false, 'UNOBSERVABLE verdict must block learning');

// Learning eligibility: PARTIAL verdict allows learning (meets threshold)
const partialEligibility = checkLearningEligibility({ ...eligibleInput, reconciliationVerdict: 'PARTIAL' }, 5004);
assert.equal(partialEligibility.eligible, true, 'PARTIAL verdict must allow learning (meets threshold)');

// Learning eligibility: non-immutable terminal status blocks learning
const nonTerminalResult = checkLearningEligibility({ ...eligibleInput, terminalStatusImmutable: false }, 5005);
assert.equal(nonTerminalResult.eligible, false, 'non-immutable terminal status must block learning');

// Learning eligibility: rights denied blocks learning
const rightsDenied = checkLearningEligibility({ ...eligibleInput, rightsAllowsTraining: false }, 5006);
assert.equal(rightsDenied.eligible, false, 'rights denied must block learning');

// Learning eligibility: trajectory validation failure blocks learning
const invalidTrajectory = checkLearningEligibility({ ...eligibleInput, trajectoryValidates: false }, 5007);
assert.equal(invalidTrajectory.eligible, false, 'trajectory validation failure must block learning');

// Threshold set is correct
assert.ok(LEARNING_RECONCILIATION_THRESHOLD.has('VERIFIED'), 'threshold must include VERIFIED');
assert.ok(LEARNING_RECONCILIATION_THRESHOLD.has('PARTIAL'), 'threshold must include PARTIAL');
assert.ok(!LEARNING_RECONCILIATION_THRESHOLD.has('MISMATCH'), 'threshold must not include MISMATCH');
assert.ok(!LEARNING_RECONCILIATION_THRESHOLD.has('UNOBSERVABLE'), 'threshold must not include UNOBSERVABLE');
assert.ok(!LEARNING_RECONCILIATION_THRESHOLD.has('UNPROVABLE'), 'threshold must not include UNPROVABLE');

// Forge structured correction: append-only, references original, never overwrites
const correctionInput = {
  runId: 'forge-run-001',
  turnIndex: 5,
  observationSha256: 'a'.repeat(64),
  originalPredictionSha256: 'b'.repeat(64),
  originalActionSha256: 'c'.repeat(64),
  correctedActionSummary: 'Select route B instead of route A.',
  correctedActionSha256: 'd'.repeat(64),
  correctionRationale: 'Route A leads to a dead end; route B is safer.',
  ownerApprovedAdmission: false,
  createdAtEpoch: 6000,
};
assert.deepEqual(validateForgeCorrectionInput(correctionInput), [], 'complete correction input must validate');
const correction = await buildForgeCorrection(correctionInput);
assert.equal(correction.schema_version, FORGE_CORRECTION_SCHEMA_VERSION, 'correction must use the forge-structured-correction.v1 schema');
assert.equal(correction.run_id, 'forge-run-001', 'correction must preserve run ID');
assert.equal(correction.turn_index, 5, 'correction must preserve turn index');
assert.equal(correction.observation_sha256, 'a'.repeat(64), 'correction must reference the exact observation hash');
assert.equal(correction.original_prediction_sha256, 'b'.repeat(64), 'correction must reference the original prediction hash');
assert.equal(correction.original_action_sha256, 'c'.repeat(64), 'correction must reference the original action hash');
assert.equal(correction.admitted_to_training, false, 'correction must default to not admitted without owner approval');
assert.match(correction.correction_sha256, /^[a-f0-9]{64}$/, 'correction hash must be a SHA-256 digest');
assert.equal(correction.correction_id, correction.correction_sha256, 'correction ID must equal correction hash');
assert.ok(await verifyCorrectionIntegrity(correction), 'untampered correction must verify its integrity');

// Correction with owner approval → admitted to training
const approvedCorrection = await buildForgeCorrection({ ...correctionInput, ownerApprovedAdmission: true });
assert.equal(approvedCorrection.admitted_to_training, true, 'owner-approved correction must be admitted to training');

// Tampered correction must fail integrity
const tamperedCorrection = { ...correction, correction_rationale: 'tampered' };
assert.ok(!(await verifyCorrectionIntegrity(tamperedCorrection)), 'tampered correction must fail integrity check');

// Invalid correction input must fail validation
assert.ok(validateForgeCorrectionInput({ ...correctionInput, observationSha256: 'not-a-hash' }).length > 0, 'invalid observation hash must be rejected');
assert.ok(validateForgeCorrectionInput({ ...correctionInput, correctedActionSummary: '' }).length > 0, 'empty corrected action summary must be rejected');

// Episode splitting: deterministic, at episode level, never turn level
const runIds = ['run-a', 'run-b', 'run-c', 'run-d', 'run-e', 'run-f', 'run-g', 'run-h', 'run-i', 'run-j'];
const split1 = splitEpisodes(runIds, { train: 0.7, validation: 0.15, test: 0.15 }, 'abc123');
const split2 = splitEpisodes(runIds, { train: 0.7, validation: 0.15, test: 0.15 }, 'abc123');
assert.deepEqual(split1.train, split2.train, 'same seed must produce identical train split');
assert.deepEqual(split1.validation, split2.validation, 'same seed must produce identical validation split');
assert.deepEqual(split1.test, split2.test, 'same seed must produce identical test split');
// All runs are accounted for
const allSplit = [...split1.train, ...split1.validation, ...split1.test].sort();
assert.deepEqual(allSplit, [...runIds].sort(), 'all run IDs must be assigned to exactly one split set');
// No run appears in multiple sets
const trainSet = new Set(split1.train);
const valSet = new Set(split1.validation);
const testSet = new Set(split1.test);
for (const id of split1.train) assert.ok(!valSet.has(id) && !testSet.has(id), 'no run may appear in multiple split sets');
for (const id of split1.validation) assert.ok(!trainSet.has(id) && !testSet.has(id), 'no run may appear in multiple split sets');

// Different seed produces different split
const split3 = splitEpisodes(runIds, { train: 0.7, validation: 0.15, test: 0.15 }, 'def456');
assert.notDeepEqual(split1.train, split3.train, 'different seed must produce different split');

// Invalid ratios must throw
assert.throws(() => splitEpisodes(runIds, { train: 0.5, validation: 0.5, test: 0.5 }, 'abc123'), /sum to 1.0/, 'ratios not summing to 1.0 must throw');

// Policy revision manifest: binds all required metadata
const manifestInput = {
  policyRevisionId: 'policy-rev-001',
  trainingDatasetManifestSha256: 'a'.repeat(64),
  inputRunIds: ['forge-run-001', 'forge-run-002'],
  inputRunRootHashes: ['b'.repeat(64), 'c'.repeat(64)],
  codeGitSha: 'd'.repeat(64),
  trainingSeed: 'a1b2c3d4e5f6',
  trainingConfigSha256: 'e'.repeat(64),
  environmentDigest: 'f'.repeat(64),
  outputArtifactSha256: '1'.repeat(64),
  evaluationManifestSha256: '2'.repeat(64),
  createdAtEpoch: 7000,
};
assert.deepEqual(validatePolicyRevisionManifestInput(manifestInput), [], 'complete manifest input must validate');
const manifest = await buildPolicyRevisionManifest(manifestInput);
assert.equal(manifest.schema_version, FORGE_POLICY_MANIFEST_SCHEMA_VERSION, 'manifest must use the forge-policy-revision-manifest.v1 schema');
assert.equal(manifest.policy_revision_id, 'policy-rev-001', 'manifest must preserve policy revision ID');
assert.deepEqual(manifest.input_run_ids, ['forge-run-001', 'forge-run-002'], 'manifest must preserve input run IDs');
assert.deepEqual(manifest.input_run_root_hashes, ['b'.repeat(64), 'c'.repeat(64)], 'manifest must preserve input run root hashes');
assert.equal(manifest.code_git_sha, 'd'.repeat(64), 'manifest must preserve code Git SHA');
assert.equal(manifest.training_seed, 'a1b2c3d4e5f6', 'manifest must preserve training seed');
assert.match(manifest.manifest_sha256, /^[a-f0-9]{64}$/, 'manifest hash must be a SHA-256 digest');
assert.ok(await verifyPolicyRevisionManifestIntegrity(manifest), 'untampered manifest must verify its integrity');

// Tampered manifest must fail integrity
const tamperedManifest = { ...manifest, training_seed: 'tampered' };
assert.ok(!(await verifyPolicyRevisionManifestIntegrity(tamperedManifest)), 'tampered manifest must fail integrity check');

// Invalid manifest input must fail validation
assert.ok(validatePolicyRevisionManifestInput({ ...manifestInput, codeGitSha: 'not-a-hash' }).length > 0, 'invalid code Git SHA must be rejected');
assert.ok(validatePolicyRevisionManifestInput({ ...manifestInput, inputRunIds: [] }).length > 0, 'empty input run IDs must be rejected');
assert.ok(validatePolicyRevisionManifestInput({ ...manifestInput, inputRunRootHashes: ['x'.repeat(64)] }).length > 0, 'mismatched root hash count must be rejected');

// --- ForgeAI reproducible training/evaluation receipts & HF model lane (#14) ---

// Training receipt: complete input validates and builds
const trainingReceiptInput = {
  trainingDatasetManifestSha256: 'a'.repeat(64),
  selectedEpisodeIds: ['forge-run-001', 'forge-run-002'],
  selectedEpisodeRootHashes: ['b'.repeat(64), 'c'.repeat(64)],
  codeGitSha: 'd'.repeat(64),
  dependencyLockHash: 'e'.repeat(64),
  containerRuntimeDigest: 'f'.repeat(64),
  deterministicSeeds: ['a1b2c3d4', 'e5f6a7b8'],
  trainingConfigSha256: '1'.repeat(64),
  startEpoch: 10000,
  endEpoch: 11000,
  outputArtifactHashes: ['2'.repeat(64)],
  evaluationManifestSha256: '3'.repeat(64),
  toolProviderIdentifiers: ['huggingface', 'pytorch'],
  nondeterminismNotes: 'Remote LLM provider calls may introduce nondeterminism.',
  createdAtEpoch: 12000,
};
assert.deepEqual(validateTrainingReceiptInput(trainingReceiptInput), [], 'complete training receipt input must validate');
const trainingReceipt = await buildTrainingReceipt(trainingReceiptInput);
assert.equal(trainingReceipt.schema_version, FORGE_TRAINING_RECEIPT_SCHEMA_VERSION, 'training receipt must use forge-training-receipt.v1 schema');
assert.equal(trainingReceipt.selected_episode_ids.length, 2, 'training receipt must preserve selected episode IDs');
assert.equal(trainingReceipt.output_artifact_hashes.length, 1, 'training receipt must preserve output artifact hashes');
assert.match(trainingReceipt.receipt_sha256, /^[a-f0-9]{64}$/, 'training receipt hash must be a SHA-256 digest');
assert.ok(await verifyTrainingReceiptIntegrity(trainingReceipt), 'untampered training receipt must verify integrity');

// Tampered training receipt must fail
const tamperedTrainingReceipt = { ...trainingReceipt, nondeterminism_notes: 'tampered' };
assert.ok(!(await verifyTrainingReceiptIntegrity(tamperedTrainingReceipt)), 'tampered training receipt must fail integrity');

// Invalid training receipt input
assert.ok(validateTrainingReceiptInput({ ...trainingReceiptInput, codeGitSha: 'not-a-hash' }).length > 0, 'invalid code Git SHA must be rejected');
assert.ok(validateTrainingReceiptInput({ ...trainingReceiptInput, deterministicSeeds: [] }).length > 0, 'empty seeds must be rejected');
assert.ok(validateTrainingReceiptInput({ ...trainingReceiptInput, outputArtifactHashes: [] }).length > 0, 'empty output artifacts must be rejected');

// Evaluation receipt: complete input validates and builds
const evalReceiptInput = {
  evaluationPackId: 'eval-pack-001',
  datasetManifestSha256: 'a'.repeat(64),
  policyRevisionId: 'policy-rev-001',
  metrics: [
    { metric_name: 'invalid_action_rate', value: 0.05, description: '5% of actions were invalid.', is_external: false },
    { metric_name: 'terminal_completion', value: 0.8, description: '80% of episodes reached terminal state.', is_external: false },
    { metric_name: 'external_forge_score', value: 42, description: 'Average Forge-reported score.', is_external: true },
    { metric_name: 'correction_rate', value: 0.1, description: '10% of turns had corrections.', is_external: false },
  ],
  evaluationConfigSha256: 'b'.repeat(64),
  evaluatedAtEpoch: 13000,
};
assert.deepEqual(validateEvaluationReceiptInput(evalReceiptInput), [], 'complete evaluation receipt input must validate');
const evalReceipt = await buildEvaluationReceipt(evalReceiptInput);
assert.equal(evalReceipt.schema_version, FORGE_EVALUATION_RECEIPT_SCHEMA_VERSION, 'evaluation receipt must use forge-evaluation-receipt.v1 schema');
assert.equal(evalReceipt.metrics.length, 4, 'evaluation receipt must preserve all metrics');
assert.equal(evalReceipt.metrics[2].is_external, true, 'external_forge_score must be marked as external');
assert.match(evalReceipt.receipt_sha256, /^[a-f0-9]{64}$/, 'evaluation receipt hash must be a SHA-256 digest');
assert.ok(await verifyEvaluationReceiptIntegrity(evalReceipt), 'untampered evaluation receipt must verify integrity');

// Invalid metric name rejected
assert.ok(validateEvaluationReceiptInput({ ...evalReceiptInput, metrics: [{ metric_name: 'fake_score', value: 1, description: 'x', is_external: false }] }).length > 0, 'invalid metric name must be rejected');

// Model card: complete input validates and builds
const modelCardInput = {
  modelRepoId: 'Thorsu/are-agent-forge-policy-v1',
  policyFamilyId: 'forge-structured-v1',
  sourceRepoRevision: 'd'.repeat(64),
  trainingReceiptSha256: trainingReceipt.receipt_sha256,
  datasetRevisionSha256: 'a'.repeat(64),
  evaluationReceiptSha256: evalReceipt.receipt_sha256,
  knownLimitations: 'Policy trained on limited practice runs; may not generalize.',
  forgeExternalEvidenceScope: 'Forge scores are external observations, not locally generated.',
  licenseRightsStatus: 'private-gated-pending-rights-review',
  isPrivate: true,
  createdAtEpoch: 14000,
};
assert.deepEqual(validateModelCardInput(modelCardInput), [], 'complete model card input must validate');
const modelCard = await buildForgeModelCard(modelCardInput);
assert.equal(modelCard.schema_version, FORGE_MODEL_CARD_SCHEMA_VERSION, 'model card must use forge-model-card.v1 schema');
assert.equal(modelCard.is_private, true, 'model card must default to private/gated');
assert.equal(modelCard.training_receipt_sha256, trainingReceipt.receipt_sha256, 'model card must link training receipt');
assert.match(modelCard.card_sha256, /^[a-f0-9]{64}$/, 'model card hash must be a SHA-256 digest');
assert.ok(await verifyModelCardIntegrity(modelCard), 'untampered model card must verify integrity');

// Tampered model card must fail
const tamperedCard = { ...modelCard, is_private: false };
assert.ok(!(await verifyModelCardIntegrity(tamperedCard)), 'tampered model card must fail integrity');

// --- ForgeAI rights/terms publication gate (#15) ---

// Rights record: complete input validates and builds
const rightsInput = {
  policyTermsUrls: ['https://forgeai.gg/terms', 'https://forgeai.gg/research'],
  observedLastUpdatedDates: ['2026-09-20', null],
  evidenceSnapshotHashes: ['a'.repeat(64)],
  reviewDate: '2026-09-20',
  categoryPermissions: [
    { category: 'are_owned_action_metadata', allowed_local_use: true, allowed_private_hf_upload: true, allowed_public_redistribution: true, allowed_model_training: true, attribution_notice_required: false, explicit_permission_ref: null },
    { category: 'forge_observations_state', allowed_local_use: true, allowed_private_hf_upload: true, allowed_public_redistribution: false, allowed_model_training: true, attribution_notice_required: true, explicit_permission_ref: null },
    { category: 'forge_scores', allowed_local_use: true, allowed_private_hf_upload: true, allowed_public_redistribution: false, allowed_model_training: false, attribution_notice_required: true, explicit_permission_ref: null },
    { category: 'forge_replay_history', allowed_local_use: false, allowed_private_hf_upload: false, allowed_public_redistribution: false, allowed_model_training: false, attribution_notice_required: true, explicit_permission_ref: null },
    { category: 'derived_labels', allowed_local_use: true, allowed_private_hf_upload: true, allowed_public_redistribution: true, allowed_model_training: true, attribution_notice_required: false, explicit_permission_ref: null },
    { category: 'forge_screenshots_content', allowed_local_use: false, allowed_private_hf_upload: false, allowed_public_redistribution: false, allowed_model_training: false, attribution_notice_required: true, explicit_permission_ref: null },
  ],
  reviewerConfirmation: 'owner-confirmed-2026-09-20',
  createdAtEpoch: 5000,
};
assert.deepEqual(validateRightsRecordInput(rightsInput), [], 'complete rights record input must validate');
const rightsRecord = await buildForgeRightsRecord(rightsInput);
assert.equal(rightsRecord.schema_version, FORGE_RIGHTS_RECORD_SCHEMA_VERSION, 'rights record must use forge-publication-rights.v1 schema');
assert.equal(rightsRecord.category_permissions.length, 6, 'rights record must preserve all category permissions');
assert.match(rightsRecord.record_sha256, /^[a-f0-9]{64}$/, 'rights record hash must be a SHA-256 digest');
assert.ok(await verifyRightsRecordIntegrity(rightsRecord), 'untampered rights record must verify integrity');

// Tampered rights record must fail
const tamperedRights = { ...rightsRecord, reviewer_confirmation: 'tampered' };
assert.ok(!(await verifyRightsRecordIntegrity(tamperedRights)), 'tampered rights record must fail integrity');

// Invalid rights record input
assert.ok(validateRightsRecordInput({ ...rightsInput, policyTermsUrls: [] }).length > 0, 'empty policy terms URLs must be rejected');
assert.ok(validateRightsRecordInput({ ...rightsInput, reviewDate: 'invalid' }).length > 0, 'invalid review date must be rejected');
assert.ok(validateRightsRecordInput({ ...rightsInput, categoryPermissions: [{ category: 'are_owned_action_metadata', allowed_local_use: 'yes', allowed_private_hf_upload: true, allowed_public_redistribution: true, allowed_model_training: true, attribution_notice_required: false, explicit_permission_ref: null }] }).length > 0, 'non-boolean permission must be rejected');

// Publication gate: classify fields
const fieldsToClassify = [
  { field_name: 'action_type', category: 'are_owned_action_metadata' },
  { field_name: 'state_summary', category: 'forge_observations_state' },
  { field_name: 'forge_score', category: 'forge_scores' },
  { field_name: 'replay_data', category: 'forge_replay_history' },
  { field_name: 'derived_label', category: 'derived_labels' },
  { field_name: 'screenshot', category: 'forge_screenshots_content' },
];
const gateResult = classifyFieldsForPublication(fieldsToClassify, rightsRecord);
assert.ok(gateResult.allowed_fields.includes('action_type'), 'are_owned_action_metadata with public redistribution must be allowed');
assert.ok(gateResult.allowed_fields.includes('derived_label'), 'derived_labels with public redistribution must be allowed');
assert.ok(gateResult.quarantined_fields.includes('state_summary'), 'forge_observations_state without public redistribution must be quarantined');
assert.ok(gateResult.quarantined_fields.includes('forge_score'), 'forge_scores without public redistribution must be quarantined');
assert.ok(gateResult.quarantined_fields.includes('replay_data'), 'forge_replay_history without public redistribution must be quarantined');
assert.ok(gateResult.quarantined_fields.includes('screenshot'), 'forge_screenshots_content without public redistribution must be quarantined');
assert.equal(gateResult.public_publish_allowed, false, 'with quarantined fields, public publish must be blocked');

// Publication gate: all fields allowed → public publish allowed
const allAllowedFields = [
  { field_name: 'action_type', category: 'are_owned_action_metadata' },
  { field_name: 'derived_label', category: 'derived_labels' },
];
const allAllowedResult = classifyFieldsForPublication(allAllowedFields, rightsRecord);
assert.equal(allAllowedResult.public_publish_allowed, true, 'all allowed fields must permit public publish');
assert.doesNotThrow(() => assertPublicationAllowed(allAllowedFields, rightsRecord), 'all allowed fields must not throw');

// Publication gate: quarantined fields must throw
assert.throws(() => assertPublicationAllowed(fieldsToClassify, rightsRecord), { code: 'PUBLICATION_BLOCKED' }, 'quarantined fields must throw PUBLICATION_BLOCKED');

// Unknown category defaults to quarantine
const unknownCategoryFields = [{ field_name: 'unknown_field', category: 'are_owned_action_metadata' }];
const unknownPerms = { ...rightsRecord, category_permissions: rightsRecord.category_permissions.filter((p) => p.category !== 'are_owned_action_metadata') };
const unknownResult = classifyFieldsForPublication(unknownCategoryFields, unknownPerms);
assert.ok(unknownResult.quarantined_fields.includes('unknown_field'), 'unknown category must default to quarantine');

console.log('frontend core regressions: 142 assertions passed');
