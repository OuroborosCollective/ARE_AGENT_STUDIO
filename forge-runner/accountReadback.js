/** Account-authenticated GET-only technical evidence. No account data in logs. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ForgeConnector, hashBody } from './connector.js';
import { now } from './deterministicClock.js';

export async function readForgeAccount({ credential, gitSha, fetchImpl } = {}) {
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(gitSha ?? '')) throw new Error('A full source revision is required.');
  const client = new ForgeConnector({ credential, fetchImpl });
  const sources = [];
  for (const call of [() => client.listDungeons(), () => client.listOwnedRuns()]) {
    const result = await call();
    sources.push({ source: result.source, http_status: result.http_status, status: result.status, error_code: result.error_code });
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
