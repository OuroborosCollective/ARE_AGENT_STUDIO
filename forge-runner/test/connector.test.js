import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { ForgeConnector } from '../connector.js';
import { projectDiscovery, readForgeAccount } from '../accountReadback.js';

const secret = ['fixture', 'credential', 'only'].join('-');
const revision = 'a'.repeat(40);

test('missing credential performs no network call', async () => {
  const receipt = await readForgeAccount({ gitSha: revision, fetchImpl: () => { throw Error('must not fetch'); } });
  assert.equal(receipt.credential_configured, false);
  assert.ok(receipt.sources.every(s => s.error_code === 'MISSING_CREDENTIAL'));
  assert.equal(receipt.authentication_status, 'UNPROVABLE');
});

test('uses fixed Forge GET endpoints, bearer header, redirect refusal and no retries', async () => {
  const requests = [];
  const receipt = await readForgeAccount({ credential: secret, gitSha: revision, fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify({ freeRunsRemaining: 2, dungeons: [{ registrationKey: secret }], runs: [], token: secret, email: 'private@example.test' }));
  } });
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.map(r => r.url), ['https://forgeai.gg/api/connectors/dungeons', 'https://forgeai.gg/api/connectors/dungeons/runs']);
  for (const { options } of requests) {
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, `Bearer ${secret}`);
  }
  assert.equal(receipt.authentication_status, 'OBSERVED');
  assert.equal(receipt.qualification_status, 'BLOCKED');
  assert.equal(receipt.entry_requests, 0);
  assert.ok(!JSON.stringify(receipt).includes(secret));
  assert.ok(!JSON.stringify(receipt).includes('private@example.test'));
  assert.deepEqual(receipt.sources[0].aggregate_fields, [{ path: '$.freeRunsRemaining', type: 'counter', value: 2 }, { path: '$.dungeons', type: 'array', count: 1 }, { path: '$.runs', type: 'array', count: 0 }]);
});

for (const status of [401, 403, 402, 429, 500]) test(`HTTP ${status} is not authentication proof and body is never emitted`, async () => {
  const client = new ForgeConnector({ credential: secret, fetchImpl: async () => new Response(secret, { status }) });
  const result = await client.listDungeons();
  assert.notEqual(result.status, 'OBSERVED');
  assert.equal(result.data, null);
  assert.equal(result.http_status, status);
  assert.ok(!JSON.stringify(result).includes(secret));
});

test('malformed, oversized and network responses fail closed', async () => {
  for (const [response, expected] of [[() => new Response('not json'), 'INVALID_JSON'], [() => new Response('[]'), 'CONTRACT_DRIFT'], [() => new Response('x'.repeat(2097153)), 'RESPONSE_TOO_LARGE'], [() => { throw Error(secret); }, 'TRANSPORT_ERROR']]) {
    const client = new ForgeConnector({ credential: secret, fetchImpl: async () => response() });
    const result = await client.listOwnedRuns();
    assert.equal(result.error_code, expected);
    assert.ok(!JSON.stringify(result).includes(secret));
  }
});

test('unknown, negative, string and nested user data are never projected as allowance', () => {
  assert.deepEqual(projectDiscovery({ freeRunsRemaining: '2', remaining: -1, mystery: { remaining: 7 }, freeRuns: { remaining: 0, email: secret } }), [{ path: '$.freeRuns.remaining', type: 'counter', value: 0 }]);
});

test('real loopback HTTP exercises async bearer transport without contacting Forge', async t => {
  const server = http.createServer((req, res) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.headers.authorization, `Bearer ${secret}`);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ runs: [], dungeons: [] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const receipt = await readForgeAccount({ credential: secret, gitSha: revision, fetchImpl: (url, options) => fetch(`http://127.0.0.1:${server.address().port}${new URL(url).pathname}`, options) });
  assert.equal(receipt.authentication_status, 'OBSERVED');
  assert.equal(receipt.sources[0].http_status, 200);
  assert.equal(receipt.qualification_status, 'BLOCKED');
});
