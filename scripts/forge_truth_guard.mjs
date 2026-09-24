#!/usr/bin/env node
/**
 * Forge architecture guard — fails if any forge-related file imports or mutates
 * the protected visual policy/dataset path.
 *
 * Protected modules (the visual-control plane):
 *   frontend/services/neuralPolicyEngine.ts
 *   frontend/services/datasetCodec.ts
 *   frontend/services/serverSyncGateway.ts
 *   frontend/services/receiptVerifier.ts
 *
 * A "forge-related file" is any .ts/.tsx/.js/.mjs file whose path contains
 * "forge" (case-insensitive). The guard also checks that the are-agent-vla.v1
 * schema string is not referenced inside forge files.
 */
import fs from 'node:fs';
import path from 'node:path';

const failures = [];

const PROTECTED_IMPORTS = [
  'neuralPolicyEngine',
  'datasetCodec',
  'serverSyncGateway',
  'receiptVerifier',
];

const FORBIDDEN_SCHEMA_REF = 'are-agent-vla.v1';

function walk(dir) {
  const stat = fs.statSync(dir);
  if (stat.isFile()) return [dir];
  return fs.readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    const rel = path.relative('.', full);
    if (rel.startsWith('node_modules') || rel.startsWith('.git') || rel.startsWith('dist') || rel.startsWith('frontend/.vite')) return [];
    return walk(full);
  });
}

const allFiles = walk('.').filter((f) => /\.(ts|tsx|js|mjs)$/.test(f));
const forgeFiles = allFiles.filter((f) => f.toLowerCase().includes('forge') && f !== 'scripts/forge_truth_guard.mjs');

for (const file of forgeFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const mod of PROTECTED_IMPORTS) {
    const importPattern = new RegExp(`from\\s+['"][^'"]*${mod}['"]|require\\(['"][^'"]*${mod}['"]\\)`, 'i');
    if (importPattern.test(text)) {
      failures.push(`forge file ${file} imports protected visual-path module "${mod}"`);
    }
  }
  if (text.includes(FORBIDDEN_SCHEMA_REF)) {
    failures.push(`forge file ${file} references the frozen visual schema "${FORBIDDEN_SCHEMA_REF}"`);
  }
}

if (failures.length) {
  console.error('forge_truth_guard: violations found:');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('forge_truth_guard: no forge file imports or mutates the protected visual policy/dataset path');
