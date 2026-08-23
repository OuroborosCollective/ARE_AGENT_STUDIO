import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(root, '.core-test-build');
const require = createRequire(import.meta.url);
const typescriptModule = require('typescript');
const typescript = typescriptModule.default ?? typescriptModule;
fs.rmSync(out, { recursive: true, force: true });
const sourceFiles = [
  'types.ts', 'constants.ts', 'services/neuralPolicyEngine.ts', 'services/datasetCodec.ts', 'services/receiptVerifier.ts', 'services/operationCorrectionCodec.ts',
];
for (const sourceFile of sourceFiles) {
  const sourcePath = path.join(root, sourceFile);
  const compiled = typescript.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: { target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.CommonJS },
    fileName: sourceFile,
    reportDiagnostics: true,
  });
  const diagnostic = compiled.diagnostics?.find((entry) => entry.category === typescript.DiagnosticCategory.Error);
  if (diagnostic) throw new Error(typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  const outputPath = path.join(out, sourceFile.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, compiled.outputText);
}
fs.writeFileSync(path.join(out, 'package.json'), '{"type":"commonjs"}');
const { NeuralPolicyEngine } = require(path.join(out, 'services/neuralPolicyEngine.js'));
const { telemetryToDatasetRows, datasetRowsToJsonl } = require(path.join(out, 'services/datasetCodec.js'));
const { canonicalJson, verifyDatasetReceipt, verifyOperationCorrectionReceipt } = require(path.join(out, 'services/receiptVerifier.js'));
const { buildOperationCorrectionDraft, validateOperationCorrectionDraft } = require(path.join(out, 'services/operationCorrectionCodec.js'));
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

console.log('frontend core regressions: 24 assertions passed');
