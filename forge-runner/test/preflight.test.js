import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPublicForgeContract } from '../preflight.js';

test('public discovery is GET-only and cannot assert allowance or qualification', async () => {
  const requests = [];
  const receipt = await readPublicForgeContract({ fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return new Response('{}');
  } });
  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(request.options.method, 'GET');
    assert.equal(request.options.redirect, 'error');
    assert.equal(request.options.headers, undefined);
    assert.ok(request.url.startsWith('https://forgeai.gg/'));
  }
  assert.equal(receipt.status, 'BLOCKED');
  assert.equal(receipt.practice_allowance, null);
  assert.equal(receipt.contract_structure, 'UNPROVABLE');
  assert.equal(receipt.gameplay_requests, 0);
  assert.match(receipt.receipt_sha256, /^[a-f0-9]{64}$/);
});

test('network errors remain unobservable and never expose exception content', async () => {
  const receipt = await readPublicForgeContract({ fetchImpl: async () => { throw Error('sensitive error text'); } });
  assert.ok(receipt.sources.every(s => s.status === 'UNOBSERVABLE'));
  assert.ok(!JSON.stringify(receipt).includes('sensitive error text'));
  assert.equal(receipt.status, 'BLOCKED');
});
