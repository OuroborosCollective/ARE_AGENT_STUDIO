import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdvisoryGateway } from '../src/advisoryGateway.js';

const frame = `data:image/png;base64,${Buffer.from('0123456789abcdef').toString('base64')}`;

test('advisory gateway is fail-closed when not configured', async () => {
  const gateway = createAdvisoryGateway({ endpoint: '', model: '' });
  assert.equal(gateway.enabled, false);
  assert.deepEqual(gateway.status(), { enabled: false, provider_label: null, model: null, route_kind: 'server_openai_compatible' });
  await assert.rejects(() => gateway.complete({ prompt: 'test' }), (error) => error.code === 'ADVISORY_DISABLED');
});

test('advisory gateway uses only the backend-configured endpoint and validates complete images', async () => {
  let captured;
  const gateway = createAdvisoryGateway({
    endpoint: 'https://provider.example/v1/chat/completions',
    model: 'vision-model',
    token: 'secret-test-token',
    providerLabel: 'Approved test route',
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const result = await gateway.complete({ prompt: 'inspect frame', imageDataUrl: frame });
  assert.equal(result.text, '{"ok":true}');
  assert.equal(captured.url, 'https://provider.example/v1/chat/completions');
  assert.equal(captured.options.headers.authorization, 'Bearer secret-test-token');
  assert.match(captured.options.body, /vision-model/);
  assert.deepEqual(gateway.status(), {
    enabled: true,
    provider_label: 'Approved test route',
    model: 'vision-model',
    route_kind: 'server_openai_compatible',
  }, 'health metadata may name the approved route but never exposes a token or endpoint');
  await assert.rejects(() => gateway.complete({ prompt: 'bad', imageDataUrl: 'data:image/png;base64,mock' }), (error) => error.code === 'ADVISORY_INVALID_REQUEST');
});
