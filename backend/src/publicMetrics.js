import { canonicalJson, sha256Hex } from './validation.js';

export const PRICE_POLICY = Object.freeze({
  currency: 'EUR',
  base_price_cents: 425,
  increment_cents: 100,
  verified_actions_per_increment: 15,
});

function httpsUrl(value, { hosts = [] } = {}) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (hosts.length && !hosts.includes(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function pricingForVerifiedActions(verifiedActions) {
  const count = Number.isSafeInteger(verifiedActions) && verifiedActions >= 0 ? verifiedActions : 0;
  const completedPriceSteps = Math.floor(count / PRICE_POLICY.verified_actions_per_increment);
  const nextPriceStepAt = (completedPriceSteps + 1) * PRICE_POLICY.verified_actions_per_increment;
  return {
    ...PRICE_POLICY,
    verified_device_readback_actions: count,
    completed_price_steps: completedPriceSteps,
    current_price_cents: PRICE_POLICY.base_price_cents + (completedPriceSteps * PRICE_POLICY.increment_cents),
    next_price_step_at_verified_actions: nextPriceStepAt,
    verified_actions_until_next_step: nextPriceStepAt - count,
  };
}

function publicLinks(options = {}) {
  const sourceRepository = httpsUrl(options.sourceRepositoryUrl || process.env.PUBLIC_SOURCE_REPOSITORY_URL || 'https://github.com/OuroborosCollective/ARE_AGENT_STUDIO', { hosts: ['github.com'] });
  const huggingFaceProject = httpsUrl(options.huggingFaceProjectUrl || process.env.PUBLIC_HUGGING_FACE_PROJECT_URL, { hosts: ['huggingface.co'] });
  const apkClientRepository = httpsUrl(options.apkClientRepositoryUrl || process.env.PUBLIC_APK_CLIENT_REPOSITORY_URL, { hosts: ['github.com'] });
  const apkRelease = httpsUrl(options.apkReleaseUrl || process.env.PUBLIC_APK_RELEASE_URL, { hosts: ['github.com'] });
  const checkoutUrl = httpsUrl(options.checkoutUrl || process.env.PUBLIC_CHECKOUT_URL);
  const requestedProvider = options.paymentProvider || process.env.PUBLIC_PAYMENT_PROVIDER || 'none';
  const paymentProvider = checkoutUrl && ['paypal', 'crypto'].includes(requestedProvider) ? requestedProvider : 'none';
  return {
    source_repository_url: sourceRepository,
    hugging_face_project_url: huggingFaceProject,
    hugging_face_publication_status: huggingFaceProject ? 'linked_project_only' : 'not_published',
    apk_client_repository_url: apkClientRepository,
    apk_release_url: apkRelease,
    apk_release_status: apkRelease ? 'linked_release_only' : 'not_published',
    checkout_url: paymentProvider === 'none' ? null : checkoutUrl,
    checkout_provider: paymentProvider,
    purchase_enabled: paymentProvider !== 'none',
  };
}

export async function buildPublicMetrics({ datasetStore, operationCorrectionStore, verifiedImitationStore, publicInfo = {} }) {
  const [dataset, corrections, verifiedImitations] = await Promise.all([
    datasetStore.publicStats(),
    operationCorrectionStore.stats(),
    verifiedImitationStore.stats(),
  ]);
  const pricing = pricingForVerifiedActions(verifiedImitations.verified_device_readback_actions);
  const links = publicLinks(publicInfo);
  const body = {
    schema_version: 'are-agent-public-metrics.v1',
    metric_scope: {
      dataset: 'aggregate counts and ledger hashes only; raw samples are not served by this endpoint',
      verified_imitation: 'only append-only device-readback records with hash-bound action, observation, bridge-receipt, and independent-evidence digests count',
      operation_correction: 'aggregate count only; correction records and candidates remain protected operational data',
      pricing: 'base price plus one euro for every complete fifteen countable verified device-readback actions',
    },
    dataset,
    verified_imitation: verifiedImitations,
    operation_corrections: { unique_corrections: corrections.unique_corrections, ledger_sha256: corrections.ledger_sha256 },
    pricing,
    access: {
      dataset_download: 'disabled',
      public_metrics_only: true,
    },
    links,
  };
  return { ...body, snapshot_sha256: sha256Hex(canonicalJson(body)) };
}
