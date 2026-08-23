import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DatasetStore } from './datasetStore.js';
import { OperationCorrectionStore } from './operationCorrectionStore.js';
import { VerifiedImitationStore } from './verifiedImitationStore.js';
import { buildPublicMetrics } from './publicMetrics.js';
import { createAdbBridge } from './adbBridge.js';
import { createAdvisoryGateway } from './advisoryGateway.js';


const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

async function serveStaticFile(res, staticDir, pathname) {
  if (!staticDir) return false;
  const root = path.resolve(staticDir);
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = path.resolve(root, requested);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return false;

  const tryRead = async (filePath) => {
    try { return await fs.readFile(filePath); }
    catch (error) { if (error?.code === 'ENOENT' || error?.code === 'EISDIR') return null; throw error; }
  };

  let body = await tryRead(candidate);
  let servedPath = candidate;
  if (!body && !path.extname(requested)) {
    servedPath = path.join(root, 'index.html');
    body = await tryRead(servedPath);
  }
  if (!body) return false;
  res.writeHead(200, {
    'content-type': MIME_TYPES[path.extname(servedPath).toLowerCase()] || 'application/octet-stream',
    'content-length': body.length,
    'cache-control': path.basename(servedPath) === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  res.end(body);
  return true;
}

function json(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(payload), ...extraHeaders });
  res.end(payload);
}

function parseSize(value = '25mb') {
  const match = String(value).trim().toLowerCase().match(/^(\d+)(kb|mb|b)?$/);
  if (!match) return 25 * 1024 * 1024;
  const amount = Number(match[1]);
  return amount * (match[2] === 'kb' ? 1024 : match[2] === 'mb' ? 1024 * 1024 : 1);
}

