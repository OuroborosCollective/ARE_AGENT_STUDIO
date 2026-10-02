/** Account-authenticated GET-only evidence. No response text or identifiers in logs. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ForgeConnector, hashBody } from './connector.js';
import { now } from './deterministicClock.js';

// Only a small fixed set of aggregate fields may leave the private transport.
const COUNTERS = new Set(['freeRunsRemaining', 'remainingFreeRuns', 'freeRunsUsed', 'freeRunsTotal', 'remaining', 'limit', 'total', 'used', 'available', 'remainingLifetimeFreeRuns', 'lifetimeFreeRunsRemaining']);
const SAFE_KEYS = new Set(['dungeons', 'runs', 'activeRuns', 'existingRuns', 'freeRuns', 'freeRunAllowance', 'lifetimeFreeRuns', 'allowance', 'practice', 'data', ...COUNTERS]);
export function projectDiscovery(data) {
  const fields = [];
  function visit(value, at, depth) {
    if (depth > 5 || fields.length >= 100) return;
    if (Array.isArray(value)) {
      fields.push({ path: at, type: 'array', count: value.length });
      // Individual runs/dungeons can contain credentials or user data.
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (!SAFE_KEYS.has(key)) continue;
      const next = `${at}.${key}`;
      if (COUNTERS.has(key) && Number.isSafeInteger(item) && item >= 0) fields.push({ path: next, type: 'counter', value: item });
      else if (item && typeof item === 'object') visit(item, next, depth + 1);
    }
  }
  visit(data, '$', 0);
  return fields;
}

export async function readForgeAccount({ credential, gitSha, fetchImpl } = {}) {
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(gitSha ?? '')) throw new Error('A full source revision is required.');
  const client = new ForgeConnector({ credential, fetchImpl });
  const sources = [];
  for (const call of [() => client.listDungeons(), () => client.listOwnedRuns()]) {
    const result = await call();
    const { data, ...evidence } = result;
    sources.push({ ...evidence, aggregate_fields: data ? projectDiscovery(data) : [] });
  }
  const receipt = {
    schema_version: 'forge-account-readback.v1', source_git_sha: gitSha,
    observed_at_epoch: now(), credential_configured: client.hasCredentials(),
    authentication_status: sources.every(s => s.status === 'OBSERVED') ? 'OBSERVED' : 'UNPROVABLE',
    qualification_status: 'BLOCKED', sources,
    gameplay_requests: 0, entry_requests: 0, paid_requests: 0,
  };
  return { ...receipt, receipt_sha256: hashBody(JSON.stringify(receipt)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const receipt = await readForgeAccount({ credential: process.env.FORGEAI_API_KEY, gitSha: process.env.GITHUB_SHA ?? process.env.FORGE_SOURCE_GIT_SHA });
    const output = process.env.FORGE_READBACK_OUTPUT;
    if (output) {
      await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
      await fs.writeFile(output, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
    }
    console.log(JSON.stringify(receipt));
    process.exitCode = receipt.authentication_status === 'OBSERVED' ? 0 : 2;
  } catch {
    console.error('Forge account readback failed; no credentials or provider error bodies are logged.');
    process.exitCode = 2;
  }
}
