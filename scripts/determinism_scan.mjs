#!/usr/bin/env node
/**
 * Determinism scan — fails CI if any application source file calls a
 * non-deterministic time or randomness primitive directly instead of going
 * through the central deterministic clock module.
 *
 * Flagged primitives:
 *   Date.now(   new Date(   Math.random(
 *
 * `performance.now` is intentionally NOT flagged: it is a legitimate
 * measurement/animation primitive (policy latency benchmarks, canvas fps,
 * radar pulse), never a provenance or identity source.
 *
 * Allowlist (files that may use the primitives directly):
 *   - The clock modules themselves (they own the only sanctioned calls).
 *   - The frozen visual-control modules (serverSyncGateway, neuralPolicyEngine,
 *     datasetCodec, receiptVerifier) — semantically frozen by project rule.
 *   - Test and tooling scripts (paths under test/, tests/, scripts/, or
 *     matching *.test.* / run-* / test-* ) — fixtures may pin real instants.
 *
 * Usage: node scripts/determinism_scan.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const PRIMITIVES = [/\bDate\.now\(/, /\bnew\s+Date\(/, /\bMath\.random\(/];

// Files that are permitted to call the primitives directly.
const ALLOWLIST_PATTERNS = [
  // the clock modules themselves (any package) own the only sanctioned calls
  /(^|\/)deterministicClock\.(ts|js)$/,
  // frozen visual-control plane
  /(^|\/)services\/serverSyncGateway\.ts$/,
  /(^|\/)services\/neuralPolicyEngine\.ts$/,
  /(^|\/)services\/datasetCodec\.ts$/,
  /(^|\/)services\/receiptVerifier\.ts$/,
  // this scanner
  /(^|\/)scripts\/determinism_scan\.mjs$/,
];

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.vite', '.core-test-build', 'build', '.next']);

function isAllowlisted(rel) {
  const norm = rel.replace(/\\/g, '/');
  if (ALLOWLIST_PATTERNS.some((re) => re.test(norm))) return true;
  // test & tooling paths
  if (/(^|\/)(test|tests|scripts)(\/|\\)/.test(norm)) return true;
  if (/(^|\/)(test|tests)(\/|\\)/.test(norm)) return true;
  if (/\.(test|spec)\.(ts|tsx|js|mjs)$/.test(norm)) return true;
  if (/(^|\/)(run-|test-)[^/]*\.(ts|tsx|js|mjs)$/.test(norm)) return true;
  return false;
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const failures = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  if (isAllowlisted(rel)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const re of PRIMITIVES) {
      if (re.test(lines[i])) {
        failures.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
      }
    }
  }
}

if (failures.length) {
  console.error('determinism_scan: non-deterministic primitives found outside the clock module:');
  console.error(failures.join('\n'));
  console.error('\nRoute time/ids through services/deterministicClock (now/isoTimestamp/uniqueId).');
  process.exit(1);
}

console.log('determinism_scan: no Date.now / new Date / Math.random outside the deterministic clock module');
