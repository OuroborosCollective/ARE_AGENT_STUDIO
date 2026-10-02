/** Public GET-only contract readback. Cannot create a run or spend allowance. */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { now } from './deterministicClock.js';

const ORIGIN = 'https://forgeai.gg';
const SOURCES = ['/forge/registry.json', '/skill.md', '/api/connectors/openapi.json'];
const REQUIRED_OPERATIONS = ['list_active_dungeons', 'enter_dungeon', 'get_my_active_runs', 'get_run_context', 'submit_dungeon_turn', 'get_run_events'];
const sha256 = value => createHash('sha256').update(value).digest('hex');

export async function readPublicForgeContract({ fetchImpl = fetch } = {}) {
  const sources = [];
  let contractMatches = false;
  for (const route of SOURCES) {
    const url = `${ORIGIN}${route}`;
    try {
      const response = await fetchImpl(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000) });
      const body = await response.text();
      const source = { url, http_status: response.status, body_sha256: sha256(body), status: response.ok ? 'OBSERVED' : 'UNOBSERVABLE' };
      sources.push(source);
      if (route.endsWith('openapi.json') && response.ok) {
        let spec;
        try { spec = JSON.parse(body); } catch { source.required_operations_present = false; continue; }
        const operations = Object.values(spec.paths ?? {}).flatMap(path => Object.values(path).map(op => op?.operationId));
        contractMatches = REQUIRED_OPERATIONS.every(op => operations.includes(op));
        source.required_operations_present = contractMatches;
      }
    } catch {
      sources.push({ url, http_status: null, body_sha256: null, status: 'UNOBSERVABLE' });
    }
  }
  const receipt = {
    schema_version: 'forge-public-preflight.v1', observed_at_epoch: now(), status: 'BLOCKED',
    sources, contract_structure: contractMatches ? 'OBSERVED' : 'UNPROVABLE',
    practice_allowance: null, authorized_run_id: null,
    blockers: ['Authenticated Forge allowance/owned-run readback required', 'Exact-revision VPS deployment and integrated gameplay adapters require evidence'],
    gameplay_requests: 0, paid_requests: 0,
  };
  return { ...receipt, receipt_sha256: sha256(JSON.stringify(receipt)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const receipt = await readPublicForgeContract();
  console.log(JSON.stringify(receipt, null, 2));
  process.exitCode = 2; // BLOCKED is not a successful qualification.
}
