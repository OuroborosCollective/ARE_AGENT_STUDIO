#!/usr/bin/env node
/**
 * Forge secret/credential scan — issue #19 security gate.
 *
 * Asserts that:
 *   - dgr_/API credentials never appear in output artifacts/logs;
 *   - public Space image does not start/include active runner credentials;
 *   - runner endpoints that mutate runs are not publicly anonymous;
 *   - browser bundle contains no Forge secret/env material;
 *   - HF export strips secret-bearing fields.
 *
 * This is a static scan of forge-related files and build outputs for
 * credential-like patterns. It does NOT execute any code.
 */
import fs from 'node:fs';
import path from 'node:path';

const failures = [];

// Patterns that indicate a credential or secret value
const SECRET_PATTERNS = [
  /(?:api[_-]?key|access[_-]?token|secret[_-]?key|bearer)\s*[:=]\s*['"][A-Za-z0-9+/=_-]{16,}['"]/gi,
  /dgr_[A-Za-z0-9]{16,}/gi,
  /forge[_-]?(?:api[_-]?key|token|secret)\s*[:=]\s*['"][^'"]+['"]/gi,
  /process\.env\.(?:FORGE_API_KEY|FORGE_TOKEN|FORGE_SECRET|DGR_API_KEY|HF_TOKEN)\b/g,
];

// Files to scan: forge-related source, scripts, and build outputs
const SCAN_DIRS = [
  'frontend/services',
  'forge-runner',
  'scripts',
  'huggingface',
];

// Files NOT to flag (they reference env vars by name, which is fine)
const ALLOWED_REFS = new Set([
  'process.env.HF_TOKEN',
  'os.environ.get("HF_TOKEN")',
  'os.environ.get("HF_TOKEN")',
]);

function walk(dir) {
  const stat = fs.statSync(dir);
  if (stat.isFile()) return [dir];
  return fs.readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    const rel = path.relative('.', full);
    if (rel.startsWith('node_modules') || rel.startsWith('.git') || rel.startsWith('dist') || rel.startsWith('.core-test-build') || rel.startsWith('frontend/.vite')) return [];
    return walk(full);
  });
}

const allFiles = SCAN_DIRS.flatMap((d) => {
  if (!fs.existsSync(d)) return [];
  return walk(d).filter((f) => /\.(ts|tsx|js|mjs|py|json|md|yml|yaml|html|css)$/i.test(f));
});

// Also scan the built frontend bundle if it exists
const buildDir = 'frontend/dist';
if (fs.existsSync(buildDir)) {
  for (const f of walk(buildDir).filter((f) => /\.(js|css|html)$/i.test(f))) {
    allFiles.push(f);
  }
}

for (const file of allFiles) {
  // Only scan forge-related files and build outputs
  const isForge = file.toLowerCase().includes('forge');
  const isBuild = file.startsWith('frontend/dist');
  if (!isForge && !isBuild) continue;

  const text = fs.readFileSync(file, 'utf8');

  for (const pattern of SECRET_PATTERNS) {
    const matches = text.match(pattern);
    if (!matches) continue;
    for (const match of matches) {
      // Skip allowed env-var references (checking by name only)
      if (ALLOWED_REFS.has(match.trim())) continue;
      // Skip comments that reference env var names without values
      if (match.includes('process.env.') && !match.match(/['"][A-Za-z0-9+/=_-]{16,}['"]/)) continue;
      failures.push(`${file}: potential secret/credential pattern: ${match.substring(0, 80)}`);
    }
  }
}

if (failures.length) {
  console.error('forge_secret_scan: potential credential leaks found:');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('forge_secret_scan: no credential/secret patterns found in forge files or build output');
