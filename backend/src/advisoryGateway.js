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
    } catch {
      throw advisoryError('ADVISORY_API_URL must be a fixed http(s) URL configured on the backend', 'ADVISORY_CONFIG_INVALID');
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

      const response = await fetchImpl(parsedEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages: [{ role: 'user', content }], temperature: 0 }),
      });
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
