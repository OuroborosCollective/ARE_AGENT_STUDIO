/** Server-only Forge connector transport. Fixed origin; no paid-entry surface. */
import { createHash } from 'node:crypto';

const BASE = 'https://forgeai.gg';
const MAX_BODY_BYTES = 2 * 1024 * 1024;
export const hashBody = body => createHash('sha256').update(body).digest('hex');

export class ForgeConnector {
  #credential;
  #fetch;
  constructor({ credential, fetchImpl = fetch }) {
    this.#credential = typeof credential === 'string' ? credential.trim() : '';
    this.#fetch = fetchImpl;
  }
  hasCredentials() { return this.#credential.length > 0; }
  listDungeons() { return this.#request('/api/connectors/dungeons', 'dungeons'); }
  listOwnedRuns() { return this.#request('/api/connectors/dungeons/runs', 'runs'); }

  // Read-only discovery first. Gameplay is not enabled by possession of a key.
  async #request(route, collection) {
    const empty = { source: `${BASE}${route}`, http_status: null, body_sha256: null, data: null };
    if (!this.hasCredentials()) return { ...empty, status: 'UNOBSERVABLE', error_code: 'MISSING_CREDENTIAL' };
    try {
      const response = await this.#fetch(`${BASE}${route}`, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${this.#credential}`, Accept: 'application/json' },
      });
      const reader = response.body?.getReader();
      const chunks = [];
      let length = 0;
      if (reader) {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > MAX_BODY_BYTES) {
              await reader.cancel();
              return { ...empty, http_status: response.status, status: 'UNOBSERVABLE', error_code: 'RESPONSE_TOO_LARGE' };
            }
            chunks.push(Buffer.from(value));
          }
        } finally { reader.releaseLock(); }
      }
      const body = Buffer.concat(chunks).toString('utf8');
      const evidence = { ...empty, http_status: response.status, body_sha256: hashBody(body) };
      if (!response.ok) return { ...evidence, status: response.status === 401 || response.status === 403 ? 'REJECTED' : 'UNOBSERVABLE', error_code: `HTTP_${response.status}` };
      let data;
      try { data = JSON.parse(body); } catch { return { ...evidence, status: 'UNPROVABLE', error_code: 'INVALID_JSON' }; }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return { ...evidence, status: 'UNPROVABLE', error_code: 'CONTRACT_DRIFT' };
      if (!Array.isArray(data[collection])) return { ...evidence, data, status: 'UNPROVABLE', error_code: 'CONTRACT_DRIFT' };
      return { ...evidence, data, status: 'OBSERVED', error_code: null };
    } catch {
      // Never serialize fetch errors: messages can contain headers/credentials.
      return { ...empty, status: 'UNOBSERVABLE', error_code: 'TRANSPORT_ERROR' };
    }
  }
}
