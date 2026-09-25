import { validateDataImageUrl } from './validation.js';

function advisoryError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function extractAssistantText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content.map((part) => typeof part?.text === 'string' ? part.text : '').filter(Boolean).join('\n').trim();
    if (text) return text;
  }
  throw advisoryError('advisory provider returned no assistant text', 'ADVISORY_INVALID_RESPONSE');
}

export function createAdvisoryGateway(options = {}) {
  const endpoint = options.endpoint ?? process.env.ADVISORY_API_URL ?? '';
  const token = options.token ?? process.env.ADVISORY_API_TOKEN ?? '';
  const model = options.model ?? process.env.ADVISORY_MODEL ?? '';
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  let parsedEndpoint = null;
  if (endpoint) {
    try {
      parsedEndpoint = new URL(endpoint);
      if (!['https:', 'http:'].includes(parsedEndpoint.protocol)) throw new Error('unsupported protocol');
    } catch (cause) {
      // A misconfigured advisory URL must degrade the optional advisory feature
      // to disabled. Throwing here (the previous behaviour) crashed the entire
      // dataset daemon at boot and made the request-level ADVISORY_CONFIG_INVALID
      // -> 422 mapping unreachable dead code.
      console.warn(`[advisory] ADVISORY_API_URL is invalid (${cause?.message || cause}); advisory disabled`);
      parsedEndpoint = null;
    }
  }

  const enabled = Boolean(parsedEndpoint && model);

  return {
    enabled,
    model: model || null,
    async complete({ prompt, imageDataUrl }) {
      if (!enabled) throw advisoryError('advisory provider is not configured', 'ADVISORY_DISABLED');
      if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 30_000) throw advisoryError('invalid advisory prompt', 'ADVISORY_INVALID_REQUEST');
      if (imageDataUrl != null && !validateDataImageUrl(imageDataUrl)) throw advisoryError('advisory image must be a complete image data URL', 'ADVISORY_INVALID_REQUEST');

      const content = [{ type: 'text', text: prompt.trim() }];
      if (imageDataUrl) content.push({ type: 'image_url', image_url: { url: imageDataUrl } });
      const headers = { 'content-type': 'application/json' };
      if (token) headers.authorization = `Bearer ${token}`;

      let response;
      try {
        response = await fetchImpl(parsedEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ model, messages: [{ role: 'user', content }], temperature: 0 }),
        });
      } catch (cause) {
        // A transport-level failure (DNS, connection refused, timeout) is a
        // bad-gateway condition, not a client error. Previously this surfaced as
        // an uncoded Error and was mapped to 400.
        throw advisoryError(`advisory provider is unreachable: ${cause?.message || cause}`, 'ADVISORY_PROVIDER_ERROR');
      }
      const raw = await response.text();
      let payload;
      try { payload = JSON.parse(raw); }
      catch { throw advisoryError(`advisory provider returned non-JSON HTTP ${response.status}`, 'ADVISORY_INVALID_RESPONSE'); }
      if (!response.ok) {
        const providerMessage = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
        throw advisoryError(`advisory provider rejected request: ${providerMessage}`, 'ADVISORY_PROVIDER_ERROR');
      }
      return { text: extractAssistantText(payload), model };
    },
  };
}