async function readBody(req, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      const err = new Error('request entity too large');
      err.code = 'ENTITY_TOO_LARGE';
      throw err;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseRows(raw, contentType) {
  if (!raw.trim()) throw new Error('request body is empty');
  if (contentType.includes('application/jsonl') || contentType.includes('application/x-ndjson')) {
    return raw.split('\n').filter((line) => line.trim()).map((line, index) => {
      try { return JSON.parse(line); }
      catch { const err = new Error(`invalid JSONL at line ${index + 1}`); err.code = 'INVALID_JSONL'; throw err; }
    });
  }
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function allowedOriginHeaders(req, allowedOrigins) {
  const origin = req.headers.origin;
  if (!origin) return {};
  if (!allowedOrigins.has(origin)) return null;
  return { 'access-control-allow-origin': origin, vary: 'origin' };
}

export async function createHttpServer(options = {}) {
  const store = options.store || new DatasetStore({ dataDir: options.dataDir || process.env.DATASET_DIR || './data' });
  const operationCorrectionStore = options.operationCorrectionStore || new OperationCorrectionStore({
    dataDir: options.operationCorrectionDataDir || process.env.OPERATION_CORRECTION_DIR || options.dataDir || process.env.DATASET_DIR || './data',
  });
  const verifiedImitationStore = options.verifiedImitationStore || new VerifiedImitationStore({
    dataDir: options.verifiedImitationDataDir || process.env.VERIFIED_IMITATION_DIR || options.dataDir || process.env.DATASET_DIR || './data',
  });
  await Promise.all([store.init(), operationCorrectionStore.init(), verifiedImitationStore.init()]);
  const authToken = options.authToken ?? process.env.DATASET_AUTH_TOKEN ?? '';
  const maxBytes = parseSize(options.maxBodySize || process.env.API_PAYLOAD_MAX_SIZE || '25mb');
  const staticDir = options.staticDir ?? process.env.STATIC_DIR ?? '';
  const writeEnabled = options.writeEnabled ?? String(process.env.DATASET_WRITE_ENABLED ?? 'true').toLowerCase() === 'true';
  const operationCorrectionWriteEnabled = options.operationCorrectionWriteEnabled
    ?? String(process.env.OPERATION_CORRECTION_WRITE_ENABLED ?? 'false').toLowerCase() === 'true';
  const verifiedImitationWriteEnabled = options.verifiedImitationWriteEnabled
    ?? String(process.env.VERIFIED_IMITATION_WRITE_ENABLED ?? 'false').toLowerCase() === 'true';
  const datasetExportEnabled = options.datasetExportEnabled
    ?? String(process.env.DATASET_EXPORT_ENABLED ?? 'false').toLowerCase() === 'true';
  const allowedOrigins = new Set((options.allowedOrigins || process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((v) => v.trim()).filter(Boolean));
  const advisory = options.advisoryGateway || createAdvisoryGateway();
  const adb = options.adbBridge || createAdbBridge({
    enabled: String(process.env.ENABLE_ADB_BRIDGE).toLowerCase() === 'true',
    allowedSerials: (process.env.ADB_ALLOWED_SERIALS || '').split(',').map((v) => v.trim()),
  });

  const server = http.createServer(async (req, res) => {
    const cors = allowedOriginHeaders(req, allowedOrigins);
    if (cors === null) return json(res, 403, { success: false, error: 'origin denied' });
    Object.entries(cors).forEach(([key, value]) => res.setHeader(key, value));

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,authorization,x-client-uuid' });
      return res.end();
    }

    const url = new URL(req.url || '/', 'http://localhost');
    const authorized = !authToken || req.headers.authorization === `Bearer ${authToken}`;

    try {
      if (req.method === 'GET' && url.pathname === '/api/v1/health') {
        const advisoryStatus = typeof advisory.status === 'function'
          ? advisory.status()
          : { enabled: Boolean(advisory.enabled), provider_label: null, model: null, route_kind: 'server_openai_compatible' };
        return json(res, 200, {
          ok: true,
          service: 'are-agent-studio-dataset',
          ...(await store.stats()),
          dataset_write_enabled: writeEnabled,
          dataset_export_enabled: datasetExportEnabled,
          operation_correction_write_enabled: operationCorrectionWriteEnabled,
          verified_imitation_write_enabled: verifiedImitationWriteEnabled,
          adb_enabled: adb.enabled,
          advisory_enabled: advisoryStatus.enabled,
          advisory_provider: advisoryStatus.provider_label,
          advisory_model: advisoryStatus.model,
          advisory_route_kind: advisoryStatus.route_kind,
        });
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/public/metrics') {
        return json(res, 200, await buildPublicMetrics({
          datasetStore: store,
          operationCorrectionStore,
          verifiedImitationStore,
          publicInfo: options.publicInfo,
        }));
      }
      if (!authorized && url.pathname.startsWith('/api/v1/')) return json(res, 401, { success: false, error: 'unauthorized' });

      if (req.method === 'GET' && url.pathname === '/api/v1/dataset/stats') return json(res, 200, await store.stats());
      if (req.method === 'GET' && url.pathname === '/api/v1/dataset/export.jsonl') {
        if (!datasetExportEnabled) return json(res, 403, { success: false, error: 'dataset export is disabled; public dataset downloads are not served by this runtime' });
        if (!authToken || !authorized) return json(res, 401, { success: false, error: 'dataset export requires an authenticated export configuration' });
        const payload = await store.readLedger();
        res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'content-length': Buffer.byteLength(payload) });
        return res.end(payload);
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/telemetry/push') {
        if (!writeEnabled) { const err = new Error('dataset writes are disabled in this runtime'); err.code = 'DATASET_WRITE_DISABLED'; throw err; }
        const raw = await readBody(req, maxBytes);
        const rows = parseRows(raw, String(req.headers['content-type'] || 'application/json'));
        const receipt = await store.append(rows, { clientId: req.headers['x-client-uuid'] });
        return json(res, 201, { success: true, receipt });
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/operation-corrections/stats') return json(res, 200, await operationCorrectionStore.stats());
      if (req.method === 'GET' && url.pathname === '/api/v1/operation-corrections/export.jsonl') {
        if (!authToken || !authorized) return json(res, 401, { success: false, error: 'operation correction export requires an authenticated operational configuration' });
        const payload = await operationCorrectionStore.readLedger();
        res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'content-length': Buffer.byteLength(payload) });
        return res.end(payload);
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/operation-corrections/candidates') {
        if (!authToken || !authorized) return json(res, 401, { success: false, error: 'operation correction candidates require an authenticated operational configuration' });
        return json(res, 200, await operationCorrectionStore.learningProjection());
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/operation-corrections/push') {
        if (!operationCorrectionWriteEnabled) { const err = new Error('operation correction writes are disabled in this runtime'); err.code = 'OPERATION_CORRECTION_WRITE_DISABLED'; throw err; }
        const raw = await readBody(req, maxBytes);
        const rows = parseRows(raw, String(req.headers['content-type'] || 'application/json'));
        const receipt = await operationCorrectionStore.append(rows, { clientId: req.headers['x-client-uuid'] });
        return json(res, 201, { success: true, receipt });
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/verified-imitations/stats') return json(res, 200, await verifiedImitationStore.stats());
      if (req.method === 'POST' && url.pathname === '/api/v1/verified-imitations/push') {
        if (!verifiedImitationWriteEnabled) { const err = new Error('verified imitation writes are disabled in this runtime'); err.code = 'VERIFIED_IMITATION_WRITE_DISABLED'; throw err; }
        if (!authToken || !authorized) return json(res, 401, { success: false, error: 'verified imitation writes require an authenticated evaluation configuration' });
        const raw = await readBody(req, maxBytes);
        const rows = parseRows(raw, String(req.headers['content-type'] || 'application/json'));
        const receipt = await verifiedImitationStore.append(rows, { clientId: req.headers['x-client-uuid'] });
        return json(res, 201, { success: true, receipt });
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/device/tap') {
        const raw = await readBody(req, Math.min(maxBytes, 64 * 1024));
        const result = await adb.injectTap(JSON.parse(raw));
        return json(res, 200, { success: true, result });
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/advisory/complete') {
        const raw = await readBody(req, maxBytes);
        const body = JSON.parse(raw);
        const result = await advisory.complete({ prompt: body?.prompt, imageDataUrl: body?.image_data_url });
        return json(res, 200, { success: true, result });
      }
      if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
        if (await serveStaticFile(res, staticDir, url.pathname)) return;
      }
      return json(res, 404, { success: false, error: 'not found' });
    } catch (error) {
      const status = error?.code === 'ENTITY_TOO_LARGE' ? 413
        : error?.code === 'DATASET_WRITE_DISABLED' ? 503
        : error?.code === 'OPERATION_CORRECTION_WRITE_DISABLED' ? 503
        : error?.code === 'VERIFIED_IMITATION_WRITE_DISABLED' ? 503
        : error?.code === 'ADB_DISABLED' ? 503
        : error?.code === 'ADB_SERIAL_DENIED' ? 403
        : error?.code === 'ADVISORY_DISABLED' ? 503
        : error?.code === 'ADVISORY_PROVIDER_ERROR' ? 502
        : ['INVALID_JSONL', 'INVALID_DATASET_ROW', 'INVALID_OPERATION_CORRECTION', 'ADVISORY_INVALID_REQUEST', 'ADVISORY_INVALID_RESPONSE', 'ADVISORY_CONFIG_INVALID'].includes(error?.code) ? 422
        : 400;
      return json(res, status, { success: false, error: error?.message || 'request rejected' });
    }
  });

  return { server, store, operationCorrectionStore, verifiedImitationStore };
}
