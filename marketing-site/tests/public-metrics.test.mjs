import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEuro, normalizePublicMetrics } from '../src/publicMetrics.js';

const hash = 'a'.repeat(64);

function fixture(overrides = {}) {
  return {
    schema_version: 'are-agent-public-metrics.v1',
    snapshot_sha256: hash,
    dataset: { accepted_unique_samples: 7, publication_approved_samples: 2, ledger_sha256: hash },
    verified_imitation: { verified_device_readback_actions: 16, ledger_sha256: hash },
    operation_corrections: { unique_corrections: 3, ledger_sha256: hash },
    pricing: { current_price_cents: 525, verified_actions_until_next_step: 14, verified_actions_per_increment: 15 },
    links: {
      source_repository_url: 'https://github.com/OuroborosCollective/ARE_AGENT_STUDIO',
      hugging_face_project_url: null,
      apk_client_repository_url: null,
      apk_release_url: null,
      checkout_url: null,
      checkout_provider: 'none',
      purchase_enabled: false,
    },
    ...overrides,
  };
}

test('normalizes aggregate public metrics without accepting unsafe checkout links', () => {
  const metrics = normalizePublicMetrics(fixture({ links: { source_repository_url: 'https://github.com/OuroborosCollective/ARE_AGENT_STUDIO', checkout_url: 'http://unsafe.example', checkout_provider: 'paypal', purchase_enabled: true } }));
  assert.equal(metrics.acceptedSamples, 7);
  assert.equal(metrics.verifiedDeviceReadbackActions, 16);
  assert.equal(metrics.checkoutUrl, null);
  assert.equal(metrics.purchaseEnabled, false);
  assert.equal(metrics.sourceRepositoryUrl, 'https://github.com/OuroborosCollective/ARE_AGENT_STUDIO');
});

test('uses a deterministic German euro format', () => {
  assert.equal(formatEuro(425), '4,25 €');
});

test('rejects a response that is not the public metrics schema', () => {
  assert.throws(() => normalizePublicMetrics({ schema_version: 'wrong' }), /public ARE schema/);
});
