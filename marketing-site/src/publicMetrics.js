const DEFAULT_SOURCE_REPOSITORY = 'https://github.com/OuroborosCollective/ARE_AGENT_STUDIO';
const runtimeEnv = import.meta.env || {};

export const METRICS_ENDPOINT = runtimeEnv.VITE_ARE_PUBLIC_METRICS_URL || '/api/v1/public/metrics';

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function hash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : null;
}

function safeHttpsUrl(value, allowedHosts = []) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (allowedHosts.length > 0 && !allowedHosts.includes(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function formatEuro(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) return '—';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatCount(value) {
  if (!Number.isSafeInteger(value) || value < 0) return '—';
  return new Intl.NumberFormat('de-DE').format(value);
}

export function normalizePublicMetrics(payload) {
  if (!payload || payload.schema_version !== 'are-agent-public-metrics.v1') {
    throw new Error('The metrics response does not match the public ARE schema.');
  }

  const dataset = payload.dataset || {};
  const verified = payload.verified_imitation || {};
  const corrections = payload.operation_corrections || {};
  const pricing = payload.pricing || {};
  const links = payload.links || {};

  return {
    snapshotHash: hash(payload.snapshot_sha256),
    acceptedSamples: count(dataset.accepted_unique_samples),
    publicationApprovedSamples: count(dataset.publication_approved_samples),
    datasetLedgerHash: hash(dataset.ledger_sha256),
    verifiedDeviceReadbackActions: count(verified.verified_device_readback_actions),
    verifiedLedgerHash: hash(verified.ledger_sha256),
    ownerConfirmedCorrections: count(corrections.unique_corrections),
    currentPriceCents: Number.isSafeInteger(pricing.current_price_cents) && pricing.current_price_cents >= 0
      ? pricing.current_price_cents
      : null,
    actionsUntilNextPriceStep: Number.isSafeInteger(pricing.verified_actions_until_next_step) && pricing.verified_actions_until_next_step >= 0
      ? pricing.verified_actions_until_next_step
      : null,
    actionStepSize: Number.isSafeInteger(pricing.verified_actions_per_increment) && pricing.verified_actions_per_increment > 0
      ? pricing.verified_actions_per_increment
      : null,
    sourceRepositoryUrl: safeHttpsUrl(links.source_repository_url, ['github.com']) || DEFAULT_SOURCE_REPOSITORY,
    huggingFaceProjectUrl: safeHttpsUrl(links.hugging_face_project_url, ['huggingface.co']),
    huggingFaceStatus: links.hugging_face_publication_status === 'linked_project_only' ? 'linked_project_only' : 'not_published',
    apkClientRepositoryUrl: safeHttpsUrl(links.apk_client_repository_url, ['github.com']),
    apkReleaseUrl: safeHttpsUrl(links.apk_release_url, ['github.com']),
    checkoutUrl: safeHttpsUrl(links.checkout_url),
    checkoutProvider: ['paypal', 'crypto'].includes(links.checkout_provider) ? links.checkout_provider : 'none',
    purchaseEnabled: links.purchase_enabled === true && Boolean(safeHttpsUrl(links.checkout_url)),
  };
}

export function metricFetchMessage(error) {
  if (error?.name === 'AbortError') return 'Die Evidenzverbindung hat zu lange gebraucht.';
  return 'Die öffentliche Evidenzschnittstelle ist gerade nicht erreichbar.';
}
