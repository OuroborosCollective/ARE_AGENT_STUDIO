#!/usr/bin/env node
/**
 * Forge contract-drift guard — issue #19.
 *
 * Captures expected structural invariants of the Forge contract schemas
 * without pinning volatile content. When required Forge fields/schema
 * disappear or change, produces a clear CONTRACT_DRIFT failure.
 *
 * This is a static check that verifies:
 *   1. All expected schema version strings are present in their source files.
 *   2. Required exported function names exist in their modules.
 *   3. No schema version string has been silently removed or renamed.
 *
 * It does NOT contact live Forge endpoints — that belongs to controlled
 * runtime evidence, not generic PR CI.
 */
import fs from 'node:fs';
import path from 'node:path';

const failures = [];

// Expected schema versions and their source files
const EXPECTED_SCHEMAS = [
  { file: 'frontend/services/forgeStructuredPolicy.ts', version: 'forge-trajectory.v1' },
  { file: 'frontend/services/forgeContractClient.ts', version: 'forge-contract.v1' },
  { file: 'frontend/services/forgeTrajectoryStore.ts', version: 'are-agent-forge-trajectory.v1' },
  { file: 'frontend/services/forgeReconciliation.ts', version: 'are-agent-forge-reconciliation.v1' },
  { file: 'frontend/services/forgeLearningEligibility.ts', version: 'forge-learning.v1' },
  { file: 'frontend/services/forgeLearningEligibility.ts', version: 'forge-structured-correction.v1' },
  { file: 'frontend/services/forgeLearningEligibility.ts', version: 'forge-policy-revision-manifest.v1' },
  { file: 'frontend/services/forgeTrainingReceipt.ts', version: 'forge-training-receipt.v1' },
  { file: 'frontend/services/forgeTrainingReceipt.ts', version: 'forge-evaluation-receipt.v1' },
  { file: 'frontend/services/forgeTrainingReceipt.ts', version: 'forge-model-card.v1' },
  { file: 'frontend/services/forgeRightsGate.ts', version: 'forge-publication-rights.v1' },
  { file: 'frontend/services/forgeQualificationRun.ts', version: 'forge-qualification-run.v1' },
];

// Expected exported function names per module
const EXPECTED_EXPORTS = [
  { file: 'frontend/services/forgeStructuredPolicy.ts', exports: ['validateForgeTrajectoryDraft', 'buildForgeTrajectoryDraft', 'DeterministicSelectFirstPolicy'] },
  { file: 'frontend/services/forgeContractClient.ts', exports: ['validateForgeContractDiscovery', 'buildForgeContract', 'ForgeCredentialVault', 'ForgeActionClient'] },
  { file: 'frontend/services/forgeTrajectoryStore.ts', exports: ['ForgeTrajectoryStore', 'validateForgeTrajectoryRecord'] },
  { file: 'frontend/services/forgeReconciliation.ts', exports: ['validateForgeReconciliationInput', 'buildForgeReconciliationReceipt', 'computeReconciliationVerdict'] },
  { file: 'frontend/services/forgeLearningEligibility.ts', exports: ['checkLearningEligibility', 'buildForgeCorrection', 'splitEpisodes', 'buildPolicyRevisionManifest'] },
  { file: 'frontend/services/forgeTrainingReceipt.ts', exports: ['buildTrainingReceipt', 'buildEvaluationReceipt', 'buildForgeModelCard'] },
  { file: 'frontend/services/forgeRightsGate.ts', exports: ['buildForgeRightsRecord', 'classifyFieldsForPublication', 'assertPublicationAllowed'] },
  { file: 'frontend/services/forgeQualificationRun.ts', exports: ['buildQualificationEvidenceBundle', 'validateQualificationRunInput', 'checkQualificationPreconditions', 'verifyQualificationEvidenceIntegrity'] },
];

for (const { file, version } of EXPECTED_SCHEMAS) {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    failures.push(`CONTRACT_DRIFT: expected schema file ${file} is missing`);
    continue;
  }
  const text = fs.readFileSync(filePath, 'utf8');
  if (!text.includes(version)) {
    failures.push(`CONTRACT_DRIFT: schema version "${version}" not found in ${file}`);
  }
}

for (const { file, exports: exports_ } of EXPECTED_EXPORTS) {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    failures.push(`CONTRACT_DRIFT: expected module ${file} is missing`);
    continue;
  }
  const text = fs.readFileSync(filePath, 'utf8');
  for (const name of exports_) {
    if (!text.includes(name)) {
      failures.push(`CONTRACT_DRIFT: expected export "${name}" not found in ${file}`);
    }
  }
}

if (failures.length) {
  console.error('forge_contract_drift_guard: contract drift detected:');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`forge_contract_drift_guard: ${EXPECTED_SCHEMAS.length} schemas and ${EXPECTED_EXPORTS.reduce((n, e) => n + e.exports.length, 0)} exports verified — no drift`);
